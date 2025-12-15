
export type TimeBlock = 
  | '06:00-10:00' 
  | '10:00-14:00' 
  | '14:00-18:00' 
  | '18:00-22:00' 
  | '22:00-02:00' 
  | '02:00-06:00';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type RoleType = 'Full Time' | 'Part Time' | 'Weekend Warrior';

export interface DemandData {
  day: DayOfWeek;
  // Dynamic map for the 6 blocks
  blocks: Record<TimeBlock, number>;
}

export interface Constraints {
  avgProductivity: number; // units per hour
  targetUtilization: number; // percentage (e.g., 0.85)
  minWeeklyOffs: number; // e.g., 1 or 2
  weekendSpike: number; // percentage multiplier perception (informational)
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
  blocks: {
    '06:00-10:00': 0,
    '10:00-14:00': 0,
    '14:00-18:00': 0,
    '18:00-22:00': 0,
    '22:00-02:00': 0,
    '02:00-06:00': 0,
  }
});

// Updated defaults: 600, 400, 400, 800, 600, 200
const DEFAULT_BLOCKS = { 
  '06:00-10:00': 600, 
  '10:00-14:00': 400, 
  '14:00-18:00': 400, 
  '18:00-22:00': 800, 
  '22:00-02:00': 600, 
  '02:00-06:00': 200 
};

export const INITIAL_DEMAND: DemandData[] = [
  { ...createEmptyDay('Mon'), blocks: DEFAULT_BLOCKS },
  createEmptyDay('Tue'),
  createEmptyDay('Wed'),
  createEmptyDay('Thu'),
  createEmptyDay('Fri'),
  createEmptyDay('Sat'),
  createEmptyDay('Sun'),
];

export const INITIAL_CONSTRAINTS: Constraints = {
  avgProductivity: 15, // items picked per hour per person (Updated default)
  targetUtilization: 100, // 100% utilization target (Updated default)
  minWeeklyOffs: 1,
  weekendSpike: 30, 
};

export const TIME_BLOCKS: TimeBlock[] = [
  '06:00-10:00', 
  '10:00-14:00', 
  '14:00-18:00', 
  '18:00-22:00', 
  '22:00-02:00', 
  '02:00-06:00'
];
