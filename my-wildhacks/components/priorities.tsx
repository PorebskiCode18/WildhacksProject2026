import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Pressable, TextInput, 
  ActivityIndicator, Alert 
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
  addDoc, deleteDoc, doc, writeBatch, getDocs 
} from 'firebase/firestore';

// Define the shape of a Priority Item
interface PriorityItem {
  id: string;
  text: string;
  index: number;
}

export default function PrioritiesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  const user = auth.currentUser;
  const rankingRef = collection(db, 'users', user?.uid || 'guest', 'ranking');

  // 1. Listen to Firestore for real-time updates ordered by 'index'
  useEffect(() => {
    if (!user) return;

    const q = query(rankingRef, orderBy('index', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PriorityItem[];
      setItems(fetchedItems);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // 2. Add a new item to the bottom of the list
  const addItem = async () => {
    if (newItemText.trim() === '') return;
    try {
      await addDoc(rankingRef, {
        text: newItemText,
        index: items.length, // Put at the end
        createdAt: new Date().toISOString(),
      });
      setNewItemText('');
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  // 3. Handle the reordering after a drag
  const handleDragEnd = async (data: PriorityItem[]) => {
    // Optimistically update local state for smoothness
    setItems(data);

    const batch = writeBatch(db);
    data.forEach((item, newIndex) => {
      const itemRef = doc(db, 'users', user!.uid, 'ranking', item.id);
      batch.update(itemRef, { index: newIndex });
    });

    try {
      await batch.commit();
    } catch (e) {
      Alert.alert("Error", "Failed to sync new order to database.");
    }
  };


  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PriorityItem>) => {
    const currentPosition = (getIndex() ?? 0) + 1;

    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag} 
          disabled={isActive}
          delayLongPress={200} // Makes it feel more responsive
          style={[
            styles.itemRow,
            { 
              backgroundColor: isActive ? 'rgba(255, 157, 51, 0.4)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isActive ? '#ff9d33' : 'rgba(255, 255, 255, 0.1)',
              // Adding a slight shadow when active to help the "pop" effect
              elevation: isActive ? 5 : 0,
            }
          ]}
        >
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{currentPosition}.</Text>
          </View>

          <Text style={styles.itemText}>{item.text}</Text>

          {/* Drag handle hint - changed to three lines for better UX */}
          <Ionicons name="reorder-three" size={24} color={isActive ? "#ff9d33" : "#555"} style={{ marginRight: 10 }} />

          <Pressable 
              onPress={async () => {
                try {
                  // Standardized to 'ranking' (lowercase) to match your state listener
                  await deleteDoc(doc(db, 'users', user!.uid, 'ranking', item.id));
                } catch (e) {
                  console.error("Error deleting document: ", e);
                  Alert.alert("Error", "Could not delete this item.");
                }
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
        <LinearGradient colors={['#000000', '#1a0f05', '#2a1a0a']} style={StyleSheet.absoluteFill} />

        {/* 1. New Center-Aligned Header */}
        <View style={styles.centeredHeader}>
          <Text style={styles.headerTitle}>Priorities List</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a new priority..."
            placeholderTextColor="#888"
            value={newItemText}
            onChangeText={setNewItemText}
          />
          <Pressable style={styles.addBtn} onPress={addItem}>
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
          <ActivityIndicator color="#ff9d33" style={{ marginTop: 50 }} />
        ) : (
          <DraggableFlatList
            data={items}
            onDragEnd={({ data }) => handleDragEnd(data)}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            containerStyle={{ flex: 1 }}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
    zIndex: 10, // Ensure it's above other elements
  },
  inputContainer: { flexDirection: 'row', marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    marginRight: 10,
  },
  addBtn: {
    backgroundColor: '#ff9d33',
    width: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  itemText: { color: '#fff', fontSize: 16, flex: 1 },
  numberBadge: {
    width: 30,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    color: '#ff9d33',
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