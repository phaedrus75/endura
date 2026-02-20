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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import DateTimePicker from '@react-native-community/datetimepicker';
import LottieView from 'lottie-react-native';
import { spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

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
import { animalsAPI, tasksAPI, statsAPI, badgesAPI, Egg, Task, UserStats, UserAnimal, BadgeResponse } from '../services/api';
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
            <Image source={imageSource} style={styles.recentHatchImage} />
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

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
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
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [subjects, setSubjects] = useState<string[]>(['Math', 'Science', 'English', 'History']);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const confettiRef = useRef<any>(null);

  // Load custom subjects from storage
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const stored = await AsyncStorage.getItem('customSubjects');
        if (stored) {
          setSubjects(JSON.parse(stored));
        }
      } catch (e) {
        console.log('Failed to load subjects');
      }
    };
    loadSubjects();
  }, []);

  const saveSubjects = async (newSubjects: string[]) => {
    try {
      await AsyncStorage.setItem('customSubjects', JSON.stringify(newSubjects));
      setSubjects(newSubjects);
    } catch (e) {
      console.log('Failed to save subjects');
    }
  };

  const addNewSubject = () => {
    if (newSubjectName.trim() && !subjects.includes(newSubjectName.trim())) {
      const updated = [...subjects, newSubjectName.trim()];
      saveSubjects(updated);
      setNewSubjectName('');
      setShowAddSubject(false);
    }
  };

  const removeSubject = (subject: string) => {
    const updated = subjects.filter(s => s !== subject);
    saveSubjects(updated);
  };

  const loadData = async () => {
    try {
      const [eggData, tasksData, statsData, animalsData, badgesData] = await Promise.all([
        animalsAPI.getEgg(),
        tasksAPI.getTasks(true),
        statsAPI.getStats(),
        animalsAPI.getMyAnimals().catch(() => []),
        badgesAPI.getBadges().catch(() => []),
      ]);
      
      setEgg(eggData);
      setTasks(tasksData);
      setStats(statsData);
      setRecentAnimals(animalsData.slice(0, 3));
      setBadges(badgesData);
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
            <View>
              <Text style={styles.greeting}>Hello, {user?.username || 'Friend'}!</Text>
              <Text style={styles.title}>Home</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => navigation.navigate('Tips')}
              >
                <Text style={styles.profileButtonEmoji}>💡</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                <Text style={styles.profileButtonEmoji}>👤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* User Stats Pills */}
          <View style={styles.statsPills}>
            <TouchableOpacity 
              style={[styles.statPill, styles.statPillStreak]}
              onPress={() => setShowStreakModal(true)}
            >
              <Text style={styles.statPillIcon}>🔥</Text>
              <Text style={styles.statPillTextLight}>{stats?.current_streak || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statPill, styles.statPillAnimals]}
              onPress={() => navigation.navigate('Sanctuary')}
            >
              <Text style={styles.statPillIcon}>🐾</Text>
              <Text style={styles.statPillTextLight}>{stats?.animals_hatched || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statPill, styles.statPillCredits]}
              onPress={() => setShowEcoModal(true)}
            >
              <Text style={styles.statPillIcon}>🍀</Text>
              <Text style={styles.statPillTextLight}>{stats?.current_coins || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statPill, styles.statPillBadges]}
              onPress={() => setShowBadgesModal(true)}
            >
              <Text style={styles.statPillIcon}>🏅</Text>
              <Text style={styles.statPillTextLight}>
                {badges.filter(b => b.earned).length}
              </Text>
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
            style={styles.createButton}
            onPress={() => setShowAddTask(true)}
          >
            <Text style={styles.createButtonIcon}>+</Text>
            <Text style={styles.createButtonText}>CREATE NEW TO-DO</Text>
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
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, styles.taskTitleCompleted]}>
                        {task.title}
                      </Text>
                      {task.description ? (
                        <Text style={[styles.taskSubtitle, { opacity: 0.6 }]}>{task.description}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.taskCheckbox, styles.taskCheckboxCompleted]}>
                      <Text style={styles.checkmarkCompleted}>✓</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={showAddTask} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New To-Do</Text>
              
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
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.subjectChip,
                      newTaskSubject === subject && styles.subjectChipActive,
                    ]}
                    onPress={() => setNewTaskSubject(newTaskSubject === subject ? '' : subject)}
                    onLongPress={() => {
                      Alert.alert(
                        'Remove Subject',
                        `Remove "${subject}" from your subjects?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', onPress: () => removeSubject(subject), style: 'destructive' },
                        ]
                      );
                    }}
                  >
                    <Text style={[
                      styles.subjectChipText,
                      newTaskSubject === subject && styles.subjectChipTextActive,
                    ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
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

              <Text style={styles.subjectHint}>Long press a subject to remove it</Text>

              <Text style={styles.inputLabel}>Due Date (optional)</Text>
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

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    setShowAddTask(false);
                    setShowAddSubject(false);
                    setShowDatePicker(false);
                    setNewTaskDueDate(null);
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalButtonSave}
                  onPress={addTask}
                >
                  <Text style={styles.modalButtonSaveText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Hatch Celebration Modal */}
      <Modal visible={showHatchModal} transparent animationType="fade">
        <View style={styles.hatchModalOverlay}>
          <View style={styles.hatchModalContent}>
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
          </View>
        </View>
      </Modal>

      {/* Eco-Credits Info Modal */}
      <Modal visible={showEcoModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.streakModalContent}>
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
                  {stats?.total_study_minutes ? Math.floor(stats.total_study_minutes / 60) : 0}h {(stats?.total_study_minutes || 0) % 60}m
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
          </View>
        </View>
      </Modal>

      {/* Badges Modal */}
      <Modal visible={showBadgesModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.badgesModalOverlay}
          activeOpacity={1}
          onPress={() => setShowBadgesModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.badgesModalContent}>
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
              showsVerticalScrollIndicator={false}
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Streak Details Modal */}
      <Modal visible={showStreakModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.streakModalContent}>
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
                  {stats?.total_study_minutes ? Math.floor(stats.total_study_minutes / 60) : 0}h {(stats?.total_study_minutes || 0) % 60}m
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
    marginTop: spacing.sm,
    borderRadius: 24,
    paddingBottom: spacing.lg,
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
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    gap: 6,
    marginHorizontal: 4,
  },
  statPillStreak: {
    backgroundColor: '#F4E8D1',
  },
  statPillAnimals: {
    backgroundColor: '#D9EEDC',
  },
  statPillCredits: {
    backgroundColor: '#E0E8F0',
  },
  statPillBadges: {
    backgroundColor: '#FFF3E0',
  },
  statPillIcon: {
    fontSize: 16,
  },
  statPillTextLight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A5568',
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
  recentHatchesSection: {
    marginTop: spacing.lg,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    top: -15,
    left: 0,
  },
  landscapeWrapper: {
    position: 'relative',
    height: 220,
    overflow: 'hidden',
    backgroundColor: '#E8F5E9',
  },
  recentHatchesOverlay: {
    position: 'absolute',
    bottom: 8,
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
    justifyContent: 'flex-end',
    position: 'relative',
    height: 110,
    opacity: 0.8,
  },
  placeholderEmoji: {
    fontSize: 42,
    marginBottom: 10,
    zIndex: 2,
  },
  placeholderText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  todoSection: {
    marginTop: spacing.lg,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#2D4A32',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  createButtonIcon: {
    fontSize: 18,
    color: colors.textOnPrimary,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  completedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: spacing.sm,
    gap: spacing.sm,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    maxHeight: '80%',
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
    maxHeight: 340,
    marginBottom: spacing.md,
  },
  badgesGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    justifyContent: 'center' as const,
  },
  badgeItem: {
    width: 96,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#FFF8E7',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E8B86D40',
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
});
