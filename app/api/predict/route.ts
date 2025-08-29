import { NextRequest, NextResponse } from 'next/server';

// Check if we're in development and should use the Python ML API
const isDevelopment = process.env.NODE_ENV === 'development';
const PYTHON_ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000';

// Simple rule-based prediction system for serverless compatibility
function calculatePositionRating(attributes: any, overall: number | undefined, position: string): number {
  const { PAC, SHO, PAS, DRI, DEF, PHY } = attributes;
  
  // Calculate overall rating if not provided
  const calculatedOverall = overall || Math.round((PAC + SHO + PAS + DRI + DEF + PHY) / 6);
  
  // Position-specific weight calculations
  const weights: { [key: string]: { [key: string]: number } } = {
    'LB': { PAC: 0.25, SHO: 0.05, PAS: 0.20, DRI: 0.15, DEF: 0.25, PHY: 0.10 },
    'CB': { PAC: 0.20, SHO: 0.05, PAS: 0.15, DRI: 0.10, DEF: 0.35, PHY: 0.15 },
    'RB': { PAC: 0.25, SHO: 0.05, PAS: 0.20, DRI: 0.15, DEF: 0.25, PHY: 0.10 },
    'LWB': { PAC: 0.30, SHO: 0.05, PAS: 0.25, DRI: 0.20, DEF: 0.15, PHY: 0.05 },
    'RWB': { PAC: 0.30, SHO: 0.05, PAS: 0.25, DRI: 0.20, DEF: 0.15, PHY: 0.05 },
    'CDM': { PAC: 0.15, SHO: 0.10, PAS: 0.25, DRI: 0.15, DEF: 0.25, PHY: 0.10 },
    'CM': { PAC: 0.15, SHO: 0.15, PAS: 0.25, DRI: 0.20, DEF: 0.15, PHY: 0.10 },
    'CAM': { PAC: 0.15, SHO: 0.20, PAS: 0.25, DRI: 0.25, DEF: 0.10, PHY: 0.05 },
    'LM': { PAC: 0.25, SHO: 0.15, PAS: 0.20, DRI: 0.25, DEF: 0.10, PHY: 0.05 },
    'RM': { PAC: 0.25, SHO: 0.15, PAS: 0.20, DRI: 0.25, DEF: 0.10, PHY: 0.05 },
    'CF': { PAC: 0.20, SHO: 0.25, PAS: 0.15, DRI: 0.25, DEF: 0.05, PHY: 0.10 },
    'ST': { PAC: 0.15, SHO: 0.30, PAS: 0.10, DRI: 0.20, DEF: 0.05, PHY: 0.20 },
    'LW': { PAC: 0.25, SHO: 0.20, PAS: 0.15, DRI: 0.25, DEF: 0.05, PHY: 0.10 },
    'RW': { PAC: 0.25, SHO: 0.20, PAS: 0.15, DRI: 0.25, DEF: 0.05, PHY: 0.10 },
    'GK': { PAC: 0.05, SHO: 0.05, PAS: 0.15, DRI: 0.05, DEF: 0.35, PHY: 0.35 }
  };
  
  const positionWeights = weights[position];
  if (!positionWeights) {
    return calculatedOverall; // Fallback to overall rating
  }
  
  // Calculate weighted position rating
  const weightedRating = 
    PAC * positionWeights.PAC +
    SHO * positionWeights.SHO +
    PAS * positionWeights.PAS +
    DRI * positionWeights.DRI +
    DEF * positionWeights.DEF +
    PHY * positionWeights.PHY;
  
  // Adjust based on overall rating (players with higher overall tend to be better at all positions)
  const overallAdjustment = (calculatedOverall - 50) * 0.1;
  const finalRating = Math.round(weightedRating + overallAdjustment);
  
  // Ensure rating is within valid range
  return Math.max(1, Math.min(99, finalRating));
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body once
    const body = await request.json();
    const { attributes, positions, overall } = body;
    
    // In development, proxy to Python ML API if available
    if (isDevelopment && PYTHON_ML_API_URL !== '/api/predict') {
      try {
        console.log('Proxying to Python ML API:', PYTHON_ML_API_URL);
        const response = await fetch(`${PYTHON_ML_API_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Python ML API response received');
          return NextResponse.json(result);
        } else {
          console.log('Python ML API failed, falling back to rule-based');
        }
      } catch (error) {
        console.log('Python ML API proxy failed, falling back to rule-based:', error);
      }
    }
    
    if (!attributes || !positions) {
      return NextResponse.json(
        { error: 'Missing required fields: attributes and positions' },
        { status: 400 }
      );
    }
    
    // Calculate predictions for requested positions
    const predictions: any = {};
    
    for (const position of positions) {
      try {
        const predictedRating = calculatePositionRating(attributes, overall, position);
        predictions[position] = {
          position,
          predicted_rating: predictedRating,
          confidence: 0.85, // Rule-based confidence
          method: 'rule-based'
        };
      } catch (error) {
        console.error(`Prediction failed for ${position}:`, error);
        predictions[position] = { 
          position,
          error: 'Prediction failed',
          predicted_rating: overall // Fallback to overall rating
        };
      }
    }
    
    return NextResponse.json({
      predictions,
      method: 'rule-based',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('ML API error:', error);
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
    console.error('Health check error:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
