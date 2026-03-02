import { generateORToolsStaffingPlan } from './services/orToolsSolver';
import { INITIAL_DEMAND, INITIAL_CONSTRAINTS } from './types';

async function run() {
  try {
    const result = await generateORToolsStaffingPlan(INITIAL_DEMAND, INITIAL_CONSTRAINTS);
    console.log("Total headcount:", result.weeklyStats.totalHeadcount);
    console.log("FT count:", result.weeklyStats.mix.ft);
    console.log("PT count:", result.weeklyStats.mix.pt);
    console.log("WW count:", result.weeklyStats.mix.weekend);
  } catch (e) {
    console.error(e);
  }
}
run();
