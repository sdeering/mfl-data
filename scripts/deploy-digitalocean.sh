#!/bin/bash

# DigitalOcean ML API Deployment Script
echo "🚀 Deploying ML API to DigitalOcean..."

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "❌ Error: doctl CLI is not installed. Please install it first:"
    echo "   https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

# Check if we're authenticated
if ! doctl account get &> /dev/null; then
    echo "❌ Error: Not authenticated with DigitalOcean. Please run:"
    echo "   doctl auth init"
    exit 1
fi

# Configuration
DROPLET_NAME="ml-api-server"
REGION="nyc1"
SIZE="s-2vcpu-4gb"
IMAGE="docker-20-04"
SSH_KEY_NAME="your-ssh-key-name"  # Replace with your SSH key name

echo "📋 Configuration:"
echo "   Droplet Name: $DROPLET_NAME"
echo "   Region: $REGION"
echo "   Size: $SIZE"
echo "   Image: $IMAGE"

# Create droplet
echo "🔧 Creating droplet..."
DROPLET_ID=$(doctl compute droplet create $DROPLET_NAME \
    --size $SIZE \
    --image $IMAGE \
    --region $REGION \
    --ssh-keys $SSH_KEY_NAME \
    --wait \
    --format ID,Name,PublicIPv4 \
    --no-header | awk '{print $1}')

if [ -z "$DROPLET_ID" ]; then
    echo "❌ Failed to create droplet"
    exit 1
fi

echo "✅ Droplet created with ID: $DROPLET_ID"

# Get droplet IP
echo "🌐 Getting droplet IP..."
DROPLET_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)

if [ -z "$DROPLET_IP" ]; then
    echo "❌ Failed to get droplet IP"
    exit 1
fi

echo "✅ Droplet IP: $DROPLET_IP"

# Wait for droplet to be ready
echo "⏳ Waiting for droplet to be ready..."
sleep 30

# Deploy the ML API
echo "📦 Deploying ML API..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << 'EOF'
    # Update system
    apt-get update && apt-get upgrade -y
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Create app directory
    mkdir -p /opt/ml-api
    cd /opt/ml-api
EOF

# Copy files to droplet
echo "📁 Copying files to droplet..."
scp -o StrictHostKeyChecking=no scripts/ml_api.py root@$DROPLET_IP:/opt/ml-api/
scp -o StrictHostKeyChecking=no scripts/requirements.txt root@$DROPLET_IP:/opt/ml-api/
scp -o StrictHostKeyChecking=no scripts/Dockerfile root@$DROPLET_IP:/opt/ml-api/
scp -o StrictHostKeyChecking=no scripts/docker-compose.yml root@$DROPLET_IP:/opt/ml-api/
scp -r -o StrictHostKeyChecking=no scripts/models root@$DROPLET_IP:/opt/ml-api/

# Start the ML API
echo "🚀 Starting ML API..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << 'EOF'
    cd /opt/ml-api
    docker-compose up -d --build
    
    # Wait for API to be ready
    echo "⏳ Waiting for ML API to start..."
    sleep 60
    
    # Test the API
    curl -f http://localhost:8000/health
    if [ $? -eq 0 ]; then
        echo "✅ ML API is running successfully!"
    else
        echo "❌ ML API failed to start"
        exit 1
    fi
EOF

echo "🎉 Deployment complete!"
echo "📊 ML API is available at: http://$DROPLET_IP:8000"
echo "🔍 Health check: http://$DROPLET_IP:8000/health"
echo "📝 Update your production environment to use: https://$DROPLET_IP:8000"
