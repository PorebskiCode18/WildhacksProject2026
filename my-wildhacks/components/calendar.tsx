import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TextInput, 
  Pressable, 
  ScrollView, 
  Dimensions, 
  Animated, 
  PanResponder,
  Modal 
} from 'react-native';
import { CalendarList } from 'react-native-calendars';
import { 
  collection, addDoc, query, onSnapshot, orderBy, Timestamp, 
  deleteDoc, updateDoc, doc, getDoc, setDoc 
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; 
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';


// ScheduleAgent Imports
import { ActivityIndicator, Alert } from 'react-native'; // Add ActivityIndicator and Alert
import { getDocs } from 'firebase/firestore'; // Add getDocs
import { generateScheduleSuggestions, PriorityItem, CalendarEvent } from '../services/ScheduleAgent'; // Import the agent

// Map Imports
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_OPEN_Y = SCREEN_HEIGHT * 0.1; 
const DRAWER_CLOSED_Y = SCREEN_HEIGHT;
const HOUR_HEIGHT = 80;

const COLOR_PRESETS = ['#ff8c00', '#ff4444', '#00d4ff', '#ccff00', '#ff00ff', '#ffffff', '#8e44ad'];

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export default function FullCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // ScheduleAgent States
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedBlocks, setSuggestedBlocks] = useState<any[]>([]);
  
  // Customization & Global States
  const [themeColor, setThemeColor] = useState('#ff8c00');
  const [is24Hour, setIs24Hour] = useState(false); 
  const [lightMode, setLightMode] = useState(false); 
  const [categoryLabels, setCategoryLabels] = useState<any>({
    '#ff8c00': 'General', '#ff4444': 'Urgent', '#00d4ff': 'Social', 
    '#ccff00': 'Health', '#ff00ff': 'Personal', '#ffffff': 'Other', '#8e44ad': 'Work'
  });

  const dynamicColor = lightMode ? '#000000' : '#FFFFFF';

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState<LocationData | null>(null); // Replaced String with Object
  const [eventColor, setEventColor] = useState('#ff8c00');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Maps & Location State
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);
  const [tempLocation, setTempLocation] = useState<LocationData | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const translateY = useRef(new Animated.Value(DRAWER_CLOSED_Y)).current;

  const dynamicTheme = useMemo(() => ({
    calendarBackground: 'transparent',
    textSectionTitleColor: themeColor,
    dayTextColor: dynamicColor,
    monthTextColor: themeColor,
    textMonthFontWeight: '700' as const,
    textMonthFontSize: 22,
    todayTextColor: themeColor,
    arrowColor: themeColor,
  }), [themeColor, lightMode]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => { if (gestureState.dy > 0) translateY.setValue(DRAWER_OPEN_Y + gestureState.dy); },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) closeDrawer();
        else openDrawer();
      },
    })
  ).current;

  const openDrawer = () => { setIsDrawerOpen(true); Animated.spring(translateY, { toValue: DRAWER_OPEN_Y, useNativeDriver: true, tension: 50, friction: 10 }).start(); };
  const closeDrawer = () => { Animated.timing(translateY, { toValue: DRAWER_CLOSED_Y, duration: 250, useNativeDriver: true }).start(() => setIsDrawerOpen(false)); };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    const unsubEvents = onSnapshot(query(collection(db, 'users', user.uid, 'events'), orderBy('start', 'asc')), (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach((doc) => fetched.push({ id: doc.id, ...doc.data() }));
      setAllEvents(fetched);
    });

    const unsubSettings = onSnapshot(doc(db, 'users', user.uid, 'settings', 'eventConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.labels) setCategoryLabels(data.labels);
        if (data.themeColor) setThemeColor(data.themeColor);
        if (data.is24Hour !== undefined) setIs24Hour(data.is24Hour);
        if (data.lightMode !== undefined) setLightMode(data.lightMode);
      }
    });

    return () => { unsubEvents(); unsubSettings(); };
  }, []);

  const saveGlobalSettings = async (newTheme?: string, newLabels?: any) => {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'settings', 'eventConfig'), {
      themeColor: newTheme || themeColor,
      labels: newLabels || categoryLabels
    }, { merge: true });
  };

  const handleSaveEvent = async () => {
    if (!eventTitle.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    const eventData = { 
      title: eventTitle, 
      location: eventLocation, // Now an object
      start: Timestamp.fromDate(startTime), 
      end: Timestamp.fromDate(endTime), 
      color: eventColor 
    };
    if (editingEventId) await updateDoc(doc(db, 'users', user.uid, 'events', editingEventId), eventData);
    else await addDoc(collection(db, 'users', user.uid, 'events'), eventData);
    resetForm();
  };

  const handleDeleteEvent = async () => {
    const user = auth.currentUser;
    if (user && editingEventId) { await deleteDoc(doc(db, 'users', user.uid, 'events', editingEventId)); resetForm(); }
  };

  const resetForm = () => { 
    setEventTitle(''); 
    setEventLocation(null); 
    setEditingEventId(null); 
    setShowAddModal(false); 
  };

  const handleSuggestSchedule = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    setIsSuggesting(true);
    setSuggestedBlocks([]); // Clear old suggestions

    try {
      // 1. Fetch the user's priorities

      const pSnap = await getDocs(query(collection(db, 'users', user.uid, 'ranking'), orderBy('index', 'asc')));
      const priorities: PriorityItem[] = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as PriorityItem));


console.log("Sorted Priorities:", priorities);
      if (priorities.length === 0) {
        Alert.alert("No Priorities", "Please add some items to your Priorities list first!");
        setIsSuggesting(false);
        return;
      }

      // 2. Format today's events for the AI
      const targetDateObj = new Date(selectedDate + 'T00:00:00');
      const targetEvents: CalendarEvent[] = allEvents
        .filter(e => isEventOnDay(e, selectedDate))
        .map(e => ({
          id: e.id,
          title: e.title,
          start: e.start.toDate(),
          end: e.end.toDate(),
          location: e.location || null
        }));

      // 3. Call the Agent
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

  const acceptSuggestion = async (suggestion: any) => {
    const user = auth.currentUser;
    if (!user) return;
    
    // Save to Firestore
    const eventData = { 
      title: suggestion.suggestedPriorityTitle, 
      location: null, // You can look this up from priorities if needed
      start: Timestamp.fromDate(suggestion.gapStart), 
      end: Timestamp.fromDate(suggestion.gapEnd), 
      color: '#00d4ff' // Default AI color, e.g., 'Social' or 'Health'
    };
    await addDoc(collection(db, 'users', user.uid, 'events'), eventData);
    
    // Remove from suggestions array
    setSuggestedBlocks(prev => prev.filter(s => s.gapIndex !== suggestion.gapIndex));
  };

  const isEventOnDay = (event: any, dateString: string) => {
    const dStart = new Date(dateString + 'T00:00:00');
    const dEnd = new Date(dateString + 'T23:59:59');
    return event.start.toDate() <= dEnd && event.end.toDate() >= dStart;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !is24Hour });
  };

  const onPickerChange = (event: any, val?: Date) => {
    setShowStartPicker(false); setShowEndPicker(false);
    if (!val || event.type === 'dismissed') return;
    if (showStartPicker) {
      setStartTime(val);
      if (pickerMode === 'date') { setPickerMode('time'); setTimeout(() => setShowStartPicker(true), 150); }
    } else {
      setEndTime(val);
      if (pickerMode === 'date') { setPickerMode('time'); setTimeout(() => setShowEndPicker(true), 150); }
    }
  };

  // Maps Modal Logic
  const openLocationPicker = () => {
    setTempLocation(eventLocation);
    if (eventLocation) {
      setMapRegion({
        ...mapRegion,
        latitude: eventLocation.lat,
        longitude: eventLocation.lng,
      });
    }
    setLocationModalVisible(true);
  };

  const confirmLocation = () => {
    setEventLocation(tempLocation);
    setLocationModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={lightMode ? ['#FFFFFF', '#FFFFFF', themeColor] : ['#000000', '#000000', themeColor + '15', themeColor + '40']} 
        locations={[0, 0.15, 0.8, 1]}
        style={StyleSheet.absoluteFill} 
      />
      
      <CalendarList 
        key={`${themeColor}-${lightMode}`}
        theme={dynamicTheme} horizontal pagingEnabled calendarWidth={SCREEN_WIDTH}
        dayComponent={({date, state}: any) => {
          const dayEvents = allEvents.filter(e => isEventOnDay(e, date.dateString)).slice(0, 3);
          return (
            <Pressable style={[styles.dayBox, { borderColor: lightMode ? 'rgba(0,0,0,0.05)' : '#221a15' ,backgroundColor: lightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.4)'}, state==='today' && {borderColor: themeColor}]} onPress={()=>{setSelectedDate(date.dateString); openDrawer();}}>
              <Text style={[styles.dayText, { color: dynamicColor }, state==='disabled' && {color: lightMode ? '#ccc' : '#444'}]}>{date.day}</Text>
              <View style={styles.miniEventContainer}>
                {dayEvents.map((e, i) => <Text key={i} style={[styles.miniEventText, {color: e.color || themeColor}]} numberOfLines={1}>• {e.title}</Text>)}
              </View>
            </Pressable>
          );
        }}
        renderHeader={(date) => (
          <View>
            <Text style={[styles.monthHeader, { color: themeColor }]}>{date.toString('MMMM yyyy')}</Text>
          </View>
        )}
      />

      <Pressable style={[styles.fab, { backgroundColor: themeColor }]} onPress={() => { setEditingEventId(null); setEventTitle(''); setEventLocation(null); setEventColor(themeColor); setStartTime(new Date()); setEndTime(new Date(Date.now()+3600000)); setShowAddModal(true); }}>
        <Ionicons name="add" size={32} color="white" />
      </Pressable>

      {isDrawerOpen && (
        <Animated.View style={[styles.drawerContent, { backgroundColor: lightMode ? '#f5f5f5' : '#161616', transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          <View style={styles.dragHandleContainer}><View style={styles.dragHandle} /></View>
          <View style={styles.timelineHeader}>
            <View>
              <Text style={[styles.dateLabel, { color: dynamicColor }]}>{selectedDate}</Text>
              <Text style={[styles.dateSubLabel, { color: themeColor }]}>Schedule</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <Pressable 
                onPress={handleSuggestSchedule} 
                style={[styles.aiButton, { backgroundColor: isSuggesting ? '#555' : '#8e44ad' }]} 
                disabled={isSuggesting}
              >
                {isSuggesting ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="sparkles" size={16} color="#fff" /><Text style={styles.aiButtonText}> Auto-Fill</Text></>}
              </Pressable>
              <Pressable onPress={() => { setEditingEventId(null); setEventTitle(''); setEventLocation(null); setShowAddModal(true); }}>
                <Ionicons name="add-circle" size={40} color={themeColor} />
              </Pressable>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 20, paddingBottom:50 }}>
            <View style={{ height: HOUR_HEIGHT * 24 }}>
              {Array.from({length: 24}).map((_, h) => (
                <View key={h} style={[styles.hourRow, { height: HOUR_HEIGHT }]}>
                  <Text style={[styles.hourText, { color: lightMode ? '#999' : '#444' }]}>
                    {is24Hour 
                      ? `${h.toString().padStart(2, '0')}:00` 
                      : (h === 0 ? '12 AM' : h > 12 ? `${h-12} PM` : `${h} ${h===12?'PM':'AM'}`)}
                  </Text>
                  <View style={[styles.gridLine, { backgroundColor: lightMode ? '#ddd' : '#222' }]} />
                </View>
              ))}
              {allEvents.filter(e => isEventOnDay(e, selectedDate)).map((event, i, arr) => {
                const eS = event.start.toDate(); const eE = event.end.toDate();
                const dS = new Date(selectedDate+'T00:00:00'); const dE = new Date(selectedDate+'T23:59:59');
                const cS = eS < dS ? dS : eS; const cE = eE > dE ? dE : eE;
                const sM = cS.getHours()*60 + cS.getMinutes(); const eM = cE.getHours()*60 + cE.getMinutes();
                const overlaps = arr.filter(o => { const os = o.start.toDate() < dS ? dS : o.start.toDate(); const oe = o.end.toDate() > dE ? dE : o.end.toDate(); return os < cE && oe > cS; });
                const itemW = (SCREEN_WIDTH-75)/overlaps.length;
                const leftOff = 60 + (overlaps.findIndex(o => o.id === event.id)*itemW);
                const c = event.color || themeColor;
                return (
                  <Pressable key={event.id} onPress={() => { setEditingEventId(event.id); setEventTitle(event.title); setEventLocation(event.location || null); setEventColor(c); setStartTime(eS); setEndTime(eE); setShowAddModal(true); }}
                    style={[styles.absoluteEvent, { top: (sM/60)*HOUR_HEIGHT, height: (Math.max(eM-sM,30)/60)*HOUR_HEIGHT, left: leftOff, width: itemW-4, borderLeftColor: c, backgroundColor: c+'3A' }]}>
                    <Text style={[styles.eventTitleSmall, { color: dynamicColor }]} numberOfLines={1}>{event.title}</Text>
                    {event.location ? <Text style={[styles.eventLocSmall, { color: c }]} numberOfLines={1}><Ionicons name="location" size={8} /> {event.location.address}</Text> : null}
                    <Text style={[styles.eventTimeSmall, { color: c }]}>
  {eS < dS ? "Cont." : formatTime(eS)} - {eE > dE ? "Cont." : formatTime(eE)}
</Text>
                  </Pressable>
                );
              })}
              {suggestedBlocks.map((sug) => {
  const sM = sug.gapStart.getHours() * 60 + sug.gapStart.getMinutes();
  const eM = sug.gapEnd.getHours() * 60 + sug.gapEnd.getMinutes();
  const topPos = (sM / 60) * HOUR_HEIGHT;
  const height = (Math.max(eM - sM, 30) / 60) * HOUR_HEIGHT;
  
  return (
    // CHANGE THIS LINE:
    <View key={sug.tempId} style={[styles.absoluteEvent, styles.suggestedEvent, { top: topPos, height: height, left: 60, width: SCREEN_WIDTH - 80 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eventTitleSmall, { color: '#8e44ad' }]} numberOfLines={1}>✨ {sug.suggestedPriorityTitle}</Text>
        <Text style={[styles.eventTimeSmall, { color: '#8e44ad', fontStyle: 'italic' }]} numberOfLines={2}>{sug.reasoning}</Text>
      </View>
      <Pressable style={styles.acceptBtn} onPress={() => acceptSuggestion(sug)}>
        <Ionicons name="checkmark" size={16} color="#fff" />
      </Pressable>
    </View>
  );
})}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* EVENT CREATION MODAL */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalContent, { backgroundColor: lightMode ? '#fff' : '#222', borderColor: lightMode ? '#eee' : '#333' }]}>
            <Text style={[styles.modalHeading, { color: dynamicColor }]}>{editingEventId ? 'Edit Event' : 'New Event'}</Text>
            
            <TextInput style={[styles.input, { backgroundColor: lightMode ? '#f5f5f5' : '#111', color: dynamicColor }]} placeholder="Title" placeholderTextColor="#888" value={eventTitle} onChangeText={setEventTitle} />
            
            {/* Map Location Trigger Button */}
            <Pressable 
              style={[styles.input, { backgroundColor: lightMode ? '#f5f5f5' : '#111', marginBottom: 20, justifyContent: 'center' }]} 
              onPress={openLocationPicker}
            >
              <Text style={{ color: eventLocation ? dynamicColor : '#888' }} numberOfLines={1}>
                {eventLocation ? `📍 ${eventLocation.address}` : 'Add Location (Optional)'}
              </Text>
            </Pressable>

            <View style={styles.row}>
              <Pressable style={[styles.timeBtn, { backgroundColor: lightMode ? '#eee' : '#333' }]} onPress={()=>{setPickerMode('date'); setShowStartPicker(true);}}><Text style={styles.btnLabel}>Starts</Text><Text style={[styles.btnVal, { color: dynamicColor }]}>{startTime.toLocaleDateString()+'\n'+formatTime(startTime)}</Text></Pressable>
              <Pressable style={[styles.timeBtn, { backgroundColor: lightMode ? '#eee' : '#333' }]} onPress={()=>{setPickerMode('date'); setShowEndPicker(true);}}><Text style={styles.btnLabel}>Ends</Text><Text style={[styles.btnVal, { color: dynamicColor }]}>{endTime.toLocaleDateString()+'\n'+formatTime(endTime)}</Text></Pressable>
            </View>
            <Text style={styles.subHeading}>Category Labels</Text>
            <ScrollView style={{maxHeight: 180, marginBottom: 15}}>
              {COLOR_PRESETS.map(c => (
                <View key={c} style={[styles.catRow, { backgroundColor: lightMode ? '#f9f9f9' : '#1a1a1a' }]}>
                  <Pressable onPress={()=>setEventColor(c)} style={[styles.circleSmall, {backgroundColor:c, borderWidth:eventColor===c?2:0, borderColor: lightMode ? '#000' : '#fff'}]} />
                  <TextInput style={[styles.catInput, { color: dynamicColor }]} value={categoryLabels[c]} onChangeText={(t)=>{const u = {...categoryLabels, [c]:t}; setCategoryLabels(u); saveGlobalSettings(undefined, u);}} placeholder="Label..." placeholderTextColor="#444" />
                  {eventColor===c && <Ionicons name="checkmark-circle" size={18} color={c} />}
                </View>
              ))}
            </ScrollView>
            { (showStartPicker || showEndPicker) && <DateTimePicker is24Hour={is24Hour} value={showStartPicker?startTime:endTime} mode={pickerMode} onChange={onPickerChange} /> }
            <View style={styles.modalButtons}>
              {editingEventId ? <Pressable onPress={handleDeleteEvent} style={styles.deleteBtn}><Ionicons name="trash-outline" size={24} color="#ff4444" /></Pressable> : <Pressable onPress={resetForm}><Text style={{color:'#888'}}>Cancel</Text></Pressable>}
              <View style={{flexDirection:'row', alignItems:'center'}}>
                {editingEventId && <Pressable onPress={resetForm} style={{marginRight:15}}><Text style={{color:'#888'}}>Cancel</Text></Pressable>}
                <Pressable style={[styles.saveBtn, {backgroundColor: themeColor}]} onPress={handleSaveEvent}><Text style={styles.saveText}>{editingEventId?'Update':'Save'}</Text></Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* LOCATION PICKER MODAL (Rendered as a sibling to avoid nested Modal issues on iOS) */}
      <Modal visible={isLocationModalVisible} animationType="slide" transparent={true}>
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <Text style={styles.modalHeading}>Set Location</Text>
              <Pressable onPress={() => setLocationModalVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
            </View>

            <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <MapView style={StyleSheet.absoluteFill} region={mapRegion}>
                {tempLocation && (
                  <Marker coordinate={{ latitude: tempLocation.lat, longitude: tempLocation.lng }} />
                )}
              </MapView>

              <View style={{ position: 'absolute', width: '100%', top: 10, paddingHorizontal: 10, zIndex: 1 }}>
                <GooglePlacesAutocomplete
                  placeholder="Search for an address..."
                  fetchDetails={true}
                  onPress={(data, details = null) => {
                    if (details) {
                      const loc = {
                        address: data.description,
                        lat: details.geometry.location.lat,
                        lng: details.geometry.location.lng,
                      };
                      setTempLocation(loc);
                      setMapRegion({
                        ...mapRegion,
                        latitude: loc.lat,
                        longitude: loc.lng,
                      });
                    }
                  }}
                  query={{
                    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
                    language: 'en',
                  }}
                  styles={{
                    textInput: styles.mapSearchInput,
                    listView: styles.mapSearchList,
                  }}
                />
              </View>
            </View>

            <Pressable 
              style={[styles.saveBtn, { opacity: tempLocation ? 1 : 0.5, marginTop: 15, alignItems: 'center' }]} 
              onPress={confirmLocation} 
              disabled={!tempLocation}
            >
              <Text style={styles.saveText}>Save Location</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50 },
  dayBox: { width: SCREEN_WIDTH / 7 - 5, height: 75, borderWidth: 0.5, padding: 4,borderRadius: 8 },
  dayText: { fontSize: 10, fontWeight: '700' },
  monthHeader: { fontSize: 22, fontWeight: '700', marginVertical: 10, textAlign: 'center' },
  miniEventContainer: { marginTop: 2 },
  miniEventText: { fontSize: 7, lineHeight: 9, fontWeight: '500' },
  fab: { position: 'absolute', bottom: 15, right: 25, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 99 },
  drawerContent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.9, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 20 },
  dragHandleContainer: { width: '100%', alignItems: 'center', paddingBottom: 15 },
  dragHandle: { width: 45, height: 5, backgroundColor: '#333', borderRadius: 10 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  dateLabel: { fontSize: 24, fontWeight: 'bold' },
  dateSubLabel: { fontSize: 13, fontWeight: '500' },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start' },
  hourText: { fontSize: 10, width: 55, textAlign: 'right', paddingRight: 10, marginTop: -6 }, 
  gridLine: { flex: 1, height: 1 },
  absoluteEvent: { position: 'absolute', borderLeftWidth: 3, borderRadius: 6, padding: 8, overflow: 'hidden' },
  eventTitleSmall: { fontSize: 11, fontWeight: 'bold' },
  eventLocSmall: { fontSize: 8, marginTop: 1, fontWeight: '600' }, 
  eventTimeSmall: { fontSize: 9, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 25, padding: 25, borderWidth: 1 },
  modalHeading: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#fff' },
  subHeading: { color: '#666', fontSize: 11, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  input: { padding: 15, borderRadius: 12, marginBottom: 10, minHeight: 50 }, 
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  timeBtn: { padding: 10, borderRadius: 12, width: '48%', alignItems: 'center' },
  btnLabel: { color: '#888', fontSize: 10 },
  btnVal: { fontWeight: 'bold', fontSize: 10, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: 'bold' },
  deleteBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255, 68, 68, 0.1)' },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 8, borderRadius: 10 },
  circleSmall: { width: 24, height: 24, borderRadius: 12, marginRight: 12 },
  catInput: { flex: 1, fontSize: 13, fontWeight: '600' },
  aiButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  aiButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },
  suggestedEvent: { backgroundColor: 'rgba(142, 68, 173, 0.1)', borderLeftWidth: 0, borderWidth: 1, borderColor: '#8e44ad', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  acceptBtn: { backgroundColor: '#8e44ad', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginLeft: 5 },

  // Location Modal Styles
  mapModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  mapModalContent: { height: '80%', backgroundColor: '#1a0f05', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  mapModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mapSearchInput: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10 },
  mapSearchList: { backgroundColor: '#fff', borderRadius: 8, marginTop: 5 },
});
