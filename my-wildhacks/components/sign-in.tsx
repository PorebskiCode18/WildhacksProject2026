import React, { useState } from 'react';
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
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

export default function SignIn() {
  // Theme State
  
const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // Dynamic Theme Colors (Matches your Sign Up page)
  const theme = {
    gradient: isDarkMode ? ['#1a1a1a', '#333333'] : ['#FFFDD0', '#ffffff'],
    text: isDarkMode ? '#ffffff' : '#000000',
    inputBg: isDarkMode ? '#222' : '#fff',
    inputBorder: isDarkMode ? '#444' : '#ddd',
    placeholder: isDarkMode ? '#888' : '#999',
    link: isDarkMode ? '#aaa' : '#666',
    status: isDarkMode ? 'light' : 'dark'
  };

  const handleSignIn = async () => {
    setError(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Invalid email or password');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/home');
    } catch (err) {
      setError('Invalid Email or Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <StatusBar style={theme.status as any} />
        <LinearGradient colors={theme.gradient as any} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={{ flex: 1 }}>
          {/* Theme Toggle Icon */}
          {/* <View style={styles.headerAction}>
            <Pressable 
              onPress={() => setIsDarkMode(!isDarkMode)}
              style={[styles.iconCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            >
              <Ionicons 
                name={isDarkMode ? 'sunny' : 'moon'} 
                size={24} 
                color={theme.text} 
              />
            </Pressable>
          </View> */}

          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>

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
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={theme.placeholder}
                  style={styles.eyeIcon}
                />
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable 
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.8 }
              ]} 
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push('/sign-up')}>
              <Text style={[styles.link, { color: theme.link }]}>Don't have an account? Sign up</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAction: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 30, // Lowered icon as requested previously
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 12, 
  },
  button: {
    backgroundColor: '#0066ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: '#ff4444',
    marginBottom: 10,
    textAlign: 'center',
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
