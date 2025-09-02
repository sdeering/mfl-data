#!/usr/bin/env python3
"""
Enhanced Feature Engineering for MFL Position Rating Prediction
"""

def create_enhanced_features(PAC, SHO, PAS, DRI, DEF, PHY):
    """
    Enhanced feature engineering with more sophisticated combinations
    """
    
    # Base features (existing)
    base_features = [PAC, SHO, PAS, DRI, DEF, PHY]
    
    # Enhanced attacking combinations
    attacking_score = (SHO + DRI + PAC) / 3
    finishing_score = (SHO + DRI) / 2
    goal_scoring_potential = (SHO * 0.6 + PAC * 0.3 + DRI * 0.1)
    
    # Enhanced defensive combinations
    defensive_score = (DEF + PHY) / 2
    marking_score = (DEF + PAC) / 2
    center_back_potential = (DEF * 0.7 + PHY * 0.2 + PAS * 0.1)
    full_back_potential = (PAC * 0.3 + DEF * 0.3 + PAS * 0.25 + DRI * 0.15)
    
    # Enhanced midfield combinations
    playmaking_score = (PAS + DRI) / 2
    box_to_box_score = (PAS + DEF + PHY) / 3
    central_midfield_potential = (PAS * 0.4 + DRI * 0.25 + DEF * 0.2 + PAC * 0.15)
    
    # Enhanced wing play combinations
    wing_score = (PAC + DRI) / 2
    crossing_score = (PAS + PAC) / 2
    wing_back_potential = (PAC * 0.35 + PAS * 0.25 + DRI * 0.25 + DEF * 0.15)
    winger_potential = (PAC * 0.3 + DRI * 0.3 + SHO * 0.2 + PAS * 0.2)
    
    # Enhanced physical and aerial combinations
    aerial_score = (PHY + DEF) / 2
    physical_dominance = (PHY * 0.6 + DEF * 0.4)
    speed_potential = (PAC * 0.8 + DRI * 0.2)
    
    # NEW: Advanced statistical features
    attribute_variance = np.var([PAC, SHO, PAS, DRI, DEF, PHY])  # Consistency
    attribute_range = max([PAC, SHO, PAS, DRI, DEF, PHY]) - min([PAC, SHO, PAS, DRI, DEF, PHY])  # Versatility
    overall_rating = (PAC + SHO + PAS + DRI + DEF + PHY) / 6
    
    # NEW: Position-specific ratios
    attacking_defensive_ratio = (SHO + PAS + DRI) / (DEF + PHY) if (DEF + PHY) > 0 else 1
    speed_technical_ratio = (PAC + DRI) / (SHO + PAS) if (SHO + PAS) > 0 else 1
    physical_technical_ratio = (DEF + PHY) / (PAS + DRI) if (PAS + DRI) > 0 else 1
    
    # NEW: Specialized position features
    goalkeeper_potential = (DEF * 0.4 + PHY * 0.3 + PAS * 0.2 + PAC * 0.05 + SHO * 0.03 + DRI * 0.02)
    striker_potential = (SHO * 0.5 + PAC * 0.25 + DRI * 0.15 + PAS * 0.1)
    playmaker_potential = (PAS * 0.4 + DRI * 0.3 + SHO * 0.2 + PAC * 0.1)
    defender_potential = (DEF * 0.5 + PHY * 0.3 + PAS * 0.15 + PAC * 0.05)
    
    # NEW: Interaction features (multiplicative)
    pace_shooting_interaction = PAC * SHO / 100  # Fast strikers
    passing_dribbling_interaction = PAS * DRI / 100  # Creative midfielders
    defense_physical_interaction = DEF * PHY / 100  # Strong defenders
    
    # NEW: Polynomial features (squared terms)
    pace_squared = PAC ** 2 / 100
    shooting_squared = SHO ** 2 / 100
    passing_squared = PAS ** 2 / 100
    
    # NEW: Composite skill scores
    technical_skill = (PAS + DRI) / 2
    physical_skill = (PAC + PHY) / 2
    mental_skill = (DEF + SHO) / 2  # Decision making + finishing
    
    enhanced_features = base_features + [
        # Existing features
        attacking_score, finishing_score, goal_scoring_potential,
        defensive_score, marking_score, center_back_potential, full_back_potential,
        playmaking_score, box_to_box_score, central_midfield_potential,
        wing_score, crossing_score, wing_back_potential, winger_potential,
        aerial_score, physical_dominance, speed_potential,
        
        # NEW: Statistical features
        attribute_variance, attribute_range, overall_rating,
        
        # NEW: Ratio features
        attacking_defensive_ratio, speed_technical_ratio, physical_technical_ratio,
        
        # NEW: Specialized position features
        goalkeeper_potential, striker_potential, playmaker_potential, defender_potential,
        
        # NEW: Interaction features
        pace_shooting_interaction, passing_dribbling_interaction, defense_physical_interaction,
        
        # NEW: Polynomial features
        pace_squared, shooting_squared, passing_squared,
        
        # NEW: Composite skills
        technical_skill, physical_skill, mental_skill
    ]
    
    return enhanced_features

# Example usage
if __name__ == "__main__":
    import numpy as np
    
    # Example player attributes
    player = {
        'PAC': 85, 'SHO': 78, 'PAS': 82, 'DRI': 80, 'DEF': 45, 'PHY': 70
    }
    
    features = create_enhanced_features(**player)
    print(f"Original features: {len([player['PAC'], player['SHO'], player['PAS'], player['DRI'], player['DEF'], player['PHY']])}")
    print(f"Enhanced features: {len(features)}")
    print(f"Feature expansion: {len(features) - 6} new features")




