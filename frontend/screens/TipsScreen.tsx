import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { tipsAPI, StudyTip } from '../services/api';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.52;

const categoryEmojis: Record<string, string> = {
  focus: '🌿',
  memorization: '🦋',
  motivation: '🌻',
  general: '🍃',
};

const categoryLabels: Record<string, string> = {
  focus: 'Focus',
  memorization: 'Memory',
  motivation: 'Motivation',
  general: 'General',
};

const categoryThemes: Record<string, { bg: string; accent: string; badge: string; soft: string }> = {
  focus: { bg: '#F0F7F0', accent: '#7CB87F', badge: '#E2F0E3', soft: '#D4EDDA' },
  memorization: { bg: '#F3F0F8', accent: '#B794D4', badge: '#E8DFF0', soft: '#DDD0EB' },
  motivation: { bg: '#FDF6EE', accent: '#E8B86D', badge: '#FAE8CC', soft: '#F5DDB8' },
  general: { bg: '#EFF6F8', accent: '#6B9B9B', badge: '#D9EAEB', soft: '#C8DFE0' },
};

const decorEmojis = ['🌱', '🍀', '🌸', '🪴', '🐝', '🐞', '☁️', '✨'];

type Tab = 'feed' | 'saved';

const TipCard = React.memo(({
  item,
  index,
  total,
  isSaved,
  onToggleSave,
}: {
  item: StudyTip;
  index: number;
  total: number;
  isSaved: boolean;
  onToggleSave: (id: number) => void;
}) => {
  const theme = categoryThemes[item.category] || categoryThemes.general;
  const emoji = categoryEmojis[item.category] || '🍃';
  const label = categoryLabels[item.category] || 'General';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const cornerDecor = decorEmojis[(item.id * 3) % decorEmojis.length];
  const cornerDecor2 = decorEmojis[(item.id * 7 + 2) % decorEmojis.length];

  const animateSave = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.25, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    onToggleSave(item.id);
  };

  return (
    <View style={styles.tipCard}>
      <View style={[styles.tipCardInner, { backgroundColor: theme.bg }]}>
        <Text style={styles.decorTopRight}>{cornerDecor}</Text>
        <Text style={styles.decorBottomLeft}>{cornerDecor2}</Text>

        <View style={styles.cardHeader}>
          <View style={[styles.categoryPill, { backgroundColor: theme.badge }]}>
            <Text style={styles.categoryPillEmoji}>{emoji}</Text>
            <Text style={[styles.categoryPillText, { color: theme.accent }]}>{label}</Text>
          </View>
          <Text style={styles.tipCounter}>{index + 1} of {total}</Text>
        </View>

        <View style={styles.tipBody}>
          <View style={[styles.tipQuoteLine, { backgroundColor: theme.accent }]} />
          <Text style={styles.tipContent}>{item.content}</Text>
        </View>

        <View style={styles.tipFooter}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: isSaved ? theme.soft : '#FFFFFF' },
                isSaved && { borderColor: theme.accent, borderWidth: 1.5 },
              ]}
              onPress={animateSave}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnEmoji}>{isSaved ? '🔖' : '📌'}</Text>
              <Text style={[styles.saveBtnText, isSaved && { color: theme.accent, fontWeight: '700' as const }]}>
                {isSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.footerRight}>
            <Text style={styles.likesText}>♡ {item.likes_count}</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

export default function TipsScreen() {
  const navigation = useNavigation<any>();
  const [tips, setTips] = useState<StudyTip[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTipContent, setNewTipContent] = useState('');
  const [newTipCategory, setNewTipCategory] = useState('general');
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const flatListRef = useRef<FlatList>(null);
  const seenTipIdsRef = useRef<Set<number>>(new Set());

  const savedCount = Object.keys(savedIds).length;

  useEffect(() => {
    const load = async () => {
      try {
        const [savedRaw, seenRaw] = await Promise.all([
          AsyncStorage.getItem('savedTipIds'),
          AsyncStorage.getItem('seenTipIds'),
        ]);
        if (savedRaw) {
          const arr: number[] = JSON.parse(savedRaw);
          const map: Record<number, boolean> = {};
          arr.forEach((id) => { map[id] = true; });
          setSavedIds(map);
        }
        if (seenRaw) seenTipIdsRef.current = new Set(JSON.parse(seenRaw));
      } catch (e) {
        console.log('Failed to load saved/seen tips');
      }
    };
    load();
  }, []);

  const persistSaved = async (map: Record<number, boolean>) => {
    await AsyncStorage.setItem('savedTipIds', JSON.stringify(Object.keys(map).map(Number)));
  };

  const persistSeen = async (ids: Set<number>) => {
    await AsyncStorage.setItem('seenTipIds', JSON.stringify([...ids]));
  };

  const loadTips = useCallback(async () => {
    try {
      const tipsData = await tipsAPI.getTips(50);
      const seen = seenTipIdsRef.current;
      const sorted = [...tipsData].sort((a, b) => {
        const aS = seen.has(a.id) ? 1 : 0;
        const bS = seen.has(b.id) ? 1 : 0;
        return aS - bS;
      });
      setTips(sorted);
    } catch (error) {
      console.error('Failed to load tips:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTips();
    }, [loadTips])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadTips();
    setIsRefreshing(false);
  };

  const markAsSeen = useCallback((tipId: number) => {
    if (!seenTipIdsRef.current.has(tipId)) {
      seenTipIdsRef.current.add(tipId);
      persistSeen(seenTipIdsRef.current);
    }
  }, []);

  const toggleSave = useCallback((tipId: number) => {
    setSavedIds((prev) => {
      const updated = { ...prev };
      if (updated[tipId]) {
        delete updated[tipId];
      } else {
        updated[tipId] = true;
      }
      persistSaved(updated);
      return updated;
    });
  }, []);

  const handleCreateTip = async () => {
    if (!newTipContent.trim()) {
      Alert.alert('Error', 'Please enter a tip');
      return;
    }
    try {
      await tipsAPI.createTip(newTipContent.trim(), newTipCategory);
      setNewTipContent('');
      setShowCreateModal(false);
      await loadTips();
      Alert.alert('Success', 'Your study tip has been shared!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    viewableItems.forEach((item: any) => {
      if (item.item?.id) markAsSeen(item.item.id);
    });
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const savedTips = tips.filter((t) => savedIds[t.id]);

  const renderFeedItem = useCallback(({ item, index }: { item: StudyTip; index: number }) => (
    <TipCard item={item} index={index} total={tips.length} isSaved={!!savedIds[item.id]} onToggleSave={toggleSave} />
  ), [tips.length, savedIds, toggleSave]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Tips & Wisdom 🌱</Text>
          <Text style={styles.headerSub}>Curated study tips just for you</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.postBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.postBtnText}>+ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.profileButtonEmoji}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={styles.tabEmoji}>🌿</Text>
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>For You</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={styles.tabEmoji}>🔖</Text>
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
            Saved ({savedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <FlatList
          key="feed-list"
          ref={flatListRef}
          data={tips}
          extraData={savedIds}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id.toString()}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_HEIGHT + 20}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>Growing tips for you...</Text>
              <Text style={styles.emptyText}>Pull down to refresh and discover study wisdom!</Text>
            </View>
          }
        />
      )}

      {/* Saved tab — simple ScrollView to avoid FlatList paging crashes */}
      {activeTab === 'saved' && (
        <ScrollView
          style={styles.savedScroll}
          contentContainerStyle={styles.savedScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {savedTips.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🪴</Text>
              <Text style={styles.emptyTitle}>Your garden is empty</Text>
              <Text style={styles.emptyText}>Save tips you love and they'll bloom here for you to revisit anytime!</Text>
            </View>
          ) : (
            savedTips.map((tip, index) => (
              <TipCard
                key={tip.id}
                item={tip}
                index={index}
                total={savedTips.length}
                isSaved={true}
                onToggleSave={toggleSave}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Create Tip Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share Your Wisdom 🌸</Text>
            <Text style={styles.modalSub}>Help fellow learners with a tip from your experience</Text>

            <TextInput
              style={styles.tipInput}
              placeholder="What study tip would you share with a friend?"
              placeholderTextColor={colors.textMuted}
              value={newTipContent}
              onChangeText={setNewTipContent}
              multiline
              maxLength={300}
            />

            <Text style={styles.categoryLabel}>Choose a category</Text>
            <View style={styles.categoryOptions}>
              {Object.entries(categoryEmojis).map(([cat, emoji]) => {
                const theme = categoryThemes[cat];
                const isActive = newTipCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      { borderColor: isActive ? theme.accent : colors.cardBorder },
                      isActive && { backgroundColor: theme.badge },
                    ]}
                    onPress={() => setNewTipCategory(cat)}
                  >
                    <Text style={styles.categoryOptionEmoji}>{emoji}</Text>
                    <Text style={[styles.categoryOptionText, isActive && { color: theme.accent, fontWeight: '700' as const }]}>
                      {categoryLabels[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleCreateTip}>
              <Text style={styles.submitButtonText}>Share Tip 🌿</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelButtonText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  postBtn: {
    backgroundColor: colors.mint,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  postBtnText: {
    color: '#2D5A3D',
    fontWeight: '700',
    fontSize: 13,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  profileButtonEmoji: {
    fontSize: 18,
  },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#E8EDE9',
    borderRadius: 20,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 18,
    gap: 5,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    ...shadows.small,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  savedScroll: {
    flex: 1,
  },
  savedScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },

  tipCard: {
    height: CARD_HEIGHT + 20,
    paddingVertical: 10,
  },
  tipCardInner: {
    flex: 1,
    borderRadius: 28,
    padding: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...shadows.medium,
  },
  decorTopRight: {
    position: 'absolute',
    top: 14,
    right: 16,
    fontSize: 22,
    opacity: 0.25,
  },
  decorBottomLeft: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    fontSize: 20,
    opacity: 0.2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
  },
  categoryPillEmoji: {
    fontSize: 14,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipCounter: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },

  tipBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  tipQuoteLine: {
    width: 3,
    borderRadius: 2,
    marginRight: 14,
    marginTop: 4,
    minHeight: 40,
    alignSelf: 'stretch',
  },
  tipContent: {
    flex: 1,
    fontSize: 19,
    color: colors.textPrimary,
    lineHeight: 30,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  tipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...shadows.small,
  },
  saveBtnEmoji: {
    fontSize: 15,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likesText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },

  emptyCard: {
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FAFCFA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tipInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    lineHeight: 22,
  },
  categoryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    gap: 5,
  },
  categoryOptionEmoji: {
    fontSize: 15,
  },
  categoryOptionText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
