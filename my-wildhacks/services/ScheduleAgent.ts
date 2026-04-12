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

  // --- Step 2: Distance Matrix Math ---
  console.log("Step 2: Analyzing locations...");
  // Instead of querying the API for every possible permutation (which would be extremely costly),
  // we pass the coordinates to Gemini and instruct it to use rough geographical heuristic logic 
  // based on the addresses, while warning it of the constraints.
  const formattedGaps = timeGaps.map((gap, index) => ({
    index,
    start: gap.start.toLocaleTimeString(),
    end: gap.end.toLocaleTimeString(),
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
  
  // Initialize counts
  priorities.forEach(p => activityCounts[p.title] = 0);
  
  // Tally occurrences
  historySnap.forEach(doc => {
    const data = doc.data();
    if (activityCounts[data.title] !== undefined) {
      activityCounts[data.title]++;
    }
  });

  // --- Step 4: The AI Prompt ---
  console.log("Step 4: Prompting Gemini...");
  const prompt = `
    You are an intelligent scheduling AI designed to prevent users from wasting their free time.
    Your goal is to fill the user's free time gaps with activities from their Priorities list.
    
    Here is the data for today (${targetDate.toDateString()}):
    
    1. FREE TIME GAPS:
    ${JSON.stringify(formattedGaps, null, 2)}
    
    2. USER PRIORITIES (Ranked by importance, 1 being highest):
    ${JSON.stringify(priorities.map(p => ({ title: p.title, rank: p.rank, location: p.location.address })), null, 2)}
    
    3. RECENT ACTIVITY HISTORY (Times each priority was done in the last 7 days):
    ${JSON.stringify(activityCounts, null, 2)}
    
    CRITICAL INSTRUCTIONS:
    - base suggestions primarily off of the name of the priority, not the location, but use the location for travel logic.
    - You must assign at least ONE priority to each free time gap.
    - Ensure the priority makes sense for the 'durationMinutes' of the gap.
    - Consider travel logistics: look at 'comingFrom' and 'goingTo'. Do not suggest a priority location that is wildly impractical to travel to between those two points.
    - BALANCE: While rank is important, variety is vital. If a high-rank priority has a high history count, you MUST suggest lower-ranked priorities that the user enjoys but hasn't done recently to prevent burnout.
    - Given a large gap in time, defer to multiple priorities over a single one to maximize variety and engagement.
    - Approximate the length of the event based on the activity in the name of the priority (e.g., "Go for a run" might be 30-60 mins, "Read a book" might be 60+ mins, "Meditate" might be 10-20 mins). Use this to determine how many priorities can fit in each gap.
    - Leave appropriate gaps between activities for travel and rest, both scheduled and suggested

    
    OUTPUT FORMAT:
    You must return a raw JSON array containing objects for each gap. Do not include markdown blocks (like \`\`\`json). Just the raw JSON.
    Format:
    [
      {
        "gapIndex": 0,
        "suggestedPriorityId": "the_id_of_the_priority",
        "suggestedPriorityTitle": "Title",
        "reasoning": "A 1-sentence explanation mentioning rank, travel logic, or history."
      }
    ]
  `;

  // --- Step 5: Parse and Return JSON ---
  console.log("Step 5: Parsing Response...");
  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Clean up any markdown formatting Gemini might accidentally include
    responseText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    const suggestedSchedule = JSON.parse(responseText);
    
    // Map the AI suggestions back to the raw Date objects from our gaps array
    return suggestedSchedule.map((suggestion: any) => ({
      ...suggestion,
      gapStart: timeGaps[suggestion.gapIndex].start,
      gapEnd: timeGaps[suggestion.gapIndex].end,
    }));
    
  } catch (error) {
    console.error("AI Generation or Parsing Failed:", error);
    return null;
  }
};

// --- HELPER FUNCTIONS ---

/**
 * Calculates free time gaps in a day, automatically merging overlapping events.
 * Assumes a waking day from 8:00 AM to 10:00 PM (can be adjusted).
 */
function calculateTimeGaps(events: CalendarEvent[], targetDate: Date): TimeGap[] {
  // 1. Define the bounds of the day (e.g., 8:00 AM to 10:00 PM)
  const dayStart = new Date(targetDate);
  dayStart.setHours(8, 0, 0, 0);
  
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(22, 0, 0, 0);

  // Filter events to only include those that fall within our day bounds
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

  // 2. Sort events chronologically by start time
  dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 3. Merge overlapping events
  const mergedEvents: CalendarEvent[] = [dayEvents[0]];
  
  for (let i = 1; i < dayEvents.length; i++) {
    const currentEvent = dayEvents[i];
    const lastMergedEvent = mergedEvents[mergedEvents.length - 1];

    // If the current event starts before or exactly when the last one ends, they overlap
    if (currentEvent.start <= lastMergedEvent.end) {
      // Extend the end time if the current event ends later
      if (currentEvent.end > lastMergedEvent.end) {
        lastMergedEvent.end = currentEvent.end;
        // Keep the location of whichever event ends later (as the departure point)
        lastMergedEvent.location = currentEvent.location; 
      }
    } else {
      mergedEvents.push(currentEvent);
    }
  }

  // 4. Extract the gaps between merged events
  const gaps: TimeGap[] = [];
  let currentTime = dayStart;
  let previousLoc: LocationData | null = null;

  for (const event of mergedEvents) {
    if (event.start > currentTime) {
      const duration = Math.round((event.start.getTime() - currentTime.getTime()) / 60000);
      // Only consider gaps larger than 30 minutes
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

  // 5. Add the final gap from the last event to the end of the day
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