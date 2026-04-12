import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Pressable, TextInput, 
  ActivityIndicator, Alert, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Firebase & AI Imports
import { auth, db } from '../firebaseConfig';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, deleteDoc, doc, writeBatch, setDoc, getDoc
} from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with the exact string that passed your sanity check
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }); 

interface PriorityItem {
  id: string;
  text: string;
  index: number;
}

export default function PrioritiesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  // AI & Welcome State
  const [viewMode, setViewMode] = useState<'loading' | 'welcome' | 'list'>('loading');
  const [interestInput, setInterestInput] = useState('');
  const [interestsList, setInterestsList] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const user = auth.currentUser;
  const rankingRef = collection(db, 'users', user?.uid || 'guest', 'ranking');
  const interestsDocRef = doc(db, 'users', user?.uid || 'guest', 'data', 'interests');

  // 1. Data Loading & View Routing
  useEffect(() => {
    if (!user) return;

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
        // Auto-run AI if interests exist but list is empty
        if (!suggestion && !isGenerating) {
          autoGenerate(storedInterests);
        }
        setViewMode('list');
      } else {
        setViewMode('welcome');
      }
      setLoading(false);
    });

    return unsubRanking;
  }, [user]);

  // 2. AI Logic
  const autoGenerate = async (list: string[]) => {
    if (isGenerating || suggestion) return;
    setIsGenerating(true);
    try {
      const prompt = `The user is interested in: ${list.join(', ')}. Suggest ONE actionable, short life priority. Return ONLY the text. Example: "Go for a 10 minute walk". No punctuation.`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      console.log("Gemini Success:", responseText);
      setSuggestion(responseText);
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      Alert.alert("AI Error", `Status: ${e.status || 'Unknown'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Interest Management
  const saveInterests = async (newList: string[]) => {
    try {
      await setDoc(interestsDocRef, { list: newList });
    } catch (e) {
      console.error("Error saving interests: ", e);
    }
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
    await addDoc(rankingRef, { text: suggestion, index: items.length });
    setSuggestion(null);
  };

  // 4. Manual Priority Management
  const addItem = async () => {
    if (newItemText.trim() === '') return;
    await addDoc(rankingRef, { text: newItemText, index: items.length });
    setNewItemText('');
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
      <Pressable onLongPress={drag} disabled={isActive} style={[styles.itemRow, { backgroundColor: isActive ? 'rgba(255, 157, 51, 0.4)' : 'rgba(255, 255, 255, 0.05)' }]}>
        <View style={styles.numberBadge}><Text style={styles.numberText}>{(getIndex() ?? 0) + 1}.</Text></View>
        <Text style={styles.itemText}>{item.text}</Text>
        <Ionicons name="reorder-two" size={24} color="#555" style={{ marginRight: 10 }} />
        <Pressable onPress={() => deleteDoc(doc(db, 'users', user!.uid, 'ranking', item.id))}><Ionicons name="trash-outline" size={20} color="#ff4444" /></Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  // --- RENDERING ---

  if (loading || viewMode === 'loading') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#000000', '#1a0f05', '#2a1a0a']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color="#ff9d33" size="large" />
      </View>
    );
  }

  if (viewMode === 'welcome') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#000000', '#1a0f05', '#2a1a0a']} style={StyleSheet.absoluteFill} />
        <View style={styles.centeredHeader}><Text style={styles.headerTitle}>Welcome</Text></View>
        <Text style={styles.descriptionText}>What are some of your interests? Our AI will suggest your first priorities.</Text>

        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Add an interest..." 
            placeholderTextColor="#888" 
            value={interestInput} 
            onChangeText={setInterestInput}
            onSubmitEditing={addInterestNode}
          />
          <Pressable style={styles.addBtn} onPress={addInterestNode}><Ionicons name="add" size={24} color="#fff" /></Pressable>
        </View>

        <View style={styles.chipContainer}>
          {interestsList.map((interest, index) => (
            <View key={index} style={styles.chip}>
              <Text style={styles.chipText}>{interest}</Text>
              <Pressable onPress={() => removeInterestNode(index)}>
                <Ionicons name="close-circle" size={16} color="#ff9d33" style={{ marginLeft: 5 }} />
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable 
          style={[styles.addBtnFull, { opacity: interestsList.length > 0 ? 1 : 0.5 }]} 
          onPress={generateSuggestion} 
          disabled={isGenerating || interestsList.length === 0}
        >
          {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Suggestions</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <LinearGradient colors={['#000000', '#1a0f05', '#2a1a0a']} style={StyleSheet.absoluteFill} />
        <View style={styles.centeredHeader}><Text style={styles.headerTitle}>Priorities List</Text></View>

        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Add a new priority..." placeholderTextColor="#888" value={newItemText} onChangeText={setNewItemText} />
          <Pressable style={styles.addBtn} onPress={addItem}><Ionicons name="add" size={30} color="#fff" /></Pressable>
        </View>

        {suggestion && (
          <View style={[styles.itemRow, styles.suggestionRow]}>
            <View style={styles.suggestedBadge}><Text style={styles.suggestedText}>Suggested:</Text></View>
            <Text style={styles.itemText}>{suggestion}</Text>
            <View style={{ flexDirection: 'row' }}>
              <Pressable onPress={acceptSuggestion} style={styles.iconBtn}><Ionicons name="checkmark-circle" size={28} color="#4CAF50" /></Pressable>
              <Pressable onPress={() => setSuggestion(null)} style={styles.iconBtn}><Ionicons name="close-circle" size={28} color="#ff4444" /></Pressable>
            </View>
          </View>
        )}

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            How do you want to spend your free time? Enter a Priority of yours above and hit the + sign to add it to your list. 
            Arrange them in order of what is most important to you and your AI assistant will help you find time for the things you value in life.
          </Text>
        </View>

        <DraggableFlatList 
          data={items} 
          onDragEnd={({ data }) => handleDragEnd(data)} 
          keyExtractor={(item) => item.id} 
          renderItem={renderItem} 
          containerStyle={{ flex: 1 }} 
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  centeredHeader: { alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '700' },
  inputContainer: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, color: '#fff', marginRight: 10 },
  addBtn: { backgroundColor: '#ff9d33', width: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addBtnFull: { backgroundColor: '#ff9d33', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  descriptionContainer: { width: '100%', marginVertical: 30, paddingHorizontal: 15 },
  descriptionText: { color: '#aaa', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  suggestionRow: { borderColor: '#ff9d33', borderStyle: 'dashed', backgroundColor: 'rgba(255, 157, 51, 0.05)' },
  itemText: { color: '#fff', fontSize: 15, flex: 1 },
  numberBadge: { width: 30, marginRight: 5 },
  numberText: { color: '#ff9d33', fontWeight: 'bold', fontSize: 16 },
  suggestedBadge: { marginRight: 10 },
  suggestedText: { color: '#ff9d33', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  iconBtn: { paddingHorizontal: 5 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, justifyContent: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 157, 51, 0.15)', borderWidth: 1, borderColor: '#ff9d33', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, margin: 4 },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});