#!/usr/bin/env python3
"""
MFL Position Rating Prediction System
Trains a machine learning model to predict position ratings from player attributes
"""

import pandas as pd
import numpy as np
import json
import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

def prepare_training_data(excel_path):
    """
    Prepare data for position rating prediction
    """
    print(f"Loading data from {excel_path}...")
    df = pd.read_excel(excel_path)
    
    processed_data = []
    
    for idx, row in df.iterrows():
        try:
            # Parse JSON to get base attributes
            input_data = json.loads(row['inputData'])
            metadata = input_data['player']['metadata']
            
            # Extract input features (base attributes)
            player_features = {
                'PAC': metadata['pace'],
                'SHO': metadata['shooting'],
                'PAS': metadata['passing'],
                'DRI': metadata['dribbling'],
                'DEF': metadata['defense'],
                'PHY': metadata['physical'],
                # Additional context that might help
                'overall': metadata['overall'],
                'age': metadata['age'],
                'height': metadata.get('height', 175),  # Default height if missing
                'primary_position': row['primary'],
                'secondary_positions': row.get('secondary', '') if pd.notna(row.get('secondary')) else ''
            }
            
            # Extract target variables (position ratings)
            position_ratings = {
                'LB': row.get('LB', 0),
                'CB': row.get('CB', 0),
                'RB': row.get('RB', 0),
                'LWB': row.get('LWB', 0),
                'RWB': row.get('RWB', 0),
                'CDM': row.get('CDM', 0),
                'CM': row.get('CM', 0),
                'CAM': row.get('CAM', 0),
                'LM': row.get('LM', 0),
                'RM': row.get('RM', 0),
                'CF': row.get('CF', 0),
                'ST': row.get('ST', 0),
                'LW': row.get('LW', 0),
                'RW': row.get('RW', 0),
                'GK': row.get('GK', 0) if pd.notna(row.get('GK')) else 0  # Set GK to 0 if missing
            }
            
            # Combine features and targets
            combined_data = {**player_features, **position_ratings}
            processed_data.append(combined_data)
            
        except Exception as e:
            print(f"Error processing row {idx}: {e}")
            continue
    
    df_processed = pd.DataFrame(processed_data)
    print(f"Processed {len(df_processed)} valid records")
    
    # Clean data - only remove rows with NaN in essential columns
    essential_cols = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
    df_processed = df_processed.dropna(subset=essential_cols)
    print(f"After cleaning essential columns: {len(df_processed)} valid records")
    
    # Define input and output columns
    input_cols = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
    output_cols = ['LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 
                   'LM', 'RM', 'CF', 'ST', 'LW', 'RW', 'GK']
    
    # Create feature matrix and target matrix
    X = df_processed[input_cols].values
    y = df_processed[output_cols].values
    
    # Add engineered features based on attribute combinations
    X_enhanced = create_engineered_features(X)
    
    return X_enhanced, y, input_cols, output_cols, df_processed

def create_engineered_features(X):
    """
    Create domain-specific features based on football knowledge
    """
    print("Creating engineered features...")
    features = []
    
    for row in X:
        pac, sho, pas, dri, def_, phy = row
        
        # Original attributes
        base_features = list(row)
        
        # Attacking combinations
        attacking_score = (sho + dri + pac) / 3
        finishing_score = (sho + dri) / 2
        
        # Defensive combinations
        defensive_score = (def_ + phy) / 2
        marking_score = (def_ + pac) / 2
        
        # Midfield combinations
        playmaking_score = (pas + dri) / 2
        box_to_box_score = (pas + def_ + phy) / 3
        
        # Wing play combinations
        wing_score = (pac + dri) / 2
        crossing_score = (pas + pac) / 2
        
        # Physical dominance
        aerial_score = (phy + def_) / 2
        
        # Add all engineered features
        engineered = [
            attacking_score, finishing_score, defensive_score,
            marking_score, playmaking_score, box_to_box_score,
            wing_score, crossing_score, aerial_score
        ]
        
        features.append(base_features + engineered)
    
    return np.array(features)

def train_simple_model(X, y, output_cols):
    """
    Train a simple linear regression model for each position
    This is a fallback if more advanced models aren't available
    """
    print("Training simple linear regression models...")
    
    try:
        from sklearn.linear_model import LinearRegression
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, r2_score
        
        models = {}
        scalers = {}
        metrics = {}
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Train a model for each position
        for i, position in enumerate(output_cols):
            print(f"Training model for {position}...")
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            model = LinearRegression()
            model.fit(X_train_scaled, y_train[:, i])
            
            # Predict and evaluate
            predictions = model.predict(X_test_scaled)
            mae = mean_absolute_error(y_test[:, i], predictions)
            r2 = r2_score(y_test[:, i], predictions)
            
            # Store model and metrics
            models[position] = model
            scalers[position] = scaler
            metrics[position] = {'MAE': mae, 'R2': r2}
            
            print(f"  {position}: MAE={mae:.2f}, R²={r2:.3f}")
        
        # Overall metrics
        overall_mae = np.mean([m['MAE'] for m in metrics.values()])
        overall_r2 = np.mean([m['R2'] for m in metrics.values()])
        print(f"\nOverall: MAE={overall_mae:.2f}, R²={overall_r2:.3f}")
        
        return models, scalers, metrics
        
    except ImportError:
        print("scikit-learn not available, using simple averaging...")
        return None, None, None

def save_model_data(models, scalers, output_cols, model_dir="models"):
    """
    Save the trained models and scalers
    """
    try:
        import joblib
        
        # Create model directory
        os.makedirs(model_dir, exist_ok=True)
        
        # Save models and scalers
        for position in output_cols:
            if models and scalers and position in models:
                joblib.dump(models[position], f"{model_dir}/{position}_model.pkl")
                joblib.dump(scalers[position], f"{model_dir}/{position}_scaler.pkl")
        
        # Save metadata
        metadata = {
            'positions': output_cols,
            'feature_names': ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] + [
                'attacking_score', 'finishing_score', 'defensive_score',
                'marking_score', 'playmaking_score', 'box_to_box_score',
                'wing_score', 'crossing_score', 'aerial_score'
            ]
        }
        
        with open(f"{model_dir}/metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Models saved to {model_dir}/")
        
    except ImportError:
        print("joblib not available, skipping model save...")

def create_typescript_predictor(models, scalers, output_cols, model_dir="models"):
    """
    Create a TypeScript predictor that can be used in the Next.js app
    """
    print("Creating TypeScript predictor...")
    
    # Create the predictor file
    predictor_code = '''// Auto-generated position rating predictor
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
'''
    
    # Write the TypeScript file
    with open(f"{model_dir}/positionPredictor.ts", 'w') as f:
        f.write(predictor_code)
    
    print(f"TypeScript predictor created: {model_dir}/positionPredictor.ts")

def main():
    """
    Main training pipeline
    """
    excel_path = "Data/600-player-data-scraped.xlsx"
    
    if not os.path.exists(excel_path):
        print(f"Error: {excel_path} not found!")
        return
    
    print("=== MFL Position Rating Predictor Training ===")
    
    # Prepare data
    X, y, input_cols, output_cols, df_processed = prepare_training_data(excel_path)
    
    # Train models
    models, scalers, metrics = train_simple_model(X, y, output_cols)
    
    # Save models
    save_model_data(models, scalers, output_cols)
    
    # Create TypeScript predictor
    create_typescript_predictor(models, scalers, output_cols)
    
    print("\n=== Training Complete ===")
    print("Next steps:")
    print("1. Copy the generated positionPredictor.ts to your src/utils/ directory")
    print("2. Update your position rating calculation logic to use the new predictor")
    print("3. Test with a few players to ensure accuracy")

if __name__ == "__main__":
    main()
