import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
  Image,
  ActionSheetIOS,
  Platform,
  KeyboardAvoidingView,
  Switch,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '../components/StyledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Rect, G, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { useAuth } from '../contexts/AuthContext';
import {
  statsAPI,
  socialAPI,
  authAPI,
  donationsAPI,
  moderationAPI,
  UserStats,
  LeaderboardEntry,
  DonationLeaderboardEntry,
  Friend,
  SchoolSearchResult,
} from '../services/api';

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
  const { user, logout, refreshUser, profilePic, setProfilePic } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [personalDonation, setPersonalDonation] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [donationLeaderboard, setDonationLeaderboard] = useState<DonationLeaderboardEntry[]>([]);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const loadBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const list = await moderationAPI.getBlockedUsers();
      setBlockedUsers(list);
    } catch { setBlockedUsers([]); }
    setLoadingBlocked(false);
  };

  const handleUnblock = (userId: number, username: string) => {
    Alert.alert('Unblock User', `Are you sure you want to unblock ${username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await moderationAPI.unblockUser(userId);
            setBlockedUsers(prev => prev.filter(u => u.id !== userId));
            Alert.alert('Unblocked', `${username} has been unblocked.`);
          } catch {
            Alert.alert('Error', 'Could not unblock user. Please try again.');
          }
        },
      },
    ]);
  };

  // Edit profile
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editSchool, setEditSchool] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [schoolSuggestions, setSchoolSuggestions] = useState<SchoolSearchResult[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const schoolSearchTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const openEditProfile = () => {
    setEditSchool(user?.school || '');
    setEditCity(user?.city || '');
    setEditCountry(user?.country || '');
    setSchoolSuggestions([]);
    setShowSchoolSuggestions(false);
    setShowEditProfile(true);
  };

  const handleSchoolSearch = (text: string) => {
    setEditSchool(text);
    if (schoolSearchTimeout.current) clearTimeout(schoolSearchTimeout.current);
    if (text.length < 2) {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
      return;
    }
    schoolSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await authAPI.searchSchools(text);
        setSchoolSuggestions(results);
        setShowSchoolSuggestions(results.length > 0);
      } catch {
        setSchoolSuggestions([]);
        setShowSchoolSuggestions(false);
      }
    }, 300);
  };

  const selectSchool = (school: SchoolSearchResult) => {
    setEditSchool(school.name);
    if (school.city && !editCity) setEditCity(school.city);
    if (school.country && !editCountry) setEditCountry(school.country === 'UK' ? 'United Kingdom' : school.country === 'US' ? 'United States' : school.country);
    setShowSchoolSuggestions(false);
  };

  const saveProfile = async () => {
    try {
      await authAPI.updateProfile({
        school: editSchool || undefined,
        city: editCity || undefined,
        country: editCountry || undefined,
      });
      await refreshUser();
      setShowEditProfile(false);
      Alert.alert('Saved', 'Your profile has been updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update profile');
    }
  };

  const handleEditUsername = () => {
    Alert.prompt(
      'Change Username',
      'Enter your new username',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newUsername?: string) => {
            if (!newUsername || !newUsername.trim()) return;
            const trimmed = newUsername.trim();
            if (trimmed === user?.username) return;
            try {
              await authAPI.setUsername(trimmed);
              await refreshUser();
              Alert.alert('Done', `Username changed to @${trimmed}`);
            } catch (e: any) {
              const msg = e?.message || '';
              if (msg.toLowerCase().includes('taken')) {
                Alert.alert('Username Taken', `@${trimmed} is already in use. Try a different one.`);
              } else {
                Alert.alert('Error', msg || 'Could not update username');
              }
            }
          },
        },
      ],
      'plain-text',
      user?.username || '',
    );
  };

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
        await setProfilePic(result.assets[0].uri);
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
        await setProfilePic(result.assets[0].uri);
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
            await setProfilePic(null);
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
          onPress: () => setProfilePic(null),
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

      if (user?.id) {
        const [donationData, donLb] = await Promise.all([
          donationsAPI.getUserStats(user.id).catch(() => null),
          donationsAPI.getLeaderboard().catch(() => []),
        ]);
        if (donationData) {
          setPersonalDonation({ total: donationData.total_donated, count: donationData.donation_count });
        }
        setDonationLeaderboard(donLb);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to load profile data:', error);
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? All your data including study history, animals, badges, and friends will be lost forever. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This is irreversible. Are you absolutely sure?',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await authAPI.deleteAccount();
                      logout();
                    } catch (e) {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainHours = hours % 24;
      return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
    }
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

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
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{user?.username || 'Studier'}</Text>
            <TouchableOpacity onPress={handleEditUsername} style={styles.usernameEditBtn} activeOpacity={0.7}>
              <Text style={styles.usernameEditText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          {(user?.school || user?.city || user?.country) && (
            <View style={styles.profileInfoRow}>
              {user?.school && (
                <View style={styles.profileInfoChip}>
                  <Text style={styles.profileInfoIcon}>🎓</Text>
                  <Text style={styles.profileInfoText}>{user.school}</Text>
                </View>
              )}
              {(user?.city || user?.country) && (
                <View style={styles.profileInfoChip}>
                  <Text style={styles.profileInfoIcon}>📍</Text>
                  <Text style={styles.profileInfoText}>
                    {[user?.city, user?.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.profileHeaderActions}>
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
            <TouchableOpacity onPress={openEditProfile} style={styles.editProfileBtn} activeOpacity={0.7}>
              <Text style={styles.editProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </ExpoLinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
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

        {/* Donation Impact Card */}
        <ExpoLinearGradient
          colors={['#E7EFEA', '#D4E8DE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.donationCard}
        >
          <Text style={styles.donationCardIcon}>💚</Text>
          <View style={styles.donationCardInfo}>
            <Text style={styles.donationCardAmount}>${personalDonation.total.toFixed(0)} donated</Text>
            <Text style={styles.donationCardSub}>
              {personalDonation.count > 0
                ? `${personalDonation.count} donation${personalDonation.count !== 1 ? 's' : ''} to WWF`
                : 'Make your first donation!'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.donationCardBtn}
            onPress={() => navigation.navigate('TakeAction')}
            activeOpacity={0.8}
          >
            <Text style={styles.donationCardBtnText}>Donate</Text>
          </TouchableOpacity>
        </ExpoLinearGradient>

        {/* Admin Settings — only visible to admin users */}
        {user?.is_admin && (
          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>🛠  Developer Settings</Text>
            <View style={styles.adminRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminRowLabel}>Test Timer (seconds)</Text>
                <Text style={styles.adminRowHint}>Timer counts in seconds instead of minutes</Text>
              </View>
              <Switch
                value={user?.use_test_timer ?? false}
                onValueChange={async (val) => {
                  try {
                    await authAPI.updateSettings({ use_test_timer: val });
                    await refreshUser();
                  } catch {}
                }}
                trackColor={{ false: '#E2EAE5', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        )}

        {/* Settings & Support */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsCardTitle}>Settings & Support</Text>

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => { loadBlockedUsers(); setShowBlockedUsers(true); }}
          >
            <Text style={styles.settingsRowText}>Blocked Users</Text>
            <Text style={styles.settingsRowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => Linking.openURL('https://endura.eco/terms')}
          >
            <Text style={styles.settingsRowText}>Terms of Use</Text>
            <Text style={styles.settingsRowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => Linking.openURL('https://endura.eco/privacy')}
          >
            <Text style={styles.settingsRowText}>Privacy Policy</Text>
            <Text style={styles.settingsRowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            onPress={() => Linking.openURL('mailto:hello@endura.eco')}
          >
            <Text style={styles.settingsRowText}>Contact Support</Text>
            <Text style={styles.settingsRowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        {/* App Info */}
        <Text style={styles.appVersion}>Endura v1.0.0</Text>
      </ScrollView>

      {/* Blocked Users Modal */}
      <Modal visible={showBlockedUsers} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBlockedUsers(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <View style={{ padding: 20 }}>
            <Text style={styles.modalTitle}>Blocked Users</Text>
            <Text style={styles.modalSubtitle}>
              Users you've blocked can't see your activity or contact you.
            </Text>

            {loadingBlocked ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : blockedUsers.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 24, fontSize: 14 }}>
                You haven't blocked anyone.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {blockedUsers.map(bu => (
                  <View key={bu.id} style={styles.blockedUserRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockedUserName}>{bu.username || bu.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unblockButton}
                      onPress={() => handleUnblock(bu.id, bu.username || bu.email)}
                    >
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={showFriendModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFriendModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
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
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="fade">
        <TouchableOpacity
          style={styles.epOverlay}
          activeOpacity={1}
          onPress={() => { setShowSchoolSuggestions(false); setShowEditProfile(false); }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={styles.epCard}>
              <Text style={styles.epTitle}>Edit Profile</Text>

              <Text style={styles.epLabel}>School</Text>
              <TextInput
                style={styles.epInput}
                placeholder="e.g. Southbank International School"
                placeholderTextColor={colors.textMuted}
                value={editSchool}
                onChangeText={handleSchoolSearch}
                autoCapitalize="words"
              />
              {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                <View style={styles.epSuggestions}>
                  <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                    {schoolSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={`${s.name}-${i}`}
                        style={styles.epSuggestionItem}
                        onPress={() => selectSchool(s)}
                      >
                        <Text style={styles.epSuggestionName} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.epSuggestionLocation} numberOfLines={1}>
                          {[s.city, s.region, s.country].filter(Boolean).join(', ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.epLabel}>City</Text>
              <TextInput
                style={styles.epInput}
                placeholder="e.g. London"
                placeholderTextColor={colors.textMuted}
                value={editCity}
                onChangeText={setEditCity}
                autoCapitalize="words"
              />

              <Text style={styles.epLabel}>Country</Text>
              <TextInput
                style={styles.epInput}
                placeholder="e.g. United Kingdom"
                placeholderTextColor={colors.textMuted}
                value={editCountry}
                onChangeText={setEditCountry}
                autoCapitalize="words"
              />

              <TouchableOpacity onPress={saveProfile} activeOpacity={0.8} style={{ marginTop: 20 }}>
                <ExpoLinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.epSaveBtn}
                >
                  <Text style={styles.epSaveBtnText}>Save</Text>
                </ExpoLinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.epCancelBtn}>
                <Text style={styles.epCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xs,
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  usernameEditBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  usernameEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    gap: 10,
    marginBottom: spacing.xl,
    justifyContent: 'center',
  },
  statBox: {
    width: (width - spacing.lg * 2 - 20) / 3,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  donationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.small,
  },
  donationCardIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  donationCardInfo: {
    flex: 1,
  },
  donationCardAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F4A3E',
  },
  donationCardSub: {
    fontSize: 12,
    color: '#3B5F50',
    fontWeight: '500',
    marginTop: 2,
  },
  donationCardBtn: {
    backgroundColor: '#2F4A3E',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  donationCardBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
  adminCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E8DCC8',
  },
  adminCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  adminRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  adminRowHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
  deleteAccountButton: {
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteAccountText: {
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

  // Profile info chips
  profileInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  profileInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  profileInfoIcon: {
    fontSize: 12,
  },
  profileInfoText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.9,
  },
  profileHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editProfileBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Edit Profile Modal
  epOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  epCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: Dimensions.get('window').width - spacing.lg * 2,
    maxWidth: 380,
    ...shadows.medium,
  },
  epTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  epLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  epInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  epSuggestions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 4,
    ...shadows.small,
  },
  epSuggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  epSuggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  epSuggestionLocation: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  epSaveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  epSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  epCancelBtn: {
    padding: 14,
    alignItems: 'center',
  },
  epCancelBtnText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingsRowText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  settingsRowArrow: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
  blockedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  blockedUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  unblockButton: {
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  unblockButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
