import React, { useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import {
  pactsAPI, groupsAPI, feedAPI, socialAPI,
  StudyPact, StudyGroup, GroupMessage, FeedEvent,
  Friend,
} from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = ['Buddies', 'Groups', 'Feed'] as const;
type Tab = typeof TABS[number];

const REACTIONS = [
  { key: 'nice', label: 'Nice!', emoji: '👏' },
  { key: 'keep_going', label: 'Keep going!', emoji: '💪' },
  { key: 'fire', label: 'Fire!', emoji: '🔥' },
  { key: 'wow', label: 'Wow!', emoji: '🤩' },
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
  streak_milestone: '🔥',
  badge_earned: '🏅',
  pact_created: '🤝',
  group_created: '👥',
  group_goal_met: '🎉',
};

export default function SocialScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('Buddies');
  const [refreshing, setRefreshing] = useState(false);

  // Pacts
  const [pacts, setPacts] = useState<StudyPact[]>([]);
  const [showCreatePact, setShowCreatePact] = useState(false);
  const [pactBuddy, setPactBuddy] = useState<Friend | null>(null);
  const [pactMinutes, setPactMinutes] = useState('30');
  const [pactDays, setPactDays] = useState('7');
  const [pactWager, setPactWager] = useState('0');

  // Groups
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupGoal, setGroupGoal] = useState('500');
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Feed
  const [feed, setFeed] = useState<FeedEvent[]>([]);

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: number; user_id: number; username: string | null; email: string }[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendHandle, setAddFriendHandle] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [p, g, f, fr, pr] = await Promise.all([
        pactsAPI.getAll().catch(() => []),
        groupsAPI.getAll().catch(() => []),
        feedAPI.getFeed().catch(() => []),
        socialAPI.getFriends().catch(() => []),
        socialAPI.getPendingRequests().catch(() => []),
      ]);
      setPacts(p);
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

  // ---- Pact Actions ----
  const handleCreatePact = async () => {
    if (!pactBuddy) { Alert.alert('Select a friend', 'Tap a friend to select them.'); return; }
    try {
      await pactsAPI.create(pactBuddy.username || '', parseInt(pactMinutes) || 30, parseInt(pactDays) || 7, parseInt(pactWager) || 0);
      setShowCreatePact(false);
      setPactBuddy(null); setPactMinutes('30'); setPactDays('7'); setPactWager('0');
      Alert.alert('Pact Sent!', 'Waiting for your buddy to accept.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create pact');
    }
  };

  const handleAcceptPact = async (pactId: number) => {
    try {
      await pactsAPI.accept(pactId);
      Alert.alert('Pact Accepted!', 'The study pact is now active. Good luck!');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not accept pact');
    }
  };

  // ---- Group Actions ----
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await groupsAPI.create(groupName.trim(), parseInt(groupGoal) || 500);
      setShowCreateGroup(false);
      setGroupName(''); setGroupGoal('500');
      Alert.alert('Group Created!', 'Share the group ID with friends to invite them.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create group');
    }
  };

  const openGroupChat = async (group: StudyGroup) => {
    setSelectedGroup(group);
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

  // ---- Feed Actions ----
  const handleReact = async (eventId: number, reaction: string) => {
    try {
      await feedAPI.react(eventId, reaction);
      loadData();
    } catch {}
  };

  // ---- Render ----
  const renderBuddies = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.createButton} onPress={() => setShowCreatePact(true)}>
        <Text style={styles.createButtonIcon}>🤝</Text>
        <Text style={styles.createButtonText}>New Study Pact</Text>
      </TouchableOpacity>

      {pacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🤝</Text>
          <Text style={styles.emptyTitle}>No pacts yet</Text>
          <Text style={styles.emptySubtitle}>Challenge a friend to a study pact!</Text>
        </View>
      ) : pacts.map(p => {
        const isCreator = p.creator_id === user?.id;
        const partnerName = isCreator ? p.buddy_username : p.creator_username;
        const myProgress = isCreator ? p.creator_progress : p.buddy_progress;
        const theirProgress = isCreator ? p.buddy_progress : p.creator_progress;
        const myDone = myProgress.filter(d => d.completed).length;
        const theirDone = theirProgress.filter(d => d.completed).length;
        const isPending = p.status === 'pending' && !isCreator;

        return (
          <View key={p.id} style={styles.pactCard}>
            <View style={styles.pactHeader}>
              <Text style={styles.pactPartner}>🤝 with {partnerName || 'Unknown'}</Text>
              <View style={[styles.statusBadge, p.status === 'active' && styles.statusActive,
                p.status === 'completed' && styles.statusCompleted, p.status === 'failed' && styles.statusFailed]}>
                <Text style={styles.statusText}>{p.status}</Text>
              </View>
            </View>
            <Text style={styles.pactDetails}>
              {p.daily_minutes}min/day · {p.duration_days} days{p.wager_amount > 0 ? ` · ${p.wager_amount} 🍀 wager` : ''}
            </Text>
            {p.status === 'active' && (
              <View style={styles.pactProgressRow}>
                <View style={styles.pactProgressItem}>
                  <Text style={styles.pactProgressLabel}>You</Text>
                  <Text style={styles.pactProgressValue}>{myDone}/{p.duration_days}</Text>
                </View>
                <View style={styles.pactProgressItem}>
                  <Text style={styles.pactProgressLabel}>{partnerName}</Text>
                  <Text style={styles.pactProgressValue}>{theirDone}/{p.duration_days}</Text>
                </View>
              </View>
            )}
            {isPending && (
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptPact(p.id)}>
                <Text style={styles.acceptButtonText}>Accept Pact</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );

  const renderGroups = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateGroup(true)}>
        <Text style={styles.createButtonIcon}>👥</Text>
        <Text style={styles.createButtonText}>Create Study Group</Text>
      </TouchableOpacity>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>Create a study group to collaborate with friends!</Text>
        </View>
      ) : groups.map(g => {
        const progress = g.goal_minutes > 0 ? Math.min((g.total_minutes / g.goal_minutes) * 100, 100) : 0;
        return (
          <TouchableOpacity key={g.id} style={styles.groupCard} onPress={() => openGroupChat(g)} activeOpacity={0.7}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupName}>{g.name}</Text>
              {g.goal_met && <Text style={styles.goalMetBadge}>🎉 Goal Met!</Text>}
            </View>
            <View style={styles.groupProgressBar}>
              <View style={[styles.groupProgressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.groupProgressText}>
              {g.total_minutes} / {g.goal_minutes} min
            </Text>
            <View style={styles.groupMembersRow}>
              {g.members.slice(0, 5).map(m => (
                <View key={m.user_id} style={styles.memberChip}>
                  <Text style={styles.memberChipText}>{m.username || '?'}</Text>
                  <Text style={styles.memberChipMins}>{m.minutes_contributed}m</Text>
                </View>
              ))}
              {g.members.length > 5 && (
                <Text style={styles.memberMore}>+{g.members.length - 5}</Text>
              )}
            </View>
            <Text style={styles.groupIdText}>Group ID: {g.id} · Tap to chat</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderFeed = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Leaderboard Preview */}
      {friends.length > 0 && (
        <View style={styles.leaderboardCard}>
          <Text style={styles.leaderboardTitle}>📊 Weekly Leaderboard</Text>
          {[...friends, ...(user ? [{
            id: user.id, username: user.username, email: user.email,
            total_study_minutes: user.total_study_minutes, current_streak: user.current_streak, animals_count: 0
          }] : [])]
            .sort((a, b) => b.total_study_minutes - a.total_study_minutes)
            .slice(0, 5)
            .map((f, i) => (
              <View key={f.id} style={styles.leaderboardRow}>
                <Text style={styles.leaderboardRank}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </Text>
                <Text style={[styles.leaderboardName, f.id === user?.id && styles.leaderboardNameSelf]}>
                  {f.username || f.email?.split('@')[0]}
                </Text>
                <Text style={styles.leaderboardStreak}>🔥 {f.current_streak}</Text>
                <Text style={styles.leaderboardMins}>{f.total_study_minutes}m</Text>
              </View>
            ))}
        </View>
      )}

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
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Social</Text>
          <Text style={styles.headerSubtitle}>{friends.length} friends</Text>
        </View>
        <TouchableOpacity style={styles.addFriendButton} onPress={() => setShowAddFriend(true)}>
          <Text style={styles.addFriendButtonText}>+ Add Friend</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingTitle}>Friend Requests ({pendingRequests.length})</Text>
          {pendingRequests.map(req => (
            <View key={req.id} style={styles.pendingRow}>
              <Text style={styles.pendingName}>{req.username || req.email.split('@')[0]}</Text>
              <TouchableOpacity style={styles.pendingAcceptBtn} onPress={() => handleAcceptFriend(req.id)}>
                <Text style={styles.pendingAcceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
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

      <View style={{ flex: 1 }}>
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        {tab === 'Buddies' && renderBuddies()}
        {tab === 'Groups' && renderGroups()}
        {tab === 'Feed' && renderFeed()}
      </View>

      {/* Create Pact Modal */}
      <Modal visible={showCreatePact} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🤝 New Study Pact</Text>
              <Text style={styles.inputLabel}>Choose a friend</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendPickerRow}>
                {friends.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.friendPickerChip, pactBuddy?.id === f.id && styles.friendPickerChipActive]}
                    onPress={() => setPactBuddy(pactBuddy?.id === f.id ? null : f)}
                  >
                    <Text style={[styles.friendPickerText, pactBuddy?.id === f.id && styles.friendPickerTextActive]}>
                      {f.username || f.email.split('@')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
                {friends.length === 0 && (
                  <Text style={styles.noFriendsText}>Add friends first!</Text>
                )}
              </ScrollView>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Min/day</Text>
                  <TextInput style={styles.input} value={pactMinutes} onChangeText={setPactMinutes} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Days</Text>
                  <TextInput style={styles.input} value={pactDays} onChangeText={setPactDays} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Wager 🍀</Text>
                  <TextInput style={styles.input} value={pactWager} onChangeText={setPactWager} keyboardType="number-pad" />
                </View>
              </View>
              <TouchableOpacity style={styles.modalPrimary} onPress={handleCreatePact}>
                <Text style={styles.modalPrimaryText}>Send Pact</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreatePact(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={showCreateGroup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>👥 Create Study Group</Text>
              <Text style={styles.inputLabel}>Group name</Text>
              <TextInput style={styles.input} placeholder="e.g. Bio Exam Crew" placeholderTextColor={colors.textMuted}
                value={groupName} onChangeText={setGroupName} />
              <Text style={styles.inputLabel}>Goal (total minutes)</Text>
              <TextInput style={styles.input} value={groupGoal} onChangeText={setGroupGoal} keyboardType="number-pad" />
              <TouchableOpacity style={styles.modalPrimary} onPress={handleCreateGroup}>
                <Text style={styles.modalPrimaryText}>Create Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateGroup(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Group Chat Modal */}
      <Modal visible={!!selectedGroup} animationType="slide" onRequestClose={() => setSelectedGroup(null)}>
        <SafeAreaView style={styles.chatContainer} edges={['top', 'bottom']}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setSelectedGroup(null)}>
              <Text style={styles.chatBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.chatTitle}>{selectedGroup?.name}</Text>
            <View style={{ width: 50 }} />
          </View>
          <FlatList
            data={messages}
            keyExtractor={m => m.id.toString()}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => {
              const isMine = item.user_id === user?.id;
              return (
                <View style={[styles.chatBubble, isMine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                  {!isMine && <Text style={styles.chatBubbleSender}>{item.username || 'Someone'}</Text>}
                  <Text style={[styles.chatBubbleText, isMine && { color: '#fff' }]}>{item.content}</Text>
                  <Text style={[styles.chatBubbleTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>{timeAgo(item.created_at)}</Text>
                </View>
              );
            }}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={chatInput}
                onChangeText={setChatInput}
              />
              <TouchableOpacity style={styles.chatSendButton} onPress={handleSendMessage}>
                <Text style={styles.chatSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
                <TouchableOpacity style={styles.modalPrimary} onPress={handleAddFriend}>
                  <Text style={styles.modalPrimaryText}>Send Request</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddFriend(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
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
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addFriendButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  pendingSection: {
    marginHorizontal: spacing.lg, backgroundColor: '#FFF8E7',
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: '#E8B86D40',
  },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#D4A84B', marginBottom: 8 },
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

  tabBar: {
    flexDirection: 'row', marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.full,
    padding: 3, marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1, paddingVertical: 10, borderRadius: borderRadius.full, alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: colors.surface, ...shadows.small },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabButtonTextActive: { color: colors.primary, fontWeight: '700' },

  tabContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  // Create buttons
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
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
  statusActive: { backgroundColor: '#E3F2FD' },
  statusCompleted: { backgroundColor: '#E8F5E9' },
  statusFailed: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  pactDetails: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  pactProgressRow: { flexDirection: 'row', gap: spacing.md },
  pactProgressItem: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.md, padding: 10, alignItems: 'center' },
  pactProgressLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  pactProgressValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  acceptButton: {
    backgroundColor: colors.tertiary, borderRadius: borderRadius.full,
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
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  memberChipText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  memberChipMins: { fontSize: 11, color: colors.textMuted },
  memberMore: { fontSize: 12, color: colors.textMuted, alignSelf: 'center' },
  groupIdText: { fontSize: 11, color: colors.textMuted },

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
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
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
  chatContainer: { flex: 1, backgroundColor: colors.background },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder, backgroundColor: colors.surface,
  },
  chatBackText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  chatTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  chatList: { padding: spacing.md, paddingBottom: 20 },
  chatBubble: {
    maxWidth: '78%', padding: 12, borderRadius: 18, marginBottom: 8,
  },
  chatBubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  chatBubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadows.small },
  chatBubbleSender: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 3 },
  chatBubbleText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  chatBubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.cardBorder, backgroundColor: colors.surface,
  },
  chatInput: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.textPrimary,
  },
  chatSendButton: {
    backgroundColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  chatSendText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
