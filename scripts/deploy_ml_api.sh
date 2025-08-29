#!/bin/bash

# ML API Deployment Script
# This script deploys the ML API to production

echo "🚀 Deploying ML API to production..."

# Check if we're in the right directory
if [ ! -f "ml_api.py" ]; then
    echo "❌ Error: ml_api.py not found. Please run this script from the scripts/ directory."
    exit 1
fi

# Install dependencies if needed
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Start the ML API on port 8000
echo "🔧 Starting ML API on port 8000..."
echo "📝 Note: Make sure port 8000 is available and accessible from the internet"
echo "📝 The API will be available at: https://mfldata.com:8000"

# Start the API with production settings
python3 ml_api.py

echo "✅ ML API deployment complete!"
echo "🌐 API Health Check: https://mfldata.com:8000/health"
echo "🔗 API Endpoint: https://mfldata.com:8000/predict"
