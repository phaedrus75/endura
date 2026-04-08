import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Image,
} from 'react-native';
import { Text, TextInput } from '../components/StyledText';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  groupsAPI, feedAPI, socialAPI, tipsAPI, subjectsAPI, moderationAPI,
  StudyGroup, GroupMessage, FeedEvent,
  Friend, FriendProfile, FriendSuggestion, StudyTip, LeaderboardEntry, Subject,
} from '../services/api';
import { getAnimalImage } from '../assets/animals';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

const TABS = ['Friends', 'Leaderboard', 'Groups', 'Feed'] as const;
type Tab = typeof TABS[number];

const REACTIONS = [
  { key: 'nice', label: 'Nice!', emoji: '👏' },
  { key: 'fire', label: 'Fire!', emoji: '🔥' },
  { key: 'heart', label: 'Love!', emoji: '❤️' },
];

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
  shared_hatch: '💚',
  streak_milestone: '🔥',
  badge_earned: '🏅',
  group_created: '👥',
  group_goal_met: '🎉',
};

const AVATAR_COLORS = [
  '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A',
  '#82E0AA', '#F8C471', '#AED6F1', '#D2B4DE', '#A3E4D7',
];

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

function getAvatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function UserAvatar({ id, username, email, profilePicUrl, size = 36 }: { id: number; username?: string; email?: string; profilePicUrl?: string | null; size?: number }) {
  if (profilePicUrl) {
    return (
      <Image
        source={{ uri: profilePicUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: getAvatarColor(id),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>
        {getInitials(username, email)}
      </Text>
    </View>
  );
}

export default function SocialScreen() {
  const { user, profilePic } = useAuth();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('Friends');
  const [refreshing, setRefreshing] = useState(false);

  // Groups
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupFriends, setSelectedGroupFriends] = useState<Set<number>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<number | null>(null);
  const [showTipsPicker, setShowTipsPicker] = useState(false);
  const [savedTips, setSavedTips] = useState<StudyTip[]>([]);
  const [showChatActions, setShowChatActions] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState<StudyGroup | null>(null);
  const [showGoalCongrats, setShowGoalCongrats] = useState<StudyGroup | null>(null);
  const [celebratedGroupIds, setCelebratedGroupIds] = useState<Set<number>>(new Set());
  const [showEditGroup, setShowEditGroup] = useState<StudyGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupSubjectId, setEditGroupSubjectId] = useState<number | null>(null);

  // Hours/minutes picker state for create & edit goal
  const [goalHoursPicker, setGoalHoursPicker] = useState(8);
  const [goalMinutesPicker, setGoalMinutesPicker] = useState(20);
  const [createSubjectId, setCreateSubjectId] = useState<number | null>(null);
  const [sharedSubjects, setSharedSubjects] = useState<Subject[]>([]);
  const [editGroupSubjects, setEditGroupSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    const fetchShared = async () => {
      const memberIds = Array.from(selectedGroupFriends);
      const allIds = user ? [user.id, ...memberIds] : memberIds;
      if (allIds.length === 0) return;
      try {
        const shared = await subjectsAPI.getShared(allIds);
        setSharedSubjects(shared);
      } catch {
        setSharedSubjects([]);
      }
    };
    fetchShared();
  }, [selectedGroupFriends, user]);

  useEffect(() => {
    if (createSubjectId && !sharedSubjects.some(s => s.id === createSubjectId)) {
      setCreateSubjectId(null);
    }
  }, [sharedSubjects]);

  // Feature modals (challenge, leaderboard, streak)
  const [featureModal, setFeatureModal] = useState<{ type: 'challenge' | 'leaderboard' | 'streak'; group: StudyGroup } | null>(null);

  // Feed
  const [feed, setFeed] = useState<FeedEvent[]>([]);

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: number; user_id: number; username: string | null; profile_pic_url: string | null }[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendHandle, setAddFriendHandle] = useState('');

  // Friend suggestions (same school)
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [sentSuggestionIds, setSentSuggestionIds] = useState<Set<number>>(new Set());

  // Friend profile modal
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [showFriendProfile, setShowFriendProfile] = useState(false);
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);
  const friendProfileScale = useRef(new Animated.Value(0)).current;

  // Leaderboards
  const [leaderboardTab, setLeaderboardTab] = useState<'all' | 'friends' | 'school'>('all');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all_time' | 'week'>('all_time');
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [schoolLeaderboard, setSchoolLeaderboard] = useState<LeaderboardEntry[]>([]);


  // Report & Block
  const handleReport = (reportedUserId: number, username: string, contentType: string, contentId?: number) => {
    Alert.alert(
      'Report Content',
      `Why are you reporting ${username || 'this user'}?`,
      [
        { text: 'Inappropriate Content', onPress: () => submitReport(reportedUserId, contentType, 'inappropriate', contentId) },
        { text: 'Spam', onPress: () => submitReport(reportedUserId, contentType, 'spam', contentId) },
        { text: 'Harassment', onPress: () => submitReport(reportedUserId, contentType, 'harassment', contentId) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reportedUserId: number, contentType: string, reason: string, contentId?: number) => {
    try {
      await moderationAPI.reportContent(reportedUserId, contentType, reason, contentId);
      Alert.alert('Report Submitted', 'Thank you. Our team will review this shortly.');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleBlock = (userId: number, username: string) => {
    Alert.alert(
      `Block ${username || 'this user'}?`,
      'They will be removed from your friends and their content will be hidden from your feed. You can unblock them later from your profile settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await moderationAPI.blockUser(userId);
              loadData();
              Alert.alert('Blocked', `${username || 'User'} has been blocked.`);
            } catch {
              Alert.alert('Error', 'Could not block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const showUserActions = (userId: number, username: string, contentType: string, contentId?: number) => {
    Alert.alert(
      username || 'User',
      'What would you like to do?',
      [
        { text: 'Report Content', onPress: () => handleReport(userId, username, contentType, contentId) },
        { text: 'Block User', style: 'destructive', onPress: () => handleBlock(userId, username) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const loadData = useCallback(async () => {
    try {
      const [g, f, fr, pr, gl, fl, sl, sg] = await Promise.all([
        groupsAPI.getAll().catch(() => []),
        feedAPI.getFeed().catch(() => []),
        socialAPI.getFriends().catch(() => []),
        socialAPI.getPendingRequests().catch(() => []),
        socialAPI.getGlobalLeaderboard(leaderboardPeriod).catch(() => []),
        socialAPI.getLeaderboard(leaderboardPeriod).catch(() => []),
        socialAPI.getSchoolLeaderboard(leaderboardPeriod).catch(() => []),
        socialAPI.getFriendSuggestions().catch(() => []),
      ]);
      const prevGroups = groups;
      setGroups(g);
      setFeed(f);
      setFriends(fr);
      setPendingRequests(pr);
      setGlobalLeaderboard(gl);
      setFriendsLeaderboard(fl);
      setSchoolLeaderboard(sl);
      setSuggestions(sg);
      const newlyCompleted = (g as StudyGroup[]).find(grp => {
        if (!grp.goal_met) return false;
        if (celebratedGroupIds.has(grp.id)) return false;
        const prev = prevGroups.find(p => p.id === grp.id);
        return prev && !prev.goal_met;
      });
      if (newlyCompleted) {
        setCelebratedGroupIds(prev => new Set([...prev, newlyCompleted.id]));
        setShowGoalCongrats(newlyCompleted);
      }
    } catch {}
  }, [leaderboardPeriod, celebratedGroupIds, groups]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const refreshLeaderboards = async () => {
      const [gl, fl, sl] = await Promise.all([
        socialAPI.getGlobalLeaderboard(leaderboardPeriod).catch(() => []),
        socialAPI.getLeaderboard(leaderboardPeriod).catch(() => []),
        socialAPI.getSchoolLeaderboard(leaderboardPeriod).catch(() => []),
      ]);
      setGlobalLeaderboard(gl);
      setFriendsLeaderboard(fl);
      setSchoolLeaderboard(sl);
    };
    refreshLeaderboards();
  }, [leaderboardPeriod]);

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

  const handleSuggestionAdd = async (suggestion: FriendSuggestion) => {
    if (!suggestion.username) return;
    try {
      await socialAPI.sendFriendRequest(suggestion.username);
      setSentSuggestionIds(prev => new Set(prev).add(suggestion.id));
      Alert.alert('Request Sent!', `Friend request sent to @${suggestion.username}`);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : String(e || 'Could not send request');
      Alert.alert('Error', msg);
    }
  };

  const openFriendProfile = async (friendId: number) => {
    setFriendProfileLoading(true);
    setShowFriendProfile(true);
    friendProfileScale.setValue(0);
    try {
      const profile = await socialAPI.getFriendProfile(friendId);
      setSelectedFriend(profile);
      Animated.spring(friendProfileScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load friend profile');
      setShowFriendProfile(false);
    } finally {
      setFriendProfileLoading(false);
    }
  };

  const closeFriendProfile = () => {
    Animated.timing(friendProfileScale, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowFriendProfile(false);
      setSelectedFriend(null);
    });
  };

  const formatFriendDate = (isoString: string | null) => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getDaysSince = (isoString: string | null) => {
    if (!isoString) return 0;
    const diff = Date.now() - new Date(isoString).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
  };

  const getFriendshipLevel = (days: number) => {
    if (days >= 365) return { title: 'Soulmates', emoji: '💎', color: '#A78BFA' };
    if (days >= 180) return { title: 'Best Friends', emoji: '🌟', color: '#F59E0B' };
    if (days >= 90) return { title: 'Close Friends', emoji: '💫', color: '#3B82F6' };
    if (days >= 30) return { title: 'Good Friends', emoji: '🤝', color: '#10B981' };
    if (days >= 7) return { title: 'New Friends', emoji: '🌱', color: '#6EE7B7' };
    return { title: 'Just Met', emoji: '👋', color: '#94A3B8' };
  };

  const handleRemoveFriend = (friendId: number, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialAPI.removeFriend(friendId);
              Alert.alert('Removed', `${friendName} has been removed from your friends.`);
              loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not remove friend');
            }
          },
        },
      ]
    );
  };

  const handleRemoveGroupMember = (groupId: number, memberId: number, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupsAPI.removeMember(groupId, memberId);
              Alert.alert('Removed', `${memberName} has been removed from the group.`);
              loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not remove member');
            }
          },
        },
      ]
    );
  };

  // ---- Group Actions ----
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (!createSubjectId) { Alert.alert('Select Subject', 'Please select a subject for the group goal.'); return; }
    const totalMins = goalHoursPicker * 60 + goalMinutesPicker;
    if (totalMins < 1) { Alert.alert('Invalid Goal', 'Please set a goal of at least 1 minute.'); return; }
    try {
      const result = await groupsAPI.create(groupName.trim(), totalMins, undefined, createSubjectId);
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
      setGroupName(''); setGoalHoursPicker(8); setGoalMinutesPicker(20); setSelectedGroupFriends(new Set()); setCreateSubject(null);
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

  const handleUpdateGoal = async () => {
    if (!showEditGoal) return;
    const groupId = showEditGoal.id;
    const mins = goalHoursPicker * 60 + goalMinutesPicker;
    if (mins < 1) { Alert.alert('Invalid', 'Please set a goal of at least 1 minute.'); return; }
    try {
      await groupsAPI.updateGoal(groupId, mins);
      setShowEditGoal(null);
      const freshGroups = await groupsAPI.getAll().catch(() => []);
      setGroups(freshGroups);
      const completed = freshGroups.find(
        (grp: StudyGroup) => grp.id === groupId && grp.goal_met
      );
      if (completed) {
        setCelebratedGroupIds(prev => new Set([...prev, completed.id]));
        setTimeout(() => setShowGoalCongrats(completed), 400);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update goal');
    }
  };

  const handleUpdateGroup = async () => {
    if (!showEditGroup) return;
    const groupId = showEditGroup.id;
    if (!editGroupName.trim()) { Alert.alert('Invalid', 'Please enter a group name.'); return; }
    try {
      await groupsAPI.updateGroup(groupId, {
        name: editGroupName.trim(),
        subject_id: editGroupSubjectId,
      });
      setShowEditGroup(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update group');
    }
  };

  const isTipMessage = (content: string) => content.startsWith('📚 [TIP] ');
  const isSpecialMessage = (content: string) => isTipMessage(content);

  // ---- Feed Actions ----
  const handleReact = async (eventId: number, reaction: string) => {
    try {
      await feedAPI.react(eventId, reaction);
      loadData();
    } catch {}
  };

  // ---- Render ----
  const renderFriendsTab = () => (
    <View style={styles.tabContent}>
      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>Add friends to study together!</Text>
        </View>
      ) : (
        friends.map(f => {
          const name = f.username || f.email?.split('@')[0] || 'Friend';
          return (
            <TouchableOpacity key={f.id} style={styles.friendListCard} activeOpacity={0.7} onPress={() => openFriendProfile(f.id)}>
              <UserAvatar id={f.id} username={f.username} email={f.email} profilePicUrl={f.profile_pic_url} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>@{name}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{formatStudyTime(f.total_study_minutes)} studied · 🔥 {f.current_streak}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveFriend(f.id, name)}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#00000008', justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, color: '#999', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  const renderLeaderboard = () => {
    const activeList = leaderboardTab === 'all' ? globalLeaderboard : leaderboardTab === 'friends' ? friendsLeaderboard : schoolLeaderboard;
    const userRank = activeList.findIndex(e => e.user_id === user?.id);

    return (
      <View style={styles.tabContent}>
        <View style={styles.leaderboardCard}>
          <Text style={styles.leaderboardTitle}>📊 Leaderboard</Text>

          <View style={styles.periodSwatch}>
            <TouchableOpacity
              style={[styles.periodSwatchBtn, leaderboardPeriod === 'all_time' && styles.periodSwatchBtnActive]}
              onPress={() => setLeaderboardPeriod('all_time')}
            >
              <Text style={[styles.periodSwatchText, leaderboardPeriod === 'all_time' && styles.periodSwatchTextActive]}>All Time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodSwatchBtn, leaderboardPeriod === 'week' && styles.periodSwatchBtnActive]}
              onPress={() => setLeaderboardPeriod('week')}
            >
              <Text style={[styles.periodSwatchText, leaderboardPeriod === 'week' && styles.periodSwatchTextActive]}>This Week</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.leaderboardSwatch}>
            <TouchableOpacity
              style={[styles.leaderboardSwatchBtn, leaderboardTab === 'all' && styles.leaderboardSwatchBtnActive]}
              onPress={() => setLeaderboardTab('all')}
            >
              <Text style={[styles.leaderboardSwatchText, leaderboardTab === 'all' && styles.leaderboardSwatchTextActive]}>All Users</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.leaderboardSwatchBtn, leaderboardTab === 'school' && styles.leaderboardSwatchBtnActive]}
              onPress={() => setLeaderboardTab('school')}
            >
              <Text style={[styles.leaderboardSwatchText, leaderboardTab === 'school' && styles.leaderboardSwatchTextActive]}>My School</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.leaderboardSwatchBtn, leaderboardTab === 'friends' && styles.leaderboardSwatchBtnActive]}
              onPress={() => setLeaderboardTab('friends')}
            >
              <Text style={[styles.leaderboardSwatchText, leaderboardTab === 'friends' && styles.leaderboardSwatchTextActive]}>Friends</Text>
            </TouchableOpacity>
          </View>

          {activeList.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>{leaderboardTab === 'friends' ? '👥' : leaderboardTab === 'school' ? '🎓' : '🌍'}</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                {leaderboardTab === 'friends'
                  ? 'Add friends to see the friends leaderboard!'
                  : leaderboardTab === 'school'
                  ? 'Set your school in Profile to see your school leaderboard!'
                  : 'Start studying to appear on the leaderboard!'}
              </Text>
            </View>
          ) : (
            <>
              {activeList.slice(0, 20).map((entry, i) => {
                const isMe = entry.user_id === user?.id;
                return (
                  <View key={entry.user_id} style={[styles.leaderboardRow, isMe && styles.leaderboardRowSelf]}>
                    <Text style={styles.leaderboardRank}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </Text>
                    <View style={{ marginRight: 6 }}>
                      <UserAvatar id={entry.user_id} username={entry.username || undefined} profilePicUrl={entry.profile_pic_url} size={24} />
                    </View>
                    <Text style={[styles.leaderboardName, isMe && styles.leaderboardNameSelf]} numberOfLines={1}>
                      {isMe ? 'You' : (entry.username || '?')}
                    </Text>
                    <Text style={styles.leaderboardStreak}>🔥 {entry.current_streak}</Text>
                    <Text style={styles.leaderboardMins}>{formatStudyTime(entry.total_study_minutes)}</Text>
                  </View>
                );
              })}

              {userRank >= 20 && (
                <View style={[styles.leaderboardRow, styles.leaderboardRowSelf, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#E7EFEA', paddingTop: 10 }]}>
                  <Text style={styles.leaderboardRank}>{userRank + 1}.</Text>
                  <View style={{ marginRight: 6 }}>
                    <UserAvatar id={user?.id || 0} username={user?.username || undefined} profilePicUrl={profilePic} size={24} />
                  </View>
                  <Text style={[styles.leaderboardName, styles.leaderboardNameSelf]} numberOfLines={1}>You</Text>
                  <Text style={styles.leaderboardStreak}>🔥 {user?.current_streak || 0}</Text>
                  <Text style={styles.leaderboardMins}>{formatStudyTime(activeList[userRank]?.total_study_minutes ?? user?.total_study_minutes ?? 0)}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderGroups = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity onPress={() => setShowCreateGroup(true)}>
        <LinearGradient
          colors={['#A9CECA', '#7DA9A4']}
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
      ) : [...groups].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(g => {
        const progress = g.goal_minutes > 0 ? Math.min((g.total_minutes / g.goal_minutes) * 100, 100) : 0;
        const goalHours = Math.floor(g.goal_minutes / 60);
        const goalMins = g.goal_minutes % 60;
        const totalHours = Math.floor(g.total_minutes / 60);
        const totalMins = g.total_minutes % 60;
        const goalLabel = goalHours > 0 ? `${goalHours}h ${goalMins}m` : `${goalMins}m`;
        const totalLabel = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;
        return (
          <View key={g.id} style={styles.groupCard}>
            <TouchableOpacity onPress={() => openGroupChat(g)} activeOpacity={0.7}>
              <View style={styles.groupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  {g.subject && <Text style={styles.groupSubjectTag}>📚 {g.subject}</Text>}
                </View>
                {g.goal_met && <Text style={styles.goalMetBadge}>Goal reached!</Text>}
                <TouchableOpacity
                  onPress={() => {
                    setShowEditGroup(g);
                    setEditGroupName(g.name);
                    setEditGroupSubjectId(g.subject_id || null);
                    const memberIds = g.members.map(m => m.user_id);
                    subjectsAPI.getShared(memberIds).then(setEditGroupSubjects).catch(() => setEditGroupSubjects([]));
                  }}
                  style={styles.groupEditBtn}
                >
                  <Text style={styles.groupEditBtnLabel}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.groupMembersRow}>
                {g.members.slice(0, 5).map(m => {
                  const isMe = m.user_id === user?.id;
                  const isAdmin = g.creator_id === user?.id;
                  const displayName = m.username || '?';
                  return (
                    <TouchableOpacity
                      key={m.user_id}
                      style={styles.memberChip}
                      activeOpacity={isAdmin && !isMe ? 0.6 : 1}
                      onLongPress={() => {
                        if (isAdmin && !isMe) {
                          handleRemoveGroupMember(g.id, m.user_id, displayName);
                        }
                      }}
                    >
                      <UserAvatar id={m.user_id} username={displayName} profilePicUrl={isMe ? profilePic : m.profile_pic_url} size={22} />
                      <Text style={styles.memberChipText}>{displayName}</Text>
                      {isAdmin && isMe && <Text style={{ fontSize: 9, color: '#5F8C87' }}>👑</Text>}
                    </TouchableOpacity>
                  );
                })}
                {g.members.length > 5 && (
                  <Text style={styles.memberMore}>+{g.members.length - 5}</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Group Goal Progress */}
            <View style={styles.goalSection}>
              <View style={styles.goalHeaderRow}>
                <Text style={styles.goalLabel}>🎯 Group Goal</Text>
              </View>
              <View style={styles.goalProgressBarOuter}>
                <LinearGradient
                  colors={g.goal_met ? ['#2E7D32', '#1B5E20'] : ['#7BB5AD', '#2D4055']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.goalProgressBarFill, { width: `${progress}%` }]}
                />
              </View>
              <View style={styles.goalStatsRow}>
                <Text style={styles.goalStatsText}>{totalLabel} / {goalLabel}</Text>
                <Text style={[styles.goalPercentText, g.goal_met && { color: '#1B5E20' }]}>{Math.round(progress)}%</Text>
              </View>
            </View>

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
                  style={styles.groupActionBtnHighlight}
                  onPress={() => { setShowEditGoal(g); setGoalHoursPicker(Math.floor(g.goal_minutes / 60)); setGoalMinutesPicker(g.goal_minutes % 60); }}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#A8C8D8', '#5F8C87']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.groupActionBtnGradient}
                  >
                    <Text style={styles.groupActionEmoji}>🎯</Text>
                    <Text style={styles.groupActionTextWhite}>Edit Goal</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderFeed = () => {
    const hatchFeed = feed.filter(e => e.event_type === 'animal_hatched');
    return (
    <View style={styles.tabContent}>
      {/* Activity Feed */}
      <Text style={styles.feedSectionTitle}>📣 Friend Activity</Text>
      {hatchFeed.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🐣</Text>
          <Text style={styles.emptyTitle}>No hatches yet</Text>
          <Text style={styles.emptySubtitle}>When your friends hatch animals, they'll appear here!</Text>
        </View>
      ) : hatchFeed.map(e => {
        const hatchMatch = e.description.match(/^just hatched a (.+?)(?:\s+called\s+.+)?!$/);
        const hatchedAnimalImage = hatchMatch ? getAnimalImage(hatchMatch[1]) : null;
        return (
        <TouchableOpacity
          key={e.id}
          style={styles.feedCard}
          activeOpacity={0.9}
          onLongPress={() => showUserActions(e.user_id, e.username || 'Someone', 'activity_event', e.id)}
        >
          <View style={styles.feedCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedCardText}>
                <Text style={styles.feedUsername}>{e.username || 'Someone'}</Text>{' '}
                {e.description}
              </Text>
              <Text style={styles.feedTime}>{timeAgo(e.created_at)}</Text>
            </View>
            {hatchedAnimalImage && (
              <Image source={hatchedAnimalImage} style={styles.feedAnimalImage} resizeMode="contain" />
            )}
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
        </TouchableOpacity>
        );
      })}
    </View>
  );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Friends</Text>
          <Text style={styles.headerSubtitle}>{friends.length} friends</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 }}>
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
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', ...shadows.small }}
            onPress={() => navigation.navigate('Profile')}
          >
            <UserAvatar id={user?.id || 0} username={user?.username} profilePicUrl={profilePic} size={44} />
          </TouchableOpacity>
        </View>
      </View>

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
        nestedScrollEnabled
      >
        {/* Pending Requests — show on Friends tab only */}
        {tab === 'Friends' && (
          <View style={styles.pendingSection}>
            <Text style={styles.pendingTitle}>
              Friend Requests {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}
            </Text>
            {pendingRequests.length === 0 ? (
              <Text style={styles.pendingEmpty}>No pending requests</Text>
            ) : (
              pendingRequests.map(req => (
                <View key={req.id} style={styles.pendingRow}>
                  <UserAvatar id={req.user_id} username={req.username || undefined} size={32} />
                  <Text style={styles.pendingName}>{req.username || 'User'}</Text>
                  <TouchableOpacity style={styles.pendingAcceptBtn} onPress={() => handleAcceptFriend(req.id)}>
                    <Text style={styles.pendingAcceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Friend Suggestions (same school) */}
            {suggestions.length > 0 && (
              <>
                <View style={styles.suggestionDivider} />
                <Text style={styles.suggestionTitle}>🎓 People from your school</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
                  {suggestions.map(s => {
                    const sent = sentSuggestionIds.has(s.id);
                    return (
                      <View key={s.id} style={styles.suggestionChip}>
                        <UserAvatar id={s.id} username={s.username} profilePicUrl={s.profile_pic_url} size={40} />
                        <Text style={styles.suggestionName} numberOfLines={1}>@{s.username}</Text>
                        <Text style={styles.suggestionStats}>{formatStudyTime(s.total_study_minutes)} · 🔥{s.current_streak}</Text>
                        <TouchableOpacity
                          style={[styles.suggestionAddBtn, sent && styles.suggestionSentBtn]}
                          onPress={() => !sent && handleSuggestionAdd(s)}
                          activeOpacity={sent ? 1 : 0.7}
                        >
                          <Text style={[styles.suggestionAddText, sent && styles.suggestionSentText]}>
                            {sent ? '✓ Sent' : '+ Add'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* Friends horizontal strip — show on Groups tab only */}
        {tab === 'Groups' && friends.length > 0 && (
          <LinearGradient
            colors={['#E7EFEA', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.allUsersSection}
          >
            <Text style={styles.allUsersTitle}>👥 Friends ({friends.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allUsersRow}>
              {friends.map(f => {
                const name = f.username || f.email?.split('@')[0] || 'Friend';
                return (
                  <TouchableOpacity key={f.id} style={styles.allUserChip} activeOpacity={0.7} onPress={() => openFriendProfile(f.id)}>
                    <TouchableOpacity
                      onPress={() => handleRemoveFriend(f.id, name)}
                      style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, width: 20, height: 20, borderRadius: 10, backgroundColor: '#00000015', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 11, color: '#999', fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                    <UserAvatar id={f.id} username={f.username} email={f.email} profilePicUrl={f.profile_pic_url} size={36} />
                    <Text style={styles.allUserName} numberOfLines={1}>@{name}</Text>
                    <Text style={styles.allUserStats}>{formatStudyTime(f.total_study_minutes)} · 🔥{f.current_streak}</Text>
                    <View style={[styles.allUserActionBtn, styles.allUserFriendBtn]}>
                      <Text style={styles.allUserFriendText}>✓ Friends</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </LinearGradient>
        )}

        {tab === 'Friends' && renderFriendsTab()}
        {tab === 'Groups' && renderGroups()}
        {tab === 'Feed' && renderFeed()}
        {tab === 'Leaderboard' && renderLeaderboard()}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreateGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCreateGroup(false); setSelectedGroupFriends(new Set()); setCreateSubject(null); }}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.modalTitle}>👥 Create Study Group</Text>
              <Text style={styles.inputLabel}>Group name</Text>
              <TextInput style={styles.input} placeholder="eg. Physics Study Group" placeholderTextColor={colors.textMuted}
                value={groupName} onChangeText={setGroupName} />

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
                          <UserAvatar id={f.id} username={f.username} email={f.email} profilePicUrl={f.profile_pic_url} size={24} />
                          <Text style={[styles.friendSelectName, selected && styles.friendSelectNameActive, { marginLeft: 4 }]}>
                            {f.username || 'Friend'}
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

              <Text style={styles.inputLabel}>Subject</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10, lineHeight: 18 }}>
                Only subjects shared by all members are shown
              </Text>
              {sharedSubjects.length > 0 ? (
                <View style={styles.subjectGrid}>
                  {sharedSubjects.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.subjectChip, createSubjectId === s.id && styles.subjectChipActive]}
                      onPress={() => setCreateSubjectId(createSubjectId === s.id ? null : s.id)}
                    >
                      <Text style={[styles.subjectChipText, createSubjectId === s.id && styles.subjectChipTextActive]}>{s.display_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10, fontStyle: 'italic', lineHeight: 18 }}>
                  No shared subjects found. Make sure every member adds subjects via the timer's subject list.
                </Text>
              )}
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 10, fontStyle: 'italic', lineHeight: 18 }}>
                Don't see your subject? Make sure every member adds it via the timer's subject list first.
              </Text>

              <Text style={styles.inputLabel}>Group goal</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Hours</Text>
                  <View style={styles.pickerWheelWrap}>
                    <Picker
                      selectedValue={goalHoursPicker}
                      onValueChange={(v) => setGoalHoursPicker(v)}
                      style={styles.pickerWheel}
                      itemStyle={styles.pickerWheelItem}
                    >
                      {Array.from({ length: 100 }, (_, i) => (
                        <Picker.Item key={i} label={String(i)} value={i} />
                      ))}
                    </Picker>
                  </View>
                </View>
                <Text style={styles.pickerSeparator}>:</Text>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Mins</Text>
                  <View style={styles.pickerWheelWrap}>
                    <Picker
                      selectedValue={goalMinutesPicker}
                      onValueChange={(v) => setGoalMinutesPicker(v)}
                      style={styles.pickerWheel}
                      itemStyle={styles.pickerWheelItem}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <Picker.Item key={i} label={String(i * 5)} value={i * 5} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
              <Text style={styles.pickerTotal}>
                Total: {goalHoursPicker * 60 + goalMinutesPicker} minutes
              </Text>

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
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreateGroup(false); setSelectedGroupFriends(new Set()); setCreateSubject(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Group Chat Modal */}
      <Modal visible={!!selectedGroup} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setSelectedGroup(null); setShowChatActions(false); }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.chatContainer} edges={['top', 'bottom', 'left', 'right']}>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderCenter}>
                <Text style={styles.chatTitle} numberOfLines={1}>{selectedGroup?.name}</Text>
                <Text style={styles.chatSubtitle}>{selectedGroup?.members.length || 0} members</Text>
              </View>
              <TouchableOpacity
                style={styles.chatCloseBtn}
                onPress={() => { setSelectedGroup(null); setShowChatActions(false); setChatInput(''); }}
              >
                <Text style={styles.chatCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

          {/* Messages */}
            <FlatList
              style={{ flex: 1, backgroundColor: '#EDF5EF' }}
              data={[...messages].reverse()}
              keyExtractor={m => m.id.toString()}
              contentContainerStyle={styles.chatList}
              inverted={true}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
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
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() => {
                        if (!isMine) showUserActions(item.user_id, item.username || 'User', 'group_message', item.id);
                      }}
                      delayLongPress={500}
                    >
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
                        <Text style={styles.chatTipText}>{decodeHtmlEntities(tipText)}</Text>
                      </LinearGradient>
                      <Text style={styles.chatSpecialTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => {
                      if (!isMine) showUserActions(item.user_id, item.username || 'User', 'group_message', item.id);
                    }}
                    delayLongPress={500}
                  >
                  <View style={[styles.chatBubbleWrap, isMine ? styles.chatBubbleWrapMine : styles.chatBubbleWrapTheirs]}>
                    {!isMine && (
                      <View style={{ marginRight: 8, marginBottom: 2 }}>
                        <UserAvatar id={item.user_id} username={item.username} profilePicUrl={item.profile_pic_url} size={28} />
                      </View>
                    )}
                    <View style={[styles.chatBubble, isMine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                      {!isMine && <Text style={styles.chatBubbleSender}>{item.username || 'Someone'}</Text>}
                      <Text style={[styles.chatBubbleText, isMine && { color: '#fff' }]}>{decodeHtmlEntities(item.content)}</Text>
                      <Text style={[styles.chatBubbleTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>{timeAgo(item.created_at)}</Text>
                    </View>
                    {isMine && (
                      <View style={{ marginLeft: 8, marginBottom: 2 }}>
                        <UserAvatar id={user?.id || 0} username={user?.username} profilePicUrl={profilePic} size={28} />
                      </View>
                    )}
                  </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Chat action bar */}
            {showChatActions && selectedGroup && (
              <View style={styles.chatActionsBar}>
                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
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
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>Members</Text>
                {selectedGroup.members.map(m => {
                  const isMe = m.user_id === user?.id;
                  const isAdmin = selectedGroup.creator_id === user?.id;
                  const displayName = m.username || '?';
                  const isCreator = m.user_id === selectedGroup.creator_id;
                  return (
                    <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                      <UserAvatar id={m.user_id} username={displayName} profilePicUrl={isMe ? profilePic : m.profile_pic_url} size={28} />
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginLeft: 8 }}>
                        {displayName}{isCreator ? ' 👑' : ''}{isMe ? ' (you)' : ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginRight: 8 }}>{m.minutes_contributed}m</Text>
                      {isAdmin && !isMe && (
                        <TouchableOpacity
                          onPress={() => handleRemoveGroupMember(selectedGroup.id, m.user_id, displayName)}
                          style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFE5E5', borderRadius: 8 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#D44' }}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Chat Input */}
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
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tips Picker Modal */}
      <Modal visible={showTipsPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTipsPicker(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <View style={{ flex: 1, padding: 20 }}>
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
        </View>
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
                          <UserAvatar id={f.id} username={f.username} email={f.email} profilePicUrl={f.profile_pic_url} size={32} />
                          <View>
                            <Text style={styles.inviteFriendName}>{f.username || f.email?.split('@')[0]}</Text>
                            <Text style={styles.inviteFriendStats}>🔥 {f.current_streak} · {formatStudyTime(f.total_study_minutes)} studied</Text>
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
                  placeholder="e.g. rhea"
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
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFeatureModal(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.featureModalContent}>
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
                            <View style={{ marginRight: 8 }}>
                              <UserAvatar id={m.user_id || i} username={m.username} profilePicUrl={isMe ? profilePic : m.profile_pic_url} size={28} />
                            </View>
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
            <TouchableOpacity
              style={styles.featureModalCloseBtn}
              onPress={() => setFeatureModal(null)}
            >
              <Text style={styles.featureModalCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Edit Goal Modal */}
      <Modal visible={!!showEditGoal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditGoal(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎯 Set Group Goal</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hours</Text>
                <View style={styles.pickerWheelWrap}>
                  <Picker
                    selectedValue={goalHoursPicker}
                    onValueChange={(v) => setGoalHoursPicker(v)}
                    style={styles.pickerWheel}
                    itemStyle={styles.pickerWheelItem}
                  >
                    {Array.from({ length: 100 }, (_, i) => (
                      <Picker.Item key={i} label={String(i)} value={i} />
                    ))}
                  </Picker>
                </View>
              </View>
              <Text style={styles.pickerSeparator}>:</Text>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Mins</Text>
                <View style={styles.pickerWheelWrap}>
                  <Picker
                    selectedValue={goalMinutesPicker}
                    onValueChange={(v) => setGoalMinutesPicker(v)}
                    style={styles.pickerWheel}
                    itemStyle={styles.pickerWheelItem}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <Picker.Item key={i} label={String(i * 5)} value={i * 5} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            <Text style={styles.pickerTotal}>
              Total: {goalHoursPicker * 60 + goalMinutesPicker} minutes
            </Text>
            <TouchableOpacity onPress={handleUpdateGoal}>
              <LinearGradient
                colors={['#5F8C87', '#3B5466']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalPrimary}
              >
                <Text style={styles.modalPrimaryText}>Save Goal</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditGoal(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Group Modal (name + subject + members) */}
      <Modal visible={!!showEditGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditGroup(null)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.modalTitle}>Edit Group</Text>
            <Text style={styles.inputLabel}>Group name</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              placeholderTextColor={colors.textMuted}
              value={editGroupName}
              onChangeText={setEditGroupName}
            />
            <Text style={styles.inputLabel}>Subject</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10, lineHeight: 18 }}>
              Only study time for this subject counts toward the goal
            </Text>
            <View style={styles.subjectGrid}>
              {editGroupSubjects.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.subjectChip, editGroupSubjectId === s.id && styles.subjectChipActive]}
                  onPress={() => setEditGroupSubjectId(editGroupSubjectId === s.id ? null : s.id)}
                >
                  <Text style={[styles.subjectChipText, editGroupSubjectId === s.id && styles.subjectChipTextActive]}>{s.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 16, fontStyle: 'italic', lineHeight: 18 }}>
              Don't see your subject? Make sure every member adds it via the timer's subject list first.
            </Text>

            {/* Members */}
            <Text style={styles.inputLabel}>Members</Text>
            {showEditGroup?.members.map(m => {
              const isMe = m.user_id === user?.id;
              const isAdmin = showEditGroup.creator_id === user?.id;
              const displayName = m.username || '?';
              return (
                <View key={m.user_id} style={styles.editMemberRow}>
                  <UserAvatar id={m.user_id} username={displayName} profilePicUrl={isMe ? profilePic : m.profile_pic_url} size={32} />
                  <Text style={styles.editMemberName}>{displayName}</Text>
                  {m.role === 'admin' && <Text style={styles.editMemberBadge}>👑</Text>}
                  {isAdmin && !isMe && (
                    <TouchableOpacity
                      style={styles.editMemberRemoveBtn}
                      onPress={() => {
                        handleRemoveGroupMember(showEditGroup.id, m.user_id, displayName);
                      }}
                    >
                      <Text style={styles.editMemberRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Add friends */}
            {(() => {
              const memberIds = new Set(showEditGroup?.members.map(m => m.user_id) || []);
              const available = friends.filter(f => !memberIds.has(f.id));
              if (available.length === 0) return null;
              return (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>Add friends</Text>
                  {available.map(f => (
                    <View key={f.id} style={styles.editMemberRow}>
                      <UserAvatar id={f.id} username={f.username} email={f.email} profilePicUrl={f.profile_pic_url} size={32} />
                      <Text style={styles.editMemberName}>{f.username || 'Friend'}</Text>
                      <TouchableOpacity
                        style={styles.editMemberAddBtn}
                        onPress={async () => {
                          if (showEditGroup) {
                            await handleInviteFriend(showEditGroup.id, f);
                            const fresh = await groupsAPI.getAll().catch(() => []);
                            setGroups(fresh);
                            const updated = fresh.find((g: StudyGroup) => g.id === showEditGroup.id);
                            if (updated) setShowEditGroup(updated);
                          }
                        }}
                      >
                        <Text style={styles.editMemberAddText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              );
            })()}

            <View style={{ marginTop: 20 }}>
              <TouchableOpacity onPress={handleUpdateGroup}>
                <LinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalPrimary}
                >
                  <Text style={styles.modalPrimaryText}>Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditGroup(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Goal Reached Congratulations Modal */}
      <Modal visible={!!showGoalCongrats} transparent animationType="fade">
        <TouchableOpacity style={styles.goalCongratsOverlay} activeOpacity={1} onPress={() => setShowGoalCongrats(null)}>
          <TouchableOpacity activeOpacity={1}>
            <LinearGradient
              colors={['#8FC4BC', '#4A6A7A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.goalCongratsCard}
            >
              <Text style={styles.goalCongratsTitle}>Congratulations! 🎉</Text>
              <Text style={styles.goalCongratsSubtitle}>Your group hit the goal!</Text>

              <View style={styles.goalCongratsMembersWrap}>
                {showGoalCongrats?.members.slice(0, 8).map((m, i) => (
                  <View key={m.user_id} style={[styles.goalCongratsMemberAvatar, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}>
                    <UserAvatar
                      id={m.user_id}
                      username={m.username || undefined}
                      profilePicUrl={m.user_id === user?.id ? profilePic : m.profile_pic_url}
                      size={48}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.goalCongratsGroupName}>{showGoalCongrats?.name}</Text>

              <Text style={styles.goalCongratsStatsMain}>
                {showGoalCongrats ? (() => {
                  const h = Math.floor(showGoalCongrats.goal_minutes / 60);
                  const m = showGoalCongrats.goal_minutes % 60;
                  const timeStr = h > 0 ? (m > 0 ? `${h} hour${h !== 1 ? 's' : ''} and ${m} minute${m !== 1 ? 's' : ''}` : `${h} hour${h !== 1 ? 's' : ''}`) : `${m} minute${m !== 1 ? 's' : ''}`;
                  const subj = showGoalCongrats.subject || 'studying';
                  return `${timeStr} of ${subj} studied together ;)`;
                })() : ''}
              </Text>

              <Text style={styles.goalCongratsMessage}>
                Amazing teamwork! Set a new goal and keep the momentum going!
              </Text>

              <View style={styles.goalCongratsButtons}>
                <TouchableOpacity
                  style={styles.goalCongratsButton}
                  onPress={() => setShowGoalCongrats(null)}
                >
                  <Text style={styles.goalCongratsButtonText}>Awesome!</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
        {showGoalCongrats && (
          <ConfettiCannon count={120} origin={{ x: SCREEN_WIDTH / 2, y: -10 }} fadeOut autoStart explosionSpeed={400} fallSpeed={2500} />
        )}
      </Modal>

      {/* Friend Profile Modal */}
      <Modal visible={showFriendProfile} transparent animationType="fade">
        <TouchableOpacity
          style={styles.fpOverlay}
          activeOpacity={1}
          onPress={closeFriendProfile}
        >
          <Animated.View style={[
            styles.fpCard,
            { transform: [{ scale: friendProfileScale }], opacity: friendProfileScale },
          ]}>
            <TouchableOpacity activeOpacity={1}>
              {friendProfileLoading || !selectedFriend ? (
                <View style={styles.fpLoading}>
                  <Text style={{ fontSize: 32 }}>✨</Text>
                  <Text style={styles.fpLoadingText}>Loading...</Text>
                </View>
              ) : (() => {
                const fp = selectedFriend;
                const name = fp.username || fp.email?.split('@')[0] || 'Friend';
                const daysFriends = getDaysSince(fp.friends_since);
                const level = getFriendshipLevel(daysFriends);
                const daysMember = getDaysSince(fp.member_since);
                const avgSessionMin = fp.total_sessions > 0
                  ? Math.round(fp.total_study_minutes / fp.total_sessions)
                  : 0;

                return (
                  <View>
                    {/* Header gradient */}
                    <LinearGradient
                      colors={[level.color + '30', '#FFFFFF00']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.fpHeader}
                    >
                      <View style={styles.fpAvatarRing}>
                        <UserAvatar id={fp.id} username={fp.username} email={fp.email} profilePicUrl={fp.profile_pic_url} size={72} />
                      </View>
                      <Text style={styles.fpName}>@{name}</Text>
                      <View style={[styles.fpLevelBadge, { backgroundColor: level.color + '20' }]}>
                        <Text style={{ fontSize: 14 }}>{level.emoji}</Text>
                        <Text style={[styles.fpLevelText, { color: level.color }]}>{level.title}</Text>
                      </View>
                      {(fp.school || fp.city || fp.country) && (
                        <View style={styles.fpInfoRow}>
                          {fp.school && (
                            <Text style={styles.fpInfoText}>🎓 {fp.school}</Text>
                          )}
                          {(fp.city || fp.country) && (
                            <Text style={styles.fpInfoText}>
                              📍 {[fp.city, fp.country].filter(Boolean).join(', ')}
                            </Text>
                          )}
                        </View>
                      )}
                    </LinearGradient>

                    {/* Friends since banner */}
                    <View style={styles.fpSinceBanner}>
                      <Text style={styles.fpSinceLabel}>Friends for</Text>
                      <Text style={styles.fpSinceValue}>
                        {daysFriends === 0 ? 'today' : daysFriends === 1 ? '1 day' : `${daysFriends} days`}
                      </Text>
                      <Text style={styles.fpSinceDate}>since {formatFriendDate(fp.friends_since)}</Text>
                    </View>

                    {/* Stats grid */}
                    <View style={styles.fpStatsGrid}>
                      <View style={styles.fpStatItem}>
                        <Text style={styles.fpStatEmoji}>📚</Text>
                        <Text style={styles.fpStatValue}>{formatStudyTime(fp.total_study_minutes)}</Text>
                        <Text style={styles.fpStatLabel}>Total Study</Text>
                      </View>
                      <View style={styles.fpStatItem}>
                        <Text style={styles.fpStatEmoji}>🔥</Text>
                        <Text style={styles.fpStatValue}>{fp.current_streak}</Text>
                        <Text style={styles.fpStatLabel}>Current Streak</Text>
                      </View>
                      <View style={styles.fpStatItem}>
                        <Text style={styles.fpStatEmoji}>⚡</Text>
                        <Text style={styles.fpStatValue}>{fp.longest_streak}</Text>
                        <Text style={styles.fpStatLabel}>Best Streak</Text>
                      </View>
                      <View style={styles.fpStatItem}>
                        <Text style={styles.fpStatEmoji}>🎯</Text>
                        <Text style={styles.fpStatValue}>{fp.total_sessions}</Text>
                        <Text style={styles.fpStatLabel}>Sessions</Text>
                      </View>
                      <View style={styles.fpStatItem}>
                        <Text style={styles.fpStatEmoji}>🐾</Text>
                        <Text style={styles.fpStatValue}>{fp.animals_count}</Text>
                        <Text style={styles.fpStatLabel}>Animals</Text>
                      </View>
                      <View style={styles.fpStatItem}>
                        <Text style={styles.fpStatEmoji}>⏱️</Text>
                        <Text style={styles.fpStatValue}>{avgSessionMin}m</Text>
                        <Text style={styles.fpStatLabel}>Avg Session</Text>
                      </View>
                    </View>

                    {/* Fun facts */}
                    <View style={styles.fpFunFacts}>
                      <View style={styles.fpFunFactRow}>
                        <Text style={styles.fpFunFactEmoji}>🗓️</Text>
                        <Text style={styles.fpFunFactText}>
                          Member for <Text style={styles.fpFunFactBold}>{daysMember}</Text> days
                        </Text>
                      </View>
                    </View>

                    {/* Report / Block */}
                    <TouchableOpacity
                      style={styles.fpReportBtn}
                      onPress={() => {
                        closeFriendProfile();
                        setTimeout(() => showUserActions(fp.id, name, 'username'), 400);
                      }}
                    >
                      <Text style={styles.fpReportText}>Report or Block</Text>
                    </TouchableOpacity>

                    {/* Close button */}
                    <TouchableOpacity style={styles.fpCloseBtn} onPress={closeFriendProfile}>
                      <LinearGradient
                        colors={['#A8C8D8', '#5F8C87']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fpCloseBtnGradient}
                      >
                        <Text style={styles.fpCloseBtnText}>Close</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addFriendButton: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 22, paddingVertical: 12,
    marginRight: 4,
  },
  addFriendButtonText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  pendingSection: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#F9FBFA',
    borderWidth: 1,
    borderColor: '#E7EFEA',
  },
  pendingTitle: { fontSize: 14, fontWeight: '700', color: '#5F8C87', marginBottom: 10 },
  pendingEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7EFEA',
    gap: 10,
  },
  pendingName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  pendingAcceptBtn: {
    backgroundColor: '#5F8C87', borderRadius: borderRadius.full,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  pendingAcceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  suggestionDivider: {
    height: 1,
    backgroundColor: '#E7EFEA',
    marginTop: 12,
    marginBottom: 10,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5F8C87',
    marginBottom: 10,
  },
  suggestionRow: {
    gap: 10,
    paddingBottom: 4,
  },
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    width: 110,
    borderWidth: 1,
    borderColor: '#E7EFEA',
  },
  suggestionName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 6,
    marginBottom: 2,
  },
  suggestionStats: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  suggestionAddBtn: {
    backgroundColor: '#5F8C87',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  suggestionAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  suggestionSentBtn: {
    backgroundColor: '#E7EFEA',
  },
  suggestionSentText: {
    color: '#5F8C87',
  },

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
    marginBottom: 6,
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
    flexDirection: 'row', marginHorizontal: spacing.md,
    backgroundColor: '#A9BDAF30', borderRadius: borderRadius.full,
    padding: 2, marginTop: spacing.xs, marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 2, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center',
  },
  tabButtonActive: { backgroundColor: '#5F8C87', ...shadows.small },
  tabButtonText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tabButtonTextActive: { color: '#FFFFFF', fontWeight: '700' },

  tabContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  friendListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    ...shadows.small,
  },

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
  goalSection: {
    backgroundColor: '#F4F9F7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  goalEditBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F8C87',
  },
  goalProgressBarOuter: {
    height: 12,
    backgroundColor: '#E2EBE7',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  goalProgressBarFill: {
    height: '100%',
    borderRadius: 6,
  } as any,
  goalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalStatsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  goalPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5F8C87',
  },
  goalCongratsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  goalCongratsCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...shadows.large,
    overflow: 'hidden',
  } as any,
  goalCongratsTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  goalCongratsSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  goalCongratsMembersWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalCongratsMemberAvatar: {
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 24,
    overflow: 'hidden',
  },
  goalCongratsGroupName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  goalCongratsStatsMain: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  goalCongratsMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  goalCongratsButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  goalCongratsButton: {
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...shadows.small,
  },
  goalCongratsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A6A7A',
  },
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

  // Leaderboard
  leaderboardCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.small,
  },
  leaderboardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  periodSwatch: {
    flexDirection: 'row',
    backgroundColor: '#E8F0ED',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  periodSwatchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodSwatchBtnActive: {
    backgroundColor: '#5F8C87',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  periodSwatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodSwatchTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  leaderboardSwatch: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F2',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  leaderboardSwatchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaderboardSwatchBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  leaderboardSwatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  leaderboardSwatchTextActive: {
    color: '#5F8C87',
    fontWeight: '700',
  },
  leaderboardRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  leaderboardRowSelf: {
    backgroundColor: '#D8EDDB',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  leaderboardRank: { fontSize: 16, width: 30, textAlign: 'center' },
  leaderboardName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  leaderboardNameSelf: { color: '#5F8C87', fontWeight: '700' },
  leaderboardStreak: { fontSize: 12, color: colors.textMuted, marginRight: 10 },
  leaderboardMins: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, width: 55, textAlign: 'right' },

  // Feed
  feedSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  feedCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.small,
  },
  feedCardHeader: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center' },
  feedEventIcon: { fontSize: 22, marginTop: 2 },
  feedAnimalImage: { width: 58, height: 58, borderRadius: 12, marginLeft: 4, top: 4 },
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
    backgroundColor: '#FFFFFF',
  },
  chatSwipeHandle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  chatSwipeBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D0D4D2',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FFFFFF',
  },
  chatBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  chatCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 12,
    backgroundColor: '#E7EFEA',
    borderRadius: 20,
  },
  chatCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5F8C87',
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    flexGrow: 1,
  },
  chatEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 8,
  },
  chatBubbleWrapMine: {
    justifyContent: 'flex-end',
  },
  chatBubbleWrapTheirs: {
    justifyContent: 'flex-start',
  },
  chatAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5F8C87' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  chatAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 8,
    marginBottom: 2,
  },
  chatAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5F8C87',
  },
  chatBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  chatBubbleMine: {
    backgroundColor: '#5F8C87',
    borderBottomRightRadius: 4,
  },
  chatBubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    ...shadows.small,
  },
  chatBubbleSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5F8C87',
    marginBottom: 2,
  },
  chatBubbleText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  chatBubbleTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
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
    paddingVertical: 10,
    paddingHorizontal: 28,
    gap: 10,
  },
  chatActionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#E7EFEA',
    borderRadius: 12,
  },
  chatActionEmoji: {
    fontSize: 20,
    marginBottom: 3,
  },
  chatActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  chatPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E7EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  chatPlusBtnText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#5F8C87',
    marginTop: -1,
  },
  chatInputWrap: {
    flex: 1,
    backgroundColor: '#F0F3F1',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    maxHeight: 100,
  },
  chatInput: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  chatSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5F8C87',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  chatSendButtonDisabled: {
    opacity: 0.3,
  },
  chatSendText: {
    fontSize: 17,
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

  // Friend Profile Modal
  fpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  fpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    ...shadows.medium,
  },
  fpLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fpLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  fpHeader: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  fpAvatarRing: {
    borderRadius: 50,
    padding: 3,
    borderWidth: 3,
    borderColor: '#5F8C8740',
    marginBottom: 12,
  },
  fpName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  fpLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  fpLevelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fpInfoRow: {
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  fpInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  fpSinceBanner: {
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8EDE9',
  },
  fpSinceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  fpSinceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 2,
  },
  fpSinceDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  fpStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 0,
  },
  fpStatItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  fpStatEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  fpStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fpStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fpFunFacts: {
    marginHorizontal: 20,
    backgroundColor: '#F4F7F5',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  fpFunFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fpFunFactEmoji: {
    fontSize: 16,
  },
  fpFunFactText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  fpFunFactBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fpCloseBtn: {
    margin: 20,
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  fpCloseBtnGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
  },
  fpCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Subject chips
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F4F9F7',
    borderWidth: 1.5,
    borderColor: '#E2EBE7',
  },
  subjectChipActive: {
    backgroundColor: '#5F8C87',
    borderColor: '#5F8C87',
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subjectChipTextActive: {
    color: '#FFFFFF',
  },

  // Group subject tag
  groupSubjectTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F8C87',
    marginTop: 2,
  },
  groupEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 8,
    backgroundColor: '#F4F9F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2EBE7',
  },
  groupEditBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F8C87',
  },

  // Hours/minutes picker
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  pickerColumn: {
    alignItems: 'center',
    flex: 1,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  pickerWheelWrap: {
    height: 150,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#F4F9F7',
  },
  pickerWheel: {
    height: 150,
    width: '100%',
  },
  pickerWheelItem: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickerSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 24,
  },
  pickerTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Edit group member management
  editMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F2',
    gap: 10,
  },
  editMemberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  editMemberBadge: {
    fontSize: 12,
  },
  editMemberRemoveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  editMemberRemoveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  editMemberAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#5F8C87',
    borderRadius: 12,
  },
  editMemberAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fpReportBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  fpReportText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
