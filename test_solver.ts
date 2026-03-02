import { generateORToolsStaffingPlan } from './services/orToolsSolver';
import { INITIAL_DEMAND, INITIAL_CONSTRAINTS } from './types';
import fs from 'fs';

async function run() {
  try {
    const result = await generateORToolsStaffingPlan(INITIAL_DEMAND, INITIAL_CONSTRAINTS);
  } catch (e) {
    console.error(e);
  }
}
run();
