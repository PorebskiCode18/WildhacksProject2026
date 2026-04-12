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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_OPEN_Y = SCREEN_HEIGHT * 0.1; 
const DRAWER_CLOSED_Y = SCREEN_HEIGHT;
const HOUR_HEIGHT = 80;

const COLOR_PRESETS = ['#ff8c00', '#ff4444', '#00d4ff', '#ccff00', '#ff00ff', '#ffffff', '#8e44ad'];

export default function FullCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Customization & Category States
  const [themeColor, setThemeColor] = useState('#ff8c00');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [categoryLabels, setCategoryLabels] = useState<any>({
    '#ff8c00': 'General', '#ff4444': 'Urgent', '#00d4ff': 'Social', 
    '#ccff00': 'Health', '#ff00ff': 'Personal', '#ffffff': 'Other', '#8e44ad': 'Work'
  });

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventColor, setEventColor] = useState('#ff8c00');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const translateY = useRef(new Animated.Value(DRAWER_CLOSED_Y)).current;

  // Sync Calendar Theme
  const dynamicTheme = useMemo(() => ({
    calendarBackground: 'transparent',
    textSectionTitleColor: themeColor,
    dayTextColor: '#fff',
    monthTextColor: themeColor,
    textMonthFontWeight: '700' as const,
    textMonthFontSize: 22,
    todayTextColor: themeColor,
    arrowColor: themeColor,
  }), [themeColor]);

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
    
    // Fetch Events
    const q = query(collection(db, 'users', user.uid, 'events'), orderBy('start', 'asc'));
    const unsubEvents = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach((doc) => fetched.push({ id: doc.id, ...doc.data() }));
      setAllEvents(fetched);
    });

    // Fetch Persistent Settings (Theme + Labels)
    const loadSettings = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'eventConfig'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.labels) setCategoryLabels(data.labels);
        if (data.themeColor) setThemeColor(data.themeColor);
      }
    };
    loadSettings();

    return () => unsubEvents();
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
    const eventData = { title: eventTitle, start: Timestamp.fromDate(startTime), end: Timestamp.fromDate(endTime), color: eventColor };
    if (editingEventId) await updateDoc(doc(db, 'users', user.uid, 'events', editingEventId), eventData);
    else await addDoc(collection(db, 'users', user.uid, 'events'), eventData);
    resetForm();
  };

  const handleDeleteEvent = async () => {
    const user = auth.currentUser;
    if (user && editingEventId) { await deleteDoc(doc(db, 'users', user.uid, 'events', editingEventId)); resetForm(); }
  };

  const resetForm = () => { setEventTitle(''); setEditingEventId(null); setShowAddModal(false); };

  const isEventOnDay = (event: any, dateString: string) => {
    const dStart = new Date(dateString + 'T00:00:00');
    const dEnd = new Date(dateString + 'T23:59:59');
    return event.start.toDate() <= dEnd && event.end.toDate() >= dStart;
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#000000', '#1a0f0a']} style={StyleSheet.absoluteFill} />
      
      <CalendarList 
        key={themeColor} theme={dynamicTheme} horizontal pagingEnabled calendarWidth={SCREEN_WIDTH}
        dayComponent={({date, state}: any) => {
          const dayEvents = allEvents.filter(e => isEventOnDay(e, date.dateString)).slice(0, 3);
          return (
            <Pressable style={[styles.dayBox, state==='today' && {borderColor: themeColor}]} onPress={()=>{setSelectedDate(date.dateString); openDrawer();}}>
              <Text style={[styles.dayText, state==='disabled' && {color: '#444'}]}>{date.day}</Text>
              <View style={styles.miniEventContainer}>
                {dayEvents.map((e, i) => <Text key={i} style={[styles.miniEventText, {color: e.color || themeColor}]} numberOfLines={1}>• {e.title}</Text>)}
              </View>
            </Pressable>
          );
        }}
        renderHeader={(date) => (
          <Pressable onPress={() => setShowColorPicker(true)}>
            <Text style={[styles.monthHeader, { color: themeColor }]}>{date.toString('MMMM yyyy')}</Text>
          </Pressable>
        )}
      />

      <Pressable style={[styles.fab, { backgroundColor: themeColor }]} onPress={() => { setEditingEventId(null); setEventTitle(''); setEventColor(themeColor); setStartTime(new Date()); setEndTime(new Date(Date.now()+3600000)); setShowAddModal(true); }}>
        <Ionicons name="add" size={32} color="white" />
      </Pressable>

      {isDrawerOpen && (
        <Animated.View style={[styles.drawerContent, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          <View style={styles.dragHandleContainer}><View style={styles.dragHandle} /></View>
          <View style={styles.timelineHeader}>
            <View><Text style={styles.dateLabel}>{selectedDate}</Text><Text style={[styles.dateSubLabel, { color: themeColor }]}>Schedule</Text></View>
            <Pressable onPress={() => { setEditingEventId(null); setEventTitle(''); setShowAddModal(true); }}><Ionicons name="add-circle" size={40} color={themeColor} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ height: HOUR_HEIGHT * 24 }}>
              {Array.from({length: 24}).map((_, h) => (
                <View key={h} style={[styles.hourRow, { height: HOUR_HEIGHT }]}><Text style={styles.hourText}>{h === 0 ? '12 AM' : h > 12 ? `${h-12} PM` : `${h} ${h===12?'PM':'AM'}`}</Text><View style={styles.gridLine} /></View>
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
                  <Pressable key={event.id} onPress={() => { setEditingEventId(event.id); setEventTitle(event.title); setEventColor(c); setStartTime(eS); setEndTime(eE); setShowAddModal(true); }}
                    style={[styles.absoluteEvent, { top: (sM/60)*HOUR_HEIGHT, height: (Math.max(eM-sM,30)/60)*HOUR_HEIGHT, left: leftOff, width: itemW-4, borderLeftColor: c, backgroundColor: c+'3A' }]}>
                    <Text style={styles.eventTitleSmall} numberOfLines={1}>{event.title}</Text>
                    <Text style={[styles.eventTimeSmall, { color: c }]}>{eS < dS ? "Cont." : formatTime(eS)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* THEME PICKER MODAL */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <View style={styles.overlay}><View style={styles.modalContent}>
          <Text style={styles.modalHeading}>Accent Color</Text>
          <View style={styles.grid}>{COLOR_PRESETS.map(c => <Pressable key={c} onPress={()=>{setThemeColor(c); saveGlobalSettings(c); setShowColorPicker(false);}} style={[styles.circle, {backgroundColor:c, borderWidth:themeColor===c?3:0, borderColor:'#fff'}]} />)}</View>
          <Pressable onPress={()=>setShowColorPicker(false)} style={{marginTop:20}}><Text style={{color:'#888', textAlign:'center'}}>Cancel</Text></Pressable>
        </View></View>
      </Modal>

      {/* EVENT MODAL */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.overlay}><View style={styles.modalContent}>
          <Text style={styles.modalHeading}>{editingEventId ? 'Edit Event' : 'New Event'}</Text>
          <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#888" value={eventTitle} onChangeText={setEventTitle} />
          <View style={styles.row}>
            <Pressable style={styles.timeBtn} onPress={()=>{setPickerMode('date'); setShowStartPicker(true);}}><Text style={styles.btnLabel}>Starts</Text><Text style={styles.btnVal}>{startTime.toLocaleDateString()+'\n'+formatTime(startTime)}</Text></Pressable>
            <Pressable style={styles.timeBtn} onPress={()=>{setPickerMode('date'); setShowEndPicker(true);}}><Text style={styles.btnLabel}>Ends</Text><Text style={styles.btnVal}>{endTime.toLocaleDateString()+'\n'+formatTime(endTime)}</Text></Pressable>
          </View>
          <Text style={styles.subHeading}>Category Labels</Text>
          <ScrollView style={{maxHeight: 180, marginBottom: 15}}>
            {COLOR_PRESETS.map(c => (
              <View key={c} style={styles.catRow}>
                <Pressable onPress={()=>setEventColor(c)} style={[styles.circleSmall, {backgroundColor:c, borderWidth:eventColor===c?2:0, borderColor:'#fff'}]} />
                <TextInput style={styles.catInput} value={categoryLabels[c]} onChangeText={(t)=>{const u = {...categoryLabels, [c]:t}; setCategoryLabels(u); saveGlobalSettings(undefined, u);}} placeholder="Label..." placeholderTextColor="#444" />
                {eventColor===c && <Ionicons name="checkmark-circle" size={18} color={c} />}
              </View>
            ))}
          </ScrollView>
          { (showStartPicker || showEndPicker) && <DateTimePicker value={showStartPicker?startTime:endTime} mode={pickerMode} onChange={onPickerChange} /> }
          <View style={styles.modalButtons}>
            {editingEventId ? <Pressable onPress={handleDeleteEvent} style={styles.deleteBtn}><Ionicons name="trash-outline" size={24} color="#ff4444" /></Pressable> : <Pressable onPress={resetForm}><Text style={{color:'#888'}}>Cancel</Text></Pressable>}
            <View style={{flexDirection:'row', alignItems:'center'}}>
              {editingEventId && <Pressable onPress={resetForm} style={{marginRight:15}}><Text style={{color:'#888'}}>Cancel</Text></Pressable>}
              <Pressable style={[styles.saveBtn, {backgroundColor: themeColor}]} onPress={handleSaveEvent}><Text style={styles.saveText}>{editingEventId?'Update':'Save'}</Text></Pressable>
            </View>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50 },
  dayBox: { width: SCREEN_WIDTH / 7 - 1, height: 75, borderWidth: 0.5, borderColor: '#221a15', padding: 4 },
  dayText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  monthHeader: { fontSize: 22, fontWeight: '700', marginVertical: 10, textAlign: 'center' },
  miniEventContainer: { marginTop: 2 },
  miniEventText: { fontSize: 7, lineHeight: 9, fontWeight: '500' },
  fab: { position: 'absolute', bottom: 15, right: 25, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 99 },
  drawerContent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.9, backgroundColor: '#161616', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 20 },
  dragHandleContainer: { width: '100%', alignItems: 'center', paddingBottom: 15 },
  dragHandle: { width: 45, height: 5, backgroundColor: '#333', borderRadius: 10 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  dateLabel: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  dateSubLabel: { fontSize: 13, fontWeight: '500' },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start' },
  hourText: { color: '#444', fontSize: 10, width: 45, textAlign: 'right', paddingRight: 10, marginTop: -6 },
  gridLine: { flex: 1, height: 1, backgroundColor: '#222' },
  absoluteEvent: { position: 'absolute', borderLeftWidth: 3, borderRadius: 6, padding: 8, overflow: 'hidden' },
  eventTitleSmall: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  eventTimeSmall: { fontSize: 9, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#222', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalHeading: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  subHeading: { color: '#666', fontSize: 11, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  timeBtn: { backgroundColor: '#333', padding: 10, borderRadius: 12, width: '48%', alignItems: 'center' },
  btnLabel: { color: '#888', fontSize: 10 },
  btnVal: { color: '#fff', fontWeight: 'bold', fontSize: 10, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: 'bold' },
  deleteBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255, 68, 68, 0.1)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
  circle: { width: 50, height: 50, borderRadius: 25 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#1a1a1a', padding: 8, borderRadius: 10 },
  circleSmall: { width: 24, height: 24, borderRadius: 12, marginRight: 12 },
  catInput: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' }
});
