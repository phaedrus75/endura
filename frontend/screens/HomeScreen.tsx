import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Dimensions,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import DateTimePicker from '@react-native-community/datetimepicker';
import LottieView from 'lottie-react-native';
import { spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from '../services/analytics';

// HomeScreen preserves its original palette independent of the global theme
const colors = {
  background: '#F5F8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF2ED',
  primary: '#6B9B9B',
  primaryDark: '#5A8585',
  primaryLight: '#8FB5B5',
  textPrimary: '#2D3B36',
  textSecondary: '#5A6B65',
  textMuted: '#8A9A94',
  textOnPrimary: '#FFFFFF',
  success: '#6BBF8A',
  cardBorder: '#E2EAE5',
  divider: '#E8EDE9',
};
const shadows = {
  small: {
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
};
import { animalsAPI, tasksAPI, statsAPI, badgesAPI, sharedEggAPI, Egg, Task, UserStats, UserAnimal, BadgeResponse, SharedEgg } from '../services/api';
import { animalImages, getAnimalImage } from '../assets/animals';

const { width, height } = Dimensions.get('window');

// Beautiful Nature Landscape with Lottie Animation
const NatureLandscape = () => (
  <View style={styles.landscapeContainer}>
    <LottieView
      source={require('../assets/nature-landscape.json')}
      autoPlay
      loop
      style={styles.landscapeLottie}
      resizeMode="cover"
    />
  </View>
);

// Egg nestled in a large 🪹 emoji nest
const EggInNest = () => (
  <View style={styles.eggNestContainer}>
    <View style={styles.eggWrapper}>
      <LottieView
        source={require('../assets/egg-animation.json')}
        autoPlay
        loop
        style={{ width: 270, height: 270 }}
      />
    </View>
    <Text style={styles.nestEmoji}>🪹</Text>
  </View>
);

// Emoji map for animals (synced with backend)
const animalEmojiMap: Record<string, string> = {
  'Sunda Island Tiger': '🐅', 'Javan Rhino': '🦏', 'Amur Leopard': '🐆',
  'Mountain Gorilla': '🦍', 'Tapanuli Orangutan': '🦧', 'Polar Bear': '🐻‍❄️',
  'African Forest Elephant': '🐘', 'Hawksbill Turtle': '🐢', 'Calamian Deer': '🦌',
  'Axolotl': '🦎', 'Red Wolf': '🐺', 'Monarch Butterfly': '🦋',
  'Red Panda': '🐼', 'Panda': '🐼', 'Mexican Bobcat': '🐱',
  'Chinchilla': '🐭', 'Otter': '🦦', 'Koala': '🐨',
  'Langur Monkey': '🐒', 'Pacific Pocket Mouse': '🐁', 'Wallaby': '🦘',
  'Avahi': '🐒', 'Blue Whale': '🐋', 'Gray Bat': '🦇',
  'Grey Parrot': '🦜', 'Grizzly Bear': '🐻', 'Mountain Zebra': '🦓',
  'Pangolin': '🦔', 'Seal': '🦭', 'Wombat': '🐻',
};

// Recent Hatch Card - Animal displayed cleanly without nest
const RecentHatchCard = ({ animal }: { animal?: UserAnimal }) => {
  const animalName = animal?.animal?.name;
  const imageSource = animalName ? getAnimalImage(animalName) : null;

  return (
    <View style={styles.recentHatchCard}>
      {animal ? (
        <View style={styles.recentHatchContent}>
          {imageSource ? (
            <Image source={imageSource} style={styles.recentHatchImage} resizeMode="contain" />
          ) : (
            <Text style={styles.recentHatchEmoji}>🐾</Text>
          )}
        </View>
      ) : (
        <View style={styles.recentHatchPlaceholder}>
          <Text style={styles.placeholderEmoji}>🥚</Text>
        </View>
      )}
    </View>
  );
};

const formatStudyTime = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default function HomeScreen() {
  const { user, refreshUser, profilePic } = useAuth();
  const navigation = useNavigation<any>();
  const [egg, setEgg] = useState<Egg | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentAnimals, setRecentAnimals] = useState<UserAnimal[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showHatchModal, setShowHatchModal] = useState(false);
  const [hatchedAnimal, setHatchedAnimal] = useState<any>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showEcoModal, setShowEcoModal] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showStudyTimeModal, setShowStudyTimeModal] = useState(false);
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [subjects, setSubjects] = useState<string[]>(['Math', 'Science', 'English', 'History']);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [activeSharedEgg, setActiveSharedEgg] = useState<SharedEgg | null>(null);
  const [hasSeenTips, setHasSeenTips] = useState(true);
  const tipsPulse = useRef(new Animated.Value(1)).current;
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    const checkTips = async () => {
      const seen = await AsyncStorage.getItem(`hasSeenTips_${user?.id || 'anon'}`);
      setHasSeenTips(seen === 'true');
    };
    checkTips();
  }, [user?.id]);

  useEffect(() => {
    if (!hasSeenTips) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(tipsPulse, { toValue: 1.25, duration: 800, useNativeDriver: true }),
          Animated.timing(tipsPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [hasSeenTips]);

  const handleOpenTips = async () => {
    if (!hasSeenTips) {
      setHasSeenTips(true);
      await AsyncStorage.setItem(`hasSeenTips_${user?.id || 'anon'}`, 'true');
    }
    navigation.navigate('Tips');
  };

  // Load subjects from storage, merging with backend study data
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const stored = await AsyncStorage.getItem(`customSubjects_${user?.id || 'anon'}`);
        if (stored) {
          setSubjects(JSON.parse(stored));
        }
      } catch (e) {
        console.log('Failed to load subjects');
      }
    };
    loadSubjects();
  }, [user?.id]);

  const saveSubjects = async (newSubjects: string[]) => {
    try {
      await AsyncStorage.setItem(`customSubjects_${user?.id || 'anon'}`, JSON.stringify(newSubjects));
      setSubjects(newSubjects);
    } catch (e) {
      console.log('Failed to save subjects');
    }
  };

  const addNewSubject = async () => {
    const name = newSubjectName.trim();
    if (name && !subjects.includes(name)) {
      const updated = [...subjects, name];
      saveSubjects(updated);
      setNewSubjectName('');
      setShowAddSubject(false);
      try {
        const key = `removedSubjects_${user?.id || 'anon'}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const removed: string[] = JSON.parse(stored);
          const filtered = removed.filter(s => s !== name);
          await AsyncStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch (e) {}
    }
  };

  const removeSubject = async (subject: string) => {
    const updated = subjects.filter(s => s !== subject);
    saveSubjects(updated);
    try {
      const key = `removedSubjects_${user?.id || 'anon'}`;
      const stored = await AsyncStorage.getItem(key);
      const removed: string[] = stored ? JSON.parse(stored) : [];
      if (!removed.includes(subject)) {
        removed.push(subject);
        await AsyncStorage.setItem(key, JSON.stringify(removed));
      }
    } catch (e) {}
  };

  const loadData = async () => {
    try {
      const [eggData, tasksData, statsData, animalsData, badgesData, sharedEgg] = await Promise.all([
        animalsAPI.getEgg(),
        tasksAPI.getTasks(true),
        statsAPI.getStats(),
        animalsAPI.getMyAnimals().catch(() => []),
        badgesAPI.getBadges().catch(() => []),
        sharedEggAPI.getActive().catch(() => null),
      ]);
      
      setEgg(eggData);
      setTasks(tasksData);
      setStats(statsData);
      setRecentAnimals(animalsData.slice(0, 3));
      setBadges(badgesData);
      setActiveSharedEgg(sharedEgg);

      if (statsData?.study_minutes_by_subject) {
        const backendSubjects = Object.keys(statsData.study_minutes_by_subject);
        const removedRaw = await AsyncStorage.getItem(`removedSubjects_${user?.id || 'anon'}`).catch(() => null);
        const removedSubjects: string[] = removedRaw ? JSON.parse(removedRaw) : [];
        setSubjects(prev => {
          const merged = [...prev];
          let changed = false;
          for (const s of backendSubjects) {
            if (!merged.includes(s) && !removedSubjects.includes(s)) {
              merged.push(s);
              changed = true;
            }
          }
          if (changed) {
            AsyncStorage.setItem(`customSubjects_${user?.id || 'anon'}`, JSON.stringify(merged)).catch(() => {});
          }
          return changed ? merged : prev;
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
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

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await tasksAPI.createTask({ 
        title: newTaskTitle.trim(),
        description: newTaskSubject.trim() || undefined,
        due_date: newTaskDueDate ? newTaskDueDate.toISOString().split('T')[0] : undefined,
      });
      Analytics.todoCreated(newTaskSubject);
      setNewTaskTitle('');
      setNewTaskSubject('');
      setNewTaskDueDate(null);
      setShowAddTask(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      await tasksAPI.updateTask(task.id, { is_completed: !task.is_completed });
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteTask = (task: Task) => {
    Alert.alert(
      'Delete To-Do',
      `Are you sure you want to delete "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tasksAPI.deleteTask(task.id);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleHatch = async () => {
    try {
      const result = await animalsAPI.hatchEgg();
      if (result.success && result.animal) {
        setHatchedAnimal(result.animal);
        setShowConfetti(true);
        setShowHatchModal(true);
      } else {
        Alert.alert('Not Ready', result.message);
      }
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const closeHatchModal = () => {
    setShowHatchModal(false);
    setShowConfetti(false);
    setHatchedAnimal(null);
  };

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {showConfetti && (
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: width / 2, y: -20 }}
          autoStart
          fadeOut
        />
      )}
      
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
        {/* Hero Card — header, chips, egg & CTA */}
        <View style={styles.heroCard}>
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.greeting} numberOfLines={1}>Hello, {user?.username || 'Friend'}!</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={handleOpenTips}
              >
                <Text style={styles.profileButtonEmoji}>💡</Text>
                {!hasSeenTips && (
                  <Animated.View style={[styles.tipsDot, { transform: [{ scale: tipsPulse }] }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                {profilePic ? (
                  <Image source={{ uri: profilePic }} style={styles.profileButtonImage} />
                ) : (
                  <Text style={styles.profileButtonEmoji}>👤</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* User Stats Pills */}
          <View style={styles.statsPills}>
            <TouchableOpacity style={styles.statPillWrap} onPress={() => setShowStreakModal(true)}>
              <LinearGradient
                colors={['#FFFFFF', '#D0E2D5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statPillGradient}
              >
                <Text style={styles.statPillIcon}>🔥</Text>
                <Text style={styles.statPillText}>{stats?.current_streak || 0}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPillWrap} onPress={() => navigation.navigate('Sanctuary')}>
              <LinearGradient
                colors={['#FFFFFF', '#D0E2D5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statPillGradient}
              >
                <Text style={styles.statPillIcon}>🐾</Text>
                <Text style={styles.statPillText}>{stats?.animals_hatched || 0}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPillWrap} onPress={() => setShowBadgesModal(true)}>
              <LinearGradient
                colors={['#FFFFFF', '#D0E2D5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statPillGradient}
              >
                <Text style={styles.statPillIcon}>🏅</Text>
                <Text style={styles.statPillText}>
                  {badges.filter(b => b.earned).length}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPillWrap} onPress={() => setShowStudyTimeModal(true)}>
              <LinearGradient
                colors={['#FFFFFF', '#D0E2D5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statPillGradient}
              >
                <Text style={styles.statPillIcon}>📖</Text>
                <Text style={styles.statPillText}>
                  {stats?.weekly_study_minutes
                    ? Math.floor((Array.isArray(stats.weekly_study_minutes) ? stats.weekly_study_minutes.reduce((a: number, b: number) => a + b, 0) : 0) / 60)
                    : 0}h
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Egg Section nestled in Cozy Nest */}
          <View style={styles.eggSection}>
            <EggInNest />
          </View>
          
          {/* Study Button - Below the egg */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.hatchButton}
              onPress={() => navigation.navigate('Timer')}
              activeOpacity={0.8}
            >
              <Text style={styles.hatchButtonIcon}>🕐</Text>
              <Text style={styles.hatchButtonText}>STUDY TO HATCH ME</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Shared Egg Progress Card */}
        {activeSharedEgg && activeSharedEgg.status === 'active' && (
          <TouchableOpacity
            style={styles.sharedEggCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Timer')}
          >
            <View style={styles.sharedEggCardHeader}>
              <Text style={{ fontSize: 18 }}>💚</Text>
              <Text style={styles.sharedEggCardTitle}>
                Hatching with {activeSharedEgg.creator.id === user?.id ? activeSharedEgg.partner.username : activeSharedEgg.creator.username}
              </Text>
            </View>
            <Text style={styles.sharedEggCardAnimal}>{activeSharedEgg.animal_name}</Text>
            <View style={styles.sharedEggCardBar}>
              <View style={[styles.sharedEggCardBarFill, { width: `${activeSharedEgg.progress_percent}%` }]} />
            </View>
            <Text style={styles.sharedEggCardProgress}>
              {activeSharedEgg.creator_minutes + activeSharedEgg.partner_minutes} / {activeSharedEgg.minutes_required} min · {Math.round(activeSharedEgg.progress_percent)}%
            </Text>
          </TouchableOpacity>
        )}

        {/* Recent Hatches Section - Nestled in Nature Landscape */}
        <View style={styles.recentHatchesSection}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>My recent hatches</Text>
          <View style={styles.landscapeWrapper}>
            <NatureLandscape />
            <View style={styles.recentHatchesOverlay}>
              {[0, 1, 2].map((i) => (
                <RecentHatchCard key={i} animal={recentAnimals[i]} />
              ))}
            </View>
          </View>
        </View>

        {/* To-Do Section */}
        <View style={styles.todoSection}>
          <Text style={styles.todoTitle}>To-do</Text>
          
          {/* Task List */}
          {pendingTasks.length === 0 ? (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyText}>No tasks yet. Add one below!</Text>
            </View>
          ) : (
            pendingTasks.map((task) => (
              <View key={task.id} style={styles.taskItem}>
                <TouchableOpacity
                  style={styles.taskDeleteBtn}
                  onPress={() => deleteTask(task)}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                >
                  <Text style={styles.taskDeleteText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.description ? (
                    <Text style={styles.taskSubtitle}>{task.description}</Text>
                  ) : null}
                  {task.due_date ? (
                    <Text style={styles.taskDue}>📅 Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.taskCheckbox}
                  onPress={() => toggleTask(task)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {task.is_completed && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Create New To-Do Button */}
          <TouchableOpacity 
            style={styles.createButtonWrap}
            onPress={() => setShowAddTask(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F2F8F4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButton}
            >
              <Text style={styles.createButtonIcon}>+</Text>
              <Text style={styles.createButtonText}>CREATE NEW TO-DO</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* See Completed Button */}
          <TouchableOpacity 
            style={styles.completedButton}
            onPress={() => setShowCompleted(!showCompleted)}
          >
            <Text style={styles.completedButtonIcon}>✓</Text>
            <Text style={styles.completedButtonText}>
              {showCompleted ? 'HIDE COMPLETED TO-DOS' : 'SEE COMPLETED TO-DOS'}
            </Text>
          </TouchableOpacity>

          {/* Completed Tasks */}
          {showCompleted && (
            <View style={styles.completedSection}>
              {completedTasks.length === 0 ? (
                <Text style={styles.emptyText}>No completed tasks yet.</Text>
              ) : (
                completedTasks.map((task) => (
                  <View key={task.id} style={[styles.taskItem, styles.taskItemCompleted]}>
                    <TouchableOpacity
                      style={styles.taskDeleteBtn}
                      onPress={() => deleteTask(task)}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                      <Text style={styles.taskDeleteText}>✕</Text>
                    </TouchableOpacity>
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, styles.taskTitleCompleted]}>
                        {task.title}
                      </Text>
                      {task.description ? (
                        <Text style={[styles.taskSubtitle, { opacity: 0.6 }]}>{task.description}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.taskCheckbox, styles.taskCheckboxCompleted]}
                      onPress={() => toggleTask(task)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={styles.checkmarkCompleted}>✓</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={showAddTask} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowAddTask(false); setShowAddSubject(false); setShowDatePicker(false); setNewTaskDueDate(null); }}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <DragHandle />
        <View style={styles.addTaskHeader}>
          <TouchableOpacity
            onPress={() => {
              setShowAddTask(false);
              setShowAddSubject(false);
              setShowDatePicker(false);
              setNewTaskDueDate(null);
            }}
          >
            <Text style={styles.addTaskHeaderCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.addTaskHeaderTitle}>New To-Do</Text>
          <TouchableOpacity onPress={addTask}>
            <Text style={styles.addTaskHeaderSave}>Add Task</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
              
              <Text style={styles.inputLabel}>Task Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="What do you need to do?"
                placeholderTextColor={colors.textMuted}
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
              />
              
              <Text style={styles.inputLabel}>Subject</Text>
              <View style={styles.subjectGrid}>
                {subjects.map((subject) => (
                  <View key={subject} style={[
                    styles.subjectChip,
                    newTaskSubject === subject && styles.subjectChipActive,
                  ]}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setNewTaskSubject(newTaskSubject === subject ? '' : subject)}
                    >
                      <Text style={[
                        styles.subjectChipText,
                        newTaskSubject === subject && styles.subjectChipTextActive,
                      ]}>
                        {subject}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.subjectRemoveBtn}
                      onPress={() => {
                        Alert.alert(
                          'Remove Subject',
                          `Remove "${subject}" from your subjects?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', onPress: () => removeSubject(subject), style: 'destructive' },
                          ]
                        );
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={[styles.subjectRemoveText, newTaskSubject === subject && { color: 'rgba(255,255,255,0.6)' }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addSubjectChip}
                  onPress={() => setShowAddSubject(true)}
                >
                  <Text style={styles.addSubjectChipText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {showAddSubject && (
                <View style={styles.addSubjectRow}>
                  <TextInput
                    style={styles.addSubjectInput}
                    placeholder="New subject name"
                    placeholderTextColor={colors.textMuted}
                    value={newSubjectName}
                    onChangeText={setNewSubjectName}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.addSubjectButton} onPress={addNewSubject}>
                    <Text style={styles.addSubjectButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Due Date (optional)</Text>
              <View style={styles.dueDateRow}>
                <TouchableOpacity
                  style={styles.dueDateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dueDateButtonIcon}>📅</Text>
                  <Text style={styles.dueDateButtonText}>
                    {newTaskDueDate
                      ? newTaskDueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Select a due date'}
                  </Text>
                </TouchableOpacity>
                {newTaskDueDate && (
                  <TouchableOpacity onPress={() => setNewTaskDueDate(null)}>
                    <Text style={styles.dueDateClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={newTaskDueDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setNewTaskDueDate(selectedDate);
                  }}
                  accentColor={colors.primary}
                />
              )}

          </ScrollView>
        </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Hatch Celebration Modal */}
      <Modal visible={showHatchModal} transparent animationType="fade">
        <TouchableOpacity style={styles.hatchModalOverlay} activeOpacity={1} onPress={closeHatchModal}>
          <TouchableOpacity activeOpacity={1} style={styles.hatchModalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={closeHatchModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.hatchModalTitle}>
              Congrats {user?.username || 'you'}, you've{'\n'}completed{'\n'}your task!!
            </Text>
            
            <View style={styles.hatchAnimalContainer}>
              <View style={styles.hatchEggShell}>
                <Text style={styles.hatchAnimalEmoji}>🐘</Text>
              </View>
            </View>
            
            <Text style={styles.hatchModalSubtitle}>
              And hatched a{'\n'}cute {hatchedAnimal?.name || 'Animal'} :)
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Eco-Credits Info Modal */}
      <Modal visible={showEcoModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEcoModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TouchableOpacity 
              style={styles.streakModalClose}
              onPress={() => setShowEcoModal(false)}
            >
              <Text style={styles.streakModalCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.streakHeader}>
              <Text style={styles.streakFireEmoji}>🍀</Text>
              <Text style={styles.streakBigNumber}>{stats?.current_coins || 0}</Text>
              <Text style={styles.streakDaysLabel}>eco-credits</Text>
            </View>

            <View style={styles.streakStatsGrid}>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.total_coins || 0}</Text>
                <Text style={styles.streakStatLabel}>Total Earned</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.total_sessions || 0}</Text>
                <Text style={styles.streakStatLabel}>Study Sessions</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.animals_hatched || 0}</Text>
                <Text style={styles.streakStatLabel}>Animals Hatched</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>
                  {formatStudyTime(stats?.total_study_minutes || 0)}
                </Text>
                <Text style={styles.streakStatLabel}>Total Study Time</Text>
              </View>
            </View>

            <View style={styles.ecoInfoCard}>
              <Text style={styles.ecoInfoTitle}>What are eco-credits?</Text>
              <Text style={styles.ecoInfoText}>
                Eco-credits are earned every time you complete a study session. The longer you study, the more you earn! Spend them in the Sanctuary Shop on habitats, paths, and accessories for your animals.
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.shopLinkButton}
              onPress={() => { setShowEcoModal(false); navigation.navigate('Shop'); }}
            >
              <Text style={styles.shopLinkEmoji}>🛍️</Text>
              <Text style={styles.shopLinkText}>Visit Sanctuary Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.streakCloseButton}
              onPress={() => setShowEcoModal(false)}
            >
              <Text style={styles.streakCloseButtonText}>Got it!</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Badges Modal */}
      <Modal visible={showBadgesModal} transparent animationType="fade">
        <View style={styles.badgesModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowBadgesModal(false)} />
          <View style={styles.badgesModalContent}>
            <TouchableOpacity
              style={styles.streakModalClose}
              onPress={() => setShowBadgesModal(false)}
            >
              <Text style={styles.streakModalCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.streakHeader}>
              <Text style={styles.streakFireEmoji}>🏅</Text>
              <Text style={styles.streakBigNumber}>
                {badges.filter(b => b.earned).length}
              </Text>
              <Text style={styles.streakDaysLabel}>
                of {badges.length} badges earned
              </Text>
            </View>

            <View style={styles.badgesProgressBar}>
              <View style={styles.badgesProgressTrack}>
                <View
                  style={[
                    styles.badgesProgressFill,
                    {
                      width: badges.length > 0
                        ? `${(badges.filter(b => b.earned).length / badges.length) * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
            </View>

            <ScrollView
              style={styles.badgesScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={true}
            >
              {badges.filter(b => b.earned).length === 0 ? (
                <View style={styles.badgesEmptyState}>
                  <Text style={styles.badgesEmptyIcon}>🔒</Text>
                  <Text style={styles.badgesEmptyText}>
                    Complete study sessions to start earning badges!
                  </Text>
                </View>
              ) : (
                <View style={styles.badgesGrid}>
                  {badges.filter(b => b.earned).map(b => (
                    <View key={b.id} style={styles.badgeItem}>
                      <Text style={styles.badgeItemIcon}>{b.icon}</Text>
                      <Text style={styles.badgeItemName}>
                        {b.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={{ paddingVertical: 12, paddingHorizontal: 24 }}
              onPress={() => setShowBadgesModal(false)}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#5E7F6E' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Streak Details Modal */}
      <Modal visible={showStreakModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStreakModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TouchableOpacity 
              style={styles.streakModalClose}
              onPress={() => setShowStreakModal(false)}
            >
              <Text style={styles.streakModalCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.streakHeader}>
              <Text style={styles.streakFireEmoji}>🔥</Text>
              <Text style={styles.streakBigNumber}>{stats?.current_streak || 0}</Text>
              <Text style={styles.streakDaysLabel}>day streak</Text>
            </View>

            <View style={styles.streakStatsGrid}>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.longest_streak || 0}</Text>
                <Text style={styles.streakStatLabel}>Longest Streak</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>
                  {formatStudyTime(stats?.total_study_minutes || 0)}
                </Text>
                <Text style={styles.streakStatLabel}>Total Study Time</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.total_sessions || 0}</Text>
                <Text style={styles.streakStatLabel}>Study Sessions</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.total_coins || 0}</Text>
                <Text style={styles.streakStatLabel}>Total Eco-Credits</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.tasks_completed || 0}</Text>
                <Text style={styles.streakStatLabel}>Tasks Completed</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>
                  {stats?.weekly_study_minutes ? Math.floor((Array.isArray(stats.weekly_study_minutes) ? stats.weekly_study_minutes.reduce((a: number, b: number) => a + b, 0) : 0) / 60) : 0}h
                </Text>
                <Text style={styles.streakStatLabel}>This Week</Text>
              </View>
            </View>

            <View style={styles.streakMotivation}>
              <Text style={styles.streakMotivationText}>
                {stats?.current_streak && stats.current_streak > 0 
                  ? "Keep it up! You're on fire! 🔥"
                  : "Start studying today to begin your streak!"}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.streakCloseButton}
              onPress={() => setShowStreakModal(false)}
            >
              <Text style={styles.streakCloseButtonText}>Got it!</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Study Time Statistics Modal */}
      <Modal visible={showStudyTimeModal} transparent animationType="fade">
        <View style={styles.studyTimeModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowStudyTimeModal(false)} />
          <View style={styles.studyTimeModalContent}>
            <TouchableOpacity
              style={styles.studyTimeClose}
              onPress={() => setShowStudyTimeModal(false)}
            >
              <Text style={styles.streakModalCloseText}>✕</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.studyTimeHeader}>
                <Text style={{ fontSize: 36 }}>📖</Text>
                <Text style={styles.studyTimeBigNumber}>
                  {stats?.weekly_study_minutes
                    ? Math.floor((Array.isArray(stats.weekly_study_minutes) ? stats.weekly_study_minutes.reduce((a: number, b: number) => a + b, 0) : 0) / 60)
                    : 0}h {stats?.weekly_study_minutes
                    ? (Array.isArray(stats.weekly_study_minutes) ? stats.weekly_study_minutes.reduce((a: number, b: number) => a + b, 0) : 0) % 60
                    : 0}m
                </Text>
                <Text style={styles.studyTimeSubLabel}>studied this week</Text>
              </View>

              <View style={styles.weeklyChart}>
                <Text style={styles.weeklyChartTitle}>Daily Breakdown</Text>
                <View style={styles.weeklyBars}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                    const mins = Array.isArray(stats?.weekly_study_minutes) ? (stats.weekly_study_minutes[i] || 0) : 0;
                    const maxMins = Array.isArray(stats?.weekly_study_minutes)
                      ? Math.max(...stats.weekly_study_minutes, 1)
                      : 1;
                    const barHeight = Math.max((mins / maxMins) * 60, 4);
                    const today = new Date().getDay();
                    const dayIdx = today === 0 ? 6 : today - 1;
                    return (
                      <View key={day} style={styles.weeklyBarCol}>
                        <Text style={styles.weeklyBarMins}>{mins > 0 ? `${mins}m` : ''}</Text>
                        <View style={[
                          styles.weeklyBar,
                          { height: barHeight },
                          i === dayIdx && styles.weeklyBarToday,
                        ]} />
                        <Text style={[styles.weeklyBarLabel, i === dayIdx && styles.weeklyBarLabelToday]}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.studyTimeStatsGrid}>
                <View style={styles.studyTimeStatItem}>
                  <Text style={styles.studyTimeStatValue}>
                    {formatStudyTime(stats?.total_study_minutes || 0)}
                  </Text>
                  <Text style={styles.studyTimeStatLabel}>All Time</Text>
                </View>
                <View style={styles.studyTimeStatItem}>
                  <Text style={styles.studyTimeStatValue}>{stats?.total_sessions || 0}</Text>
                  <Text style={styles.studyTimeStatLabel}>Total Sessions</Text>
                </View>
                <View style={styles.studyTimeStatItem}>
                  <Text style={styles.studyTimeStatValue}>
                    {stats?.total_study_minutes && stats?.total_sessions
                      ? Math.round(stats.total_study_minutes / stats.total_sessions)
                      : 0}m
                  </Text>
                  <Text style={styles.studyTimeStatLabel}>Avg per Session</Text>
                </View>
                <View style={styles.studyTimeStatItem}>
                  <Text style={styles.studyTimeStatValue}>{stats?.current_streak || 0}</Text>
                  <Text style={styles.studyTimeStatLabel}>Current Streak</Text>
                </View>
              </View>

              {stats?.study_minutes_by_subject && Object.keys(stats.study_minutes_by_subject).length > 0 && (
                <View style={styles.subjectBreakdown}>
                  <Text style={styles.weeklyChartTitle}>By Subject</Text>
                  {Object.entries(stats.study_minutes_by_subject)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([subject, mins]) => {
                      const totalMins = Object.values(stats.study_minutes_by_subject).reduce((a, b) => a + b, 0);
                      const pct = totalMins > 0 ? (mins / totalMins) * 100 : 0;
                      return (
                        <View key={subject} style={styles.subjectRow}>
                          <Text style={styles.subjectName} numberOfLines={1}>{subject}</Text>
                          <View style={styles.subjectBarBg}>
                            <View style={[styles.subjectBarFill, { width: `${Math.max(pct, 3)}%` }]} />
                          </View>
                          <Text style={styles.subjectMins}>{Math.floor(mins / 60)}h {mins % 60}m</Text>
                        </View>
                      );
                    })}
                </View>
              )}

              <TouchableOpacity 
                style={styles.studyTimeCloseButton}
                onPress={() => setShowStudyTimeModal(false)}
              >
                <Text style={styles.streakCloseButtonText}>Got it!</Text>
              </TouchableOpacity>
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
    backgroundColor: '#E8F5E9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: '#C5DEC9',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 24,
    paddingBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
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
  tipsDot: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileButtonImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  statsPills: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    zIndex: 20,
  },
  statPillWrap: {
    flex: 1,
    marginHorizontal: 3,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  statPillIcon: {
    fontSize: 14,
  },
  statPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D3B36',
  },
  eggSection: {
    alignItems: 'center',
    marginTop: -28,
    paddingBottom: 0,
  },
  eggNestContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 270,
    width: 310,
  },
  eggWrapper: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  nestEmoji: {
    fontSize: 170,
    position: 'absolute',
    bottom: -36,
    textAlign: 'center',
    opacity: 0.92,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  hatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B8F71',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: spacing.sm,
    shadowColor: '#4A6B50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  hatchButtonReady: {
    backgroundColor: colors.success,
  },
  hatchButtonIcon: {
    fontSize: 18,
  },
  hatchButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sharedEggCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(95, 140, 135, 0.25)',
    ...shadows.small,
  },
  sharedEggCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sharedEggCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sharedEggCardAnimal: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  sharedEggCardBar: {
    height: 8,
    backgroundColor: 'rgba(95, 140, 135, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  sharedEggCardBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  sharedEggCardProgress: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  recentHatchesSection: {
    marginTop: spacing.sm,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: 11,
  },
  landscapeContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  landscapeLottie: {
    width: '100%',
    height: 240,
    position: 'absolute',
    top: -48,
    left: 0,
  },
  landscapeWrapper: {
    position: 'relative',
    height: 224,
    overflow: 'hidden',
    backgroundColor: '#E8F5E9',
  },
  recentHatchesOverlay: {
    position: 'absolute',
    bottom: 49,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  recentHatches: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  recentHatchCard: {
    width: 110,
    height: 130,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  recentHatchContent: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    height: 125,
  },
  recentHatchEmoji: {
    fontSize: 50,
    marginBottom: 10,
    zIndex: 2,
  },
  recentHatchImage: {
    width: 90,
    height: 90,
    zIndex: 2,
    marginBottom: 8,
  },
  recentHatchPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 130,
    opacity: 1,
  },
  placeholderEmoji: {
    fontSize: 70,
    marginBottom: 0,
    zIndex: 2,
  },
  placeholderText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  todoSection: {
    marginTop: spacing.lg - 26,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 24,
    minHeight: 400,
  },
  todoTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textOnPrimary,
    marginBottom: spacing.lg,
  },
  emptyTasks: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  taskItemCompleted: {
    opacity: 0.6,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textOnPrimary,
    marginBottom: 2,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  taskDue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  taskDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    opacity: 0.5,
  },
  taskDeleteText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCheckboxCompleted: {
    backgroundColor: colors.textOnPrimary,
    borderColor: colors.textOnPrimary,
  },
  checkmark: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  checkmarkCompleted: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  createButtonWrap: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '85%',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: spacing.sm,
  },
  createButtonIcon: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  completedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: spacing.sm,
    gap: spacing.sm,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedButtonIcon: {
    fontSize: 16,
    color: colors.textOnPrimary,
  },
  completedButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  completedSection: {
    marginTop: spacing.md,
  },

  // Take Action CTA
  takeActionWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#2F4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  takeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  takeActionEmoji: {
    fontSize: 30,
  },
  takeActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  takeActionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 2,
  },
  takeActionArrow: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  addTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  addTaskHeaderCancel: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  addTaskHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addTaskHeaderSave: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  subjectRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectRemoveText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  subjectChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subjectChipTextActive: {
    color: colors.textOnPrimary,
  },
  addSubjectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addSubjectChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  addSubjectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addSubjectInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addSubjectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  addSubjectButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  subjectHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dueDateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  dueDateButtonIcon: {
    fontSize: 16,
  },
  dueDateButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dueDateClear: {
    fontSize: 18,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalButtonSave: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalButtonSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  hatchModalOverlay: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  hatchModalContent: {
    alignItems: 'center',
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: -80,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textOnPrimary,
  },
  hatchModalTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textOnPrimary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xl,
    lineHeight: 42,
  },
  hatchAnimalContainer: {
    marginVertical: spacing.xl,
  },
  hatchEggShell: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  hatchAnimalEmoji: {
    fontSize: 100,
  },
  hatchModalSubtitle: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textOnPrimary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 38,
  },
  // Streak Modal Styles
  streakModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 20,
  },
  streakModalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  streakModalCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  streakHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  streakFireEmoji: {
    fontSize: 60,
    marginBottom: spacing.sm,
  },
  streakBigNumber: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 80,
  },
  streakDaysLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: -4,
  },
  streakStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  streakStatItem: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  streakStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  streakStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  streakMotivation: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  streakMotivationText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  streakCloseButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.small,
  },
  streakCloseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  ecoInfoCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  ecoInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  ecoInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  shopLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: spacing.sm,
    gap: 8,
  },
  shopLinkEmoji: {
    fontSize: 18,
  },
  shopLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  badgesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    width: '90%',
    maxHeight: '85%',
    alignItems: 'center',
    ...shadows.large,
  },
  badgesProgressBar: {
    width: '100%',
    marginBottom: spacing.md,
  },
  badgesProgressTrack: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  badgesProgressFill: {
    height: '100%',
    backgroundColor: '#E8B86D',
    borderRadius: 4,
  },
  badgesScrollView: {
    width: '100%',
    maxHeight: 500,
    marginBottom: spacing.md,
  },
  badgesGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 2,
  },
  badgeItem: {
    width: '31%' as any,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: '#E7EFEA',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#A9BDAF40',
    marginBottom: spacing.sm,
  },
  badgeItemIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeItemName: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    textAlign: 'center' as const,
  },
  badgesEmptyState: {
    alignItems: 'center' as const,
    paddingVertical: spacing.xl,
  },
  badgesEmptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  badgesEmptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center' as const,
  },

  // Study Time Modal
  studyTimeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  studyTimeModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    width: '100%',
    maxHeight: '75%',
  },
  studyTimeClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studyTimeHeader: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  studyTimeBigNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  studyTimeSubLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  studyTimeStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  studyTimeStatItem: {
    width: '47%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: 10,
    alignItems: 'center',
  },
  studyTimeStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  studyTimeStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  studyTimeCloseButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  weeklyChart: {
    width: '100%',
    marginBottom: spacing.md,
  },
  weeklyChartTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  weeklyBars: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    height: 90,
    paddingBottom: 4,
  },
  weeklyBarCol: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  weeklyBarMins: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: colors.textMuted,
    marginBottom: 4,
  },
  weeklyBar: {
    width: 20,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  },
  weeklyBarToday: {
    backgroundColor: colors.primary,
  },
  weeklyBarLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.textMuted,
    marginTop: 6,
  },
  weeklyBarLabelToday: {
    fontWeight: '700' as const,
    color: colors.primary,
  },
  subjectBreakdown: {
    width: '100%',
    marginBottom: spacing.md,
  },
  subjectRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  subjectName: {
    width: 70,
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  subjectBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: colors.cardBorder,
    borderRadius: 5,
    overflow: 'hidden' as const,
    marginHorizontal: 8,
  },
  subjectBarFill: {
    height: '100%' as const,
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  subjectMins: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textMuted,
    width: 52,
    textAlign: 'right' as const,
  },
});
