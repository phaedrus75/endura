import React, { useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const { width } = Dimensions.get('window');

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, checkAuth } = useAuth();

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

  const handleForgotSubmitEmail = async () => {
    if (!forgotEmail) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setForgotLoading(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      setForgotStep('code');
      Alert.alert('Code Sent', 'If an account exists with that email, a 6-digit reset code has been sent.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const code = resetCode.join('');
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the full 6-digit code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setForgotLoading(true);
    try {
      await authAPI.resetPassword(forgotEmail, code, newPassword);
      Alert.alert('Success', 'Your password has been reset!');
      closeForgotModal();
      await checkAuth();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid or expired code');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('email');
    setForgotEmail('');
    setResetCode(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) text = text.slice(-1);
    const newCode = [...resetCode];
    newCode[index] = text;
    setResetCode(newCode);
    if (text && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Clear any stored auth data on mount (debug)
  useEffect(() => {
    const clearOldData = async () => {
      try {
        await SecureStore.deleteItemAsync('authToken');
        console.log('🗑️ Cleared old auth token');
      } catch (e) {
        console.log('No old token to clear');
      }
    };
    clearOldData();
  }, []);

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
            <AnimatedEggLogo />
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

            {isLogin && (
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
              >
                <Text style={styles.forgotButtonText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
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

      <Modal visible={showForgotModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.modalClose} onPress={closeForgotModal}>
              <Text style={{ fontSize: 22, color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>

            {forgotStep === 'email' ? (
              <>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your email and we'll send you a 6-digit code to reset your password.
                </Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.textMuted}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitButton, forgotLoading && styles.buttonDisabled]}
                  onPress={handleForgotSubmitEmail}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.submitButtonText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Enter Code</Text>
                <Text style={styles.modalSubtitle}>
                  We sent a 6-digit code to {forgotEmail}
                </Text>

                <View style={styles.codeRow}>
                  {resetCode.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={ref => { codeInputRefs.current[i] = ref; }}
                      style={styles.codeInput}
                      value={digit}
                      onChangeText={text => handleCodeChange(text, i)}
                      onKeyPress={e => handleCodeKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Min 6 characters"
                    placeholderTextColor={colors.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, forgotLoading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.submitButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={() => {
                    setResetCode(['', '', '', '', '', '']);
                    handleForgotSubmitEmail();
                  }}
                >
                  <Text style={styles.forgotButtonText}>Resend code</Text>
                </TouchableOpacity>
              </>
            )}
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
  forgotButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  forgotButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 48,
    ...shadows.medium,
  },
  modalClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: 8,
  },
  codeInput: {
    flex: 1,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceAlt,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
