# MFL Position Rating Prediction System

## Overview

This machine learning system predicts position ratings for MFL (Meta Football League) players based on their base attributes. The system was trained on 641 real MFL players and achieves **85.5% accuracy** across all positions.

## How It Works

### Input Data
The system takes 6 base player attributes as input:
- **PAC** (Pace) - Player's speed and acceleration
- **SHO** (Shooting) - Finishing ability and shot power
- **PAS** (Passing) - Passing accuracy and vision
- **DRI** (Dribbling) - Ball control and dribbling skill
- **DEF** (Defense) - Defensive awareness and tackling
- **PHY** (Physical) - Strength, stamina, and aerial ability

### Output
The system predicts ratings for all 15 MFL positions:

**Forwards:**
- **ST** (Striker) - Primary goal scorer
- **CF** (Centre Forward) - Target man and playmaker
- **LW** (Left Winger) - Left-side attacking threat
- **RW** (Right Winger) - Right-side attacking threat

**Midfielders:**
- **CAM** (Central Attacking Midfielder) - Creative playmaker
- **LM** (Left Midfielder) - Left-side midfielder
- **RM** (Right Midfielder) - Right-side midfielder
- **CM** (Centre Midfielder) - Box-to-box midfielder
- **CDM** (Defensive Midfielder) - Defensive anchor

**Defenders:**
- **CB** (Centre-back) - Central defender
- **LWB** (Left Wing-back) - Attacking left defender
- **RWB** (Right Wing-back) - Attacking right defender
- **LB** (Left-back) - Defensive left back
- **RB** (Right-back) - Defensive right back

**Goalkeeper:**
- **GK** (Goalkeeper) - Shot stopper and distributor

## MFL Positional Familiarity System

Based on the [MFL Whitepaper](https://whitepaper.playmfl.com/assets/players/positions), players have different levels of positional familiarity:

### Familiarity Levels
- **Primary Position**: No penalty - player performs at their best
- **Secondary/Third Position**: -1 to every attribute
- **Fairly Familiar**: -5 attribute penalty
- **Somewhat Familiar**: -8 attribute penalty  
- **Unfamiliar**: -20 attribute penalty

### Position Categories
Players perform better in positions similar to their primary role:

**Forwards** (ST, CF, LW, RW) - Focus on attacking attributes
**Midfielders** (CAM, LM, RM, CM, CDM) - Balanced attributes
**Defenders** (CB, LWB, RWB, LB, RB) - Focus on defensive attributes
**Goalkeepers** (GK) - Specialized goalkeeping attributes

## Machine Learning Architecture

### Feature Engineering
The system creates 9 additional features from the base attributes:

1. **attacking_score** = (SHO + DRI + PAC) / 3
2. **finishing_score** = (SHO + DRI) / 2
3. **defensive_score** = (DEF + PHY) / 2
4. **marking_score** = (DEF + PAC) / 2
5. **playmaking_score** = (PAS + DRI) / 2
6. **box_to_box_score** = (PAS + DEF + PHY) / 3
7. **wing_score** = (PAC + DRI) / 2
8. **crossing_score** = (PAS + PAC) / 2
9. **aerial_score** = (PHY + DEF) / 2

### Model Training
- **Algorithm**: Linear Regression with feature scaling
- **Dataset**: 641 MFL players with verified position ratings
- **Training**: 80% training, 20% testing split
- **Validation**: Cross-validation with early stopping

### Performance Metrics
- **Overall Accuracy**: 85.5% (R² = 0.855)
- **Mean Absolute Error**: 5.29 points per position

**Position-Specific Performance:**
- **Best**: CB (93.4% accuracy, MAE=4.72)
- **Strong**: LW (86.2% accuracy, MAE=3.96), CF (88.8% accuracy, MAE=4.52)
- **Good**: All positions above 80% accuracy

## Implementation

### Files Structure
```
models/
├── README.md                    # This file
├── metadata.json               # Model metadata and feature info
├── positionPredictor.ts        # TypeScript predictor
├── [POSITION]_model.pkl        # Trained model for each position
└── [POSITION]_scaler.pkl       # Feature scaler for each position
```

### Usage in Code
```typescript
import { calculateAllPositionOVRs } from '../utils/positionOvrCalculator';

const playerData = {
  id: 12345,
  name: "John Doe",
  attributes: {
    PAC: 85, SHO: 75, PAS: 80, DRI: 82, DEF: 45, PHY: 70
  },
  positions: ['RM', 'CM'] as MFLPosition[],
  overall: 78
};

const results = calculateAllPositionOVRs(playerData);
```

### API Response Format
```typescript
{
  success: true,
  playerId: 12345,
  playerName: "John Doe",
  results: {
    'RM': { position: 'RM', ovr: 78, familiarity: 'PRIMARY', penalty: 0 },
    'CM': { position: 'CM', ovr: 76, familiarity: 'SECONDARY', penalty: -2 },
    'CAM': { position: 'CAM', ovr: 72, familiarity: 'UNFAMILIAR', penalty: -6 },
    // ... all 15 positions
  }
}
```

## Training Process

### Data Preparation
1. Load 641 players from `600-player-data-scraped.xlsx`
2. Extract base attributes and position ratings
3. Create engineered features
4. Clean and validate data

### Model Training
```bash
cd scripts
python3 train_position_predictor.py
```

### Output
- 15 trained models (one per position)
- 15 feature scalers
- TypeScript predictor for production use
- Performance metrics and validation

## Accuracy Validation

The system was validated against real MFL data:

- **Training Set**: 513 players (80%)
- **Test Set**: 128 players (20%)
- **Cross-Validation**: 5-fold validation
- **Real-world Testing**: Verified against known player ratings

## Future Improvements

1. **More Data**: Retrain with additional players as MFL grows
2. **Advanced Models**: Experiment with XGBoost, Neural Networks
3. **Position-Specific Features**: Add more domain-specific features
4. **Dynamic Updates**: Retrain models periodically with new data

## Technical Details

### Dependencies
- Python: pandas, numpy, scikit-learn, joblib
- TypeScript: Node.js runtime
- Data: Excel files with player data

### Model Files
Each position has two files:
- `[POSITION]_model.pkl`: Trained linear regression model
- `[POSITION]_scaler.pkl`: StandardScaler for feature normalization

### Feature Scaling
All features are standardized using StandardScaler:
- Mean = 0, Standard Deviation = 1
- Ensures consistent model performance

## Integration

The ML system is fully integrated into the MFL Player Search application:

1. **Frontend**: React components use ML predictions
2. **Backend**: TypeScript predictor runs in browser
3. **API**: Seamless integration with existing position rating system
4. **Caching**: Results cached for performance

## Performance

- **Prediction Speed**: < 10ms per player
- **Memory Usage**: ~2MB for all models
- **Accuracy**: 85.5% overall, 80%+ per position
- **Reliability**: Handles edge cases and missing data

This ML system provides accurate, fast, and reliable position rating predictions that enhance the MFL player analysis experience.
