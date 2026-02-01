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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { sessionsAPI, tasksAPI, Task } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// 21 Endangered Animals - unlocked in order
const ENDANGERED_ANIMALS = [
  { id: 1, name: 'African Elephant', emoji: '🐘', status: 'Vulnerable' },
  { id: 2, name: 'Snow Leopard', emoji: '🐆', status: 'Vulnerable' },
  { id: 3, name: 'Giant Panda', emoji: '🐼', status: 'Vulnerable' },
  { id: 4, name: 'Bengal Tiger', emoji: '🐅', status: 'Endangered' },
  { id: 5, name: 'Blue Whale', emoji: '🐋', status: 'Endangered' },
  { id: 6, name: 'Gorilla', emoji: '🦍', status: 'Critically Endangered' },
  { id: 7, name: 'Orangutan', emoji: '🦧', status: 'Critically Endangered' },
  { id: 8, name: 'Sea Turtle', emoji: '🐢', status: 'Endangered' },
  { id: 9, name: 'Polar Bear', emoji: '🐻‍❄️', status: 'Vulnerable' },
  { id: 10, name: 'Koala', emoji: '🐨', status: 'Vulnerable' },
  { id: 11, name: 'Red Panda', emoji: '🦊', status: 'Endangered' },
  { id: 12, name: 'Rhino', emoji: '🦏', status: 'Critically Endangered' },
  { id: 13, name: 'Hippopotamus', emoji: '🦛', status: 'Vulnerable' },
  { id: 14, name: 'Cheetah', emoji: '🐆', status: 'Vulnerable' },
  { id: 15, name: 'Penguin', emoji: '🐧', status: 'Endangered' },
  { id: 16, name: 'Dolphin', emoji: '🐬', status: 'Vulnerable' },
  { id: 17, name: 'Wolf', emoji: '🐺', status: 'Endangered' },
  { id: 18, name: 'Eagle', emoji: '🦅', status: 'Vulnerable' },
  { id: 19, name: 'Flamingo', emoji: '🦩', status: 'Vulnerable' },
  { id: 20, name: 'Owl', emoji: '🦉', status: 'Vulnerable' },
  { id: 21, name: 'Parrot', emoji: '🦜', status: 'Endangered' },
];

const { width } = Dimensions.get('window');

// ⚠️ TEST MODE: Set to true to make timers run in seconds instead of minutes
// e.g., 5 min becomes 5 seconds for quick testing
const TEST_MODE = true;

const PRESET_TIMES = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '25 min', minutes: 25 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
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
  const [unlockedAnimals, setUnlockedAnimals] = useState<number[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

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

  // Handle app going to background during timer
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (isRunning && appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background while timer is running
        Alert.alert(
          '⚠️ Warning!',
          'Leaving the app will kill your egg! Come back quickly!',
          [{ text: 'OK' }]
        );
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isRunning]);

  // Handle navigation away during timer
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isRunning) {
        return; // Allow navigation if timer is not running
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();
      showExitWarning(() => {
        // User confirmed, allow navigation
        navigation.dispatch(e.data.action);
      });
    });

    return unsubscribe;
  }, [navigation, isRunning]);

  const showExitWarning = (onConfirm?: () => void) => {
    Alert.alert(
      '🥚 Are you sure?',
      'Leaving now will kill your egg! Your study session will be lost and you won\'t earn any coins.',
      [
        { text: 'Stay & Study', style: 'cancel' },
        {
          text: 'Leave Anyway',
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
    setIsRunning(false);
    setShowConfetti(true);
    Vibration.vibrate([0, 500, 200, 500]);

    // Unlock the selected animal
    if (selectedAnimalId && !unlockedAnimals.includes(selectedAnimalId)) {
      const newUnlocked = [...unlockedAnimals, selectedAnimalId];
      await saveUnlockedAnimals(newUnlocked);
    }

    const hatchedAnimal = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId);

    try {
      const session = await sessionsAPI.completeSession(
        selectedMinutes,
        selectedTask?.id
      );
      
      await refreshUser();
      
      Alert.alert(
        '🎉 Egg Hatched!',
        `Congratulations! You hatched a ${hatchedAnimal?.emoji} ${hatchedAnimal?.name}!\n\nYou earned ${session.coins_earned} coins!`,
        [
          {
            text: 'Amazing!',
            onPress: () => {
              setShowConfetti(false);
              setSelectedAnimalId(null);
              resetTimer();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
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
  const estimatedCoins = selectedMinutes + (selectedMinutes >= 25 ? 5 : 0) + (selectedMinutes >= 50 ? 10 : 0);

  return (
    <SafeAreaView style={styles.container}>
      {showConfetti && (
        <ConfettiCannon count={200} origin={{ x: width / 2, y: 0 }} autoStart fadeOut />
      )}
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Study Timer</Text>
        <Text style={styles.subtitle}>Focus and earn coins!</Text>
        
        {TEST_MODE && (
          <View style={styles.testModeBanner}>
            <Text style={styles.testModeText}>⚡ TEST MODE: Minutes = Seconds</Text>
          </View>
        )}

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          <CircularProgress progress={progress}>
            {isRunning ? (
              <View style={styles.timerEggContainer}>
                <LottieView
                  source={require('../assets/egg-animation.json')}
                  autoPlay
                  loop
                  style={{ width: 100, height: 100 }}
                />
                <Text style={styles.timerTextSmall}>{formatTime(timeLeft)}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                <Text style={styles.timerStatus}>Ready</Text>
              </>
            )}
          </CircularProgress>
        </View>

        {/* Coin Preview */}
        <View style={styles.coinPreview}>
          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>💰</Text>
            <Text style={styles.coinText}>~{estimatedCoins} coins</Text>
          </View>
        </View>

        {/* Preset Times */}
        {!isRunning && (
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>Quick Select</Text>
            <View style={styles.presetsRow}>
              {PRESET_TIMES.map((preset) => (
                <TouchableOpacity
                  key={preset.minutes}
                  style={[
                    styles.presetButton,
                    selectedMinutes === preset.minutes && styles.presetButtonActive,
                  ]}
                  onPress={() => selectPreset(preset.minutes)}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      selectedMinutes === preset.minutes && styles.presetButtonTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Custom Duration Slider */}
        {!isRunning && (
          <View style={styles.sliderContainer}>
            <Text style={styles.presetsLabel}>Custom Duration</Text>
            <View style={styles.sliderCard}>
              <Text style={styles.sliderValue}>{selectedMinutes} min</Text>
              <View style={styles.sliderWrapper}>
                <Text style={styles.sliderMin}>5</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={5}
                  maximumValue={120}
                  step={5}
                  value={selectedMinutes}
                  onValueChange={(value) => {
                    setSelectedMinutes(value);
                    setTimeLeft(value * TIME_MULTIPLIER);
                  }}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.surfaceAlt}
                  thumbTintColor={colors.primary}
                />
                <Text style={styles.sliderMax}>120</Text>
              </View>
              <View style={styles.sliderMarks}>
                {[5, 30, 60, 90, 120].map((mark) => (
                  <Text key={mark} style={styles.sliderMark}>{mark}</Text>
                ))}
              </View>
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

        {/* Focus Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Focus Tip</Text>
          <Text style={styles.tipsText}>
            Put your phone on Do Not Disturb mode and find a quiet spot.
            Your brain will thank you!
          </Text>
        </View>
      </ScrollView>

      {/* Animal Selection Modal */}
      <Modal visible={showAnimalModal} transparent animationType="slide">
        <View style={styles.animalModalOverlay}>
          <View style={styles.animalModalContent}>
            <Text style={styles.animalModalTitle}>🥚 Select the Animal You Want to Hatch</Text>
            <Text style={styles.animalModalSubtitle}>
              Complete your study session to unlock this endangered animal!
            </Text>

            <ScrollView style={styles.animalGrid} showsVerticalScrollIndicator={false}>
              <View style={styles.animalGridInner}>
                {ENDANGERED_ANIMALS.map((animal, index) => {
                  const isUnlocked = unlockedAnimals.includes(animal.id);
                  const nextToUnlock = unlockedAnimals.length + 1;
                  const isNextAvailable = animal.id === nextToUnlock;
                  const isSelected = selectedAnimalId === animal.id;
                  const canSelect = isNextAvailable && !isUnlocked;

                  return (
                    <TouchableOpacity
                      key={animal.id}
                      style={[
                        styles.animalSlot,
                        isUnlocked && styles.animalSlotUnlocked,
                        isNextAvailable && !isUnlocked && styles.animalSlotAvailable,
                        isSelected && styles.animalSlotSelected,
                        !isUnlocked && !isNextAvailable && styles.animalSlotLocked,
                      ]}
                      onPress={() => {
                        if (canSelect) {
                          setSelectedAnimalId(animal.id);
                        } else if (isUnlocked) {
                          Alert.alert(
                            `${animal.emoji} ${animal.name}`,
                            `Status: ${animal.status}\n\nYou've already hatched this animal!`
                          );
                        } else {
                          Alert.alert(
                            '🔒 Locked',
                            'You need to unlock animals in order. Complete more study sessions!'
                          );
                        }
                      }}
                      disabled={false}
                    >
                      {isUnlocked ? (
                        <Text style={styles.animalEmoji}>{animal.emoji}</Text>
                      ) : (
                        <View style={styles.lockedContainer}>
                          <Text style={styles.eggEmoji}>🥚</Text>
                          <Text style={[
                            styles.lockEmoji,
                            isNextAvailable && styles.lockEmojiAvailable,
                          ]}>
                            {isNextAvailable ? '✨' : '🔒'}
                          </Text>
                        </View>
                      )}
                      <Text style={[
                        styles.animalNumber,
                        isUnlocked && styles.animalNumberUnlocked,
                        isNextAvailable && !isUnlocked && styles.animalNumberAvailable,
                      ]}>
                        {animal.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {selectedAnimalId && (
              <View style={styles.selectedAnimalPreview}>
                <Text style={styles.selectedAnimalText}>
                  You'll hatch: {ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.emoji}{' '}
                  {ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
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
    marginBottom: spacing.lg,
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
    marginTop: -8,
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
    marginBottom: spacing.xl,
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
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontWeight: '600',
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
  taskSelection: {
    marginBottom: spacing.xl,
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
    marginBottom: spacing.xl,
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
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tipsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
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
    maxHeight: 320,
  },
  animalGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  animalSlot: {
    width: 60,
    height: 70,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cardBorder,
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
    fontSize: 28,
  },
  lockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eggEmoji: {
    fontSize: 24,
  },
  lockEmoji: {
    fontSize: 12,
    marginTop: -4,
  },
  lockEmojiAvailable: {
    fontSize: 14,
  },
  animalNumber: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  animalNumberUnlocked: {
    color: colors.primary,
  },
  animalNumberAvailable: {
    color: colors.warning,
    fontWeight: '700',
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
});
