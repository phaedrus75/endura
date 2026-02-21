import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../services/api';

const { width, height } = Dimensions.get('window');

interface OnboardingStep {
  emoji?: string;
  useLottie?: boolean;
  title: string;
  subtitle: string;
  description: string;
  highlights?: string[];
  gradient: [string, string];
}

const onboardingSteps: OnboardingStep[] = [
  {
    useLottie: true,
    title: 'Welcome to Endura',
    subtitle: 'Study with purpose',
    description:
      'Every minute you study helps protect endangered species. Earn eco-credits, hatch animals, and make a real difference.',
    highlights: ['🥚 Hatch endangered animals', '🌍 Donate to conservation', '🏆 Compete with friends'],
    gradient: ['#E7EFEA', '#DCEAE3'],
  },
  {
    emoji: '⏱️',
    title: 'Focus Timer',
    subtitle: 'Study smarter',
    description:
      'Start a study session with our built-in timer. Stay focused, earn eco-credits, and watch your streak grow day by day.',
    highlights: ['📚 Track study hours & subjects', '🔥 Build daily streaks', '🪙 Earn eco-credits per minute'],
    gradient: ['#E7EFEA', '#D6E5EC'],
  },
  {
    emoji: '🐣',
    title: 'Hatch & Collect',
    subtitle: 'Build your sanctuary',
    description:
      'Your eco-credits fill an egg. When it hatches, you discover an endangered animal — from Red Pandas to Sunda Island Tigers. Collect all 30!',
    highlights: ['🦁 30 real endangered species', '✨ Common to Legendary rarity', '🏡 Your own animal sanctuary'],
    gradient: ['#E7EFEA', '#E2E8D8'],
  },
  {
    emoji: '💚',
    title: 'Take Action',
    subtitle: 'Real-world impact',
    description:
      'Donate directly to wildlife conservation through our partnership with Every.org. Track your impact and see how the whole community is helping.',
    highlights: ['🤝 One-tap donations', '📊 Community donation tracker', '🏅 Conservation Champions board'],
    gradient: ['#E7EFEA', '#D8E8E0'],
  },
  {
    emoji: '👥',
    title: 'Friends & Leaderboard',
    subtitle: 'Better together',
    description:
      'Add friends, compare study stats, and climb the leaderboard. Share study tips, react to achievements, and motivate each other.',
    highlights: ['📈 Study leaderboard', '💬 Activity feed & reactions', '🎯 Study groups & challenges'],
    gradient: ['#E7EFEA', '#D6DEE8'],
  },
  {
    emoji: '🏅',
    title: 'Badges & Progress',
    subtitle: 'Every session counts',
    description:
      'Earn 50+ badges across categories — streaks, study milestones, animals collected, and more. Track your weekly and monthly progress with detailed charts.',
    highlights: ['🥇 50+ unique badges', '📊 Weekly & monthly charts', '🎓 Study by subject tracking'],
    gradient: ['#E7EFEA', '#E0E4E8'],
  },
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { refreshUser } = useAuth();

  const isLastStep = currentStep === onboardingSteps.length;

  const animateTransition = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentStep(next);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length) {
      animateTransition(currentStep + 1);
    }
  };

  const handleComplete = async () => {
    if (!username.trim()) {
      Alert.alert('Username Required', 'Please enter a username to continue');
      return;
    }

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const response = await fetch(
        `${API_URL}/user/username?username=${encodeURIComponent(username.trim())}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to set username' }));
        throw new Error(error.detail || 'Failed to set username');
      }

      await refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLastStep) {
    return (
      <LinearGradient colors={['#E7EFEA', '#DCEAE3']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.usernameContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.usernameIconWrap}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.usernameIconCircle}
              >
                <Text style={styles.usernameEmoji}>🌿</Text>
              </LinearGradient>
            </View>

            <Text style={styles.stepTitle}>Choose Your Username</Text>
            <Text style={styles.usernameSubtitle}>
              This is how friends will see you on the leaderboard
            </Text>

            <View style={styles.usernameInputWrap}>
              <TextInput
                style={styles.usernameInput}
                placeholder="Enter username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Start My Journey</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const step = onboardingSteps[currentStep];

  return (
    <LinearGradient colors={step.gradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Progress bar */}
          <View style={styles.progressBar}>
            {onboardingSteps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  index <= currentStep && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>

          <Animated.View
            style={[
              styles.stepContent,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Icon */}
            <View style={styles.iconArea}>
              {step.useLottie ? (
                <LottieView
                  source={require('../assets/egg-animation.json')}
                  autoPlay
                  loop
                  style={{ width: 200, height: 200 }}
                />
              ) : (
                <View style={styles.emojiCircle}>
                  <Text style={styles.stepEmoji}>{step.emoji}</Text>
                </View>
              )}
            </View>

            {/* Text */}
            <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>

            {/* Highlight pills */}
            {step.highlights && (
              <View style={styles.highlightsWrap}>
                {step.highlights.map((h, i) => (
                  <View key={i} style={styles.highlightPill}>
                    <Text style={styles.highlightText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Bottom buttons */}
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>
                  {currentStep === onboardingSteps.length - 1 ? "Let's Go!" : 'Next'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => animateTransition(onboardingSteps.length)}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },

  // Progress bar
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(95,140,135,0.15)',
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },

  // Step content
  stepContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Icon
  iconArea: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  stepEmoji: {
    fontSize: 64,
  },

  // Text
  stepSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  stepDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },

  // Highlights
  highlightsWrap: {
    width: '100%',
    gap: 8,
  },
  highlightPill: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  highlightText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Bottom
  bottomButtons: {
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.medium,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },

  // Username step
  usernameContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  usernameIconWrap: {
    marginBottom: spacing.xl,
  },
  usernameIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  usernameEmoji: {
    fontSize: 48,
  },
  usernameSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  usernameInputWrap: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  usernameInput: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.small,
  },
});
