import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ThemeColors } from '../constants/theme';

interface Props extends ViewProps {
  isDark: boolean;
}

export function ScreenWrapper({ isDark, children, style, ...props }: Props) {
  const theme = isDark ? ThemeColors.dark : ThemeColors.light;

  return (
    <View style={[styles.container, style]} {...props}>
      <LinearGradient
        colors={theme.gradient}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style={theme.statusBar} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
