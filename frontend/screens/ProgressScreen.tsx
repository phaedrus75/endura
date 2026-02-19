import React, { useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Svg, { Rect, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { statsAPI, tasksAPI, badgesAPI, UserStats, Task, BadgeResponse } from '../services/api';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - spacing.lg * 2;

const SUBJECT_COLORS = [
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF5722', // Deep Orange
  '#607D8B', // Blue Grey
];

const LABEL_PAD = 20;

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
                fontSize={10}
                fontWeight="bold"
                textAnchor="middle"
              >
                {item.value}m
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
};

const SubjectBarChart = ({ data, height = 150 }: { data: { label: string; value: number; color: string }[]; height?: number }) => {
  const filtered = data.filter(d => d.value > 0);
  if (filtered.length === 0) {
    return (
      <View style={{ height: 80, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>No data yet</Text>
      </View>
    );
  }

  const maxVal = Math.max(...filtered.map(d => d.value), 1);
  const barWidth = Math.min(
    (CHART_WIDTH - 60) / filtered.length - 10,
    50,
  );
  const drawH = height - LABEL_PAD;

  return (
    <Svg width={CHART_WIDTH} height={height + 40}>
      <Defs>
        <LinearGradient id="subjColGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.primary} />
          <Stop offset="100%" stopColor={colors.primaryLight} />
        </LinearGradient>
      </Defs>
      {filtered.map((item, index) => {
        const barHeight = (item.value / maxVal) * drawH;
        const totalW = filtered.length * (barWidth + 10) - 10;
        const startX = (CHART_WIDTH - totalW) / 2;
        const x = startX + index * (barWidth + 10);
        const y = LABEL_PAD + drawH - barHeight;

        return (
          <G key={index}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight || 2}
              fill={item.color}
              rx={4}
            />
            <SvgText
              x={x + barWidth / 2}
              y={height + 16}
              fill={colors.textSecondary}
              fontSize={9}
              textAnchor="middle"
            >
              {item.label.length > 8 ? item.label.slice(0, 7) + '…' : item.label}
            </SvgText>
            {item.value > 0 && (
              <SvgText
                x={x + barWidth / 2}
                y={y - 5}
                fill={colors.textPrimary}
                fontSize={10}
                fontWeight="bold"
                textAnchor="middle"
              >
                {item.value}m
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
};

// Progress Bar Component
const ProgressBar = ({ value, maxValue, label, color }: { value: number; maxValue: number; label: string; color: string }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <Text style={styles.progressBarLabel}>{label}</Text>
        <Text style={styles.progressBarValue}>{value} / {maxValue}</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default function ProgressScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subjectStudyTime, setSubjectStudyTime] = useState<{ [key: string]: number }>({});
  const [loadError, setLoadError] = useState(false);
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeResponse | null>(null);
  const modalScale = useRef(new Animated.Value(0)).current;

  const loadData = async () => {
    try {
      setLoadError(false);
      const [statsData, tasksData, badgesData] = await Promise.all([
        statsAPI.getStats(),
        tasksAPI.getTasks(true),
        badgesAPI.getBadges().catch(() => []),
      ]);
      console.log('Stats loaded:', JSON.stringify(statsData));
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
    bronze:  { bg: '#FDF0E6', border: '#D4A574', label: 'Bronze' },
    silver:  { bg: '#F0F3F8', border: '#A8B5C8', label: 'Silver' },
    gold:    { bg: '#FFF8E7', border: '#D4A84B', label: 'Gold' },
    diamond: { bg: '#F0F0FF', border: '#9B8FD4', label: 'Diamond' },
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
  const subjectChartData = Object.entries(subjectStudyTime).map(([subject, minutes], index) => ({
    label: subject,
    value: minutes,
    color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
  }));

  return (
    <SafeAreaView style={styles.container}>
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
            <Text style={styles.subtitle}>Track your study journey 📈</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileButtonEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        {loadError && (
          <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 12, marginBottom: spacing.md }}>
            <Text style={{ color: '#E65100', fontSize: 13, textAlign: 'center' }}>
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
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📅 This Week's Study</Text>
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

        {/* Subject Distribution Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📚 Study Time by Subject</Text>
          <SubjectBarChart data={subjectChartData} />
          <Text style={styles.chartSubtext}>Minutes studied per subject</Text>
        </View>

        {/* Progress Bars */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>🎯 Goals Progress</Text>
          <ProgressBar 
            value={stats?.current_streak || 0} 
            maxValue={Math.max(stats?.longest_streak || 7, 7)} 
            label="🔥 Streak Goal" 
            color={colors.streakActive}
          />
          <ProgressBar 
            value={stats?.animals_hatched || 0} 
            maxValue={21} 
            label="🦁 Animal Collection" 
            color={colors.epic}
          />
          <ProgressBar 
            value={Math.floor((stats?.total_study_minutes || 0) / 60)} 
            maxValue={100} 
            label="⏱️ Study Hours" 
            color={colors.primary}
          />
          <ProgressBar 
            value={stats?.total_coins || 0} 
            maxValue={5000} 
            label="🍀 Eco-Credits Earned" 
            color={colors.rare}
          />
          <ProgressBar 
            value={stats?.tasks_completed || 0} 
            maxValue={100} 
            label="✅ Tasks Completed" 
            color="#4CAF50"
          />
        </View>

        {/* Achievement Summary */}
        <View style={styles.achievementCard}>
          <Text style={styles.achievementTitle}>🏆 Achievements</Text>
          <View style={styles.achievementGrid}>
            <View style={styles.achievementItem}>
              <Text style={styles.achievementEmoji}>📖</Text>
              <Text style={styles.achievementValue}>{stats?.total_sessions || 0}</Text>
              <Text style={styles.achievementLabel}>Study Sessions</Text>
            </View>
            <View style={styles.achievementItem}>
              <Text style={styles.achievementEmoji}>🦁</Text>
              <Text style={styles.achievementValue}>{stats?.animals_hatched || 0}</Text>
              <Text style={styles.achievementLabel}>Animals Hatched</Text>
            </View>
            <View style={styles.achievementItem}>
              <Text style={styles.achievementEmoji}>✅</Text>
              <Text style={styles.achievementValue}>{stats?.tasks_completed || 0}</Text>
              <Text style={styles.achievementLabel}>Tasks Done</Text>
            </View>
            <View style={styles.achievementItem}>
              <Text style={styles.achievementEmoji}>⭐</Text>
              <Text style={styles.achievementValue}>{stats?.longest_streak || 0}</Text>
              <Text style={styles.achievementLabel}>Best Streak</Text>
            </View>
          </View>
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
                    <Text style={styles.badgeModalLockedText}>Keep going to unlock this badge!</Text>
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
    marginBottom: spacing.lg,
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
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
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
    backgroundColor: '#E8B86D',
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
});
