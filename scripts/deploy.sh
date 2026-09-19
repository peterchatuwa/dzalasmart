#!/bin/bash
set -e

# Nzeru za Alimi - Production Deployment Script
# Usage: ./scripts/deploy.sh [server-ip] [ssh-user]

echo "🚀 Nzeru za Alimi Deployment"
echo "=============================="

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <server-ip> <ssh-user>"
    echo "Example: $0 192.168.1.100 ubuntu"
    exit 1
fi

SERVER_IP=$1
SSH_USER=$2
REMOTE_DIR="/opt/nzeru-za-alimi"
APP_NAME="nzeru-za-alimi"

echo ""
echo "📋 Deployment Configuration:"
echo "   Server: $SSH_USER@$SERVER_IP"
echo "   Remote Directory: $REMOTE_DIR"
echo ""

# Test SSH connection
echo "🔐 Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 $SSH_USER@$SERVER_IP "echo 'Connection successful'" &>/dev/null; then
    echo "❌ Failed to connect to $SERVER_IP"
    echo "   Please check:"
    echo "   1. Server is reachable"
    echo "   2. SSH keys are configured"
    echo "   3. Username is correct"
    exit 1
fi
echo "✅ SSH connection successful"

# Create deployment package
echo ""
echo "📦 Creating deployment package..."
TEMP_DIR=$(mktemp -d)
PACKAGE="$TEMP_DIR/nzeru-deploy.tar.gz"

tar -czf "$PACKAGE" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='android/.gradle' \
    --exclude='android/build' \
    --exclude='android/app/build' \
    --exclude='*.db' \
    --exclude='*.db-wal' \
    --exclude='*.db-shm' \
    --exclude='.env' \
    --exclude='*.log' \
    -C "$(pwd)" .

PACKAGE_SIZE=$(du -h "$PACKAGE" | cut -f1)
echo "✅ Package created: $PACKAGE_SIZE"

# Upload package
echo ""
echo "📤 Uploading to server..."
scp "$PACKAGE" $SSH_USER@$SERVER_IP:/tmp/nzeru-deploy.tar.gz
rm -rf "$TEMP_DIR"
echo "✅ Upload complete"

# Deploy on server
echo ""
echo "🔧 Deploying on server..."

ssh $SSH_USER@$SERVER_IP bash << 'ENDSSH'
set -e

REMOTE_DIR="/opt/nzeru-za-alimi"
APP_NAME="nzeru-za-alimi"

echo "📁 Preparing directory..."
sudo mkdir -p $REMOTE_DIR
sudo chown -R $USER:$USER $REMOTE_DIR
cd $REMOTE_DIR

echo "📦 Extracting package..."
tar -xzf /tmp/nzeru-deploy.tar.gz -C $REMOTE_DIR
rm /tmp/nzeru-deploy.tar.gz

echo "🔍 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION installed"

echo "📥 Installing dependencies..."
npm install --production

echo "✅ Dependencies installed"

# Check if .env exists
if [ ! -f "server/.env" ]; then
    echo "⚠️  Warning: server/.env not found"
    echo "   Creating from example..."
    cp server/.env.example server/.env
    echo "   ⚠️  IMPORTANT: Edit server/.env with production secrets!"
fi

# Check PostgreSQL
echo "🗄️  Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "📥 PostgreSQL not found. Install manually with:"
    echo "   sudo apt install postgresql postgresql-contrib"
    echo "   Then create database and user"
else
    echo "✅ PostgreSQL found"
fi

# Create systemd service
echo "🔧 Setting up systemd service..."
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=Nzeru za Alimi API
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$REMOTE_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

echo "▶️  Starting service..."
sudo systemctl enable $APP_NAME
sudo systemctl restart $APP_NAME

echo ""
echo "⏳ Waiting for service to start..."
sleep 3

if sudo systemctl is-active --quiet $APP_NAME; then
    echo "✅ Service is running"
else
    echo "❌ Service failed to start"
    echo "   View logs with: sudo journalctl -u $APP_NAME -n 50"
    exit 1
fi

echo ""
echo "🏥 Health check..."
if curl -sf http://localhost:4000/health > /dev/null; then
    echo "✅ Application is healthy"
else
    echo "⚠️  Health check failed (service may still be starting)"
fi

ENDSSH

# Final status check
echo ""
echo "🔍 Final verification..."
if ssh $SSH_USER@$SERVER_IP "curl -sf http://localhost:4000/health" &>/dev/null; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Access your application:"
    echo "   Farmer App: http://$SERVER_IP:4000"
    echo "   Staff Desk: http://$SERVER_IP:4000/staff"
    echo "   API Docs:   http://$SERVER_IP:4000/api-docs"
    echo "   Health:     http://$SERVER_IP:4000/health"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Edit server/.env with production secrets"
    echo "   2. Set up PostgreSQL database"
    echo "   3. Run migrations: npm run migrate"
    echo "   4. Configure nginx reverse proxy"
    echo "   5. Set up HTTPS with Let's Encrypt"
    echo ""
    echo "📖 See docs/DEPLOYMENT.md for complete setup guide"
else
    echo "⚠️  Service is running but health check failed"
    echo "   SSH into server and check logs:"
    echo "   ssh $SSH_USER@$SERVER_IP"
    echo "   sudo journalctl -u $APP_NAME -f"
fi

echo ""
echo "✨ Deployment complete!"
