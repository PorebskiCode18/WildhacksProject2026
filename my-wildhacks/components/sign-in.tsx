import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigation } from '@react-navigation/native'

type Props = {
  onSignIn?: (email: string, password: string) => Promise<void> | void
}

export default function SignIn({ onSignIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigation = useNavigation<any>()
  const isEmailValid = email.includes('@')
  const isPasswordValid = password.length >= 6
  const isFormValid = isEmailValid && isPasswordValid

  const handleSignIn = async () => {
    setError(null)
    if (!isFormValid) {
      setError('Please provide a valid email and a password of at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const auth = getAuth()
      await signInWithEmailAndPassword(auth, email, password)
      if (onSignIn) await Promise.resolve(onSignIn(email, password))
      navigation.reset({ index: 0, routes: [{ name: '(tabs)' }] })
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
        accessible
        accessibilityLabel="email"
      />
      {email && !isEmailValid ? (
        <Text style={styles.validationText}>Enter a valid email address.</Text>
      ) : null}

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        accessible
        accessibilityLabel="password"
      />
      {password && !isPasswordValid ? (
        <Text style={styles.validationText}>Password must be at least 6 characters.</Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleSignIn}
        disabled={loading || !isFormValid}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <Pressable onPress={() => navigation.navigate('sign-up')}>
          <Text style={styles.linkText}>Sign up</Text>
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
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
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
