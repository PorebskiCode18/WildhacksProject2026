import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    // Switching to DarkTheme makes the system status bar icons (time, battery) 
    // white by default, which looks better on your dark background.
    <ThemeProvider value={DarkTheme}>
      <Stack initialRouteName="sign-up">
        {/* Hiding headers for your Auth and Home screens */}
        <Stack.Screen 
          name="sign-up" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="sign-in" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="home" 
          options={{ headerShown: false }} 
        />
        
        {/* You can keep it for modals if you want a "Close" button area */}
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal', title: 'Details' }} 
        />
      </Stack>

      <StatusBar style="light" />
    </ThemeProvider>
  )
}
