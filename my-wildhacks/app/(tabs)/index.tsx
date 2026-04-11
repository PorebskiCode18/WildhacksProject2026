import React from 'react'
import { View, StyleSheet } from 'react-native'
import SignIn from '../../components/sign-in'
import SignUp from '../../components/sign-up'

export default function TabsIndex() {
  return (
    <View style={styles.container}>
      <SignUp />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
