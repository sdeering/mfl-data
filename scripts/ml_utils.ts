import { spawn } from 'child_process';
import path from 'path';

// Interface for prediction result
export interface PredictionResult {
  position: string;
  predicted_rating: number;
  confidence?: number;
  features_used?: string[];
}

// Load model using Python subprocess (for serverless compatibility)
export async function loadModel(modelPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'scripts', 'load_model.py'),
      modelPath
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const model = JSON.parse(output);
          resolve(model);
        } catch (error) {
          reject(new Error(`Failed to parse model output: ${error}`));
        }
      } else {
        reject(new Error(`Model loading failed: ${errorOutput}`));
      }
    });
  });
}

// Predict position using loaded model
export async function predictPosition(
  model: any, 
  attributes: any, 
  overall: number, 
  position: string
): Promise<PredictionResult> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'scripts', 'predict_position.py'),
      JSON.stringify(model),
      JSON.stringify(attributes),
      overall.toString(),
      position
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse prediction output: ${error}`));
        }
      } else {
        reject(new Error(`Prediction failed: ${errorOutput}`));
      }
    });
  });
}
