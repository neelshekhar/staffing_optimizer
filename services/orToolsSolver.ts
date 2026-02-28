
import highs from 'highs';
import highsWasmUrl from 'highs/runtime?url';
import { AssociateRoster, Constraints, DemandData, StaffingSolution, DayOfWeek, RoleType } from "../types";

// --- Types & Constants for the Solver ---

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Represents a predefined valid schedule shape (Template)
interface SchedulePattern {
  id: string;
  role: RoleType;
  shifts: Record<DayOfWeek, number | null>; // null = OFF, number = start hour (0-23)
  weeklyHours: number;
  shiftDuration: number; // For formatting
  workHours: number; // Actual hours of work covered
}

// Helper to check if a shift is valid based on constraints
const isValidShift = (startHour: number, duration: number): boolean => {
    const endHour = (startHour + duration) % 24;
    
    // No shift starts after Midnight (00:00)
    if (startHour > 0 && startHour < 5) return false;
    
    // No shift ends before 5 AM
    if (endHour > 0 && endHour < 5) return false;
    
    return true;
};

// --- 1. Pattern Generation (SolveShiftGeneration) ---
// Instead of building shifts dynamically, we generate the "Universe of Valid Patterns"
const generatePatterns = (constraints: Constraints): SchedulePattern[] => {
  const patterns: SchedulePattern[] = [];
  
  const maxOffDayIdx = constraints.allowWeekendOffs ? 7 : 5;
  
  // A. Full Time Patterns (6 days work, 1 day off)
  // Constraint: 6 days work, 1 day off.
  // Shift: 9 hours (8h work + 1h break implies 8 hours of coverage).
  for (let offDayIdx = 0; offDayIdx < maxOffDayIdx; offDayIdx++) {
    for (let startHour = 0; startHour < 24; startHour++) {
      if (!isValidShift(startHour, 9)) continue;

      const schedule: any = {};
      let hours = 0;
      DAYS.forEach((day, idx) => {
        if (idx === offDayIdx) {
          schedule[day] = null;
        } else {
          schedule[day] = startHour;
          hours += 8; // Assuming 8 productive hours in a 9h shift
        }
      });

      patterns.push({
        id: `FT_OFF_${DAYS[offDayIdx]}_START_${startHour}`,
        role: 'Full Time',
        shifts: schedule,
        weeklyHours: hours,
        shiftDuration: 9,
        workHours: 8
      });
    }
  }

  // B. Part Time Patterns (6 days work, 1 day off)
  // Constraint: Same days as FT (6 days work, 1 day off).
  // Shift: 4 hours (4h work).
  for (let offDayIdx = 0; offDayIdx < maxOffDayIdx; offDayIdx++) {
    for (let startHour = 0; startHour < 24; startHour++) {
       if (!isValidShift(startHour, 4)) continue;

       const schedule: any = {};
       let hours = 0;
       DAYS.forEach((day, idx) => {
         if (idx === offDayIdx) {
           schedule[day] = null;
         } else {
           schedule[day] = startHour;
           hours += 4;
         }
       });
       patterns.push({
         id: `PT_OFF_${DAYS[offDayIdx]}_START_${startHour}`,
         role: 'Part Time',
         shifts: schedule,
         weeklyHours: hours,
         shiftDuration: 4,
         workHours: 4
       });
    }
  }

  // C. Weekend Warrior (Sat + Sun only)
  // Constraint: Must work Sat AND Sun.
  // Shift: 9 hours (8h work).
  for (let startHour = 0; startHour < 24; startHour++) {
    if (!isValidShift(startHour, 9)) continue;

    const schedule: any = {};
    let hours = 0;
    DAYS.forEach(day => {
      if (day === 'Sat' || day === 'Sun') {
        schedule[day] = startHour;
        hours += 8; // 8 hours paid/worked
      } else {
        schedule[day] = null;
      }
    });
    patterns.push({
        id: `WW_START_${startHour}`,
        role: 'Weekend Warrior',
        shifts: schedule,
        weeklyHours: hours,
        shiftDuration: 9,
        workHours: 8
    });
  }

  return patterns;
};

// --- 2. Solver Logic (Highs WASM) ---

export const generateORToolsStaffingPlan = async (
  demandData: DemandData[],
  constraints: Constraints
): Promise<StaffingSolution> => {
  
  // 1. Initialize Demand Matrix (Net Required Headcount)
  let totalVolume = 0;
  const requiredHeadcount: number[] = []; // Flattened 168 hours

  DAYS.forEach((day, i) => {
    demandData[i].hours.forEach(vol => {
        totalVolume += vol;
        const capacityPerPerson = constraints.avgProductivity;
        requiredHeadcount.push(vol / capacityPerPerson);
    });
  });

  const patterns = generatePatterns(constraints);
  
  // Build the MILP model for Highs
  // Minimize: sum(cost_j * x_j)
  // Subject to: sum(A_ij * x_j) >= demand_i for all hours i
  // x_j >= 0, integer
  
  let objective = "Minimize\n  obj: ";
  const variables: string[] = [];
  const constraints_str: string[] = [];
  const bounds: string[] = [];
  const generals: string[] = [];
  
  // Cost function: We want to minimize total hours scheduled.
  // FT = 48 hours, PT = 24 hours, WW = 16 hours
  patterns.forEach((p, j) => {
      const varName = `x_${j}`;
      variables.push(varName);
      
      // Add to objective function
      if (j > 0) objective += " + ";
      objective += `${p.weeklyHours} ${varName}`;
      
      // Bounds and Integer constraints
      bounds.push(`  0 <= ${varName}`);
      generals.push(`  ${varName}`);
  });
  
  objective += "\n";
  
  // Coverage constraints
  objective += "Subject To\n";
  for (let i = 0; i < 168; i++) {
      const dayIdx = Math.floor(i / 24);
      const hourIdx = i % 24;
      const day = DAYS[dayIdx];
      const demand = requiredHeadcount[i];
      
      let constraintExpr = "";
      let first = true;
      
      patterns.forEach((p, j) => {
          const startHour = p.shifts[day];
          if (startHour !== null) {
              // Check if this pattern covers this specific hour
              let covers = false;
              for (let h = 0; h < p.shiftDuration; h++) {
                  if ((startHour + h) % 24 === hourIdx) {
                      covers = true;
                      break;
                  }
              }
              
              if (covers) {
                  if (!first) constraintExpr += " + ";
                  const capacityPerHour = p.workHours / p.shiftDuration;
                  // Highs LP format supports floats
                  constraintExpr += `${capacityPerHour} x_${j}`;
                  first = false;
              }
          }
      });
      
      if (constraintExpr === "") {
          // If no pattern covers this hour, but demand > 0, it's infeasible.
          // We add a dummy constraint.
          constraintExpr = "0";
      }
      
      objective += `  c_${i}: ${constraintExpr} >= ${demand}\n`;
  }
  
  // Mix Constraints
  // PT <= partTimeCap% of (FT + PT + WW)
  // WW <= weekendCap% of (FT + PT + WW)
  
  const ptRatio = constraints.partTimeCap / 100;
  const wwRatio = constraints.weekendCap / 100;
  
  let ptConstraintExpr = "";
  let wwConstraintExpr = "";
  
  patterns.forEach((p, j) => {
      // For PT constraint: (1 - ptRatio)*PT - ptRatio*FT - ptRatio*WW <= 0
      let ptCoeff = 0;
      if (p.role === 'Part Time') {
          ptCoeff = 1 - ptRatio;
      } else {
          ptCoeff = -ptRatio;
      }
      
      if (ptCoeff !== 0) {
          if (ptConstraintExpr !== "" && ptCoeff > 0) ptConstraintExpr += " + ";
          else if (ptConstraintExpr !== "" && ptCoeff < 0) ptConstraintExpr += " - ";
          else if (ptConstraintExpr === "" && ptCoeff < 0) ptConstraintExpr += "- ";
          ptConstraintExpr += `${Math.abs(ptCoeff)} x_${j}`;
      }
      
      // For WW constraint: (1 - wwRatio)*WW - wwRatio*FT - wwRatio*PT <= 0
      let wwCoeff = 0;
      if (p.role === 'Weekend Warrior') {
          wwCoeff = 1 - wwRatio;
      } else {
          wwCoeff = -wwRatio;
      }
      
      if (wwCoeff !== 0) {
          if (wwConstraintExpr !== "" && wwCoeff > 0) wwConstraintExpr += " + ";
          else if (wwConstraintExpr !== "" && wwCoeff < 0) wwConstraintExpr += " - ";
          else if (wwConstraintExpr === "" && wwCoeff < 0) wwConstraintExpr += "- ";
          wwConstraintExpr += `${Math.abs(wwCoeff)} x_${j}`;
      }
  });
  
  if (ptConstraintExpr === "") ptConstraintExpr = "0";
  if (wwConstraintExpr === "") wwConstraintExpr = "0";
  
  objective += `  mix_pt: ${ptConstraintExpr} <= 0\n`;
  objective += `  mix_ww: ${wwConstraintExpr} <= 0\n`;
  
  objective += "Bounds\n";
  objective += bounds.join("\n") + "\n";
  
  objective += "General\n";
  objective += generals.join("\n") + "\n";
  
  objective += "End\n";

  // Run Highs
  const h = await highs({
    locateFile: (file) => {
      if (file === 'highs.wasm') return highsWasmUrl;
      return file;
    }
  });
  const result = h.solve(objective);
  
  const roster: AssociateRoster[] = [];
  
  if (result.Status === 'Optimal') {
      // Parse solution
      patterns.forEach((p, j) => {
          const varName = `x_${j}`;
          const count = Math.round(result.Columns[varName].Primal || 0);
          
          for (let k = 0; k < count; k++) {
              const newAssociate: AssociateRoster = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: `Associate ${roster.length + 1}`,
                  role: p.role,
                  schedule: {} as any,
                  totalHours: p.weeklyHours
              };

              DAYS.forEach(day => {
                  const startHour = p.shifts[day];
                  if (startHour === null) {
                      newAssociate.schedule[day] = 'OFF';
                  } else {
                      newAssociate.schedule[day] = formatShiftTime(startHour, p.shiftDuration);
                  }
              });

              roster.push(newAssociate);
          }
      });
  } else {
      throw new Error(`Highs solver failed to find an optimal solution. Status: ${result.Status}`);
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

  const summary = `Optimization Method: Highs WASM MILP Solver

This solver uses a Mixed-Integer Linear Programming (MILP) model solved via WebAssembly.

1.  **Mathematical Optimality:** It guarantees the mathematically optimal combination of shift patterns to minimize total scheduled hours while strictly meeting or exceeding demand for every hour of the week.
2.  **Strict Constraints:** It strictly enforces the Part-Time and Weekend Warrior mix caps as linear constraints within the model.
3.  **Pattern Universe:** It selects from a pre-generated universe of valid shift patterns (6-day FT/PT, weekend-only WW) that adhere to start/end time rules.

The result is the most efficient possible roster that satisfies all constraints and demand requirements.`;

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
      "Mathematically optimal shift coverage achieved.",
      "Mix caps strictly enforced via linear constraints.",
      "Total scheduled hours minimized."
    ]
  };
};

// Helper
const formatShiftTime = (startHour: number, duration: number): string => {
    const endHour = (startHour + duration) % 24;
    
    const format = (h: number) => `${h.toString().padStart(2, '0')}:00`;
    const startStr = format(startHour);
    const endStr = format(endHour);
    
    return `${startStr}-${endStr}`;
};
