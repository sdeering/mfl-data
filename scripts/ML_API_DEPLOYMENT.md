# ML API Deployment Guide

## Overview
The ML API provides position rating predictions for MFL players using trained machine learning models.

## Quick Deployment

### Option 1: Using the deployment script
```bash
cd scripts
./deploy_ml_api.sh
```

### Option 2: Manual deployment
```bash
cd scripts
pip3 install -r requirements.txt
python3 ml_api.py
```

## Production Setup

### 1. Server Requirements
- Python 3.8+
- Port 8000 available
- Internet access for the domain

### 2. Dependencies
```bash
pip3 install fastapi uvicorn scikit-learn joblib numpy pandas
```

### 3. Environment Variables
Set these in your production environment:
```bash
export ML_API_HOST="0.0.0.0"
export ML_API_PORT="8000"
```

### 4. Running in Production
```bash
# Start the API
python3 ml_api.py

# Or with uvicorn directly
uvicorn ml_api:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```
GET https://mfldata.com:8000/health
```

### Position Predictions
```
POST https://mfldata.com:8000/predict
Content-Type: application/json

{
  "attributes": {
    "PAC": 84,
    "SHO": 32,
    "PAS": 77,
    "DRI": 74,
    "DEF": 87,
    "PHY": 83
  },
  "positions": ["LB"],
  "overall": 82
}
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 8000
lsof -ti:8000

# Kill the process
kill -9 $(lsof -ti:8000)
```

### Models Not Loading
- Ensure `models/` directory exists with all `.pkl` files
- Check file permissions
- Verify Python dependencies are installed

### CORS Issues
The API includes CORS middleware for cross-origin requests from the frontend.

## Monitoring

### Health Check
Monitor the API health:
```bash
curl https://mfldata.com:8000/health
```

### Logs
Check API logs for errors and request patterns.

## Security Notes

- The API accepts requests from any origin (CORS: "*")
- In production, consider restricting CORS origins
- The API runs on HTTP by default - consider HTTPS for production
