// ML-based position rating predictor
// Calls the FastAPI backend for accurate predictions

export interface PlayerAttributes {
  PAC: number;  // Pace
  SHO: number;  // Shooting
  PAS: number;  // Passing
  DRI: number;  // Dribbling
  DEF: number;  // Defense
  PHY: number;  // Physical
}

export interface PositionRating {
  position: string;
  rating: number;
  familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
  difference: number;
}

export interface PredictionResult {
  positionRatings: PositionRating[];
  bestPosition: string;
  top3Positions: string[];
}

export interface PredictionRequest {
  attributes: PlayerAttributes;
  positions: string[];
  overall?: number;
}

// ML API endpoint - use Vercel API route
const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || '/api/predict';

/**
 * Predict position ratings using the ML API
 */
export async function predictAllPositionRatings(
  attributes: PlayerAttributes,
  playerPositions: string[],
  overall?: number
): Promise<PredictionResult> {
  try {
    // Always request all 15 positions for complete analysis
    const allPositions = ['LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'CF', 'ST', 'LW', 'RW', 'GK'];
    
    const requestBody: PredictionRequest = {
      attributes,
      positions: allPositions
    };
    
    if (overall !== undefined) {
      requestBody.overall = overall;
    }
    
    const response = await fetch(ML_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`ML API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('ML API call failed, falling back to rule-based prediction:', error);
    
    // Fallback to rule-based prediction if ML API is unavailable
    return fallbackPrediction(attributes, playerPositions);
  }
}

/**
 * Fallback rule-based prediction when ML API is unavailable
 */
function fallbackPrediction(
  attributes: PlayerAttributes,
  playerPositions: string[]
): PredictionResult {
  const { PAC, SHO, PAS, DRI, DEF, PHY } = attributes;
  const positions = ['LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'CF', 'ST', 'LW', 'RW', 'GK'];
  
  const positionRatings: PositionRating[] = positions.map(position => {
    let rating = 50; // Base rating
    
    // Position-specific calculations
    switch (position) {
      case 'GK':
        rating = Math.round((DEF * 0.3 + PHY * 0.4 + PAS * 0.15 + PAC * 0.05 + SHO * 0.05 + DRI * 0.05));
        break;
      case 'CB':
        rating = Math.round((DEF * 0.5 + PHY * 0.15 + PAS * 0.15 + PAC * 0.1 + SHO * 0.05 + DRI * 0.05));
        break;
      case 'LB':
      case 'RB':
        rating = Math.round((PAC * 0.2 + PAS * 0.25 + DEF * 0.25 + DRI * 0.15 + PHY * 0.1 + SHO * 0.05));
        break;
      case 'LWB':
      case 'RWB':
        rating = Math.round((PAC * 0.25 + PAS * 0.3 + DRI * 0.2 + DEF * 0.15 + PHY * 0.05 + SHO * 0.05));
        break;
      case 'CDM':
        rating = Math.round((PAS * 0.3 + DEF * 0.25 + DRI * 0.15 + PAC * 0.15 + PHY * 0.1 + SHO * 0.05));
        break;
      case 'CM':
        rating = Math.round((PAS * 0.35 + DRI * 0.25 + PAC * 0.2 + SHO * 0.1 + DEF * 0.05 + PHY * 0.05));
        break;
      case 'CAM':
        rating = Math.round((PAS * 0.3 + DRI * 0.25 + SHO * 0.25 + PAC * 0.15 + DEF * 0.0 + PHY * 0.05));
        break;
      case 'LM':
      case 'RM':
        rating = Math.round((PAC * 0.3 + PAS * 0.25 + DRI * 0.25 + SHO * 0.1 + DEF * 0.05 + PHY * 0.05));
        break;
      case 'LW':
      case 'RW':
        rating = Math.round((PAC * 0.25 + DRI * 0.3 + SHO * 0.2 + PAS * 0.2 + DEF * 0.0 + PHY * 0.05));
        break;
      case 'ST':
        rating = Math.round((SHO * 0.4 + PAC * 0.25 + DRI * 0.15 + PAS * 0.15 + PHY * 0.05 + DEF * 0.0));
        break;
      case 'CF':
        rating = Math.round((SHO * 0.35 + PAS * 0.2 + DRI * 0.2 + PAC * 0.2 + PHY * 0.05 + DEF * 0.0));
        break;
    }
    
    // Ensure rating is in valid range
    rating = Math.max(0, Math.min(99, rating));
    
    // Determine familiarity
    let familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR' = 'UNFAMILIAR';
    if (playerPositions.includes(position)) {
      familiarity = playerPositions[0] === position ? 'PRIMARY' : 'SECONDARY';
    }
    
    // Calculate difference from overall
    const overall = Math.round((PAC + SHO + PAS + DRI + DEF + PHY) / 6);
    const difference = rating - overall;
    
    return {
      position,
      rating,
      familiarity,
      difference
    };
  });
  
  // Sort by rating to find best positions
  const sortedRatings = [...positionRatings].sort((a, b) => b.rating - a.rating);
  const bestPosition = sortedRatings[0].position;
  const top3Positions = sortedRatings.slice(0, 3).map(r => r.position);
  
  return {
    positionRatings,
    bestPosition,
    top3Positions
  };
}
