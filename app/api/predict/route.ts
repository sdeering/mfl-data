import { NextRequest, NextResponse } from 'next/server';
import { calculatePositionOVR } from '../../../src/utils/ruleBasedPositionCalculator';
import { MFLPosition } from '../../../src/types/positionOvr';

// Check if we're in development and should use the Python ML API
const isDevelopment = process.env.NODE_ENV === 'development';
const PYTHON_ML_API_URL = 'http://localhost:8000';
const DIGITALOCEAN_ML_API_URL = 'http://143.198.172.99:8000';

export async function POST(request: NextRequest) {
  try {
    // Parse request body once
    const body = await request.json();
    const { attributes, positions, overall } = body;
    
    // Proxy to ML API if available (local in development, DigitalOcean in production)
    const targetApiUrl = isDevelopment ? PYTHON_ML_API_URL : DIGITALOCEAN_ML_API_URL;
    
    try {
                   const response = await fetch(`${targetApiUrl}/position-ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        const result = await response.json();
        return NextResponse.json(result);
      } else {
        // console.log('ML API failed, falling back to rule-based'); // Removed debug logging
      }
    } catch (error) {
      // console.log('ML API proxy failed, falling back to rule-based:', error); // Removed debug logging
    }
    
    if (!attributes || !positions) {
      return NextResponse.json(
        { error: 'Missing required fields: attributes and positions' },
        { status: 400 }
      );
    }
    
    // Calculate predictions for requested positions using our new rule-based algorithm
    const predictions: any = {};
    
    // Create a mock player object for our algorithm
    const mockPlayer = {
      id: 0,
      name: 'API Request',
      attributes: {
        PAC: attributes.PAC,
        SHO: attributes.SHO,
        PAS: attributes.PAS,
        DRI: attributes.DRI,
        DEF: attributes.DEF,
        PHY: attributes.PHY
      },
      positions: positions as MFLPosition[]
    };
    
    for (const position of positions) {
      try {
        const result = calculatePositionOVR(mockPlayer, position as MFLPosition);
        
        if (result.success) {
          predictions[position] = {
            position,
            predicted_rating: result.ovr,
            confidence: 0.85, // Rule-based confidence
            method: 'rule-based',
            familiarity: result.familiarity,
            weighted_average: result.weightedAverage,
            penalty: result.penalty
          };
        } else {
          predictions[position] = { 
            position,
            error: result.error?.message || 'Prediction failed',
            predicted_rating: overall || 50 // Fallback to overall rating
          };
        }
      } catch (error) {
        predictions[position] = { 
          position,
          error: 'Prediction failed',
          predicted_rating: overall || 50 // Fallback to overall rating
        };
      }
    }
    
    return NextResponse.json({
      predictions,
      method: 'rule-based',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // console.error('ML API error:', error); // Removed debug logging
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      method: 'rule-based',
      supported_positions: ['LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'CF', 'ST', 'LW', 'RW', 'GK'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // console.error('Health check error:', error); // Removed debug logging
    return NextResponse.json(
      { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
