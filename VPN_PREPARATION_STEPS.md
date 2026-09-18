# VPN PREPARATION STEPS (While Waiting for Airtel)

**Status:** Preparing VPS for S2S VPN setup  
**Can proceed:** Without Airtel's config (preparation only)  
**Cannot proceed:** Actual VPN connection (need Airtel's details)

---

## ✅ WHAT YOU CAN DO NOW (Before Airtel Responds)

### **STEP 1: Install VPN Software**

Install StrongSwan (IPSec VPN software) - most likely what Airtel uses:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install StrongSwan and dependencies
sudo apt install strongswan strongswan-pki libcharon-extra-plugins libcharon-extauth-plugins libstrongswan-extra-plugins -y

# Verify installation
ipsec version

# Check if service is running
sudo systemctl status strongswan-starter
```

---

### **STEP 2: Enable IP Forwarding**

Required for VPN to route traffic:

```bash
# Enable IP forwarding temporarily
sudo sysctl -w net.ipv4.ip_forward=1
sudo sysctl -w net.ipv6.conf.all.forwarding=1

# Make it permanent
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p

# Verify
cat /proc/sys/net/ipv4/ip_forward
# Should output: 1
```

---

### **STEP 3: Configure Firewall (UFW)**

Open VPN ports preemptively:

```bash
# Allow IPSec VPN ports
sudo ufw allow 500/udp comment 'IKE - VPN'
sudo ufw allow 4500/udp comment 'NAT-T - VPN'
sudo ufw allow esp comment 'ESP - VPN'

# Allow OpenVPN (just in case Airtel uses it)
sudo ufw allow 1194/udp comment 'OpenVPN - VPN'

# Reload firewall
sudo ufw reload

# Check rules
sudo ufw status numbered
```

---

### **STEP 4: Backup Current Configuration**

Backup your current network config before making changes:

```bash
# Create backup directory
mkdir -p ~/vpn-backup

# Backup network configuration
sudo cp /etc/network/interfaces ~/vpn-backup/interfaces.backup
sudo cp /etc/netplan/* ~/vpn-backup/ 2>/dev/null || true

# Backup firewall rules
sudo iptables-save > ~/vpn-backup/iptables.backup
sudo ufw status numbered > ~/vpn-backup/ufw.backup

# Backup current IPSec config (if any)
sudo cp /etc/ipsec.conf ~/vpn-backup/ipsec.conf.backup 2>/dev/null || true
sudo cp /etc/ipsec.secrets ~/vpn-backup/ipsec.secrets.backup 2>/dev/null || true

# Backup routing table
ip route show > ~/vpn-backup/routes.backup

# List all backups
ls -lh ~/vpn-backup/
```

---

### **STEP 5: Prepare Configuration Templates**

Create template files ready to fill in when Airtel provides details:

#### **Template: `/etc/ipsec.conf`**

```bash
# Create template
sudo tee /etc/ipsec.conf > /dev/null <<'EOF'
# ipsec.conf - strongSwan IPsec configuration file
# Nzeru za Alimi - Airtel USSD S2S VPN

config setup
    charondebug="ike 2, knl 2, cfg 2, net 2, esp 2, dmn 2, mgr 2"
    uniqueids=never
    strictcrlpolicy=no

# Connection to Airtel USSD Gateway
conn airtel-ussd-s2s
    # Connection type
    type=tunnel
    auto=start
    
    # Key Exchange
    keyexchange=ikev2
    # TODO: Change to ikev1 if Airtel specifies IKEv1
    
    # Dead Peer Detection
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s
    
    # Local (Your VPS) settings
    left=37.60.252.211                          # Your public IP
    leftsubnet=10.8.0.0/24                      # Your VPN subnet (may change)
    leftid=@nzeru-vpn-gateway                   # Your VPN ID
    leftfirewall=yes
    
    # Remote (Airtel) settings - FILL IN FROM AIRTEL
    right=%AIRTEL_GATEWAY_IP%                   # TODO: Get from Airtel
    rightsubnet=172.26.0.0/16                   # Airtel's subnet
    rightid=@airtel-vpn-gateway                 # TODO: Confirm with Airtel
    
    # Authentication
    authby=secret                               # Using PSK
    # TODO: Change to 'pubkey' if using certificates
    
    # Phase 1 (IKE) - MATCH AIRTEL'S SETTINGS
    ike=aes256-sha256-modp2048!                # TODO: Confirm with Airtel
    ikelifetime=28800s                         # TODO: Confirm with Airtel
    
    # Phase 2 (ESP) - MATCH AIRTEL'S SETTINGS
    esp=aes256-sha256-modp2048!                # TODO: Confirm with Airtel
    lifetime=3600s                             # TODO: Confirm with Airtel
    
    # Keepalive
    keyingtries=%forever
    
    # Compression
    compress=no
    
    # Rekeying
    rekey=yes
    margintime=540s
    
    # Perfect Forward Secrecy
    # pfs=yes
EOF

echo "✓ Template created: /etc/ipsec.conf"
```

#### **Template: `/etc/ipsec.secrets`**

```bash
# Create template (secure permissions)
sudo tee /etc/ipsec.secrets > /dev/null <<'EOF'
# ipsec.secrets - strongSwan IPsec secrets file
# Nzeru za Alimi - Airtel USSD S2S VPN

# Pre-Shared Key authentication
# TODO: Replace with actual PSK from Airtel
37.60.252.211 %AIRTEL_GATEWAY_IP% : PSK "REPLACE_WITH_AIRTEL_PSK"

# OR if using VPN IDs:
# @nzeru-vpn-gateway @airtel-vpn-gateway : PSK "REPLACE_WITH_AIRTEL_PSK"
EOF

# Secure the secrets file
sudo chmod 600 /etc/ipsec.secrets
sudo chown root:root /etc/ipsec.secrets

echo "✓ Template created: /etc/ipsec.secrets (secure permissions)"
```

---

### **STEP 6: Test Current Network Setup**

Document your current network configuration:

```bash
# Public IP verification
echo "=== PUBLIC IP ==="
curl -4 ifconfig.me
echo ""

# Network interfaces
echo "=== NETWORK INTERFACES ==="
ip addr show

# Routing table
echo "=== ROUTING TABLE ==="
ip route show

# DNS configuration
echo "=== DNS ==="
cat /etc/resolv.conf

# Firewall status
echo "=== FIREWALL ==="
sudo ufw status verbose

# IPTables rules
echo "=== IPTABLES ==="
sudo iptables -L -n -v

# Save to file
{
    echo "=== Network Configuration Report ==="
    echo "Generated: $(date)"
    echo ""
    echo "=== PUBLIC IP ==="
    curl -4 ifconfig.me
    echo ""
    echo "=== NETWORK INTERFACES ==="
    ip addr show
    echo ""
    echo "=== ROUTING TABLE ==="
    ip route show
    echo ""
    echo "=== DNS ==="
    cat /etc/resolv.conf
    echo ""
    echo "=== FIREWALL ==="
    sudo ufw status verbose
} > ~/vpn-backup/network-config-before-vpn.txt

echo "✓ Network configuration saved to ~/vpn-backup/network-config-before-vpn.txt"
```

---

### **STEP 7: Install Helpful VPN Debugging Tools**

```bash
# Install network debugging tools
sudo apt install -y \
    tcpdump \
    net-tools \
    traceroute \
    mtr \
    iperf3 \
    nmap \
    wireshark-common \
    tshark

# Verify installations
which tcpdump
which traceroute
which mtr
```

---

### **STEP 8: Create VPN Status Check Script**

Useful for monitoring VPN after setup:

```bash
# Create monitoring script
cat > ~/check-vpn-status.sh <<'EOF'
#!/bin/bash
# VPN Status Check Script
# Run this after VPN is configured to check status

echo "=========================================="
echo "VPN STATUS CHECK"
echo "=========================================="
echo ""

echo "1. IPSec Service Status:"
sudo systemctl status strongswan-starter --no-pager
echo ""

echo "2. IPSec Connections:"
sudo ipsec statusall
echo ""

echo "3. VPN Tunnel Status:"
sudo ipsec status
echo ""

echo "4. Security Associations:"
sudo ip xfrm state
echo ""

echo "5. VPN Policies:"
sudo ip xfrm policy
echo ""

echo "6. Network Interfaces:"
ip addr show | grep -E "ipsec|tun|vpn" || echo "No VPN interfaces found"
echo ""

echo "7. Routing Table:"
ip route show
echo ""

echo "8. Recent VPN Logs (last 20 lines):"
sudo tail -20 /var/log/syslog | grep -i "ipsec\|charon\|vpn"
echo ""

echo "=========================================="
echo "END OF VPN STATUS CHECK"
echo "=========================================="
EOF

# Make executable
chmod +x ~/check-vpn-status.sh

echo "✓ VPN status check script created: ~/check-vpn-status.sh"
echo "  Run with: ~/check-vpn-status.sh"
```

---

### **STEP 9: Document System Information**

Information useful for troubleshooting with Airtel:

```bash
# Create system info report
{
    echo "=== SYSTEM INFORMATION FOR AIRTEL VPN SETUP ==="
    echo "Generated: $(date)"
    echo ""
    echo "=== SERVER DETAILS ==="
    echo "Public IP: $(curl -4 -s ifconfig.me)"
    echo "Hostname: $(hostname)"
    echo "Domain: api.zammunda.com"
    echo ""
    echo "=== OS INFORMATION ==="
    uname -a
    lsb_release -a
    echo ""
    echo "=== STRONGSWAN VERSION ==="
    ipsec version
    echo ""
    echo "=== NETWORK CAPABILITIES ==="
    echo "IPv4 Forwarding: $(cat /proc/sys/net/ipv4/ip_forward)"
    echo "IPv6 Forwarding: $(cat /proc/sys/net/ipv6/conf/all/forwarding)"
    echo ""
    echo "=== FIREWALL STATUS ==="
    sudo ufw status verbose
    echo ""
    echo "=== AVAILABLE ENCRYPTION ==="
    ipsec listciphers
    echo ""
} > ~/system-info-for-airtel.txt

echo "✓ System information saved to ~/system-info-for-airtel.txt"
```

---

### **STEP 10: Review USSD Application Configuration**

Check what needs updating after VPN is established:

```bash
# Check current USSD IP whitelist
echo "Current USSD IP whitelist configuration:"
grep -A 20 "ALLOWED_AIRTEL_IPS" server/src/app.js || echo "Not found"
```

**Note:** After VPN is set up, update this to allow traffic from `172.26.0.0/16`

---

## 📋 PREPARATION CHECKLIST

After completing the above steps, verify:

- [ ] StrongSwan installed and version confirmed
- [ ] IP forwarding enabled (permanent)
- [ ] Firewall ports opened for VPN
- [ ] Configuration backups created
- [ ] Template config files created
- [ ] Network status documented
- [ ] Debugging tools installed
- [ ] Monitoring script created
- [ ] System info documented for Airtel
- [ ] USSD app IP whitelist reviewed

---

## 🚫 WHAT YOU CANNOT DO YET

Until Airtel provides their configuration, you **CANNOT**:

- ❌ Start the VPN tunnel (no destination to connect to)
- ❌ Test VPN connectivity (tunnel doesn't exist)
- ❌ Finalize `/etc/ipsec.conf` (missing Airtel's IP, PSK, encryption)
- ❌ Test USSD through VPN (no VPN connection)
- ❌ Fill in the PSK in `/etc/ipsec.secrets` (Airtel hasn't provided)

---

## ✅ NEXT STEPS AFTER AIRTEL RESPONDS

Once Airtel provides:
1. **VPN Gateway IP** → Update `right=` in `/etc/ipsec.conf`
2. **Pre-Shared Key** → Update `/etc/ipsec.secrets`
3. **IKE/IPSec settings** → Update `ike=` and `esp=` in `/etc/ipsec.conf`
4. **Subnet details** → Update `leftsubnet=` and `rightsubnet=`

Then:
```bash
# Restart IPSec
sudo ipsec restart

# Start the tunnel
sudo ipsec up airtel-ussd-s2s

# Check status
sudo ipsec status

# Monitor logs
sudo tail -f /var/log/syslog | grep charon
```

---

## 🎯 SUMMARY

**What you can do now:**
- ✅ Install VPN software (StrongSwan)
- ✅ Configure system prerequisites (IP forwarding, firewall)
- ✅ Create configuration templates
- ✅ Prepare monitoring tools
- ✅ Document current setup

**What requires Airtel:**
- ❌ Actual VPN configuration (their gateway IP, PSK, encryption)
- ❌ Starting the VPN tunnel
- ❌ Testing connectivity

**Result:** Your VPS is **ready** for VPN setup, but tunnel **cannot connect** until Airtel configures their side and provides you the details.

---

**Current Status:** VPS prepared, waiting for Airtel's S2S VPN configuration  
**Blocker:** Need Airtel's gateway IP, PSK, and encryption settings  
**Action Required:** Send email to Airtel (already prepared in `/workspace/EMAIL_TO_AIRTEL_S2S_VPN_REQUEST.txt`)
