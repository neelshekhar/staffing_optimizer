import { GoogleGenAI } from "@google/genai";
import { Constraints, DemandData, StaffingSolution } from "../types";

const parseGeminiResponse = (text: string): StaffingSolution | null => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return null;
  }
};

export const generateStaffingPlan = async (
  demand: DemandData[],
  constraints: Constraints
): Promise<StaffingSolution> => {
  
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Serialize demand for prompt
  const demandSummary = demand.map(d => `${d.day}: ${JSON.stringify(d.blocks)}`).join('\n');

  const prompt = `
    You are an expert Workforce Manager.
    
    Task: Create a detailed Staffing Roster (list of specific associates) to cover the following 24/7 demand curve.
    
    INPUT DATA (Volume per 4-hour block):
    ${demandSummary}
    
    OPERATIONAL PARAMETERS:
    - Productivity: ${constraints.avgProductivity} units/hour/person.
    - Target Utilization: ${constraints.targetUtilization}%.
    - Weekend Demand Spike: ${constraints.weekendSpike}% (Already included in data, but consider for strategy).
    
    STRICT CONTRACT CONSTRAINTS (MUST FOLLOW):
    1. Full Time (FT):
       - MUST work exactly 6 days per week.
       - MUST work exactly 48 hours per week (6 days * 8 hours work).
       - Shift span is 9 hours (8h work + 1h break).
       - Week Off can be ANY day (rotate off days to cover Sundays).
    
    2. Part Time (PT):
       - MUST work exactly 6 days per week.
       - MUST work exactly 24 hours per week (6 days * 4 hours work).
       - Continuous 4 hour block.
       - Week Off can be ANY day.
    
    3. Weekend Warriors:
       - Work ONLY on Saturday and Sunday.
       - Can work 8 hours or 4 hours per day.
       - Use these to cover the weekend spikes that FT/PT cannot cover.
    
    OPTIMIZATION GOALS:
    1. Calculate required headcount per block = (Volume / Productivity).
    2. Assign specific Shifts to individual "Associates" to meet this requirement.
    3. Ensure SUNDAYS ARE STAFFED. Do not give everyone Sunday off. Rotate the "Off Day".
    4. Prioritize Full Time for base load, Part Time for peaks.
    
    OUTPUT SCHEMA (JSON Only):
    {
      "strategySummary": "Explanation of the mix and how you solved for Sunday coverage...",
      "weeklyStats": {
        "totalVolume": number,
        "totalHeadcount": number, // Total unique people
        "blendedUtilization": number,
        "mix": { "ft": number, "pt": number, "weekend": number } // Counts of each type
      },
      "roster": [
        {
          "id": "101",
          "name": "Associate 1",
          "role": "Full Time" | "Part Time" | "Weekend Warrior",
          "schedule": {
            "Mon": "06:00-15:00",
            "Tue": "06:00-15:00",
            "Wed": "OFF",
            "Thu": "06:00-15:00",
            "Fri": "06:00-15:00",
            "Sat": "06:00-15:00",
            "Sun": "06:00-15:00"
          },
          "totalHours": number
        }
        ... generate as many as needed to cover demand
      ],
      "recommendations": ["Tip 1", "Tip 2"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2, 
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const data = parseGeminiResponse(text);
    if (!data) throw new Error("Invalid JSON format received from AI");

    return data;

  } catch (error) {
    console.error("Gemini Optimization Error:", error);
    throw error;
  }
};