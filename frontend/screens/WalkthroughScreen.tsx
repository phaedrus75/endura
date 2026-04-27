import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Text } from '../components/StyledText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { shadows } from '../theme/colors';
import { Analytics } from '../services/analytics';

const { width: SW } = Dimensions.get('window');

export const WALKTHROUGH_SEEN_KEY = 'walkthroughSeen';

const SCREENSHOTS = {
  home:      require('../assets/onboarding/home.png'),
  timer:     require('../assets/onboarding/timer.png'),
  sanctuary: require('../assets/onboarding/sanctuary.png'),
  progress:  require('../assets/onboarding/progress.png'),
  tips:      require('../assets/onboarding/tips.png'),
  friends:   require('../assets/onboarding/friends.png'),
};

interface Slide {
  image: ImageSourcePropType;
  tag: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    image: SCREENSHOTS.home,
    tag: 'YOUR DASHBOARD',
    title: 'Everything starts here',
    body: 'See your streaks, badges, animals and tasks at a glance. Tap the egg to jump into a study session!',
  },
  {
    image: SCREENSHOTS.timer,
    tag: 'FOCUS TIMER',
    title: 'Study and earn eco-credits',
    body: 'Pick a duration, hit start, and every minute you study earns eco-credits that hatch your egg.',
  },
  {
    image: SCREENSHOTS.sanctuary,
    tag: 'YOUR SANCTUARY',
    title: 'Hatch & collect animals',
    body: 'When your egg fills up it hatches into a real endangered species. Build your own wildlife sanctuary!',
  },
  {
    image: SCREENSHOTS.progress,
    tag: 'TRACK PROGRESS',
    title: 'See how far you\'ve come',
    body: 'View weekly study stats, subject breakdowns, and badges. Watch your consistency grow over time.',
  },
  {
    image: SCREENSHOTS.tips,
    tag: 'STUDY TIPS',
    title: 'Scroll through study tips',
    body: 'Swipe through unique, research-backed advice from animal friends, save favourites, and share with mates.',
  },
  {
    image: SCREENSHOTS.friends,
    tag: 'FRIENDS & LEADERBOARD',
    title: 'Better together',
    body: 'Add friends from your school, climb the leaderboard, join study groups, and motivate each other.',
  },
];

function ScreenshotSlide({ source }: { source: ImageSourcePropType }) {
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <Image
        source={source}
        style={{ width: '100%', height: '108.5%', position: 'absolute', bottom: 0 }}
        resizeMode="contain"
      />
    </View>
  );
}

interface Props {
  navigation: any;
}

export default function WalkthroughScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const slideOpacities = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    Analytics.onboardingStarted();
  }, []);

  useEffect(() => {
    Analytics.onboardingSlideViewed(step, SLIDES[step]?.tag ?? '');
  }, [step]);

  const markSeenAndNavigate = async () => {
    try { await SecureStore.setItemAsync(WALKTHROUGH_SEEN_KEY, 'true'); } catch {}
    navigation.navigate('Auth');
  };

  const go = (next: number) => {
    if (isAnimating.current || next < 0 || next >= SLIDES.length) return;
    isAnimating.current = true;
    const prev = step;
    Animated.parallel([
      Animated.timing(slideOpacities[prev], { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      Animated.parallel([
        Animated.timing(slideOpacities[next], { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start(() => { isAnimating.current = false; });
    });
  };

  const sl = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, backgroundColor: '#E7EFEA' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={s.progressRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[s.progressSeg, i <= step && s.progressSegActive]} />
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {SLIDES.map((slide, i) => (
              <Animated.View
                key={i}
                style={{ ...StyleSheet.absoluteFillObject, opacity: slideOpacities[i] }}
                pointerEvents={i === step ? 'auto' : 'none'}
              >
                <ScreenshotSlide source={slide.image} />
              </Animated.View>
            ))}
          </View>
        </SafeAreaView>
      </View>

      <View style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={s.cardHandle} />
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
          <Text style={s.cardTag}>{sl.tag}</Text>
          <Text style={s.cardTitle}>{sl.title}</Text>
          <Text style={s.cardBody}>{sl.body}</Text>
        </Animated.View>

        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        <View style={s.btnRow}>
          {step > 0 && (
            <TouchableOpacity style={s.backBtn} onPress={() => go(step - 1)} activeOpacity={0.8}>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.nextBtn}
            onPress={() => {
              if (isLast) {
                Analytics.onboardingWalkthroughCompleted();
                markSeenAndNavigate();
              } else {
                go(step + 1);
              }
            }}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#5F8C87', '#3B5466']} style={s.nextGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.nextText}>{isLast ? 'Create Account' : 'Next'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={{ paddingVertical: 6 }}
          onPress={() => {
            Analytics.onboardingWalkthroughSkipped(step);
            markSeenAndNavigate();
          }}
        >
          <Text style={s.skipText}>Skip intro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: 5, marginHorizontal: 20, marginTop: 6, marginBottom: 4 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(95,140,135,0.18)' },
  progressSegActive: { backgroundColor: '#5F8C87' },
  card: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 14,
    alignItems: 'center',
  },
  cardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D0DDD6', marginBottom: 14 },
  cardTag: { fontSize: 12, fontWeight: '700', color: '#5F8C87', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 },
  cardTitle: { fontSize: 26, fontWeight: '800', color: '#2F4A3E', textAlign: 'center', marginBottom: 8 },
  cardBody: { fontSize: 16, lineHeight: 23, color: '#7C8F86', textAlign: 'center', marginBottom: 16, paddingHorizontal: 4 },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D0DDD6' },
  dotActive: { backgroundColor: '#5F8C87', width: 18 },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  backBtn: { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#C0D0C6', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  backText: { color: '#5F8C87', fontSize: 15, fontWeight: '700' },
  nextBtn: { flex: 2, borderRadius: 14, overflow: 'hidden', ...shadows.medium },
  nextGrad: { paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipText: { color: '#7C8F86', fontSize: 13, fontWeight: '500' },
});
