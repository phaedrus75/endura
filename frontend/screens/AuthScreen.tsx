import React, { useState, useEffect } from 'react';
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
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

type RecoveryMode = 'forgot' | 'reset' | null;

function parseResetTokenFromUrl(url: string): string | null {
  const m = url.match(/[?&]token=([^&]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function validateNewPassword(p: string): string | null {
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(p)) return 'Password must contain at least one letter';
  if (!/\d/.test(p)) return 'Password must contain at least one number';
  return null;
}

// Animated Egg Logo Component using Lottie
const AnimatedEggLogo = () => (
  <View style={styles.logoWrapper}>
    <LottieView
      source={require('../assets/egg-animation.json')}
      autoPlay
      loop
      style={{ width: 240, height: 240 }}
    />
  </View>
);

export default function AuthScreen() {
  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  useEffect(() => {
    function handleIncomingUrl(url: string | null) {
      if (!url) return;
      const token = parseResetTokenFromUrl(url);
      if (!token) return;
      if (url.includes('reset-password') || url.includes('token=')) {
        setShowForm(true);
        setIsLogin(true);
        setRecoveryMode('reset');
        setResetToken(token);
      }
    }
    Linking.getInitialURL().then(handleIncomingUrl);
    const sub = Linking.addEventListener('url', (e) => handleIncomingUrl(e.url));
    return () => sub.remove();
  }, []);

  const goBack = () => {
    if (recoveryMode) {
      setRecoveryMode(null);
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      return;
    }
    setShowForm(false);
  };

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

  const handleForgotSend = async () => {
    const e = email.trim();
    if (!e) {
      Alert.alert('Email required', 'Enter the email for your account.');
      return;
    }
    if (!e.includes('@') || !e.includes('.')) {
      Alert.alert(
        'Complete email required',
        'Use your full address, e.g. aseem.munshi@gmail.com (include @ and the domain).',
      );
      return;
    }
    setIsLoading(true);
    try {
      await authAPI.forgotPassword(e);
      Alert.alert(
        'Check your email',
        'If an account exists for that address, we sent reset instructions. You can enter the code on the next screen.',
        [
          { text: 'OK' },
          {
            text: 'Enter reset code',
            onPress: () => setRecoveryMode('reset'),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    const e = email.trim();
    const tok = resetToken.trim();
    if (!e || !tok) {
      Alert.alert('Missing fields', 'Enter your email and the reset code from your email.');
      return;
    }
    const v = validateNewPassword(newPassword);
    if (v) {
      Alert.alert('Password', v);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password', 'Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await authAPI.resetPassword(e, tok, newPassword);
      Alert.alert('Success', 'Your password was updated. Sign in with your new password.', [
        {
          text: 'OK',
          onPress: () => {
            setRecoveryMode(null);
            setPassword(newPassword);
            setResetToken('');
            setNewPassword('');
            setConfirmPassword('');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    setIsLogin(false);
    setRecoveryMode(null);
    setShowForm(true);
  };

  const handleAlreadyHaveAccount = () => {
    setIsLogin(true);
    setRecoveryMode(null);
    setShowForm(true);
  };

  // Initial welcome screen
  if (!showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContent}>
          <View style={styles.brandContainer}>
            <Text style={styles.brandName}>endura</Text>
            <AnimatedEggLogo />
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleGetStarted}>
              <Text style={styles.primaryButtonText}>GET STARTED FOR FREE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleAlreadyHaveAccount}>
              <Text style={styles.secondaryButtonText}>ALREADY HAVE AN ACCOUNT?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Forgot password
  if (recoveryMode === 'forgot') {
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
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Forgot password</Text>
              <Text style={styles.formSubtitle}>
                We will email you a reset code if an account exists for this address.
              </Text>
            </View>

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

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.buttonDisabled]}
                onPress={handleForgotSend}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Send reset email</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setRecoveryMode('reset')}
            >
              <Text style={styles.toggleText}>
                Already have a code?{' '}
                <Text style={styles.toggleTextBold}>Enter reset code</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Reset password (code + new password)
  if (recoveryMode === 'reset') {
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
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New password</Text>
              <Text style={styles.formSubtitle}>
                Paste the code from your email, then choose a new password (8+ characters, with a
                letter and a number).
              </Text>
            </View>

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
                <Text style={styles.inputLabel}>Reset code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Paste code from email"
                  placeholderTextColor={colors.textMuted}
                  value={resetToken}
                  onChangeText={setResetToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.buttonDisabled]}
                onPress={handleResetSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Update password</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
            <Text style={styles.formSubtitle}>
              {isLogin
                ? 'Sign in to continue your journey'
                : 'Start hatching endangered animals today'}
            </Text>
          </View>

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

            {isLogin && (
              <TouchableOpacity
                style={styles.forgotLinkWrap}
                onPress={() => setRecoveryMode('forgot')}
              >
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

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

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setRecoveryMode(null);
              setIsLogin(!isLogin);
            }}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleTextBold}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
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
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  forgotLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
