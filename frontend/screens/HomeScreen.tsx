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
import Svg, { Path, Ellipse, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { animalsAPI, tasksAPI, statsAPI, Egg, Task, UserStats, UserAnimal } from '../services/api';

const { width, height } = Dimensions.get('window');

// Grass Background Component
const GrassBackground = () => (
  <View style={styles.grassContainer}>
    <Svg width={width} height={180} viewBox={`0 0 ${width} 180`} style={styles.grassSvg}>
      <Defs>
        <LinearGradient id="hillGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.hills} />
          <Stop offset="100%" stopColor={colors.grassLight} />
        </LinearGradient>
        <LinearGradient id="hillGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.grass} />
          <Stop offset="100%" stopColor={colors.grassDark} />
        </LinearGradient>
      </Defs>
      {/* Back hills */}
      <Ellipse cx={width * 0.2} cy={200} rx={width * 0.5} ry={120} fill="url(#hillGrad1)" />
      <Ellipse cx={width * 0.8} cy={210} rx={width * 0.5} ry={130} fill="url(#hillGrad1)" />
      {/* Front grass */}
      <Ellipse cx={width * 0.5} cy={220} rx={width * 0.9} ry={140} fill="url(#hillGrad2)" />
    </Svg>
  </View>
);

// Egg Visual Component with Lottie Animation
const EggVisual = ({ progress }: { progress: number }) => (
  <View style={styles.eggWrapper}>
    <LottieView
      source={require('../assets/egg-animation.json')}
      autoPlay
      loop
      style={{ width: 200, height: 200 }}
    />
    {/* Progress overlay */}
    <View style={styles.progressCircleContainer}>
      <View style={[styles.progressCircle, { borderColor: colors.primary }]}>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
      </View>
    </View>
  </View>
);

// Recent Hatch Card
const RecentHatchCard = ({ animal }: { animal?: UserAnimal }) => (
  <View style={styles.recentHatchCard}>
    {animal ? (
      <Text style={styles.recentHatchEmoji}>🦁</Text>
    ) : (
      <View style={styles.recentHatchPlaceholder}>
        <Svg width={32} height={32} viewBox="0 0 24 24">
          <Path
            d="M4 16L4 8L8 4L16 4L20 8L20 16L16 20L8 20L4 16Z"
            stroke={colors.textMuted}
            strokeWidth={1.5}
            fill="none"
          />
          <Path d="M9 9L15 15M15 9L9 15" stroke={colors.textMuted} strokeWidth={1.5} />
        </Svg>
      </View>
    )}
  </View>
);

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
  const [subjects, setSubjects] = useState<string[]>(['Math', 'Science', 'English', 'History']);
  const [showAddSubject, setShowAddSubject] = useState(false);
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
      const [eggData, tasksData, statsData, animalsData] = await Promise.all([
        animalsAPI.getEgg(),
        tasksAPI.getTasks(),
        statsAPI.getStats(),
        animalsAPI.getMyAnimals().catch(() => []),
      ]);
      
      setEgg(eggData);
      setTasks(tasksData);
      setStats(statsData);
      setRecentAnimals(animalsData.slice(0, 3));
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
      });
      setNewTaskTitle('');
      setNewTaskSubject('');
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>ℯ</Text>
          </View>
        </View>

        {/* User Stats Pills */}
        <View style={styles.statsPills}>
          <TouchableOpacity 
            style={[styles.statPill, styles.statPillPrimary]}
            onPress={() => setShowStreakModal(true)}
          >
            <Text style={styles.statPillIcon}>🔥</Text>
            <Text style={styles.statPillText}>{stats?.current_streak || 0} day streak</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statPill, styles.statPillSecondary]}
            onPress={() => navigation.navigate('Collection')}
          >
            <Text style={styles.statPillIcon}>🐾</Text>
            <Text style={styles.statPillTextDark}>{stats?.animals_hatched || 0} animals</Text>
          </TouchableOpacity>
        </View>

        {/* Egg Section with Grass Background */}
        <View style={styles.eggSection}>
          <GrassBackground />
          <View style={styles.eggContent}>
            <EggVisual progress={egg?.progress_percent || 0} />
            
            <TouchableOpacity
              style={[
                styles.hatchButton,
                egg?.progress_percent && egg.progress_percent >= 100 && styles.hatchButtonReady,
              ]}
              onPress={egg?.progress_percent && egg.progress_percent >= 100 ? handleHatch : undefined}
              activeOpacity={egg?.progress_percent && egg.progress_percent >= 100 ? 0.8 : 1}
            >
              <Text style={styles.hatchButtonIcon}>🕐</Text>
              <Text style={styles.hatchButtonText}>
                {egg?.progress_percent && egg.progress_percent >= 100
                  ? 'TAP TO HATCH!'
                  : 'STUDY TO HATCH ME'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Hatches Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My recent hatches</Text>
          <View style={styles.recentHatches}>
            {[0, 1, 2].map((i) => (
              <RecentHatchCard key={i} animal={recentAnimals[i]} />
            ))}
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
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => toggleTask(task)}
              >
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskSubtitle}>
                    {task.description || 'Subject name'}
                  </Text>
                  <Text style={styles.taskDue}>due {task.due_date || 'To do due date'}</Text>
                </View>
                <View style={styles.taskCheckbox}>
                  {task.is_completed && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
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
            <Text style={styles.completedButtonText}>SEE COMPLETED TO-DOS</Text>
          </TouchableOpacity>

          {/* Completed Tasks */}
          {showCompleted && completedTasks.length > 0 && (
            <View style={styles.completedSection}>
              {completedTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskItem, styles.taskItemCompleted]}
                  onPress={() => toggleTask(task)}
                >
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, styles.taskTitleCompleted]}>
                      {task.title}
                    </Text>
                  </View>
                  <View style={[styles.taskCheckbox, styles.taskCheckboxCompleted]}>
                    <Text style={styles.checkmarkCompleted}>✓</Text>
                  </View>
                </TouchableOpacity>
              ))}
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

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    setShowAddTask(false);
                    setShowAddSubject(false);
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
                <Text style={styles.streakStatLabel}>Total Coins Earned</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>{stats?.tasks_completed || 0}</Text>
                <Text style={styles.streakStatLabel}>Tasks Completed</Text>
              </View>
              <View style={styles.streakStatItem}>
                <Text style={styles.streakStatValue}>
                  {stats?.weekly_study_minutes ? Math.floor(stats.weekly_study_minutes / 60) : 0}h
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
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuButton: {
    padding: spacing.sm,
  },
  menuIcon: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  statsPills: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statPillPrimary: {
    backgroundColor: colors.primary,
  },
  statPillSecondary: {
    backgroundColor: colors.primaryLight,
  },
  statPillIcon: {
    fontSize: 14,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  statPillTextDark: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  eggSection: {
    height: 340,
    position: 'relative',
    overflow: 'hidden',
  },
  grassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  grassSvg: {
    position: 'absolute',
    bottom: 0,
  },
  eggContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  eggWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  progressCircleContainer: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  hatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    ...shadows.medium,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  recentHatches: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  recentHatchCard: {
    width: 80,
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  recentHatchEmoji: {
    fontSize: 36,
  },
  recentHatchPlaceholder: {
    opacity: 0.4,
  },
  todoSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
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
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  createButtonIcon: {
    fontSize: 18,
    color: colors.textOnPrimary,
    fontWeight: '600',
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
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  completedButtonIcon: {
    fontSize: 16,
    color: colors.textOnPrimary,
  },
  completedButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: spacing.lg,
    fontStyle: 'italic',
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
});
