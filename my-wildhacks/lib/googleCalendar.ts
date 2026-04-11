import { getAuth } from 'firebase/auth'

const BASE = 'https://www.googleapis.com/calendar/v3'

export type GoogleCalendarEvent = {
  id?: string
  summary?: string
  description?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  [key: string]: any
}

async function getAccessTokenFromFirebase(): Promise<string | null> {
  const auth = getAuth()
  const user = auth.currentUser as any | null
  if (!user) return null

  // Try common places where access tokens might be available.
  // Note: depending on your sign-in flow you should keep the Google OAuth access
  // token when signing in (e.g. using Expo AuthSession) and pass it to these helpers.
  if (user.accessToken) return user.accessToken
  if (user.stsTokenManager?.accessToken) return user.stsTokenManager.accessToken
  // Some workflows store provider-specific credentials on `providerData` or elsewhere.
  if (user.providerData && Array.isArray(user.providerData)) {
    for (const p of user.providerData) {
      if (p?.accessToken) return p.accessToken
    }
  }

  try {
    // As a last resort try Firebase ID token (NOT the same as Google OAuth token).
    // Many Google APIs require an OAuth 2.0 access token; using the Firebase ID
    // token may not work. Prefer passing the Google access token explicitly.
    const idToken = await user.getIdToken()
    return idToken
  } catch {
    return null
  }
}

async function getAuthHeader(accessToken?: string) {
  if (accessToken) return `Bearer ${accessToken}`
  const token = await getAccessTokenFromFirebase()
  if (!token) throw new Error('No Google access token available. Pass accessToken.')
  return `Bearer ${token}`
}

export async function fetchEvents(options: {
  accessToken?: string
  calendarId?: string
  timeMin?: string
  maxResults?: number
}) {
  const { accessToken, calendarId = 'primary', timeMin, maxResults = 50 } = options
  const authHeader = await getAuthHeader(accessToken)
  const params = new URLSearchParams()
  params.set('singleEvents', 'true')
  params.set('orderBy', 'startTime')
  params.set('maxResults', String(maxResults))
  if (timeMin) params.set('timeMin', timeMin)

  const res = await fetch(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
    headers: { Authorization: authHeader },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`fetchEvents failed: ${res.status} ${body}`)
  }
  const data = await res.json()
  return data.items as GoogleCalendarEvent[]
}

export async function createEvent(options: {
  accessToken?: string
  calendarId?: string
  event: GoogleCalendarEvent
}) {
  const { accessToken, calendarId = 'primary', event } = options
  const authHeader = await getAuthHeader(accessToken)
  const res = await fetch(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`createEvent failed: ${res.status} ${body}`)
  }
  return (await res.json()) as GoogleCalendarEvent
}

export async function updateEvent(options: {
  accessToken?: string
  calendarId?: string
  eventId: string
  event: Partial<GoogleCalendarEvent>
}) {
  const { accessToken, calendarId = 'primary', eventId, event } = options
  const authHeader = await getAuthHeader(accessToken)
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`updateEvent failed: ${res.status} ${body}`)
  }
  return (await res.json()) as GoogleCalendarEvent
}

export async function deleteEvent(options: { accessToken?: string; calendarId?: string; eventId: string }) {
  const { accessToken, calendarId = 'primary', eventId } = options
  const authHeader = await getAuthHeader(accessToken)
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: authHeader } }
  )
  if (res.status === 204) return true
  const body = await res.text()
  throw new Error(`deleteEvent failed: ${res.status} ${body}`)
}

export default {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
}
