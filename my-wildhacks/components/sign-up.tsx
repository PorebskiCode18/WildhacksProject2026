import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'expo-router'
import { auth } from '../firebaseConfig'

type Props = {
  onSignUp?: (email: string, password: string) => Promise<void> | void
}

export default function SignUp({ onSignUp }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const isEmailValid = email.includes('@')
  const isPasswordValid = password.length >= 6
  const isFormValid = isEmailValid && isPasswordValid

  const handleSignUp = async () => {
    setError(null)
    if (!isFormValid) {
      setError('Please provide a valid email and a password of at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const authInstance = auth
      await createUserWithEmailAndPassword(authInstance, email, password)

      if (onSignUp) await Promise.resolve(onSignUp(email, password))

      router.replace('/(tabs)/home')

    } catch (err) {
      setError((err as any)?.message ?? 'Sign-up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={handleSignUp}
        disabled={loading || !isFormValid}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </Pressable>

      <View style={styles.footerRow}>
        <Text>Already have an account? </Text>
        <Pressable onPress={() => router.push('/sign-in')}>
          <Text style={styles.linkText}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff', // Ensure consistent background
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center', // Ensure consistent title alignment
  },
  input: {
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  button: {
    height: 48,
    backgroundColor: '#0066ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: '#cc0000',
    marginTop: 8,
    textAlign: 'center',
  },
  validationText: {
    color: '#cc0000',
    marginTop: 6,
    fontSize: 13,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { color: '#444' },
  linkText: { color: '#0066ff', fontWeight: '600' },
})
