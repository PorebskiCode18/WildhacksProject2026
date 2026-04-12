import 'react-native-gesture-handler'; // MUST BE LINE 1
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack initialRouteName="sign-in">
        {/* Auth Screens */}
        
        <Stack.Screen 
          name="sign-up" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="sign-in" 
          options={{ headerShown: false }} 
        />

        {/* This is the important part! 
          We replace home, profile, calendar, etc. with just "(tabs)".
          The Tab Bar handles those internal screens now.
        */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal', title: 'Details' }} 
        />
      </Stack>

      <StatusBar style="light" />
    </ThemeProvider>
  )
}
