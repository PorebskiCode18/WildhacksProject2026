import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Pressable, TextInput, 
  ActivityIndicator, Alert, Modal, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Map Imports
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

// Firebase & AI Imports
import { auth, db } from '../firebaseConfig';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, deleteDoc, doc, writeBatch, setDoc, getDoc, updateDoc
} from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }); 

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface PriorityItem {
  id: string;
  text: string;
  index: number;
  location?: LocationData;
}

export default function PrioritiesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  // NEW: Theme States
  const [themeColor, setThemeColor] = useState('#ff9d33');
  const [lightMode, setLightMode] = useState(false);

  // AI & Welcome State
  const [viewMode, setViewMode] = useState<'loading' | 'welcome' | 'list'>('loading');
  const [interestInput, setInterestInput] = useState('');
  const [interestsList, setInterestsList] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Maps & Location State
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [tempLocation, setTempLocation] = useState<LocationData | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const user = auth.currentUser;
  const rankingRef = collection(db, 'users', user?.uid || 'guest', 'ranking');
  const interestsDocRef = doc(db, 'users', user?.uid || 'guest', 'data', 'interests');

  // Helper: Get contrasting color for text on theme background
  const getContrastingColor = (hexcolor: string) => {
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#FFFFFF';
  };

  useEffect(() => {
    if (!user) return;

    // 1. Theme Listener
    const unsubTheme = onSnapshot(doc(db, 'users', user.uid, 'settings', 'eventConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.themeColor) setThemeColor(data.themeColor);
        if (data.lightMode !== undefined) setLightMode(data.lightMode);
      }
    });

    // 2. Ranking & Interests Listener
    const q = query(rankingRef, orderBy('index', 'asc'));
    const unsubRanking = onSnapshot(q, async (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PriorityItem[];
      setItems(fetchedItems);

      const interestSnap = await getDoc(interestsDocRef);
      const storedInterests = interestSnap.exists() ? interestSnap.data().list : [];
      setInterestsList(storedInterests);

      if (fetchedItems.length > 0) {
        setViewMode('list');
      } else if (storedInterests.length > 0) {
        if (!suggestion && !isGenerating) {
          autoGenerate(storedInterests);
        }
        setViewMode('list');
      } else {
        setViewMode('welcome');
      }
      setLoading(false);
    });

    return () => {
      unsubTheme();
      unsubRanking();
    };
  }, [user]);

  // Logic for dynamic colors
  const dynamicTextColor = lightMode ? '#000000' : '#FFFFFF';
  const dynamicSubText = lightMode ? '#444444' : '#aaaaaa';
  const cardBg = lightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
  const cardBorder = lightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const autoGenerate = async (list: string[]) => {
    if (isGenerating || suggestion) return; 
    setIsGenerating(true);
    try {
      const prompt = `The user is interested in: ${list.join(', ')}. Suggest ONE actionable, short life priority. Return ONLY the text. Example: "Go for a 10 minute walk".`;
      const result = await model.generateContent(prompt);
      setSuggestion(result.response.text().trim());
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      Alert.alert("AI Error", `Status: ${e.status || 'Unknown'}. Message: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveInterests = async (newList: string[]) => {
    try { await setDoc(interestsDocRef, { list: newList }); } 
    catch (e) { console.error("Error saving interests: ", e); }
  };

  const addInterestNode = () => {
    if (interestInput.trim() && !interestsList.includes(interestInput.trim())) {
      const updatedList = [...interestsList, interestInput.trim()];
      setInterestsList(updatedList);
      saveInterests(updatedList);
      setInterestInput('');
    }
  };

  const removeInterestNode = (index: number) => {
    const updatedList = interestsList.filter((_, i) => i !== index);
    setInterestsList(updatedList);
    saveInterests(updatedList);
  };

  const generateSuggestion = async () => {
    await autoGenerate(interestsList);
    setViewMode('list'); 
  };

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    const docRef = await addDoc(rankingRef, { text: suggestion, index: items.length });
    setSuggestion(null);
    openLocationPicker(docRef.id);
  };

  const addItem = async () => {
    if (newItemText.trim() === '') return;
    const docRef = await addDoc(rankingRef, { text: newItemText, index: items.length });
    setNewItemText('');
    openLocationPicker(docRef.id);
  };

  const openLocationPicker = (itemId: string) => {
    setActiveItemId(itemId);
    setTempLocation(null);
    setLocationModalVisible(true);
  };

  const confirmLocation = async () => {
    if (activeItemId && tempLocation) {
      const itemRef = doc(db, 'users', user!.uid, 'ranking', activeItemId);
      await updateDoc(itemRef, { location: tempLocation });
    }
    closeLocationPicker();
  };

  const closeLocationPicker = () => {
    setLocationModalVisible(false);
    setActiveItemId(null);
    setTempLocation(null);
  };

  const handleDragEnd = async (data: PriorityItem[]) => {
    setItems(data);
    const batch = writeBatch(db);
    data.forEach((item, newIndex) => {
      batch.update(doc(db, 'users', user!.uid, 'ranking', item.id), { index: newIndex });
    });
    await batch.commit();
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PriorityItem>) => (
    <ScaleDecorator>
      <Pressable 
        onLongPress={drag} 
        disabled={isActive} 
        style={[
          styles.itemRow, 
          { 
            backgroundColor: isActive ? themeColor + '66' : cardBg,
            borderColor: cardBorder
          }
        ]}
      >
        <View style={styles.numberBadge}>
          <Text style={[styles.numberText, { color: themeColor }]}>{(getIndex() ?? 0) + 1}.</Text>
        </View>
        
        <View style={styles.itemTextContainer}>
          <Text style={[styles.itemText, { color: dynamicTextColor }]}>{item.text}</Text>
          {item.location && (
            <Text style={[styles.locationText, { color: dynamicSubText }]} numberOfLines={1}>
              📍 {item.location.address}
            </Text>
          )}
        </View>

        <Pressable onPress={() => openLocationPicker(item.id)} style={styles.iconBtn}>
          <Ionicons name="location-outline" size={22} color={item.location ? themeColor : "#555"} />
        </Pressable>
        <Ionicons name="reorder-two" size={24} color="#555" style={{ marginHorizontal: 5 }} />
        <Pressable onPress={() => deleteDoc(doc(db, 'users', user!.uid, 'ranking', item.id))} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  if (loading || viewMode === 'loading') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={lightMode ? ['#fff', '#fff', themeColor] : ['#000', '#000', themeColor]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={themeColor} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <LinearGradient 
          colors={lightMode ? ['#FFFFFF', '#FFFFFF', themeColor] : ['#000000', '#000000', themeColor]} 
          locations={[0, 0.15, 1]}
          style={StyleSheet.absoluteFill} 
        />
        
        {viewMode === 'welcome' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={styles.centeredHeader}>
              <Text style={[styles.headerTitle, { color: dynamicTextColor }]}>Welcome</Text>
            </View>
            <Text style={[styles.descriptionText, { color: dynamicSubText }]}>
              What are some of your interests? The AI assistant can help kickstart some ideas about priorities.
            </Text>

            <View style={styles.inputContainer}>
              <TextInput 
                style={[styles.input, { backgroundColor: cardBg, color: dynamicTextColor }]} 
                placeholder="Add an interest..." 
                placeholderTextColor="#888" 
                value={interestInput} 
                onChangeText={setInterestInput} 
                onSubmitEditing={addInterestNode} 
              />
              <Pressable style={[styles.addBtn, { backgroundColor: themeColor }]} onPress={addInterestNode}>
                <Ionicons name="add" size={24} color={getContrastingColor(themeColor)} />
              </Pressable>
            </View>

            <View style={styles.chipContainer}>
              {interestsList.map((interest, index) => (
                <View key={index} style={[styles.chip, { borderColor: themeColor, backgroundColor: themeColor + '22' }]}>
                  <Text style={[styles.chipText, { color: dynamicTextColor }]}>{interest}</Text>
                  <Pressable onPress={() => removeInterestNode(index)}>
                    <Ionicons name="close-circle" size={16} color={themeColor} style={{ marginLeft: 5 }} />
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable 
              style={[styles.addBtnFull, { backgroundColor: themeColor, opacity: interestsList.length > 0 ? 1 : 0.5 }]} 
              onPress={generateSuggestion} 
              disabled={isGenerating || interestsList.length === 0}
            >
              {isGenerating ? 
                <ActivityIndicator color={getContrastingColor(themeColor)} /> : 
                <Text style={[styles.buttonText, { color: getContrastingColor(themeColor) }]}>Get Suggestions</Text>
              }
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.centeredHeader}>
              <Text style={[styles.headerTitle, { color: dynamicTextColor }]}>Priorities List</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput 
                style={[styles.input, { backgroundColor: cardBg, color: dynamicTextColor }]} 
                placeholder="Add a new priority..." 
                placeholderTextColor="#888" 
                value={newItemText} 
                onChangeText={setNewItemText} 
              />
              <Pressable style={[styles.addBtn, { backgroundColor: themeColor }]} onPress={addItem}>
                <Ionicons name="add" size={30} color={getContrastingColor(themeColor)} />
              </Pressable>
            </View>

            {suggestion && (
              <View style={[styles.itemRow, styles.suggestionRow, { borderColor: themeColor, backgroundColor: themeColor + '11' }]}>
                <View style={styles.suggestedBadge}><Text style={[styles.suggestedText, { color: themeColor }]}>Suggested:</Text></View>
                <Text style={[styles.itemText, { color: dynamicTextColor }]}>{suggestion}</Text>
                <View style={{ flexDirection: 'row' }}>
                  <Pressable onPress={acceptSuggestion} style={styles.iconBtn}><Ionicons name="checkmark-circle" size={28} color="#4CAF50" /></Pressable>
                  <Pressable onPress={() => setSuggestion(null)} style={styles.iconBtn}><Ionicons name="close-circle" size={28} color="#ff4444" /></Pressable>
                </View>
              </View>
            )}

            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: dynamicSubText }]}>
                Arrange them in order of importance. Add a location to help your AI find time for the things you value.
              </Text>
            </View>

            <DraggableFlatList 
              data={items} 
              onDragEnd={({ data }) => handleDragEnd(data)} 
              keyExtractor={(item) => item.id} 
              renderItem={renderItem} 
              containerStyle={{ flex: 1 }} 
            />
          </>
        )}
      </View>

      <Modal visible={isLocationModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: lightMode ? '#f0f0f0' : '#1a0f05' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: dynamicTextColor }]}>Set Location</Text>
              <Pressable onPress={closeLocationPicker}><Ionicons name="close" size={28} color={dynamicTextColor} /></Pressable>
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
              style={[styles.saveBtn, { backgroundColor: themeColor, opacity: tempLocation ? 1 : 0.5 }]} 
              onPress={confirmLocation} 
              disabled={!tempLocation}
            >
              <Text style={[styles.buttonText, { color: getContrastingColor(themeColor) }]}>Save Location</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  centeredHeader: { alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  inputContainer: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, borderRadius: 12, padding: 15, marginRight: 10 },
  addBtn: { width: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addBtnFull: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { fontWeight: 'bold' },
  descriptionContainer: { width: '100%', marginVertical: 30, paddingHorizontal: 15 },
  descriptionText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  
  // List Items
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, marginBottom: 10, borderWidth: 1 },
  suggestionRow: { borderStyle: 'dashed' },
  itemTextContainer: { flex: 1, justifyContent: 'center' },
  itemText: { fontSize: 15 },
  locationText: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  numberBadge: { width: 30, marginRight: 5 },
  numberText: { fontWeight: 'bold', fontSize: 16 },
  suggestedBadge: { marginRight: 10 },
  suggestedText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconBtn: { paddingHorizontal: 5 },
  
  // Chips
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, justifyContent: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, margin: 4 },
  chipText: { fontSize: 14, fontWeight: '500' },

  // Location Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  mapSearchInput: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10 },
  mapSearchList: { backgroundColor: '#fff', borderRadius: 8, marginTop: 5 },
});
