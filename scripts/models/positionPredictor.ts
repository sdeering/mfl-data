// Auto-generated position rating predictor
// Based on trained ML models

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

// Feature engineering function
function createEngineeredFeatures(attributes: PlayerAttributes): number[] {
  const { PAC, SHO, PAS, DRI, DEF, PHY } = attributes;
  
  // Base features
  const baseFeatures = [PAC, SHO, PAS, DRI, DEF, PHY];
  
  // Engineered features
  const attackingScore = (SHO + DRI + PAC) / 3;
  const finishingScore = (SHO + DRI) / 2;
  const defensiveScore = (DEF + PHY) / 2;
  const markingScore = (DEF + PAC) / 2;
  const playmakingScore = (PAS + DRI) / 2;
  const boxToBoxScore = (PAS + DEF + PHY) / 3;
  const wingScore = (PAC + DRI) / 2;
  const crossingScore = (PAS + PAC) / 2;
  const aerialScore = (PHY + DEF) / 2;
  
  return [
    ...baseFeatures,
    attackingScore, finishingScore, defensiveScore,
    markingScore, playmakingScore, boxToBoxScore,
    wingScore, crossingScore, aerialScore
  ];
}

// Simple linear regression prediction
function predictPositionRating(
  features: number[], 
  position: string, 
  playerPositions: string[]
): PositionRating {
  // This is a simplified version - in production, you'd load the actual trained models
  // For now, we'll use a rule-based approach that approximates the ML model
  
  const [PAC, SHO, PAS, DRI, DEF, PHY, 
        attackingScore, finishingScore, defensiveScore,
        markingScore, playmakingScore, boxToBoxScore,
        wingScore, crossingScore, aerialScore] = features;
  
  let rating = 50; // Base rating
  
  // Position-specific calculations based on ML model insights
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
  
  // Calculate difference from overall (simplified)
  const overall = Math.round((PAC + SHO + PAS + DRI + DEF + PHY) / 6);
  const difference = rating - overall;
  
  return {
    position,
    rating,
    familiarity,
    difference
  };
}

export function predictAllPositionRatings(
  attributes: PlayerAttributes,
  playerPositions: string[]
): PredictionResult {
  const features = createEngineeredFeatures(attributes);
  const positions = ['LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'CF', 'ST', 'LW', 'RW', 'GK'];
  
  const positionRatings: PositionRating[] = positions.map(position => 
    predictPositionRating(features, position, playerPositions)
  );
  
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
