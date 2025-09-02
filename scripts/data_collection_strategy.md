# MFL Data Collection Strategy for ML Improvement

## Current Status
- **Dataset Size**: 641 players
- **Accuracy**: 85.5%
- **Target**: 1000+ players for 90%+ accuracy

## Data Collection Methods

### 1. **Automated Scraping** (Recommended)
```python
# Enhanced scraper with error handling and rate limiting
import time
import random
from selenium import webdriver
from selenium.webdriver.common.by import By

def scrape_mfl_players(start_id=1, end_id=2000, batch_size=50):
    """
    Scrape MFL players with intelligent rate limiting
    """
    players = []
    
    for batch_start in range(start_id, end_id, batch_size):
        batch_end = min(batch_start + batch_size, end_id)
        
        for player_id in range(batch_start, batch_end):
            try:
                player_data = scrape_single_player(player_id)
                if player_data:
                    players.append(player_data)
                    print(f"Scraped player {player_id}")
                
                # Random delay to avoid rate limiting
                time.sleep(random.uniform(1, 3))
                
            except Exception as e:
                print(f"Error scraping player {player_id}: {e}")
                continue
        
        # Save batch to avoid data loss
        save_batch(players, f"batch_{batch_start}_{batch_end}.json")
        
        # Longer delay between batches
        time.sleep(random.uniform(5, 10))
    
    return players
```

### 2. **User Feedback Collection**
```javascript
// Frontend feedback collection
const collectUserFeedback = (playerId, predictedRatings, actualRatings) => {
    const feedback = {
        playerId,
        predictions: predictedRatings,
        userCorrections: actualRatings,
        timestamp: new Date().toISOString(),
        confidence: userConfidence // 1-5 scale
    };
    
    // Send to backend for ML training
    fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback)
    });
};
```

### 3. **Synthetic Data Generation**
```python
def generate_synthetic_players(base_players, multiplier=2):
    """
    Generate realistic synthetic players based on existing data
    """
    synthetic_players = []
    
    for player in base_players:
        # Create variations with realistic attribute changes
        for _ in range(multiplier):
            synthetic_player = create_variation(player)
            synthetic_players.append(synthetic_player)
    
    return synthetic_players

def create_variation(player):
    """
    Create realistic player variation
    """
    variation = player.copy()
    
    # Add realistic noise to attributes (±3 points)
    for attr in ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']:
        noise = np.random.normal(0, 1.5)  # Normal distribution
        variation[attr] = max(1, min(99, int(variation[attr] + noise)))
    
    return variation
```

## Data Quality Improvements

### 1. **Data Validation**
```python
def validate_player_data(player):
    """
    Validate player data quality
    """
    # Check attribute ranges
    for attr in ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']:
        if not (1 <= player[attr] <= 99):
            return False
    
    # Check position ratings consistency
    if 'position_ratings' in player:
        for pos_rating in player['position_ratings']:
            if not (1 <= pos_rating['rating'] <= 99):
                return False
    
    # Check for missing data
    required_fields = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'positions']
    for field in required_fields:
        if field not in player:
            return False
    
    return True
```

### 2. **Outlier Detection**
```python
def detect_outliers(players, threshold=3):
    """
    Detect and remove statistical outliers
    """
    from scipy import stats
    
    # Calculate z-scores for each attribute
    attributes = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
    
    for attr in attributes:
        values = [p[attr] for p in players]
        z_scores = np.abs(stats.zscore(values))
        
        # Remove outliers
        players = [p for p, z in zip(players, z_scores) if z < threshold]
    
    return players
```

## Implementation Priority

### Phase 1: Immediate (1-2 weeks)
1. **Enhanced Scraping**: Improve existing scraper with rate limiting
2. **Data Validation**: Add quality checks to existing data
3. **User Feedback**: Add feedback collection to frontend

### Phase 2: Short-term (1 month)
1. **Synthetic Data**: Generate 200-300 synthetic players
2. **Advanced Models**: Implement XGBoost/LightGBM
3. **Feature Engineering**: Add new features from enhanced_features.py

### Phase 3: Long-term (2-3 months)
1. **Large-scale Scraping**: Target 2000+ players
2. **Ensemble Methods**: Combine multiple models
3. **Continuous Learning**: Retrain models with new data

## Expected Results

| Dataset Size | Expected Accuracy | Improvement |
|-------------|------------------|-------------|
| 641 (current) | 85.5% | Baseline |
| 1000 | 87-89% | +2-3% |
| 1500 | 89-91% | +4-5% |
| 2000+ | 91-93% | +6-7% |

## Cost-Benefit Analysis

### Benefits:
- **Higher Accuracy**: Better predictions for users
- **More Positions**: Better coverage of edge cases
- **User Trust**: More reliable recommendations

### Costs:
- **Development Time**: 2-4 weeks for implementation
- **Server Resources**: Additional ML training time
- **Maintenance**: Ongoing data collection and model updates

## Recommendation

**Start with Phase 1** - Enhanced scraping and user feedback collection. This provides immediate improvements with minimal risk and sets up the foundation for more advanced improvements.




