// This service has been deprecated as the application has switched to a purely deterministic algorithmic solver.
// The AI dependencies have been removed to ensure a lightweight deployment.

import { Constraints, DemandData, StaffingSolution } from "../types";

export const generateStaffingPlan = async (
  demand: DemandData[],
  constraints: Constraints
): Promise<StaffingSolution> => {
  throw new Error("AI Service is disabled. Please use the Algorithmic solver.");
};