FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the ML API code
COPY ml_api.py .

# Copy the models directory
COPY models/ ./models/

# Expose port 8000
EXPOSE 8000

# Set environment variables
ENV ML_API_HOST=0.0.0.0
ENV ML_API_PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the API
CMD ["python3", "ml_api.py"]
