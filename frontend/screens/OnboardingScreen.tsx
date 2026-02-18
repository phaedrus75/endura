import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../services/api';

const { width } = Dimensions.get('window');

const onboardingSteps = [
  {
    useLottie: true, // Use Lottie animation for the egg
    title: 'Welcome to Endura',
    description: 'Turn your study sessions into a game. Earn coins, hatch eggs, and build a collection of endangered animals!',
  },
  {
    emoji: '⏱️',
    title: 'Study Timer',
    description: 'Set a timer for your study sessions. Complete the timer to earn coins. Longer sessions = more coins!',
  },
  {
    emoji: '🦁',
    title: 'Hatch Animals',
    description: 'Your coins automatically contribute to hatching eggs. Each egg reveals an endangered animal for your collection.',
  },
  {
    emoji: '🏆',
    title: 'Compete & Connect',
    description: 'Add friends, climb the leaderboard, and motivate each other to study more!',
  },
];

// Decorative grass for bottom of screen
const GrassDecoration = () => (
  <View style={styles.grassContainer}>
    <Svg width={width} height={120} viewBox={`0 0 ${width} 120`}>
      <Defs>
        <LinearGradient id="grassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.grass} />
          <Stop offset="100%" stopColor={colors.grassDark} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={width * 0.5} cy={140} rx={width * 0.8} ry={100} fill="url(#grassGrad)" />
    </Svg>
  </View>
);

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { refreshUser } = useAuth();

  const isLastStep = currentStep === onboardingSteps.length;

  const handleNext = () => {
    if (currentStep < onboardingSteps.length) {
      setCurrentStep(currentStep + 1);
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to set username' }));
        throw new Error(error.detail || 'Failed to set username');
      }

      await refreshUser();
    } catch (error: any) {
      const message = error?.message || 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLastStep) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.stepEmoji}>👤</Text>
          </View>
          
          <Text style={styles.stepTitle}>Choose Your Username</Text>
          <Text style={styles.stepDescription}>
            This is how you'll appear to friends on the leaderboard
          </Text>

          <View style={styles.usernameContainer}>
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
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Start Studying! 🚀</Text>
            )}
          </TouchableOpacity>
        </View>
        <GrassDecoration />
      </SafeAreaView>
    );
  }

  const step = onboardingSteps[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {onboardingSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        <View style={styles.iconContainer}>
          {step.useLottie ? (
            <LottieView
              source={require('../assets/egg-animation.json')}
              autoPlay
              loop
              style={{ width: 180, height: 180 }}
            />
          ) : (
            <Text style={styles.stepEmoji}>{step.emoji}</Text>
          )}
        </View>
        
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => setCurrentStep(onboardingSteps.length)}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>
      <GrassDecoration />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: 120,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: 6,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 28,
  },
  progressDotComplete: {
    backgroundColor: colors.primaryLight,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.medium,
  },
  stepEmoji: {
    fontSize: 72,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  stepDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    padding: spacing.md,
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  usernameContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  usernameInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.small,
  },
  grassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
