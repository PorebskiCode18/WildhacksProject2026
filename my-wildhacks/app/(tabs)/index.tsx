import React from 'react'
import { View, StyleSheet } from 'react-native'
import SignIn from '../../components/sign-in'

export default function TabsIndex() {
  return (
    <View style={styles.container}>
      <SignIn />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
