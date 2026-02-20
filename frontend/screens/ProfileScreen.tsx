import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  Image,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Rect, G, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import {
  statsAPI,
  socialAPI,
  UserStats,
  LeaderboardEntry,
  Friend,
} from '../services/api';

const PROFILE_PIC_KEY = 'user_profile_picture';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - spacing.lg * 2;

// Pie Chart Component
const PieChart = ({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  
  const center = size / 2;
  const radius = size / 2 - 10;
  let currentAngle = -90;
  
  const paths = data.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return <Path key={index} d={d} fill={item.color} />;
  });
  
  return (
    <Svg width={size} height={size}>
      {paths}
      <Circle cx={center} cy={center} r={radius * 0.5} fill={colors.surface} />
    </Svg>
  );
};

// Bar Chart Component  
const BarChart = ({ data, height = 150 }: { data: { label: string; value: number; maxValue: number }[]; height?: number }) => {
  const barWidth = (CHART_WIDTH - 60) / data.length - 10;
  const maxVal = Math.max(...data.map(d => d.maxValue || d.value), 1);
  
  return (
    <Svg width={CHART_WIDTH} height={height + 30}>
      <Defs>
        <LinearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.primary} />
          <Stop offset="100%" stopColor={colors.primaryLight} />
        </LinearGradient>
      </Defs>
      {data.map((item, index) => {
        const barHeight = (item.value / maxVal) * height;
        const x = 30 + index * (barWidth + 10);
        const y = height - barHeight;
        
        return (
          <G key={index}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
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
            <SvgText
              x={x + barWidth / 2}
              y={y - 5}
              fill={colors.textPrimary}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {item.value}
            </SvgText>
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
        {percentage > 0 && (
          <ExpoLinearGradient
            colors={['#A8C8D8', '#5F8C87']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${percentage}%` }]}
          />
        )}
      </View>
    </View>
  );
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, refreshUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_PIC_KEY).then(uri => {
      if (uri) setProfilePic(uri);
    });
  }, []);

  const pickImage = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setProfilePic(uri);
        await AsyncStorage.setItem(PROFILE_PIC_KEY, uri);
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setProfilePic(uri);
        await AsyncStorage.setItem(PROFILE_PIC_KEY, uri);
      }
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      const options = profilePic
        ? ['Take Photo', 'Choose from Library', 'Remove Photo', 'Cancel']
        : ['Take Photo', 'Choose from Library', 'Cancel'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: profilePic ? 2 : undefined,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) pickImage('camera');
          else if (buttonIndex === 1) pickImage('gallery');
          else if (buttonIndex === 2 && profilePic) {
            setProfilePic(null);
            await AsyncStorage.removeItem(PROFILE_PIC_KEY);
          }
        },
      );
    } else {
      const buttons: any[] = [
        { text: 'Take Photo', onPress: () => pickImage('camera') },
        { text: 'Choose from Library', onPress: () => pickImage('gallery') },
      ];
      if (profilePic) {
        buttons.push({
          text: 'Remove Photo',
          style: 'destructive',
          onPress: async () => {
            setProfilePic(null);
            await AsyncStorage.removeItem(PROFILE_PIC_KEY);
          },
        });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Profile Photo', 'Choose an option', buttons);
    }
  };

  const loadData = async () => {
    try {
      const [statsData, leaderboardData, friendsData] = await Promise.all([
        statsAPI.getStats(),
        socialAPI.getLeaderboard(),
        socialAPI.getFriends(),
      ]);
      setStats(statsData);
      setLeaderboard(leaderboardData);
      setFriends(friendsData);
    } catch (error) {
      console.error('Failed to load profile data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUser();
    }, [])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleAddFriend = async () => {
    if (!friendEmail.trim()) return;

    try {
      await socialAPI.sendFriendRequest(friendEmail.trim());
      Alert.alert('Success', 'Friend request sent!');
      setFriendEmail('');
      setShowFriendModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

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
        {/* Swipe Indicator */}
        <View style={styles.swipeIndicator} />
        
        {/* Header with Close Button */}
        <View style={styles.backHeader}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <ExpoLinearGradient
          colors={['#5F8C87', '#3B5466']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
            <View style={styles.avatarContainer}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarEmoji}>👤</Text>
              )}
              <View style={styles.cameraOverlay}>
                <Text style={styles.cameraIcon}>📷</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.username}>{user?.username || 'Studier'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <ExpoLinearGradient
            colors={['#A8C8D8', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.streakContainer}
          >
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakValue}>{user?.current_streak || 0}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </ExpoLinearGradient>
        </ExpoLinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <ExpoLinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{formatTime(stats?.total_study_minutes || 0)}</Text>
            <Text style={styles.statLabel}>Total Study</Text>
          </ExpoLinearGradient>
          <ExpoLinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{stats?.total_sessions || 0}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </ExpoLinearGradient>
          <ExpoLinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{stats?.total_coins || 0}</Text>
            <Text style={styles.statLabel}>Total Eco-Credits</Text>
          </ExpoLinearGradient>
          <ExpoLinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{stats?.animals_hatched || 0}</Text>
            <Text style={styles.statLabel}>Animals</Text>
          </ExpoLinearGradient>
          <ExpoLinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{stats?.tasks_completed || 0}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </ExpoLinearGradient>
          <ExpoLinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statBox}
          >
            <Text style={styles.statValue}>{stats?.longest_streak || 0}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </ExpoLinearGradient>
        </View>

        {/* Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏆 Leaderboard</Text>
            <TouchableOpacity
              style={styles.addFriendButton}
              onPress={() => setShowFriendModal(true)}
              activeOpacity={0.8}
            >
              <ExpoLinearGradient
                colors={['#5F8C87', '#3B5466']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addFriendButtonGradient}
              >
                <Text style={styles.addFriendText}>+ Add Friend</Text>
              </ExpoLinearGradient>
            </TouchableOpacity>
          </View>

          {leaderboard.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>Add friends to compete!</Text>
            </View>
          ) : (
            leaderboard.map((entry, index) => {
              const isMe = entry.user_id === user?.id;
              return isMe ? (
                <ExpoLinearGradient
                  key={entry.user_id}
                  colors={['rgba(231, 239, 234, 0.3)', 'rgba(168, 200, 216, 0.3)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.leaderboardRowMe}
                >
                  <Text style={styles.leaderboardRank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${entry.rank}`}
                  </Text>
                  <View style={styles.leaderboardInfo}>
                    <Text style={styles.leaderboardName}>
                      {entry.username || 'Anonymous'}
                      {' (You)'}
                    </Text>
                    <Text style={styles.leaderboardStats}>
                      {formatTime(entry.total_study_minutes)} • 🔥 {entry.current_streak} • 🦁 {entry.animals_count}
                    </Text>
                  </View>
                </ExpoLinearGradient>
              ) : (
                <View
                  key={entry.user_id}
                  style={styles.leaderboardRow}
                >
                  <Text style={styles.leaderboardRank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${entry.rank}`}
                  </Text>
                  <View style={styles.leaderboardInfo}>
                    <Text style={styles.leaderboardName}>
                      {entry.username || 'Anonymous'}
                    </Text>
                    <Text style={styles.leaderboardStats}>
                      {formatTime(entry.total_study_minutes)} • 🔥 {entry.current_streak} • 🦁 {entry.animals_count}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Friends List */}
        {friends.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Friends ({friends.length})</Text>
            {friends.map((friend) => (
              <View key={friend.id} style={styles.friendRow}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>👤</Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>
                    {friend.username || friend.email.split('@')[0]}
                  </Text>
                  <Text style={styles.friendStats}>
                    {formatTime(friend.total_study_minutes)} studied
                  </Text>
                </View>
                <View style={styles.friendStreak}>
                  <Text style={styles.friendStreakText}>🔥 {friend.current_streak}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Info */}
        <Text style={styles.appVersion}>Endura v1.0.0</Text>
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal visible={showFriendModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add a Friend 👥</Text>
            <Text style={styles.modalSubtitle}>
              Enter their email to send a friend request
            </Text>

            <TextInput
              style={styles.emailInput}
              placeholder="friend@email.com"
              placeholderTextColor={colors.textMuted}
              value={friendEmail}
              onChangeText={setFriendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity style={styles.sendButton} onPress={handleAddFriend} activeOpacity={0.8}>
              <ExpoLinearGradient
                colors={['#5F8C87', '#3B5466']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButtonGradient}
              >
                <Text style={styles.sendButtonText}>Send Request</Text>
              </ExpoLinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowFriendModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  swipeIndicator: {
    width: 40,
    height: 5,
    backgroundColor: colors.textMuted,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    opacity: 0.4,
  },
  backHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingRight: spacing.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    paddingTop: spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  avatarImage: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5F8C87',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cameraIcon: {
    fontSize: 14,
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.small,
  },
  streakEmoji: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  streakValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.streakActive,
    marginRight: spacing.xs,
  },
  streakLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  statBox: {
    width: '31%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chartSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pieChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  pieLegend: {
    marginLeft: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  legendText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
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
    color: colors.textPrimary,
    fontWeight: '500',
  },
  progressBarValue: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  addFriendButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  addFriendButtonGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  addFriendText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  leaderboardRowMe: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  leaderboardRank: {
    fontSize: 24,
    width: 40,
    textAlign: 'center',
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  leaderboardStats: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    fontSize: 20,
  },
  friendInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  friendStats: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  friendStreak: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  friendStreakText: {
    color: colors.streakActive,
    fontWeight: '600',
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 16,
  },
  appVersion: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emailInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sendButton: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    padding: spacing.md,
    alignItems: 'center',
  },
  sendButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
