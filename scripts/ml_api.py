#!/usr/bin/env python3
"""
FastAPI backend for ML position rating predictions
"""

import os
import sys
import json
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(title="MFL Position Rating ML API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models and scalers
models = {}
scalers = {}
positions = []

def load_models():
    """Load all trained models and scalers"""
    global models, scalers, positions
    
    model_dir = os.path.join(os.path.dirname(__file__), "models")
    
    # Load metadata
    with open(os.path.join(model_dir, "metadata.json"), 'r') as f:
        metadata = json.load(f)
        positions = metadata['positions']
    
    # Load models and scalers for each position
    for position in positions:
        model_path = os.path.join(model_dir, f"{position}_model.pkl")
        scaler_path = os.path.join(model_dir, f"{position}_scaler.pkl")
        
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            models[position] = joblib.load(model_path)
            scalers[position] = joblib.load(scaler_path)
            print(f"Loaded model for {position}")
        else:
            print(f"Warning: Missing model files for {position}")

# Pydantic models for request/response
class PlayerAttributes(BaseModel):
    PAC: int  # Pace
    SHO: int  # Shooting
    PAS: int  # Passing
    DRI: int  # Dribbling
    DEF: int  # Defense
    PHY: int  # Physical

class PositionRating(BaseModel):
    position: str
    rating: int
    familiarity: str  # 'PRIMARY', 'SECONDARY', 'UNFAMILIAR'
    difference: int

class PredictionRequest(BaseModel):
    attributes: PlayerAttributes
    positions: List[str]
    overall: int = None  # Optional: player's actual overall rating

class PredictionResponse(BaseModel):
    positionRatings: List[PositionRating]
    bestPosition: str
    top3Positions: List[str]

def create_engineered_features(attributes: PlayerAttributes) -> np.ndarray:
    """Create enhanced engineered features from player attributes for MFL"""
    PAC, SHO, PAS, DRI, DEF, PHY = (
        attributes.PAC, attributes.SHO, attributes.PAS,
        attributes.DRI, attributes.DEF, attributes.PHY
    )
    
    # Base features
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
    
    # Position-specific combinations for MFL
    # LWB/RWB specific features
    wing_back_offensive = (PAC * 0.3 + PAS * 0.3 + DRI * 0.25 + SHO * 0.15)
    wing_back_defensive = (DEF * 0.4 + PAC * 0.3 + PAS * 0.2 + PHY * 0.1)
    
    # CB specific features
    center_back_defensive = (DEF * 0.6 + PHY * 0.25 + PAS * 0.15)
    center_back_aerial = (PHY * 0.5 + DEF * 0.4 + PAC * 0.1)
    
    # CDM specific features
    defensive_midfield = (DEF * 0.4 + PAS * 0.3 + PHY * 0.2 + DRI * 0.1)
    
    # Add all enhanced engineered features
    engineered = [
        attacking_score, finishing_score, goal_scoring_potential,
        defensive_score, marking_score, center_back_potential, full_back_potential,
        playmaking_score, box_to_box_score, central_midfield_potential,
        wing_score, crossing_score, wing_back_potential, winger_potential,
        aerial_score, physical_dominance, speed_potential,
        # MFL-specific features
        wing_back_offensive, wing_back_defensive,
        center_back_defensive, center_back_aerial,
        defensive_midfield
    ]
    
    features = base_features + engineered
    
    return np.array(features).reshape(1, -1)

def predict_position_rating(
    features: np.ndarray,
    position: str,
    player_positions: List[str],
    actual_overall: int = None
) -> PositionRating:
    """Predict rating for a specific position using the trained model"""
    
    # Calculate overall rating from attributes
    PAC, SHO, PAS, DRI, DEF, PHY = features[0][:6]
    calculated_overall = round((PAC + SHO + PAS + DRI + DEF + PHY) / 6)
    
    # Use actual overall if provided, otherwise use calculated
    overall = actual_overall if actual_overall is not None else calculated_overall
    
    # Determine familiarity
    if position in player_positions:
        familiarity = 'PRIMARY' if player_positions[0] == position else 'SECONDARY'
    else:
        familiarity = 'UNFAMILIAR'
    
    # CRITICAL RULE: Primary position ALWAYS equals overall rating
    if familiarity == 'PRIMARY':
        rating = overall
    else:
        # For secondary and unfamiliar positions, use ML prediction
        if position not in models:
            print(f"DEBUG: Model not found for {position}, using fallback")
            # Improved fallback to rule-based prediction if model not available
            if position == 'GK':
                rating = round(DEF * 0.3 + PHY * 0.4 + PAS * 0.15 + PAC * 0.05 + SHO * 0.05 + DRI * 0.05)
            elif position == 'CB':
                # Improved CB calculation - more emphasis on DEF and PHY
                rating = round(DEF * 0.6 + PHY * 0.2 + PAS * 0.1 + PAC * 0.05 + SHO * 0.02 + DRI * 0.03)
            elif position in ['LB', 'RB']:
                rating = round(PAC * 0.2 + PAS * 0.25 + DEF * 0.25 + DRI * 0.15 + PHY * 0.1 + SHO * 0.05)
            elif position in ['LWB', 'RWB']:
                # Improved LWB/RWB calculation - more emphasis on PAC, PAS, DRI for wing-back play
                rating = round(PAC * 0.3 + PAS * 0.25 + DRI * 0.25 + DEF * 0.1 + PHY * 0.05 + SHO * 0.05)
            elif position == 'CDM':
                rating = round(PAS * 0.3 + DEF * 0.25 + DRI * 0.15 + PAC * 0.15 + PHY * 0.1 + SHO * 0.05)
            elif position == 'CM':
                rating = round(PAS * 0.35 + DRI * 0.25 + PAC * 0.2 + SHO * 0.1 + DEF * 0.05 + PHY * 0.05)
            elif position == 'CAM':
                rating = round(PAS * 0.3 + DRI * 0.25 + SHO * 0.25 + PAC * 0.15 + DEF * 0.0 + PHY * 0.05)
            elif position in ['LM', 'RM']:
                rating = round(PAC * 0.3 + PAS * 0.25 + DRI * 0.25 + SHO * 0.1 + DEF * 0.05 + PHY * 0.05)
            elif position in ['LW', 'RW']:
                rating = round(PAC * 0.25 + DRI * 0.3 + SHO * 0.2 + PAS * 0.2 + DEF * 0.0 + PHY * 0.05)
            elif position == 'ST':
                rating = round(SHO * 0.4 + PAC * 0.25 + DRI * 0.15 + PAS * 0.15 + PHY * 0.05 + DEF * 0.0)
            elif position == 'CF':
                rating = round(SHO * 0.35 + PAS * 0.2 + DRI * 0.2 + PAC * 0.2 + PHY * 0.05 + DEF * 0.0)
            else:
                rating = 50
        else:
            print(f"DEBUG: Using ML model for {position}, features shape: {features.shape}")
            # Use the trained ML model
            features_scaled = scalers[position].transform(features)
            prediction = models[position].predict(features_scaled)[0]
            rating = max(0, min(99, round(prediction)))
    
    # Ensure rating is in valid range
    rating = max(0, min(99, rating))
    
    # Calculate difference from overall
    difference = rating - overall
    
    return PositionRating(
        position=position,
        rating=rating,
        familiarity=familiarity,
        difference=difference
    )

@app.on_event("startup")
async def startup_event():
    """Load models on startup"""
    load_models()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "MFL Position Rating ML API", "status": "running"}

@app.post("/predict", response_model=PredictionResponse)
async def predict_position_ratings(request: PredictionRequest):
    """Predict position ratings for a player"""
    try:
        # Create engineered features
        features = create_engineered_features(request.attributes)
        
        # Predict ratings for all positions
        position_ratings = []
        for position in positions:
            rating = predict_position_rating(features, position, request.positions, request.overall)
            position_ratings.append(rating)
        
        # Sort by rating to find best positions
        sorted_ratings = sorted(position_ratings, key=lambda x: x.rating, reverse=True)
        best_position = sorted_ratings[0].position
        top3_positions = [r.position for r in sorted_ratings[:3]]
        
        return PredictionResponse(
            positionRatings=position_ratings,
            bestPosition=best_position,
            top3Positions=top3_positions
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check with model status"""
    return {
        "status": "healthy",
        "models_loaded": len(models),
        "positions_available": positions
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
