# Deployment Checklist - zammunda.com

## ✅ Pre-Deployment Complete

- ✅ Code committed and pushed to `cursor/comprehensive-improvements-7360`
- ✅ All features tested locally
- ✅ Database schema finalized
- ✅ API endpoints functional
- ✅ Seed data working

## 🚀 Deployment Options

### Option 1: Automated Quick Deploy (Recommended)

**Requirements:**
- VPS IP address
- SSH user (e.g., `ubuntu`, `root`)
- SSH key-based authentication configured

**Command:**
```bash
./scripts/deploy.sh YOUR_VPS_IP YOUR_SSH_USER
```

**What it does:**
1. Tests SSH connection
2. Packages application
3. Uploads to `/opt/nzeru-za-alimi`
4. Installs Node.js 22+
5. Installs dependencies
6. Creates systemd service
7. Starts application on port 4000

---

### Option 2: Docker Deployment

**Requirements:**
- VPS with Docker installed
- Docker Compose installed
- PostgreSQL credentials

**Steps:**
```bash
# On VPS
cd /opt
git clone https://github.com/peterchatuwa/dzalasmart.git nzeru-za-alimi
cd nzeru-za-alimi
git checkout cursor/comprehensive-improvements-7360

# Create .env.production
cp .env.docker.example .env.production
nano .env.production  # Set JWT_SECRET, DATABASE_URL

# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

---

### Option 3: Manual Deployment

**Steps:**
```bash
# On VPS
cd /opt
git clone https://github.com/peterchatuwa/dzalasmart.git nzeru-za-alimi
cd nzeru-za-alimi
git checkout cursor/comprehensive-improvements-7360

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm install

# Set up environment
cp server/.env.example server/.env
nano server/.env  # Configure production settings

# Start with PM2
npm install -g pm2
pm2 start server/src/index.js --name nzeru-za-alimi
pm2 save
pm2 startup
```

---

## 🔧 Post-Deployment Configuration

### 1. Configure Nginx (Already Have: nginx-zammunda.conf)

```bash
# On VPS
sudo cp /opt/nzeru-za-alimi/nginx-zammunda.conf /etc/nginx/sites-available/zammunda.com
sudo ln -s /etc/nginx/sites-available/zammunda.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Set Up SSL with Let's Encrypt

```bash
# Use the automated script
cd /opt/nzeru-za-alimi
sudo ./scripts/setup-domain.sh
```

**Or manually:**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d zammunda.com -d www.zammunda.com -d api.zammunda.com -d staff.zammunda.com -d docs.zammunda.com
```

### 3. Configure PostgreSQL Database

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database
sudo -u postgres psql
CREATE DATABASE nzeru;
CREATE USER nzeru WITH PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE nzeru TO nzeru;
\q

# Update server/.env
DATABASE_URL=postgres://nzeru:YOUR_STRONG_PASSWORD@localhost:5432/nzeru
```

### 4. Set Production Environment Variables

Edit `server/.env`:
```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-strong-secret-minimum-32-characters-long-use-openssl-rand-base64-32
DATABASE_URL=postgres://nzeru:YOUR_PASSWORD@localhost:5432/nzeru
LOG_LEVEL=info
```

Generate JWT secret:
```bash
openssl rand -base64 32
```

---

## 🔍 Verification Steps

### 1. Check Application Health

```bash
# On VPS
curl http://localhost:4000/health

# Expected response:
# {"ok":true,"service":"nzeru-za-alimi","database":"postgresql"}
```

### 2. Check Nginx

```bash
sudo systemctl status nginx
curl http://localhost
```

### 3. Check SSL Certificates

```bash
sudo certbot certificates
curl https://zammunda.com/health
```

### 4. Test All Endpoints

```bash
# Farmer app
curl https://zammunda.com

# Staff desk
curl https://staff.zammunda.com

# API
curl https://api.zammunda.com/health

# API docs
curl https://docs.zammunda.com/api-docs
```

---

## 📊 Monitoring & Logs

### Application Logs

**Systemd service:**
```bash
sudo journalctl -u nzeru-za-alimi -f
```

**PM2:**
```bash
pm2 logs nzeru-za-alimi
```

**Docker:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🛡️ Security Checklist

- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Database password is strong
- [ ] Firewall configured (UFW)
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw enable
  ```
- [ ] SSL certificates installed
- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] Rate limiting configured in Nginx
- [ ] Security headers enabled
- [ ] Database backups configured
  ```bash
  # Add to crontab
  0 2 * * * pg_dump -U nzeru nzeru > /backup/nzeru-$(date +\%Y\%m\%d).sql
  ```

---

## 🔄 Updates & Maintenance

### Deploy Updates

```bash
# On VPS
cd /opt/nzeru-za-alimi
git pull origin cursor/comprehensive-improvements-7360
npm install  # If dependencies changed

# Restart application
sudo systemctl restart nzeru-za-alimi  # Systemd
# OR
pm2 restart nzeru-za-alimi  # PM2
# OR
docker-compose -f docker-compose.prod.yml restart  # Docker
```

### Database Migrations

```bash
cd /opt/nzeru-za-alimi
npm run migrate
```

### Backup Database

```bash
pg_dump -U nzeru nzeru > nzeru-backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore Database

```bash
psql -U nzeru nzeru < nzeru-backup-20260909-010000.sql
```

---

## ❌ Troubleshooting

### Application Won't Start

```bash
# Check logs
sudo journalctl -u nzeru-za-alimi -n 50

# Check node process
ps aux | grep node

# Check port 4000
sudo netstat -tlnp | grep 4000
```

### Database Connection Issues

```bash
# Test database connection
psql -U nzeru -d nzeru -c "SELECT 1;"

# Check DATABASE_URL in server/.env
cat server/.env | grep DATABASE_URL
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check status
sudo systemctl status nginx

# Restart
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

---

## 📞 Quick Reference

**Application URL:** https://zammunda.com
**Staff URL:** https://staff.zammunda.com
**API URL:** https://api.zammunda.com
**API Docs:** https://docs.zammunda.com/api-docs

**Service Management:**
```bash
sudo systemctl start nzeru-za-alimi
sudo systemctl stop nzeru-za-alimi
sudo systemctl restart nzeru-za-alimi
sudo systemctl status nzeru-za-alimi
```

**Health Check:** `curl https://api.zammunda.com/health`

---

## 🎯 What's Deployed

### Features Live:
✅ Farmer registration & login
✅ Season tracking (8 stages)
✅ GPS plot mapping (multiple parcels)
✅ Input voucher system (FISP)
✅ Farmer groups/cooperatives
✅ Market intelligence (live prices)
✅ Weather watch
✅ Crop & pest assistant (multilingual)
✅ Farm planning
✅ Warehouse receipts
✅ USSD support (*413#)

### New in This Deployment:
🆕 **Extended farmer profiles** (demographics, verification)
🆕 **Multiple land parcels** (tenure tracking)
🆕 **Farmer groups** (cooperatives, clubs, VSLAs)
🆕 **Household tracking** (family, labor)
🆕 **Asset inventory** (livestock, equipment)
🆕 **Extension visits** (service delivery history)
🆕 **Input voucher system** (FISP subsidy tracking)

---

## 🚨 Need Help?

**I need to deploy but don't have:**
- [ ] VPS IP address → Ask your hosting provider
- [ ] SSH access → Set up SSH key: `ssh-keygen -t ed25519`
- [ ] Domain DNS → Point zammunda.com A record to VPS IP
- [ ] PostgreSQL password → Generate: `openssl rand -base64 24`
- [ ] JWT secret → Generate: `openssl rand -base64 32`

**Common deployment command:**
```bash
./scripts/deploy.sh YOUR_VPS_IP ubuntu
```

**After deployment, run domain setup:**
```bash
ssh ubuntu@YOUR_VPS_IP
cd /opt/nzeru-za-alimi
sudo ./scripts/setup-domain.sh
```

That's it! Your application will be live at https://zammunda.com 🎉
