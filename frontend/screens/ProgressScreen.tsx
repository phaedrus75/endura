import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Svg, { Rect, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, tasksAPI, badgesAPI, UserStats, Task, BadgeResponse } from '../services/api';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - spacing.lg * 2;

const SUBJECT_GRADIENTS = [
  ['#5F8C87', '#A8D8CF'],  // Teal → Mint
  ['#3B7A6E', '#7BC8B8'],  // Deep teal → Aqua
  ['#4A8FA8', '#8ED4E8'],  // Ocean → Sky blue
  ['#6B8F71', '#B8D9A3'],  // Sage → Light green
  ['#5A7F9A', '#A3CAE0'],  // Steel blue → Ice
  ['#3B6B5E', '#82C4A8'],  // Emerald → Seafoam
  ['#4E8B7A', '#9DDBC4'],  // Jade → Pale mint
  ['#3B5466', '#7BA5C4'],  // Navy → Cornflower
];

const LABEL_PAD = 20;

const formatMinutes = (mins: number): string => {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${h}h${rem}m` : `${h}h`;
  }
  return `${mins}m`;
};

const BarChart = ({ data, height = 150 }: { data: { label: string; value: number; maxValue: number }[]; height?: number }) => {
  const barWidth = (CHART_WIDTH - 60) / data.length - 10;
  const maxVal = Math.max(...data.map(d => d.maxValue || d.value), 1);
  const drawH = height - LABEL_PAD;

  return (
    <Svg width={CHART_WIDTH} height={height + 30}>
      <Defs>
        <LinearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.primary} />
          <Stop offset="100%" stopColor={colors.primaryLight} />
        </LinearGradient>
      </Defs>
      {data.map((item, index) => {
        const barHeight = (item.value / maxVal) * drawH;
        const x = 30 + index * (barWidth + 10);
        const y = LABEL_PAD + drawH - barHeight;

        return (
          <G key={index}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight || 2}
              fill="url(#barGrad)"
              rx={4}
            />
            <SvgText
              x={x + barWidth / 2}
              y={height + 18}
              fill={colors.textSecondary}
              fontSize={10}
              textAnchor="middle"
            >
              {item.label}
            </SvgText>
            {item.value > 0 && (
              <SvgText
                x={x + barWidth / 2}
                y={y - 5}
                fill={colors.textPrimary}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
              >{formatMinutes(item.value)}</SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
};

const SubjectBarChart = ({ data }: { data: { label: string; value: number; gradientIndex: number }[] }) => {
  const filtered = data.filter(d => d.value > 0);
  if (filtered.length === 0) {
    return (
      <View style={{ height: 80, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>No data yet</Text>
      </View>
    );
  }

  const maxVal = Math.max(...filtered.map(d => d.value), 1);

  return (
    <View style={{ width: '100%', paddingHorizontal: 4 }}>
      {filtered.map((item, index) => {
        const pct = (item.value / maxVal) * 100;
        const grad = SUBJECT_GRADIENTS[item.gradientIndex % SUBJECT_GRADIENTS.length];
        return (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ width: 72, fontSize: 12, color: colors.textSecondary, fontWeight: '500' }} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginRight: 4 }}>
              <ExpoLinearGradient
                colors={[grad[0], grad[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.max(Math.min(pct, 72), 8)}%`, height: 22, borderRadius: 11 }}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginLeft: 8, flexShrink: 0 }}>
                {formatMinutes(item.value)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// Progress Bar Component with gradient fill
const ProgressBar = ({ value, maxValue, label, color }: { value: number; maxValue: number; label: string; color: string }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <Text style={styles.progressBarLabel}>{label}</Text>
        <Text style={styles.progressBarValue}>{value} / {maxValue}</Text>
      </View>
      <View style={styles.progressBarTrack}>
        {percentage > 0 && (
          <ExpoLinearGradient
            colors={['#A8C8D8', '#5F8C87', '#3B5466']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${percentage}%` }]}
          />
        )}
      </View>
    </View>
  );
};

export default function ProgressScreen() {
  const { user, profilePic } = useAuth();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subjectStudyTime, setSubjectStudyTime] = useState<{ [key: string]: number }>({});
  const [loadError, setLoadError] = useState(false);
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeResponse | null>(null);
  const modalScale = useRef(new Animated.Value(0)).current;
  const [hasSeenTips, setHasSeenTips] = useState(true);
  const tipsPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const checkTips = async () => {
      const seen = await AsyncStorage.getItem(`hasSeenTips_${user?.id || 'anon'}`);
      setHasSeenTips(seen === 'true');
    };
    checkTips();
  }, [user?.id]);

  useEffect(() => {
    if (!hasSeenTips) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(tipsPulse, { toValue: 1.25, duration: 800, useNativeDriver: true }),
          Animated.timing(tipsPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [hasSeenTips]);

  const handleOpenTips = async () => {
    if (!hasSeenTips) {
      setHasSeenTips(true);
      await AsyncStorage.setItem(`hasSeenTips_${user?.id || 'anon'}`, 'true');
    }
    navigation.navigate('Tips');
  };

  const loadData = async () => {
    try {
      setLoadError(false);
      const [statsData, tasksData, badgesData] = await Promise.all([
        statsAPI.getStats(),
        tasksAPI.getTasks(true),
        badgesAPI.getBadges().catch(() => []),
      ]);
      setStats(statsData);
      setTasks(tasksData);
      setBadges(badgesData);
      
      if (statsData.study_minutes_by_subject) {
        setSubjectStudyTime(statsData.study_minutes_by_subject);
      }
    } catch (error) {
      console.error('Failed to load progress data:', error);
      setLoadError(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const openBadge = (badge: BadgeResponse) => {
    setSelectedBadge(badge);
    modalScale.setValue(0);
    Animated.spring(modalScale, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }).start();
  };
  const closeBadge = () => {
    Animated.timing(modalScale, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => setSelectedBadge(null));
  };

  const TIER_COLORS: Record<string, { bg: string; border: string; label: string }> = {
    bronze:  { bg: '#E7EFEA', border: '#8B7D6B', label: 'Bronze' },
    silver:  { bg: '#E7EFEA', border: '#A9BDAF', label: 'Silver' },
    gold:    { bg: '#A8C8D830', border: '#5F8C87', label: 'Gold' },
    diamond: { bg: '#3B546620', border: '#2F4A3E', label: 'Diamond' },
  };
  const CATEGORY_LABELS: Record<string, { title: string; emoji: string }> = {
    getting_started: { title: 'Getting Started', emoji: '🚀' },
    streaks:         { title: 'Streaks & Consistency', emoji: '🔥' },
    study_time:      { title: 'Study Time', emoji: '⏱️' },
    habits:          { title: 'Time of Day & Habits', emoji: '🌤️' },
    animals:         { title: 'Animals & Hatching', emoji: '🐣' },
    eco_credits:     { title: 'Eco-Credits & Shopping', emoji: '🍀' },
    subjects:        { title: 'Subject Mastery', emoji: '📖' },
    sanctuary:       { title: 'Sanctuary Customisation', emoji: '🎨' },
    social:          { title: 'Social', emoji: '🦋' },
  };
  const CATEGORY_ORDER = [
    'getting_started', 'streaks', 'study_time', 'habits',
    'animals', 'eco_credits', 'subjects', 'sanctuary', 'social',
  ];

  const earnedCount = badges.filter(b => b.earned).length;
  const badgesByCategory: Record<string, BadgeResponse[]> = {};
  badges.forEach(b => {
    if (!badgesByCategory[b.category]) badgesByCategory[b.category] = [];
    badgesByCategory[b.category].push(b);
  });

  // Prepare subject pie chart data
  const subjectChartData = Object.entries(subjectStudyTime)
    .sort(([, a], [, b]) => b - a)
    .map(([subject, minutes], index) => ({
      label: subject,
      value: minutes,
      gradientIndex: index,
    }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>My Progress</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={handleOpenTips}
            >
              <Text style={styles.profileButtonEmoji}>💡</Text>
              {!hasSeenTips && (
                <Animated.View style={[styles.tipsDot, { transform: [{ scale: tipsPulse }] }]} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.profileButtonImage} />
              ) : (
                <Text style={styles.profileButtonEmoji}>👤</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loadError && (
          <View style={{ backgroundColor: '#E7EFEA', padding: 12, borderRadius: 12, marginBottom: spacing.md }}>
            <Text style={{ color: '#3B5466', fontSize: 13, textAlign: 'center' }}>
              ⚠️ Couldn't load progress data. Pull down to retry.
            </Text>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{formatTime(stats?.total_study_minutes || 0)}</Text>
            <Text style={styles.quickStatLabel}>Total Study</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{stats?.total_sessions || 0}</Text>
            <Text style={styles.quickStatLabel}>Sessions</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{stats?.current_streak || 0}</Text>
            <Text style={styles.quickStatLabel}>🔥 Streak</Text>
          </View>
        </View>

        {/* Weekly Study Bar Chart */}
        <View style={[styles.chartCard, { alignItems: 'center' }]}>
          <Text style={[styles.chartTitle, { alignSelf: 'flex-start' }]}>This Past Week</Text>
          <BarChart 
            data={(() => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const weekly = stats?.weekly_study_minutes || [];
              const maxVal = Math.max(...(Array.isArray(weekly) ? weekly : [0]), 30);
              return days.map((label, i) => ({
                label,
                value: Array.isArray(weekly) ? (weekly[i] || 0) : 0,
                maxValue: maxVal,
              }));
            })()}
          />
          <Text style={styles.chartSubtext}>Minutes studied per day</Text>
        </View>

        {/* Monthly Study Bar Chart */}
        <View style={[styles.chartCard, { alignItems: 'center' }]}>
          <Text style={[styles.chartTitle, { alignSelf: 'flex-start' }]}>This Past Month</Text>
          <BarChart 
            data={(() => {
              const weeks = ['Week 1', 'Week 2', 'Week 3', 'This Week'];
              let monthly = Array.isArray(stats?.monthly_study_minutes) ? stats.monthly_study_minutes : [0, 0, 0, 0];
              if (monthly.every((v: number) => v === 0) && Array.isArray(stats?.weekly_study_minutes)) {
                const thisWeekTotal = stats.weekly_study_minutes.reduce((a: number, b: number) => a + b, 0);
                monthly = [0, 0, 0, thisWeekTotal];
              }
              const maxVal = Math.max(...monthly, 30);
              return weeks.map((label, i) => ({
                label,
                value: monthly[i] || 0,
                maxValue: maxVal,
              }));
            })()}
          />
          <Text style={styles.chartSubtext}>Minutes studied per week</Text>
        </View>

        {/* Subject Distribution Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Study Time by Subject</Text>
          <SubjectBarChart data={subjectChartData} />
          <Text style={[styles.chartSubtext, { marginTop: 4 }]}>Minutes studied per subject</Text>
        </View>

        {/* Badges Section */}
        <View style={styles.badgesSection}>
          <View style={styles.badgesSectionHeader}>
            <Text style={styles.badgesSectionTitle}>🏅 Badges</Text>
            <Text style={styles.badgesSectionCount}>{earnedCount} / {badges.length}</Text>
          </View>

          <View style={styles.badgesProgressContainer}>
            <View style={styles.badgesProgressTrack}>
              <View
                style={[
                  styles.badgesProgressFill,
                  { width: badges.length > 0 ? `${(earnedCount / badges.length) * 100}%` : '0%' },
                ]}
              />
            </View>
            <View style={styles.badgesTierRow}>
              {(['bronze', 'silver', 'gold', 'diamond'] as const).map(tier => {
                const t = TIER_COLORS[tier];
                const c = badges.filter(b => b.tier === tier && b.earned).length;
                const tot = badges.filter(b => b.tier === tier).length;
                return (
                  <View key={tier} style={styles.badgesTierPill}>
                    <View style={[styles.badgesTierDot, { backgroundColor: t.border }]} />
                    <Text style={styles.badgesTierText}>{c}/{tot}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {CATEGORY_ORDER.map(cat => {
            const list = badgesByCategory[cat];
            if (!list || list.length === 0) return null;
            const catInfo = CATEGORY_LABELS[cat] || { title: cat, emoji: '' };
            const catEarned = list.filter(b => b.earned).length;
            return (
              <View key={cat} style={styles.badgesCategoryBlock}>
                <View style={styles.badgesCategoryHeader}>
                  <Text style={styles.badgesCategoryEmoji}>{catInfo.emoji}</Text>
                  <Text style={styles.badgesCategoryTitle}>{catInfo.title}</Text>
                  <Text style={styles.badgesCategoryCount}>{catEarned}/{list.length}</Text>
                </View>
                <View style={styles.badgesGrid}>
                  {list.map(b => {
                    const tier = TIER_COLORS[b.tier] || TIER_COLORS.bronze;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.badgeCard,
                          b.earned
                            ? { backgroundColor: tier.bg, borderColor: tier.border }
                            : styles.badgeCardLocked,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => openBadge(b)}
                      >
                        <Text style={[styles.badgeCardIcon, !b.earned && { opacity: 0.4 }]}>
                          {b.earned ? b.icon : '🔒'}
                        </Text>
                        <Text
                          style={[styles.badgeCardName, !b.earned && { color: colors.textMuted }]}
                          numberOfLines={2}
                        >
                          {b.name}
                        </Text>
                        {b.earned && (
                          <View style={[styles.badgeCardTierDot, { backgroundColor: tier.border }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Badge Detail Modal */}
      <Modal visible={!!selectedBadge} transparent animationType="none" onRequestClose={closeBadge}>
        <TouchableOpacity style={styles.badgeModalOverlay} activeOpacity={1} onPress={closeBadge}>
          <Animated.View
            style={[
              styles.badgeModalCard,
              { transform: [{ scale: modalScale }], opacity: modalScale },
            ]}
          >
            {selectedBadge && (() => {
              const tier = TIER_COLORS[selectedBadge.tier] || TIER_COLORS.bronze;
              return (
                <TouchableOpacity activeOpacity={1}>
                  <View style={[styles.badgeModalIconCircle, { backgroundColor: tier.bg, borderColor: tier.border }]}>
                    <Text style={styles.badgeModalIconText}>
                      {selectedBadge.earned ? selectedBadge.icon : '🔒'}
                    </Text>
                  </View>
                  <Text style={styles.badgeModalName}>{selectedBadge.name}</Text>
                  <View style={[styles.badgeModalTierBadge, { backgroundColor: tier.border + '20' }]}>
                    <Text style={[styles.badgeModalTierText, { color: tier.border }]}>{tier.label}</Text>
                  </View>
                  <Text style={styles.badgeModalDesc}>"{selectedBadge.description}"</Text>
                  {selectedBadge.earned ? (
                    <View style={styles.badgeModalEarnedRow}>
                      <Text style={{ fontSize: 16 }}>✅</Text>
                      <Text style={styles.badgeModalEarnedText}>
                        Earned {selectedBadge.earned_at
                          ? new Date(selectedBadge.earned_at).toLocaleDateString()
                          : ''}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.badgeModalRequirementBox}>
                      <Text style={styles.badgeModalRequirementLabel}>How to earn</Text>
                      <Text style={styles.badgeModalRequirementText}>
                        {selectedBadge.requirement || 'Keep going to unlock this badge!'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })()}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  profileButtonEmoji: {
    fontSize: 22,
  },
  tipsDot: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileButtonImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 4,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chartSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: spacing.md,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressBarLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  progressBarValue: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  achievementCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementItem: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  achievementEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  achievementValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  achievementLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Badges Section
  badgesSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.small,
  },
  badgesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgesSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badgesSectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  badgesProgressContainer: {
    marginBottom: spacing.md,
  },
  badgesProgressTrack: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgesProgressFill: {
    height: '100%',
    backgroundColor: '#5F8C87',
    borderRadius: 4,
  },
  badgesTierRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  badgesTierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgesTierDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  badgesTierText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  badgesCategoryBlock: {
    marginBottom: spacing.md,
  },
  badgesCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgesCategoryEmoji: {
    fontSize: 16,
    marginRight: 5,
  },
  badgesCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  badgesCategoryCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    width: (width - spacing.lg * 4 - spacing.sm * 2) / 3,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCardLocked: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.cardBorder,
    opacity: 0.5,
  },
  badgeCardIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeCardName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 13,
  },
  badgeCardTierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  // Badge Detail Modal
  badgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeModalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: width * 0.78,
    alignItems: 'center',
    ...shadows.large,
  },
  badgeModalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeModalIconText: {
    fontSize: 40,
  },
  badgeModalName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  badgeModalTierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  badgeModalTierText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeModalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  badgeModalEarnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeModalEarnedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  badgeModalLockedText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  badgeModalRequirementBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    width: '100%',
    alignItems: 'center',
  },
  badgeModalRequirementLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  badgeModalRequirementText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
