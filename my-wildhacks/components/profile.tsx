import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  Pressable, 
  Switch, 
  Image, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const APP_THEMES = [
  { name: 'Sandstone', color: '#8e7d71' },
  { name: 'Slate', color: '#71828e' },
  { name: 'Sage', color: '#7d8e71' },
  { name: 'Mauve', color: '#8e7182' },
  { name: 'Steel', color: '#718e8e' },
  { name: 'Amber', color: '#d4a373' }, 
  { name: 'Sky', color: '#7fb3d5' },   
  { name: 'Mint', color: '#82c4a2' },  
  { name: 'Rose', color: '#d98da3' },  
  { name: 'Violet', color: '#a393eb' },
  { name: 'Amber Glow', color: '#ff8c00' }, 
  { name: 'Sunset Red', color: '#ff4444' },    
  { name: 'Ocean Blue', color: '#00d4ff' },   
  { name: 'Neon Pink', color: '#ff00ff' },   
  { name: 'Royal Purple', color: '#BB66FF' }, 
];

export default function ProfileScreen() {
  const user = auth.currentUser;
  
  const [is24Hour, setIs24Hour] = useState(false);
  const [lightMode, setLightMode] = useState(false); 
  const [themeColor, setThemeColor] = useState('#1a0f0a');

  useEffect(() => {
    if (!user) return;
    
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'settings', 'eventConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIs24Hour(data.is24Hour || false);
        setLightMode(data.lightMode || false); 
        setThemeColor(data.themeColor || '#1a0f0a');
      }
    });

    return () => unsub();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'settings', 'eventConfig'), {
      [key]: value
    }, { merge: true });
  };

  const handleLogout = () => signOut(auth);

  // Theme Helpers
  const dynamicContentColor = lightMode ? '#000' : '#fff';
  
  // Implementation of your requested transparency logic
  const dynamicCardBg = lightMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.04)';
  const dynamicBorder = lightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.06)';

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={lightMode ? ['#FFFFFF', '#FFFFFF', themeColor] : ['#000000', '#000000', themeColor]} 
        locations={[0, 0.15, 1]}
        style={StyleSheet.absoluteFill} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={[styles.avatarBorder, { borderColor: themeColor === '#161616' ? '#333' : themeColor }]}>
            <Image 
              source={{ uri: user?.photoURL || 'https://via.placeholder.com/150' }} 
              style={styles.avatar} 
            />
          </View>
          <Text style={[styles.userName, { color: dynamicContentColor }]}>{user?.displayName || 'Calendar User'}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.statusText}>Cloud Synced</Text>
          </View>
        </View>

        {/* Section: App Atmosphere */}
        <Text style={styles.sectionLabel}>App Atmosphere</Text>
        <View style={[styles.card, { backgroundColor: dynamicCardBg, borderColor: dynamicBorder }]}>
          <Text style={styles.cardSubText}>Select a theme to define your workspace vibe</Text>
          <View style={styles.themeGrid}>
            {APP_THEMES.map((t, index) => (
              <Pressable 
                key={`${t.color}-${index}`} 
                onPress={() => updateSetting('themeColor', t.color)}
                style={[
                  styles.themeCircle, 
                  { 
                    backgroundColor: t.color, 
                    borderColor: themeColor === t.color ? dynamicContentColor : 'rgba(255,255,255,0.1)',
                  }
                ]} 
              >
                {themeColor === t.color && (
                  <Ionicons name="checkmark" size={20} color={lightMode ? "#000" : "#fff"} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Section: Appearance Switches */}
        <View style={[styles.card, { backgroundColor: dynamicCardBg, borderColor: dynamicBorder }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name={lightMode ? "sunny-outline" : "moon-outline"} size={22} color={dynamicContentColor} />
              <Text style={[styles.settingText, { color: dynamicContentColor }]}>Light Mode Top</Text>
            </View>
            <Switch 
              value={lightMode} 
              onValueChange={(val) => updateSetting('lightMode', val)}
              trackColor={{ false: '#333', true: themeColor }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Section: Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={[styles.card, { backgroundColor: dynamicCardBg, borderColor: dynamicBorder }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="time-outline" size={22} color={dynamicContentColor} />
              <Text style={[styles.settingText, { color: dynamicContentColor }]}>24-Hour Time</Text>
            </View>
            <Switch 
              value={is24Hour} 
              onValueChange={(val) => updateSetting('is24Hour', val)}
              trackColor={{ false: '#333', true: themeColor }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Section: Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <Pressable 
          style={[styles.card, { backgroundColor: dynamicCardBg, borderColor: dynamicBorder }]} 
          onPress={handleLogout}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="log-out-outline" size={22} color="#ff4444" />
              <Text style={[styles.settingText, { color: '#ff4444' }]}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </View>
        </Pressable>

        <Text style={styles.versionText}>Gemini Calendar v1.1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 50 },
  header: { alignItems: 'center', marginBottom: 35 },
  avatarBorder: { padding: 4, borderRadius: 60, borderWidth: 2, marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#222' },
  userName: { fontSize: 24, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: 'rgba(0, 255, 0, 0.08)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00ff00', marginRight: 6 },
  statusText: { color: '#00ff00', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sectionLabel: { color: '#666', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginLeft: 10, marginBottom: 10, marginTop: 25 },
  cardSubText: { color: '#888', fontSize: 12, marginBottom: 15, textAlign: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' },
  themeCircle: { width: '18%', aspectRatio: 1, borderRadius: 25, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  card: { borderRadius: 24, padding: 18, borderWidth: 1, marginBottom: 12, overflow: 'hidden' }, // Base styles here
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingInfo: { flexDirection: 'row', alignItems: 'center' },
  settingText: { fontSize: 16, fontWeight: '500', marginLeft: 15 },
  versionText: { color: '#333', textAlign: 'center', marginTop: 40, fontSize: 12, fontWeight: '600' }
});
