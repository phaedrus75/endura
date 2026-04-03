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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { sessionsAPI, animalsAPI, BadgeInfo, sharedEggAPI, socialAPI, SharedEgg, Friend } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getAnimalImage } from '../assets/animals';
import { Analytics } from '../services/analytics';

// 30 Endangered Animals - unlocked in order (synced with backend)
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
  { id: 22, name: 'Avahi', emoji: '🐒', status: 'Vulnerable' },
  { id: 23, name: 'Blue Whale', emoji: '🐋', status: 'Endangered' },
  { id: 24, name: 'Gray Bat', emoji: '🦇', status: 'Vulnerable' },
  { id: 25, name: 'Grey Parrot', emoji: '🦜', status: 'Endangered' },
  { id: 26, name: 'Grizzly Bear', emoji: '🐻', status: 'Threatened' },
  { id: 27, name: 'Mountain Zebra', emoji: '🦓', status: 'Vulnerable' },
  { id: 28, name: 'Pangolin', emoji: '🦔', status: 'Critically Endangered' },
  { id: 29, name: 'Seal', emoji: '🦭', status: 'Endangered' },
  { id: 30, name: 'Wombat', emoji: '🐻', status: 'Critically Endangered' },
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
const CircularProgress = ({ progress, size = 260, strokeWidth = 10, children }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  const glowWidth = strokeWidth + 12;
  
  return (
    <View style={{
      width: size + 24, height: size + 24, alignItems: 'center', justifyContent: 'center',
    }}>
      <Svg width={size + 24} height={size + 24} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#7DD4C0" />
            <Stop offset="40%" stopColor="#5F8C87" />
            <Stop offset="100%" stopColor="#3B5466" />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="rgba(125,212,192,0.25)" />
            <Stop offset="40%" stopColor="rgba(95,140,135,0.20)" />
            <Stop offset="100%" stopColor="rgba(59,84,102,0.15)" />
          </LinearGradient>
        </Defs>
        {/* Background track — matches the visual thickness of the progress arc */}
        <Circle
          cx={(size + 24) / 2}
          cy={(size + 24) / 2}
          r={radius}
          stroke="rgba(169,189,175,0.15)"
          strokeWidth={glowWidth}
          fill="none"
        />
        {/* Glow layer — wider, semi-transparent copy */}
        {progress > 0.01 && (
          <Circle
            cx={(size + 24) / 2}
            cy={(size + 24) / 2}
            r={radius}
            stroke="url(#glowGrad)"
            strokeWidth={glowWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${(size + 24) / 2} ${(size + 24) / 2})`}
          />
        )}
        {/* Main progress arc */}
        <Circle
          cx={(size + 24) / 2}
          cy={(size + 24) / 2}
          r={radius}
          stroke="url(#progressGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${(size + 24) / 2} ${(size + 24) / 2})`}
        />
      </Svg>
      <View style={styles.timerInner}>
        {children}
      </View>
    </View>
  );
};

const FOCUS_QUOTES = [
  { text: "Deep focus is a superpower.", author: "Cal Newport" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Small daily improvements lead to stunning results.", author: "Robin Sharma" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Education is the passport to the future.", author: "Malcolm X" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Every expert was once a beginner.", author: "Helen Hayes" },
  { text: "Your future is created by what you do today.", author: "Robert Kiyosaki" },
];

export default function TimerScreen() {
  const { refreshUser, profilePic, user } = useAuth();
  const navigation = useNavigation();
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * TIME_MULTIPLIER);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [hatchedAnimalInfo, setHatchedAnimalInfo] = useState<{emoji: string; name: string; ecoCredits: number} | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeInfo[]>([]);
  const [pendingBadges, setPendingBadges] = useState<BadgeInfo[]>([]);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [sessionSaveError, setSessionSaveError] = useState(false);
  const [unlockedAnimals, setUnlockedAnimals] = useState<number[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>(['Math', 'Science', 'English', 'History']);
  const [showEggDeathModal, setShowEggDeathModal] = useState(false);
  const [deadAnimalName, setDeadAnimalName] = useState('');
  const [deathCause, setDeathCause] = useState<'timeout' | 'abandoned'>('timeout');
  const [activeSharedEgg, setActiveSharedEgg] = useState<SharedEgg | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sharedHatchResult, setSharedHatchResult] = useState<{ animal_name: string; partner_name: string } | null>(null);
  const [showSharedHatchModal, setShowSharedHatchModal] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [hasSeenTips, setHasSeenTips] = useState(true);
  const tipsPulse = useRef(new Animated.Value(1)).current;
  const sharedGlowAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const timeLeftRef = useRef(timeLeft);
  const warnOnReturnRef = useRef(false);
  const isPausedRef = useRef(false);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  useEffect(() => {
    if (showSharedHatchModal) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sharedGlowAnim, { toValue: 1.3, duration: 1200, useNativeDriver: true }),
          Animated.timing(sharedGlowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [showSharedHatchModal]);

  useEffect(() => {
    if (isRunning) {
      setQuoteIndex(Math.floor(Math.random() * FOCUS_QUOTES.length));
    }
  }, [isRunning]);

  // Check if user has seen tips
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
    navigation.navigate('Tips' as never);
  };

  // Load unlocked animals from backend + local storage
  useEffect(() => {
    const loadUnlockedAnimals = async () => {
      try {
        const stored = await AsyncStorage.getItem(`unlockedAnimals_${user?.id || 'anon'}`);
        const localIds: number[] = stored ? JSON.parse(stored) : [];

        const myAnimals = await animalsAPI.getMyAnimals().catch(() => []);
        const backendNames = new Set(myAnimals.map((ua: any) => ua.animal?.name));
        const backendIds = ENDANGERED_ANIMALS
          .filter(a => backendNames.has(a.name))
          .map(a => a.id);

        const merged = Array.from(new Set([...localIds, ...backendIds]));

        if (merged.length !== localIds.length) {
          await AsyncStorage.setItem(`unlockedAnimals_${user?.id || 'anon'}`, JSON.stringify(merged));
        }
        setUnlockedAnimals(merged);
      } catch (e) {
        console.log('Failed to load unlocked animals');
      }
    };
    loadUnlockedAnimals();
  }, [user?.id]);

  // Load active shared egg on focus; auto-setup timer for partner who just accepted
  const hasAutoSetup = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const egg = await sharedEggAPI.getActive();
          setActiveSharedEgg(egg);

          if (
            egg &&
            egg.status === 'active' &&
            egg.partner.id === user?.id &&
            egg.partner_minutes === 0 &&
            !isRunning &&
            !hasAutoSetup.current
          ) {
            hasAutoSetup.current = true;
            const match = ENDANGERED_ANIMALS.find(a => a.name === egg.animal_name);
            if (match) {
              setSelectedAnimalId(match.id);
            }
            setSelectedMinutes(egg.minutes_required);
            setTimeLeft(egg.minutes_required * TIME_MULTIPLIER);
            setTimeout(() => setShowSubjectModal(true), 400);
          }
        } catch (_) {}
      };
      load();
    }, [user?.id, isRunning])
  );

  // Reload subjects every time the Timer tab is focused
  useFocusEffect(
    useCallback(() => {
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
    }, [user?.id])
  );

  // Save unlocked animals
  const saveUnlockedAnimals = async (animals: number[]) => {
    try {
      await AsyncStorage.setItem(`unlockedAnimals_${user?.id || 'anon'}`, JSON.stringify(animals));
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
  // Pause and warn when user starts to leave; timer catches up on return
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (isRunningRef.current && appState.current === 'active' && (nextAppState === 'inactive' || nextAppState === 'background')) {
        if (!backgroundTimestamp.current) {
          backgroundTimestamp.current = Date.now();
        }
        if (!isPausedRef.current) {
          warnOnReturnRef.current = true;
        }
      }

      if (isRunningRef.current && appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTimestamp.current) {
          const elapsedSeconds = Math.floor((Date.now() - backgroundTimestamp.current) / 1000);
          backgroundTimestamp.current = null;
          const newTimeLeft = Math.max(0, timeLeftRef.current - elapsedSeconds);
          setTimeLeft(newTimeLeft);
          if (newTimeLeft <= 0) {
            warnOnReturnRef.current = false;
            handleTimerComplete();
          } else if (warnOnReturnRef.current) {
            warnOnReturnRef.current = false;
            showExitWarning();
          }
        } else if (warnOnReturnRef.current) {
          warnOnReturnRef.current = false;
          showExitWarning();
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
    setIsPaused(true);
    const animalName = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name || 'your animal';
    Alert.alert(
      '💀 YOUR EGG WILL DIE!',
      `If you leave now, ${animalName} will never hatch. This endangered creature is counting on you to stay focused. Every second matters.\n\nYou will lose ALL progress and earn ZERO eco-credits.`,
      [
        {
          text: "I'll stay!",
          style: 'cancel',
          onPress: () => {
            setIsPaused(false);
          },
        },
        {
          text: 'Abandon Egg',
          style: 'destructive',
          onPress: () => {
            const dying = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name || 'Your animal';
            if (intervalRef.current) clearInterval(intervalRef.current);
            isRunningRef.current = false;
            setIsRunning(false);
            setIsPaused(false);
            setTimeLeft(selectedMinutes * TIME_MULTIPLIER);
            setDeadAnimalName(dying);
            setDeathCause('abandoned');
            setShowEggDeathModal(true);
            Vibration.vibrate([0, 300, 100, 300]);
            if (onConfirm) onConfirm();
          },
        },
      ],
      { cancelable: false }
    );
  };

  

  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          return next <= 0 ? 0 : next;
        });
      }, 1000);
    } else if (timeLeft <= 0 && isRunning) {
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
    const hatchedName = localAnimal?.name || 'Mystery Animal';
    const hatchedEmoji = localAnimal?.emoji || '🐾';
    const estimatedCoins = selectedMinutes + (selectedMinutes >= 25 ? 5 : 0) + (selectedMinutes >= 50 ? 10 : 0);

    setHatchedAnimalInfo({
      emoji: hatchedEmoji,
      name: hatchedName,
      ecoCredits: estimatedCoins,
    });
    setShowConfetti(true);
    setShowCelebrationModal(true);
    setSessionSaveError(false);

    Analytics.sessionCompleted(selectedMinutes, estimatedCoins, selectedSubject || undefined);
    Analytics.eggHatched(hatchedName, localAnimal?.status || 'Unknown');

    if (selectedAnimalId && !unlockedAnimals.includes(selectedAnimalId)) {
      saveUnlockedAnimals([...unlockedAnimals, selectedAnimalId]);
    }

    try {
      const result: any = await sessionsAPI.completeSession(
        selectedMinutes,
        undefined,
        localAnimal?.name,
        selectedSubject || undefined
      );
      if (result && typeof result === 'object') {
        const sessionCoins = result?.session?.coins_earned;
        const directCoins = result?.coins_earned;
        if (sessionCoins !== undefined && sessionCoins !== null) {
          setHatchedAnimalInfo(prev => prev ? { ...prev, ecoCredits: sessionCoins } : prev);
        } else if (directCoins !== undefined && directCoins !== null) {
          setHatchedAnimalInfo(prev => prev ? { ...prev, ecoCredits: directCoins } : prev);
        }
        if (Array.isArray(result?.new_badges) && result.new_badges.length > 0) {
          setNewBadges(result.new_badges);
        }
        if (result?.shared_hatch) {
          setSharedHatchResult(result.shared_hatch);
        }
      }
    } catch (error: any) {
      if (__DEV__) console.warn('Session save failed (celebration still showing):', error?.message || error);
      try {
        await sessionsAPI.completeSession(selectedMinutes, undefined, localAnimal?.name, undefined);
      } catch (_retryErr) {
        setSessionSaveError(true);
      }
    }

    try { await refreshUser(); } catch (_) {}
  };

  const closeCelebrationModal = () => {
    setShowCelebrationModal(false);
    setShowConfetti(false);
    setHatchedAnimalInfo(null);
    setSessionSaveError(false);
    if (sharedHatchResult) {
      setTimeout(() => setShowSharedHatchModal(true), 400);
    } else if (newBadges.length > 0) {
      setPendingBadges([...newBadges]);
      setNewBadges([]);
      setTimeout(() => setShowBadgesModal(true), 400);
    } else {
      setNewBadges([]);
    }
    setSelectedAnimalId(null);
    setSelectedSubject(null);
    resetTimer();
    sharedEggAPI.getActive().then(e => setActiveSharedEgg(e)).catch(() => {});
  };

  const closeSharedHatchModal = () => {
    setShowSharedHatchModal(false);
    setSharedHatchResult(null);
    if (newBadges.length > 0) {
      setPendingBadges([...newBadges]);
      setNewBadges([]);
      setTimeout(() => setShowBadgesModal(true), 400);
    } else {
      setNewBadges([]);
    }
  };

  const closeBadgesModal = () => {
    setShowBadgesModal(false);
    setPendingBadges([]);
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
    Analytics.sessionStarted(selectedMinutes, selectedSubject);
    setIsRunning(true);
    setIsPaused(false);
  };

  const openFriendPicker = async () => {
    setShowSubjectModal(false);
    try {
      const list = await socialAPI.getFriends();
      setFriends(list);
      setTimeout(() => setShowFriendPicker(true), 300);
    } catch (e: any) {
      Alert.alert('Error', 'Could not load friends');
      setShowSubjectModal(true);
    }
  };

  const cancelSharedEgg = () => {
    Alert.alert('Cancel Shared Egg', 'Are you sure you want to cancel this shared hatching?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel it',
        style: 'destructive',
        onPress: async () => {
          try {
            await sharedEggAPI.cancel();
            setActiveSharedEgg(null);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not cancel');
          }
        },
      },
    ]);
  };

  const closeFriendPicker = () => {
    setShowFriendPicker(false);
    setTimeout(() => setShowSubjectModal(true), 300);
  };

  const sendSharedEggInvite = async (friendId: number) => {
    const animalObj = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId);
    if (!animalObj) return;
    try {
      const egg = await sharedEggAPI.invite(friendId, animalObj.name, selectedMinutes);
      setActiveSharedEgg(egg);
      setShowFriendPicker(false);
      setTimeout(() => setShowSubjectModal(true), 300);
      Alert.alert('Invite Sent!', `Your friend has been invited to hatch a ${animalObj.name} together. Start studying to contribute!`);
    } catch (e: any) {
      Alert.alert('Could not send invite', e?.message || 'Try again later');
    }
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
    const total = Math.max(0, Math.round(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = 1 - timeLeft / (selectedMinutes * TIME_MULTIPLIER);
  const estimatedEcoCredits = selectedMinutes + (selectedMinutes >= 25 ? 5 : 0) + (selectedMinutes >= 50 ? 10 : 0);
  const elapsedSeconds = selectedMinutes * TIME_MULTIPLIER - timeLeft;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const progressPercent = Math.round(progress * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Study Timer</Text>
            <Text style={styles.subtitle}>Focus and earn eco-credits!</Text>
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
        
        {/* Timer Display */}
        <View style={styles.timerContainer}>
          <CircularProgress progress={progress} size={isRunning ? 336 : 312} strokeWidth={isRunning ? 10 : 12}>
            <View style={styles.timerEggContainer}>
              <LottieView
                source={require('../assets/egg-animation.json')}
                autoPlay
                loop
                style={isRunning
                  ? { width: 330, height: 330, marginTop: -43 }
                  : { width: 300, height: 300, marginTop: -39 }
                }
              />
              <Text style={isRunning ? styles.timerTextSmall : styles.timerText}>
                {formatTime(timeLeft)}
              </Text>
            </View>
          </CircularProgress>
        </View>

        {/* Growing with [friend] banner */}
        {activeSharedEgg && activeSharedEgg.status === 'active' && (
          <View style={styles.sharedEggBanner}>
            <View style={styles.sharedEggBannerTop}>
              <Text style={styles.sharedEggHeart}>💚</Text>
              <Text style={styles.sharedEggBannerText}>
                Growing with {activeSharedEgg.creator.id === user?.id ? activeSharedEgg.partner.username : activeSharedEgg.creator.username}
              </Text>
              <TouchableOpacity onPress={cancelSharedEgg} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sharedEggAnimalLabel}>
              Hatching: {activeSharedEgg.animal_name}
            </Text>
            <View style={styles.sharedEggProgressBar}>
              <View style={[styles.sharedEggProgressFill, { width: `${activeSharedEgg.progress_percent}%` }]} />
            </View>
            <Text style={styles.sharedEggProgressText}>
              {activeSharedEgg.creator_minutes + activeSharedEgg.partner_minutes} / {activeSharedEgg.minutes_required} min
            </Text>
          </View>
        )}

        {/* Motivational Quote - only while running */}
        {isRunning && (
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>"{FOCUS_QUOTES[quoteIndex].text}"</Text>
            <Text style={styles.quoteAuthor}>— {FOCUS_QUOTES[quoteIndex].author}</Text>
          </View>
        )}

        {/* Coin Preview - only when NOT running */}
        {!isRunning && (
          <View style={styles.coinPreview}>
            <View style={styles.coinBadge}>
              <Text style={styles.coinEmoji}>🍀</Text>
              <Text style={styles.coinText}>~{estimatedEcoCredits} eco-credits</Text>
            </View>
          </View>
        )}

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

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          {!isRunning ? (
            <TouchableOpacity onPress={handleStartPress}>
              <ExpoLinearGradient
                colors={['#5F8C87', '#3B5466']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButton}
              >
                <Text style={styles.startButtonText}>Start Studying</Text>
              </ExpoLinearGradient>
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
                    {
                      text: 'Reset',
                      onPress: () => {
                        const elapsedMinutes = Math.max(0, (selectedMinutes * TIME_MULTIPLIER - timeLeft) / 60);
                        Analytics.sessionAbandoned(elapsedMinutes);
                        resetTimer();
                      },
                      style: 'destructive',
                    },
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
      <Modal visible={showAnimalModal} transparent animationType="fade" onRequestClose={() => { setShowAnimalModal(false); setSelectedAnimalId(null); }}>
        <TouchableOpacity style={styles.animalModalOverlay} activeOpacity={1} onPress={() => { setShowAnimalModal(false); setSelectedAnimalId(null); }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.animalModalCard}>
              <Text style={styles.animalModalTitle}>🥚 Choose Your Egg!</Text>
              <Text style={styles.animalModalSubtitle}>
                It's a surprise! Complete your study session to discover which endangered animal hatches!
              </Text>

              <ScrollView style={styles.animalGrid} showsVerticalScrollIndicator={false}>
                <View style={styles.animalGridInner}>
                  {ENDANGERED_ANIMALS.map((animal, index) => {
                    const isUnlocked = unlockedAnimals.includes(animal.id);
                    const isSelected = selectedAnimalId === animal.id;

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
                          <View style={styles.unlockedContainer}>
                            {getAnimalImage(animal.name) ? (
                              <Image 
                                source={getAnimalImage(animal.name)} 
                                style={styles.animalSlotImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text style={styles.animalEmoji}>{animal.emoji}</Text>
                            )}
                          </View>
                        ) : (
                          <View style={styles.lockedContainer}>
                            <Text style={styles.eggEmojiLocked}>🥚</Text>
                            <Text style={styles.lockOverlay}>🔒</Text>
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
                    Egg selected! What will hatch? Study to find out!
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
                  onPress={confirmAnimalAndStart}
                  disabled={!selectedAnimalId}
                  style={[{ flex: 2 }, !selectedAnimalId && styles.animalModalStartDisabledWrapper]}
                >
                  <ExpoLinearGradient
                    colors={['#5F8C87', '#3B5466']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.animalModalStart,
                      !selectedAnimalId && styles.animalModalStartDisabled,
                    ]}
                  >
                    <Text style={styles.animalModalStartText}>Start Hatching!</Text>
                  </ExpoLinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Subject Selection Modal */}
      <Modal visible={showSubjectModal} transparent animationType="fade" onRequestClose={() => { setShowSubjectModal(false); setSelectedSubject(null); }}>
        <TouchableOpacity style={styles.animalModalOverlay} activeOpacity={1} onPress={() => { setShowSubjectModal(false); setSelectedSubject(null); }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.subjectModalCard}>
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

              {/* Hatch with a friend */}
              {activeSharedEgg && activeSharedEgg.status === 'active' ? (
                <View style={styles.sharedEggInline}>
                  <Text style={styles.sharedEggInlineText}>
                    💚 Hatching {activeSharedEgg.animal_name} with {activeSharedEgg.creator.id === user?.id ? activeSharedEgg.partner.username : activeSharedEgg.creator.username}
                  </Text>
                </View>
              ) : activeSharedEgg && activeSharedEgg.status === 'pending' ? (
                <View style={styles.sharedEggInline}>
                  <Text style={styles.sharedEggInlineText}>
                    💚 Invite sent to {activeSharedEgg.partner.username || 'friend'} — waiting for them to accept
                  </Text>
                </View>
              ) : !activeSharedEgg ? (
                <TouchableOpacity style={styles.hatchWithFriendBtn} onPress={openFriendPicker}>
                  <Text style={styles.hatchWithFriendText}>💚 Hatch with a friend</Text>
                </TouchableOpacity>
              ) : null}

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
                  onPress={confirmSubjectAndStart}
                  disabled={!selectedSubject}
                  style={[{ flex: 2 }, !selectedSubject && styles.subjectModalStartDisabledWrapper]}
                >
                  <ExpoLinearGradient
                    colors={['#5F8C87', '#3B5466']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.subjectModalStart,
                      !selectedSubject && styles.subjectModalStartDisabled,
                    ]}
                  >
                    <Text style={styles.subjectModalStartText}>Start Timer! ⏱️</Text>
                  </ExpoLinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Celebration Modal */}
      <Modal visible={showCelebrationModal} transparent animationType="fade">
        <TouchableOpacity style={styles.celebrationOverlay} activeOpacity={1} onPress={closeCelebrationModal}>
          <TouchableOpacity activeOpacity={1}>
          <ExpoLinearGradient
            colors={['#8FC4BC', '#4A6A7A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.celebrationContent}
          >
            <Text style={styles.celebrationTitle}>Congratulations! 🎉</Text>
            <Text style={styles.celebrationSubtitle}>You hatched a new friend!</Text>
            
            <View style={styles.celebrationAnimalContainer}>
              {hatchedAnimalInfo?.name && getAnimalImage(hatchedAnimalInfo.name) ? (
                <Image 
                  source={getAnimalImage(hatchedAnimalInfo.name)} 
                  style={styles.celebrationAnimalImage}
                  resizeMode="contain"
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
              <Text style={styles.celebrationCoinsEmoji}>🍀</Text>
              <Text style={styles.celebrationCoinsText}>
                +{hatchedAnimalInfo?.ecoCredits || 0} eco-credits earned
              </Text>
            </View>
            
            <Text style={styles.celebrationMessage}>
              This endangered animal has been added to your collection!
            </Text>

            {sessionSaveError && (
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                ⚠️ Session couldn't be saved to the server. Progress may not update.
              </Text>
            )}
            
            <View style={styles.celebrationButtons}>
              <TouchableOpacity
                style={styles.celebrationButton}
                onPress={closeCelebrationModal}
              >
                <Text style={styles.celebrationButtonText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.celebrationButtonSecondary}
                onPress={() => {
                  closeCelebrationModal();
                  (navigation as any).navigate('Sanctuary');
                }}
              >
                <Text style={styles.celebrationButtonSecondaryText}>View Collection →</Text>
              </TouchableOpacity>
            </View>
          </ExpoLinearGradient>
          </TouchableOpacity>
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
        </TouchableOpacity>
      </Modal>

      {/* Badges Modal */}
      <Modal visible={showBadgesModal} transparent animationType="fade">
        <TouchableOpacity style={styles.celebrationOverlay} activeOpacity={1} onPress={closeBadgesModal}>
          <TouchableOpacity activeOpacity={1}>
          <ExpoLinearGradient
            colors={['#A9BDAF', '#5F8C87']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.badgesModalContent}
          >
            <Text style={styles.badgesModalEmoji}>🏅</Text>
            <Text style={styles.badgesModalTitle}>
              {pendingBadges.length === 1 ? 'New Badge Earned!' : `${pendingBadges.length} New Badges!`}
            </Text>
            <Text style={styles.badgesModalSubtitle}>
              Your hard work is paying off
            </Text>
            {pendingBadges.map(b => (
              <View key={b.id} style={styles.badgesModalRow}>
                <View style={styles.badgesModalIconWrap}>
                  <Text style={styles.badgesModalIcon}>{b.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgesModalName}>{b.name}</Text>
                  <Text style={styles.badgesModalDesc}>{b.description}</Text>
                </View>
              </View>
            ))}
            <View style={styles.badgesModalButtonsWrap}>
              <TouchableOpacity onPress={closeBadgesModal}>
                <ExpoLinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.badgesModalPrimaryBtn}
                >
                  <Text style={styles.celebrationButtonText}>Awesome!</Text>
                </ExpoLinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.badgesModalSecondaryBtn}
                onPress={() => {
                  closeBadgesModal();
                  (navigation as any).navigate('Badges');
                }}
              >
                <Text style={styles.badgesModalSecondaryBtnText}>View All Badges</Text>
              </TouchableOpacity>
            </View>
          </ExpoLinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Egg Death Modal */}
      <Modal visible={showEggDeathModal} transparent animationType="fade">
        <TouchableOpacity style={styles.eggDeathOverlay} activeOpacity={1} onPress={() => { setShowEggDeathModal(false); setDeadAnimalName(''); setSelectedAnimalId(null); setSelectedSubject(null); resetTimer(); }}>
          <TouchableOpacity activeOpacity={1}>
          <ExpoLinearGradient
            colors={deathCause === 'abandoned' ? ['#F7FAF8', '#EDF2EE'] : ['#1A1A1A', '#111111']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.eggDeathContent}
          >
            <Text style={styles.eggDeathIcon}>{deathCause === 'abandoned' ? '🪦' : '🕊️'}</Text>

            <Text style={[styles.eggDeathTitle, deathCause === 'abandoned' && { color: '#2C3E3A' }]}>
              {deathCause === 'abandoned'
                ? `You abandoned ${deadAnimalName}.`
                : `${deadAnimalName} couldn't hatch...`}
            </Text>

            {deathCause !== 'abandoned' && (
              <Text style={styles.eggDeathGraveEmoji}>🪦</Text>
            )}

            <Text style={[styles.eggDeathMessage, deathCause === 'abandoned' && { color: '#4A5E56' }]}>
              {deathCause === 'abandoned'
                ? `You chose to walk away. ${deadAnimalName} — an endangered creature that trusted you — sat in silence as its egg turned cold. There was no one else coming to help. You were its only chance.`
                : `You left for too long and your egg went cold. ${deadAnimalName} was depending on you to stay focused, but the warmth of your study session faded away.`}
            </Text>

            <Text style={[styles.eggDeathSubMessage, deathCause === 'abandoned' && { color: '#5F8C87' }]}>
              {deathCause === 'abandoned'
                ? `Every study session is a lifeline for an endangered species. ${deadAnimalName} will never know what it felt like to hatch. Will the next one?`
                : 'This endangered species needed your help. Don\'t let it happen again.'}
            </Text>

            <View style={styles.eggDeathStats}>
              <Text style={[styles.eggDeathStatsText, deathCause === 'abandoned' && { color: '#7C8F86' }]}>0 eco-credits earned</Text>
              <Text style={[styles.eggDeathStatsText, deathCause === 'abandoned' && { color: '#7C8F86' }]}>0 progress saved</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setShowEggDeathModal(false);
                setDeadAnimalName('');
                setSelectedAnimalId(null);
                setSelectedSubject(null);
                resetTimer();
              }}
            >
              <ExpoLinearGradient
                colors={['#5F8C87', '#3B5466']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.eggDeathButton}
              >
                <Text style={styles.eggDeathButtonText}>Try Again</Text>
              </ExpoLinearGradient>
            </TouchableOpacity>
          </ExpoLinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Friend Picker Modal */}
      <Modal visible={showFriendPicker} transparent animationType="fade" onRequestClose={closeFriendPicker}>
        <TouchableOpacity style={styles.animalModalOverlay} activeOpacity={1} onPress={closeFriendPicker}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.friendPickerCard}>
              <Text style={styles.friendPickerTitle}>💚 Hatch Together</Text>
              <Text style={styles.friendPickerSubtitle}>
                Pick a friend to co-hatch with — both your study sessions contribute!
              </Text>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {friends.length === 0 ? (
                  <Text style={styles.friendPickerEmpty}>No friends yet — add some first!</Text>
                ) : (
                  friends.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.friendPickerRow}
                      onPress={() => sendSharedEggInvite(f.id)}
                    >
                      {f.profile_pic_url ? (
                        <Image source={{ uri: f.profile_pic_url }} style={styles.friendPickerAvatar} />
                      ) : (
                        <View style={styles.friendPickerAvatarPlaceholder}>
                          <Text style={{ fontSize: 20 }}>👤</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendPickerName}>{f.username || 'Unknown'}</Text>
                        <Text style={styles.friendPickerStats}>
                          {f.total_study_minutes >= 60 
                            ? `${Math.floor(f.total_study_minutes / 60)}h studied` 
                            : `${f.total_study_minutes}m studied`}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '700' }}>Invite</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={styles.friendPickerCancel} onPress={closeFriendPicker}>
                <Text style={styles.friendPickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Shared Hatch Celebration Modal */}
      <Modal visible={showSharedHatchModal} transparent animationType="fade" onRequestClose={closeSharedHatchModal}>
        <View style={styles.celebrationOverlay}>
          <View style={styles.sharedCelebrationCard}>
            {/* Split gradient background */}
            <View style={styles.sharedCelebrationBg}>
              <ExpoLinearGradient
                colors={['#7DD4C0', '#5F8C87']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.sharedCelebrationBgLeft}
              />
              <ExpoLinearGradient
                colors={['#E8A0BF', '#BA7BA1']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sharedCelebrationBgRight}
              />
            </View>

            <Text style={styles.sharedCelebrationTitle}>Hatched Together!</Text>

            {/* Duo usernames with heart */}
            <View style={styles.sharedCelebrationUsers}>
              <View style={styles.sharedCelebrationUserPill}>
                <Text style={styles.sharedCelebrationUserText}>{user?.username || 'You'}</Text>
              </View>
              <Text style={styles.sharedCelebrationHeart}>💚</Text>
              <View style={styles.sharedCelebrationUserPill}>
                <Text style={styles.sharedCelebrationUserText}>{sharedHatchResult?.partner_name}</Text>
              </View>
            </View>

            {/* Animal with duo silhouette + glow */}
            <View style={styles.sharedCelebrationAnimalWrap}>
              <Animated.View style={[styles.sharedCelebrationGlow, {
                transform: [{ scale: sharedGlowAnim }],
                opacity: sharedGlowAnim.interpolate({ inputRange: [1, 1.3], outputRange: [0.4, 0.15] }),
              }]} />
              {sharedHatchResult?.animal_name && getAnimalImage(sharedHatchResult.animal_name) ? (
                <>
                  <Image
                    source={getAnimalImage(sharedHatchResult.animal_name)}
                    style={styles.sharedCelebrationShadow}
                    resizeMode="contain"
                  />
                  <Image
                    source={getAnimalImage(sharedHatchResult.animal_name)}
                    style={styles.sharedCelebrationAnimalImg}
                    resizeMode="contain"
                  />
                </>
              ) : (
                <Text style={{ fontSize: 80 }}>🐾</Text>
              )}
            </View>

            <Text style={styles.sharedCelebrationAnimalName}>{sharedHatchResult?.animal_name}</Text>
            <Text style={styles.sharedCelebrationMsg}>
              Together, you brought a {sharedHatchResult?.animal_name} into the world!
            </Text>

            <View style={styles.sharedCelebrationBtns}>
              <TouchableOpacity
                style={styles.sharedCelebrationBtnPrimary}
                onPress={() => {
                  closeSharedHatchModal();
                  (navigation as any).navigate('Sanctuary');
                }}
              >
                <Text style={styles.sharedCelebrationBtnPrimaryText}>View in Sanctuary</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sharedCelebrationBtnSecondary} onPress={closeSharedHatchModal}>
                <Text style={styles.sharedCelebrationBtnSecondaryText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ConfettiCannon count={300} origin={{ x: width / 2, y: -10 }} autoStart fadeOut explosionSpeed={350} fallSpeed={2800} colors={['#7DD4C0', '#E8A0BF', '#FFD700', '#fff', '#BA7BA1', '#5F8C87']} />
        </View>
      </Modal>

      {/* Custom Timer Modal */}
      <Modal visible={showCustomModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCustomModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <View style={{ padding: 20 }}>
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
                style={{ flex: 1 }}
                onPress={() => {
                  selectPreset(customMinutes);
                  setShowCustomModal(false);
                }}
              >
                <ExpoLinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.customModalConfirm}
                >
                  <Text style={styles.customModalConfirmText}>Set Timer</Text>
                </ExpoLinearGradient>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
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
  tipsDot: {
    position: 'absolute',
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
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: spacing.md,
  },
  
  timerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 43,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    marginTop: -50,
  },
  timerTextSmall: {
    fontSize: 41,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    marginTop: -52,
  },
  timerEggContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -45,
  },
  timerStatus: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  quoteContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(95, 140, 135, 0.08)',
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  quoteAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'right',
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
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 3,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    minWidth: 44,
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
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  customModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  customModalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
  customModalConfirm: {
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  customModalConfirmText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  controlsContainer: {
    marginBottom: spacing.md,
  },
  startButton: {
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
    borderColor: colors.secondary,
  },
  controlButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Animal Selection Modal Styles
  animalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  animalModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: Dimensions.get('window').width - 40,
    maxHeight: Dimensions.get('window').height * 0.85,
    flexShrink: 1,
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
    flexGrow: 0,
    flexShrink: 1,
  },
  animalGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: 4,
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
    width: 60,
    height: 60,
  },
  lockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unlockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 12,
    color: '#5E7F6E',
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  eggEmoji: {
    fontSize: 36,
  },
  eggEmojiLocked: {
    fontSize: 52,
    opacity: 0.8,
  },
  lockOverlay: {
    fontSize: 20,
    position: 'absolute',
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
    marginTop: spacing.md,
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
    alignItems: 'center',
    ...shadows.small,
  },
  animalModalStartDisabled: {
    opacity: 0.6,
  },
  animalModalStartDisabledWrapper: {
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
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...shadows.large,
    overflow: 'hidden',
  },
  celebrationTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: '500',
  },
  celebrationAnimalContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
    width: 170,
    height: 170,
  },
  celebrationAnimalEmoji: {
    fontSize: 80,
  },
  celebrationAnimalImage: {
    width: 150,
    height: 150,
  },
  celebrationAnimalName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  celebrationCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
    gap: 6,
  },
  celebrationCoinsEmoji: {
    fontSize: 18,
  },
  celebrationCoinsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  celebrationMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  celebrationButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  celebrationButton: {
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...shadows.small,
  },
  celebrationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A6A7A',
  },
  celebrationButtonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  celebrationButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  newBadgesSection: {
    width: '100%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#5F8C8740',
  },
  newBadgesTitleWrapper: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  newBadgesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5F8C87',
    textAlign: 'center',
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
  badgesModalContent: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center' as const,
    width: '100%',
    maxWidth: 340,
    ...shadows.large,
    overflow: 'hidden' as const,
  },
  badgesModalEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  badgesModalTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginBottom: spacing.xs,
  },
  badgesModalSubtitle: {
    fontSize: 14,
    color: '#2F4A3E',
    textAlign: 'center' as const,
    marginBottom: spacing.lg,
  },
  badgesModalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    width: '100%',
  },
  badgesModalButtonsWrap: {
    width: '100%',
    alignItems: 'center' as const,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  badgesModalPrimaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center' as const,
    ...shadows.small,
  },
  badgesModalSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  badgesModalSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  badgesModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgesModalIcon: {
    fontSize: 24,
  },
  badgesModalName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#2F4A3E',
  },
  badgesModalDesc: {
    fontSize: 12,
    color: 'rgba(47,74,62,0.7)',
    marginTop: 2,
  },
  newBadgeDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  // Egg Death Modal Styles
  eggDeathOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  eggDeathContent: {
    borderRadius: 28,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  eggDeathIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  eggDeathGraveEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  eggDeathTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  eggDeathMessage: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: spacing.md,
  },
  eggDeathSubMessage: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  eggDeathStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  eggDeathStatsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.35)',
    fontWeight: '600',
  },
  eggDeathButton: {
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
  subjectModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: Dimensions.get('window').width - 40,
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
    alignItems: 'center',
    ...shadows.small,
  },
  subjectModalStartDisabled: {
    opacity: 0.6,
  },
  subjectModalStartDisabledWrapper: {
    opacity: 0.6,
  },
  subjectModalStartText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  sharedEggBanner: {
    backgroundColor: 'rgba(95, 140, 135, 0.1)',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(95, 140, 135, 0.25)',
  },
  sharedEggBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sharedEggHeart: {
    fontSize: 18,
  },
  sharedEggBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  sharedEggAnimalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  sharedEggProgressBar: {
    height: 8,
    backgroundColor: 'rgba(95, 140, 135, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  sharedEggProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  sharedEggProgressText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  sharedEggInline: {
    backgroundColor: 'rgba(95, 140, 135, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(95, 140, 135, 0.2)',
  },
  sharedEggInlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  hatchWithFriendBtn: {
    backgroundColor: 'rgba(95, 140, 135, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(95, 140, 135, 0.2)',
    borderStyle: 'dashed',
  },
  hatchWithFriendText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  friendPickerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: Dimensions.get('window').width - 40,
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  friendPickerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  friendPickerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  friendPickerEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 30,
  },
  friendPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    gap: 12,
  },
  friendPickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendPickerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendPickerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  friendPickerStats: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  friendPickerCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  friendPickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sharedCelebrationCard: {
    width: width - 48,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  sharedCelebrationBg: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  sharedCelebrationBgLeft: {
    flex: 1,
  },
  sharedCelebrationBgRight: {
    flex: 1,
  },
  sharedCelebrationTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  sharedCelebrationUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  sharedCelebrationUserPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  sharedCelebrationUserText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  sharedCelebrationHeart: {
    fontSize: 20,
  },
  sharedCelebrationAnimalWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sharedCelebrationGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sharedCelebrationShadow: {
    position: 'absolute',
    width: 110,
    height: 110,
    opacity: 0.3,
    transform: [{ rotate: '-12deg' }, { translateX: -14 }, { translateY: 6 }],
  },
  sharedCelebrationAnimalImg: {
    width: 120,
    height: 120,
    transform: [{ rotate: '5deg' }],
  },
  sharedCelebrationAnimalName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sharedCelebrationMsg: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  sharedCelebrationBtns: {
    width: '100%',
    gap: 10,
  },
  sharedCelebrationBtnPrimary: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  sharedCelebrationBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5F8C87',
  },
  sharedCelebrationBtnSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sharedCelebrationBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
});
