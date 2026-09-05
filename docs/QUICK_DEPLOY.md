# Quick Deployment Guide

Deploy Nzeru za Alimi to your VPS in minutes.

## Prerequisites

- VPS running Ubuntu 20.04+ (1GB RAM minimum, 2GB recommended)
- SSH access configured with key-based authentication
- Git installed locally
- Your VPS IP address

## Deployment Steps

### 1. Deploy with One Command

```bash
# From your local machine, in the project directory:
./scripts/deploy.sh YOUR_VPS_IP YOUR_SSH_USER

# Example:
./scripts/deploy.sh 192.168.1.100 ubuntu
```

This script will:
- ✅ Test SSH connection
- ✅ Package the application
- ✅ Upload to server
- ✅ Install Node.js (if needed)
- ✅ Install dependencies
- ✅ Create systemd service
- ✅ Start the application

### 2. Configure Production Secrets

SSH into your server:
```bash
ssh YOUR_SSH_USER@YOUR_VPS_IP
cd /opt/nzeru-za-alimi
nano server/.env
```

Update these values:
```env
JWT_SECRET=your-strong-secret-minimum-32-characters-long
DATABASE_URL=postgres://nzeru:YOUR_PASSWORD@localhost:5432/nzeru
NODE_ENV=production
```

### 3. Set Up PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database
sudo -u postgres psql << EOF
CREATE USER nzeru WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE nzeru OWNER nzeru;
GRANT ALL PRIVILEGES ON DATABASE nzeru TO nzeru;
EOF
```

Update `DATABASE_URL` in `server/.env` with the password you set above.

### 4. Run Database Migrations

```bash
cd /opt/nzeru-za-alimi
npm run migrate
```

### 5. Restart the Service

```bash
sudo systemctl restart nzeru-za-alimi
```

### 6. Verify Deployment

```bash
# Check service status
sudo systemctl status nzeru-za-alimi

# Check health
curl http://localhost:4000/health

# View logs
sudo journalctl -u nzeru-za-alimi -f
```

## Access Your Application

- **Farmer App**: http://YOUR_VPS_IP:4000
- **Staff Desk**: http://YOUR_VPS_IP:4000/staff
- **API Docs**: http://YOUR_VPS_IP:4000/api-docs
- **Health**: http://YOUR_VPS_IP:4000/health

## Optional: Set Up HTTPS

### Install nginx and Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configure nginx

```bash
sudo nano /etc/nginx/sites-available/nzeru
```

Paste this configuration (replace `your-domain.com`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/nzeru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

### Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Updating the Application

When you push changes:

```bash
# From your local machine
./scripts/deploy.sh YOUR_VPS_IP YOUR_SSH_USER
```

The script handles everything automatically!

## Troubleshooting

### Service won't start
```bash
# View detailed logs
sudo journalctl -u nzeru-za-alimi -n 100 --no-pager

# Check configuration
sudo systemctl status nzeru-za-alimi
```

### Database connection fails
```bash
# Test database
sudo -u postgres psql -U nzeru -d nzeru -c "SELECT 1;"

# Check DATABASE_URL in .env
cat /opt/nzeru-za-alimi/server/.env | grep DATABASE_URL
```

### Port 4000 already in use
```bash
# Check what's using the port
sudo lsof -i :4000
sudo netstat -tulpn | grep 4000
```

## Manual Commands

```bash
# Start service
sudo systemctl start nzeru-za-alimi

# Stop service
sudo systemctl stop nzeru-za-alimi

# Restart service
sudo systemctl restart nzeru-za-alimi

# View logs
sudo journalctl -u nzeru-za-alimi -f

# Check status
sudo systemctl status nzeru-za-alimi
```

## Backup Database

```bash
# Create backup
sudo -u postgres pg_dump nzeru > backup_$(date +%Y%m%d).sql

# Restore backup
sudo -u postgres psql nzeru < backup_20260905.sql
```

## Need Help?

- Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
- Review [SECURITY.md](../SECURITY.md) for security best practices
- Check logs: `sudo journalctl -u nzeru-za-alimi -f`
- Open an issue on GitHub

---

**That's it!** Your application should now be running on your VPS. 🚀
