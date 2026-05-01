import React, { useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Modal,
  Image,
  Linking,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, TextInput } from '../components/StyledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Analytics } from '../services/analytics';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  isAppleSignInAvailable,
  signInWithApple,
  useGoogleAuth,
  submitGoogleIdToken,
  isGoogleConfigured,
} from '../services/oauthLogin';

const { width } = Dimensions.get('window');

const LogoImage = () => (
  <View style={styles.logoWrapper}>
    <Image
      source={require('../assets/icon.png')}
      style={{ width: 200, height: 200, borderRadius: 40 }}
      resizeMode="cover"
    />
    <Text style={styles.brandName}>endura</Text>
  </View>
);

export default function AuthScreen() {
  const route = useRoute<any>();
  const onboardingVariant = route?.params?.onboardingVariant || 'unknown';
  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, checkAuth, hydrateAfterOAuth } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'apple' | 'google'>(null);
  const googleConfigured = isGoogleConfigured();
  const [, googleResponse, googlePrompt] = useGoogleAuth();

  // Email verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const verifyInputRefs = useRef<(RNTextInput | null)[]>([]);

  // Terms consent
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const codeInputRefs = useRef<(RNTextInput | null)[]>([]);

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

  // Verification code handlers
  const handleVerifyCodeChange = (text: string, index: number) => {
    if (text.length > 1) text = text.slice(-1);
    const newCode = [...verifyCode];
    newCode[index] = text;
    setVerifyCode(newCode);
    if (text && index < 5) {
      verifyInputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !verifyCode[index] && index > 0) {
      verifyInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifySubmit = async () => {
    const code = verifyCode.join('');
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the full 6-digit code');
      return;
    }
    setVerifyLoading(true);
    try {
      await authAPI.verifyEmail(email, code);
      await checkAuth();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid or expired code');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyLoading(true);
    try {
      await authAPI.resendVerification(email);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      setVerifyCode(['', '', '', '', '', '']);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not resend code');
    } finally {
      setVerifyLoading(false);
    }
  };

  useEffect(() => {
    Analytics.onboardingAuthViewed(onboardingVariant);
  }, [onboardingVariant]);

  useEffect(() => {
    let cancelled = false;
    isAppleSignInAvailable().then((ok) => {
      if (!cancelled) setAppleAvailable(ok);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') {
        setOauthLoading(null);
        Alert.alert('Google sign-in failed', googleResponse.error?.message || 'Please try again or use email.');
      } else if (googleResponse.type !== 'dismiss') {
        setOauthLoading(null);
      }
      return;
    }
    const idToken = (googleResponse.params as any)?.id_token
      || (googleResponse.authentication as any)?.idToken;
    if (!idToken) {
      setOauthLoading(null);
      Alert.alert('Google sign-in failed', 'Google did not return an identity token.');
      return;
    }
    (async () => {
      try {
        await submitGoogleIdToken(idToken);
        await hydrateAfterOAuth();
      } catch (e: any) {
        Alert.alert('Sign-in failed', e?.message || 'Could not sign in with Google.');
      } finally {
        setOauthLoading(null);
      }
    })();
  }, [googleResponse, hydrateAfterOAuth]);

  const handleApple = async () => {
    setOauthLoading('apple');
    try {
      await signInWithApple();
      await hydrateAfterOAuth();
    } catch (e: any) {
      // ERR_CANCELED is the user backing out of the system sheet.
      if (e?.code !== 'ERR_REQUEST_CANCELED' && e?.code !== 'ERR_CANCELED') {
        Alert.alert('Sign-in failed', e?.message || 'Could not sign in with Apple.');
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading('google');
    try {
      await googlePrompt();
    } catch (e: any) {
      setOauthLoading(null);
      Alert.alert('Sign-in failed', e?.message || 'Could not start Google sign-in.');
    }
  };

  useEffect(() => {
    const clearOldData = async () => {
      try {
        await SecureStore.deleteItemAsync('authToken');
      } catch (e) {
        // No old token to clear
      }
    };
    clearOldData();
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!isLogin && !termsAccepted) {
      Alert.alert('Terms Required', 'Please agree to the Terms of Use and Privacy Policy to create your account.');
      return;
    }
    
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
        setShowVerification(true);
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
      <SafeAreaView style={[styles.container, { backgroundColor: '#c8dbc3' }]}>
        <View style={styles.welcomeContent}>
          <View style={styles.brandContainer}>
            <LogoImage />
          </View>

          <View style={styles.buttonsContainer}>
            {appleAvailable && (
              <View style={{ marginBottom: spacing.md }}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={borderRadius.md}
                  style={styles.appleButton}
                  onPress={handleApple}
                />
                {oauthLoading === 'apple' && (
                  <View style={styles.oauthSpinner}>
                    <ActivityIndicator color={colors.textOnPrimary} />
                  </View>
                )}
              </View>
            )}

            {googleConfigured && (
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogle}
                disabled={oauthLoading !== null}
                activeOpacity={0.85}
              >
                {oauthLoading === 'google' ? (
                  <ActivityIndicator color="#3c4043" />
                ) : (
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                )}
              </TouchableOpacity>
            )}

            {(appleAvailable || googleConfigured) && (
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

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

  // Email verification screen
  if (showVerification) {
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowVerification(false);
                setVerifyCode(['', '', '', '', '', '']);
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.verifyHeader}>
              <View style={styles.verifyIconWrap}>
                <Text style={styles.verifyIcon}>✉️</Text>
              </View>
              <Text style={styles.formTitle}>Verify Your Email</Text>
              <Text style={styles.verifySubtitle}>
                We sent a 6-digit code to{'\n'}
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{email}</Text>
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.codeRow}>
                {verifyCode.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => { verifyInputRefs.current[i] = ref; }}
                    style={[
                      styles.codeInput,
                      digit ? styles.codeInputFilled : null,
                    ]}
                    value={digit}
                    onChangeText={text => handleVerifyCodeChange(text, i)}
                    onKeyPress={e => handleVerifyCodeKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, verifyLoading && styles.buttonDisabled]}
                onPress={handleVerifySubmit}
                disabled={verifyLoading}
              >
                {verifyLoading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Verify & Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResendVerification}
                disabled={verifyLoading}
              >
                <Text style={styles.resendText}>Didn't receive it? <Text style={{ fontWeight: '700', color: colors.primary }}>Resend code</Text></Text>
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowForm(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

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

            {!isLogin && (
              <View style={styles.termsRow}>
                <TouchableOpacity
                  style={[styles.termsCheckbox, termsAccepted && styles.termsCheckboxChecked]}
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  activeOpacity={0.7}
                >
                  {termsAccepted && <Text style={styles.termsCheckmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL('https://endura.eco/terms')}>
                    Terms of Use
                  </Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL('https://endura.eco/privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
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

      <Modal visible={showForgotModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForgotModal}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <DragHandle />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
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
          </ScrollView>
          </KeyboardAvoidingView>
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
    fontSize: 42,
    fontWeight: '700',
    color: '#5F8C87',
    letterSpacing: 0,
    marginTop: spacing.lg,
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
    fontWeight: '600',
    letterSpacing: 1.5,
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
    fontWeight: '500',
    letterSpacing: 1,
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
  codeInputFilled: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  resendText: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Verification screen
  verifyHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  verifyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  verifyIcon: {
    fontSize: 36,
  },
  verifySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  termsCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  oauthSpinner: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  googleButton: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#dadce0',
    flexDirection: 'row',
  },
  googleButtonText: {
    color: '#3c4043',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerLabel: {
    marginHorizontal: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
