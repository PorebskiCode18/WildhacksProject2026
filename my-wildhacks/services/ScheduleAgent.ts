// services/ScheduleAgent.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

// --- INTERFACES ---
export interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: LocationData | null;
}

export interface PriorityItem {
  id: string;
  title: string;
  rank: number;
  location: LocationData;
}

export interface TimeGap {
  start: Date;
  end: Date;
  durationMinutes: number;
  previousLocation: LocationData | null;
  nextLocation: LocationData | null;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });

// --- MAIN AGENT FUNCTION ---
export const generateScheduleSuggestions = async (
  targetDate: Date,
  events: CalendarEvent[],
  priorities: PriorityItem[]
) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  console.log("Step 1: Calculating Time Gaps...");
  const timeGaps = calculateTimeGaps(events, targetDate);
  if (timeGaps.length === 0) {
    return { message: "Your day is completely full!" };
  }

  // --- Step 2: Format Data for AI ---
  console.log("Step 2: Analyzing locations...");
  const formattedGaps = timeGaps.map((gap, index) => ({
    index,
    // Using ISO strings ensures the AI understands the exact date and time context
    gapStartISO: gap.start.toISOString(),
    gapEndISO: gap.end.toISOString(),
    durationMinutes: gap.durationMinutes,
    comingFrom: gap.previousLocation?.address || "Unknown/Home",
    goingTo: gap.nextLocation?.address || "Unknown/Home"
  }));

  // --- Step 3: Fetch Historical Frequency ---
  console.log("Step 3: Fetching Activity History...");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const historyQuery = query(
    collection(db, 'users', user.uid, 'events'),
    where('start', '>=', Timestamp.fromDate(sevenDaysAgo))
  );
  
  const historySnap = await getDocs(historyQuery);
  const activityCounts: Record<string, number> = {};
  
  priorities.forEach(p => activityCounts[p.title] = 0);
  
  historySnap.forEach(doc => {
    const data = doc.data();
    if (activityCounts[data.title] !== undefined) {
      activityCounts[data.title]++;
    }
  });

  // --- Step 4: Updated AI Prompt with Timing Logic ---
  console.log("Step 4: Prompting Gemini...");
  const prompt = `
    You are an intelligent scheduling AI. Your goal is to fill free time gaps with activities from the Priorities list.
    
    Today's Date: ${targetDate.toDateString()}
    
    1. FREE TIME GAPS:
    ${JSON.stringify(formattedGaps, null, 2)}
    
    2. USER PRIORITIES:
    ${JSON.stringify(priorities.map(p => ({ id: p.id, title: p.title, rank: p.rank, location: p.location.address })), null, 2)}
    
    3. RECENT HISTORY:
    ${JSON.stringify(activityCounts, null, 2)}
    
    CRITICAL INSTRUCTIONS:
    - You MUST assign a specific "startTime" and "endTime" for each suggestion.
    - These times MUST fall strictly within the boundaries of the gap provided (gapStartISO to gapEndISO).
    - NO OVERLAPS: If you suggest multiple activities for one gap, ensure the second activity starts after the first one ends.
    - TRAVEL BUFFER: Leave at least 10-15 minutes between activities for transition/travel.
    - DURATION: Base the length of the suggestion on the activity type (e.g., "Gym" = 60m, "Meditate" = 15m).
    - Use ISO 8601 format for startTime and endTime.

    OUTPUT FORMAT:
    Return a raw JSON array. Just the raw JSON, no markdown.
    [
      {
        "gapIndex": 0,
        "suggestedPriorityId": "id",
        "suggestedPriorityTitle": "Title",
        "startTime": "2026-04-12T14:00:00.000Z",
        "endTime": "2026-04-12T14:45:00.000Z",
        "reasoning": "A short explanation."
      }
    ]
  `;

  // --- Step 5: Parse and Map Response ---
  console.log("Step 5: Parsing Response...");
  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    responseText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    const suggestedSchedule = JSON.parse(responseText);
    
    return suggestedSchedule.map((suggestion: any, index: number) => ({
      ...suggestion,
      tempId: `sug-${suggestion.gapIndex}-${index}`,
      // We overwrite the gap boundaries with the AI's specific calculated times
      gapStart: new Date(suggestion.startTime), 
      gapEnd: new Date(suggestion.endTime),
    }));
    
  } catch (error) {
    console.error("AI Generation or Parsing Failed:", error);
    return null;
  }
};

// --- HELPER FUNCTIONS ---

function calculateTimeGaps(events: CalendarEvent[], targetDate: Date): TimeGap[] {
  const dayStart = new Date(targetDate);
  dayStart.setHours(8, 0, 0, 0);
  
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(22, 0, 0, 0);

  const dayEvents = events.filter(e => e.end > dayStart && e.start < dayEnd);

  if (dayEvents.length === 0) {
    return [{
      start: dayStart,
      end: dayEnd,
      durationMinutes: (dayEnd.getTime() - dayStart.getTime()) / 60000,
      previousLocation: null,
      nextLocation: null
    }];
  }

  dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  const mergedEvents: CalendarEvent[] = [dayEvents[0]];
  for (let i = 1; i < dayEvents.length; i++) {
    const currentEvent = dayEvents[i];
    const lastMergedEvent = mergedEvents[mergedEvents.length - 1];
    if (currentEvent.start <= lastMergedEvent.end) {
      if (currentEvent.end > lastMergedEvent.end) {
        lastMergedEvent.end = currentEvent.end;
        lastMergedEvent.location = currentEvent.location; 
      }
    } else {
      mergedEvents.push(currentEvent);
    }
  }

  const gaps: TimeGap[] = [];
  let currentTime = dayStart;
  let previousLoc: LocationData | null = null;

  for (const event of mergedEvents) {
    if (event.start > currentTime) {
      const duration = Math.round((event.start.getTime() - currentTime.getTime()) / 60000);
      if (duration >= 30) {
        gaps.push({
          start: new Date(currentTime),
          end: new Date(event.start),
          durationMinutes: duration,
          previousLocation: previousLoc,
          nextLocation: event.location
        });
      }
    }
    currentTime = event.end > currentTime ? event.end : currentTime;
    previousLoc = event.location;
  }

  if (currentTime < dayEnd) {
    const duration = Math.round((dayEnd.getTime() - currentTime.getTime()) / 60000);
    if (duration >= 30) {
      gaps.push({
        start: new Date(currentTime),
        end: new Date(dayEnd),
        durationMinutes: duration,
        previousLocation: previousLoc,
        nextLocation: null
      });
    }
  }

  return gaps;
}
