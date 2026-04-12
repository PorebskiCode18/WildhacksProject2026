import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig'; 
import { doc, getDoc, onSnapshot, collection, query, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';

// NEW: Agent Imports
import { generateScheduleSuggestions, PriorityItem, CalendarEvent } from '../services/ScheduleAgent';

const QUICK_ACTIONS = [
  { id: '1', icon: 'calendar', label: 'Calendar', path: '/calendar' },
  { id: '2', icon: 'list', label: 'Priorities', path: '/priorities' }, 
];

export default function Home() {
  const router = useRouter();
  const [userData, setUserData] = useState({ firstName: 'User', username: '' });
  
  // Theme States
  const [themeColor, setThemeColor] = useState('#ff9d33'); 
  const [lightMode, setLightMode] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false); 

  // Events State
  const [todaysEvents, setTodaysEvents] = useState<any[]>([]);

  // NEW: AI Suggestion States
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedBlocks, setSuggestedBlocks] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Fetch User Data
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
        if (data.lightMode !== undefined) setLightMode(data.lightMode); 
        if (data.is24Hour !== undefined) setIs24Hour(data.is24Hour);
      }
    });

    // 3. Real-time Events Listener (Filtered for Today)
    const q = query(collection(db, 'users', user.uid, 'events'), orderBy('start', 'asc'));
    const unsubEvents = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      snapshot.forEach((doc) => {
        const data = doc.data();
        const eStart = data.start.toDate();
        const eEnd = data.end.toDate();

        if (eStart <= endOfDay && eEnd >= startOfDay) {
          fetched.push({ id: doc.id, ...data, eStart, eEnd });
        }
      });
      setTodaysEvents(fetched);
    });

    return () => {
      unsubTheme();
      unsubEvents();
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !is24Hour });
  };

  // NEW: Fetch AI Suggestions Logic
  const handleSuggestSchedule = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    setIsSuggesting(true);
    setSuggestedBlocks([]); 

    try {
      const pSnap = await getDocs(query(collection(db, 'users', user.uid, 'ranking'), orderBy('index', 'asc')));
      const priorities: PriorityItem[] = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as PriorityItem));

      if (priorities.length === 0) {
        Alert.alert("No Priorities", "Please add some items to your Priorities list first!");
        setIsSuggesting(false);
        return;
      }

      const targetEvents: CalendarEvent[] = todaysEvents.map(e => ({
        id: e.id,
        title: e.title,
        start: e.eStart,
        end: e.eEnd,
        location: e.location || null
      }));

      const now = new Date();
      const targetDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      const suggestions = await generateScheduleSuggestions(targetDateObj, targetEvents, priorities);

      if (suggestions && Array.isArray(suggestions)) {
        setSuggestedBlocks(suggestions);
      } else if (suggestions?.message) {
        Alert.alert("Schedule Full", suggestions.message);
      } else {
        Alert.alert("Error", "Could not generate a schedule at this time.");
      }
    } catch (error) {
      console.error("Agent Error:", error);
      Alert.alert("Error", "Something went wrong communicating with the AI.");
    } finally {
      setIsSuggesting(false);
    }
  };

  // NEW: Accept/Reject Handlers (Using tempId for accuracy)
  const acceptSuggestion = async (suggestion: any) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const eventData = { 
      title: suggestion.suggestedPriorityTitle, 
      location: null,
      start: Timestamp.fromDate(suggestion.gapStart), 
      end: Timestamp.fromDate(suggestion.gapEnd), 
      color: themeColor 
    };
    
    await addDoc(collection(db, 'users', user.uid, 'events'), eventData);
    setSuggestedBlocks(prev => prev.filter(s => s.tempId !== suggestion.tempId));
  };

  const rejectSuggestion = (tempId: string) => {
    setSuggestedBlocks(prev => prev.filter(s => s.tempId !== tempId));
  };

  const dynamicColor = lightMode ? '#000000' : '#FFFFFF';
  const cardBg = lightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
  const cardBorder = lightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.08)';

  return (
    <View style={styles.container}>
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
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

          <View style={[styles.glassCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.cardTitle, { color: themeColor, marginBottom: 0 }]}>Suggested Events</Text>
              
              <Pressable 
                onPress={handleSuggestSchedule} 
                disabled={isSuggesting}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: themeColor + (isSuggesting ? '44' : '22'), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
              >
                {isSuggesting ? (
                  <ActivityIndicator size="small" color={themeColor} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color={themeColor} />
                    <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Auto-Fill</Text>
                  </>
                )}
              </Pressable>
            </View>
            
            {suggestedBlocks.length === 0 && !isSuggesting ? (
              <Text style={{ color: lightMode ? '#888' : '#777', textAlign: 'center', marginVertical: 10, fontSize: 13 }}>
                Tap Auto-Fill to find gaps in your schedule!
              </Text>
            ) : (
              suggestedBlocks.map((sug) => (
                <View key={sug.tempId} style={styles.suggestionItem}>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={[styles.suggestionTitle, { color: dynamicColor }]} numberOfLines={1}>
                      {sug.suggestedPriorityTitle}
                    </Text>
                    <Text style={[styles.suggestionTime, { color: lightMode ? '#666' : '#aaa' }]}>
                      {formatTime(sug.gapStart)} - {formatTime(sug.gapEnd)}
                    </Text>
                  </View>
                  
                  <View style={styles.suggestionActions}>
                    <Pressable 
                      style={[styles.actionButton, { backgroundColor: themeColor + '22' }]}
                      onPress={() => acceptSuggestion(sug)}
                    >
                      <Ionicons name="checkmark" size={18} color={themeColor} />
                    </Pressable>
                    <Pressable 
                      style={[styles.actionButton, { backgroundColor: 'rgba(255, 68, 68, 0.15)' }]}
                      onPress={() => rejectSuggestion(sug.tempId)}
                    >
                      <Ionicons name="close" size={18} color="#ff4444" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={[styles.glassCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.cardTitle, { color: themeColor, marginBottom: 15 }]}>Today's Schedule</Text>
            
            {todaysEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-clear-outline" size={32} color={lightMode ? '#ccc' : '#444'} style={{ marginBottom: 10 }} />
                <Text style={[styles.emptyText, { color: lightMode ? '#888' : '#666' }]}>Your day is clear!</Text>
              </View>
            ) : (
              todaysEvents.map((event, index) => (
                <View key={event.id} style={[styles.todayEventItem, index !== todaysEvents.length - 1 && styles.borderBottom]}>
                  <View style={[styles.eventDot, { backgroundColor: event.color || themeColor }]} />
                  <View style={styles.todayEventDetails}>
                    <Text style={[styles.todayEventTitle, { color: dynamicColor }]} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.todayEventSubInfo}>
                      <Text style={[styles.todayEventTime, { color: lightMode ? '#666' : '#aaa' }]}>
                        {formatTime(event.eStart)} - {formatTime(event.eEnd)}
                      </Text>
                      {event.location ? (
                        <Text style={[styles.todayEventLoc, { color: lightMode ? '#888' : '#777' }]} numberOfLines={1}>
                          <Ionicons name="location" size={16} /> {event.location.address}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

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
  scrollContent: { padding: 24, paddingBottom: 50 },
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
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  suggestionTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionTime: {
    fontSize: 13,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  todayEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  borderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  eventDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 15,
  },
  todayEventDetails: {
    flex: 1,
  },
  todayEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  todayEventSubInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayEventTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  todayEventLoc: {
    fontSize: 16,
    maxWidth: '50%',
  },
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
