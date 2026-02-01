import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

// Cracked Egg Logo Component
const CrackedEggLogo = () => (
  <View style={styles.logoWrapper}>
    <Svg width={160} height={180} viewBox="0 0 180 200">
      <Defs>
        <LinearGradient id="eggShellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FEFEFE" />
          <Stop offset="50%" stopColor="#F5F8F5" />
          <Stop offset="100%" stopColor="#E8EDE9" />
        </LinearGradient>
        <LinearGradient id="innerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.primaryLight} />
          <Stop offset="100%" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      
      {/* Shadow */}
      <Ellipse cx={90} cy={190} rx={60} ry={12} fill="rgba(0,0,0,0.08)" />
      
      {/* Bottom shell piece */}
      <Path
        d="M40 120 C40 120 30 150 35 170 C40 185 60 195 90 195 C120 195 140 185 145 170 C150 150 140 120 140 120 L120 110 L100 125 L80 105 L60 120 Z"
        fill="url(#eggShellGrad)"
        stroke={colors.cardBorder}
        strokeWidth={2}
      />
      
      {/* Inner egg content */}
      <Ellipse cx={90} cy={140} rx={40} ry={35} fill="url(#innerGrad)" opacity={0.3} />
      
      {/* Letter 'e' in the center */}
      <G transform="translate(65, 115)">
        <Path
          d="M25 0 C10 0 0 12 0 25 C0 38 10 50 25 50 C35 50 43 45 48 38 L38 32 C35 36 30 40 25 40 C18 40 12 35 11 28 L50 28 C50 26 50 25 50 25 C50 12 40 0 25 0 M25 10 C32 10 38 14 40 20 L11 20 C13 14 18 10 25 10"
          fill={colors.primary}
        />
      </G>
      
      {/* Top shell piece (cracked off) */}
      <G transform="translate(-15, -25) rotate(-15, 90, 80)">
        <Path
          d="M55 95 C45 60 50 30 90 15 C130 30 135 60 125 95 L110 90 L95 100 L80 88 L65 98 Z"
          fill="url(#eggShellGrad)"
          stroke={colors.cardBorder}
          strokeWidth={2}
        />
        {/* Shine on top piece */}
        <Ellipse cx={75} cy={50} rx={12} ry={18} fill="rgba(255,255,255,0.7)" />
      </G>
    </Svg>
  </View>
);

export default function AuthScreen() {
  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    setIsLogin(false);
    setShowForm(true);
  };

  const handleAlreadyHaveAccount = () => {
    setIsLogin(true);
    setShowForm(true);
  };

  // Initial welcome screen
  if (!showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContent}>
          {/* Brand Area */}
          <View style={styles.brandContainer}>
            <Text style={styles.brandName}>endura</Text>
            <CrackedEggLogo />
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGetStarted}
            >
              <Text style={styles.primaryButtonText}>GET STARTED FOR FREE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleAlreadyHaveAccount}
            >
              <Text style={styles.secondaryButtonText}>ALREADY HAVE AN ACCOUNT?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Login/Register form
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowForm(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {isLogin ? 'Welcome Back!' : 'Create Account'}
            </Text>
            <Text style={styles.formSubtitle}>
              {isLogin 
                ? 'Sign in to continue your journey' 
                : 'Start hatching endangered animals today'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle between login/register */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.toggleText}>
              {isLogin
                ? "Don't have an account? "
                : 'Already have an account? '}
              <Text style={styles.toggleTextBold}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcomeContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  brandContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.primary,
    letterSpacing: 4,
    marginBottom: spacing.lg,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsContainer: {
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  formHeader: {
    marginBottom: spacing.xl,
  },
  formTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  formSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.small,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  toggleTextBold: {
    color: colors.primary,
    fontWeight: '700',
  },
});
