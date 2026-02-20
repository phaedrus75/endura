import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing } from '../theme/colors';
import { tipsAPI, StudyTip } from '../services/api';
import { animalImages, ANIMAL_NAMES_IN_ORDER } from '../assets/animals';

const ANIMAL_COLORS: Record<string, { bg: string; accent: string }> = {
  'Sunda Island Tiger': { bg: '#FFF3E6', accent: '#D4883E' },
  'Javan Rhino': { bg: '#E8EDE9', accent: '#6B8F71' },
  'Amur Leopard': { bg: '#FFF8E7', accent: '#C9A84C' },
  'Mountain Gorilla': { bg: '#EAEDF0', accent: '#5A6B7A' },
  'Tapanuli Orangutan': { bg: '#FDEEE4', accent: '#C47B4E' },
  'Polar Bear': { bg: '#EAF2F8', accent: '#7AACCC' },
  'African Forest Elephant': { bg: '#EDEEEA', accent: '#7C8F86' },
  'Hawksbill Turtle': { bg: '#E7F0ED', accent: '#5F8C87' },
  'Calamian Deer': { bg: '#F0ECE6', accent: '#9B8565' },
  'Axolotl': { bg: '#F5E8F0', accent: '#B07AA3' },
  'Red Wolf': { bg: '#F0E8E4', accent: '#A0705C' },
  'Monarch Butterfly': { bg: '#FFF0E6', accent: '#D47F3E' },
  'Red Panda': { bg: '#F5E8E4', accent: '#C47B5E' },
  'Panda': { bg: '#EBF0EB', accent: '#5E7F6E' },
  'Mexican Bobcat': { bg: '#EDE8E4', accent: '#8A7560' },
  'Chinchilla': { bg: '#EDECF0', accent: '#7B7A99' },
  'Otter': { bg: '#E6EFF5', accent: '#5A8EA8' },
  'Koala': { bg: '#EDEEEA', accent: '#7C8F86' },
  'Langur Monkey': { bg: '#EDE9E4', accent: '#8B7A60' },
  'Pacific Pocket Mouse': { bg: '#F0ECE8', accent: '#A89070' },
  'Wallaby': { bg: '#EDE6E0', accent: '#A07850' },
  'Avahi': { bg: '#EAEAE6', accent: '#7A7A6A' },
  'Blue Whale': { bg: '#E4EBF4', accent: '#4A7AA0' },
  'Gray Bat': { bg: '#E8E6EA', accent: '#6A6080' },
  'Grey Parrot': { bg: '#E8EEEA', accent: '#5A8A6A' },
  'Grizzly Bear': { bg: '#EDE8E4', accent: '#7A6050' },
  'Mountain Zebra': { bg: '#EAEAEA', accent: '#5A5A6A' },
  'Pangolin': { bg: '#EDE9E4', accent: '#8A7A60' },
  'Seal': { bg: '#E4ECF0', accent: '#5A7A8A' },
  'Wombat': { bg: '#EBE8E4', accent: '#7A6A5A' },
};

type Tab = 'feed' | 'saved';

const UpArrow = ({ active }: { active: boolean }) => (
  <View style={[styles.arrowWrap, active && styles.arrowWrapActiveUp]}>
    <Text style={[styles.arrowIcon, active && styles.arrowIconActiveUp]}>▲</Text>
  </View>
);

const DownArrow = ({ active }: { active: boolean }) => (
  <View style={[styles.arrowWrap, active && styles.arrowWrapActiveDown]}>
    <Text style={[styles.arrowIcon, active && styles.arrowIconActiveDown]}>▼</Text>
  </View>
);

const TipCard = React.memo(({
  item,
  onToggleSave,
  onVote,
  isSaved,
}: {
  item: StudyTip;
  onToggleSave: (id: number) => void;
  onVote: (id: number, vote: 'up' | 'down') => void;
  isSaved: boolean;
}) => {
  const fallbackAnimal = ANIMAL_NAMES_IN_ORDER[item.id % ANIMAL_NAMES_IN_ORDER.length];
  const animalName = item.animal_name || fallbackAnimal;
  const animalColor = ANIMAL_COLORS[animalName] || { bg: '#E7EFEA', accent: '#5F8C87' };
  const animalImg = animalImages[animalName] || null;
  const saveScale = useRef(new Animated.Value(1)).current;
  const upScale = useRef(new Animated.Value(1)).current;
  const downScale = useRef(new Animated.Value(1)).current;

  const bounceAnim = (anim: Animated.Value, cb: () => void) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.3, duration: 90, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    cb();
  };

  return (
    <View style={styles.cardContainer}>
      {/* Animal avatar */}
      <View style={[styles.avatarWrap, { backgroundColor: animalColor.bg }]}>
        {animalImg ? (
          <Image source={animalImg} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarFallback}>🐾</Text>
        )}
      </View>

      {/* Speech bubble */}
      <View style={styles.bubbleWrap}>
        <View style={[styles.bubbleTriangle, { borderRightColor: animalColor.bg }]} />

        <View style={[styles.bubble, { backgroundColor: animalColor.bg }]}>
          {/* Animal name */}
          <Text style={[styles.animalName, { color: animalColor.accent }]}>{animalName}</Text>

          {/* Tip text */}
          <Text style={styles.tipText}>{item.content}</Text>

          {/* Actions row */}
          <View style={styles.actionsRow}>
            {/* Upvote */}
            <Animated.View style={{ transform: [{ scale: upScale }] }}>
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => bounceAnim(upScale, () => onVote(item.id, 'up'))}
                activeOpacity={0.7}
              >
                <UpArrow active={item.user_liked} />
                <Text style={[
                  styles.voteBtnCount,
                  item.user_liked && styles.voteCountActiveUp,
                ]}>
                  {item.likes_count || 0}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Downvote */}
            <Animated.View style={{ transform: [{ scale: downScale }] }}>
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => bounceAnim(downScale, () => onVote(item.id, 'down'))}
                activeOpacity={0.7}
              >
                <DownArrow active={item.user_disliked} />
                <Text style={[
                  styles.voteBtnCount,
                  item.user_disliked && styles.voteCountActiveDown,
                ]}>
                  {item.dislikes_count || 0}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={{ flex: 1 }} />

            {/* Save */}
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <TouchableOpacity
                style={[styles.saveBtn, isSaved && styles.saveBtnActive]}
                onPress={() => bounceAnim(saveScale, () => onToggleSave(item.id))}
                activeOpacity={0.7}
              >
                <Text style={styles.saveIcon}>{isSaved ? '♥' : '♡'}</Text>
                <Text style={[
                  styles.saveBtnText,
                  isSaved && styles.saveBtnTextActive,
                ]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const flatListRef = useRef<FlatList>(null);
  const seenTipIdsRef = useRef<Set<number>>(new Set());

  const savedCount = Object.values(savedIds).filter(Boolean).length;

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
      } catch {
        console.log('Failed to load saved/seen tips');
      }
    };
    load();
  }, []);

  const persistSaved = async (map: Record<number, boolean>) => {
    await AsyncStorage.setItem('savedTipIds', JSON.stringify(Object.keys(map).filter(k => map[Number(k)]).map(Number)));
  };

  const persistSeen = async (ids: Set<number>) => {
    await AsyncStorage.setItem('seenTipIds', JSON.stringify([...ids]));
  };

  const loadTips = useCallback(async () => {
    try {
      const tipsData = await tipsAPI.getTips(100);
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

  useFocusEffect(useCallback(() => { loadTips(); }, [loadTips]));

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

  const handleVote = useCallback(async (tipId: number, vote: 'up' | 'down') => {
    try {
      const result = await tipsAPI.voteTip(tipId, vote);
      setTips(prev => prev.map(t =>
        t.id === tipId ? {
          ...t,
          likes_count: result.likes_count,
          dislikes_count: result.dislikes_count,
          user_liked: result.user_liked,
          user_disliked: result.user_disliked,
        } : t
      ));
    } catch (error) {
      console.error('Vote failed:', error);
    }
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    viewableItems.forEach((item: any) => {
      if (item.item?.id) markAsSeen(item.item.id);
    });
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const savedTips = tips.filter((t) => savedIds[t.id]);

  const renderFeedItem = useCallback(({ item }: { item: StudyTip }) => (
    <TipCard
      item={item}
      isSaved={!!savedIds[item.id]}
      onToggleSave={toggleSave}
      onVote={handleVote}
    />
  ), [savedIds, toggleSave, handleVote]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Study Tips</Text>
            <Text style={styles.headerSub}>Wisdom from our animal friends</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
            For You
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
            Saved{savedCount > 0 ? ` (${savedCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {activeTab === 'feed' && (
        <FlatList
          key="feed-list"
          ref={flatListRef}
          data={tips}
          extraData={savedIds}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌿</Text>
              <Text style={styles.emptyTitle}>No tips yet</Text>
              <Text style={styles.emptyText}>Pull down to refresh!</Text>
            </View>
          }
        />
      )}

      {/* Saved */}
      {activeTab === 'saved' && (
        <ScrollView
          style={styles.savedScroll}
          contentContainerStyle={styles.savedScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {savedTips.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>♡</Text>
              <Text style={styles.emptyTitle}>No saved tips yet</Text>
              <Text style={styles.emptyText}>Tap "Save" on any tip to keep it here for later.</Text>
            </View>
          ) : (
            savedTips.map((tip) => (
              <TipCard
                key={tip.id}
                item={tip}
                isSaved={true}
                onToggleSave={toggleSave}
                onVote={handleVote}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E7EFEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 14,
    padding: 3,
    backgroundColor: '#E7EFEA',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#5F8C87',
    borderRadius: 12,
    ...shadows.small,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
    paddingTop: 4,
  },
  savedScroll: {
    flex: 1,
  },
  savedScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
    paddingTop: 4,
  },

  cardContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingRight: 4,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    overflow: 'hidden',
    ...shadows.small,
  },
  avatarImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  avatarFallback: {
    fontSize: 22,
  },
  bubbleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 4,
  },
  bubbleTriangle: {
    width: 0,
    height: 0,
    marginTop: 14,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  bubble: {
    flex: 1,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 14,
    ...shadows.small,
  },
  animalName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2C3E3A',
    fontWeight: '500',
    marginBottom: 12,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  arrowWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowWrapActiveUp: {
    backgroundColor: '#D6E9E0',
  },
  arrowWrapActiveDown: {
    backgroundColor: '#F0DDD6',
  },
  arrowIcon: {
    fontSize: 10,
    color: '#8A9A92',
  },
  arrowIconActiveUp: {
    color: '#3D7A5F',
  },
  arrowIconActiveDown: {
    color: '#A0705C',
  },
  voteBtnCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A9A92',
    minWidth: 14,
  },
  voteCountActiveUp: {
    color: '#3D7A5F',
    fontWeight: '700',
  },
  voteCountActiveDown: {
    color: '#A0705C',
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    gap: 4,
  },
  saveBtnActive: {
    backgroundColor: '#D6E9E0',
  },
  saveIcon: {
    fontSize: 15,
    color: '#8A9A92',
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A9A92',
  },
  saveBtnTextActive: {
    color: '#3D7A5F',
    fontWeight: '700',
  },

  emptyState: {
    paddingVertical: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
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
});
