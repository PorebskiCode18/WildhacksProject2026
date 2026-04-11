import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSignIn = async () => {
    setError(null);

    if (!email.includes('@') || password.length < 6) {
      setError('Invalid email or password (min 6 chars)');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);

      // ✅ GO TO HOME
      router.replace('/home');
    } catch (err) {
      setError((err as any)?.message ?? 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={[styles.input, styles.passwordInput]}
        />
        <Pressable onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={24}
            color="#888"
            style={styles.eyeIcon}
          />
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSignIn}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push('/sign-up')}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8, // Reduced margin to minimize space below the password field
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
  },
  eyeIcon: {
    padding: 8, // Reduced padding to shrink the eye icon
  },
  button: {
    backgroundColor: '#0066ff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  link: {
    marginTop: 15,
    textAlign: 'center',
    color: '#0066ff',
    fontWeight: '600',
  },
});
