# Deployment Guide

This guide covers multiple deployment options for Nzeru za Alimi.

## Prerequisites

- VPS with Ubuntu 20.04+ or similar Linux distribution
- SSH access to the server
- Domain name (optional, for HTTPS)

## Option 1: Docker Deployment (Recommended)

### 1. Prepare Your VPS

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes to take effect
```

### 2. Deploy Application

```bash
# Clone repository on VPS
cd /opt
sudo git clone https://github.com/peterchatuwa/dzalasmart.git nzeru-za-alimi
cd nzeru-za-alimi
sudo chown -R $USER:$USER .

# Check out the improvements branch
git checkout cursor/comprehensive-improvements-7360

# Create production environment file
cp .env.docker.example .env.production

# Edit with production secrets
nano .env.production
```

**Important**: Set these in `.env.production`:
```env
POSTGRES_USER=nzeru
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE
POSTGRES_DB=nzeru
NODE_ENV=production
PORT=4000
JWT_SECRET=YOUR_STRONG_JWT_SECRET_MIN_32_CHARS
LOG_LEVEL=info
DATABASE_URL=postgres://nzeru:YOUR_STRONG_PASSWORD_HERE@postgres:5432/nzeru
```

### 3. Start Services

```bash
# Start in production mode
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 4. Set Up Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install nginx
sudo apt install nginx -y

# Create nginx configuration
sudo nano /etc/nginx/sites-available/nzeru
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Change this

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;
    }

    # Auth endpoints with stricter limits
    location ~ ^/api/(farmers|staff)/(register|login) {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        limit_req zone=auth_limit burst=2 nodelay;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nzeru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Set Up HTTPS with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

### 6. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Option 2: Manual Deployment (Without Docker)

### 1. Prepare Server

```bash
# SSH into VPS
ssh user@your-vps-ip

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database
sudo -u postgres psql -c "CREATE USER nzeru WITH PASSWORD 'YOUR_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE nzeru OWNER nzeru;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nzeru TO nzeru;"
```

### 2. Deploy Application

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/peterchatuwa/dzalasmart.git nzeru-za-alimi
cd nzeru-za-alimi
sudo chown -R $USER:$USER .

# Check out improvements branch
git checkout cursor/comprehensive-improvements-7360

# Install dependencies
npm install

# Create environment file
cp server/.env.example server/.env
nano server/.env
```

Set these values in `server/.env`:
```env
PORT=4000
JWT_SECRET=your-strong-secret-min-32-chars
DATABASE_URL=postgres://nzeru:YOUR_PASSWORD@localhost:5432/nzeru
NODE_ENV=production
LOG_LEVEL=info
```

### 3. Run Migrations

```bash
npm run migrate
```

### 4. Set Up as System Service

```bash
sudo nano /etc/systemd/system/nzeru.service
```

Add:
```ini
[Unit]
Description=Nzeru za Alimi API
After=network.target postgresql.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/nzeru-za-alimi
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nzeru
sudo systemctl start nzeru
sudo systemctl status nzeru
```

### 5. Set Up Nginx (Same as Docker option above)

## Option 3: Using the Existing Python Deployment Script

If you have VPS credentials in the required format:

### 1. Create Credentials File

Create `~/Documents/zammunda.txt` with:
```
Ip Address: YOUR_VPS_IP
username: YOUR_SSH_USERNAME
Password: YOUR_SSH_PASSWORD
```

### 2. Install Requirements

```bash
pip3 install paramiko
```

### 3. Run Deployment

```bash
cd /workspace
python3 scripts/deploy_remote.py
```

This script will:
- Upload the entire project
- Install Node.js if needed
- Set up PostgreSQL
- Create systemd service
- Start the application

## Post-Deployment Checklist

- [ ] Application is running: `curl http://your-server/health`
- [ ] Database connection works
- [ ] Tests pass on server
- [ ] Logs are being written
- [ ] HTTPS is configured
- [ ] Firewall is active
- [ ] Backups are scheduled
- [ ] Monitoring is set up
- [ ] Domain DNS is configured
- [ ] Environment secrets are secure

## Monitoring

### View Logs

**Docker:**
```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

**Systemd:**
```bash
sudo journalctl -u nzeru -f
```

### Check Health

```bash
curl http://your-server/health
curl http://your-server/health/detailed
curl http://your-server/metrics
```

### Database Backup

```bash
# Manual backup
docker exec nzeru-postgres-prod pg_dump -U nzeru nzeru > backup_$(date +%Y%m%d).sql

# Or with systemd
sudo -u postgres pg_dump nzeru > backup_$(date +%Y%m%d).sql
```

### Set Up Automated Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-nzeru.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/backups/nzeru"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker exec nzeru-postgres-prod pg_dump -U nzeru nzeru | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/backup-nzeru.sh
```

Add cron job:
```bash
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-nzeru.sh
```

## Updating the Application

### Docker Deployment

```bash
cd /opt/nzeru-za-alimi
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

```bash
cd /opt/nzeru-za-alimi
git pull
npm install
npm run migrate
sudo systemctl restart nzeru
```

## Troubleshooting

### Check Application Status

```bash
# Docker
docker-compose -f docker-compose.prod.yml ps

# Systemd
sudo systemctl status nzeru
```

### View Error Logs

```bash
# Docker
docker-compose -f docker-compose.prod.yml logs --tail=100 app

# Systemd
sudo journalctl -u nzeru -n 100
```

### Database Connection Issues

```bash
# Test database connection
docker exec -it nzeru-postgres-prod psql -U nzeru -d nzeru -c "SELECT 1;"

# Or without Docker
sudo -u postgres psql -U nzeru -d nzeru -c "SELECT 1;"
```

### Port Already in Use

```bash
# Check what's using port 4000
sudo lsof -i :4000
sudo netstat -tulpn | grep 4000
```

## Security Reminders

1. **Never commit** `.env` files or credentials
2. **Use strong passwords** (minimum 16 characters)
3. **Keep secrets secret** - use environment variables
4. **Update regularly** - run `apt update && apt upgrade`
5. **Monitor logs** - watch for suspicious activity
6. **Backup database** - daily automated backups
7. **Use HTTPS** - always use SSL/TLS in production
8. **Firewall** - only allow necessary ports
9. **Rate limiting** - already configured in the app
10. **Regular audits** - review security logs

## Support

For issues:
- Check logs first
- Review [SECURITY.md](../SECURITY.md)
- Open an issue on GitHub
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**Deployment Complete!** 🚀

Access your application at:
- HTTP: http://your-domain.com
- HTTPS: https://your-domain.com (after Let's Encrypt setup)
- API Docs: https://your-domain.com/api-docs
