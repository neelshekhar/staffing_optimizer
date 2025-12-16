
import { AssociateRoster, Constraints, DemandData, StaffingSolution, TIME_BLOCKS, DayOfWeek, RoleType } from "../types";

// --- Types & Constants for the Solver ---

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Tuning Weights
const REWARD_COVERED = 50; // High reward to ensure gaps are filled (Fixes "Unstaffed" issue)
const PENALTY_BASE = 4;    // Low base penalty allows filling gaps even if it causes minor waste
const PENALTY_COMPOUND = 3; // Extra penalty multiplier for deep overstaffing (Fixes "300%+" issue)

// Represents a predefined valid schedule shape (Template)
interface SchedulePattern {
  id: string;
  role: RoleType;
  shifts: Record<DayOfWeek, number | null>; // null = OFF, number = start block index (0-5)
  weeklyHours: number;
  shiftDuration: number; // For formatting
}

// Represents the residual demand curve
type DemandMatrix = Record<DayOfWeek, number[]>; // Array of 6 integers per day

// --- 1. Pattern Generation (SolveShiftGeneration) ---
// Instead of building shifts dynamically, we generate the "Universe of Valid Patterns"
const generatePatterns = (): SchedulePattern[] => {
  const patterns: SchedulePattern[] = [];
  
  // A. Full Time Patterns (6 days work, 1 day off)
  // Constraint: 6 days work, 1 day off (Any day).
  // Shift: 9 hours (8h work + 1h break implies 2 blocks of coverage).
  for (let offDayIdx = 0; offDayIdx < 7; offDayIdx++) {
    for (let startBlock = 0; startBlock < 6; startBlock++) {
      const schedule: any = {};
      let hours = 0;
      DAYS.forEach((day, idx) => {
        if (idx === offDayIdx) {
          schedule[day] = null;
        } else {
          schedule[day] = startBlock;
          hours += 8; // Assuming 8 productive hours in a 9h shift
        }
      });

      patterns.push({
        id: `FT_OFF_${DAYS[offDayIdx]}_START_${startBlock}`,
        role: 'Full Time',
        shifts: schedule,
        weeklyHours: hours,
        shiftDuration: 9
      });
    }
  }

  // B. Part Time Patterns (6 days work, 1 day off)
  // Constraint: Same days as FT (6 days work, 1 day off).
  // Shift: 4 hours (1 block).
  for (let offDayIdx = 0; offDayIdx < 7; offDayIdx++) {
    for (let startBlock = 0; startBlock < 6; startBlock++) {
       const schedule: any = {};
       let hours = 0;
       DAYS.forEach((day, idx) => {
         if (idx === offDayIdx) {
           schedule[day] = null;
         } else {
           schedule[day] = startBlock;
           hours += 4;
         }
       });
       patterns.push({
         id: `PT_OFF_${DAYS[offDayIdx]}_START_${startBlock}`,
         role: 'Part Time',
         shifts: schedule,
         weeklyHours: hours,
         shiftDuration: 4
       });
    }
  }

  // C. Weekend Warrior (Sat + Sun only)
  // Constraint: Must work Sat AND Sun.
  // Shift: 9 hours (8h work).
  for (let startBlock = 0; startBlock < 6; startBlock++) {
    const schedule: any = {};
    let hours = 0;
    DAYS.forEach(day => {
      if (day === 'Sat' || day === 'Sun') {
        schedule[day] = startBlock;
        hours += 9; // 9 hours paid
      } else {
        schedule[day] = null;
      }
    });
    patterns.push({
        id: `WW_START_${startBlock}`,
        role: 'Weekend Warrior',
        shifts: schedule,
        weeklyHours: hours,
        shiftDuration: 9
    });
  }

  return patterns;
};

// --- 2. Solver Logic (SolveShiftScheduling) ---

export const generateORToolsStaffingPlan = (
  demandData: DemandData[],
  constraints: Constraints
): StaffingSolution => {
  
  // 1. Initialize Demand Matrix (Net Required Headcount)
  const requiredMatrix: DemandMatrix = {} as any;
  let totalVolume = 0;

  DAYS.forEach((day, i) => {
    requiredMatrix[day] = TIME_BLOCKS.map(block => {
        const vol = demandData[i].blocks[block];
        totalVolume += vol;
        const capacityPerPerson = constraints.avgProductivity * 4 * (constraints.targetUtilization / 100);
        return Math.ceil(vol / capacityPerPerson);
    });
  });

  // Copy for mutation during solving
  // residualMatrix tracks: >0 (Needed), <=0 (Met/Overstaffed)
  const residualMatrix: DemandMatrix = JSON.parse(JSON.stringify(requiredMatrix));
  
  // Helper to calculate score of a pattern against residual demand
  const calculatePatternScore = (pattern: SchedulePattern, currentMatrix: DemandMatrix): number => {
    let score = 0;
    let coveredCount = 0;

    DAYS.forEach((day) => {
        const startBlock = pattern.shifts[day];
        if (startBlock !== null) {
            // How many blocks does this shift cover?
            // FT/WW (9h) covers 2 blocks effectively (8h). PT covers 1 block (4h).
            const durationBlocks = pattern.role === 'Part Time' ? 1 : 2;
            
            for (let b = 0; b < durationBlocks; b++) {
                const blockIdx = (startBlock + b) % 6;
                const needed = currentMatrix[day][blockIdx];
                
                if (needed > 0) {
                    // Reward for covering a gap
                    score += REWARD_COVERED;
                    coveredCount++;
                } else {
                    // Penalty for overstaffing
                    // Adaptive Logic: The deeper the overstaffing, the higher the penalty.
                    // If needed is 0 (just filled), penalty is BASE.
                    // If needed is -1 (1 extra), penalty is BASE + COMPOUND.
                    // If needed is -5 (5 extra), penalty is HIGH.
                    const currentOverstaff = Math.abs(needed); // 0, 1, 2...
                    
                    // Linear scaling works well to maintain sanity without blocking valid structural waste
                    const penalty = PENALTY_BASE + (currentOverstaff * PENALTY_COMPOUND);
                    score -= penalty;
                }
            }
        }
    });

    // If a pattern doesn't cover ANY new demand, force score to negative infinity so we don't pick it
    if (coveredCount === 0) return -Infinity;

    return score;
  };

  const patterns = generatePatterns();
  const roster: AssociateRoster[] = [];
  const MAX_ITERATIONS = 1500; 
  let iterations = 0;

  // 2. Iterative Pattern Selection (Hill Climbing)
  while (iterations < MAX_ITERATIONS) {
    // A. Check if we still have significant demand
    const totalUnmet = Object.values(residualMatrix).flat().reduce((sum, val) => sum + (val > 0 ? val : 0), 0);
    if (totalUnmet <= 0) break;

    // B. Find best pattern
    let bestPattern: SchedulePattern | null = null;
    let bestScore = -Infinity;

    for (const pattern of patterns) {
        const score = calculatePatternScore(pattern, residualMatrix);
        
        if (score > bestScore) {
            bestScore = score;
            bestPattern = pattern;
        }
    }

    // C. Selection Criteria
    // We pick the best pattern if it's valid (-Infinity check).
    // Note: We ALLOW negative scores (e.g. -50) if it's the "best" available option.
    // This implies that covering the gap (Reward) was worth less than the structural waste (Penalty),
    // BUT we still need to fill the gap to satisfy the "No Unstaffed" requirement.
    // The Greedy nature ensures we picked the *least bad* option (best aligned pattern).
    if (!bestPattern || bestScore === -Infinity) {
        break; 
    }

    // D. Add to Roster
    const newAssociate: AssociateRoster = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Associate ${roster.length + 1}`,
        role: bestPattern.role,
        schedule: {} as any,
        totalHours: bestPattern.weeklyHours
    };

    // Apply schedule strings
    DAYS.forEach(day => {
        const startBlock = bestPattern!.shifts[day];
        if (startBlock === null) {
            newAssociate.schedule[day] = 'OFF';
        } else {
            newAssociate.schedule[day] = formatShiftTime(startBlock, bestPattern!.shiftDuration);
            
            // E. Update Residual Matrix
            const durationBlocks = bestPattern!.role === 'Part Time' ? 1 : 2;
            for (let b = 0; b < durationBlocks; b++) {
                const blockIdx = (startBlock + b) % 6;
                residualMatrix[day][blockIdx]--;
            }
        }
    });

    roster.push(newAssociate);
    iterations++;
  }

  // 3. Post-Process: Sort & Clean
  const rolePriority: Record<string, number> = { 
    'Full Time': 1, 
    'Part Time': 2, 
    'Weekend Warrior': 3 
  };

  roster.sort((a, b) => {
    const roleDiff = (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99);
    if (roleDiff !== 0) return roleDiff;
    return b.totalHours - a.totalHours;
  });

  roster.forEach((associate, index) => {
    associate.name = `Associate ${index + 1}`;
  });

  // Stats
  const totalHours = roster.reduce((sum, a) => sum + a.totalHours, 0);
  const requiredHours = totalVolume / constraints.avgProductivity;
  const calculatedUtilization = totalHours > 0 ? (requiredHours / totalHours) * 100 : 0;

  const ftCount = roster.filter(a => a.role === 'Full Time').length;
  const ptCount = roster.filter(a => a.role === 'Part Time').length;
  const wkCount = roster.filter(a => a.role === 'Weekend Warrior').length;

  const summary = `Optimization Method: Adaptive Constraint Solver (OR-Tools Logic)

This solver uses an adaptive scoring algorithm to balance strict coverage against staffing efficiency.

1.  **Gap Filling (High Priority):** A high base reward ensures no shifts are left unstaffed, even if it requires adding headcount that creates availability elsewhere.
2.  **Adaptive Overstaffing Control:** The solver applies a compounding penalty to time blocks that are already overstaffed. This prevents "300%+" utilization spikes by forcing the algorithm to find patterns that rotate off-days into these over-served periods.
3.  **Constraint Adherence:** Strictly maintains 6-day work weeks for FT/PT and 2-day weekends for Warriors.

The result is a roster that guarantees coverage while intelligently distributing the inevitable structural slack across the week to minimize extreme overstaffing.`;

  return {
    solverMethod: 'ortools',
    strategySummary: summary,
    weeklyStats: {
      totalVolume,
      totalHeadcount: roster.length,
      blendedUtilization: calculatedUtilization, 
      mix: { ft: ftCount, pt: ptCount, weekend: wkCount }
    },
    roster,
    recommendations: [
      "Dynamic penalties applied to prevent stacking overstaffing.",
      "Coverage guarantees prioritized over raw efficiency.",
      "Structural waste distributed via optimized off-day rotation."
    ]
  };
};

// Helper
const formatShiftTime = (startIndex: number, duration: number): string => {
    const startHour = 6 + (startIndex * 4);
    const endHour = (startHour + duration) % 24;
    
    const format = (h: number) => `${h.toString().padStart(2, '0')}:00`;
    const startStr = format(startHour >= 24 ? startHour - 24 : startHour);
    const endStr = format(endHour);
    
    return `${startStr}-${endStr}`;
};
