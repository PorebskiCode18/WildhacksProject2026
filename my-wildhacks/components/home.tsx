import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig'; 
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'expo-router';

const QUICK_ACTIONS = [
  { id: '1', icon: 'calendar', label: 'Calendar', path: '/calendar' },
  { id: '2', icon: 'list', label: 'Priorities', path: '/priorities' }, 
];

export default function Home() {
  const router = useRouter();
  const [userData, setUserData] = useState({ firstName: 'User', username: '' });
  
  // Theme States
  const [themeColor, setThemeColor] = useState('#ff9d33'); 
  const [lightMode, setLightMode] = useState(false); // Updated from pureBlackMode

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Fetch User Data (firstName)
    const fetchUser = async () => {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserData({ firstName: data.firstName, username: data.username });
      }
    };
    fetchUser();

    // 2. Real-time Theme Listener
    const unsubTheme = onSnapshot(doc(db, 'users', user.uid, 'settings', 'eventConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.themeColor) setThemeColor(data.themeColor);
        if (data.lightMode !== undefined) setLightMode(data.lightMode); // Listen for lightMode
      }
    });

    return () => unsubTheme();
  }, []);

  // Helper for text visibility on changing backgrounds
  const dynamicColor = lightMode ? '#000000' : '#FFFFFF';
  const cardBg = lightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
  const cardBorder = lightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.08)';

  return (
    <View style={styles.container}>
      {/* Background Gradient: Sunrise logic */}
      <LinearGradient 
        colors={
          lightMode 
            ? ['#FFFFFF', '#FFFFFF', themeColor] 
            : ['#000000', themeColor + '10', themeColor + '30', themeColor + '60']
        } 
        locations={[0, 0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill} 
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: lightMode ? '#666' : '#aaa' }]}>Welcome back,</Text>
              <Text style={[styles.username, { color: dynamicColor }]}>{userData.firstName}</Text>
            </View>
            <Pressable 
              style={[styles.profileBadge, { backgroundColor: themeColor + '22', borderColor: themeColor + '44' }]}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person" size={20} color={themeColor} />
            </Pressable>
          </View>

          {/* Featured Card */}
          <View style={[styles.glassCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.cardTitle, { color: themeColor }]}>Upcoming Task</Text>
            <Text style={[styles.cardSubtitle, { color: dynamicColor }]}>Design Calendar UI</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '70%', backgroundColor: themeColor }]} />
            </View>
          </View>

          {/* Quick Actions Grid */}
          <Text style={[styles.sectionTitle, { color: dynamicColor }]}>Quick Actions</Text>
          <View style={styles.grid}>
            {QUICK_ACTIONS.map((action) => (
              <ActionSquare 
                key={action.id} 
                icon={action.icon} 
                label={action.label} 
                themeColor={themeColor}
                dynamicColor={dynamicColor}
                cardBg={cardBg}
                cardBorder={cardBorder}
                onPress={() => router.replace(action.path as any)} 
              />
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActionSquare({ icon, label, onPress, themeColor, dynamicColor, cardBg, cardBorder }: any) {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.actionSquare,
        { 
          opacity: pressed ? 0.7 : 1,
          backgroundColor: cardBg,
          borderColor: cardBorder
        }
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={28} color={themeColor} />
      <Text style={[styles.actionLabel, { color: dynamicColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 30,
  },
  greeting: { fontSize: 16 },
  username: { fontSize: 24, fontWeight: '700' },
  profileBadge: {
    width: 45,
    height: 45,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 30,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardSubtitle: { fontSize: 22, fontWeight: '600', marginVertical: 10 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(120, 120, 120, 0.1)',
    borderRadius: 3,
    marginTop: 10,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionSquare: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
  },
  actionLabel: { marginTop: 10, fontWeight: '500' },
});
