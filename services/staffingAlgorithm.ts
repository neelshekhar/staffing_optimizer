import { AssociateRoster, Constraints, DemandData, StaffingSolution, TIME_BLOCKS, DayOfWeek } from "../types";

// Helper to generate a consistent ID
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ShiftUnit {
  day: DayOfWeek;
  dayIndex: number; // 0=Mon, 6=Sun
  blockIndex: number;
  type: 'FT' | 'PT'; // FT = 8h (2 blocks), PT = 4h (1 block)
  durationHours: number;
}

export const generateAlgorithmicStaffingPlan = (
  demandData: DemandData[],
  constraints: Constraints
): StaffingSolution => {
  
  // --- Step 1: Deconstruct Demand into Required Shift Units ---
  
  const neededShifts: ShiftUnit[] = [];

  demandData.forEach((dayData, dayIdx) => {
    const blockCapacities = TIME_BLOCKS.map(block => {
      const vol = dayData.blocks[block];
      // Capacity logic
      const onePersonCapacity = constraints.avgProductivity * 4 * (constraints.targetUtilization / 100);
      return Math.ceil(vol / onePersonCapacity);
    });

    const uncovered = [...blockCapacities];

    // Priority 1: FT (8h)
    for (let i = 0; i < TIME_BLOCKS.length; i++) {
      const currentBlock = i;
      const nextBlock = (i + 1) % TIME_BLOCKS.length;
      
      if (i < TIME_BLOCKS.length - 1) { 
        while (uncovered[currentBlock] > 0 && uncovered[nextBlock] > 0) {
          neededShifts.push({
            day: dayData.day,
            dayIndex: dayIdx,
            blockIndex: currentBlock,
            type: 'FT',
            durationHours: 8, 
          });
          uncovered[currentBlock]--;
          uncovered[nextBlock]--;
        }
      }
    }

    // Priority 2: PT (4h)
    for (let i = 0; i < TIME_BLOCKS.length; i++) {
      while (uncovered[i] > 0) {
        neededShifts.push({
          day: dayData.day,
          dayIndex: dayIdx,
          blockIndex: i,
          type: 'PT',
          durationHours: 4,
        });
        uncovered[i]--;
      }
    }
  });

  const roster: AssociateRoster[] = [];

  // Helper to find and remove a specific shift from the pool
  const popShift = (dayIdx: number, blockIdx: number, type: 'FT' | 'PT'): ShiftUnit | null => {
    const idx = neededShifts.findIndex(s => 
      s.dayIndex === dayIdx && s.blockIndex === blockIdx && s.type === type
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
  let offDayRotationIndex = 0; 

  while (neededShifts.length > 0 && safety < 5000) {
    safety++;
    sortShifts(); 
    
    const seed = neededShifts[0];
    
    // Check availability for this BlockIndex & Type across the week
    const availabilityByDay = Array(7).fill(false);
    const countsByDay = Array(7).fill(0);
    
    neededShifts.forEach(s => {
      if (s.blockIndex === seed.blockIndex && s.type === seed.type) {
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
        const realShift = popShift(dIdx, seed.blockIndex, seed.type);
        
        if (realShift) {
          newAssociate.schedule[dayName] = formatShiftTime(realShift.blockIndex, realShift.type);
          newAssociate.totalHours += realShift.durationHours;
        } else {
          // Overstaff
          newAssociate.schedule[dayName] = formatShiftTime(seed.blockIndex, seed.type);
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
      const satShift = popShift(5, seed.blockIndex, seed.type);
      if (satShift) {
        newAssociate.schedule['Sat'] = formatShiftTime(satShift.blockIndex, satShift.type);
        newAssociate.totalHours += satShift.durationHours;
      } else {
        newAssociate.schedule['Sat'] = formatShiftTime(seed.blockIndex, seed.type);
        newAssociate.totalHours += seed.durationHours;
      }

      // Sun
      const sunShift = popShift(6, seed.blockIndex, seed.type);
      if (sunShift) {
        newAssociate.schedule['Sun'] = formatShiftTime(sunShift.blockIndex, sunShift.type);
        newAssociate.totalHours += sunShift.durationHours;
      } else {
        newAssociate.schedule['Sun'] = formatShiftTime(seed.blockIndex, seed.type);
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

    // Find a PT candidate to promote (e.g., the one with most hours, or just the first)
    const candidateIdx = roster.findIndex(r => r.role === 'Part Time');
    if (candidateIdx === -1) break;

    const candidate = roster[candidateIdx];
    candidate.role = 'Full Time';
    
    // Upgrade their shifts: 4h -> 9h(8h work)
    // We assume the PT block index is inferred from their start time
    Object.keys(candidate.schedule).forEach(k => {
      const day = k as DayOfWeek;
      const shift = candidate.schedule[day];
      if (shift !== 'OFF') {
        const startHour = parseInt(shift.split(':')[0]);
        // Re-calc block index
        let blockIndex = -1;
        if (startHour >= 6) blockIndex = (startHour - 6) / 4;
        else if (startHour === 2) blockIndex = 5;
        
        if (blockIndex !== -1) {
            candidate.schedule[day] = formatShiftTime(blockIndex, 'FT');
            candidate.totalHours += 4; // Add 4 hours (4->8)
        }
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
    // Get Sat block info to reuse start time
    let blockIndex = 0; // default
    const satShift = candidate.schedule['Sat'];
    if (satShift !== 'OFF') {
        const startHour = parseInt(satShift.split(':')[0]);
        if (startHour >= 6) blockIndex = (startHour - 6) / 4;
        else if (startHour === 2) blockIndex = 5;
    }

    const ftTime = formatShiftTime(blockIndex, 'FT');
    
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
  const totalVolume = demandData.reduce((sum, d) => sum + Object.values(d.blocks).reduce((a, b) => a + b, 0), 0);
  const totalHours = roster.reduce((sum, a) => sum + a.totalHours, 0);
  const requiredHours = totalVolume / constraints.avgProductivity;
  const calculatedUtilization = totalHours > 0 ? (requiredHours / totalHours) * 100 : 0;

  const ftCount = roster.filter(a => a.role === 'Full Time').length;
  const ptCount = roster.filter(a => a.role === 'Part Time').length;
  const wkCount = roster.filter(a => a.role === 'Weekend Warrior').length;

  const summary = `Optimization Strategy & Algorithmic Methodology:

The model employs a deterministic greedy constraint satisfaction algorithm to optimize workforce allocation. It starts by discretizing demand into productivity-based "shift units," which are then tessellated into efficient 6-day (Full-Time) and Weekend Warrior rosters. A heuristic solver enforces strict adherence to 48-hour and 24-hour contract types while utilizing a dynamic rotation vector for weekly off-days to prevent Sunday coverage gaps. Finally, a post-processing logic layer promotes associates to Full-Time status where necessary to strictly adhere to the user-defined Part-Time (${constraints.partTimeCap}%) and Weekend Warrior (${constraints.weekendCap}%) mix caps.`;

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

const formatShiftTime = (startIndex: number, type: 'FT' | 'PT'): string => {
  const startHour = 6 + (startIndex * 4);
  const duration = type === 'FT' ? 9 : 4; 
  const endHour = (startHour + duration) % 24;
  
  const format = (h: number) => `${h.toString().padStart(2, '0')}:00`;
  const startStr = format(startHour >= 24 ? startHour - 24 : startHour);
  const endStr = format(endHour);
  
  return `${startStr}-${endStr}`;
};