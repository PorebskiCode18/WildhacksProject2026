import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 1. Define your Props interface (since it's TypeScript)
interface Props {
  title?: string;
}

// 2. Define the Component
const profile = ({ title = "Profile" }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
};

// 3. Define the Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
  },
});

// 4. Export the Component
export default profile;
