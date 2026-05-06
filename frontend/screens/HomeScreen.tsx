import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  AppState,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Text, TextInput } from '../components/StyledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import DateTimePicker from '@react-native-community/datetimepicker';
import LottieView from 'lottie-react-native';
import { spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from '../services/analytics';
import { useDeviceLayout } from '../utils/useDeviceLayout';

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
import {
  animalsAPI, tasksAPI, statsAPI, subjectsAPI, feedbackAPI, researchAPI,
  Egg, Task, UserStats, UserAnimal, Subject, ResearchSurveyPayload,
} from '../services/api';
import { feedbackNavigation } from '../services/feedbackNavigation';
import { animalImages, getAnimalImage } from '../assets/animals';
import FeedbackModal from '../components/FeedbackModal';
import ResearchSurveyModal from '../components/ResearchSurveyModal';

const RESEARCH_PROMPT_SNOOZE_KEY = 'researchPromptSnoozeUntil';

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

// Egg nestled in a large 🪹 emoji nest. Tapping the egg jumps to the Timer
// screen — same destination as the "Study to hatch me" button below it, so
// either affordance gets the user studying.
const EggInNest = ({ onPress }: { onPress?: () => void }) => (
  <TouchableOpacity
    style={styles.eggNestContainer}
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel="Start a study session to hatch your egg"
  >
    <View style={styles.eggWrapper}>
      <LottieView
        source={require('../assets/egg-animation.json')}
        autoPlay
        loop
        style={{ width: 230, height: 230 }}
      />
    </View>
    <Text style={styles.nestEmoji}>🪹</Text>
  </TouchableOpacity>
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
  const route = useRoute<any>();
  // Device-aware layout: iPad-class screens get a centred, capped-width
  // content column so cards don't stretch across a 1024pt landscape iPad.
  // Phones get the unchanged full-width experience.
  const { width: layoutWidth, isTablet, horizontalGutter } = useDeviceLayout();
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackThreadId, setFeedbackThreadId] = useState<number | undefined>();
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<Subject[]>([]);
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const subjectSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [showEditTask, setShowEditTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskSubject, setEditTaskSubject] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState<Date | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [hatchStage, setHatchStage] = useState(0);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [researchMode, setResearchMode] = useState<'consent' | 'survey'>('consent');
  const [researchCopy, setResearchCopy] = useState<{ title?: string; body?: string } | undefined>();
  const [researchSurvey, setResearchSurvey] = useState<ResearchSurveyPayload | null>(null);
  const [researchAssignmentId, setResearchAssignmentId] = useState<number | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const researchPromptedThisSession = useRef(false);
  const confettiRef = useRef<any>(null);
  const eggWobble = useRef(new Animated.Value(0)).current;
  const eggScale = useRef(new Animated.Value(1)).current;
  const eggOpacity = useRef(new Animated.Value(1)).current;
  const animalRevealScale = useRef(new Animated.Value(0)).current;

  const loadSubjects = async () => {
    try {
      const subs = await subjectsAPI.getMySubjects();
      setSubjects(subs);
    } catch (e) {
      if (__DEV__) console.log('Failed to load subjects');
    }
  };

  useEffect(() => { loadSubjects(); }, [user?.id]);

  const checkResearchPrompt = useCallback(async () => {
    if (!user || researchPromptedThisSession.current) return;
    const snoozeUntil = await SecureStore.getItemAsync(RESEARCH_PROMPT_SNOOZE_KEY).catch(() => null);
    if (snoozeUntil) {
      const ts = Date.parse(snoozeUntil);
      if (!Number.isNaN(ts) && ts > Date.now()) return;
    }
    try {
      const next = await researchAPI.getNextSurvey();
      if (next.needs_consent) {
        setResearchMode('consent');
        setResearchCopy(next.copy);
        setResearchSurvey(null);
        setResearchAssignmentId(null);
        setShowResearchModal(true);
        researchPromptedThisSession.current = true;
        return;
      }
      if (next.assignment?.id && next.survey) {
        setResearchMode('survey');
        setResearchCopy(undefined);
        setResearchSurvey(next.survey);
        setResearchAssignmentId(next.assignment.id);
        setShowResearchModal(true);
        researchPromptedThisSession.current = true;
        try { await researchAPI.startSurvey(next.assignment.id); } catch {}
      }
    } catch {
      // Silent fail to avoid interrupting core app flow
    }
  }, [user?.id]);

  const refreshFeedbackUnread = useCallback(async () => {
    if (!user) {
      setFeedbackUnread(0);
      return;
    }
    try {
      const r = await feedbackAPI.unreadCount();
      setFeedbackUnread(r.unread_count);
    } catch {
      setFeedbackUnread(0);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      const tid = route.params?.openFeedbackThreadId;
      if (tid != null && tid !== '') {
        setFeedbackThreadId(Number(tid));
        setShowFeedback(true);
        try {
          navigation.setParams({ openFeedbackThreadId: undefined } as never);
        } catch {
          /* ignore */
        }
      }
      void refreshFeedbackUnread();
      const interval = setInterval(() => void refreshFeedbackUnread(), 30000);
      void checkResearchPrompt();
      return () => clearInterval(interval);
    }, [route.params?.openFeedbackThreadId, navigation, refreshFeedbackUnread, checkResearchPrompt])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshFeedbackUnread();
    });
    return () => sub.remove();
  }, [refreshFeedbackUnread]);

  useEffect(() => {
    feedbackNavigation.refreshFeedbackUnread = () => void refreshFeedbackUnread();
    return () => {
      feedbackNavigation.refreshFeedbackUnread = null;
    };
  }, [refreshFeedbackUnread]);

  const handleSubjectSearch = (text: string) => {
    setNewSubjectName(text);
    if (subjectSearchTimeout.current) clearTimeout(subjectSearchTimeout.current);
    if (text.trim().length < 1) {
      setSubjectSuggestions([]);
      setShowSubjectSuggestions(false);
      return;
    }
    subjectSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await subjectsAPI.search(text.trim());
        const myIds = new Set(subjects.map(s => s.id));
        const filtered = results.filter(s => !myIds.has(s.id));
        setSubjectSuggestions(filtered);
        setShowSubjectSuggestions(filtered.length > 0);
      } catch {
        setSubjectSuggestions([]);
        setShowSubjectSuggestions(false);
      }
    }, 250);
  };

  const selectSubjectSuggestion = async (subject: Subject) => {
    try {
      await subjectsAPI.addSubject(subject.id);
      await loadSubjects();
      setNewSubjectName('');
      setSubjectSuggestions([]);
      setShowSubjectSuggestions(false);
      setShowAddSubject(false);
    } catch (e) {}
  };

  const addNewSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) return;
    try {
      await subjectsAPI.createCustom(name);
      await loadSubjects();
      setNewSubjectName('');
      setSubjectSuggestions([]);
      setShowSubjectSuggestions(false);
      setShowAddSubject(false);
    } catch (e) {}
  };

  const removeSubject = async (sub: Subject) => {
    try {
      await subjectsAPI.removeSubject(sub.id);
      setSubjects(prev => prev.filter(s => s.id !== sub.id));
    } catch (e) {}
  };

  const loadData = async () => {
    try {
      const [eggData, tasksData, statsData, animalsData] = await Promise.all([
        animalsAPI.getEgg(),
        tasksAPI.getTasks(true),
        statsAPI.getStats(),
        animalsAPI.getMyAnimals().catch(() => []),
      ]);
      
      setEgg(eggData);
      setTasks(tasksData);
      setStats(statsData);
      setRecentAnimals(animalsData.slice(0, 3));

      loadSubjects();
    } catch (error) {
      if (__DEV__) console.error('Failed to load data:', error);
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

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskSubject(task.description || '');
    setEditTaskDueDate(task.due_date ? new Date(task.due_date) : null);
    setShowEditDatePicker(false);
    setShowEditTask(true);
  };

  const saveEditTask = async () => {
    if (!editingTask || !editTaskTitle.trim()) return;
    try {
      await tasksAPI.updateTask(editingTask.id, {
        title: editTaskTitle.trim(),
        description: editTaskSubject.trim() || null,
        due_date: editTaskDueDate ? editTaskDueDate.toISOString().split('T')[0] : null,
      } as any);
      setShowEditTask(false);
      setEditingTask(null);
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
        setHatchStage(0);
        eggWobble.setValue(0);
        eggScale.setValue(1);
        eggOpacity.setValue(1);
        animalRevealScale.setValue(0);
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

  const handleEggTap = () => {
    if (hatchStage >= 3) return;
    const next = hatchStage + 1;
    setHatchStage(next);

    const intensity = next * 6;
    Animated.sequence([
      Animated.timing(eggWobble, { toValue: intensity, duration: 60, useNativeDriver: true }),
      Animated.timing(eggWobble, { toValue: -intensity, duration: 60, useNativeDriver: true }),
      Animated.timing(eggWobble, { toValue: intensity * 0.6, duration: 50, useNativeDriver: true }),
      Animated.timing(eggWobble, { toValue: -intensity * 0.6, duration: 50, useNativeDriver: true }),
      Animated.timing(eggWobble, { toValue: intensity * 0.3, duration: 40, useNativeDriver: true }),
      Animated.timing(eggWobble, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();

    if (next === 3) {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(eggOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(eggScale, { toValue: 1.4, duration: 400, useNativeDriver: true }),
          Animated.spring(animalRevealScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        ]).start();
      }, 350);
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
          origin={{ x: layoutWidth / 2, y: -20 }}
          autoStart
          fadeOut
        />
      )}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          // On iPad: side-pad the scroll content so the inner cards land
          // in a comfortable 720pt centred column rather than spanning
          // the full 1024-1366pt iPad surface. Existing card-level
          // marginHorizontal continues to apply WITHIN this column.
          isTablet && { paddingHorizontal: horizontalGutter },
        ]}
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
          {/* Feedback button — sits to the left of the profile pic */}
          <View style={styles.feedbackButtonWrap}>
            <TouchableOpacity
              style={styles.feedbackButtonInner}
              onPress={() => setShowFeedback(true)}
              accessibilityLabel="Send feedback"
              accessibilityRole="button"
            >
              <Text style={styles.feedbackButtonEmoji}>💬</Text>
            </TouchableOpacity>
            {feedbackUnread > 0 ? <View style={styles.feedbackUnreadDot} /> : null}
          </View>

          {/* Profile pic — top right corner */}
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

          {/* Brand */}
          <View style={styles.brandRow}>
            <Image source={require('../assets/icon.png')} style={styles.brandLogo} />
            <Text style={styles.brandName}>endura</Text>
          </View>

          {/* Greeting */}
          <View style={styles.headerSection}>
            <Text style={styles.greeting} numberOfLines={1}>Hello, {user?.username || 'Friend'}!</Text>
          </View>

          {/* Stats Chips */}
          <View style={styles.statsPills}>
            <View style={styles.statPillCol}>
              <View style={styles.statPillGlass}>
                <Text style={styles.statPillIcon}>🔥</Text>
                <Text style={styles.statPillText}>{stats?.current_streak || 0}</Text>
              </View>
              <Text style={styles.statPillLabel}>streak</Text>
            </View>
            <View style={styles.statPillCol}>
              <View style={styles.statPillGlass}>
                <Text style={styles.statPillIcon}>📖</Text>
                <Text style={styles.statPillText}>
                  {(() => {
                    const total = stats?.weekly_study_minutes
                      ? (Array.isArray(stats.weekly_study_minutes) ? stats.weekly_study_minutes.reduce((a: number, b: number) => a + b, 0) : 0)
                      : 0;
                    const h = Math.floor(total / 60);
                    const m = total % 60;
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                  })()}
                </Text>
              </View>
              <Text style={styles.statPillLabel}>this week</Text>
            </View>
            <View style={styles.statPillCol}>
              <View style={styles.statPillGlass}>
                <Text style={styles.statPillIcon}>🐾</Text>
                <Text style={styles.statPillText}>{stats?.animals_hatched || 0}</Text>
              </View>
              <Text style={styles.statPillLabel}>hatched</Text>
            </View>
          </View>

          {/* Egg Section nestled in Cozy Nest */}
          <View style={styles.eggSection}>
            <EggInNest onPress={() => navigation.navigate('Timer')} />
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
                <TouchableOpacity style={styles.taskInfo} onPress={() => openEditTask(task)} activeOpacity={0.7}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.description ? (
                    <Text style={styles.taskSubtitle}>{task.description}</Text>
                  ) : null}
                  {task.due_date ? (
                    <Text style={styles.taskDue}>📅 Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  ) : null}
                  <Text style={styles.taskEditHint}>tap to edit</Text>
                </TouchableOpacity>
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
                {subjects.map((sub) => (
                  <View key={sub.id} style={[
                    styles.subjectChip,
                    { paddingRight: 6 },
                    newTaskSubject === sub.display_name && styles.subjectChipActive,
                  ]}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setNewTaskSubject(newTaskSubject === sub.display_name ? '' : sub.display_name)}
                    >
                      <Text style={[
                        styles.subjectChipText,
                        newTaskSubject === sub.display_name && styles.subjectChipTextActive,
                      ]}>
                        {sub.display_name}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.subjectRemoveBtn}
                      onPress={() => {
                        Alert.alert(
                          'Remove Subject',
                          `Remove "${sub.display_name}" from your subjects?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', onPress: () => removeSubject(sub), style: 'destructive' },
                          ]
                        );
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={[styles.subjectRemoveText, newTaskSubject === sub.display_name && { color: 'rgba(255,255,255,0.6)' }]}>✕</Text>
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
                <View>
                  <View style={styles.addSubjectRow}>
                    <TextInput
                      style={styles.addSubjectInput}
                      placeholder="Search or add a subject..."
                      placeholderTextColor={colors.textMuted}
                      value={newSubjectName}
                      onChangeText={handleSubjectSearch}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.addSubjectButton} onPress={addNewSubject}>
                      <Text style={styles.addSubjectButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {showSubjectSuggestions && subjectSuggestions.length > 0 && (
                    <View style={styles.subjectSuggestions}>
                      <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {subjectSuggestions.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={styles.subjectSuggestionItem}
                            onPress={() => selectSubjectSuggestion(s)}
                          >
                            <Text style={styles.subjectSuggestionText}>{s.display_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
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

      {/* Edit Task Modal */}
      <Modal visible={showEditTask} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowEditTask(false); setShowEditDatePicker(false); setShowAddSubject(false); }}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <DragHandle />
        <View style={styles.addTaskHeader}>
          <TouchableOpacity onPress={() => { setShowEditTask(false); setShowEditDatePicker(false); setShowAddSubject(false); }}>
            <Text style={styles.addTaskHeaderCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.addTaskHeaderTitle}>Edit To-Do</Text>
          <TouchableOpacity onPress={saveEditTask}>
            <Text style={styles.addTaskHeaderSave}>Save</Text>
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
                value={editTaskTitle}
                onChangeText={setEditTaskTitle}
              />
              
              <Text style={styles.inputLabel}>Subject</Text>
              <View style={styles.subjectGrid}>
                {subjects.map((sub) => (
                  <View key={sub.id} style={[
                    styles.subjectChip,
                    editTaskSubject === sub.display_name && styles.subjectChipActive,
                  ]}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setEditTaskSubject(editTaskSubject === sub.display_name ? '' : sub.display_name)}
                    >
                      <Text style={[
                        styles.subjectChipText,
                        editTaskSubject === sub.display_name && styles.subjectChipTextActive,
                      ]}>
                        {sub.display_name}
                      </Text>
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
                <View>
                  <View style={styles.addSubjectRow}>
                    <TextInput
                      style={styles.addSubjectInput}
                      placeholder="Search or type a subject..."
                      placeholderTextColor={colors.textMuted}
                      value={newSubjectName}
                      onChangeText={handleSubjectSearch}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.addSubjectButton} onPress={addNewSubject}>
                      <Text style={styles.addSubjectButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {showSubjectSuggestions && subjectSuggestions.length > 0 && (
                    <View style={styles.subjectSuggestions}>
                      <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {subjectSuggestions.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={styles.subjectSuggestionItem}
                            onPress={() => selectSubjectSuggestion(s)}
                          >
                            <Text style={styles.subjectSuggestionText}>{s.display_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Due Date (optional)</Text>
              <View style={styles.dueDateRow}>
                <TouchableOpacity
                  style={styles.dueDateButton}
                  onPress={() => setShowEditDatePicker(true)}
                >
                  <Text style={styles.dueDateButtonIcon}>📅</Text>
                  <Text style={styles.dueDateButtonText}>
                    {editTaskDueDate
                      ? editTaskDueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Select a due date'}
                  </Text>
                </TouchableOpacity>
                {editTaskDueDate && (
                  <TouchableOpacity onPress={() => setEditTaskDueDate(null)}>
                    <Text style={styles.dueDateClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showEditDatePicker && (
                <DateTimePicker
                  value={editTaskDueDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowEditDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setEditTaskDueDate(selectedDate);
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
        <TouchableOpacity style={styles.hatchModalOverlay} activeOpacity={1} onPress={hatchStage >= 3 ? closeHatchModal : undefined}>
          <TouchableOpacity activeOpacity={1} style={styles.hatchModalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={closeHatchModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            
            {hatchStage < 3 ? (
              <Text style={styles.hatchModalTitle}>
                Congrats {user?.username || 'you'}!{'\n'}You've earned{'\n'}a new friend!
              </Text>
            ) : (
              <Text style={styles.hatchModalTitle}>
                Congrats {user?.username || 'you'}, you've{'\n'}completed{'\n'}your task!!
              </Text>
            )}
            
            <View style={styles.hatchAnimalContainer}>
              {/* Egg with progressive cracks */}
              <Animated.View style={{
                opacity: eggOpacity,
                transform: [
                  { rotate: eggWobble.interpolate({ inputRange: [-18, 18], outputRange: ['-18deg', '18deg'] }) },
                  { scale: eggScale },
                ],
              }}>
                <TouchableOpacity activeOpacity={0.85} onPress={handleEggTap}>
                  <View style={styles.hatchEggShell}>
                    <LottieView
                      source={require('../assets/egg-animation.json')}
                      autoPlay={false}
                      loop={false}
                      style={{ width: 160, height: 160 }}
                    />
                    {/* Crack 1 — upper left */}
                    {hatchStage >= 1 && (
                      <View style={styles.crack1Container}>
                        <View style={styles.crackSegA} />
                        <View style={styles.crackSegB} />
                        <View style={styles.crackSegC} />
                      </View>
                    )}
                    {/* Crack 2 — lower right */}
                    {hatchStage >= 2 && (
                      <View style={styles.crack2Container}>
                        <View style={styles.crackSegD} />
                        <View style={styles.crackSegE} />
                        <View style={styles.crackSegF} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.hatchNestEmoji}>🪹</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Animal reveal — scales up from behind once egg breaks */}
              {hatchStage >= 3 && (
                <Animated.View style={[styles.animalRevealWrap, {
                  transform: [{ scale: animalRevealScale }],
                  opacity: animalRevealScale,
                }]}>
                  {getAnimalImage(hatchedAnimal?.name) ? (
                    <Image source={getAnimalImage(hatchedAnimal?.name)!} style={styles.revealAnimalImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.hatchAnimalEmoji}>
                      {animalEmojiMap[hatchedAnimal?.name || ''] || '🐾'}
                    </Text>
                  )}
                </Animated.View>
              )}
            </View>
            
            {hatchStage < 3 ? (
              <Text style={styles.hatchTapHint}>Tap the egg to hatch!</Text>
            ) : (
              <Text style={styles.hatchModalSubtitle}>
                And hatched a{'\n'}cute {hatchedAnimal?.name || 'Animal'} :)
              </Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <FeedbackModal
        visible={showFeedback}
        onClose={() => {
          setShowFeedback(false);
          setFeedbackThreadId(undefined);
          void refreshFeedbackUnread();
        }}
        screenContext="Home"
        initialThreadId={feedbackThreadId}
      />

      <ResearchSurveyModal
        visible={showResearchModal}
        mode={researchMode}
        copy={researchCopy}
        survey={researchSurvey}
        loading={researchLoading}
        onClose={async () => {
          setShowResearchModal(false);
          await SecureStore.setItemAsync(RESEARCH_PROMPT_SNOOZE_KEY, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()).catch(() => {});
        }}
        onAcceptConsent={async () => {
          setResearchLoading(true);
          try {
            await researchAPI.setConsent(true);
            setShowResearchModal(false);
            await SecureStore.deleteItemAsync(RESEARCH_PROMPT_SNOOZE_KEY).catch(() => {});
            researchPromptedThisSession.current = false;
            await checkResearchPrompt();
          } catch {
            Alert.alert('Could not save', 'Please try again in a moment.');
          } finally {
            setResearchLoading(false);
          }
        }}
        onDeclineConsent={async () => {
          setResearchLoading(true);
          try {
            await researchAPI.setConsent(false);
            setShowResearchModal(false);
            await SecureStore.setItemAsync(RESEARCH_PROMPT_SNOOZE_KEY, new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()).catch(() => {});
          } catch {
            Alert.alert('Could not save', 'Please try again in a moment.');
          } finally {
            setResearchLoading(false);
          }
        }}
        onSnoozeSurvey={async () => {
          if (!researchAssignmentId) return setShowResearchModal(false);
          setResearchLoading(true);
          try {
            await researchAPI.snoozeSurvey(researchAssignmentId, 14);
            setShowResearchModal(false);
          } catch {
            Alert.alert('Could not snooze', 'Please try again.');
          } finally {
            setResearchLoading(false);
          }
        }}
        onSubmitSurvey={async (answers) => {
          if (!researchAssignmentId) return setShowResearchModal(false);
          setResearchLoading(true);
          try {
            await researchAPI.submitSurvey(researchAssignmentId, answers);
            setShowResearchModal(false);
            Alert.alert('Thank you!', researchSurvey?.thank_you_text || 'Your responses help us improve study outcomes and conservation impact.');
          } catch (e: any) {
            Alert.alert('Could not submit', e?.message || 'Please try again.');
          } finally {
            setResearchLoading(false);
          }
        }}
      />

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
    paddingBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 8,
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2D3B36',
    letterSpacing: -0.5,
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: spacing.xs,
  },
  profileButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...shadows.small,
  },
  feedbackButtonWrap: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md + 44 + 8,
    width: 44,
    height: 44,
    zIndex: 10,
  },
  feedbackButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  feedbackUnreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E11D48',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  feedbackButtonEmoji: {
    fontSize: 20,
  },
  profileButtonEmoji: {
    fontSize: 22,
  },
  profileButtonImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    color: colors.textPrimary,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  statsPills: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: 12,
    marginTop: spacing.sm + 4,
    marginBottom: spacing.xs - 4,
    zIndex: 20,
  },
  statPillCol: {
    alignItems: 'center',
  },
  statPillGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 0,
  },
  statPillIcon: {
    fontSize: 16,
  },
  statPillText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D3B36',
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D5249',
    marginTop: 4,
  },
  eggSection: {
    alignItems: 'center',
    marginTop: -38,
    paddingBottom: 0,
  },
  eggNestContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 210,
    width: 270,
  },
  eggWrapper: {
    position: 'absolute',
    top: -10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  nestEmoji: {
    fontSize: 150,
    position: 'absolute',
    bottom: -62,
    textAlign: 'center',
    opacity: 0.92,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: 0,
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  taskEditHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '600',
    fontStyle: 'italic',
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
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
    marginBottom: spacing.xs,
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
  subjectSuggestions: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  subjectSuggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  subjectSuggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  hatchEggShell: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
    overflow: 'hidden',
  },
  hatchNestEmoji: {
    fontSize: 120,
    textAlign: 'center',
    marginTop: -65,
    opacity: 0.9,
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
  hatchTapHint: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  animalRevealWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 10,
  },
  revealAnimalImage: {
    width: 160,
    height: 160,
  },
  crack1Container: {
    position: 'absolute',
    top: 55,
    left: 30,
    zIndex: 10,
  },
  crack2Container: {
    position: 'absolute',
    top: 80,
    right: 35,
    zIndex: 10,
  },
  crackSegA: {
    width: 22,
    height: 3,
    backgroundColor: '#7A6B5A',
    borderRadius: 1,
    transform: [{ rotate: '40deg' }],
  },
  crackSegB: {
    width: 16,
    height: 3,
    backgroundColor: '#7A6B5A',
    borderRadius: 1,
    transform: [{ rotate: '-35deg' }],
    marginLeft: 16,
    marginTop: -2,
  },
  crackSegC: {
    width: 20,
    height: 3,
    backgroundColor: '#7A6B5A',
    borderRadius: 1,
    transform: [{ rotate: '50deg' }],
    marginLeft: 10,
    marginTop: -1,
  },
  crackSegD: {
    width: 18,
    height: 3,
    backgroundColor: '#7A6B5A',
    borderRadius: 1,
    transform: [{ rotate: '-30deg' }],
  },
  crackSegE: {
    width: 24,
    height: 3,
    backgroundColor: '#7A6B5A',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
    marginLeft: -6,
    marginTop: -1,
  },
  crackSegF: {
    width: 14,
    height: 3,
    backgroundColor: '#7A6B5A',
    borderRadius: 1,
    transform: [{ rotate: '-40deg' }],
    marginLeft: 12,
    marginTop: -2,
  },
});
