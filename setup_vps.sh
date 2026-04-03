#!/bin/bash

# Website-koen VPS Setup Script for Debian/Ubuntu
# This script clones the repo, sets up venv, installs dependencies, and starts the server

set -e  # Exit on error

echo "=== Website-koen VPS Setup ==="
echo ""

# Update system
echo "1. Updating system packages..."
sudo apt update
sudo apt install -y python3-pip python3.13-venv git

# Clone repository
echo "2. Cloning repository..."
cd ~
if [ -d "Website-koen" ]; then
    echo "   Directory already exists, updating..."
    cd Website-koen
    git pull origin main
else
    git clone https://github.com/ninjahisser/Website-koen.git
    cd Website-koen
fi

# Setup backend
echo "3. Setting up Python virtual environment..."
cd backend
rm -rf .venv 2>/dev/null || true
python3 -m venv .venv
source .venv/bin/activate

echo "4. Installing Python dependencies..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

# Start server
echo ""
echo "=== Setup Complete ==="
echo "Starting Flask server on 0.0.0.0:5000..."
echo "Frontend will be at: http://YOUR_VPS_IP:5000"
echo "Articles API at:    http://YOUR_VPS_IP:5000/api/articles"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 server.py
