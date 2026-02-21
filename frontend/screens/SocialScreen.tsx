import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  groupsAPI, feedAPI, socialAPI, tipsAPI,
  StudyGroup, GroupMessage, FeedEvent,
  Friend, StudyTip,
} from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = ['Buddies', 'Groups', 'Feed'] as const;
type Tab = typeof TABS[number];

const REACTIONS = [
  { key: 'nice', label: 'Nice!', emoji: '👏' },
  { key: 'keep_going', label: 'Keep going!', emoji: '💪' },
  { key: 'fire', label: 'Fire!', emoji: '🔥' },
  { key: 'wow', label: 'Wow!', emoji: '🤩' },
  { key: 'heart', label: 'Love!', emoji: '❤️' },
];

const REACTION_MESSAGES: Record<string, string[]> = {
  nice: ['thinks you did great!', 'is cheering you on!', 'clapped for you!'],
  keep_going: ['believes in you!', 'is rooting for you!', 'says keep pushing!'],
  fire: ['thinks you\'re on fire!', 'is impressed!', 'says you\'re crushing it!'],
  wow: ['is amazed by you!', 'can\'t believe it!', 'is blown away!'],
  heart: ['sent you love!', 'loves what you did!', 'is sending good vibes!'],
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const EVENT_ICONS: Record<string, string> = {
  session_complete: '📚',
  animal_hatched: '🐣',
  streak_milestone: '🔥',
  badge_earned: '🏅',
  pact_created: '🤝',
  group_created: '👥',
  group_goal_met: '🎉',
};

interface IncomingReaction {
  id: number;
  sender_username: string;
  reaction: string;
  event_description: string;
}

export default function SocialScreen() {
  const { user, profilePic } = useAuth();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('Buddies');
  const [refreshing, setRefreshing] = useState(false);

  // Groups
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupGoal, setGroupGoal] = useState('500');
  const [selectedGroupFriends, setSelectedGroupFriends] = useState<Set<number>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<number | null>(null);
  const [showTipsPicker, setShowTipsPicker] = useState(false);
  const [savedTips, setSavedTips] = useState<StudyTip[]>([]);
  const [showChatActions, setShowChatActions] = useState(false);

  // Feature modals (challenge, leaderboard, streak, hatch)
  const [featureModal, setFeatureModal] = useState<{ type: 'challenge' | 'leaderboard' | 'streak' | 'hatch'; group: StudyGroup } | null>(null);

  // Feed
  const [feed, setFeed] = useState<FeedEvent[]>([]);

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: number; user_id: number; username: string | null; email: string }[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendHandle, setAddFriendHandle] = useState('');

  // Reaction notification
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [incomingReactions, setIncomingReactions] = useState<IncomingReaction[]>([]);
  const reactionScale = useRef(new Animated.Value(0)).current;
  const reactionOpacity = useRef(new Animated.Value(0)).current;
  const emojiFloat = useRef(new Animated.Value(0)).current;

  const reactionMsgIdx = useRef(0);
  const showReactionPopup = (reactions: IncomingReaction[]) => {
    reactionMsgIdx.current = Math.floor(Math.random() * 3);
    setIncomingReactions(reactions);
    setShowReactionModal(true);
    reactionScale.setValue(0);
    reactionOpacity.setValue(0);
    emojiFloat.setValue(0);
    Animated.parallel([
      Animated.spring(reactionScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(reactionOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(emojiFloat, { toValue: -8, duration: 1200, useNativeDriver: true }),
          Animated.timing(emojiFloat, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    });
  };

  const dismissReactionModal = () => {
    Animated.parallel([
      Animated.timing(reactionScale, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(reactionOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setShowReactionModal(false);
      setIncomingReactions([]);
    });
  };

  const showReactionPopupRef = useRef(showReactionPopup);
  showReactionPopupRef.current = showReactionPopup;

  const checkNewReactions = useCallback(async () => {
    try {
      const newReactions = await feedAPI.getNewReactions();
      if (newReactions && newReactions.length > 0) {
        showReactionPopupRef.current(newReactions);
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkNewReactions();
      const interval = setInterval(checkNewReactions, 30000);
      return () => clearInterval(interval);
    }, [checkNewReactions])
  );

  const loadData = useCallback(async () => {
    try {
      const [g, f, fr, pr] = await Promise.all([
        groupsAPI.getAll().catch(() => []),
        feedAPI.getFeed().catch(() => []),
        socialAPI.getFriends().catch(() => []),
        socialAPI.getPendingRequests().catch(() => []),
      ]);
      setGroups(g);
      setFeed(f);
      setFriends(fr);
      setPendingRequests(pr);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleQuickAdd = async (username: string) => {
    try {
      await socialAPI.sendFriendRequest(username);
      Alert.alert('Request Sent!', `Friend request sent to @${username}`);
      loadData();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : String(e || 'Could not send request');
      Alert.alert('Error', msg);
    }
  };

  const handleAddFriend = async () => {
    if (!addFriendHandle.trim()) return;
    try {
      await socialAPI.sendFriendRequest(addFriendHandle.trim());
      setShowAddFriend(false);
      setAddFriendHandle('');
      Alert.alert('Request Sent!', 'Your friend will see the request when they open the app.');
      loadData();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : String(e || 'Could not send request');
      Alert.alert('Error', msg);
    }
  };

  const handleAcceptFriend = async (requestId: number) => {
    try {
      await socialAPI.acceptFriendRequest(requestId);
      Alert.alert('Accepted!', 'You are now friends.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not accept request');
    }
  };

  // ---- Group Actions ----
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const result = await groupsAPI.create(groupName.trim(), parseInt(groupGoal) || 500);
      const invited: string[] = [];
      for (const friendId of selectedGroupFriends) {
        const friend = friends.find(f => f.id === friendId);
        if (friend) {
          try {
            await groupsAPI.invite(result.id, friend.username
              ? { username: friend.username }
              : { user_id: friend.id }
            );
            invited.push(friend.username || friend.email?.split('@')[0] || 'friend');
          } catch {}
        }
      }
      setShowCreateGroup(false);
      setGroupName(''); setGroupGoal('500'); setSelectedGroupFriends(new Set());
      const msg = invited.length > 0
        ? `Group created and ${invited.join(', ')} ${invited.length === 1 ? 'has' : 'have'} been added!`
        : 'Group created! Add friends from the group card.';
      Alert.alert('Group Created!', msg);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create group');
    }
  };

  const handleInviteFriend = async (groupId: number, friend: Friend) => {
    try {
      await groupsAPI.invite(groupId, friend.username
        ? { username: friend.username }
        : { user_id: friend.id }
      );
      const name = friend.username || friend.email?.split('@')[0] || 'Friend';
      Alert.alert('Added!', `${name} has been added to the group.`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add friend');
    }
  };

  const toggleGroupFriend = (friendId: number) => {
    setSelectedGroupFriends(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const openGroupChat = async (group: StudyGroup) => {
    setSelectedGroup(group);
    setShowChatActions(false);
    try {
      const msgs = await groupsAPI.getMessages(group.id);
      setMessages(msgs);
    } catch { setMessages([]); }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedGroup) return;
    try {
      await groupsAPI.sendMessage(selectedGroup.id, chatInput.trim());
      setChatInput('');
      const msgs = await groupsAPI.getMessages(selectedGroup.id);
      setMessages(msgs);
    } catch {}
  };

  const loadSavedTips = async () => {
    try {
      const raw = await AsyncStorage.getItem(`savedTipIds_${user?.id || 'anon'}`);
      if (raw) {
        const ids: number[] = JSON.parse(raw);
        if (ids.length > 0) {
          const allTips = await tipsAPI.getTips(100);
          setSavedTips(allTips.filter(t => ids.includes(t.id)));
        }
      }
    } catch {}
  };

  const sendTipToChat = async (tip: StudyTip) => {
    if (!selectedGroup) return;
    const content = `📚 [TIP] ${tip.content}`;
    try {
      await groupsAPI.sendMessage(selectedGroup.id, content);
      setShowTipsPicker(false);
      const msgs = await groupsAPI.getMessages(selectedGroup.id);
      setMessages(msgs);
    } catch {}
  };

  const sendHatchInvite = async () => {
    if (!selectedGroup) return;
    const content = `🥚 [HATCH_INVITE] wants to hatch an animal together! Tap to accept the challenge — study together to hatch a shared egg! 🐣`;
    try {
      await groupsAPI.sendMessage(selectedGroup.id, content);
      setShowChatActions(false);
      const msgs = await groupsAPI.getMessages(selectedGroup.id);
      setMessages(msgs);
    } catch {}
  };

  const acceptHatchInvite = async (senderName: string) => {
    if (!selectedGroup) return;
    const content = `🐣 [HATCH_ACCEPT] accepted the hatch challenge from ${senderName}! Let's study and hatch this egg together! 🎉`;
    try {
      await groupsAPI.sendMessage(selectedGroup.id, content);
      const msgs = await groupsAPI.getMessages(selectedGroup.id);
      setMessages(msgs);
    } catch {}
  };

  const isTipMessage = (content: string) => content.startsWith('📚 [TIP] ');
  const isHatchInvite = (content: string) => content.startsWith('🥚 [HATCH_INVITE]');
  const isHatchAccept = (content: string) => content.startsWith('🐣 [HATCH_ACCEPT]');
  const isSpecialMessage = (content: string) => isTipMessage(content) || isHatchInvite(content) || isHatchAccept(content);

  // ---- Feed Actions ----
  const handleReact = async (eventId: number, reaction: string) => {
    try {
      await feedAPI.react(eventId, reaction);
      loadData();
    } catch {}
  };

  // ---- Render ----
  const renderBuddies = () => (
    <View style={styles.tabContent}>
      {/* Leaderboard */}
      {friends.length > 0 && (
        <View style={styles.leaderboardCard}>
          <Text style={styles.leaderboardTitle}>📊 Weekly Leaderboard</Text>
          {[...friends, ...(user ? [{
            id: user.id, username: user.username, email: user.email,
            total_study_minutes: user.total_study_minutes, current_streak: user.current_streak, animals_count: 0
          }] : [])]
            .sort((a, b) => b.total_study_minutes - a.total_study_minutes)
            .slice(0, 10)
            .map((f, i) => (
              <View key={f.id} style={styles.leaderboardRow}>
                <Text style={styles.leaderboardRank}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </Text>
                {f.id === user?.id && profilePic ? (
                  <Image source={{ uri: profilePic }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 6 }} />
                ) : null}
                <Text style={[styles.leaderboardName, f.id === user?.id && styles.leaderboardNameSelf]}>
                  {f.username || f.email?.split('@')[0]}
                </Text>
                <Text style={styles.leaderboardStreak}>🔥 {f.current_streak}</Text>
                <Text style={styles.leaderboardMins}>{f.total_study_minutes}m</Text>
              </View>
            ))}
        </View>
      )}

      {friends.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>Add friends to see who's studying the most!</Text>
        </View>
      )}
    </View>
  );

  const renderGroups = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity onPress={() => setShowCreateGroup(true)}>
        <LinearGradient
          colors={['#5F8C87', '#3B5466']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createButton}
        >
          <Text style={styles.createButtonIcon}>👥</Text>
          <Text style={styles.createButtonText}>Create Study Group</Text>
        </LinearGradient>
      </TouchableOpacity>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>Create a study group to collaborate with friends!</Text>
        </View>
      ) : groups.map(g => {
        const progress = g.goal_minutes > 0 ? Math.min((g.total_minutes / g.goal_minutes) * 100, 100) : 0;
        const memberIds = new Set(g.members.map(m => m.user_id));
        const invitableFriends = friends.filter(f => !memberIds.has(f.id));
        return (
          <View key={g.id} style={styles.groupCard}>
            <TouchableOpacity onPress={() => openGroupChat(g)} activeOpacity={0.7}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{g.name}</Text>
                {g.goal_met && <Text style={styles.goalMetBadge}>🎉 Goal Met!</Text>}
              </View>
              <View style={styles.groupProgressBar}>
                <LinearGradient
                  colors={['#A8C8D8', '#5F8C87']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.groupProgressFill, { width: `${Math.max(progress, 2)}%` }]}
                />
              </View>
              <Text style={styles.groupProgressText}>
                {g.total_minutes} / {g.goal_minutes} min
              </Text>
              <View style={styles.groupMembersRow}>
                {g.members.slice(0, 5).map(m => {
                  const isMe = m.user_id === user?.id;
                  const displayName = m.username || '?';
                  return (
                    <View key={m.user_id} style={styles.memberChip}>
                      {isMe && profilePic ? (
                        <Image source={{ uri: profilePic }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarFallback}>
                          <Text style={styles.memberAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.memberChipText}>{displayName}</Text>
                      <Text style={styles.memberChipMins}>{m.minutes_contributed}m</Text>
                    </View>
                  );
                })}
                {g.members.length > 5 && (
                  <Text style={styles.memberMore}>+{g.members.length - 5}</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.groupActionsGrid}>
              <View style={styles.groupActionsTopRow}>
                <TouchableOpacity
                  style={styles.groupActionBtnClean}
                  onPress={() => openGroupChat(g)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupActionEmoji}>💬</Text>
                  <Text style={styles.groupActionText}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.groupActionBtnClean}
                  onPress={() => { setInviteGroupId(g.id); setShowInviteModal(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupActionEmoji}>➕</Text>
                  <Text style={styles.groupActionText}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.groupActionBtnClean}
                  onPress={() => setFeatureModal({ type: 'challenge', group: g })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupActionEmoji}>🎯</Text>
                  <Text style={styles.groupActionText}>Challenge</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.groupActionsBottomRow}>
                <TouchableOpacity
                  style={styles.groupActionBtnClean}
                  onPress={() => setFeatureModal({ type: 'leaderboard', group: g })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupActionEmoji}>📊</Text>
                  <Text style={styles.groupActionText}>Leaderboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.groupActionBtnClean}
                  onPress={() => setFeatureModal({ type: 'streak', group: g })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupActionEmoji}>🏆</Text>
                  <Text style={styles.groupActionText}>Streak</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.groupActionBtnHighlight}
                  onPress={() => setFeatureModal({ type: 'hatch', group: g })}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#A8C8D8', '#5F8C87']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.groupActionBtnGradient}
                  >
                    <Text style={styles.groupActionEmoji}>🥚</Text>
                    <Text style={styles.groupActionTextWhite}>Hatch</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderFeed = () => (
    <View style={styles.tabContent}>
      {/* Activity Feed */}
      <Text style={styles.feedSectionTitle}>📣 Friend Activity</Text>
      {feed.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📣</Text>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySubtitle}>Add friends to see their activity here!</Text>
        </View>
      ) : feed.map(e => (
        <View key={e.id} style={styles.feedCard}>
          <View style={styles.feedCardHeader}>
            <Text style={styles.feedEventIcon}>{EVENT_ICONS[e.event_type] || '📌'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedCardText}>
                <Text style={styles.feedUsername}>{e.username || 'Someone'}</Text>{' '}
                {e.description}
              </Text>
              <Text style={styles.feedTime}>{timeAgo(e.created_at)}</Text>
            </View>
          </View>
          <View style={styles.reactionRow}>
            {REACTIONS.map(r => {
              const count = e.reactions.filter(rx => rx.reaction === r.key).length;
              const myReaction = e.reactions.find(rx => rx.user_id === user?.id && rx.reaction === r.key);
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.reactionButton, myReaction && styles.reactionButtonActive]}
                  onPress={() => handleReact(e.id, r.key)}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Friends</Text>
          <Text style={styles.headerSubtitle}>{friends.length} friends</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => setShowAddFriend(true)}>
            <LinearGradient
              colors={['#5F8C87', '#3B5466']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addFriendButton}
            >
              <Text style={styles.addFriendButtonText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => navigation.navigate('Tips')}
          >
            <Text style={{ fontSize: 18 }}>💡</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}
            onPress={() => navigation.navigate('Profile')}
          >
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={{ width: 38, height: 38, borderRadius: 19 }} />
            ) : (
              <Text style={{ fontSize: 18 }}>👤</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <LinearGradient
          colors={['#FFFFFF', '#E7EFEA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.pendingSection}
        >
          <Text style={styles.pendingTitle}>Friend Requests ({pendingRequests.length})</Text>
          {pendingRequests.map(req => (
            <View key={req.id} style={styles.pendingRow}>
              <Text style={styles.pendingName}>{req.username || req.email.split('@')[0]}</Text>
              <TouchableOpacity style={styles.pendingAcceptBtn} onPress={() => handleAcceptFriend(req.id)}>
                <Text style={styles.pendingAcceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          ))}
        </LinearGradient>
      )}

      {/* Friends */}
      {friends.length > 0 && (
        <LinearGradient
          colors={['#E7EFEA', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.allUsersSection}
        >
          <Text style={styles.allUsersTitle}>👥 Friends ({friends.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allUsersRow}>
            {friends.map(f => (
              <View key={f.id} style={styles.allUserChip}>
                <Text style={styles.allUserAvatar}>🧑‍🎓</Text>
                <Text style={styles.allUserName} numberOfLines={1}>@{f.username || f.email?.split('@')[0]}</Text>
                <Text style={styles.allUserStats}>{f.total_study_minutes}m · 🔥{f.current_streak}</Text>
                <View style={[styles.allUserActionBtn, styles.allUserFriendBtn]}>
                  <Text style={styles.allUserFriendText}>✓ Friends</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabButton, tab === t && styles.tabButtonActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabButtonText, tab === t && styles.tabButtonTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'Buddies' && renderBuddies()}
        {tab === 'Groups' && renderGroups()}
        {tab === 'Feed' && renderFeed()}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreateGroup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>👥 Create Study Group</Text>
              <Text style={styles.inputLabel}>Group name</Text>
              <TextInput style={styles.input} placeholder="Physics Study Group" placeholderTextColor={colors.textMuted}
                value={groupName} onChangeText={setGroupName} />
              <Text style={styles.inputLabel}>Goal (total minutes)</Text>
              <TextInput style={styles.input} value={groupGoal} onChangeText={setGroupGoal} keyboardType="number-pad"
                placeholder="500" placeholderTextColor={colors.textMuted} />

              {friends.length > 0 && (
                <>
                  <Text style={styles.inputLabel}>Add friends to group</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendSelectRow}>
                    {friends.map(f => {
                      const selected = selectedGroupFriends.has(f.id);
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[styles.friendSelectChip, selected && styles.friendSelectChipActive, { marginRight: 8 }]}
                          onPress={() => toggleGroupFriend(f.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.friendSelectAvatar}>👤</Text>
                          <Text style={[styles.friendSelectName, selected && styles.friendSelectNameActive]}>
                            {f.username || f.email?.split('@')[0]}
                          </Text>
                          {selected && <Text style={styles.friendSelectCheck}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {selectedGroupFriends.size > 0 && (
                    <Text style={styles.friendSelectCount}>
                      {selectedGroupFriends.size} friend{selectedGroupFriends.size !== 1 ? 's' : ''} selected
                    </Text>
                  )}
                </>
              )}

              <TouchableOpacity onPress={handleCreateGroup}>
                <LinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalPrimary}
                >
                  <Text style={styles.modalPrimaryText}>Create Group</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreateGroup(false); setSelectedGroupFriends(new Set()); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Group Chat Modal */}
      <Modal visible={!!selectedGroup} animationType="slide" onRequestClose={() => setSelectedGroup(null)}>
        <SafeAreaView style={styles.chatContainer} edges={['top', 'bottom']}>
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.chatBackBtn}
              onPress={() => setSelectedGroup(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.chatBackArrow}>‹</Text>
            </TouchableOpacity>
            <View style={styles.chatHeaderCenter}>
              <Text style={styles.chatTitle} numberOfLines={1}>{selectedGroup?.name}</Text>
              <Text style={styles.chatSubtitle}>{selectedGroup?.members.length || 0} members</Text>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            data={messages}
            keyExtractor={m => m.id.toString()}
            contentContainerStyle={styles.chatList}
            inverted={false}
            ListEmptyComponent={
              <View style={styles.chatEmpty}>
                <Text style={styles.chatEmptyEmoji}>💬</Text>
                <Text style={styles.chatEmptyTitle}>No messages yet</Text>
                <Text style={styles.chatEmptySubtitle}>Start the conversation!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMine = item.user_id === user?.id;

              if (isTipMessage(item.content)) {
                const tipText = item.content.replace('📚 [TIP] ', '');
                return (
                  <View style={[styles.chatSpecialBubble, isMine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    {!isMine && <Text style={styles.chatSpecialSender}>{item.username || 'Someone'} shared a tip</Text>}
                    {isMine && <Text style={styles.chatSpecialSenderMine}>You shared a tip</Text>}
                    <LinearGradient
                      colors={['#E7EFEA', '#FFFFFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.chatTipCard}
                    >
                      <Text style={styles.chatTipEmoji}>📚</Text>
                      <Text style={styles.chatTipText}>{tipText}</Text>
                    </LinearGradient>
                    <Text style={styles.chatSpecialTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                );
              }

              if (isHatchInvite(item.content)) {
                return (
                  <View style={[styles.chatSpecialBubble, isMine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    {!isMine && <Text style={styles.chatSpecialSender}>{item.username || 'Someone'}</Text>}
                    <LinearGradient
                      colors={['#A8C8D8', '#5F8C87']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.chatHatchCard}
                    >
                      <Text style={styles.chatHatchEmoji}>🥚</Text>
                      <Text style={styles.chatHatchTitle}>Hatch Together Invite!</Text>
                      <Text style={styles.chatHatchDesc}>Study together to hatch a shared animal egg</Text>
                      {!isMine && (
                        <TouchableOpacity
                          style={styles.chatHatchAcceptBtn}
                          onPress={() => acceptHatchInvite(item.username || 'Someone')}
                        >
                          <Text style={styles.chatHatchAcceptText}>🐣 Accept Challenge</Text>
                        </TouchableOpacity>
                      )}
                    </LinearGradient>
                    <Text style={styles.chatSpecialTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                );
              }

              if (isHatchAccept(item.content)) {
                return (
                  <View style={[styles.chatSpecialBubble, { alignSelf: 'center' }]}>
                    <View style={styles.chatHatchAcceptedBanner}>
                      <Text style={styles.chatHatchAcceptedText}>
                        🎉 {isMine ? 'You' : (item.username || 'Someone')} accepted the hatch challenge!
                      </Text>
                      <Text style={styles.chatHatchAcceptedSub}>Study together to hatch your shared egg 🐣</Text>
                    </View>
                    <Text style={[styles.chatSpecialTime, { textAlign: 'center' }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                );
              }

              return (
                <View style={[styles.chatBubbleWrap, isMine ? styles.chatBubbleWrapMine : styles.chatBubbleWrapTheirs]}>
                  {!isMine && (
                    <View style={styles.chatAvatar}>
                      <Text style={styles.chatAvatarText}>{(item.username || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[styles.chatBubble, isMine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                    {!isMine && <Text style={styles.chatBubbleSender}>{item.username || 'Someone'}</Text>}
                    <Text style={[styles.chatBubbleText, isMine && { color: '#fff' }]}>{item.content}</Text>
                    <Text style={[styles.chatBubbleTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                  {isMine && profilePic && (
                    <Image source={{ uri: profilePic }} style={styles.chatAvatarImage} />
                  )}
                </View>
              );
            }}
          />

          {/* Chat action bar */}
          {showChatActions && (
            <View style={styles.chatActionsBar}>
              <TouchableOpacity
                style={styles.chatActionItem}
                onPress={() => {
                  setShowChatActions(false);
                  loadSavedTips();
                  setShowTipsPicker(true);
                }}
              >
                <Text style={styles.chatActionEmoji}>📚</Text>
                <Text style={styles.chatActionLabel}>Share Tip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatActionItem}
                onPress={() => {
                  setShowChatActions(false);
                  sendHatchInvite();
                }}
              >
                <Text style={styles.chatActionEmoji}>🥚</Text>
                <Text style={styles.chatActionLabel}>Hatch Together</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Chat Input */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.chatInputRow}>
              <TouchableOpacity
                style={styles.chatPlusBtn}
                onPress={() => setShowChatActions(!showChatActions)}
              >
                <Text style={styles.chatPlusBtnText}>{showChatActions ? '×' : '+'}</Text>
              </TouchableOpacity>
              <View style={styles.chatInputWrap}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textMuted}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onFocus={() => setShowChatActions(false)}
                  multiline
                />
              </View>
              <TouchableOpacity
                style={[styles.chatSendButton, !chatInput.trim() && styles.chatSendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!chatInput.trim()}
              >
                <Text style={styles.chatSendText}>↑</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Tips Picker Modal */}
      <Modal visible={showTipsPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTipsPicker(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.modalContent, { maxHeight: SCREEN_WIDTH * 1.2 }]}>
              <Text style={styles.modalTitle}>📚 Share a Study Tip</Text>
              {savedTips.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
                  <Text style={styles.noFriendsText}>No saved tips yet! Save tips from the Tips tab first.</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {savedTips.map(tip => (
                    <TouchableOpacity
                      key={tip.id}
                      style={styles.tipPickerItem}
                      onPress={() => sendTipToChat(tip)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.tipPickerBadge}>
                        <Text style={styles.tipPickerBadgeText}>{tip.category}</Text>
                      </View>
                      <Text style={styles.tipPickerText} numberOfLines={3}>{tip.content}</Text>
                      <Text style={styles.tipPickerSend}>Send →</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTipsPicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Invite Friends to Group Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInviteModal(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>➕ Add Friends to Group</Text>
              {(() => {
                const group = groups.find(g => g.id === inviteGroupId);
                const memberIds = new Set(group?.members.map(m => m.user_id) || []);
                const available = friends.filter(f => !memberIds.has(f.id));
                if (available.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <Text style={styles.emptyIcon}>✅</Text>
                      <Text style={styles.noFriendsText}>All your friends are already in this group!</Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.inviteFriendList}>
                    {available.map(f => (
                      <View key={f.id} style={styles.inviteFriendRow}>
                        <View style={styles.inviteFriendInfo}>
                          <Text style={styles.inviteFriendAvatar}>👤</Text>
                          <View>
                            <Text style={styles.inviteFriendName}>{f.username || f.email?.split('@')[0]}</Text>
                            <Text style={styles.inviteFriendStats}>🔥 {f.current_streak} · {f.total_study_minutes}m studied</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.inviteFriendBtn}
                          onPress={() => {
                            if (inviteGroupId) {
                              handleInviteFriend(inviteGroupId, f);
                              setShowInviteModal(false);
                            }
                          }}
                        >
                          <Text style={styles.inviteFriendBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })()}
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.modalCancelText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={showAddFriend} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddFriend(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>👋 Add a Friend</Text>
                <Text style={styles.inputLabel}>Friend's username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. popsie"
                  placeholderTextColor={colors.textMuted}
                  value={addFriendHandle}
                  onChangeText={setAddFriendHandle}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={handleAddFriend}>
                  <LinearGradient
                    colors={['#5F8C87', '#3B5466']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalPrimary}
                  >
                    <Text style={styles.modalPrimaryText}>Send Request</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddFriend(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Feature Modal (Challenge / Leaderboard / Streak / Hatch) */}
      <Modal visible={!!featureModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.featureModalContent}>
            {featureModal?.type === 'challenge' && (
              <>
                <Text style={styles.featureModalIcon}>🎯</Text>
                <Text style={styles.featureModalTitle}>Group Challenge</Text>
                <Text style={styles.featureModalBody}>
                  Challenge your group to beat {featureModal.group.goal_minutes} minutes this week!{'\n\n'}
                  Everyone in "{featureModal.group.name}" contributes study time toward the shared goal. Keep pushing each other to reach it!
                </Text>
                <View style={styles.featureModalProgressSection}>
                  <Text style={styles.featureModalProgressLabel}>Progress</Text>
                  <View style={styles.featureModalProgressBar}>
                    <LinearGradient
                      colors={['#A8C8D8', '#5F8C87']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.featureModalProgressFill, {
                        width: `${Math.min((featureModal.group.total_minutes / featureModal.group.goal_minutes) * 100, 100)}%`
                      }]}
                    />
                  </View>
                  <Text style={styles.featureModalProgressText}>
                    {featureModal.group.total_minutes} / {featureModal.group.goal_minutes} min
                  </Text>
                </View>
              </>
            )}
            {featureModal?.type === 'leaderboard' && (() => {
              const sorted = [...featureModal.group.members].sort((a, b) => b.minutes_contributed - a.minutes_contributed);
              return (
                <>
                  <Text style={styles.featureModalIcon}>📊</Text>
                  <Text style={styles.featureModalTitle}>{featureModal.group.name} Leaderboard</Text>
                  {sorted.length === 0 ? (
                    <Text style={styles.featureModalBody}>No activity yet!</Text>
                  ) : (
                    <View style={styles.featureLeaderboardList}>
                      {sorted.map((m, i) => {
                        const isMe = m.user_id === user?.id;
                        return (
                          <View key={m.user_id} style={[styles.featureLeaderboardRow, isMe && styles.featureLeaderboardRowSelf]}>
                            <Text style={styles.featureLeaderboardRank}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                            </Text>
                            {isMe && profilePic ? (
                              <Image source={{ uri: profilePic }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                            ) : (
                              <View style={[styles.memberAvatarFallback, { width: 28, height: 28, borderRadius: 14, marginRight: 8 }]}>
                                <Text style={[styles.memberAvatarInitial, { fontSize: 13 }]}>{(m.username || '?').charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <Text style={[styles.featureLeaderboardName, isMe && { fontWeight: '700' }]}>
                              {m.username || '?'}
                            </Text>
                            <Text style={styles.featureLeaderboardMins}>{m.minutes_contributed}m</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              );
            })()}
            {featureModal?.type === 'streak' && (
              <>
                <Text style={styles.featureModalIcon}>🏆</Text>
                <Text style={styles.featureModalTitle}>Group Streak</Text>
                <Text style={styles.featureModalBody}>
                  Study together every day to build a group streak!{'\n\n'}
                  When all members in "{featureModal.group.name}" study on the same day, your group streak grows. Keep the momentum going!
                </Text>
                <View style={styles.featureStreakDisplay}>
                  <Text style={styles.featureStreakNumber}>🔥</Text>
                  <Text style={styles.featureStreakLabel}>Keep studying daily to build your streak!</Text>
                </View>
              </>
            )}
            {featureModal?.type === 'hatch' && (
              <>
                <Text style={styles.featureModalIcon}>🥚</Text>
                <Text style={styles.featureModalTitle}>Hatch Together</Text>
                <Text style={styles.featureModalBody}>
                  Start a group study session! When your group hits the study goal, everyone shares custody of a rare animal.{'\n\n'}
                  Keep studying as a group to unlock it!
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setFeatureModal(null);
                    openGroupChat(featureModal.group);
                  }}
                >
                  <LinearGradient
                    colors={['#5F8C87', '#3B5466']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.featureModalActionBtn}
                  >
                    <Text style={styles.featureModalActionText}>Start Session</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.featureModalCloseBtn}
              onPress={() => setFeatureModal(null)}
            >
              <Text style={styles.featureModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reaction Notification Modal */}
      <Modal visible={showReactionModal} transparent animationType="none">
        <TouchableOpacity
          style={styles.reactionModalOverlay}
          activeOpacity={1}
          onPress={dismissReactionModal}
        >
          <Animated.View style={[
            styles.reactionModalCard,
            {
              opacity: reactionOpacity,
              transform: [{ scale: reactionScale }],
            },
          ]}>
            <LinearGradient
              colors={['#FFFFFF', '#E7EFEA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.reactionModalGradient}
            >
              {incomingReactions.length === 1 ? (
                <>
                  <Animated.Text style={[styles.reactionModalBigEmoji, { transform: [{ translateY: emojiFloat }] }]}>
                    {REACTIONS.find(r => r.key === incomingReactions[0].reaction)?.emoji || '💫'}
                  </Animated.Text>
                  <Text style={styles.reactionModalSender}>
                    {incomingReactions[0].sender_username}
                  </Text>
                  <Text style={styles.reactionModalMessage}>
                    {REACTION_MESSAGES[incomingReactions[0].reaction]?.[
                      reactionMsgIdx.current % (REACTION_MESSAGES[incomingReactions[0].reaction]?.length || 1)
                    ] || 'reacted to your activity!'}
                  </Text>
                  <Text style={styles.reactionModalContext} numberOfLines={2}>
                    "{incomingReactions[0].event_description}"
                  </Text>
                </>
              ) : (
                <>
                  <Animated.View style={[styles.reactionModalEmojiRow, { transform: [{ translateY: emojiFloat }] }]}>
                    {[...new Set(incomingReactions.map(r => r.reaction))].map((rKey) => (
                      <Text key={rKey} style={styles.reactionModalBigEmoji}>
                        {REACTIONS.find(r => r.key === rKey)?.emoji || '💫'}
                      </Text>
                    ))}
                  </Animated.View>
                  <Text style={styles.reactionModalSender}>
                    {incomingReactions.length} new reactions!
                  </Text>
                  <View style={styles.reactionModalList}>
                    {incomingReactions.slice(0, 4).map((r) => (
                      <View key={r.id} style={styles.reactionModalListItem}>
                        <Text style={styles.reactionModalListEmoji}>
                          {REACTIONS.find(rx => rx.key === r.reaction)?.emoji || '💫'}
                        </Text>
                        <Text style={styles.reactionModalListText} numberOfLines={1}>
                          <Text style={{ fontWeight: '700' }}>{r.sender_username}</Text>
                          {' '}{REACTION_MESSAGES[r.reaction]?.[0] || 'reacted!'}
                        </Text>
                      </View>
                    ))}
                    {incomingReactions.length > 4 && (
                      <Text style={styles.reactionModalMoreText}>
                        +{incomingReactions.length - 4} more
                      </Text>
                    )}
                  </View>
                </>
              )}
              <TouchableOpacity style={styles.reactionModalDismiss} onPress={dismissReactionModal}>
                <LinearGradient
                  colors={['#A8C8D8', '#5F8C87']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.reactionModalDismissGradient}
                >
                  <Text style={styles.reactionModalDismissText}>
                    {incomingReactions.length === 1 ? '🥰 Aww, thanks!' : '🥰 So loved!'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addFriendButton: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addFriendButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  pendingSection: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: '#5F8C8740',
  },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#5F8C87', marginBottom: 8 },
  pendingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  pendingName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  pendingAcceptBtn: {
    backgroundColor: colors.tertiary, borderRadius: borderRadius.full,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  pendingAcceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  allUsersSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  allUsersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  allUsersRow: {
    gap: 10,
    paddingRight: spacing.lg,
  },
  allUserChip: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    width: 120,
    ...shadows.small,
  },
  allUserAvatar: {
    fontSize: 28,
    marginBottom: 4,
  },
  allUserName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  allUserStats: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  allUserActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  allUserAddBtn: {
    backgroundColor: colors.tertiary,
  },
  allUserAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  allUserFriendBtn: {
    backgroundColor: '#E7EFEA',
  },
  allUserFriendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F8C87',
  },
  allUserPendingBtn: {
    backgroundColor: '#A8C8D830',
  },
  allUserPendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F8C87',
  },

  tabBar: {
    flexDirection: 'row', marginHorizontal: spacing.lg,
    backgroundColor: '#A9BDAF30', borderRadius: borderRadius.full,
    padding: 3, marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1, paddingVertical: 10, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center',
  },
  tabButtonActive: { backgroundColor: '#5F8C87', ...shadows.small },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabButtonTextActive: { color: '#FFFFFF', fontWeight: '700' },

  tabContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  // Create buttons
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: 14, gap: 8, marginBottom: spacing.md, ...shadows.small,
  },
  createButtonIcon: { fontSize: 18 },
  createButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  // Pact card
  pactCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.small,
  },
  pactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pactPartner: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  statusActive: { backgroundColor: '#E7EFEA' },
  statusCompleted: { backgroundColor: '#E7EFEA' },
  statusFailed: { backgroundColor: '#3B546620' },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  pactDetails: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  pactProgressRow: { flexDirection: 'row', gap: spacing.md },
  pactProgressItem: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.md, padding: 10, alignItems: 'center' },
  pactProgressLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  pactProgressValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  acceptButton: {
    borderRadius: borderRadius.full,
    paddingVertical: 10, alignItems: 'center', marginTop: 8,
  },
  acceptButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Group card
  groupCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.small,
  },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  goalMetBadge: { fontSize: 12, fontWeight: '700', color: colors.success },
  groupProgressBar: {
    height: 8, backgroundColor: colors.cardBorder, borderRadius: 4, overflow: 'hidden', marginBottom: 6,
  },
  groupProgressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  groupProgressText: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  groupMembersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 5,
  },
  memberAvatar: {
    width: 22, height: 22, borderRadius: 11,
  },
  memberAvatarFallback: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#5F8C87', justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarInitial: {
    fontSize: 11, fontWeight: '700', color: '#FFFFFF',
  },
  memberChipText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  memberChipMins: { fontSize: 11, color: colors.textMuted },
  memberMore: { fontSize: 12, color: colors.textMuted, alignSelf: 'center' },
  groupIdText: { fontSize: 11, color: colors.textMuted },

  groupActionsGrid: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 10,
    gap: 6,
  },
  groupActionsTopRow: {
    flexDirection: 'row',
    gap: 6,
  },
  groupActionsBottomRow: {
    flexDirection: 'row',
    gap: 6,
  },
  groupActionBtnClean: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  groupActionBtnHighlight: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  groupActionBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
  },
  groupActionEmoji: { fontSize: 16 },
  groupActionText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  groupActionTextWhite: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Feature modals
  featureModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    alignItems: 'center',
    ...shadows.medium,
  },
  featureModalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  featureModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  featureModalBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  featureModalProgressSection: {
    width: '100%',
    marginBottom: 16,
  },
  featureModalProgressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  featureModalProgressBar: {
    height: 10,
    backgroundColor: colors.cardBorder,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  featureModalProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  featureModalProgressText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  featureLeaderboardList: {
    width: '100%',
    marginBottom: 16,
  },
  featureLeaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  featureLeaderboardRowSelf: {
    backgroundColor: colors.surfaceAlt,
  },
  featureLeaderboardRank: {
    fontSize: 16,
    width: 30,
    textAlign: 'center',
  },
  featureLeaderboardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  featureLeaderboardMins: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  featureStreakDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  featureStreakNumber: {
    fontSize: 48,
    marginBottom: 6,
  },
  featureStreakLabel: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  featureModalActionBtn: {
    borderRadius: borderRadius.full,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 8,
  },
  featureModalActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featureModalCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  featureModalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },

  friendSelectRow: {
    maxHeight: 56,
    marginTop: 6,
    marginBottom: 4,
  },
  friendSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  friendSelectChipActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  friendSelectAvatar: { fontSize: 16 },
  friendSelectName: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  friendSelectNameActive: { color: colors.primary, fontWeight: '700' },
  friendSelectCheck: { fontSize: 13, fontWeight: '800', color: colors.primary },
  friendSelectCount: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 4 },

  inviteFriendList: { marginTop: 8 },
  inviteFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  inviteFriendInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  inviteFriendAvatar: { fontSize: 24 },
  inviteFriendName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  inviteFriendStats: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  inviteFriendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  inviteFriendBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  reactionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionModalCard: {
    width: SCREEN_WIDTH * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.large,
  },
  reactionModalGradient: {
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  reactionModalBigEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  reactionModalEmojiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  reactionModalSender: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  reactionModalMessage: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  reactionModalContext: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 10,
  },
  reactionModalList: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  reactionModalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  reactionModalListEmoji: { fontSize: 22 },
  reactionModalListText: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  reactionModalMoreText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  reactionModalDismiss: {
    marginTop: 16,
    width: '100%',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  reactionModalDismissGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  reactionModalDismissText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Leaderboard
  leaderboardCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.small,
  },
  leaderboardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  leaderboardRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  leaderboardRank: { fontSize: 16, width: 30, textAlign: 'center' },
  leaderboardName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  leaderboardNameSelf: { color: colors.primary },
  leaderboardStreak: { fontSize: 12, color: colors.textMuted, marginRight: 10 },
  leaderboardMins: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, width: 55, textAlign: 'right' },

  // Feed
  feedSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  feedCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.small,
  },
  feedCardHeader: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  feedEventIcon: { fontSize: 22, marginTop: 2 },
  feedCardText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  feedUsername: { fontWeight: '700' },
  feedTime: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  reactionRow: { flexDirection: 'row', gap: 6 },
  reactionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
  },
  reactionButtonActive: { backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl,
    width: SCREEN_WIDTH * 0.88, ...shadows.large,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md },
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  inputRow: { flexDirection: 'row', gap: 8 },
  modalPrimary: {
    borderRadius: borderRadius.full,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
  },
  modalPrimaryText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalCancel: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  friendPickerRow: { maxHeight: 44, marginBottom: 4 },
  friendPickerChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: colors.surfaceAlt, marginRight: 8, borderWidth: 1.5, borderColor: colors.cardBorder,
  },
  friendPickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  friendPickerText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  friendPickerTextActive: { color: '#fff' },
  noFriendsText: { fontSize: 13, color: colors.textMuted, paddingVertical: 10 },

  // Chat
  chatContainer: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  chatBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E7EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatBackArrow: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: -1,
    marginLeft: -1,
  },
  chatHeaderCenter: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  chatList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  chatEmpty: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  chatEmptyEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  chatEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatEmptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  chatBubbleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  chatBubbleWrapMine: {
    justifyContent: 'flex-end',
  },
  chatBubbleWrapTheirs: {
    justifyContent: 'flex-start',
  },
  chatAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#5F8C87' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  chatAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginLeft: 8,
    marginBottom: 2,
  },
  chatAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5F8C87',
  },
  chatBubble: {
    maxWidth: '72%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chatBubbleMine: {
    backgroundColor: '#5F8C87',
    borderBottomRightRadius: 6,
  },
  chatBubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    ...shadows.small,
  },
  chatBubbleSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5F8C87',
    marginBottom: 3,
  },
  chatBubbleText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  chatBubbleTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },

  chatSpecialBubble: {
    maxWidth: '80%',
    marginBottom: 14,
  },
  chatSpecialSender: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
    marginLeft: 4,
  },
  chatSpecialSenderMine: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
    textAlign: 'right',
    marginRight: 4,
  },
  chatSpecialTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },

  chatTipCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  chatTipEmoji: {
    fontSize: 20,
    marginBottom: 6,
  },
  chatTipText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  chatHatchCard: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  chatHatchEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  chatHatchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  chatHatchDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 12,
  },
  chatHatchAcceptBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  chatHatchAcceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5F8C87',
  },
  chatHatchAcceptedBanner: {
    backgroundColor: '#5F8C87' + '12',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5F8C87' + '25',
  },
  chatHatchAcceptedText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  chatHatchAcceptedSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  chatActionsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 12,
  },
  chatActionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#E7EFEA',
    borderRadius: 14,
  },
  chatActionEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  chatActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  chatPlusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E7EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  chatPlusBtnText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#5F8C87',
    marginTop: -1,
  },
  chatInputWrap: {
    flex: 1,
    backgroundColor: '#F4F7F5',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    maxHeight: 100,
  },
  chatInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  chatSendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#5F8C87',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  chatSendButtonDisabled: {
    opacity: 0.35,
  },
  chatSendText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -1,
  },

  tipPickerItem: {
    backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder,
  },
  tipPickerBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.primary + '15',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 6,
  },
  tipPickerBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },
  tipPickerText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginBottom: 8 },
  tipPickerSend: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'right' },
});
