import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { getAuth } from 'firebase/auth'
import CalendarAPI, { GoogleCalendarEvent } from '../../lib/googleCalendar'

export default function Home() {
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          // fallback (may not be an OAuth access token)
          accessToken = await user.getIdToken()
        }
      }

      const items = await CalendarAPI.fetchEvents({ accessToken })
      setEvents(items)
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Calendar</Text>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id ?? Math.random().toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}><Text>{error ?? 'No upcoming events'}</Text></View>
          )}
          renderItem={({ item }) => {
            const start = item.start?.dateTime ?? item.start?.date ?? ''
            return (
              <View style={styles.eventRow}>
                <Text style={styles.eventTitle}>{item.summary ?? 'Untitled'}</Text>
                <Text style={styles.eventTime}>{start}</Text>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  eventRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  eventTitle: { fontSize: 16, fontWeight: '500' },
  eventTime: { color: '#666', marginTop: 4 },
  empty: { padding: 24, alignItems: 'center' },
})
