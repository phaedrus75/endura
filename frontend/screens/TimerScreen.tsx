import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  ScrollView,
  Dimensions,
  BackHandler,
  AppState,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { sessionsAPI, tasksAPI, animalsAPI, Task, BadgeInfo } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getAnimalImage } from '../assets/animals';

// 21 Endangered Animals - unlocked in order (synced with backend)
const ENDANGERED_ANIMALS = [
  { id: 1, name: 'Sunda Island Tiger', emoji: '🐅', status: 'Critically Endangered' },
  { id: 2, name: 'Javan Rhino', emoji: '🦏', status: 'Critically Endangered' },
  { id: 3, name: 'Amur Leopard', emoji: '🐆', status: 'Critically Endangered' },
  { id: 4, name: 'Mountain Gorilla', emoji: '🦍', status: 'Endangered' },
  { id: 5, name: 'Tapanuli Orangutan', emoji: '🦧', status: 'Critically Endangered' },
  { id: 6, name: 'Polar Bear', emoji: '🐻‍❄️', status: 'Vulnerable' },
  { id: 7, name: 'African Forest Elephant', emoji: '🐘', status: 'Critically Endangered' },
  { id: 8, name: 'Hawksbill Turtle', emoji: '🐢', status: 'Critically Endangered' },
  { id: 9, name: 'Calamian Deer', emoji: '🦌', status: 'Endangered' },
  { id: 10, name: 'Axolotl', emoji: '🦎', status: 'Critically Endangered' },
  { id: 11, name: 'Red Wolf', emoji: '🐺', status: 'Critically Endangered' },
  { id: 12, name: 'Monarch Butterfly', emoji: '🦋', status: 'Endangered' },
  { id: 13, name: 'Red Panda', emoji: '🐼', status: 'Endangered' },
  { id: 14, name: 'Panda', emoji: '🐼', status: 'Vulnerable' },
  { id: 15, name: 'Mexican Bobcat', emoji: '🐱', status: 'Endangered' },
  { id: 16, name: 'Chinchilla', emoji: '🐭', status: 'Endangered' },
  { id: 17, name: 'Otter', emoji: '🦦', status: 'Endangered' },
  { id: 18, name: 'Koala', emoji: '🐨', status: 'Vulnerable' },
  { id: 19, name: 'Langur Monkey', emoji: '🐒', status: 'Critically Endangered' },
  { id: 20, name: 'Pacific Pocket Mouse', emoji: '🐁', status: 'Endangered' },
  { id: 21, name: 'Wallaby', emoji: '🦘', status: 'Near Threatened' },
];

const { width } = Dimensions.get('window');

// ⚠️ TEST MODE: Set to true to make timers run in seconds instead of minutes
// e.g., 5 min becomes 5 seconds for quick testing
const TEST_MODE = true;

const PRESET_TIMES = [
  { label: '20', minutes: 20 },
  { label: '30', minutes: 30 },
  { label: '45', minutes: 45 },
  { label: '60', minutes: 60 },
  { label: '90', minutes: 90 },
  { label: '120', minutes: 120 },
];

// In test mode, multiply by 1 (seconds), otherwise by 60 (minutes to seconds)
const TIME_MULTIPLIER = TEST_MODE ? 1 : 60;

// Circular Progress Component
const CircularProgress = ({ progress, size = 260, strokeWidth = 12, children }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.primaryLight} />
          </LinearGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.timerInner}>
        {children}
      </View>
    </View>
  );
};

export default function TimerScreen() {
  const { refreshUser } = useAuth();
  const navigation = useNavigation();
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * TIME_MULTIPLIER);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [hatchedAnimalInfo, setHatchedAnimalInfo] = useState<{emoji: string; name: string; ecoCredits: number} | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeInfo[]>([]);
  const [sessionSaveError, setSessionSaveError] = useState(false);
  const [unlockedAnimals, setUnlockedAnimals] = useState<number[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>(['Math', 'Science', 'English', 'History']);
  const [showEggDeathModal, setShowEggDeathModal] = useState(false);
  const [deadAnimalName, setDeadAnimalName] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // Load unlocked animals from storage
  useEffect(() => {
    const loadUnlockedAnimals = async () => {
      try {
        const stored = await AsyncStorage.getItem('unlockedAnimals');
        if (stored) {
          setUnlockedAnimals(JSON.parse(stored));
        }
      } catch (e) {
        console.log('Failed to load unlocked animals');
      }
    };
    loadUnlockedAnimals();
  }, []);

  // Reload subjects every time the Timer tab is focused
  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  // Save unlocked animals
  const saveUnlockedAnimals = async (animals: number[]) => {
    try {
      await AsyncStorage.setItem('unlockedAnimals', JSON.stringify(animals));
      setUnlockedAnimals(animals);
    } catch (e) {
      console.log('Failed to save unlocked animals');
    }
  };

  // Handle back button press during timer
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isRunning) {
        showExitWarning();
        return true; // Prevent default back behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isRunning]);

  // Handle app going to background during timer — kill egg if gone >10s
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (isRunning && appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        backgroundTimestamp.current = Date.now();
      }

      if (isRunning && appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTimestamp.current) {
          const elapsed = (Date.now() - backgroundTimestamp.current) / 1000;
          backgroundTimestamp.current = null;
          if (elapsed > 10) {
            const dying = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name || 'Your animal';
            if (intervalRef.current) clearInterval(intervalRef.current);
            isRunningRef.current = false;
            setIsRunning(false);
            setIsPaused(false);
            setTimeLeft(selectedMinutes * TIME_MULTIPLIER);
            setDeadAnimalName(dying);
            setShowEggDeathModal(true);
            Vibration.vibrate([0, 300, 100, 300, 100, 300]);
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isRunning, selectedAnimalId, selectedMinutes]);

  // Handle navigation away during timer (stack screens)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isRunning) {
        return;
      }

      e.preventDefault();
      showExitWarning(() => {
        navigation.dispatch(e.data.action);
      });
    });

    return unsubscribe;
  }, [navigation, isRunning]);

  // Handle tab switch away during timer
  useEffect(() => {
    if (!isRunning) return;

    const unsubscribe = navigation.addListener('blur', () => {
      try {
        if (!isRunningRef.current) return;
        (navigation as any).navigate('Timer');
        showExitWarning();
      } catch (_) {}
    });

    return unsubscribe;
  }, [navigation, isRunning, selectedAnimalId]);

  const showExitWarning = (onConfirm?: () => void) => {
    const animalName = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name || 'your animal';
    Alert.alert(
      '💀 YOUR EGG WILL DIE!',
      `If you leave now, ${animalName} will never hatch. This endangered creature is counting on you to stay focused. Every second matters.\n\nYou will lose ALL progress and earn ZERO eco-credits.`,
      [
        { text: "I'll stay! 🛡️", style: 'cancel' },
        {
          text: 'Abandon Egg',
          style: 'destructive',
          onPress: () => {
            resetTimer();
            setSelectedAnimalId(null);
            if (onConfirm) onConfirm();
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const loadTasks = async () => {
    try {
      const tasksData = await tasksAPI.getTasks();
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleTimerComplete();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, timeLeft]);

  const handleTimerComplete = async () => {
    if (!isRunningRef.current) return;
    isRunningRef.current = false;
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    Vibration.vibrate([0, 500, 200, 500]);

    const localAnimal = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId);
    let hatchedName = localAnimal?.name || 'Mystery Animal';
    let hatchedEmoji = localAnimal?.emoji || '🐾';
    let coinsEarned = selectedMinutes;

    // Unlock the selected animal locally
    if (selectedAnimalId && !unlockedAnimals.includes(selectedAnimalId)) {
      const newUnlocked = [...unlockedAnimals, selectedAnimalId];
      await saveUnlockedAnimals(newUnlocked);
    }

    setSessionSaveError(false);
    let saved = false;
    try {
      const result: any = await sessionsAPI.completeSession(
        selectedMinutes,
        selectedTask?.id,
        localAnimal?.name,
        selectedSubject || undefined
      );
      saved = true;
      if (result && typeof result === 'object') {
        if (result.hatched_animal?.name) {
          hatchedName = result.hatched_animal.name;
          const animalFromList = ENDANGERED_ANIMALS.find(a => a.name === hatchedName);
          if (animalFromList) hatchedEmoji = animalFromList.emoji;
        }
        const sessionCoins = result?.session?.coins_earned;
        const directCoins = result?.coins_earned;
        if (sessionCoins !== undefined && sessionCoins !== null) coinsEarned = sessionCoins;
        else if (directCoins !== undefined && directCoins !== null) coinsEarned = directCoins;
        if (Array.isArray(result?.new_badges) && result.new_badges.length > 0) {
          setNewBadges(result.new_badges);
        }
      }
    } catch (error: any) {
      if (__DEV__) console.warn('Session save failed (celebration will still show):', error?.message || error);
      try {
        const retry: any = await sessionsAPI.completeSession(
          selectedMinutes,
          undefined,
          localAnimal?.name,
          undefined
        );
        saved = true;
        if (retry && typeof retry === 'object') {
          const c = retry?.session?.coins_earned ?? retry?.coins_earned;
          if (c !== undefined && c !== null) coinsEarned = c;
        }
      } catch (_retryErr) {
        setSessionSaveError(true);
      }
    }

    try { await refreshUser(); } catch (_) {}

    setHatchedAnimalInfo({
      emoji: hatchedEmoji,
      name: hatchedName,
      ecoCredits: coinsEarned,
    });
    setShowConfetti(true);
    setShowCelebrationModal(true);
  };

  const closeCelebrationModal = () => {
    setShowCelebrationModal(false);
    setShowConfetti(false);
    setHatchedAnimalInfo(null);
    setSessionSaveError(false);
    setNewBadges([]);
    setSelectedAnimalId(null);
    setSelectedSubject(null);
    resetTimer();
  };

  const handleStartPress = () => {
    // Show animal selection modal first
    setShowAnimalModal(true);
  };

  const confirmAnimalAndStart = () => {
    if (selectedAnimalId === null) {
      Alert.alert('Select an Animal', 'Please select an animal to hatch!');
      return;
    }
    setShowAnimalModal(false);
    // Show subject selection modal next
    setShowSubjectModal(true);
  };

  const confirmSubjectAndStart = () => {
    if (!selectedSubject) {
      Alert.alert('Select a Subject', 'Please select what subject you are studying!');
      return;
    }
    setShowSubjectModal(false);
    setIsRunning(true);
    setIsPaused(false);
  };

  const startTimer = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseTimer = () => {
    setIsPaused(true);
  };

  const resumeTimer = () => {
    setIsPaused(false);
  };

  const resetTimer = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(selectedMinutes * TIME_MULTIPLIER);
  };

  const selectPreset = (minutes: number) => {
    if (!isRunning) {
      setSelectedMinutes(minutes);
      setTimeLeft(minutes * TIME_MULTIPLIER);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = 1 - timeLeft / (selectedMinutes * TIME_MULTIPLIER);
  const estimatedEcoCredits = selectedMinutes + (selectedMinutes >= 25 ? 5 : 0) + (selectedMinutes >= 50 ? 10 : 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Study Timer</Text>
            <Text style={styles.subtitle}>Focus and earn eco-credits!</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileButtonEmoji}>👤</Text>
          </TouchableOpacity>
        </View>
        
        {TEST_MODE && (
          <View style={styles.testModeBanner}>
            <Text style={styles.testModeText}>⚡ TEST MODE: Minutes = Seconds</Text>
          </View>
        )}

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          {isRunning ? (
            <CircularProgress progress={progress} size={320} strokeWidth={14}>
              <View style={styles.timerEggContainer}>
                <LottieView
                  source={require('../assets/egg-animation.json')}
                  autoPlay
                  loop
                  style={{ width: 220, height: 220 }}
                />
                <Text style={styles.timerTextSmall}>{formatTime(timeLeft)}</Text>
              </View>
            </CircularProgress>
          ) : (
            <CircularProgress progress={progress} size={240} strokeWidth={10}>
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              <Text style={styles.timerStatus}>Ready</Text>
            </CircularProgress>
          )}
        </View>

        {/* Coin Preview */}
        <View style={styles.coinPreview}>
          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>🍀</Text>
            <Text style={styles.coinText}>~{estimatedEcoCredits} eco-credits</Text>
          </View>
        </View>

        {/* Preset Times - Chips */}
        {!isRunning && (
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>Quick Select (minutes)</Text>
            <View style={styles.presetsRow}>
              {PRESET_TIMES.map((preset) => (
                <TouchableOpacity
                  key={preset.minutes}
                  style={[
                    styles.presetChip,
                    selectedMinutes === preset.minutes && styles.presetChipActive,
                  ]}
                  onPress={() => selectPreset(preset.minutes)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      selectedMinutes === preset.minutes && styles.presetChipTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  styles.customChip,
                  !PRESET_TIMES.find(p => p.minutes === selectedMinutes) && styles.presetChipActive,
                ]}
                onPress={() => {
                  setCustomMinutes(selectedMinutes);
                  setShowCustomModal(true);
                }}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    !PRESET_TIMES.find(p => p.minutes === selectedMinutes) && styles.presetChipTextActive,
                  ]}
                >
                  ⚙️ Custom
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Task Selection */}
        {!isRunning && tasks.length > 0 && (
          <View style={styles.taskSelection}>
            <Text style={styles.presetsLabel}>Link to Task (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.taskChip,
                  !selectedTask && styles.taskChipActive,
                ]}
                onPress={() => setSelectedTask(null)}
              >
                <Text
                  style={[
                    styles.taskChipText,
                    !selectedTask && styles.taskChipTextActive,
                  ]}
                >
                  Free Study
                </Text>
              </TouchableOpacity>
              {tasks.filter(t => !t.is_completed).slice(0, 5).map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskChip,
                    selectedTask?.id === task.id && styles.taskChipActive,
                  ]}
                  onPress={() => setSelectedTask(task)}
                >
                  <Text
                    style={[
                      styles.taskChipText,
                      selectedTask?.id === task.id && styles.taskChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          {!isRunning ? (
            <TouchableOpacity style={styles.startButton} onPress={handleStartPress}>
              <Text style={styles.startButtonText}>Start Studying 🚀</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.runningControls}>
              {isPaused ? (
                <TouchableOpacity
                  style={[styles.controlButton, styles.resumeButton]}
                  onPress={resumeTimer}
                >
                  <Text style={styles.controlButtonText}>▶️ Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlButton, styles.pauseButton]}
                  onPress={pauseTimer}
                >
                  <Text style={styles.controlButtonText}>⏸️ Pause</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.controlButton, styles.resetButton]}
                onPress={() =>
                  Alert.alert('Reset Timer', 'Are you sure? You will lose progress.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', onPress: resetTimer, style: 'destructive' },
                  ])
                }
              >
                <Text style={styles.resetButtonText}>🔄 Reset</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Animal Selection Modal */}
      <Modal visible={showAnimalModal} transparent animationType="slide">
        <View style={styles.animalModalOverlay}>
          <View style={styles.animalModalContent}>
            <Text style={styles.animalModalTitle}>🥚 Choose Your Egg!</Text>
            <Text style={styles.animalModalSubtitle}>
              It's a surprise! Complete your study session to discover which endangered animal hatches! 🎁✨
            </Text>

            <ScrollView style={styles.animalGrid} showsVerticalScrollIndicator={false}>
              <View style={styles.animalGridInner}>
                {ENDANGERED_ANIMALS.map((animal, index) => {
                  const isUnlocked = unlockedAnimals.includes(animal.id);
                  const isSelected = selectedAnimalId === animal.id;
                  // Allow selecting ANY animal (no sequential restriction)
                  const canSelect = true;

                  return (
                    <TouchableOpacity
                      key={animal.id}
                      style={[
                        styles.animalSlot,
                        isUnlocked && styles.animalSlotUnlocked,
                        isSelected && styles.animalSlotSelected,
                      ]}
                      onPress={() => {
                        setSelectedAnimalId(animal.id);
                      }}
                      disabled={false}
                    >
                      {isUnlocked ? (
                        // Show the animal image if already hatched
                        <View style={styles.unlockedContainer}>
                          {getAnimalImage(animal.name) ? (
                            <Image 
                              source={getAnimalImage(animal.name)} 
                              style={styles.animalSlotImage} 
                            />
                          ) : (
                            <Text style={styles.animalEmoji}>{animal.emoji}</Text>
                          )}
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      ) : (
                        // Show egg with sparkle for unhatched
                        <View style={styles.lockedContainer}>
                          <Text style={styles.eggEmoji}>🥚</Text>
                          <Text style={styles.lockEmojiAvailable}>✨</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {selectedAnimalId && (
              <View style={styles.selectedAnimalPreview}>
                <Text style={styles.selectedAnimalText}>
                  🎁 Egg selected! What will hatch? Study to find out!
                </Text>
              </View>
            )}

            <View style={styles.animalModalButtons}>
              <TouchableOpacity
                style={styles.animalModalCancel}
                onPress={() => {
                  setShowAnimalModal(false);
                  setSelectedAnimalId(null);
                }}
              >
                <Text style={styles.animalModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.animalModalStart,
                  !selectedAnimalId && styles.animalModalStartDisabled,
                ]}
                onPress={confirmAnimalAndStart}
                disabled={!selectedAnimalId}
              >
                <Text style={styles.animalModalStartText}>Start Hatching! 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subject Selection Modal */}
      <Modal visible={showSubjectModal} transparent animationType="slide">
        <View style={styles.subjectModalOverlay}>
          <View style={styles.subjectModalContent}>
            <Text style={styles.subjectModalTitle}>📚 What are you studying?</Text>
            <Text style={styles.subjectModalSubtitle}>
              Select a subject to track your progress
            </Text>
            
            <View style={styles.subjectGrid}>
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject}
                  style={[
                    styles.subjectChip,
                    selectedSubject === subject && styles.subjectChipActive,
                  ]}
                  onPress={() => setSelectedSubject(subject)}
                >
                  <Text
                    style={[
                      styles.subjectChipText,
                      selectedSubject === subject && styles.subjectChipTextActive,
                    ]}
                  >
                    {subject}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.subjectModalButtons}>
              <TouchableOpacity
                style={styles.subjectModalCancel}
                onPress={() => {
                  setShowSubjectModal(false);
                  setSelectedSubject(null);
                  setSelectedAnimalId(null);
                }}
              >
                <Text style={styles.subjectModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.subjectModalStart,
                  !selectedSubject && styles.subjectModalStartDisabled,
                ]}
                onPress={confirmSubjectAndStart}
                disabled={!selectedSubject}
              >
                <Text style={styles.subjectModalStartText}>Start Timer! ⏱️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Celebration Modal */}
      <Modal visible={showCelebrationModal} transparent animationType="fade">
        <View style={styles.celebrationOverlay}>
          <View style={styles.celebrationContent}>
            <Text style={styles.celebrationTitle}>Congratulations!</Text>
            <Text style={styles.celebrationSubtitle}>You hatched a new friend!</Text>
            
            <View style={styles.celebrationAnimalContainer}>
              {hatchedAnimalInfo?.name && getAnimalImage(hatchedAnimalInfo.name) ? (
                <Image 
                  source={getAnimalImage(hatchedAnimalInfo.name)} 
                  style={styles.celebrationAnimalImage} 
                />
              ) : (
                <Text style={styles.celebrationAnimalEmoji}>
                  {hatchedAnimalInfo?.emoji || '🐾'}
                </Text>
              )}
            </View>
            
            <Text style={styles.celebrationAnimalName}>
              {hatchedAnimalInfo?.name}
            </Text>
            
            <View style={styles.celebrationCoins}>
              <Text style={styles.celebrationCoinsText}>
                +{hatchedAnimalInfo?.ecoCredits || 0} eco-credits earned 🍀
              </Text>
            </View>
            
            <Text style={styles.celebrationMessage}>
              This endangered animal has been added to your collection!
            </Text>

            {newBadges.length > 0 && (
              <View style={styles.newBadgesSection}>
                <Text style={styles.newBadgesTitle}>
                  {newBadges.length === 1 ? 'New Badge Earned!' : `${newBadges.length} New Badges!`}
                </Text>
                {newBadges.map(b => (
                  <View key={b.id} style={styles.newBadgeRow}>
                    <Text style={styles.newBadgeIcon}>{b.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.newBadgeName}>{b.name}</Text>
                      <Text style={styles.newBadgeDesc}>{b.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {sessionSaveError && (
              <Text style={{ color: '#E53935', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                ⚠️ Session couldn't be saved to the server. Progress may not update.
              </Text>
            )}
            
            <View style={styles.celebrationButtons}>
              <TouchableOpacity
                style={styles.celebrationButtonSecondary}
                onPress={() => {
                  closeCelebrationModal();
                  (navigation as any).navigate('Collection');
                }}
              >
                <Text style={styles.celebrationButtonSecondaryText}>View Collection</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.celebrationButton}
                onPress={closeCelebrationModal}
              >
                <Text style={styles.celebrationButtonText}>Start Another Session</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showConfetti && (
            <ConfettiCannon
              count={250}
              origin={{ x: width / 2, y: -10 }}
              autoStart
              fadeOut
              explosionSpeed={400}
              fallSpeed={2500}
            />
          )}
        </View>
      </Modal>

      {/* Egg Death Modal */}
      <Modal visible={showEggDeathModal} transparent animationType="fade">
        <View style={styles.eggDeathOverlay}>
          <View style={styles.eggDeathContent}>
            <Text style={styles.eggDeathIcon}>💔</Text>

            <Text style={styles.eggDeathTitle}>
              {deadAnimalName} couldn't hatch...
            </Text>

            <View style={styles.eggDeathCracked}>
              <Text style={styles.eggDeathCrackedEmoji}>🥚</Text>
              <View style={styles.eggDeathCrack}>
                <Text style={styles.eggDeathCrackEmoji}>💀</Text>
              </View>
            </View>

            <Text style={styles.eggDeathMessage}>
              You left for too long and your egg went cold. {deadAnimalName} was depending on you to stay focused, but the warmth of your study session faded away.
            </Text>

            <Text style={styles.eggDeathSubMessage}>
              This endangered species needed your help. Don't let it happen again.
            </Text>

            <View style={styles.eggDeathStats}>
              <Text style={styles.eggDeathStatsText}>0 eco-credits earned</Text>
              <Text style={styles.eggDeathStatsText}>0 progress saved</Text>
            </View>

            <TouchableOpacity
              style={styles.eggDeathButton}
              onPress={() => {
                setShowEggDeathModal(false);
                setDeadAnimalName('');
                setSelectedAnimalId(null);
                setSelectedSubject(null);
                resetTimer();
              }}
            >
              <Text style={styles.eggDeathButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Timer Modal */}
      <Modal visible={showCustomModal} transparent animationType="slide">
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalContent}>
            <Text style={styles.customModalTitle}>⏱️ Custom Timer</Text>
            <Text style={styles.customModalSubtitle}>Set your own study duration</Text>
            
            <Text style={styles.customModalValue}>{customMinutes} min</Text>
            
            <View style={styles.customSliderWrapper}>
              <Text style={styles.customSliderLabel}>5</Text>
              <Slider
                style={styles.customSlider}
                minimumValue={5}
                maximumValue={180}
                step={5}
                value={customMinutes}
                onValueChange={setCustomMinutes}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.surfaceAlt}
                thumbTintColor={colors.primary}
              />
              <Text style={styles.customSliderLabel}>180</Text>
            </View>
            
            <View style={styles.customSliderMarks}>
              {[5, 45, 90, 135, 180].map((mark) => (
                <Text key={mark} style={styles.customSliderMark}>{mark}</Text>
              ))}
            </View>
            
            <View style={styles.customModalButtons}>
              <TouchableOpacity
                style={styles.customModalCancel}
                onPress={() => setShowCustomModal(false)}
              >
                <Text style={styles.customModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customModalConfirm}
                onPress={() => {
                  selectPreset(customMinutes);
                  setShowCustomModal(false);
                }}
              >
                <Text style={styles.customModalConfirmText}>Set Timer</Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
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
  testModeBanner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  testModeText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 52,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerTextSmall: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: -4,
  },
  timerEggContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerStatus: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  coinPreview: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    ...shadows.small,
  },
  coinEmoji: {
    fontSize: 18,
  },
  coinText: {
    fontSize: 16,
    color: colors.tertiary,
    fontWeight: '700',
  },
  presetsContainer: {
    marginBottom: spacing.md,
  },
  presetsLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  sliderContainer: {
    marginBottom: spacing.lg,
  },
  sliderCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  sliderValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMin: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  sliderMax: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  sliderMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  sliderMark: {
    fontSize: 10,
    color: colors.textMuted,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  presetButtonTextActive: {
    color: colors.textOnPrimary,
  },
  presetChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    minWidth: 56,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 16,
  },
  presetChipTextActive: {
    color: colors.textOnPrimary,
  },
  customChip: {
    backgroundColor: colors.surfaceAlt,
  },
  // Custom Timer Modal Styles
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  customModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.large,
  },
  customModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  customModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  customModalValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  customSliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  customSlider: {
    flex: 1,
    height: 50,
  },
  customSliderLabel: {
    fontSize: 14,
    color: colors.textMuted,
    width: 32,
    textAlign: 'center',
    fontWeight: '600',
  },
  customSliderMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  customSliderMark: {
    fontSize: 11,
    color: colors.textMuted,
  },
  customModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  customModalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  customModalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
  customModalConfirm: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  customModalConfirmText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  taskSelection: {
    marginBottom: spacing.md,
  },
  taskChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    maxWidth: 150,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  taskChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  taskChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  taskChipTextActive: {
    color: colors.primaryDark,
  },
  controlsContainer: {
    marginBottom: spacing.md,
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  startButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  runningControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  controlButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
  },
  pauseButton: {
    backgroundColor: colors.warning,
  },
  resumeButton: {
    backgroundColor: colors.primary,
  },
  resetButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.error,
  },
  controlButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  resetButtonText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  // Animal Selection Modal Styles
  animalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  animalModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  animalModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  animalModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  animalGrid: {
    maxHeight: 420,
  },
  animalGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  animalSlot: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  animalSlotUnlocked: {
    backgroundColor: colors.primaryLight + '20',
    borderColor: colors.primary,
  },
  animalSlotAvailable: {
    backgroundColor: colors.warning + '20',
    borderColor: colors.warning,
    borderWidth: 3,
  },
  animalSlotSelected: {
    backgroundColor: colors.primary + '30',
    borderColor: colors.primary,
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
  },
  animalSlotLocked: {
    opacity: 0.5,
  },
  animalEmoji: {
    fontSize: 40,
  },
  animalSlotImage: {
    width: 50,
    height: 50,
  },
  lockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 12,
    color: '#4CAF50',
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  eggEmoji: {
    fontSize: 36,
  },
  lockEmoji: {
    fontSize: 14,
    marginTop: -8,
  },
  lockEmojiAvailable: {
    fontSize: 18,
  },
  selectedAnimalPreview: {
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  selectedAnimalText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  animalModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  animalModalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  animalModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  animalModalStart: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    ...shadows.small,
  },
  animalModalStartDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.6,
  },
  animalModalStartText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  // Celebration Modal Styles
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  celebrationContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...shadows.large,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  celebrationAnimalContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  celebrationAnimalEmoji: {
    fontSize: 80,
  },
  celebrationAnimalImage: {
    width: 150,
    height: 150,
  },
  celebrationAnimalName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  celebrationCoins: {
    backgroundColor: colors.tertiary + '20',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  celebrationCoinsText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.tertiary,
  },
  celebrationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  celebrationButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  celebrationButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    ...shadows.small,
  },
  celebrationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  celebrationButtonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  celebrationButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  newBadgesSection: {
    width: '100%',
    backgroundColor: '#FFF8E7',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E8B86D40',
  },
  newBadgesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D4A84B',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  newBadgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  newBadgeIcon: {
    fontSize: 24,
  },
  newBadgeName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  newBadgeDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  // Egg Death Modal Styles
  eggDeathOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 10, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  eggDeathContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 28,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 60, 0.2)',
  },
  eggDeathIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  eggDeathTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  eggDeathCracked: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  eggDeathCrackedEmoji: {
    fontSize: 64,
    opacity: 0.4,
  },
  eggDeathCrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eggDeathCrackEmoji: {
    fontSize: 36,
  },
  eggDeathMessage: {
    fontSize: 15,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: spacing.md,
  },
  eggDeathSubMessage: {
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  eggDeathStats: {
    backgroundColor: 'rgba(255, 60, 60, 0.1)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  eggDeathStatsText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
  },
  eggDeathButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
    width: '100%',
    alignItems: 'center',
  },
  eggDeathButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Subject Selection Modal Styles
  subjectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  subjectModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  subjectModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subjectModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  subjectChip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
    alignItems: 'center',
  },
  subjectChipActive: {
    backgroundColor: colors.primaryLight + '30',
    borderColor: colors.primary,
  },
  subjectChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subjectChipTextActive: {
    color: colors.primary,
  },
  subjectModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  subjectModalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  subjectModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subjectModalStart: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    ...shadows.small,
  },
  subjectModalStartDisabled: {
    backgroundColor: colors.textMuted,
  },
  subjectModalStartText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
});
