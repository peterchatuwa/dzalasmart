# Quick Domain Setup - zammunda.com

## 🚀 Automated Setup (Recommended)

Run this one command on your VPS to set up everything:

```bash
# SSH into your VPS
ssh user@YOUR_VPS_IP

# Run the setup script
cd /opt/nzeru-za-alimi
sudo ./scripts/setup-domain.sh
```

The script will:
- ✅ Install and configure Nginx
- ✅ Install Certbot for SSL
- ✅ Set up SSL certificates for all domains
- ✅ Configure firewall rules
- ✅ Enable HTTPS and HTTP→HTTPS redirects
- ✅ Test all configurations

## 📋 Before You Run the Script

### 1. Configure DNS Records

Log into your domain registrar and add these DNS A records:

```
Type    Name    Value                      TTL
A       @       YOUR_VPS_IP_ADDRESS        3600
A       www     YOUR_VPS_IP_ADDRESS        3600
A       api     YOUR_VPS_IP_ADDRESS        3600
A       staff   YOUR_VPS_IP_ADDRESS        3600
A       docs    YOUR_VPS_IP_ADDRESS        3600
```

**Replace `YOUR_VPS_IP_ADDRESS`** with your actual VPS IP.

### 2. Wait for DNS Propagation

Wait 5-30 minutes, then verify:

```bash
dig zammunda.com +short
dig api.zammunda.com +short
```

Both should return your VPS IP address.

### 3. Ensure Application is Running

```bash
# Check application status
sudo systemctl status nzeru-za-alimi

# If not running, start it
sudo systemctl start nzeru-za-alimi

# Verify it's accessible
curl http://localhost:4000/health
```

## 🎯 After Setup

Your application will be available at:

- **Main App**: https://zammunda.com
- **Staff Desk**: https://staff.zammunda.com
- **API Docs**: https://docs.zammunda.com
- **API**: https://api.zammunda.com

## 🔧 Manual Setup

If you prefer manual setup, see [DOMAIN_SETUP.md](DOMAIN_SETUP.md) for detailed step-by-step instructions.

## ❓ Troubleshooting

### DNS not resolving?
```bash
# Check DNS propagation
dig zammunda.com
nslookup zammunda.com 8.8.8.8
```

### SSL certificate failed?
- Ensure DNS is fully propagated
- Check that ports 80 and 443 are open
- Verify email address is valid

### Application not accessible?
```bash
# Check nginx
sudo nginx -t
sudo systemctl status nginx

# Check application
sudo systemctl status nzeru-za-alimi
curl http://localhost:4000/health
```

### Need help?
See [DOMAIN_SETUP.md](DOMAIN_SETUP.md) for comprehensive troubleshooting.

---

**Setup Time**: ~10 minutes (after DNS propagation)
