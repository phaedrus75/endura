import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
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
import { Text, TextInput } from '../components/StyledText';
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
import { sessionsAPI, animalsAPI, subjectsAPI, BadgeInfo, Subject } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getAnimalImage } from '../assets/animals';
import { Analytics } from '../services/analytics';
import { Sentry } from '../services/monitoring';
import { scheduleLocalNotification, cancelLocalNotification } from '../services/pushNotifications';
import { handleAppStateChange } from '../utils/timerAppState';

// Defensive Sentry breadcrumb helper. Sentry.addBreadcrumb is no-op when the
// SDK isn't initialised (no DSN in dev), but wrap in try/catch in case the
// shape ever changes.
const timerBreadcrumb = (message: string, data?: Record<string, any>) => {
  try {
    Sentry.addBreadcrumb({
      category: 'timer',
      level: 'info',
      message,
      data,
    });
  } catch {}
};

// AsyncStorage keys for resilient timer state.
//
// Why we persist this to disk:
//   1. iOS / Android can kill the JS context any time the app is backgrounded
//      (low memory, force-close, OS swap-out, crash). When that happens all
//      `useState` is gone — including a finished timer waiting on the user to
//      tap-to-hatch the egg. Without persistence, the user would silently lose
//      a session and the egg would seem to "disappear".
//   2. We split into two keys so we can tell *what stage* the user was in:
//      `timer:active`   → started a timer that hasn't yet been recorded on the
//                          server. On reopen, we either resume (still running)
//                          or we treat it as a finished session (time's up)
//                          and transition into the hatch celebration.
//      `timer:hatch`    → server already saved the session, but the user hasn't
//                          watched the hatch animation yet. On reopen, re-show
//                          the celebration modal so they get their reward.
const ACTIVE_TIMER_KEY = (uid: string | number | null | undefined) => `timer:active:${uid ?? 'anon'}`;
const PENDING_HATCH_KEY = (uid: string | number | null | undefined) => `timer:hatch:${uid ?? 'anon'}`;

type ActiveTimerState = {
  startedAt: number; // epoch ms
  durationSec: number;
  selectedMinutes: number;
  animalId: number | null;
  animalName: string | null;
  subjectId: number | null;
  subjectName: string | null;
  notificationId: string | null;
  useTestTimer: boolean;
  // Server-side row id from POST /sessions/start. Optional for backwards
  // compat: state persisted by older builds won't have it, so callers must
  // fall back to the legacy POST /sessions path when this is null.
  sessionId?: number | null;
};

type PendingHatchState = {
  animalEmoji: string;
  animalName: string;
  ecoCredits: number;
  sessionSaveError: boolean;
  badges: BadgeInfo[];
};

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

const PRESET_TIMES = [
  { label: '20', minutes: 20 },
  { label: '30', minutes: 30 },
  { label: '45', minutes: 45 },
  { label: '60', minutes: 60 },
  { label: '90', minutes: 90 },
  { label: '120', minutes: 120 },
];

// Circular Progress Component
const CircularProgress = ({ progress, size = 260, strokeWidth = 10, children }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = progress < 0.001 ? 0 : progress;
  const strokeDashoffset = circumference - (clampedProgress * circumference);
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
        {clampedProgress > 0 && (
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
        {clampedProgress > 0 && (
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
        )}
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
  const navigation = useNavigation<any>();
  const TIME_MULTIPLIER = user?.use_test_timer ? 1 : 60;
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
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
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAddSubjectTimer, setShowAddSubjectTimer] = useState(false);
  const [newSubjectNameTimer, setNewSubjectNameTimer] = useState('');
  const [timerSubjectSuggestions, setTimerSubjectSuggestions] = useState<Subject[]>([]);
  const [showTimerSubjectSuggestions, setShowTimerSubjectSuggestions] = useState(false);
  const timerSubjectSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [showEggDeathModal, setShowEggDeathModal] = useState(false);
  const [deadAnimalName, setDeadAnimalName] = useState('');
  const [deathCause, setDeathCause] = useState<'timeout' | 'abandoned'>('timeout');
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [hatchStage, setHatchStage] = useState(0);
  const eggWobble = useRef(new Animated.Value(0)).current;
  const eggScale = useRef(new Animated.Value(1)).current;
  const eggOpacity = useRef(new Animated.Value(1)).current;
  const animalRevealScale = useRef(new Animated.Value(0)).current;
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
    if (!isRunning) {
      setTimeLeft(selectedMinutes * TIME_MULTIPLIER);
    }
  }, [TIME_MULTIPLIER]);

  useEffect(() => {
    if (isRunning) {
      setQuoteIndex(Math.floor(Math.random() * FOCUS_QUOTES.length));
    }
  }, [isRunning]);

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
        if (__DEV__) console.log('Failed to load unlocked animals');
      }
    };
    loadUnlockedAnimals();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      subjectsAPI.getMySubjects()
        .then(subs => setSubjects(subs))
        .catch(() => {});
    }, [user?.id])
  );

  const reloadSubjects = () => {
    subjectsAPI.getMySubjects().then(subs => setSubjects(subs)).catch(() => {});
  };

  const handleTimerSubjectSearch = (text: string) => {
    setNewSubjectNameTimer(text);
    if (timerSubjectSearchTimeout.current) clearTimeout(timerSubjectSearchTimeout.current);
    if (text.trim().length < 1) {
      setTimerSubjectSuggestions([]);
      setShowTimerSubjectSuggestions(false);
      return;
    }
    timerSubjectSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await subjectsAPI.search(text.trim());
        const myIds = new Set(subjects.map(s => s.id));
        const filtered = results.filter(s => !myIds.has(s.id));
        setTimerSubjectSuggestions(filtered);
        setShowTimerSubjectSuggestions(filtered.length > 0);
      } catch {
        setTimerSubjectSuggestions([]);
        setShowTimerSubjectSuggestions(false);
      }
    }, 250);
  };

  const selectTimerSubjectSuggestion = async (subject: Subject) => {
    try {
      await subjectsAPI.addSubject(subject.id);
      reloadSubjects();
      setNewSubjectNameTimer('');
      setTimerSubjectSuggestions([]);
      setShowTimerSubjectSuggestions(false);
      setShowAddSubjectTimer(false);
    } catch {}
  };

  const addNewSubjectTimer = async () => {
    const name = newSubjectNameTimer.trim();
    if (!name) return;
    try {
      await subjectsAPI.createCustom(name);
      reloadSubjects();
      setNewSubjectNameTimer('');
      setTimerSubjectSuggestions([]);
      setShowTimerSubjectSuggestions(false);
      setShowAddSubjectTimer(false);
    } catch {}
  };

  // Save unlocked animals
  const saveUnlockedAnimals = async (animals: number[]) => {
    try {
      await AsyncStorage.setItem(`unlockedAnimals_${user?.id || 'anon'}`, JSON.stringify(animals));
      setUnlockedAnimals(animals);
    } catch (e) {
      if (__DEV__) console.log('Failed to save unlocked animals');
    }
  };

  // ---- Resilient timer persistence ----
  // See ACTIVE_TIMER_KEY / PENDING_HATCH_KEY comments at the top of the file.
  // These helpers are tolerant of failure: a storage error must never break
  // the timer UX, so all writes/reads swallow errors and just no-op.
  const persistActiveTimer = async (state: ActiveTimerState) => {
    try {
      await AsyncStorage.setItem(ACTIVE_TIMER_KEY(user?.id), JSON.stringify(state));
    } catch {}
  };
  const clearActiveTimer = async () => {
    try {
      await AsyncStorage.removeItem(ACTIVE_TIMER_KEY(user?.id));
    } catch {}
  };
  const persistPendingHatch = async (state: PendingHatchState) => {
    try {
      await AsyncStorage.setItem(PENDING_HATCH_KEY(user?.id), JSON.stringify(state));
    } catch {}
  };
  const clearPendingHatch = async () => {
    try {
      await AsyncStorage.removeItem(PENDING_HATCH_KEY(user?.id));
    } catch {}
  };

  // Restore a finished session whose celebration the user never saw, or resume
  // a still-running timer if the JS context was killed mid-session. Runs once
  // per logged-in user (re-runs on user change so account-switch works).
  const recoveredForUserRef = useRef<number | string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    if (recoveredForUserRef.current === user.id) return;
    recoveredForUserRef.current = user.id;

    const recover = async () => {
      try {
        // 1. Pending hatch wins: server already has the session, we just need
        //    to show the user the celebration they missed.
        const pendingRaw = await AsyncStorage.getItem(PENDING_HATCH_KEY(user.id));
        if (pendingRaw) {
          const pending: PendingHatchState = JSON.parse(pendingRaw);
          setHatchedAnimalInfo({
            emoji: pending.animalEmoji,
            name: pending.animalName,
            ecoCredits: pending.ecoCredits,
          });
          setSessionSaveError(!!pending.sessionSaveError);
          setNewBadges(Array.isArray(pending.badges) ? pending.badges : []);
          setHatchStage(0);
          eggWobble.setValue(0);
          eggScale.setValue(1);
          eggOpacity.setValue(1);
          animalRevealScale.setValue(0);
          setShowConfetti(false);
          setShowCelebrationModal(true);
          // Clear the active key if it somehow still exists — the session is
          // already on the server; we don't want to double-record.
          await clearActiveTimer();
          return;
        }

        // 2. Active timer state: either still running, or finished while the
        //    app was killed. Either way, recover.
        const activeRaw = await AsyncStorage.getItem(ACTIVE_TIMER_KEY(user.id));
        if (!activeRaw) return;
        const active: ActiveTimerState = JSON.parse(activeRaw);
        const elapsedSec = Math.floor((Date.now() - active.startedAt) / 1000);
        const remainingSec = active.durationSec - elapsedSec;

        if (remainingSec > 0) {
          // Still running — restore the in-progress timer so it keeps ticking.
          setSelectedMinutes(active.selectedMinutes);
          setSelectedAnimalId(active.animalId);
          if (active.subjectId && active.subjectName) {
            setSelectedSubject({
              id: active.subjectId,
              name: active.subjectName,
              display_name: active.subjectName,
              is_default: false,
            });
          }
          setTimeLeft(remainingSec);
          isRunningRef.current = true;
          setIsRunning(true);
          setIsPaused(false);
          return;
        }

        // 3. Timer already finished. Save the session on the server (the user
        //    earned this!) and transition into the hatch celebration. Match
        //    the in-foreground completion path as closely as possible.
        const localAnimal = ENDANGERED_ANIMALS.find(a => a.id === active.animalId);
        const hatchedName = active.animalName || localAnimal?.name || 'Mystery Animal';
        const hatchedEmoji = localAnimal?.emoji || '🐾';
        const estimatedCoins =
          active.selectedMinutes +
          (active.selectedMinutes >= 25 ? 5 : 0) +
          (active.selectedMinutes >= 50 ? 10 : 0);

        setHatchedAnimalInfo({ emoji: hatchedEmoji, name: hatchedName, ecoCredits: estimatedCoins });
        setHatchStage(0);
        eggWobble.setValue(0);
        eggScale.setValue(1);
        eggOpacity.setValue(1);
        animalRevealScale.setValue(0);
        setShowConfetti(false);
        setShowCelebrationModal(true);
        setSessionSaveError(false);

        if (active.animalId && !unlockedAnimals.includes(active.animalId)) {
          saveUnlockedAnimals([...unlockedAnimals, active.animalId]);
        }

        let finalCoins = estimatedCoins;
        let earnedBadges: BadgeInfo[] = [];
        let saveOk = false;
        try {
          let result: any = null;
          // Prefer completing the row created by POST /sessions/start. Fall
          // back to legacy create when the id is missing (older client state)
          // or when the server says it's gone/already complete.
          if (active.sessionId) {
            try {
              result = await sessionsAPI.completeSessionById(
                active.sessionId,
                active.selectedMinutes,
                undefined,
                active.animalName || undefined,
                active.subjectId || undefined,
              );
            } catch (idErr: any) {
              if (idErr?.status && [404, 409, 410].includes(idErr.status)) {
                timerBreadcrumb('recover:fallback-to-legacy', { sessionId: active.sessionId, status: idErr.status });
                result = await sessionsAPI.completeSession(
                  active.selectedMinutes,
                  undefined,
                  active.animalName || undefined,
                  active.subjectId || undefined,
                );
              } else {
                throw idErr;
              }
            }
          } else {
            result = await sessionsAPI.completeSession(
              active.selectedMinutes,
              undefined,
              active.animalName || undefined,
              active.subjectId || undefined,
            );
          }
          saveOk = true;
          if (result && typeof result === 'object') {
            const sessionCoins = result?.session?.coins_earned;
            const directCoins = result?.coins_earned;
            if (sessionCoins != null) finalCoins = sessionCoins;
            else if (directCoins != null) finalCoins = directCoins;
            if (Array.isArray(result?.new_badges)) earnedBadges = result.new_badges;
          }
          setHatchedAnimalInfo(prev => prev ? { ...prev, ecoCredits: finalCoins } : prev);
          if (earnedBadges.length > 0) setNewBadges(earnedBadges);
          // Fire the same analytics events the in-foreground completion path
          // fires. Without this, sessions recovered after the JS context was
          // killed look like silent drop-offs in PostHog (session_started with
          // no completed event) even though the user got their reward — the
          // single biggest reason the dashboard overstates the bug rate.
          Analytics.sessionCompleted(active.selectedMinutes, finalCoins, active.subjectName || undefined);
          Analytics.eggHatched(hatchedName, localAnimal?.status || 'Unknown');
          timerBreadcrumb('recover:complete', { sessionId: active.sessionId, minutes: active.selectedMinutes });
        } catch (err) {
          // Server save failed (probably offline). Keep `active` around so
          // we'll retry the next time the app opens — better one duplicate
          // session than silently losing the user's work.
          if (__DEV__) console.warn('Recovered session save failed:', err);
          Sentry.captureException(err);
          timerBreadcrumb('recover:save-failed', { sessionId: active.sessionId });
          setSessionSaveError(true);
        }

        // Cancel any still-pending local notification (it's already fired or
        // is about to fire and would just be redundant now).
        if (active.notificationId) await cancelLocalNotification(active.notificationId);

        if (saveOk) {
          await clearActiveTimer();
          await persistPendingHatch({
            animalEmoji: hatchedEmoji,
            animalName: hatchedName,
            ecoCredits: finalCoins,
            sessionSaveError: false,
            badges: earnedBadges,
          });
          try { await refreshUser(); } catch {}
        }
      } catch (e) {
        if (__DEV__) console.warn('Timer recovery failed:', e);
      }
    };

    recover();
  }, [user?.id]);

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

  // Handle app going to background during timer. Pure transition logic
  // lives in `utils/timerAppState.handleAppStateChange` so it can be unit
  // tested without rendering this whole screen — see that file for the
  // contract and the lock-screen-path bug history (build 32 regression).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      handleAppStateChange(
        nextAppState,
        {
          isRunning: isRunningRef,
          isPaused: isPausedRef,
          backgroundTimestamp,
          warnOnReturn: warnOnReturnRef,
          timeLeft: timeLeftRef,
        },
        {
          setTimeLeft,
          onComplete: handleTimerComplete,
          onWarn: showExitWarning,
          now: Date.now,
        },
      );
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
      `If you leave now, your animal will never hatch. This endangered creature is counting on you to stay focused. Every second matters.\n\nYou will lose ALL progress and earn ZERO eco-credits.`,
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
          onPress: async () => {
            const dying = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name || 'Your animal';
            const elapsedMinutes = Math.max(
              0,
              Math.floor(((selectedMinutes * TIME_MULTIPLIER) - timeLeftRef.current) / TIME_MULTIPLIER),
            );
            // Make abandonment observable. Without this PostHog only sees a
            // session_started with no completion — i.e. the silent timer-
            // disappearance bug reported on user_id=2.
            Analytics.sessionAbandoned(elapsedMinutes);
            if (intervalRef.current) clearInterval(intervalRef.current);
            isRunningRef.current = false;
            setIsRunning(false);
            setIsPaused(false);
            setTimeLeft(selectedMinutes * TIME_MULTIPLIER);
            setDeadAnimalName(dying);
            setDeathCause('abandoned');
            setShowEggDeathModal(true);
            Vibration.vibrate([0, 300, 100, 300]);
            // The egg died — drop persisted state and silence the OS reminder.
            // Capture the persisted session id for the breadcrumb before we
            // clear it; the row stays in the DB with completed_at=NULL so it
            // surfaces as "incomplete" on the admin dashboard.
            let abandonedSessionId: number | null = null;
            try {
              const activeRaw = await AsyncStorage.getItem(ACTIVE_TIMER_KEY(user?.id));
              if (activeRaw) {
                const active: ActiveTimerState = JSON.parse(activeRaw);
                abandonedSessionId = active.sessionId ?? null;
                await cancelLocalNotification(active.notificationId);
              }
            } catch {}
            timerBreadcrumb('abandon', {
              sessionId: abandonedSessionId,
              elapsedMinutes,
              selectedMinutes,
              animal: dying,
            });
            await clearActiveTimer();
            await clearPendingHatch();
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
    setHatchStage(0);
    eggWobble.setValue(0);
    eggScale.setValue(1);
    eggOpacity.setValue(1);
    animalRevealScale.setValue(0);
    setShowConfetti(false);
    setShowCelebrationModal(true);
    setSessionSaveError(false);

    Analytics.sessionCompleted(selectedMinutes, estimatedCoins, selectedSubject?.display_name || undefined);
    Analytics.eggHatched(hatchedName, localAnimal?.status || 'Unknown');

    if (selectedAnimalId && !unlockedAnimals.includes(selectedAnimalId)) {
      saveUnlockedAnimals([...unlockedAnimals, selectedAnimalId]);
    }

    // Cancel the OS reminder we scheduled at start — the user is already here.
    let scheduledNotificationId: string | null = null;
    let storedSessionId: number | null = null;
    try {
      const activeRaw = await AsyncStorage.getItem(ACTIVE_TIMER_KEY(user?.id));
      if (activeRaw) {
        const active: ActiveTimerState = JSON.parse(activeRaw);
        scheduledNotificationId = active.notificationId || null;
        storedSessionId = active.sessionId ?? null;
      }
    } catch {}
    await cancelLocalNotification(scheduledNotificationId);

    let finalCoins = estimatedCoins;
    let earnedBadges: BadgeInfo[] = [];
    let saveOk = false;

    // New path: finalise the row created by POST /sessions/start. The legacy
    // POST /sessions path remains the fallback when (a) we have no session
    // id (older client state, or start call failed) or (b) the row no longer
    // exists / is already complete (404/409/410 from the server).
    const applyResult = (result: any) => {
      if (!result || typeof result !== 'object') return;
      const sessionCoins = result?.session?.coins_earned;
      const directCoins = result?.coins_earned;
      if (sessionCoins != null) {
        finalCoins = sessionCoins;
        setHatchedAnimalInfo(prev => (prev ? { ...prev, ecoCredits: sessionCoins } : prev));
      } else if (directCoins != null) {
        finalCoins = directCoins;
        setHatchedAnimalInfo(prev => (prev ? { ...prev, ecoCredits: directCoins } : prev));
      }
      if (Array.isArray(result?.new_badges) && result.new_badges.length > 0) {
        earnedBadges = result.new_badges;
        setNewBadges(result.new_badges);
      }
    };

    try {
      let result: any = null;
      if (storedSessionId) {
        try {
          result = await sessionsAPI.completeSessionById(
            storedSessionId,
            selectedMinutes,
            undefined,
            localAnimal?.name,
            selectedSubject?.id || undefined,
          );
        } catch (idErr: any) {
          // 404/409/410 → row gone or already complete → fall back to legacy
          // create. Network errors fall through to the outer catch below.
          const status = idErr?.status;
          if (status && [404, 409, 410].includes(status)) {
            timerBreadcrumb('complete:fallback-to-legacy', { storedSessionId, status });
            result = await sessionsAPI.completeSession(
              selectedMinutes,
              undefined,
              localAnimal?.name,
              selectedSubject?.id || undefined,
            );
          } else {
            throw idErr;
          }
        }
      } else {
        result = await sessionsAPI.completeSession(
          selectedMinutes,
          undefined,
          localAnimal?.name,
          selectedSubject?.id || undefined,
        );
      }
      saveOk = true;
      applyResult(result);
      timerBreadcrumb('complete', { sessionId: storedSessionId, minutes: selectedMinutes });
    } catch (error: any) {
      if (__DEV__) console.warn('Session save failed (celebration still showing):', error?.message || error);
      Sentry.captureException(error);
      try {
        const retry: any = await sessionsAPI.completeSession(selectedMinutes, undefined, localAnimal?.name, undefined);
        saveOk = true;
        applyResult(retry);
        timerBreadcrumb('complete:retry-ok', { sessionId: storedSessionId });
      } catch (retryErr) {
        Sentry.captureException(retryErr);
        timerBreadcrumb('complete:retry-failed', { sessionId: storedSessionId });
        setSessionSaveError(true);
      }
    }

    // Once the server has the session, drop the active record and stash the
    // hatch info — that way a force-close before the user taps the egg still
    // re-shows the celebration on next launch (and never double-records).
    if (saveOk) {
      await clearActiveTimer();
      await persistPendingHatch({
        animalEmoji: hatchedEmoji,
        animalName: hatchedName,
        ecoCredits: finalCoins,
        sessionSaveError: false,
        badges: earnedBadges,
      });
    } else {
      // Save failed (online retry exhausted). Deliberately do NOT call
      // persistPendingHatch here — the recovery effect on next launch reads
      // PENDING_HATCH_KEY first and, when set, calls clearActiveTimer().
      // That would silently drop the user's earned session.
      //
      // By leaving `active` alone the next launch's recovery effect falls
      // through to the "active timer is past its end" branch and retries
      // completeSessionById against the server. The user will see the
      // celebration *next launch* once the network recovers, with their
      // coins/streak intact. The downside is they don't see the celebration
      // this launch — acceptable trade-off vs. losing the session entirely.
      timerBreadcrumb('complete:save-failed-keeping-active', { sessionId: storedSessionId });
      // Surface the failure in the UI so the user knows something is up,
      // but no persisted celebration state.
      setSessionSaveError(true);
    }

    try { await refreshUser(); } catch (_) {}
  };

  const handleEggTap = () => {
    if (hatchStage >= 3) return;
    const next = hatchStage + 1;
    setHatchStage(next);

    Vibration.vibrate(next === 3 ? [0, 80, 60, 120] : next * 30 + 20);

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
        setShowConfetti(true);
        Animated.parallel([
          Animated.timing(eggOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(eggScale, { toValue: 1.4, duration: 400, useNativeDriver: true }),
          Animated.spring(animalRevealScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        ]).start();
      }, 350);
    }
  };

  const closeCelebrationModal = () => {
    setShowCelebrationModal(false);
    setShowConfetti(false);
    setHatchedAnimalInfo(null);
    setSessionSaveError(false);
    if (newBadges.length > 0) {
      setPendingBadges([...newBadges]);
      setNewBadges([]);
      setTimeout(() => setShowBadgesModal(true), 400);
    } else {
      setNewBadges([]);
    }
    setSelectedAnimalId(null);
    setSelectedSubject(null);
    resetTimer();
    // The user has now seen the hatch — drop the persisted state so we don't
    // re-show it on next launch.
    clearPendingHatch();
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

  const confirmSubjectAndStart = async () => {
    if (!selectedSubject) {
      Alert.alert('Select a Subject', 'Please select what subject you are studying!');
      return;
    }
    setShowSubjectModal(false);

    // NB: Analytics.sessionStarted fires AFTER persistActiveTimer below.
    // Firing it here (before the awaits) would log a `session_started` event
    // that has no recoverable state, so a user who backgrounds the app in the
    // ~200-500ms between this point and persistActiveTimer would show up as
    // a "silent loss" in PostHog even though the timer never actually started.
    const durationSec = selectedMinutes * TIME_MULTIPLIER;
    const localAnimal = ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId);

    // Schedule the OS-level "timer done" reminder before flipping isRunning so
    // a force-close immediately after start still produces a notification.
    const notificationId = await scheduleLocalNotification(
      'Your timer is done! Tap to hatch egg 🥚',
      `${selectedMinutes} ${selectedMinutes === 1 ? 'minute' : 'minutes'} of focus complete — open Endura to hatch your animal.`,
      durationSec,
      {
        deep_link: 'Timer',
        kind: 'timer_complete',
        // Carrying template_key tells pushNotifications.reportLocalFired to log
        // this device-scheduled notification to the backend so it shows on the
        // admin dashboard alongside server-sent pushes.
        template_key: 'push_timer_done',
        category: 'local',
      },
    );

    // Record the *intent* to study on the server. If this fails (offline,
    // 500, etc.) the timer still starts — we just lose admin visibility for
    // this session. Better to show a working timer than block the user.
    let sessionId: number | null = null;
    try {
      const startResp = await sessionsAPI.startSession(
        selectedMinutes,
        localAnimal?.name,
        selectedSubject?.id || undefined,
      );
      sessionId = startResp?.session_id ?? null;
    } catch (err) {
      if (__DEV__) console.warn('startSession failed; falling back to complete-only path:', err);
      Sentry.captureException(err);
    }
    timerBreadcrumb('start', {
      sessionId,
      minutes: selectedMinutes,
      subject: selectedSubject?.display_name,
      animal: localAnimal?.name,
    });

    await persistActiveTimer({
      startedAt: Date.now(),
      durationSec,
      selectedMinutes,
      animalId: selectedAnimalId,
      animalName: localAnimal?.name || null,
      subjectId: selectedSubject?.id || null,
      subjectName: selectedSubject?.display_name || null,
      notificationId,
      useTestTimer: !!user?.use_test_timer,
      sessionId,
    });

    // Now that state is durably persisted on disk and (best-effort) on the
    // server, log session_started. If the JS context is killed between here
    // and the user returning, the recovery effect on next launch will replay
    // both the start state AND eventually fire session_completed, so the
    // PostHog funnel stays consistent.
    Analytics.sessionStarted(selectedMinutes, selectedSubject?.display_name || '');

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
          <CircularProgress progress={progress} size={336} strokeWidth={10}>
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
                                fadeDuration={0}
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
                    {unlockedAnimals.includes(selectedAnimalId)
                      ? `Study to hatch ${/^[aeiou]/i.test(ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name || '') ? 'an' : 'a'} ${ENDANGERED_ANIMALS.find(a => a.id === selectedAnimalId)?.name}!`
                      : 'Egg selected! What will hatch? Study to find out!'}
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
                {subjects.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.subjectChip,
                      selectedSubject?.id === sub.id && styles.subjectChipActive,
                    ]}
                    onPress={() => setSelectedSubject(sub)}
                  >
                    <Text
                      style={[
                        styles.subjectChipText,
                        selectedSubject?.id === sub.id && styles.subjectChipTextActive,
                      ]}
                    >
                      {sub.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addSubjectChipTimer}
                  onPress={() => setShowAddSubjectTimer(!showAddSubjectTimer)}
                >
                  <Text style={styles.addSubjectChipTimerText}>+ Add Subject</Text>
                </TouchableOpacity>
              </View>
              {showAddSubjectTimer && (
                <View style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={styles.timerAddSubjectInput}
                      placeholder="Search or type a subject..."
                      placeholderTextColor={colors.textMuted}
                      value={newSubjectNameTimer}
                      onChangeText={handleTimerSubjectSearch}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.timerAddSubjectBtn} onPress={addNewSubjectTimer}>
                      <Text style={styles.timerAddSubjectBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {showTimerSubjectSuggestions && timerSubjectSuggestions.length > 0 && (
                    <View style={styles.timerSubjectSuggestions}>
                      <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {timerSubjectSuggestions.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={styles.timerSubjectSuggestionItem}
                            onPress={() => selectTimerSubjectSuggestion(s)}
                          >
                            <Text style={styles.timerSubjectSuggestionText}>{s.display_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

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
                    <Text style={styles.subjectModalStartText}>Start Timer</Text>
                  </ExpoLinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Celebration Modal */}
      <Modal visible={showCelebrationModal} transparent animationType="fade">
        <TouchableOpacity style={styles.celebrationOverlay} activeOpacity={1} onPress={hatchStage >= 3 ? closeCelebrationModal : undefined}>
          <TouchableOpacity activeOpacity={1}>
          <View style={styles.celebrationContentOuter}>
          <ExpoLinearGradient
            colors={['#8FC4BC', '#4A6A7A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
          />
          <View style={styles.celebrationContentInner}>
            {hatchStage < 3 ? (
              <>
                <Text style={styles.celebrationTitle}>Session complete!</Text>
                <Text style={styles.celebrationSubtitle}>Your egg is ready...</Text>
              </>
            ) : (
              <>
                <Text style={styles.celebrationTitle}>Congratulations! 🎉</Text>
                <Text style={styles.celebrationSubtitle}>You hatched a new friend!</Text>
              </>
            )}
            
            <View style={styles.celebrationEggWrap}>
              {/* Egg with progressive cracks */}
              <Animated.View style={{
                opacity: eggOpacity,
                transform: [
                  { rotate: eggWobble.interpolate({ inputRange: [-18, 18], outputRange: ['-18deg', '18deg'] }) },
                  { scale: eggScale },
                ],
                alignItems: 'center',
              }}>
                <TouchableOpacity activeOpacity={0.85} onPress={handleEggTap} disabled={hatchStage >= 3}>
                  <View style={styles.eggLottieWrap}>
                    <LottieView
                      source={require('../assets/egg-animation.json')}
                      autoPlay={false}
                      loop={false}
                      style={styles.eggLottieNatural}
                    />
                    {hatchStage >= 1 && (
                      <>
                        <View style={styles.c1Main} />
                        <View style={styles.c1BranchA} />
                        <View style={styles.c1BranchB} />
                        <View style={styles.c1BranchC} />
                        <View style={styles.c1Tip} />
                      </>
                    )}
                    {hatchStage >= 2 && (
                      <>
                        <View style={styles.c2Main} />
                        <View style={styles.c2BranchA} />
                        <View style={styles.c2BranchB} />
                        <View style={styles.c2BranchC} />
                        <View style={styles.c2Tip} />
                        <View style={styles.c2Hair} />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>

              {/* Animal reveal with translucent circle */}
              {hatchStage >= 3 && (
                <Animated.View style={[styles.celebrationAnimalContainer, {
                  position: 'absolute',
                  transform: [{ scale: animalRevealScale }],
                  opacity: animalRevealScale,
                }]}>
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
                </Animated.View>
              )}
            </View>

            {hatchStage < 3 ? (
              <Text style={styles.eggTapHint}>Tap the egg to hatch!</Text>
            ) : (
              <>
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
              </>
            )}
          </View>
          </View>
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
                  <Text style={[styles.celebrationButtonText, { color: '#fff' }]}>Awesome!</Text>
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

      {/* Custom Timer Modal */}
      <Modal visible={showCustomModal} transparent animationType="fade" onRequestClose={() => setShowCustomModal(false)}>
        <TouchableOpacity style={styles.customModalOverlay} activeOpacity={1} onPress={() => setShowCustomModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.customModalContent}>
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
          </TouchableOpacity>
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
  celebrationContentOuter: {
    width: '100%',
    maxWidth: 340,
    ...shadows.large,
  },
  celebrationContentInner: {
    padding: 24,
    paddingTop: 20,
    alignItems: 'center',
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
    marginBottom: spacing.md,
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
  celebrationEggWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 220,
  },
  eggLottieWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  eggLottieNatural: {
    width: 550,
    height: 550,
  },
  eggTapHint: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: spacing.lg,
    letterSpacing: 0.3,
  },
  c1Main: {
    position: 'absolute',
    top: 45,
    left: 80,
    width: 1.5,
    height: 44,
    backgroundColor: '#3A3A3A',
    transform: [{ rotate: '12deg' }],
    zIndex: 10,
  },
  c1BranchA: {
    position: 'absolute',
    top: 40,
    left: 71,
    width: 1,
    height: 28,
    backgroundColor: '#4A4A4A',
    transform: [{ rotate: '-30deg' }],
    zIndex: 10,
  },
  c1BranchB: {
    position: 'absolute',
    top: 72,
    left: 82,
    width: 1.5,
    height: 30,
    backgroundColor: '#3A3A3A',
    transform: [{ rotate: '70deg' }],
    zIndex: 10,
  },
  c1BranchC: {
    position: 'absolute',
    top: 58,
    left: 73,
    width: 1,
    height: 16,
    backgroundColor: '#555',
    transform: [{ rotate: '-55deg' }],
    zIndex: 10,
  },
  c1Tip: {
    position: 'absolute',
    top: 35,
    left: 77,
    width: 0.8,
    height: 12,
    backgroundColor: '#666',
    transform: [{ rotate: '18deg' }],
    zIndex: 10,
  },
  c2Main: {
    position: 'absolute',
    top: 110,
    right: 60,
    width: 1.5,
    height: 48,
    backgroundColor: '#3A3A3A',
    transform: [{ rotate: '-12deg' }],
    zIndex: 10,
  },
  c2BranchA: {
    position: 'absolute',
    top: 130,
    right: 52,
    width: 1,
    height: 30,
    backgroundColor: '#4A4A4A',
    transform: [{ rotate: '35deg' }],
    zIndex: 10,
  },
  c2BranchB: {
    position: 'absolute',
    top: 124,
    right: 64,
    width: 1.5,
    height: 24,
    backgroundColor: '#3A3A3A',
    transform: [{ rotate: '-65deg' }],
    zIndex: 10,
  },
  c2BranchC: {
    position: 'absolute',
    top: 144,
    right: 56,
    width: 1,
    height: 20,
    backgroundColor: '#555',
    transform: [{ rotate: '58deg' }],
    zIndex: 10,
  },
  c2Tip: {
    position: 'absolute',
    top: 158,
    right: 58,
    width: 0.8,
    height: 14,
    backgroundColor: '#666',
    transform: [{ rotate: '-22deg' }],
    zIndex: 10,
  },
  c2Hair: {
    position: 'absolute',
    top: 114,
    right: 70,
    width: 0.7,
    height: 12,
    backgroundColor: '#777',
    transform: [{ rotate: '42deg' }],
    zIndex: 10,
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
  addSubjectChipTimer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSubjectChipTimerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  timerAddSubjectInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  timerAddSubjectBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timerAddSubjectBtnText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  timerSubjectSuggestions: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 4,
    ...shadows.small,
  },
  timerSubjectSuggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  timerSubjectSuggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
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
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
