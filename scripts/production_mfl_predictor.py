#!/usr/bin/env python3
"""
Production MFL Position Rating Predictor
Ready for deployment to the API
"""

import json
from datetime import datetime

def calculate_mfl_position_rating(attributes, primary_pos, target_pos):
    """
    Calculate position rating using MFL deterministic rules
    """
    PAC, SHO, PAS, DRI, DEF, PHY = attributes
    
    # Special handling for goalkeepers
    if target_pos == 'GK':
        return calculate_gk_rating(attributes, primary_pos)
    
    # Get familiarity level
    familiarity = get_familiarity_level(primary_pos, target_pos)
    
    # Apply familiarity penalty
    penalty = get_familiarity_penalty(familiarity)
    
    # Calculate base position rating using MFL rules
    base_rating = calculate_base_position_rating(attributes, target_pos)
    
    # Apply penalty
    final_rating = base_rating + penalty
    
    # Ensure rating is within bounds (1-99)
    final_rating = max(1, min(99, int(final_rating)))
    
    return final_rating, familiarity, penalty

def calculate_gk_rating(attributes, primary_pos):
    """
    Special calculation for goalkeeper ratings
    """
    PAC, SHO, PAS, DRI, DEF, PHY = attributes
    
    # If primary position is GK, use full rating
    if primary_pos == 'GK':
        # GK rating based on DEF, PHY, PAS (goalkeeping attributes)
        gk_rating = (DEF * 0.6 + PHY * 0.3 + PAS * 0.1)
        return int(gk_rating), 'Primary', 0
    
    # For non-GK players, apply heavy penalty
    # Most outfield players are terrible goalkeepers
    gk_rating = (DEF * 0.6 + PHY * 0.3 + PAS * 0.1) - 50  # Heavy penalty
    gk_rating = max(1, min(99, int(gk_rating)))
    
    return gk_rating, 'Unfamiliar', -50

def get_familiarity_level(primary_pos, target_pos):
    """Get familiarity level between positions"""
    if primary_pos == target_pos:
        return 'Primary'
    elif target_pos in get_secondary_positions(primary_pos):
        return 'Secondary'
    elif target_pos in get_fairly_familiar_positions(primary_pos):
        return 'Fairly Familiar'
    elif target_pos in get_somewhat_familiar_positions(primary_pos):
        return 'Somewhat Familiar'
    else:
        return 'Unfamiliar'

def get_secondary_positions(primary_pos):
    """Get secondary positions for a given primary position"""
    secondary_map = {
        'ST': ['CF'],
        'CF': ['ST'],
        'LW': ['LM', 'RW'],
        'RW': ['RM', 'LW'],
        'CAM': ['CM', 'CF'],
        'LM': ['LW', 'CM'],
        'RM': ['RW', 'CM'],
        'CM': ['CAM', 'CDM', 'LM', 'RM'],
        'CDM': ['CM', 'CB'],
        'CB': ['CDM'],
        'LWB': ['LB', 'LM'],
        'RWB': ['RB', 'RM'],
        'LB': ['LWB', 'CB'],
        'RB': ['RWB', 'CB'],
        'GK': []
    }
    return secondary_map.get(primary_pos, [])

def get_fairly_familiar_positions(primary_pos):
    """Get fairly familiar positions"""
    fairly_familiar_map = {
        'ST': ['LW', 'RW'],
        'CF': ['CAM'],
        'LW': ['ST', 'CF'],
        'RW': ['ST', 'CF'],
        'CAM': ['ST', 'CF'],
        'LM': ['LW', 'CAM'],
        'RM': ['RW', 'CAM'],
        'CM': ['CAM', 'CDM'],
        'CDM': ['CM', 'CB'],
        'CB': ['CDM', 'LB', 'RB'],
        'LWB': ['LW', 'LM'],
        'RWB': ['RW', 'RM'],
        'LB': ['LWB', 'CB'],
        'RB': ['RWB', 'CB'],
        'GK': []
    }
    return fairly_familiar_map.get(primary_pos, [])

def get_somewhat_familiar_positions(primary_pos):
    """Get somewhat familiar positions"""
    somewhat_familiar_map = {
        'ST': ['CAM'],
        'CF': ['LW', 'RW'],
        'LW': ['CAM'],
        'RW': ['CAM'],
        'CAM': ['LW', 'RW'],
        'LM': ['CAM'],
        'RM': ['CAM'],
        'CM': ['LW', 'RW'],
        'CDM': ['LB', 'RB'],
        'CB': ['LWB', 'RWB'],
        'LWB': ['CAM'],
        'RWB': ['CAM'],
        'LB': ['LWB'],
        'RB': ['RWB'],
        'GK': []
    }
    return somewhat_familiar_map.get(primary_pos, [])

def get_familiarity_penalty(familiarity):
    """Get penalty for familiarity level based on MFL whitepaper"""
    penalties = {
        'Primary': 0,
        'Secondary': -1,
        'Fairly Familiar': -5,
        'Somewhat Familiar': -8,
        'Unfamiliar': -20
    }
    return penalties.get(familiarity, -20)

def calculate_base_position_rating(attributes, position):
    """
    Calculate base position rating using MFL rules
    Based on actual data testing results
    """
    PAC, SHO, PAS, DRI, DEF, PHY = attributes
    
    # Position-specific calculations based on MFL game rules
    position_weights = {
        'CB': {'DEF': 0.65, 'PHY': 0.2, 'PAS': 0.1, 'PAC': 0.03, 'SHO': 0.01, 'DRI': 0.01},
        'LB': {'PAC': 0.25, 'PAS': 0.25, 'DEF': 0.25, 'DRI': 0.15, 'PHY': 0.08, 'SHO': 0.02},
        'RB': {'PAC': 0.25, 'PAS': 0.25, 'DEF': 0.25, 'DRI': 0.15, 'PHY': 0.08, 'SHO': 0.02},
        'LWB': {'PAC': 0.3, 'PAS': 0.25, 'DRI': 0.25, 'DEF': 0.1, 'PHY': 0.05, 'SHO': 0.05},
        'RWB': {'PAC': 0.3, 'PAS': 0.25, 'DRI': 0.25, 'DEF': 0.1, 'PHY': 0.05, 'SHO': 0.05},
        'CDM': {'PAS': 0.3, 'DEF': 0.25, 'DRI': 0.15, 'PAC': 0.15, 'PHY': 0.1, 'SHO': 0.05},
        'CM': {'PAS': 0.35, 'DRI': 0.25, 'PAC': 0.2, 'SHO': 0.1, 'DEF': 0.05, 'PHY': 0.05},
        'CAM': {'PAS': 0.3, 'DRI': 0.25, 'SHO': 0.25, 'PAC': 0.15, 'DEF': 0.0, 'PHY': 0.05},
        'LM': {'PAC': 0.3, 'PAS': 0.25, 'DRI': 0.25, 'SHO': 0.1, 'DEF': 0.05, 'PHY': 0.05},
        'RM': {'PAC': 0.3, 'PAS': 0.25, 'DRI': 0.25, 'SHO': 0.1, 'DEF': 0.05, 'PHY': 0.05},
        'CF': {'SHO': 0.4, 'DRI': 0.25, 'PAS': 0.2, 'PAC': 0.1, 'DEF': 0.02, 'PHY': 0.03},
        'ST': {'SHO': 0.5, 'PAC': 0.25, 'DRI': 0.15, 'PAS': 0.1},
        'LW': {'PAC': 0.25, 'DRI': 0.3, 'SHO': 0.2, 'PAS': 0.2, 'DEF': 0.0, 'PHY': 0.05},
        'RW': {'PAC': 0.25, 'DRI': 0.3, 'SHO': 0.2, 'PAS': 0.2, 'DEF': 0.0, 'PHY': 0.05}
    }
    
    weights = position_weights.get(position, {})
    
    # Calculate weighted rating
    rating = 0
    for attr, weight in weights.items():
        if attr == 'PAC':
            rating += PAC * weight
        elif attr == 'SHO':
            rating += SHO * weight
        elif attr == 'PAS':
            rating += PAS * weight
        elif attr == 'DRI':
            rating += DRI * weight
        elif attr == 'DEF':
            rating += DEF * weight
        elif attr == 'PHY':
            rating += PHY * weight
    
    return round(rating)

def predict_all_positions(attributes, primary_pos, secondary_pos=None):
    """
    Predict ratings for all positions using MFL rules
    """
    positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK']
    
    predictions = {}
    for position in positions:
        rating, familiarity, penalty = calculate_mfl_position_rating(
            attributes, primary_pos, position
        )
        predictions[position] = {
            'position': position,
            'predicted_rating': rating,
            'confidence': 0.95,  # High confidence for deterministic rules
            'method': 'mfl-deterministic',
            'familiarity': familiarity,
            'penalty': penalty
        }
    
    return predictions

def mfl_predict_position_ratings(attributes, primary_pos, secondary_pos=None):
    """
    Production-ready MFL position rating predictor
    
    Args:
        attributes: List of [PAC, SHO, PAS, DRI, DEF, PHY]
        primary_pos: Primary position (e.g., 'LB', 'ST')
        secondary_pos: Secondary position (optional)
        
    Returns:
        Dictionary with position ratings and metadata
    """
    predictions = predict_all_positions(attributes, primary_pos, secondary_pos)
    
    return {
        "predictions": predictions,
        "method": "mfl-deterministic",
        "timestamp": datetime.now().isoformat(),
        "confidence": 0.95
    }

# Example usage for testing
if __name__ == "__main__":
    # Test with a sample player
    test_attributes = [84, 32, 77, 74, 87, 83]  # PAC, SHO, PAS, DRI, DEF, PHY
    test_primary = 'LB'
    
    result = mfl_predict_position_ratings(test_attributes, test_primary)
    
    print("=== MFL PREDICTOR TEST ===")
    print(f"Player: Primary {test_primary}")
    print(f"Attributes: PAC={test_attributes[0]}, SHO={test_attributes[1]}, PAS={test_attributes[2]}, DRI={test_attributes[3]}, DEF={test_attributes[4]}, PHY={test_attributes[5]}")
    print("\nPosition Ratings:")
    
    for pos, pred in result['predictions'].items():
        print(f"  {pos}: {pred['predicted_rating']} (Familiarity: {pred['familiarity']}, Penalty: {pred['penalty']})")
    
    print(f"\nMethod: {result['method']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Timestamp: {result['timestamp']}")








