import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function Home() {
  return (
    <View style={styles.container}>
      {/* This creates the background color scheme from your image */}
      <LinearGradient
        colors={['#000000', '#2a1a0a', '#5e3205']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.username}>John Doe</Text>
            </View>
            <Pressable style={styles.profileBadge}>
              <Ionicons name="person" size={20} color="#ff9d33" />
            </Pressable>
          </View>

          {/* Featured Card (Glassmorphism effect) */}
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>Upcoming Task</Text>
            <Text style={styles.cardSubtitle}>Design Calendar UI</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '70%' }]} />
            </View>
          </View>

          {/* Grid Section */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            <ActionSquare icon="calendar" label="Calendar" />
            <ActionSquare icon="stats-chart" label="Stats" />
            <ActionSquare icon="notifications" label="Alerts" />
            <ActionSquare icon="settings" label="Settings" />
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Small helper component for the grid
function ActionSquare({ icon, label }: { icon: any; label: string }) {
  return (
    <Pressable style={styles.actionSquare}>
      <Ionicons name={icon} size={28} color="#ff9d33" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  greeting: {
    color: '#aaa',
    fontSize: 16,
  },
  username: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
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
  cardSubtitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginVertical: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff9d33',
    borderRadius: 3,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
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
  actionLabel: {
    color: '#eee',
    marginTop: 10,
    fontWeight: '500',
  },
});
