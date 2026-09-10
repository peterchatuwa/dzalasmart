# Domain Setup Guide - zammunda.com

This guide walks you through setting up `zammunda.com` for your Nzeru za Alimi application.

## Prerequisites

- Domain `zammunda.com` registered and accessible
- Access to your domain's DNS management panel
- VPS with the application deployed
- Root/sudo access to the server

## Step 1: DNS Configuration

### A. Point Domain to Your VPS

Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add these DNS records:

#### Main Domain Records

```
Type    Name    Value               TTL
A       @       YOUR_VPS_IP_HERE    3600
A       www     YOUR_VPS_IP_HERE    3600
```

#### Subdomains (Optional but Recommended)

```
Type    Name    Value               TTL
A       api     YOUR_VPS_IP_HERE    3600
A       staff   YOUR_VPS_IP_HERE    3600
A       docs    YOUR_VPS_IP_HERE    3600
```

**Replace `YOUR_VPS_IP_HERE`** with your actual VPS IP address.

### B. Verify DNS Propagation

Wait 5-30 minutes for DNS propagation, then verify:

```bash
# Check main domain
dig zammunda.com +short

# Check www subdomain
dig www.zammunda.com +short

# Check all subdomains
dig api.zammunda.com +short
dig staff.zammunda.com +short
```

All should return your VPS IP address.

## Step 2: Install Nginx (if not already installed)

```bash
# SSH into your VPS
ssh user@YOUR_VPS_IP

# Update system
sudo apt update

# Install nginx
sudo apt install nginx -y

# Enable and start nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Step 3: Configure Nginx for Your Domain

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/zammunda.com
```

### Basic Configuration (HTTP Only - Temporary)

Paste this configuration:

```nginx
# Main application
server {
    listen 80;
    listen [::]:80;
    server_name zammunda.com www.zammunda.com;

    # Logs
    access_log /var/log/nginx/zammunda-access.log;
    error_log /var/log/nginx/zammunda-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Main application
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
}

# API subdomain
server {
    listen 80;
    listen [::]:80;
    server_name api.zammunda.com;

    access_log /var/log/nginx/zammunda-api-access.log;
    error_log /var/log/nginx/zammunda-api-error.log;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Staff subdomain
server {
    listen 80;
    listen [::]:80;
    server_name staff.zammunda.com;

    access_log /var/log/nginx/zammunda-staff-access.log;
    error_log /var/log/nginx/zammunda-staff-error.log;

    location / {
        proxy_pass http://localhost:4000/staff;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API Documentation subdomain
server {
    listen 80;
    listen [::]:80;
    server_name docs.zammunda.com;

    access_log /var/log/nginx/zammunda-docs-access.log;
    error_log /var/log/nginx/zammunda-docs-error.log;

    location / {
        proxy_pass http://localhost:4000/api-docs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable the Configuration

```bash
# Test nginx configuration
sudo nginx -t

# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/zammunda.com /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Reload nginx
sudo systemctl reload nginx
```

### Test HTTP Access

```bash
# Should show your application
curl http://zammunda.com

# Should return health status
curl http://zammunda.com/health
```

## Step 4: Set Up SSL/HTTPS with Let's Encrypt

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Obtain SSL Certificates

```bash
# Get certificates for all domains
sudo certbot --nginx -d zammunda.com -d www.zammunda.com -d api.zammunda.com -d staff.zammunda.com -d docs.zammunda.com

# Follow the prompts:
# 1. Enter your email address
# 2. Agree to terms
# 3. Choose whether to redirect HTTP to HTTPS (choose 2 for redirect)
```

Certbot will automatically:
- Obtain SSL certificates
- Update nginx configuration
- Set up auto-renewal

### Verify SSL

```bash
# Check certificate
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run
```

### Test HTTPS Access

```bash
# Should work with HTTPS
curl https://zammunda.com
curl https://api.zammunda.com
curl https://staff.zammunda.com
curl https://docs.zammunda.com
```

## Step 5: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Remove direct access to port 4000 (optional, for security)
sudo ufw delete allow 4000

# Enable firewall if not already enabled
sudo ufw enable

# Check status
sudo ufw status
```

## Step 6: Update Application Configuration

### Update Capacitor Config for Mobile App

Edit `capacitor.config.json`:

```json
{
  "appId": "mw.dzalasmart.app",
  "appName": "Nzeru za Alimi",
  "webDir": "frontend",
  "server": {
    "androidScheme": "https",
    "url": "https://zammunda.com",
    "cleartext": false
  }
}
```

### Update Frontend API Base URL

The frontend should automatically use the correct domain since it's served from the same origin. If you have hardcoded URLs, update them:

```javascript
// In frontend/app.js or similar
const API_BASE = window.location.origin; // Uses current domain
```

## Step 7: Verify Everything Works

### Access Points

✅ **Main App**: https://zammunda.com  
✅ **API**: https://api.zammunda.com  
✅ **Staff Desk**: https://staff.zammunda.com  
✅ **API Docs**: https://docs.zammunda.com  
✅ **Health Check**: https://zammunda.com/health  
✅ **Metrics**: https://zammunda.com/metrics  

### Test Each Endpoint

```bash
# Main application
curl -I https://zammunda.com

# API health
curl https://api.zammunda.com/health

# Staff desk
curl -I https://staff.zammunda.com

# API documentation
curl -I https://docs.zammunda.com
```

## Step 8: Advanced Nginx Configuration (Optional)

### Rate Limiting

Add to `/etc/nginx/sites-available/zammunda.com` before the server blocks:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;

# Inside main server block, add to sensitive endpoints:
location ~ ^/api/(farmers|staff)/(register|login) {
    limit_req zone=auth burst=2 nodelay;
    proxy_pass http://localhost:4000;
    # ... other proxy settings
}

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:4000;
    # ... other proxy settings
}
```

### Caching Static Assets

```nginx
# Add inside server block
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    proxy_pass http://localhost:4000;
}
```

### Compression

```nginx
# Add inside http block in /etc/nginx/nginx.conf
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript 
           application/json application/javascript application/xml+rss 
           application/rss+xml font/truetype font/opentype 
           application/vnd.ms-fontobject image/svg+xml;
```

## Troubleshooting

### DNS Not Resolving

```bash
# Check DNS propagation
dig zammunda.com

# Check from different DNS servers
nslookup zammunda.com 8.8.8.8
nslookup zammunda.com 1.1.1.1
```

### Nginx Errors

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check zammunda specific logs
sudo tail -f /var/log/nginx/zammunda-error.log

# Test nginx configuration
sudo nginx -t

# Check nginx status
sudo systemctl status nginx
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Check renewal service
sudo systemctl status certbot.timer
```

### Application Not Accessible

```bash
# Check if app is running
sudo systemctl status nzeru-za-alimi

# Check app logs
sudo journalctl -u nzeru-za-alimi -f

# Check if port 4000 is listening
sudo netstat -tlnp | grep 4000

# Test direct connection
curl http://localhost:4000/health
```

### Mixed Content Warnings

If you see mixed content warnings in the browser:

1. Ensure all API calls use HTTPS
2. Check that external resources (CDNs) use HTTPS
3. Update any hardcoded HTTP URLs to HTTPS

## Security Checklist

- [ ] SSL/HTTPS enabled and working
- [ ] HTTP redirects to HTTPS
- [ ] Firewall configured (UFW)
- [ ] Rate limiting enabled
- [ ] Strong passwords in database
- [ ] JWT_SECRET changed from default
- [ ] Regular security updates enabled
- [ ] Nginx access logs monitored
- [ ] SSL certificate auto-renewal working
- [ ] Security headers configured

## Maintenance

### Check SSL Certificate Expiry

```bash
# Certificates expire every 90 days
sudo certbot certificates

# Auto-renewal runs twice daily via systemd timer
sudo systemctl list-timers | grep certbot
```

### Monitor Logs

```bash
# Watch access logs
sudo tail -f /var/log/nginx/zammunda-access.log

# Watch application logs
sudo journalctl -u nzeru-za-alimi -f

# Check for errors
sudo tail -f /var/log/nginx/zammunda-error.log
```

### Backup Configuration

```bash
# Backup nginx config
sudo cp /etc/nginx/sites-available/zammunda.com /root/backups/

# Backup SSL certificates
sudo cp -r /etc/letsencrypt /root/backups/
```

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [SSL Labs Test](https://www.ssllabs.com/ssltest/) - Test your SSL configuration

---

**Need Help?**

If you encounter issues:
1. Check the troubleshooting section above
2. Review nginx error logs
3. Verify DNS is propagated
4. Ensure application is running on port 4000

Your application should now be accessible at:
- 🌐 **https://zammunda.com**
- 📱 **https://staff.zammunda.com**
- 📚 **https://docs.zammunda.com**
- 🔌 **https://api.zammunda.com**
