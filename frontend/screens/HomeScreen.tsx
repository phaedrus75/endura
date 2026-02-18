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

// Beautiful Grass Meadow with flowers
const GrassBackground = () => (
  <View style={styles.grassContainer}>
    <Svg width={width} height={130} viewBox={`0 0 ${width} 130`} style={styles.grassSvg}>
      <Defs>
        <LinearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#8FD4A0" />
          <Stop offset="100%" stopColor="#7DC98E" />
        </LinearGradient>
        <LinearGradient id="hillMid" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#6BBF7B" />
          <Stop offset="100%" stopColor="#5AB56C" />
        </LinearGradient>
        <LinearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#4DAA5F" />
          <Stop offset="100%" stopColor="#3E9B50" />
        </LinearGradient>
      </Defs>
      {/* Soft rolling hills */}
      <Ellipse cx={width * 0.15} cy={150} rx={width * 0.5} ry={95} fill="url(#hillBack)" />
      <Ellipse cx={width * 0.85} cy={145} rx={width * 0.55} ry={90} fill="url(#hillBack)" />
      <Ellipse cx={width * 0.5} cy={155} rx={width * 0.8} ry={100} fill="url(#hillMid)" />
      <Ellipse cx={width * 0.5} cy={165} rx={width * 1.1} ry={110} fill="url(#hillFront)" />
      
      {/* Daisy flower - left */}
      <Circle cx={width * 0.08} cy={68} r={5} fill="#FFF" />
      <Circle cx={width * 0.08 - 4} cy={68} r={4} fill="#FFF" />
      <Circle cx={width * 0.08 + 4} cy={68} r={4} fill="#FFF" />
      <Circle cx={width * 0.08} cy={64} r={4} fill="#FFF" />
      <Circle cx={width * 0.08} cy={72} r={4} fill="#FFF" />
      <Circle cx={width * 0.08 - 3} cy={65} r={3} fill="#FFF" />
      <Circle cx={width * 0.08 + 3} cy={65} r={3} fill="#FFF" />
      <Circle cx={width * 0.08} cy={68} r={3} fill="#FFD93D" />
      <Path d={`M${width * 0.08},75 Q${width * 0.08 + 2},85 ${width * 0.08},95`} stroke="#2D6A4F" strokeWidth={2} fill="none" />
      <Ellipse cx={width * 0.08 + 4} cy={83} rx={5} ry={2} fill="#40916C" />
      
      {/* Sunflower - right */}
      <Circle cx={width * 0.92} cy={62} r={8} fill="#FFD93D" />
      <Circle cx={width * 0.92 - 7} cy={62} r={5} fill="#FFC300" />
      <Circle cx={width * 0.92 + 7} cy={62} r={5} fill="#FFC300" />
      <Circle cx={width * 0.92} cy={55} r={5} fill="#FFC300" />
      <Circle cx={width * 0.92} cy={69} r={5} fill="#FFC300" />
      <Circle cx={width * 0.92 - 5} cy={57} r={4} fill="#FFB347" />
      <Circle cx={width * 0.92 + 5} cy={57} r={4} fill="#FFB347" />
      <Circle cx={width * 0.92 - 5} cy={67} r={4} fill="#FFB347" />
      <Circle cx={width * 0.92 + 5} cy={67} r={4} fill="#FFB347" />
      <Circle cx={width * 0.92} cy={62} r={5} fill="#6B4423" />
      <Path d={`M${width * 0.92},70 Q${width * 0.92 - 3},85 ${width * 0.92},100`} stroke="#1B4332" strokeWidth={3} fill="none" />
      <Ellipse cx={width * 0.92 - 7} cy={82} rx={6} ry={2.5} fill="#52B788" />
      <Ellipse cx={width * 0.92 + 5} cy={90} rx={5} ry={2} fill="#52B788" />
      
      {/* Tulip - purple left */}
      <Ellipse cx={width * 0.18} cy={75} rx={5} ry={9} fill="#9D4EDD" />
      <Ellipse cx={width * 0.18 - 4} cy={78} rx={4} ry={7} fill="#C77DFF" />
      <Ellipse cx={width * 0.18 + 4} cy={78} rx={4} ry={7} fill="#C77DFF" />
      <Ellipse cx={width * 0.18} cy={72} rx={3} ry={5} fill="#E0AAFF" />
      <Path d={`M${width * 0.18},84 L${width * 0.18},100`} stroke="#1B4332" strokeWidth={2.5} />
      <Ellipse cx={width * 0.18 + 5} cy={92} rx={4} ry={1.5} fill="#40916C" />
      
      {/* Rose - pink right */}
      <Circle cx={width * 0.82} cy={72} r={6} fill="#FF6B9D" />
      <Circle cx={width * 0.82 - 4} cy={74} r={4} fill="#FF8FAB" />
      <Circle cx={width * 0.82 + 4} cy={74} r={4} fill="#FF8FAB" />
      <Circle cx={width * 0.82} cy={69} r={4} fill="#FFB3C6" />
      <Circle cx={width * 0.82} cy={72} r={2.5} fill="#FFCCD5" />
      <Path d={`M${width * 0.82},78 Q${width * 0.82 + 3},88 ${width * 0.82},98`} stroke="#2D6A4F" strokeWidth={2.5} fill="none" />
      <Ellipse cx={width * 0.82 - 5} cy={88} rx={5} ry={2} fill="#52B788" />
      
      {/* Small wildflowers */}
      <Circle cx={width * 0.32} cy={88} r={4} fill="#A8DADC" />
      <Circle cx={width * 0.32} cy={88} r={2} fill="#FFE66D" />
      <Path d={`M${width * 0.32},92 L${width * 0.32},102`} stroke="#40916C" strokeWidth={1.5} />
      
      <Circle cx={width * 0.68} cy={85} r={4} fill="#F4ACB7" />
      <Circle cx={width * 0.68} cy={85} r={2} fill="#FFE5D9" />
      <Path d={`M${width * 0.68},89 L${width * 0.68},100`} stroke="#52B788" strokeWidth={1.5} />
      
      <Circle cx={width * 0.45} cy={92} r={3} fill="#B8E0D2" />
      <Circle cx={width * 0.45} cy={92} r={1.5} fill="#FFFACD" />
      <Path d={`M${width * 0.45},95 L${width * 0.45},104`} stroke="#2D6A4F" strokeWidth={1.5} />
      
      <Circle cx={width * 0.55} cy={90} r={3} fill="#D8B4FE" />
      <Circle cx={width * 0.55} cy={90} r={1.5} fill="#FEF9C3" />
      <Path d={`M${width * 0.55},93 L${width * 0.55},103`} stroke="#40916C" strokeWidth={1.5} />
    </Svg>
  </View>
);

// Egg Visual Component with Lottie Animation (white egg)
const EggVisual = () => (
  <View style={styles.eggWrapper}>
    <LottieView
      source={require('../assets/egg-animation.json')}
      autoPlay
      loop
      style={{ width: 280, height: 280 }}
    />
  </View>
);

// Emoji map for animals
const animalEmojiMap: Record<string, string> = {
  'Red Panda': '🐼', 'Sea Turtle': '🐢', 'Penguin': '🐧', 'Koala': '🐨',
  'Flamingo': '🦩', 'Giant Panda': '🐼', 'Snow Leopard': '🐆', 'Orangutan': '🦧',
  'Elephant': '🐘', 'Polar Bear': '🐻‍❄️', 'Tiger': '🐅', 'Gorilla': '🦍',
  'Blue Whale': '🐋', 'Cheetah': '🐆', 'Rhinoceros': '🦏', 'Amur Leopard': '🐆',
  'Vaquita': '🐬', 'Sumatran Rhino': '🦏', 'Kakapo': '🦜', 'Axolotl': '🦎',
  'Lion': '🦁', 'Dolphin': '🐬', 'Owl': '🦉', 'Fox': '🦊', 'Wolf': '🐺',
  'Rabbit': '🐰', 'Deer': '🦌', 'Butterfly': '🦋', 'Bee': '🐝', 'Frog': '🐸',
};

// Recent Hatch Card
const RecentHatchCard = ({ animal }: { animal?: UserAnimal }) => {
  const getAnimalEmoji = () => {
    if (!animal?.animal?.name) return '🐾';
    return animalEmojiMap[animal.animal.name] || '🐾';
  };

  const getAnimalName = () => {
    if (!animal) return '';
    return animal.nickname || animal.animal?.name || 'Animal';
  };

  return (
    <View style={styles.recentHatchCard}>
      {animal ? (
        <View style={styles.recentHatchContent}>
          <Text style={styles.recentHatchEmoji}>{getAnimalEmoji()}</Text>
          <Text style={styles.recentHatchName} numberOfLines={1}>
            {getAnimalName()}
          </Text>
        </View>
      ) : (
        <View style={styles.recentHatchPlaceholder}>
          <Text style={styles.placeholderEmoji}>🥚</Text>
          <Text style={styles.placeholderText}>Empty</Text>
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
        <View style={styles.headerSection}>
          <Text style={styles.greeting}>Hello, {user?.username || 'Friend'}! 👋</Text>
          <Text style={styles.title}>Home</Text>
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
            <EggVisual />
          </View>
        </View>
        
        {/* Study Button - Below the egg section */}
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
    backgroundColor: '#F5FBF7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statsPills: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
    height: 260,
    position: 'relative',
    overflow: 'visible',
  },
  grassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  grassSvg: {
    position: 'absolute',
    bottom: 0,
  },
  eggContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  eggWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -20,
    zIndex: 10,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: '#F5FBF7',
  },
  hatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A9660',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: spacing.sm,
    shadowColor: '#2D5A3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    width: 100,
    height: 90,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
    paddingVertical: 8,
  },
  recentHatchContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentHatchEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  recentHatchName: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 80,
  },
  recentHatchPlaceholder: {
    alignItems: 'center',
    opacity: 0.5,
  },
  placeholderEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 10,
    color: colors.textMuted,
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
