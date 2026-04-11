import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { useRouter } from 'expo-router'
import { auth, db } from '../firebaseConfig'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'

export default function SignUp() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [birthday, setBirthday] = useState('')
  
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  // Dynamic Theme Colors
  const theme = {
    gradient: isDarkMode ? ['#1a1a1a', '#333333'] : ['#FFFDD0', '#ffffff'],
    text: isDarkMode ? '#ffffff' : '#000000',
    inputBg: isDarkMode ? '#222' : '#fff',
    inputBorder: isDarkMode ? '#444' : '#ddd',
    placeholder: isDarkMode ? '#888' : '#999',
    link: isDarkMode ? '#aaa' : '#666',
    status: isDarkMode ? 'light' : 'dark'
  }

  const handleSignUp = async () => {
    setError(null)
    if (!email.includes('@') || password.length < 6 || !username || !firstName) {
      setError('Please fill in all fields (Password min 6 chars)')
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName,
        lastName,
        username: username.toLowerCase(),
        birthday,
        email: email.toLowerCase(),
        createdAt: new Date().toISOString(),
      })
      router.replace('/home')
    } catch (err) {
      setError((err as any)?.message ?? 'Sign-up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <StatusBar style={theme.status as any} />
        <LinearGradient colors={theme.gradient as any} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={{ flex: 1 }}>
          {/* Theme Toggle Button */}
          <View style={styles.headerAction}>
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
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>

            <View style={styles.row}>
              <TextInput
                placeholder="First Name"
                placeholderTextColor={theme.placeholder}
                value={firstName}
                onChangeText={setFirstName}
                style={[styles.input, styles.halfInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
              />
              <TextInput
                placeholder="Last Name"
                placeholderTextColor={theme.placeholder}
                value={lastName}
                onChangeText={setLastName}
                style={[styles.input, styles.halfInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
              />
            </View>

            <TextInput
              placeholder="Username"
              placeholderTextColor={theme.placeholder}
              value={username}
              onChangeText={setUsername}
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
              autoCapitalize="none"
            />

            <TextInput
              placeholder="Birthday (MM/DD/YYYY)"
              placeholderTextColor={theme.placeholder}
              value={birthday}
              onChangeText={setBirthday}
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
            />

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
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push('/sign-in')}>
              <Text style={[styles.link, { color: theme.link }]}>Already have an account? Sign in</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAction: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  halfInput: {
    width: '48%',
    marginBottom: 0,
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
    marginTop: 10,
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
  },
})
