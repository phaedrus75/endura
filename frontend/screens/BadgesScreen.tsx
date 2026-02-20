import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { badgesAPI, BadgeResponse } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BADGE_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3;

const TIER_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  bronze: { bg: '#E7EFEA', border: '#8B7D6B', label: 'Bronze' },
  silver: { bg: '#E7EFEA', border: '#A9BDAF', label: 'Silver' },
  gold:   { bg: '#A8C8D830', border: '#5F8C87', label: 'Gold' },
  diamond:{ bg: '#3B546620', border: '#2F4A3E', label: 'Diamond' },
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

interface BadgeCardProps {
  badge: BadgeResponse;
  onPress: () => void;
}

const BadgeCard = ({ badge, onPress }: BadgeCardProps) => {
  const tier = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;
  return (
    <TouchableOpacity
      style={[
        styles.badgeCard,
        badge.earned
          ? { backgroundColor: tier.bg, borderColor: tier.border }
          : styles.badgeCardLocked,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={[styles.badgeIcon, !badge.earned && styles.badgeIconLocked]}>
        {badge.earned ? badge.icon : '🔒'}
      </Text>
      <Text
        style={[styles.badgeName, !badge.earned && styles.badgeNameLocked]}
        numberOfLines={2}
      >
        {badge.name}
      </Text>
      {badge.earned && (
        <View style={[styles.tierDot, { backgroundColor: tier.border }]} />
      )}
    </TouchableOpacity>
  );
};

export default function BadgesScreen() {
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeResponse | null>(null);
  const modalScale = useRef(new Animated.Value(0)).current;

  const loadBadges = useCallback(async () => {
    try {
      const data = await badgesAPI.getBadges();
      setBadges(data);
    } catch (e) {
      console.warn('Failed to load badges:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBadges();
    }, [loadBadges])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await badgesAPI.checkBadges();
    } catch {}
    await loadBadges();
    setRefreshing(false);
  }, [loadBadges]);

  const openBadge = (badge: BadgeResponse) => {
    setSelectedBadge(badge);
    modalScale.setValue(0);
    Animated.spring(modalScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
  };

  const closeBadge = () => {
    Animated.timing(modalScale, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setSelectedBadge(null));
  };

  const earnedCount = badges.filter(b => b.earned).length;
  const grouped: Record<string, BadgeResponse[]> = {};
  badges.forEach(b => {
    if (!grouped[b.category]) grouped[b.category] = [];
    grouped[b.category].push(b);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Badges</Text>
        <Text style={styles.headerSubtitle}>
          {earnedCount} / {badges.length} earned
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: badges.length > 0 ? `${(earnedCount / badges.length) * 100}%` : '0%' },
            ]}
          />
        </View>
        <View style={styles.tierSummary}>
          {['bronze', 'silver', 'gold', 'diamond'].map(tier => {
            const t = TIER_COLORS[tier];
            const count = badges.filter(b => b.tier === tier && b.earned).length;
            const total = badges.filter(b => b.tier === tier).length;
            return (
              <View key={tier} style={styles.tierPill}>
                <View style={[styles.tierPillDot, { backgroundColor: t.border }]} />
                <Text style={styles.tierPillText}>{count}/{total}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat];
          if (!list || list.length === 0) return null;
          const catInfo = CATEGORY_LABELS[cat] || { title: cat, emoji: '' };
          const catEarned = list.filter(b => b.earned).length;
          return (
            <View key={cat} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryEmoji}>{catInfo.emoji}</Text>
                <Text style={styles.categoryTitle}>{catInfo.title}</Text>
                <Text style={styles.categoryCount}>{catEarned}/{list.length}</Text>
              </View>
              <View style={styles.badgeGrid}>
                {list.map(b => (
                  <BadgeCard key={b.id} badge={b} onPress={() => openBadge(b)} />
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Badge Detail Modal */}
      <Modal visible={!!selectedBadge} transparent animationType="none" onRequestClose={closeBadge}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeBadge}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                transform: [{ scale: modalScale }],
                opacity: modalScale,
              },
            ]}
          >
            {selectedBadge && (() => {
              const tier = TIER_COLORS[selectedBadge.tier] || TIER_COLORS.bronze;
              return (
                <TouchableOpacity activeOpacity={1}>
                  <View style={[styles.modalIconCircle, { backgroundColor: tier.bg, borderColor: tier.border }]}>
                    <Text style={styles.modalIcon}>
                      {selectedBadge.earned ? selectedBadge.icon : '🔒'}
                    </Text>
                  </View>
                  <Text style={styles.modalName}>{selectedBadge.name}</Text>
                  <View style={[styles.modalTierBadge, { backgroundColor: tier.border + '20' }]}>
                    <Text style={[styles.modalTierText, { color: tier.border }]}>{tier.label}</Text>
                  </View>
                  <Text style={styles.modalDesc}>"{selectedBadge.description}"</Text>
                  {selectedBadge.earned ? (
                    <View style={styles.modalEarnedRow}>
                      <Text style={styles.modalEarnedIcon}>✅</Text>
                      <Text style={styles.modalEarnedText}>
                        Earned {selectedBadge.earned_at
                          ? new Date(selectedBadge.earned_at).toLocaleDateString()
                          : ''}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.modalLockedText}>Keep going to unlock this badge!</Text>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  tierSummary: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    ...shadows.small,
  },
  tierPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  tierPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  categoryBlock: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    width: BADGE_SIZE,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  badgeCardLocked: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.cardBorder,
    opacity: 0.55,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  badgeIconLocked: {
    opacity: 0.4,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: SCREEN_WIDTH * 0.78,
    alignItems: 'center',
    ...shadows.large,
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIcon: {
    fontSize: 40,
  },
  modalName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalTierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  modalTierText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalEarnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalEarnedIcon: {
    fontSize: 16,
  },
  modalEarnedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  modalLockedText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
