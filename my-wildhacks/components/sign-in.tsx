import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  Alert,
} from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPhoneNumber } from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useRouter } from 'expo-router';
import { auth, app } from '../firebaseConfig'; 
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

export default function SignIn() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  // Recaptcha Ref for Phone Auth
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  
  // Auth Modes
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
  
  // Email Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Phone Form State
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);

  // Global UI State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const router = useRouter();

  // Dynamic Theme Colors
  const theme = {
    gradient: isDarkMode ? ['#1a1a1a', '#333333'] : ['#FFFDD0', '#ffffff'],
    text: isDarkMode ? '#ffffff' : '#000000',
    inputBg: isDarkMode ? '#222' : '#fff',
    inputBorder: isDarkMode ? '#444' : '#ddd',
    placeholder: isDarkMode ? '#888' : '#999',
    link: isDarkMode ? '#aaa' : '#666',
    status: isDarkMode ? 'light' : 'dark',
    accent: '#0066ff'
  };

  // --- EMAIL LOGIC ---
  const handleEmailSignIn = async () => {
    setError(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Invalid email or password (min 6 chars)');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/home');
    } catch (err) {
      setError((err as any)?.message ?? 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.includes('@')) {
      setError('Please enter your email address in the field above to reset your password.');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Reset Email Sent', `If an account exists, a reset link has been sent to ${email}`);
    } catch (err) {
      setError('Could not send reset email. Please try again later.');
    } finally {
      setResetLoading(false);
    }
  };

  // --- PHONE LOGIC & FORMATTING ---
  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      let formatted = '';
      if (match[1]) formatted = `(${match[1]}`;
      if (match[2]) formatted += `) ${match[2]}`;
      if (match[3]) formatted += `-${match[3]}`;
      setPhoneDisplay(formatted);
    } else {
      setPhoneDisplay(text);
    }
  };

  const handleSendOTP = async () => {
    setError(null);
    const rawPhone = phoneDisplay.replace(/\D/g, ''); 
    
    if (rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const e164Phone = `+1${rawPhone}`; 
      // Pass the invisible recaptcha verifier
      const confirmation = await signInWithPhoneNumber(auth, e164Phone, recaptchaVerifier.current!);
      setConfirmResult(confirmation);
    } catch (err) {
      console.error(err);
      setError((err as any)?.message ?? 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError(null);
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await confirmResult.confirm(otpCode);
      router.replace('/home');
    } catch (err) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'email' ? 'phone' : 'email');
    setError(null);
    setConfirmResult(null); 
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <StatusBar style={theme.status as any} />
        <LinearGradient colors={theme.gradient as any} style={StyleSheet.absoluteFill} />

        {/* Invisible reCAPTCHA Verifier Modal */}
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={app.options}
          attemptInvisibleVerification={true}
        />

        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text }]}>
              {authMode === 'email' ? 'Sign In' : (confirmResult ? 'Enter Code' : 'Phone Sign In')}
            </Text>

            {/* --- EMAIL UI --- */}
            {authMode === 'email' ? (
              <>
                <TextInput
                  placeholder="Email"
                  placeholderTextColor={theme.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <View style={[styles.passwordContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor={theme.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    style={[styles.passwordInput, { color: theme.text }]}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={theme.placeholder} style={styles.eyeIcon} />
                  </Pressable>
                </View>

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable 
                  style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && { opacity: 0.8 }]} 
                  onPress={handleEmailSignIn} disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
                </Pressable>

                <Pressable onPress={() => router.push('/sign-up')}>
                  <Text style={[styles.link, { color: theme.link }]}>Don't have an account? Sign up</Text>
                </Pressable>

                <Pressable onPress={handleForgotPassword} disabled={resetLoading}>
                  {resetLoading ? (
                    <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 15 }} />
                  ) : (
                    <Text style={[styles.link, { color: theme.accent, marginTop: 15 }]}>Forgot Password?</Text>
                  )}
                </Pressable>
              </>
            ) : (
              /* --- PHONE UI --- */
              <>
                {!confirmResult ? (
                  // Step 1: Enter Phone Number
                  <>
                    <TextInput
                      placeholder="(555) 555-5555"
                      placeholderTextColor={theme.placeholder}
                      value={phoneDisplay}
                      onChangeText={handlePhoneChange}
                      style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                      keyboardType="number-pad"
                      maxLength={14} 
                    />
                    
                    {error && <Text style={styles.error}>{error}</Text>}
                    
                    <Pressable 
                      style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && { opacity: 0.8 }]} 
                      onPress={handleSendOTP} disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
                    </Pressable>
                  </>
                ) : (
                  // Step 2: Enter OTP Code
                  <>
                    <Text style={{color: theme.placeholder, textAlign: 'center', marginBottom: 15}}>
                      Code sent to {phoneDisplay}
                    </Text>
                    <TextInput
                      placeholder="123456"
                      placeholderTextColor={theme.placeholder}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    
                    {error && <Text style={styles.error}>{error}</Text>}
                    
                    <Pressable 
                      style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && { opacity: 0.8 }]} 
                      onPress={handleVerifyOTP} disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Sign In</Text>}
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* --- DIVIDER & TOGGLE --- */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: theme.inputBorder }]} />
              <Text style={[styles.dividerText, { color: theme.placeholder, backgroundColor: isDarkMode ? '#1a1a1a' : '#FFFDD0' }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.inputBorder }]} />
            </View>

            <Pressable 
              style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.inputBorder }, pressed && { opacity: 0.7 }]} 
              onPress={toggleAuthMode}
            >
              <Ionicons 
                name={authMode === 'email' ? 'call' : 'mail'} 
                size={20} 
                color={theme.text} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                {authMode === 'email' ? 'Continue with Phone' : 'Continue with Email'}
              </Text>
            </Pressable>

          </View>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 30, textAlign: 'center' },
  input: { borderWidth: 1, padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 12 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  passwordInput: { flex: 1, padding: 15, fontSize: 16 },
  eyeIcon: { paddingHorizontal: 12 },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryButtonText: { fontWeight: '600', fontSize: 16 },
  error: { color: '#ff4444', marginBottom: 10, textAlign: 'center' },
  link: { marginTop: 20, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30, position: 'relative' },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { position: 'absolute', left: '50%', transform: [{ translateX: -12 }], paddingHorizontal: 8, fontSize: 12, fontWeight: '600', zIndex: 1 },
});
