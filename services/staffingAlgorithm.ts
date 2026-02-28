import { AssociateRoster, Constraints, DemandData, StaffingSolution, DayOfWeek } from "../types";

// Helper to generate a consistent ID
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ShiftUnit {
  day: DayOfWeek;
  dayIndex: number; // 0=Mon, 6=Sun
  startHour: number;
  type: 'FT' | 'PT'; // FT = 8h work (9h duration), PT = 4h work (4h duration)
  durationHours: number;
}

const isValidShift = (startHour: number, duration: number): boolean => {
  const endHour = (startHour + duration) % 24;
  
  // No shift starts after Midnight (00:00) and before 5 AM
  if (startHour > 0 && startHour < 5) return false;
  
  // No shift ends before 5 AM
  if (endHour > 0 && endHour < 5) return false;
  
  return true;
};

export const generateAlgorithmicStaffingPlan = (
  demandData: DemandData[],
  constraints: Constraints
): StaffingSolution => {
  
  // --- Step 1: Deconstruct Demand into Required Shift Units ---
  
  const neededShifts: ShiftUnit[] = [];

  demandData.forEach((dayData, dayIdx) => {
    const onePersonCapacity = constraints.avgProductivity * (constraints.targetUtilization / 100);
    const uncovered = dayData.hours.map(vol => vol / onePersonCapacity);

    let safety = 0;
    while (uncovered.some(v => v > 0.01) && safety < 1000) {
      safety++;
      let bestShift: { start: number, type: 'FT'|'PT', covered: number, efficiency: number } | null = null;
      let maxEfficiency = -1;

      const evaluate = (s: number, type: 'FT'|'PT', workHours: number, duration: number) => {
        if (!isValidShift(s, duration)) return;
        
        let covered = 0;
        
        if (type === 'FT') {
            // Peak Protection Logic:
            // Identify the 3 hours with highest UNMET demand within the 9-hour window.
            // Assign 1.0 capacity to those 3 hours.
            // Assign 5/6 (0.833) capacity to the other 6 hours.
            
            const windowHours: { hourIdx: number, demand: number }[] = [];
            for (let i = 0; i < duration; i++) {
                const h = (s + i) % 24;
                windowHours.push({ hourIdx: h, demand: uncovered[h] });
            }
            
            // Sort by demand descending to find peaks
            windowHours.sort((a, b) => b.demand - a.demand);
            
            // Top 3 get 1.0, rest get 0.833
            const capacityMap = new Map<number, number>();
            windowHours.forEach((wh, idx) => {
                capacityMap.set(wh.hourIdx, idx < 3 ? 1.0 : 5/6);
            });
            
            for (let i = 0; i < duration; i++) {
                const h = (s + i) % 24;
                const cap = capacityMap.get(h)!;
                covered += Math.min(uncovered[h], cap);
            }
        } else {
            // PT Logic: Flat 1.0 capacity
            for (let i = 0; i < duration; i++) {
                const h = (s + i) % 24;
                covered += Math.min(uncovered[h], 1.0);
            }
        }
        
        if (covered < 0.01) return;
        
        const efficiency = covered / workHours;
        
        if (efficiency > maxEfficiency) {
          maxEfficiency = efficiency;
          bestShift = { start: s, type, covered, efficiency };
        } else if (efficiency === maxEfficiency) {
            // Tie breaker: prefer the one that covers MORE hours (FT over PT)
            if (bestShift && covered > bestShift.covered) {
                bestShift = { start: s, type, covered, efficiency };
            }
        }
      };

      for (let s = 0; s < 24; s++) {
        evaluate(s, 'FT', 8, 9);
        evaluate(s, 'PT', 4, 4);
      }

      if (!bestShift) {
        // If we can't find a valid shift to cover remaining demand, we must break to avoid infinite loop.
        // This shouldn't happen with our valid shift rules, but just in case.
        break;
      }

      neededShifts.push({
        day: dayData.day,
        dayIndex: dayIdx,
        startHour: bestShift.start,
        type: bestShift.type,
        durationHours: bestShift.type === 'FT' ? 8 : 4
      });

      if (bestShift.type === 'FT') {
          // Re-calculate capacities for assignment
          const windowHours: { hourIdx: number, demand: number }[] = [];
          for (let i = 0; i < 9; i++) {
              const h = (bestShift.start + i) % 24;
              windowHours.push({ hourIdx: h, demand: uncovered[h] });
          }
          windowHours.sort((a, b) => b.demand - a.demand);
          
          const capacityMap = new Map<number, number>();
          windowHours.forEach((wh, idx) => {
              capacityMap.set(wh.hourIdx, idx < 3 ? 1.0 : 5/6);
          });
          
          for (let i = 0; i < 9; i++) {
              const h = (bestShift.start + i) % 24;
              const cap = capacityMap.get(h)!;
              uncovered[h] = Math.max(0, uncovered[h] - cap);
          }
      } else {
          // PT Assignment
          for (let i = 0; i < 4; i++) {
              const h = (bestShift.start + i) % 24;
              uncovered[h] = Math.max(0, uncovered[h] - 1.0);
          }
      }
    }
  });

  const roster: AssociateRoster[] = [];

  // Helper to find and remove a specific shift from the pool
  const popShift = (dayIdx: number, startHour: number, type: 'FT' | 'PT'): ShiftUnit | null => {
    const idx = neededShifts.findIndex(s => 
      s.dayIndex === dayIdx && s.startHour === startHour && s.type === type
    );
    if (idx !== -1) {
      return neededShifts.splice(idx, 1)[0];
    }
    return null;
  };

  const sortShifts = () => {
     neededShifts.sort((a, b) => {
      // Prioritize weekend
      const isWeekendA = a.dayIndex >= 5;
      const isWeekendB = b.dayIndex >= 5;
      if (isWeekendA && !isWeekendB) return -1;
      if (!isWeekendA && isWeekendB) return 1;
      return 0; 
    });
  };


  // --- Step 2: Construct Roster (Greedy Satisfaction) ---
  
  let safety = 0;
  // Initialize rotation at 2 so the first off-day is Friday (index 4), 
  // then Thu(3), Wed(2), Tue(1), Mon(0), Sun(6), Sat(5).
  // This pushes weekend off-days to the end of the rotation cycle, maximizing weekend coverage for core staff.
  let offDayRotationIndex = 2; 

  while (neededShifts.length > 0 && safety < 5000) {
    safety++;
    sortShifts(); 
    
    const seed = neededShifts[0];
    
    // Check availability for this BlockIndex & Type across the week
    const availabilityByDay = Array(7).fill(false);
    const countsByDay = Array(7).fill(0);
    
    neededShifts.forEach(s => {
      if (s.startHour === seed.startHour && s.type === seed.type) {
        availabilityByDay[s.dayIndex] = true;
        countsByDay[s.dayIndex]++;
      }
    });

    const daysAvailableCount = availabilityByDay.filter(Boolean).length;

    let assigned = false;

    // STRATEGY A: 6-Day Roster
    if (daysAvailableCount >= 3 || seed.dayIndex < 5) {
      const workDaysSet = new Set<number>();
      const daysWithCounts = countsByDay.map((count, idx) => ({ idx, count }));
      
      daysWithCounts.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const distA = (a.idx + offDayRotationIndex) % 7;
        const distB = (b.idx + offDayRotationIndex) % 7;
        return distA - distB; 
      });

      offDayRotationIndex++; 
      const selected = daysWithCounts.slice(0, 6);
      selected.forEach(x => workDaysSet.add(x.idx));

      const newAssociate: AssociateRoster = {
        id: generateId(),
        name: 'Temp',
        role: seed.type === 'FT' ? 'Full Time' : 'Part Time',
        schedule: { Mon: 'OFF', Tue: 'OFF', Wed: 'OFF', Thu: 'OFF', Fri: 'OFF', Sat: 'OFF', Sun: 'OFF' },
        totalHours: 0
      };

      workDaysSet.forEach(dIdx => {
        const dayName = getDayName(dIdx);
        const realShift = popShift(dIdx, seed.startHour, seed.type);
        
        if (realShift) {
          newAssociate.schedule[dayName] = formatShiftTime(realShift.startHour, realShift.type);
          newAssociate.totalHours += realShift.durationHours;
        } else {
          // Overstaff
          newAssociate.schedule[dayName] = formatShiftTime(seed.startHour, seed.type);
          newAssociate.totalHours += seed.durationHours;
        }
      });
      roster.push(newAssociate);
      assigned = true;
    }

    // STRATEGY B: Weekend Warrior
    if (!assigned) {
      const newAssociate: AssociateRoster = {
        id: generateId(),
        name: 'Temp',
        role: 'Weekend Warrior',
        schedule: { Mon: 'OFF', Tue: 'OFF', Wed: 'OFF', Thu: 'OFF', Fri: 'OFF', Sat: 'OFF', Sun: 'OFF' },
        totalHours: 0
      };

      // Sat
      const satShift = popShift(5, seed.startHour, seed.type);
      if (satShift) {
        newAssociate.schedule['Sat'] = formatShiftTime(satShift.startHour, satShift.type);
        newAssociate.totalHours += satShift.durationHours;
      } else {
        newAssociate.schedule['Sat'] = formatShiftTime(seed.startHour, seed.type);
        newAssociate.totalHours += seed.durationHours;
      }

      // Sun
      const sunShift = popShift(6, seed.startHour, seed.type);
      if (sunShift) {
        newAssociate.schedule['Sun'] = formatShiftTime(sunShift.startHour, sunShift.type);
        newAssociate.totalHours += sunShift.durationHours;
      } else {
        newAssociate.schedule['Sun'] = formatShiftTime(seed.startHour, seed.type);
        newAssociate.totalHours += seed.durationHours;
      }
      
      roster.push(newAssociate);
      assigned = true;
    }
  }

  // --- Step 3: Enforce Mix Constraints (Post-Process Promotions) ---
  
  // 3a. Enforce PT Cap (Convert excess PT -> FT)
  while (true) {
    const ftCount = roster.filter(r => r.role === 'Full Time').length;
    const ptCount = roster.filter(r => r.role === 'Part Time').length;
    
    const ptLimit = Math.ceil(ftCount * (constraints.partTimeCap / 100));
    
    if (ptCount <= ptLimit) break;
    if (ptCount === 0) break; 

    // Find a PT candidate to promote
    let candidateIdx = roster.findIndex(r => r.role === 'Part Time');
    if (candidateIdx === -1) break;

    const candidate = roster[candidateIdx];
    candidate.role = 'Full Time';
    
    // Upgrade their shifts: 4h -> 9h(8h work)
    Object.keys(candidate.schedule).forEach(k => {
      const day = k as DayOfWeek;
      const shift = candidate.schedule[day];
      if (shift !== 'OFF') {
        const startHour = parseInt(shift.split(':')[0]);
        
        // Try to keep the same start hour if valid for FT
        let newStartHour = startHour;
        if (!isValidShift(newStartHour, 9)) {
            // Find the closest valid FT start hour
            for (let offset = 1; offset <= 12; offset++) {
                if (isValidShift((startHour - offset + 24) % 24, 9)) {
                    newStartHour = (startHour - offset + 24) % 24;
                    break;
                }
                if (isValidShift((startHour + offset) % 24, 9)) {
                    newStartHour = (startHour + offset) % 24;
                    break;
                }
            }
        }
        
        candidate.schedule[day] = formatShiftTime(newStartHour, 'FT');
        candidate.totalHours += 4; // Add 4 hours (4->8)
      }
    });
  }

  // 3b. Enforce Weekend Warrior Cap (Convert excess WW -> FT)
  while (true) {
    const ftCount = roster.filter(r => r.role === 'Full Time').length;
    const wkCount = roster.filter(r => r.role === 'Weekend Warrior').length;
    
    const wkLimit = Math.ceil(ftCount * (constraints.weekendCap / 100));
    
    if (wkCount <= wkLimit) break;
    if (wkCount === 0) break;

    const candidateIdx = roster.findIndex(r => r.role === 'Weekend Warrior');
    if (candidateIdx === -1) break;

    const candidate = roster[candidateIdx];
    candidate.role = 'Full Time';
    
    // Upgrade: Keep Sat/Sun as FT (8h), Add Mon-Thu as FT (8h)
    let startHour = 6; // default
    const satShift = candidate.schedule['Sat'];
    if (satShift !== 'OFF') {
        startHour = parseInt(satShift.split(':')[0]);
    }

    if (!isValidShift(startHour, 9)) {
        startHour = 6; // Fallback to a safe FT start hour
    }

    const ftTime = formatShiftTime(startHour, 'FT');
    
    // Assign 6 days (Mon-Thu + Sat/Sun)
    ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'].forEach(d => {
         const day = d as DayOfWeek;
         candidate.schedule[day] = ftTime;
    });
    candidate.schedule['Fri'] = 'OFF';
    
    // Recalculate hours (6 days * 8 hours = 48)
    candidate.totalHours = 48; 
  }


  // --- Step 4: Sort & Rename ---
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

  // --- Step 5: Stats ---
  const totalVolume = demandData.reduce((sum, d) => sum + d.hours.reduce((a, b) => a + b, 0), 0);
  const totalHours = roster.reduce((sum, a) => sum + a.totalHours, 0);
  const requiredHours = totalVolume / constraints.avgProductivity;
  const calculatedUtilization = totalHours > 0 ? (requiredHours / totalHours) * 100 : 0;

  const ftCount = roster.filter(a => a.role === 'Full Time').length;
  const ptCount = roster.filter(a => a.role === 'Part Time').length;
  const wkCount = roster.filter(a => a.role === 'Weekend Warrior').length;

  const summary = `Optimization Strategy & Algorithmic Methodology:

The model employs a deterministic greedy constraint satisfaction algorithm to optimize workforce allocation, incorporating **Peak Protected Smearing** for intelligent capacity modeling. 

1. **Peak Protected Smearing:** Instead of a flat break deduction, the algorithm dynamically identifies the 3 busiest hours within every 9-hour Full-Time shift. It assigns **100% capacity** to these peak hours (assuming no breaks are taken then) and smears the remaining work (5 hours) across the other 6 hours (~83% capacity). This protects service levels during critical intervals.
2. **Shift Tessellation:** Demand is discretized into productivity-based "shift units." The algorithm then tessellates these units into efficient 6-day (Full-Time) and Weekend Warrior rosters, prioritizing Full-Time shifts for base load and Part-Time (4-hour) shifts for peak shaving.
3. **Constraint Enforcement:** A heuristic solver enforces strict adherence to 48-hour and 24-hour contract types while utilizing a dynamic rotation vector for weekly off-days to prevent both Saturday and Sunday coverage gaps. 
4. **Mix Caps:** A post-processing logic layer promotes associates to Full-Time status where necessary to strictly adhere to the user-defined Part-Time (${constraints.partTimeCap}%) and Weekend Warrior (${constraints.weekendCap}%) mix caps.`;

  return {
    strategySummary: summary,
    weeklyStats: {
      totalVolume,
      totalHeadcount: roster.length,
      blendedUtilization: calculatedUtilization, 
      mix: { ft: ftCount, pt: ptCount, weekend: wkCount }
    },
    roster,
    recommendations: [
      "Week Offs are rotated to ensure Sunday coverage.",
      "Strict 48h (FT) and 24h (PT) contracts are enforced.",
      `Mix Caps Enforced: PT <= ${constraints.partTimeCap}% FT, Weekend <= ${constraints.weekendCap}% FT.`
    ]
  };
};

// --- Helpers ---

const getDayName = (idx: number): DayOfWeek => {
  const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[idx];
}

const formatShiftTime = (startHour: number, type: 'FT' | 'PT'): string => {
  const duration = type === 'FT' ? 9 : 4; 
  const endHour = (startHour + duration) % 24;
  
  const format = (h: number) => `${h.toString().padStart(2, '0')}:00`;
  const startStr = format(startHour);
  const endStr = format(endHour);
  
  return `${startStr}-${endStr}`;
};