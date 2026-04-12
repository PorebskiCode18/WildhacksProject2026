import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig'; // Adjust path to your config
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';


const QUICK_ACTIONS = [
  { id: '1', icon: 'calendar', label: 'Calendar', path: '/calendar' },
  { id: '2', icon: 'list', label: 'Priorities', path: '/priorities' }, // This matches priorities.tsx
];

export default function Home() {
  const router = useRouter();
  const [userData, setUserData] = useState({ firstName: 'User', username: '' });

  useEffect(() => {
    // 1. Listen for the Auth state
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 2. Reference the specific document in the "users" collection
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            // 3. Set the state with the actual data from Firestore
            const data = userDocSnap.data();
            setUserData({
              firstName: data.firstName,
              username: data.username,
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#2a1a0a', '#5e3205']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header with Dynamic Firebase Name */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.username}>{userData.firstName}</Text>
            </View>
            <Pressable style={styles.profileBadge}>
              <Ionicons name="person" size={20} color="#ff9d33" />
            </Pressable>
          </View>

          {/* Featured Card */}
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>Upcoming Task</Text>
            <Text style={styles.cardSubtitle}>Design Calendar UI</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '70%' }]} />
            </View>
          </View>

          {/* Refactored Grid Section */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            {QUICK_ACTIONS.map((action) => (
              <ActionSquare 
                key={action.id} 
                icon={action.icon} 
                label={action.label} 
                // Specifically using the path defined in your QUICK_ACTIONS array
                onPress={() => router.replace(action.path as any)} 
              />
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActionSquare({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.actionSquare,
        { opacity: pressed ? 0.7 : 1 }
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={28} color="#ff9d33" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 30,
  },
  greeting: { color: '#aaa', fontSize: 16 },
  username: { color: '#fff', fontSize: 24, fontWeight: '700' },
  profileBadge: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 157, 51, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 51, 0.3)',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 30,
  },
  cardTitle: {
    color: '#ff9d33',
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardSubtitle: { color: '#fff', fontSize: 22, fontWeight: '600', marginVertical: 10 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginTop: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#ff9d33', borderRadius: 3 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 15 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionSquare: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionLabel: { color: '#eee', marginTop: 10, fontWeight: '500' },
});
