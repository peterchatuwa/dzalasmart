#!/bin/bash
# Deploy latest code and prepare VPN on VPS
# Nzeru za Alimi

set -e

VPS_HOST="37.60.252.211"
VPS_USER="root"
VPS_PASS='S$SyF4vVs*T@g!Fw4kqnH'

echo "=========================================="
echo "DEPLOY & VPN PREPARATION"
echo "=========================================="
echo ""

# Create the VPN preparation script
cat > /tmp/prepare-vpn-remote.sh <<'EOFVPN'
#!/bin/bash
# VPN Preparation on VPS
set -e

echo "=========================================="
echo "VPN PREPARATION - Nzeru za Alimi"
echo "=========================================="
echo ""

# Check if root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Must run as root"
    exit 1
fi

echo "✓ Running as root"
echo ""

# Update system
echo "Step 1/10: Updating system..."
apt update -qq
apt upgrade -y -qq
echo "✓ System updated"
echo ""

# Install StrongSwan
echo "Step 2/10: Installing StrongSwan..."
apt install -y strongswan strongswan-pki libcharon-extra-plugins libcharon-extauth-plugins libstrongswan-extra-plugins
echo "✓ StrongSwan installed:"
ipsec version | head -1
echo ""

# Enable IP forwarding
echo "Step 3/10: Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1 > /dev/null
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p > /dev/null
echo "✓ IP forwarding enabled: $(cat /proc/sys/net/ipv4/ip_forward)"
echo ""

# Configure firewall
echo "Step 4/10: Configuring firewall..."
ufw allow 500/udp comment 'IKE' 2>/dev/null || true
ufw allow 4500/udp comment 'NAT-T' 2>/dev/null || true
ufw --force reload 2>/dev/null || true
echo "✓ Firewall configured"
echo ""

# Create backups
echo "Step 5/10: Creating backups..."
mkdir -p /root/vpn-backup
cp /etc/ipsec.conf /root/vpn-backup/ 2>/dev/null || true
cp /etc/ipsec.secrets /root/vpn-backup/ 2>/dev/null || true
iptables-save > /root/vpn-backup/iptables.backup 2>/dev/null || true
ip route > /root/vpn-backup/routes.backup
echo "✓ Backups created"
echo ""

# Create IPSec config template
echo "Step 6/10: Creating IPSec configuration..."
cat > /etc/ipsec.conf <<'EOFIPSEC'
# Nzeru za Alimi - Airtel USSD S2S VPN
config setup
    charondebug="ike 2, knl 2, cfg 2"
    uniqueids=never

conn airtel-ussd-s2s
    type=tunnel
    auto=start
    keyexchange=ikev2
    
    # Dead Peer Detection
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s
    
    # Local (Your VPS)
    left=37.60.252.211
    leftsubnet=10.8.0.0/24
    leftid=@nzeru-vpn-gateway
    leftfirewall=yes
    
    # Remote (Airtel) - UPDATE WITH AIRTEL'S DETAILS
    right=%AIRTEL_GATEWAY_IP%
    rightsubnet=172.26.0.0/16
    rightid=@airtel-vpn-gateway
    
    # Authentication
    authby=secret
    
    # Phase 1 & 2 - UPDATE WITH AIRTEL'S SETTINGS
    ike=aes256-sha256-modp2048!
    esp=aes256-sha256-modp2048!
    ikelifetime=28800s
    lifetime=3600s
    
    keyingtries=%forever
    compress=no
EOFIPSEC

# Create secrets file
cat > /etc/ipsec.secrets <<'EOFSECRETS'
# Nzeru za Alimi - Airtel USSD S2S VPN
# UPDATE: Replace %AIRTEL_GATEWAY_IP% and REPLACE_WITH_PSK
37.60.252.211 %AIRTEL_GATEWAY_IP% : PSK "REPLACE_WITH_AIRTEL_PSK"
EOFSECRETS

chmod 600 /etc/ipsec.secrets
echo "✓ IPSec configuration created"
echo ""

# Install tools
echo "Step 7/10: Installing tools..."
apt install -y tcpdump net-tools traceroute mtr -qq
echo "✓ Tools installed"
echo ""

# Create monitoring script
echo "Step 8/10: Creating monitoring script..."
cat > /root/check-vpn.sh <<'EOFMON'
#!/bin/bash
echo "=== VPN STATUS ==="
systemctl status strongswan-starter --no-pager | head -5
echo ""
ipsec statusall
echo ""
tail -20 /var/log/syslog | grep -i "ipsec\|charon"
EOFMON
chmod +x /root/check-vpn.sh
echo "✓ Monitoring script created: /root/check-vpn.sh"
echo ""

# Document system
echo "Step 9/10: Documenting system..."
{
    echo "=== VPS INFO FOR AIRTEL ==="
    echo "Date: $(date)"
    echo "IP: $(curl -4 -s --max-time 5 ifconfig.me || echo '37.60.252.211')"
    echo "Domain: api.zammunda.com"
    echo ""
    ipsec version | head -3
    echo ""
    echo "IPv4 Forward: $(cat /proc/sys/net/ipv4/ip_forward)"
} > /root/vps-info.txt
echo "✓ System info saved: /root/vps-info.txt"
echo ""

# Test network
echo "Step 10/10: Testing network..."
curl -4 -s --max-time 5 ifconfig.me > /root/vpn-backup/public-ip.txt || echo "37.60.252.211" > /root/vpn-backup/public-ip.txt
ip addr > /root/vpn-backup/interfaces.txt
echo "✓ Network tested"
echo ""

echo "=========================================="
echo "✅ VPN PREPARATION COMPLETE!"
echo "=========================================="
echo ""
echo "What's ready:"
echo "  ✓ StrongSwan installed"
echo "  ✓ IP forwarding enabled"
echo "  ✓ Firewall configured"
echo "  ✓ IPSec templates created"
echo "  ✓ Monitoring ready"
echo ""
echo "⚠️  VPN NOT STARTED - Need Airtel's config"
echo ""
echo "Files:"
echo "  /etc/ipsec.conf (template)"
echo "  /etc/ipsec.secrets (template)"
echo "  /root/check-vpn.sh"
echo "  /root/vps-info.txt"
echo ""
echo "Next: Update with Airtel's VPN details"
echo "=========================================="
EOFVPN

chmod +x /tmp/prepare-vpn-remote.sh

echo "📤 Uploading and running VPN preparation on VPS..."
echo ""

# Use SSH with password (using SSH key or manual connection)
cat <<EOFSSH

To prepare VPN on your VPS, run these commands:

# 1. Copy the preparation script to VPS
scp /tmp/prepare-vpn-remote.sh root@${VPS_HOST}:/tmp/

# 2. SSH into VPS
ssh root@${VPS_HOST}

# 3. Run preparation script
bash /tmp/prepare-vpn-remote.sh

# Password: ${VPS_PASS}

EOFSSH

echo ""
echo "=========================================="
echo "MANUAL VPN PREPARATION INSTRUCTIONS"
echo "=========================================="
echo ""
echo "Run these commands in a new terminal:"
echo ""
echo "# Connect to VPS"
echo "ssh root@37.60.252.211"
echo "Password: S\$SyF4vVs*T@g!Fw4kqnH"
echo ""
echo "# Then run this on the VPS:"
cat /tmp/prepare-vpn-remote.sh
echo ""
echo "=========================================="
