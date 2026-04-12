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
  text: string;
  index: number;
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
  
  priorities.forEach(p => activityCounts[p.text] = 0);
  
  historySnap.forEach(doc => {
    const data = doc.data();
    if (activityCounts[data.title] !== undefined) {
      activityCounts[data.title]++;
    }
  });



  // --- Step 4: Refined AI Prompt for Maximum Efficiency ---
  console.log("Step 4: Prompting Gemini...");
  const prompt = `
    You are a high-productivity assistant. Your goal is to FILL the user's free time gaps with as many activities from their Priorities list as realistically possible.
    
    Today's Date: ${targetDate.toDateString()}
    
    1. FREE TIME GAPS:
    ${JSON.stringify(formattedGaps, null, 2)}
    
    2. USER PRIORITIES:
    ${JSON.stringify(priorities.map(p => ({ id: p.id, title: p.text, rank: p.index, location: p.location.address })), null, 2)}
    
    3. RECENT HISTORY:
    ${JSON.stringify(activityCounts, null, 2)}
    
    CRITICAL INSTRUCTIONS:
    - NEVER EVER USE OR SAY THE ID
    - NEVER EVER USE LOCATION FOR EVENT TITLE
    - USE GIVEN PRIORITY TITLES IN SUGGESTIONS
    - LOOK AT ALREADY SCHEDULED EVENTS AND DONT REPEAT ACTIVITIES IN A DAY
    - DON'T REPEAT PRIORITIES: Each priority can only be suggested once per day.
    - BASE TIME FRAME OF SUGGESTION BASED ON ACTIVITY: DONT JUST FILL THE GAP, FIT THE ACTIVITY
    - DONT JUST PLACE THE PRIORITIES IN ORDER UNLESS IT MAKES SENSE TO DO SO. BE FLEXIBLE AND CREATIVE WITH THE SUGGESTIONS.
    - SUGGEST UNIQUE ACTIVITIES OUTSIDE OF PRIORITIES IF THEY FIT PERFECTLY IN A GAP (e.g., "Quick Walk", "Coffee Break") but only if they don't have a perfect priority match.
    - SUGGEST ACTIVITIES BASED ON HISTORY IF PRIORITIES ALL USED
    - MAXIMIZE GAPS: If a gap is 2+ hours long, you MUST suggest multiple activities (e.g., 2-4 items) rather than just one.
    - DENSITY: Do not leave large chunks of free time empty unless the user's priority list is exhausted.
    - TRANSPORTATION BUFFER: Leave EXACTLY 15-20 minutes of empty space between every activity (including existing events) to account for travel and rest.
    - LOGIC: Ensure the "startTime" and "endTime" are realistic. 
    - NO OVERLAPS: Ensure the end of one suggestion and the start of the next (plus the buffer) do not collide.
    - Use ISO 8601 format for startTime and endTime.

    OUTPUT FORMAT:
    Return a raw JSON array.
    [
      {
        "gapIndex": 0,
        "suggestedPriorityId": "id",
        "suggestedPriorityTitle": "Title",
        "startTime": "2026-04-12T14:00:00.000Z",
        "endTime": "2026-04-12T14:45:00.000Z",
        "reasoning": "Explain why this fits here (e.g., 'Fits perfectly after your morning meeting with a 20m travel buffer')."
      }
    ]
  `;

  // --- Step 5: Parse and Map Response ---
 // --- Step 5: Parse and Map Response ---
console.log("Step 5: Parsing Response...");
try {
  const result = await model.generateContent(prompt);
  let responseText = result.response.text();
  
  responseText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  
  const suggestedSchedule = JSON.parse(responseText);
  
  if (!Array.isArray(suggestedSchedule)) {
      throw new Error("AI did not return an array");
  }

  return suggestedSchedule.map((suggestion: any, index: number) => {
    // 1. Find the original priority data to ensure Rank/Title are never missing
    const original = priorities.find(p => p.id === suggestion.suggestedPriorityId);

    return {
      ...suggestion,
      // 2. FIX: Generate a truly unique key using gapIndex, the loop index, and a timestamp
      // This prevents the "sug-0" duplicate key error
      tempId: `gap-${suggestion.gapIndex}-item-${index}-${Date.now()}`,
      
      // 3. Ensure Title and Rank are pulled from your source of truth
      suggestedPriorityTitle: original ? original.text : suggestion.suggestedPriorityTitle,
      rank: original ? original.index : suggestion.rank,
      
      gapStart: new Date(suggestion.startTime), 
      gapEnd: new Date(suggestion.endTime),
    };
  });
  
} catch (error) {
  console.error("AI Generation or Parsing Failed:", error);
  return null;
}

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
}
