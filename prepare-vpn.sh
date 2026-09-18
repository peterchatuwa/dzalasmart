#!/bin/bash
# VPN Preparation Script
# Prepares VPS for Airtel S2S VPN setup (while waiting for Airtel's config)

set -e

echo "=========================================="
echo "VPN PREPARATION SCRIPT"
echo "Nzeru za Alimi - Airtel USSD S2S VPN"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

echo "✓ Running as root"
echo ""

# Step 1: Update system
echo "Step 1/10: Updating system..."
apt update -qq && apt upgrade -y -qq
echo "✓ System updated"
echo ""

# Step 2: Install StrongSwan
echo "Step 2/10: Installing StrongSwan..."
apt install -y strongswan strongswan-pki libcharon-extra-plugins libcharon-extauth-plugins libstrongswan-extra-plugins
echo "✓ StrongSwan installed"
ipsec version
echo ""

# Step 3: Enable IP forwarding
echo "Step 3/10: Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1 > /dev/null
sysctl -w net.ipv6.conf.all.forwarding=1 > /dev/null
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
grep -q "net.ipv6.conf.all.forwarding=1" /etc/sysctl.conf || echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf
sysctl -p > /dev/null
echo "✓ IP forwarding enabled"
echo "  IPv4: $(cat /proc/sys/net/ipv4/ip_forward)"
echo "  IPv6: $(cat /proc/sys/net/ipv6/conf/all/forwarding)"
echo ""

# Step 4: Configure firewall
echo "Step 4/10: Configuring firewall..."
ufw allow 500/udp comment 'IKE - VPN' > /dev/null
ufw allow 4500/udp comment 'NAT-T - VPN' > /dev/null
ufw allow 1194/udp comment 'OpenVPN - VPN' > /dev/null
ufw reload > /dev/null
echo "✓ Firewall configured"
echo ""

# Step 5: Create backup directory
echo "Step 5/10: Creating backups..."
mkdir -p /root/vpn-backup
cp /etc/ipsec.conf /root/vpn-backup/ipsec.conf.backup 2>/dev/null || true
cp /etc/ipsec.secrets /root/vpn-backup/ipsec.secrets.backup 2>/dev/null || true
iptables-save > /root/vpn-backup/iptables.backup
ip route show > /root/vpn-backup/routes.backup
echo "✓ Backups created in /root/vpn-backup/"
echo ""

# Step 6: Create template config files
echo "Step 6/10: Creating configuration templates..."

# ipsec.conf template
cat > /etc/ipsec.conf <<'EOF'
# ipsec.conf - strongSwan IPsec configuration file
# Nzeru za Alimi - Airtel USSD S2S VPN

config setup
    charondebug="ike 2, knl 2, cfg 2, net 2, esp 2, dmn 2, mgr 2"
    uniqueids=never
    strictcrlpolicy=no

# Connection to Airtel USSD Gateway
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
    
    # Remote (Airtel) - FILL IN FROM AIRTEL
    right=%AIRTEL_GATEWAY_IP%
    rightsubnet=172.26.0.0/16
    rightid=@airtel-vpn-gateway
    
    # Authentication
    authby=secret
    
    # Phase 1 (IKE) - MATCH AIRTEL'S SETTINGS
    ike=aes256-sha256-modp2048!
    ikelifetime=28800s
    
    # Phase 2 (ESP) - MATCH AIRTEL'S SETTINGS
    esp=aes256-sha256-modp2048!
    lifetime=3600s
    
    keyingtries=%forever
    compress=no
    rekey=yes
    margintime=540s
EOF

# ipsec.secrets template
cat > /etc/ipsec.secrets <<'EOF'
# ipsec.secrets - strongSwan IPsec secrets file
# Nzeru za Alimi - Airtel USSD S2S VPN

# Pre-Shared Key - REPLACE WITH AIRTEL'S PSK
37.60.252.211 %AIRTEL_GATEWAY_IP% : PSK "REPLACE_WITH_AIRTEL_PSK"
EOF

chmod 600 /etc/ipsec.secrets
chown root:root /etc/ipsec.secrets

echo "✓ Configuration templates created"
echo "  - /etc/ipsec.conf (template)"
echo "  - /etc/ipsec.secrets (template, secure permissions)"
echo ""

# Step 7: Install debugging tools
echo "Step 7/10: Installing debugging tools..."
apt install -y tcpdump net-tools traceroute mtr iperf3 nmap wireshark-common tshark -qq
echo "✓ Debugging tools installed"
echo ""

# Step 8: Create VPN status check script
echo "Step 8/10: Creating VPN monitoring script..."
cat > /root/check-vpn-status.sh <<'EOFSCRIPT'
#!/bin/bash
echo "=========================================="
echo "VPN STATUS CHECK"
echo "=========================================="
echo ""
echo "1. IPSec Service:"
systemctl status strongswan-starter --no-pager | head -10
echo ""
echo "2. VPN Tunnel Status:"
ipsec statusall
echo ""
echo "3. Recent Logs:"
tail -20 /var/log/syslog | grep -i "ipsec\|charon"
echo ""
echo "=========================================="
EOFSCRIPT
chmod +x /root/check-vpn-status.sh
echo "✓ Monitoring script created: /root/check-vpn-status.sh"
echo ""

# Step 9: Document system info
echo "Step 9/10: Documenting system information..."
{
    echo "=== SYSTEM INFO FOR AIRTEL VPN ==="
    echo "Generated: $(date)"
    echo ""
    echo "Public IP: $(curl -4 -s ifconfig.me)"
    echo "Hostname: $(hostname)"
    echo "Domain: api.zammunda.com"
    echo ""
    echo "OS: $(lsb_release -d | cut -f2)"
    echo "Kernel: $(uname -r)"
    echo ""
    echo "StrongSwan Version:"
    ipsec version
    echo ""
    echo "IPv4 Forwarding: $(cat /proc/sys/net/ipv4/ip_forward)"
    echo ""
} > /root/system-info-for-airtel.txt
echo "✓ System info saved: /root/system-info-for-airtel.txt"
echo ""

# Step 10: Document network config
echo "Step 10/10: Documenting network configuration..."
{
    echo "=== NETWORK CONFIG BEFORE VPN ==="
    echo "Generated: $(date)"
    echo ""
    echo "=== Public IP ==="
    curl -4 -s ifconfig.me
    echo ""
    echo ""
    echo "=== Interfaces ==="
    ip addr show
    echo ""
    echo "=== Routes ==="
    ip route show
    echo ""
    echo "=== Firewall ==="
    ufw status verbose
} > /root/vpn-backup/network-config-before-vpn.txt
echo "✓ Network config saved: /root/vpn-backup/network-config-before-vpn.txt"
echo ""

# Summary
echo "=========================================="
echo "✅ VPN PREPARATION COMPLETE!"
echo "=========================================="
echo ""
echo "What's been done:"
echo "  ✓ StrongSwan installed"
echo "  ✓ IP forwarding enabled"
echo "  ✓ Firewall configured"
echo "  ✓ Configuration templates created"
echo "  ✓ Backups created"
echo "  ✓ Debugging tools installed"
echo "  ✓ Monitoring script created"
echo "  ✓ System info documented"
echo ""
echo "⚠️  IMPORTANT: VPN CANNOT START YET"
echo ""
echo "You still need from Airtel:"
echo "  • VPN Gateway IP address"
echo "  • Pre-Shared Key (PSK)"
echo "  • IKE/IPSec encryption settings"
echo "  • Subnet configuration"
echo ""
echo "Next steps:"
echo "  1. Send email to Airtel (see EMAIL_TO_AIRTEL_S2S_VPN_REQUEST.txt)"
echo "  2. Wait for Airtel's VPN configuration"
echo "  3. Update /etc/ipsec.conf with Airtel's settings"
echo "  4. Update /etc/ipsec.secrets with Airtel's PSK"
echo "  5. Run: sudo ipsec restart"
echo "  6. Run: sudo ipsec up airtel-ussd-s2s"
echo "  7. Check status: /root/check-vpn-status.sh"
echo ""
echo "Files created:"
echo "  • /etc/ipsec.conf (template)"
echo "  • /etc/ipsec.secrets (template)"
echo "  • /root/check-vpn-status.sh (monitoring)"
echo "  • /root/system-info-for-airtel.txt"
echo "  • /root/vpn-backup/ (backups)"
echo ""
echo "=========================================="
