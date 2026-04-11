import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Modal, TextInput, Pressable, Platform } from 'react-native'
import { Agenda } from 'react-native-calendars'
import { getAuth } from 'firebase/auth'
import CalendarAPI, { GoogleCalendarEvent } from '../lib/googleCalendar'

export default function Home() {
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [items, setItems] = useState<Record<string, Array<{ name: string; event: GoogleCalendarEvent; height: number; day: string }>>>({})
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchEvents = useCallback(async (opts?: { pull?: boolean }) => {
    try {
      if (opts?.pull) setRefreshing(true)
      else setLoading(true)
      setError(null)

      // Try to obtain a Google access token from Firebase current user.
      const auth = getAuth()
      const user = auth.currentUser as any | null
      let accessToken: string | undefined
      if (user) {
        accessToken = user?.accessToken ?? user?.stsTokenManager?.accessToken
        if (!accessToken && user.getIdToken) {
          accessToken = await user.getIdToken()
        }
      }

      const itemsRes = await CalendarAPI.fetchEvents({ accessToken })
      setEvents(itemsRes)

      // Build Agenda items keyed by date (YYYY-MM-DD)
      const dayItems: Record<string, Array<{ name: string; event: GoogleCalendarEvent; height: number; day: string }>> = {}
      for (const ev of itemsRes) {
        const dt = ev.start?.dateTime ?? ev.start?.date
        let dateKey = dt ? String(dt).split('T')[0] : new Date().toISOString().split('T')[0]
        if (!dayItems[dateKey]) dayItems[dateKey] = []
        dayItems[dateKey].push({ name: ev.summary ?? 'Untitled', event: ev, height: 80, day: dateKey })
      }
      const today = new Date().toISOString().split('T')[0]
      if (!dayItems[today]) dayItems[today] = dayItems[today] || []
      setItems(dayItems)
    } catch (err) {
      setError((err as any)?.message ?? 'Failed to load events')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const onRefresh = useCallback(() => fetchEvents({ pull: true }), [fetchEvents])

  const handleCreateEvent = async () => {
    setError(null)
    if (!newTitle || !newStart || !newEnd) {
      setError('Please provide title, start and end times')
      return
    }
    setSubmitting(true)
    try {
      const auth = getAuth()
      const user = auth.currentUser as any | null
      let accessToken: string | undefined
      if (user) {
        accessToken = user?.accessToken ?? user?.stsTokenManager?.accessToken
        if (!accessToken && user.getIdToken) accessToken = await user.getIdToken()
      }

      const event: GoogleCalendarEvent = {
        summary: newTitle,
        description: newDescription,
        start: { dateTime: newStart },
        end: { dateTime: newEnd },
      }

      await CalendarAPI.createEvent({ accessToken, event })
      setModalVisible(false)
      setNewTitle('')
      setNewStart('')
      setNewEnd('')
      setNewDescription('')
      await fetchEvents()
    } catch (err) {
      setError((err as any)?.message ?? 'Failed to create event')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Calendar</Text>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <Agenda
          items={items}
          loadItemsForMonth={() => fetchEvents()}
          selected={new Date().toISOString().split('T')[0]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          renderItem={(item: any) => (
            <View style={styles.eventRow}>
              <Text style={styles.eventTitle}>{item.name}</Text>
              <Text style={styles.eventTime}>{item.event.start?.dateTime ?? item.event.start?.date}</Text>
            </View>
          )}
          renderEmptyData={() => (
            <View style={styles.empty}><Text>{error ?? 'No upcoming events'}</Text></View>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)} accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal animationType="slide" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create Event</Text>
          <TextInput placeholder="Title" value={newTitle} onChangeText={setNewTitle} style={styles.input} />
          <TextInput
            placeholder={Platform.OS === 'ios' ? "Start (YYYY-MM-DDTHH:MM:SS)" : 'Start (ISO)'}
            value={newStart}
            onChangeText={setNewStart}
            style={styles.input}
          />
          <TextInput
            placeholder={Platform.OS === 'ios' ? "End (YYYY-MM-DDTHH:MM:SS)" : 'End (ISO)'}
            value={newEnd}
            onChangeText={setNewEnd}
            style={styles.input}
          />
          <TextInput placeholder="Description" value={newDescription} onChangeText={setNewDescription} style={[styles.input, { height: 80 }]} multiline />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalButtons}>
            <Pressable style={styles.modalButton} onPress={() => setModalVisible(false)}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalButton, styles.modalPrimary]} onPress={handleCreateEvent} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Create</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  eventRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginHorizontal: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  eventTime: {
    color: '#666',
    marginTop: 4,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginRight: 8,
  },
  modalPrimary: {
    backgroundColor: '#0066ff',
    marginRight: 0,
    marginLeft: 8,
  },
  errorText: {
    color: '#cc0000',
    marginBottom: 12,
    textAlign: 'center',
  },
})
