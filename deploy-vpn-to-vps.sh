#!/bin/bash
# Deploy Airtel VPN Configuration to VPS
# Nzeru za Alimi - USSD S2S VPN Setup

set -e

VPS_HOST="37.60.252.211"
VPS_USER="root"

echo "=========================================="
echo "AIRTEL VPN DEPLOYMENT"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  IMPORTANT: You need the Pre-Shared Key (PSK) from Airtel${NC}"
echo ""
echo "Do you have the PSK from Airtel? (yes/no)"
read -p "> " HAS_PSK

if [ "$HAS_PSK" != "yes" ] && [ "$HAS_PSK" != "y" ]; then
    echo ""
    echo -e "${RED}❌ Cannot proceed without PSK${NC}"
    echo ""
    echo "Please contact Airtel to obtain the Pre-Shared Key (PSK)"
    echo "Then run this script again."
    echo ""
    exit 1
fi

echo ""
echo "Please enter the Pre-Shared Key (PSK) from Airtel:"
read -s PSK

if [ -z "$PSK" ]; then
    echo -e "${RED}❌ PSK cannot be empty${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ PSK received${NC}"
echo ""

# Create temporary working directory
TEMP_DIR=$(mktemp -d)
echo "Working directory: $TEMP_DIR"
echo ""

# Copy configuration files
cp /workspace/ipsec.conf.airtel "$TEMP_DIR/ipsec.conf"
cp /workspace/ipsec.secrets.airtel "$TEMP_DIR/ipsec.secrets"

# Replace PSK in secrets file
sed -i "s/GET_PSK_FROM_AIRTEL/${PSK}/g" "$TEMP_DIR/ipsec.secrets"

echo "=== Configuration files prepared ==="
echo ""

# Create deployment script for VPS
cat > "$TEMP_DIR/install-vpn.sh" <<'EOFINSTALL'
#!/bin/bash
# VPN Installation Script (runs on VPS)
set -e

echo "=== Installing VPN on VPS ==="
echo ""

# Step 1: Update and install StrongSwan
echo "Step 1: Installing StrongSwan..."
apt update -qq
apt install -y strongswan strongswan-pki libcharon-extra-plugins libcharon-extauth-plugins libstrongswan-extra-plugins -qq
echo "✓ StrongSwan installed:"
ipsec version | head -1
echo ""

# Step 2: Enable IP forwarding
echo "Step 2: Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1 > /dev/null
sysctl -w net.ipv6.conf.all.forwarding=1 > /dev/null
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
grep -q "net.ipv6.conf.all.forwarding=1" /etc/sysctl.conf || echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf
sysctl -p > /dev/null
echo "✓ IP forwarding enabled"
echo ""

# Step 3: Configure firewall
echo "Step 3: Configuring firewall..."
ufw allow 500/udp comment 'IKE-IPSec' 2>/dev/null || true
ufw allow 4500/udp comment 'NAT-T-IPSec' 2>/dev/null || true
ufw --force reload 2>/dev/null || true
echo "✓ Firewall configured"
echo ""

# Step 4: Backup existing configs
echo "Step 4: Creating backups..."
mkdir -p /root/vpn-backup
if [ -f /etc/ipsec.conf ]; then
    cp /etc/ipsec.conf /root/vpn-backup/ipsec.conf.backup.$(date +%Y%m%d-%H%M%S)
fi
if [ -f /etc/ipsec.secrets ]; then
    cp /etc/ipsec.secrets /root/vpn-backup/ipsec.secrets.backup.$(date +%Y%m%d-%H%M%S)
fi
iptables-save > /root/vpn-backup/iptables.backup.$(date +%Y%m%d-%H%M%S)
ip route > /root/vpn-backup/routes.backup.$(date +%Y%m%d-%H%M%S)
echo "✓ Backups created in /root/vpn-backup/"
echo ""

# Step 5: Install configuration files
echo "Step 5: Installing IPSec configuration..."
if [ -f /tmp/ipsec.conf ]; then
    cp /tmp/ipsec.conf /etc/ipsec.conf
    echo "✓ /etc/ipsec.conf installed"
else
    echo "❌ Error: /tmp/ipsec.conf not found"
    exit 1
fi

if [ -f /tmp/ipsec.secrets ]; then
    cp /tmp/ipsec.secrets /etc/ipsec.secrets
    chmod 600 /etc/ipsec.secrets
    chown root:root /etc/ipsec.secrets
    echo "✓ /etc/ipsec.secrets installed (secure permissions)"
else
    echo "❌ Error: /tmp/ipsec.secrets not found"
    exit 1
fi
echo ""

# Step 6: Validate configuration
echo "Step 6: Validating configuration..."
ipsec checkconfig 2>&1 | head -10 || true
echo ""

# Step 7: Restart IPSec service
echo "Step 7: Restarting IPSec service..."
systemctl enable strongswan-starter 2>/dev/null || true
systemctl restart strongswan-starter
sleep 2
echo "✓ IPSec service restarted"
echo ""

# Step 8: Start VPN tunnel
echo "Step 8: Starting VPN tunnel..."
ipsec up airtel-ussd-s2s
sleep 3
echo ""

# Step 9: Check status
echo "Step 9: Checking VPN status..."
ipsec statusall | head -30
echo ""

# Step 10: Create monitoring script
echo "Step 10: Creating monitoring tools..."
cat > /root/check-vpn.sh <<'EOFMONITOR'
#!/bin/bash
echo "=== VPN STATUS CHECK ==="
echo ""
echo "Service Status:"
systemctl status strongswan-starter --no-pager | head -10
echo ""
echo "Tunnel Status:"
ipsec statusall | head -40
echo ""
echo "Active Connections:"
ipsec status
echo ""
echo "Recent Logs:"
tail -30 /var/log/syslog | grep -i "ipsec\|charon" || echo "No recent VPN logs"
echo ""
echo "=== END ==="
EOFMONITOR
chmod +x /root/check-vpn.sh

cat > /root/restart-vpn.sh <<'EOFRESTART'
#!/bin/bash
echo "Restarting VPN..."
ipsec restart
sleep 3
ipsec up airtel-ussd-s2s
sleep 2
echo ""
/root/check-vpn.sh
EOFRESTART
chmod +x /root/restart-vpn.sh

echo "✓ Monitoring scripts created:"
echo "  - /root/check-vpn.sh"
echo "  - /root/restart-vpn.sh"
echo ""

echo "=========================================="
echo "✅ VPN INSTALLATION COMPLETE!"
echo "=========================================="
echo ""
echo "VPN Configuration:"
echo "  Local IP:    37.60.252.211"
echo "  Remote IP:   41.78.57.35 (Airtel Malawi)"
echo "  IKE Version: IKEv2"
echo "  Encryption:  AES-256 + SHA-256"
echo "  DH Group:    Group 5 (modp1536)"
echo ""
echo "Monitoring:"
echo "  Check status: /root/check-vpn.sh"
echo "  Restart VPN:  /root/restart-vpn.sh"
echo "  Live logs:    tail -f /var/log/syslog | grep charon"
echo ""
echo "Next Steps:"
echo "  1. Verify tunnel is ESTABLISHED"
echo "  2. Test ping to Airtel's network"
echo "  3. Update USSD app IP whitelist"
echo "  4. Test USSD flow with Airtel"
echo ""
EOFINSTALL

chmod +x "$TEMP_DIR/install-vpn.sh"

echo "=== Deploying to VPS ==="
echo ""
echo "Please enter VPS root password when prompted:"
echo ""

# Upload files to VPS
scp "$TEMP_DIR/ipsec.conf" "${VPS_USER}@${VPS_HOST}:/tmp/"
scp "$TEMP_DIR/ipsec.secrets" "${VPS_USER}@${VPS_HOST}:/tmp/"
scp "$TEMP_DIR/install-vpn.sh" "${VPS_USER}@${VPS_HOST}:/tmp/"

echo ""
echo "✓ Files uploaded to VPS"
echo ""
echo "=== Running installation on VPS ==="
echo ""

# Run installation script on VPS
ssh "${VPS_USER}@${VPS_HOST}" "bash /tmp/install-vpn.sh"

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "VPN should now be running on your VPS"
echo ""
echo "To check VPN status:"
echo "  ssh root@${VPS_HOST}"
echo "  /root/check-vpn.sh"
echo ""
echo "To restart VPN if needed:"
echo "  /root/restart-vpn.sh"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

echo "Done!"
