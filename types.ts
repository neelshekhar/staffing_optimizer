
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type RoleType = 'Full Time' | 'Part Time' | 'Weekend Warrior';

export interface DemandData {
  day: DayOfWeek;
  hours: number[]; // Array of 24 numbers representing demand for each hour (0-23)
}

export interface Constraints {
  avgProductivity: number; // units per hour
  minWeeklyOffs: number; // e.g., 1 or 2
  partTimeCap: number; // Max PT as % of total headcount
  weekendCap: number; // Max Weekend as % of total headcount
  allowWeekendOffs: boolean; // Allow FT/PT to have weekends off
}

export interface AssociateRoster {
  id: string;
  name: string;
  role: RoleType;
  schedule: Record<DayOfWeek, string>; // e.g., "06:00 - 15:00" or "OFF"
  totalHours: number;
}

// The structure received from Gemini
export interface StaffingSolution {
  solverMethod?: 'greedy' | 'ortools'; // Added field
  strategySummary: string;
  weeklyStats: {
    totalVolume: number;
    totalHeadcount: number;
    blendedUtilization: number;
    mix: {
      ft: number;
      pt: number;
      weekend: number;
    };
  };
  roster: AssociateRoster[];
  recommendations: string[];
}

// Initial data helper
const createEmptyDay = (day: DayOfWeek): DemandData => ({
  day,
  hours: new Array(24).fill(0)
});

// Default hourly demand based on the user's example
const DEFAULT_HOURS = [
  0, 0, 0, 0, 0, 0, // 0-5
  9, 16, 37, 51, 58, 79, // 6-11
  58, 53, 42, 10, 50, 67, // 12-17
  82, 94, 81, 54, 45, 0 // 18-23
];

export const INITIAL_DEMAND: DemandData[] = [
  { ...createEmptyDay('Mon'), hours: [...DEFAULT_HOURS] },
  { ...createEmptyDay('Tue'), hours: [...DEFAULT_HOURS] },
  { ...createEmptyDay('Wed'), hours: [...DEFAULT_HOURS] },
  { ...createEmptyDay('Thu'), hours: [...DEFAULT_HOURS] },
  { ...createEmptyDay('Fri'), hours: [...DEFAULT_HOURS] },
  { ...createEmptyDay('Sat'), hours: [...DEFAULT_HOURS].map(x => Math.round(x * 1.3)) },
  { ...createEmptyDay('Sun'), hours: [...DEFAULT_HOURS].map(x => Math.round(x * 1.3)) },
];

export const INITIAL_CONSTRAINTS: Constraints = {
  avgProductivity: 12, // items picked per hour per person (Updated default)
  minWeeklyOffs: 1,
  partTimeCap: 30, // 30% of total headcount
  weekendCap: 30, // 30% of total headcount
  allowWeekendOffs: false,
};

