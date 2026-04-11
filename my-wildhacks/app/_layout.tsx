import { DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack initialRouteName="sign-up">
        <Stack.Screen name="sign-up" options={{ title: 'Sign Up' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
