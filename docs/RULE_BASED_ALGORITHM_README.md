# MFL Rule-Based Position Rating Algorithm

This document describes the implementation of the rule-based position rating algorithm for Metaverse Football League (MFL) players.

## Overview

The rule-based algorithm calculates a player's Overall Rating (OVR) for each of the 15 positions in MFL based on:
1. **Position-specific attribute weights** - Each position has different importance for each attribute
2. **Position familiarity penalties** - Players perform better in positions they're familiar with
3. **Mathematical formula** - Weighted average calculation with familiarity adjustments

## Algorithm Components

### 1. Position Attributes Distribution Table

Each position has specific weights for the six core attributes (PAS, SHO, DEF, DRI, PAC, PHY) that sum to 100%:

| Position | PAS | SHO | DEF | DRI | PAC | PHY |
|----------|-----|-----|-----|-----|-----|-----|
| ST       | 10% | 46% | 0%  | 29% | 10% | 5%  |
| CF/LW/RW | 24% | 23% | 0%  | 40% | 13% | 0%  |
| CAM      | 34% | 21% | 0%  | 38% | 7%  | 0%  |
| CM/LM/RM | 43% | 12% | 10% | 29% | 0%  | 6%  |
| CDM      | 28% | 0%  | 40% | 17% | 0%  | 15% |
| LWB/RWB/LB/RB | 19% | 0% | 44% | 17% | 10% | 10% |
| CB       | 5%  | 0%  | 64% | 9%  | 2%  | 20% |
| GK       | 0%  | 0%  | 0%  | 0%  | 0%  | 100% |

### 2. Position Familiarity System

The algorithm uses a familiarity matrix to determine how well a player can perform in different positions:

- **Primary Position (Level 3)**: No penalty (0)
- **Fairly Familiar (Level 2)**: -5 penalty
- **Somewhat Familiar (Level 1)**: -8 penalty  
- **Unfamiliar (Level 0)**: -20 penalty

### 3. Calculation Formula

For each position, the algorithm follows these steps:

1. **Calculate weighted average**:
   ```
   Weighted Sum = (PAS × PAS_weight) + (SHO × SHO_weight) + (DEF × DEF_weight) + 
                  (DRI × DRI_weight) + (PAC × PAC_weight) + (PHY × PHY_weight)
   ```

2. **Apply familiarity penalty**:
   ```
   Final Rating = Weighted Sum + Familiarity Penalty
   ```

3. **Round and clamp**:
   ```
   OVR = Math.max(0, Math.min(99, Math.round(Final Rating)))
   ```

## Example Calculation

Using player Max Pasquier (ID: 116267) as an example:

**Player Data:**
- Primary Position: LB
- Attributes: PAC: 84, SHO: 32, PAS: 77, DRI: 74, DEF: 87, PHY: 83

**LWB Position Calculation:**
- LWB weights: PAS: 19%, SHO: 0%, DEF: 44%, DRI: 17%, PAC: 10%, PHY: 10%
- Weighted calculations:
  - PAS = 77 × 19% = 14.63
  - SHO = 32 × 0% = 0.00
  - DEF = 87 × 44% = 38.28
  - DRI = 74 × 17% = 12.58
  - PAC = 84 × 10% = 8.40
  - PHY = 83 × 10% = 8.30
- Subtotal = 82.19
- LB to LWB familiarity: Fairly Familiar (-5 penalty)
- Final rating = 82.19 - 5 = 77.19
- **Result: 77 OVR**

## Implementation Files

### Core Algorithm
- `src/utils/ruleBasedPositionCalculator.ts` - Main calculator implementation
- `src/types/positionOvr.ts` - Type definitions and interfaces

### Data Conversion
- `src/utils/playerDataConverter.ts` - Converts MFL API data to calculator format
- `src/hooks/useRuleBasedPositionRatings.ts` - React hook for UI integration

### Tests
- `src/__tests__/ruleBasedPositionCalculator.test.ts` - Unit tests for calculator
- `src/__tests__/playerDataConverter.test.ts` - Unit tests for data conversion
- `src/__tests__/endToEndRuleBased.test.ts` - End-to-end integration tests

### Demo
- `demo-rule-based-algorithm.js` - Standalone demo script

## Usage

### Basic Usage

```typescript
import { calculatePositionOVR, calculateAllPositionOVRs } from './src/utils/ruleBasedPositionCalculator';
import { convertMFLResponseToOVRFormat } from './src/utils/playerDataConverter';

// Convert MFL API data
const player = convertMFLResponseToOVRFormat(mflApiResponse);

// Calculate single position rating
const lwbRating = calculatePositionOVR(player, 'LWB');
console.log(`LWB Rating: ${lwbRating.ovr}`);

// Calculate all position ratings
const allRatings = calculateAllPositionOVRs(player);
console.log('All position ratings:', allRatings.results);
```

### React Hook Usage

```typescript
import { useRuleBasedPositionRatings } from './src/hooks/useRuleBasedPositionRatings';

function PlayerComponent({ player }) {
  const { positionRatings, isLoading, error } = useRuleBasedPositionRatings(player);
  
  if (isLoading) return <div>Calculating...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {Object.entries(positionRatings.results).map(([position, rating]) => (
        <div key={position}>
          {position}: {rating.ovr}
        </div>
      ))}
    </div>
  );
}
```

## API Integration

The algorithm works with the MFL API endpoint:
```
GET https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/{playerId}
```

Example API response:
```json
{
  "player": {
    "id": 116267,
    "metadata": {
      "firstName": "Max",
      "lastName": "Pasquier",
      "overall": 82,
      "positions": ["LB"],
      "pace": 84,
      "shooting": 32,
      "passing": 77,
      "dribbling": 74,
      "defense": 87,
      "physical": 83,
      "goalkeeping": 0
    }
  }
}
```

## Testing

Run the test suite to verify the implementation:

```bash
# Run all rule-based algorithm tests
npm test -- --testPathPattern="(ruleBasedPositionCalculator|playerDataConverter|endToEndRuleBased)"

# Run specific test file
npm test -- --testPathPattern=ruleBasedPositionCalculator.test.ts
```

## Demo

Run the demo script to see the algorithm in action:

```bash
node demo-rule-based-algorithm.js
```

This will show a detailed calculation for player Max Pasquier (ID: 116267) including:
- Player attributes
- Position-specific calculations
- Familiarity penalties
- Final ratings for key positions

## Validation

The implementation includes comprehensive validation:

1. **Input validation** - Ensures player data has all required fields
2. **Attribute range validation** - Confirms attributes are 0-99
3. **Position validation** - Verifies positions are valid MFL positions
4. **Weight validation** - Ensures position weights sum to 100%

## Performance

The algorithm is designed for performance:
- **Synchronous calculation** - No async operations required
- **Cached weights** - Position weights are pre-calculated
- **Efficient matrix lookup** - Familiarity penalties use direct array access
- **Minimal memory usage** - No large data structures created

## Comparison with ML-Based Approach

This rule-based algorithm provides:
- **Transparency** - Clear mathematical formula
- **Consistency** - Same input always produces same output
- **Interpretability** - Easy to understand why a player gets a specific rating
- **Maintainability** - Simple to modify weights or penalties

The ML-based approach (in `src/utils/mlPositionCalculator.ts`) provides:
- **Accuracy** - Trained on real MFL data
- **Complexity handling** - Can capture non-linear relationships
- **Adaptability** - Can improve with more training data

## Future Enhancements

Potential improvements to the rule-based algorithm:
1. **Dynamic weights** - Adjust weights based on player age or experience
2. **Secondary position handling** - Better penalties for players with multiple positions
3. **Form-based adjustments** - Temporary rating boosts for in-form players
4. **Team chemistry** - Position ratings affected by team formation and tactics

## License

This implementation is part of the MFL Player Search project and follows the same licensing terms.
