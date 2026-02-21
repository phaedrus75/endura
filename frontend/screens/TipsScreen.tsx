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
  Dimensions,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing } from '../theme/colors';
import { tipsAPI, socialAPI, groupsAPI, StudyTip, Friend, StudyGroup } from '../services/api';
import { animalImages, ANIMAL_NAMES_IN_ORDER } from '../assets/animals';
import { Analytics } from '../services/analytics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const CARD_HEIGHT = SCREEN_HEIGHT - 220;

const TipCard = React.memo(({
  item,
  onToggleSave,
  onVote,
  onSendToFriend,
  isSaved,
}: {
  item: StudyTip;
  onToggleSave: (id: number) => void;
  onVote: (id: number, vote: 'up' | 'down') => void;
  onSendToFriend: (tip: StudyTip) => void;
  isSaved: boolean;
}) => {
  const sendScale = useRef(new Animated.Value(1)).current;
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

  const netVotes = (item.likes_count || 0) - (item.dislikes_count || 0);

  return (
    <View style={styles.cardContainer}>
      <View style={[styles.cardInner, { backgroundColor: animalColor.bg }]}>
        {/* Speech bubble */}
        <View style={styles.speechArea}>
          <View style={styles.speechBubble}>
            <Text style={styles.tipText}>{item.content}</Text>

            {/* Actions inside bubble */}
            <View style={styles.actionsRow}>
              <Animated.View style={{ transform: [{ scale: upScale }] }}>
                <TouchableOpacity
                  style={[styles.voteBtn, item.user_liked && styles.voteBtnActiveUp]}
                  onPress={() => bounceAnim(upScale, () => onVote(item.id, 'up'))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.voteArrow, item.user_liked && styles.voteArrowActiveUp]}>▲</Text>
                </TouchableOpacity>
              </Animated.View>

              <Text style={[
                styles.voteCount,
                netVotes > 0 && styles.voteCountPositive,
                netVotes < 0 && styles.voteCountNegative,
              ]}>
                {netVotes > 0 ? `+${netVotes}` : netVotes}
              </Text>

              <Animated.View style={{ transform: [{ scale: downScale }] }}>
                <TouchableOpacity
                  style={[styles.voteBtn, item.user_disliked && styles.voteBtnActiveDown]}
                  onPress={() => bounceAnim(downScale, () => onVote(item.id, 'down'))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.voteArrow, item.user_disliked && styles.voteArrowActiveDown]}>▼</Text>
                </TouchableOpacity>
              </Animated.View>

              <View style={{ flex: 1 }} />

              <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => bounceAnim(sendScale, () => onSendToFriend(item))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sendIcon}>↗</Text>
                  <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                <TouchableOpacity
                  style={[styles.saveBtn, isSaved && styles.saveBtnActive]}
                  onPress={() => bounceAnim(saveScale, () => onToggleSave(item.id))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.saveIcon, isSaved && styles.saveIconActive]}>{isSaved ? '♥' : '♡'}</Text>
                  <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextActive]}>
                    {isSaved ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
          {/* Speech bubble tail */}
          <View style={styles.speechTailWrap}>
            <View style={styles.speechTail} />
          </View>
        </View>

        {/* Animal area */}
        <View style={styles.animalArea}>
          <View style={[styles.animalImageWrap, { backgroundColor: animalColor.accent + '12' }]}>
            {animalImg ? (
              <Image source={animalImg} style={styles.animalImage} />
            ) : (
              <Text style={styles.animalFallback}>🐾</Text>
            )}
          </View>
          <View style={styles.animalInfo}>
            <Text style={[styles.animalName, { color: animalColor.accent }]}>{animalName}</Text>
            <Text style={[styles.animalSays, { color: animalColor.accent + '90' }]}>says...</Text>
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

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingTip, setSendingTip] = useState<StudyTip | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});

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
      Analytics.tipViewed(tipId);
    }
  }, []);

  const toggleSave = useCallback((tipId: number) => {
    setSavedIds((prev) => {
      const updated = { ...prev };
      if (updated[tipId]) {
        delete updated[tipId];
      } else {
        updated[tipId] = true;
        Analytics.tipSaved(tipId);
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

  const openSendModal = useCallback((tip: StudyTip) => {
    setSendingTip(tip);
    setSentTo({});
    Promise.all([
      socialAPI.getFriends(),
      groupsAPI.getAll(),
    ]).then(([f, g]) => {
      setFriends(f);
      setGroups(g);
    }).catch(() => {});
    setShowSendModal(true);
  }, []);

  const handleSendToGroup = useCallback(async (groupId: number, groupName: string) => {
    if (!sendingTip) return;
    const key = `group-${groupId}`;
    try {
      const animalName = sendingTip.animal_name || ANIMAL_NAMES_IN_ORDER[sendingTip.id % ANIMAL_NAMES_IN_ORDER.length];
      await groupsAPI.sendMessage(groupId, `📚 Study tip from ${animalName}:\n\n"${sendingTip.content}"`);
      Analytics.tipSent(sendingTip.id, 'group');
      setSentTo(prev => ({ ...prev, [key]: true }));
    } catch {
      Alert.alert('Oops', `Couldn't send to ${groupName}`);
    }
  }, [sendingTip]);

  const handleSendToFriend = useCallback(async (friendId: number, friendName: string) => {
    if (!sendingTip) return;
    const key = `friend-${friendId}`;
    try {
      const animalName = sendingTip.animal_name || ANIMAL_NAMES_IN_ORDER[sendingTip.id % ANIMAL_NAMES_IN_ORDER.length];
      await tipsAPI.sendToFriend(friendId, sendingTip.content, animalName);
      Analytics.tipSent(sendingTip.id, 'friend');
      setSentTo(prev => ({ ...prev, [key]: true }));
    } catch {
      Alert.alert('Oops', `Couldn't send to ${friendName}`);
    }
  }, [sendingTip]);

  const handleShareExternal = useCallback(async () => {
    if (!sendingTip) return;
    const animalName = sendingTip.animal_name || ANIMAL_NAMES_IN_ORDER[sendingTip.id % ANIMAL_NAMES_IN_ORDER.length];
    try {
      await Share.share({
        message: `📚 Study tip from ${animalName}:\n\n"${sendingTip.content}"\n\n— Endura 🌿`,
      });
    } catch {}
  }, [sendingTip]);

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
      onSendToFriend={openSendModal}
    />
  ), [savedIds, toggleSave, handleVote, openSendModal]);

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

      {/* Tip counter */}
      {activeTab === 'feed' && tips.length > 0 && (
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>Scroll to browse tips</Text>
          <Text style={styles.counterNum}>{tips.length} tips</Text>
        </View>
      )}

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
          snapToInterval={CARD_HEIGHT + 16}
          decelerationRate="fast"
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
        <FlatList
          key="saved-list"
          data={savedTips}
          extraData={savedIds}
          renderItem={({ item }: { item: StudyTip }) => (
            <TipCard item={item} isSaved={true} onToggleSave={toggleSave} onVote={handleVote} onSendToFriend={openSendModal} />
          )}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_HEIGHT + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>♡</Text>
              <Text style={styles.emptyTitle}>No saved tips yet</Text>
              <Text style={styles.emptyText}>Tap "Save" on any tip to keep it here for later.</Text>
            </View>
          }
        />
      )}

      {/* Send to Friend Modal */}
      <Modal visible={showSendModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send tip to...</Text>
              <TouchableOpacity onPress={() => setShowSendModal(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {sendingTip && (
              <View style={styles.tipPreview}>
                <Text style={styles.tipPreviewText} numberOfLines={2}>"{sendingTip.content}"</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Friends */}
              {friends.length > 0 && (
                <View style={styles.sendSection}>
                  <Text style={styles.sendSectionTitle}>Friends</Text>
                  {friends.map(f => {
                    const key = `friend-${f.id}`;
                    const sent = sentTo[key];
                    const name = f.username || f.email?.split('@')[0] || 'Friend';
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={styles.sendRow}
                        onPress={() => !sent && handleSendToFriend(f.id, name)}
                        activeOpacity={sent ? 1 : 0.7}
                      >
                        <View style={[styles.sendAvatar, { backgroundColor: '#5F8C87' + '18' }]}>
                          <Text style={styles.sendAvatarText}>{name[0].toUpperCase()}</Text>
                        </View>
                        <Text style={styles.sendName} numberOfLines={1}>{name}</Text>
                        {sent ? (
                          <View style={styles.sentBadge}>
                            <Text style={styles.sentBadgeText}>Sent ✓</Text>
                          </View>
                        ) : (
                          <LinearGradient
                            colors={['#5F8C87', '#3B5466']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.sendActionBtn}
                          >
                            <Text style={styles.sendActionText}>Send</Text>
                          </LinearGradient>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Study groups */}
              {groups.length > 0 && (
                <View style={styles.sendSection}>
                  <Text style={styles.sendSectionTitle}>Study Groups</Text>
                  {groups.map(g => {
                    const key = `group-${g.id}`;
                    const sent = sentTo[key];
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={styles.sendRow}
                        onPress={() => !sent && handleSendToGroup(g.id, g.name)}
                        activeOpacity={sent ? 1 : 0.7}
                      >
                        <View style={styles.sendAvatar}>
                          <Text style={styles.sendAvatarText}>👥</Text>
                        </View>
                        <Text style={styles.sendName} numberOfLines={1}>{g.name}</Text>
                        {sent ? (
                          <View style={styles.sentBadge}>
                            <Text style={styles.sentBadgeText}>Sent ✓</Text>
                          </View>
                        ) : (
                          <LinearGradient
                            colors={['#5F8C87', '#3B5466']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.sendActionBtn}
                          >
                            <Text style={styles.sendActionText}>Send</Text>
                          </LinearGradient>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Share externally */}
              <View style={styles.sendSection}>
                <Text style={styles.sendSectionTitle}>Other</Text>
                <TouchableOpacity style={styles.sendRow} onPress={handleShareExternal} activeOpacity={0.7}>
                  <View style={[styles.sendAvatar, { backgroundColor: '#E7EFEA' }]}>
                    <Text style={styles.sendAvatarText}>↗</Text>
                  </View>
                  <Text style={styles.sendName}>Share via...</Text>
                  <LinearGradient
                    colors={['#A8C8D8', '#5F8C87']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sendActionBtn}
                  >
                    <Text style={styles.sendActionText}>Share</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 8,
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
    marginBottom: 6,
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

  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg + 4,
    marginBottom: 4,
  },
  counterText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  counterNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F8C87',
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
    paddingTop: 4,
  },

  cardContainer: {
    height: CARD_HEIGHT + 16,
    paddingBottom: 56,
    justifyContent: 'center',
  },
  cardInner: {
    borderRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 24,
    ...shadows.medium,
  },

  speechArea: {
  },
  speechBubble: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    ...shadows.small,
  },
  speechTailWrap: {
    paddingLeft: 50,
  },
  speechTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.85)',
  },
  tipText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#2C3E3A',
    fontWeight: '500',
    marginBottom: 16,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },

  animalArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    gap: 14,
  },
  animalImageWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalImage: {
    width: 95,
    height: 95,
    resizeMode: 'contain',
  },
  animalFallback: {
    fontSize: 50,
  },
  animalInfo: {
    flex: 1,
  },
  animalName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  animalSays: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 2,
  },

  voteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteBtnActiveUp: {
    backgroundColor: '#D6E9E0',
  },
  voteBtnActiveDown: {
    backgroundColor: '#F0DDD6',
  },
  voteArrow: {
    fontSize: 14,
    color: '#8A9A92',
  },
  voteArrowActiveUp: {
    color: '#3D7A5F',
  },
  voteArrowActiveDown: {
    color: '#A0705C',
  },
  voteCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8A9A92',
    minWidth: 24,
    textAlign: 'center',
  },
  voteCountPositive: {
    color: '#3D7A5F',
  },
  voteCountNegative: {
    color: '#A0705C',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    gap: 5,
  },
  saveBtnActive: {
    backgroundColor: '#D6E9E0',
  },
  saveIcon: {
    fontSize: 16,
    color: '#8A9A92',
  },
  saveIconActive: {
    color: '#E25B5B',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A9A92',
  },
  saveBtnTextActive: {
    color: '#3D7A5F',
    fontWeight: '700',
  },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    gap: 5,
  },
  sendIcon: {
    fontSize: 15,
    color: '#5F8C87',
    fontWeight: '700',
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5F8C87',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F4F7F5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E7EFEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#5A6B7A',
    fontWeight: '600',
  },
  tipPreview: {
    backgroundColor: '#E7EFEA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  tipPreviewText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#2C3E3A',
    lineHeight: 20,
  },
  sendSection: {
    marginBottom: 16,
  },
  sendSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  sendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5F8C87' + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendAvatarText: {
    fontSize: 18,
  },
  sendName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sendActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  sendActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sentBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#D6E9E0',
  },
  sentBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3D7A5F',
  },

  emptyState: {
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
