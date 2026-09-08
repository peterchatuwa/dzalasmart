#!/bin/bash
set -e

# Nzeru za Alimi - Domain Setup Script for zammunda.com
# Usage: ./scripts/setup-domain.sh

echo "🌐 Nzeru za Alimi - Domain Setup for zammunda.com"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN="zammunda.com"
SUBDOMAINS=("api" "staff" "docs")

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root${NC}" 
   echo "   Please run: sudo ./scripts/setup-domain.sh"
   exit 1
fi

echo "📋 Pre-flight Checks"
echo "-------------------"

# Check if application is running
if systemctl is-active --quiet nzeru-za-alimi; then
    echo -e "${GREEN}✓${NC} Application is running"
else
    echo -e "${YELLOW}⚠${NC}  Application is not running"
    echo "   Start it with: sudo systemctl start nzeru-za-alimi"
fi

# Check if port 4000 is listening
if netstat -tlnp 2>/dev/null | grep -q ':4000'; then
    echo -e "${GREEN}✓${NC} Port 4000 is listening"
else
    echo -e "${RED}✗${NC} Port 4000 is not listening"
    exit 1
fi

# Check DNS resolution
echo ""
echo "🔍 Checking DNS Resolution"
echo "-------------------------"

dns_ok=true
for subdomain in "" "www" "${SUBDOMAINS[@]}"; do
    if [ -z "$subdomain" ]; then
        check_domain="$DOMAIN"
    else
        check_domain="$subdomain.$DOMAIN"
    fi
    
    ip=$(dig +short "$check_domain" | head -n1)
    if [ -n "$ip" ]; then
        echo -e "${GREEN}✓${NC} $check_domain → $ip"
    else
        echo -e "${YELLOW}⚠${NC}  $check_domain → Not resolved"
        dns_ok=false
    fi
done

if [ "$dns_ok" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠ Warning: Some DNS records are not resolved${NC}"
    echo "   Please configure DNS records and wait for propagation"
    echo "   You can continue, but SSL setup may fail"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install nginx if not present
echo ""
echo "📦 Installing Nginx"
echo "------------------"

if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✓${NC} Nginx is already installed"
else
    echo "Installing nginx..."
    apt update
    apt install nginx -y
    systemctl enable nginx
    systemctl start nginx
    echo -e "${GREEN}✓${NC} Nginx installed"
fi

# Install certbot if not present
echo ""
echo "🔒 Installing Certbot"
echo "--------------------"

if command -v certbot &> /dev/null; then
    echo -e "${GREEN}✓${NC} Certbot is already installed"
else
    echo "Installing certbot..."
    apt install certbot python3-certbot-nginx -y
    echo -e "${GREEN}✓${NC} Certbot installed"
fi

# Copy nginx configuration
echo ""
echo "⚙️  Configuring Nginx"
echo "--------------------"

if [ -f "/etc/nginx/sites-available/$DOMAIN" ]; then
    echo -e "${YELLOW}⚠${NC}  Configuration already exists, backing up..."
    cp "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-available/$DOMAIN.backup.$(date +%s)"
fi

cp "$(dirname "$0")/../nginx-zammunda.conf" "/etc/nginx/sites-available/$DOMAIN"
echo -e "${GREEN}✓${NC} Configuration copied"

# Enable site
if [ ! -L "/etc/nginx/sites-enabled/$DOMAIN" ]; then
    ln -s "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
    echo -e "${GREEN}✓${NC} Site enabled"
fi

# Remove default site
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    rm "/etc/nginx/sites-enabled/default"
    echo -e "${GREEN}✓${NC} Default site removed"
fi

# Test nginx configuration
echo ""
echo "🧪 Testing Nginx Configuration"
echo "------------------------------"

if nginx -t; then
    echo -e "${GREEN}✓${NC} Nginx configuration is valid"
    systemctl reload nginx
    echo -e "${GREEN}✓${NC} Nginx reloaded"
else
    echo -e "${RED}✗${NC} Nginx configuration has errors"
    exit 1
fi

# Obtain SSL certificates
echo ""
echo "🔐 Setting up SSL/HTTPS"
echo "----------------------"

# Build certbot command with all domains
CERT_DOMAINS="-d $DOMAIN -d www.$DOMAIN"
for subdomain in "${SUBDOMAINS[@]}"; do
    CERT_DOMAINS="$CERT_DOMAINS -d $subdomain.$DOMAIN"
done

# Ask for email
echo "Please enter your email address for SSL certificate notifications:"
read -p "Email: " CERT_EMAIL

if [ -z "$CERT_EMAIL" ]; then
    echo -e "${RED}✗${NC} Email is required"
    exit 1
fi

echo "Obtaining SSL certificates..."
certbot --nginx $CERT_DOMAINS --email "$CERT_EMAIL" --agree-tos --no-eff-email --redirect

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} SSL certificates obtained and configured"
else
    echo -e "${RED}✗${NC} Failed to obtain SSL certificates"
    echo "   Please check DNS configuration and try again"
    exit 1
fi

# Configure firewall
echo ""
echo "🔥 Configuring Firewall"
echo "----------------------"

if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full'
    echo -e "${GREEN}✓${NC} Firewall rules added"
else
    echo -e "${YELLOW}⚠${NC}  UFW not installed, skipping firewall configuration"
fi

# Test SSL configuration
echo ""
echo "✅ Testing Configuration"
echo "----------------------"

sleep 2

echo "Testing main domain..."
if curl -sI "https://$DOMAIN/health" | grep -q "200 OK"; then
    echo -e "${GREEN}✓${NC} https://$DOMAIN is working"
else
    echo -e "${YELLOW}⚠${NC}  https://$DOMAIN may not be ready yet"
fi

echo "Testing API subdomain..."
if curl -sI "https://api.$DOMAIN/health" | grep -q "200 OK"; then
    echo -e "${GREEN}✓${NC} https://api.$DOMAIN is working"
else
    echo -e "${YELLOW}⚠${NC}  https://api.$DOMAIN may not be ready yet"
fi

# Final summary
echo ""
echo "=================================================="
echo "🎉 Domain Setup Complete!"
echo "=================================================="
echo ""
echo "Your application is now available at:"
echo ""
echo -e "  🌐 Main App:    ${GREEN}https://$DOMAIN${NC}"
echo -e "  👥 Staff Desk:  ${GREEN}https://staff.$DOMAIN${NC}"
echo -e "  📚 API Docs:    ${GREEN}https://docs.$DOMAIN${NC}"
echo -e "  🔌 API:         ${GREEN}https://api.$DOMAIN${NC}"
echo ""
echo "SSL certificates are valid for 90 days and will auto-renew."
echo ""
echo "Next steps:"
echo "  1. Test all URLs in your browser"
echo "  2. Update mobile app configuration"
echo "  3. Update any hardcoded URLs"
echo "  4. Monitor logs: sudo tail -f /var/log/nginx/zammunda-access.log"
echo ""
echo "📖 See docs/DOMAIN_SETUP.md for detailed documentation"
echo ""
