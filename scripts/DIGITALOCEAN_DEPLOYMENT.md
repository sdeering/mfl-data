# DigitalOcean ML API Deployment Guide

This guide will help you deploy the Python ML API to DigitalOcean so production can use accurate ML predictions.

## Prerequisites

1. **DigitalOcean Account**: You need a DigitalOcean account
2. **doctl CLI**: Install the DigitalOcean CLI tool
3. **SSH Key**: Add your SSH key to DigitalOcean

## Step 1: Install doctl CLI

```bash
# macOS (using Homebrew)
brew install doctl

# Or download from: https://github.com/digitalocean/doctl/releases
```

## Step 2: Authenticate with DigitalOcean

```bash
doctl auth init
# Enter your DigitalOcean API token when prompted
```

## Step 3: Add SSH Key to DigitalOcean

1. Go to your DigitalOcean dashboard
2. Navigate to Settings > Security > SSH Keys
3. Add your SSH key
4. Note the SSH key name (you'll need this for the deployment script)

## Step 4: Update Deployment Script

Edit `scripts/deploy-digitalocean.sh` and update the SSH key name:

```bash
SSH_KEY_NAME="your-ssh-key-name"  # Replace with your actual SSH key name
```

## Step 5: Deploy the ML API

```bash
cd scripts
./deploy-digitalocean.sh
```

## Step 6: Update Production Environment

Once deployed, you'll get a droplet IP address. Update your production environment:

1. **Option A: Environment Variable**
   ```bash
   # In your Vercel dashboard, add environment variable:
   NEXT_PUBLIC_ML_API_URL=https://YOUR_DROPLET_IP:8000
   ```

2. **Option B: Update Serverless Function**
   Edit `app/api/predict/route.ts` and update the production URL:
   ```typescript
   const PYTHON_ML_API_URL = process.env.NODE_ENV === 'development' 
     ? 'http://localhost:8000' 
     : 'https://YOUR_DROPLET_IP:8000';
   ```

## Step 7: Test the Deployment

```bash
# Test health endpoint
curl https://YOUR_DROPLET_IP:8000/health

# Test prediction endpoint
curl -X POST https://YOUR_DROPLET_IP:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"attributes":{"PAC":84,"SHO":32,"PAS":77,"DRI":74,"DEF":87,"PHY":83},"positions":["LB","CB","RB"]}'
```

## Configuration Options

### Droplet Size
The default is `s-2vcpu-4gb` (2 CPU, 4GB RAM). You can change this in the script:
- `s-1vcpu-1gb`: $6/month (minimal)
- `s-2vcpu-4gb`: $24/month (recommended)
- `s-4vcpu-8gb`: $48/month (high performance)

### Region
Default is `nyc1` (New York). Choose the closest to your users:
- `nyc1`: New York
- `sfo3`: San Francisco
- `lon1`: London
- `fra1`: Frankfurt
- `sgp1`: Singapore

## Security Considerations

1. **Firewall**: The droplet will be accessible on port 8000
2. **HTTPS**: Consider setting up SSL/TLS with Let's Encrypt
3. **Monitoring**: Set up monitoring for the ML API
4. **Backups**: Regular backups of the ML models

## Cost Estimation

- **Droplet**: $24/month (s-2vcpu-4gb)
- **Bandwidth**: Included (1TB)
- **Total**: ~$24/month

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Check your SSH key is added to DigitalOcean
   - Verify the SSH key name in the script

2. **Docker Build Failed**
   - Check the models directory exists
   - Verify all files are copied correctly

3. **API Not Responding**
   - Check if the container is running: `docker ps`
   - Check logs: `docker-compose logs ml-api`

### Useful Commands

```bash
# Connect to droplet
ssh root@YOUR_DROPLET_IP

# Check container status
docker ps

# View logs
docker-compose logs ml-api

# Restart service
docker-compose restart ml-api

# Update and redeploy
docker-compose down
docker-compose up -d --build
```

## Next Steps

After deployment:
1. Test the API endpoints
2. Update your production environment
3. Monitor the API performance
4. Set up SSL/TLS for HTTPS
5. Configure monitoring and alerts
