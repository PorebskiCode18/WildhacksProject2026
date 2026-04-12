import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Pressable, TextInput, 
  ActivityIndicator, Alert, Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { 
  RenderItemParams, 
  ScaleDecorator 
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Firebase Imports
import { auth, db } from '../firebaseConfig';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, deleteDoc, doc, writeBatch, setDoc
} from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PriorityItem {
  id: string;
  text: string;
  index: number;
}

export default function PrioritiesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  
  // Theme States
  const [themeColor, setThemeColor] = useState('#ff9d33'); 
  const [lightMode, setLightMode] = useState(false); // Updated from pureBlackMode

  const user = auth.currentUser;
  const rankingRef = collection(db, 'users', user?.uid || 'guest', 'ranking');

  useEffect(() => {
    if (!user) return;

    // 1. Listen to Priorities List
    const q = query(rankingRef, orderBy('index', 'asc'));
    const unsubItems = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PriorityItem[];
      setItems(fetchedItems);
      setLoading(false);
    });

    // 2. Listen to Global Theme Settings
    const unsubTheme = onSnapshot(doc(db, 'users', user.uid, 'settings', 'eventConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.themeColor) setThemeColor(data.themeColor);
        if (data.lightMode !== undefined) setLightMode(data.lightMode); // Listen for lightMode
      }
    });

    return () => {
      unsubItems();
      unsubTheme();
    };
  }, [user]);

  // Helper for dynamic colors
  const dynamicColor = lightMode ? '#000000' : '#FFFFFF';
  const cardBg = lightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
  const cardBorder = lightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.08)';

  const addItem = async () => {
    if (newItemText.trim() === '') return;
    try {
      await addDoc(rankingRef, {
        text: newItemText,
        index: items.length,
        createdAt: new Date().toISOString(),
      });
      setNewItemText('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragEnd = async (data: PriorityItem[]) => {
    setItems(data);
    const batch = writeBatch(db);
    data.forEach((item, newIndex) => {
      const itemRef = doc(db, 'users', user!.uid, 'ranking', item.id);
      batch.update(itemRef, { index: newIndex });
    });
    try {
      await batch.commit();
    } catch (e) {
      Alert.alert("Error", "Failed to sync order.");
    }
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PriorityItem>) => {
    const currentPosition = (getIndex() ?? 0) + 1;

    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag} 
          disabled={isActive}
          delayLongPress={200}
          style={[
            styles.itemRow,
            { 
              backgroundColor: isActive ? `${themeColor}44` : cardBg,
              borderColor: isActive ? themeColor : cardBorder,
              elevation: isActive ? 10 : 0,
            }
          ]}
        >
          <View style={styles.numberBadge}>
            <Text style={[styles.numberText, { color: themeColor }]}>{currentPosition}.</Text>
          </View>

          <Text style={[styles.itemText, { color: dynamicColor }]}>{item.text}</Text>

          <Ionicons 
            name="reorder-three" 
            size={24} 
            color={isActive ? themeColor : (lightMode ? "#999" : "#444")} 
            style={{ marginRight: 10 }} 
          />

          <Pressable 
              onPress={async () => {
                await deleteDoc(doc(db, 'users', user!.uid, 'ranking', item.id));
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 5 })}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Dynamic Deep Gradient - Swapped for Light Mode Top logic */}
        <LinearGradient 
          colors={
            lightMode 
              ? ['#FFFFFF', '#FFFFFF', themeColor] // Sunrise Top
              : ['#000000', '#000000', themeColor] // Midnight Top
          } 
          locations={[0, 0.15, 1]} 
          style={StyleSheet.absoluteFill} 
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { 
              color: dynamicColor, 
              backgroundColor: cardBg,
              borderColor: cardBorder 
            }]}
            placeholder="Add a new priority..."
            placeholderTextColor={lightMode ? "#999" : "#666"}
            value={newItemText}
            onChangeText={setNewItemText}
          />
          <Pressable style={[styles.addBtn, { backgroundColor: themeColor }]} onPress={addItem}>
            <Ionicons name="add" size={30} color="#fff" />
          </Pressable>
        </View>

        {/* 2. New Full-Width Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            How do you want to spend your free time? Enter a Priority of yours above and hit the + sign to add it to your list. 
            Arrange them in order of what is most important to you and your AI assistant will help you find time for the things you value in life.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={themeColor} style={{ marginTop: 50 }} />
        ) : (
          <DraggableFlatList
            data={items}
            onDragEnd={({ data }) => handleDragEnd(data)}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            containerStyle={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  inputContainer: { 
    flexDirection: 'row', 
    marginBottom: 25, 
    marginTop: 10 
  },
  input: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    marginRight: 10,
    borderWidth: 1,
  },
  addBtn: {
    width: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  itemText: { fontSize: 16, flex: 1, fontWeight: '500' },
  numberBadge: {
    width: 35,
    marginRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  centeredHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1,
  },
  descriptionContainer: {
    width: '100%',
    marginBottom: 25,
    // Add significant padding to the sides to "squeeze" the text inward
    paddingHorizontal: 15, 
  },
  descriptionText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20, // Increased line height for better readability
    textAlign: 'center', // Changed to center to match the new "priorities list" header
  },
});
