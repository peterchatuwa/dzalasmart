# INSTRUCTIONS: Deploy & VPN Setup

**Date:** September 18, 2026

---

## 📋 WHAT NEEDS TO BE DONE

### **1. Upload Airtel VPN Document**
### **2. Deploy Latest Code to VPS**
### **3. Prepare VPS for VPN**

---

## 📤 STEP 1: UPLOAD AIRTEL VPN DOCUMENT

You mentioned: `C:\Users\peter\Downloads\airtel ussd vpn.xlsx`

**Please upload this file to the workspace:**

1. In Cursor, drag and drop the file into the workspace
2. Or use File → Upload Files
3. Target location: `/workspace/` or `/workspace/uploads/`

Once uploaded, I can:
- Extract Airtel's VPN gateway IP
- Get the Pre-Shared Key (PSK)
- Extract encryption settings
- Auto-configure the VPN

---

## 🚀 STEP 2: DEPLOY LATEST CODE

**What's Ready to Deploy:**

Latest commits include:
- ✅ All 6 staff roles implemented
- ✅ Security gaps fixed (EPA scoping, loan approval)
- ✅ FUM exposure by district
- ✅ Food security predictive timeline
- ✅ Toast notification system
- ✅ Market price filtering by district

**Deploy Command:**

```bash
cd /workspace
./deploy.sh
```

**Or manually:**

```bash
ssh root@37.60.252.211
# Password: S$SyF4vVs*T@g!Fw4kqnH

cd /opt/nzeru-za-alimi
git pull origin cursor/comprehensive-improvements-7360
cd server
npm install
pm2 restart nzeru-server
pm2 logs --lines 50
```

---

## 🔧 STEP 3: PREPARE VPS FOR VPN

### **Option A: Automated (Recommended)**

I've created a script that you can run manually on the VPS:

```bash
# 1. SSH into your VPS
ssh root@37.60.252.211
# Password: S$SyF4vVs*T@g!Fw4kqnH

# 2. Copy and paste this entire script:
```

<details>
<summary>Click to expand VPN preparation script</summary>

```bash
#!/bin/bash
# VPN Preparation Script
set -e

echo "=== VPN PREPARATION START ==="

# Update system
apt update -qq && apt upgrade -y -qq
echo "✓ System updated"

# Install StrongSwan
apt install -y strongswan strongswan-pki libcharon-extra-plugins
echo "✓ StrongSwan installed:"
ipsec version | head -1

# Enable IP forwarding
sysctl -w net.ipv4.ip_forward=1 > /dev/null
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p > /dev/null
echo "✓ IP forwarding enabled"

# Configure firewall
ufw allow 500/udp comment 'IKE-VPN' 2>/dev/null || true
ufw allow 4500/udp comment 'NAT-T-VPN' 2>/dev/null || true
ufw reload 2>/dev/null || true
echo "✓ Firewall configured"

# Create backup directory
mkdir -p /root/vpn-backup
cp /etc/ipsec.conf /root/vpn-backup/ 2>/dev/null || true
iptables-save > /root/vpn-backup/iptables.backup 2>/dev/null || true
echo "✓ Backups created"

# Create IPSec config template
cat > /etc/ipsec.conf <<'EOF'
# Nzeru za Alimi - Airtel USSD S2S VPN
config setup
    charondebug="ike 2, knl 2, cfg 2"
    uniqueids=never

conn airtel-ussd-s2s
    type=tunnel
    auto=start
    keyexchange=ikev2
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s
    
    left=37.60.252.211
    leftsubnet=10.8.0.0/24
    leftid=@nzeru-vpn-gateway
    leftfirewall=yes
    
    right=%AIRTEL_GATEWAY_IP%
    rightsubnet=172.26.0.0/16
    rightid=@airtel-vpn-gateway
    
    authby=secret
    ike=aes256-sha256-modp2048!
    esp=aes256-sha256-modp2048!
    ikelifetime=28800s
    lifetime=3600s
    keyingtries=%forever
    compress=no
EOF

cat > /etc/ipsec.secrets <<'EOF'
# UPDATE WITH AIRTEL'S PSK
37.60.252.211 %AIRTEL_GATEWAY_IP% : PSK "REPLACE_WITH_AIRTEL_PSK"
EOF
chmod 600 /etc/ipsec.secrets
echo "✓ IPSec config created"

# Create monitoring script
cat > /root/check-vpn.sh <<'EOF'
#!/bin/bash
echo "=== VPN STATUS ==="
ipsec statusall
echo ""
tail -20 /var/log/syslog | grep -i "ipsec\|charon"
EOF
chmod +x /root/check-vpn.sh
echo "✓ Monitoring script: /root/check-vpn.sh"

# Document system
{
    echo "=== VPS INFO ==="
    echo "IP: $(curl -4 -s ifconfig.me)"
    echo "Domain: api.zammunda.com"
    ipsec version | head -3
} > /root/vps-info.txt
echo "✓ System info: /root/vps-info.txt"

echo "=== VPN PREPARATION COMPLETE ==="
echo ""
echo "Files created:"
echo "  /etc/ipsec.conf (template)"
echo "  /etc/ipsec.secrets (template)"
echo "  /root/check-vpn.sh"
echo ""
echo "⚠️  VPN not started - need Airtel's config"
```

</details>

### **Option B: Manual Step-by-Step**

If you prefer manual steps, connect to VPS and run:

```bash
ssh root@37.60.252.211

# Install VPN software
apt update && apt upgrade -y
apt install -y strongswan strongswan-pki libcharon-extra-plugins

# Enable IP forwarding
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

# Open firewall ports
ufw allow 500/udp comment 'IKE'
ufw allow 4500/udp comment 'NAT-T'
ufw reload

# Verify
ipsec version
cat /proc/sys/net/ipv4/ip_forward  # Should be 1
```

---

## ✅ VERIFICATION CHECKLIST

After running VPN preparation, verify:

```bash
# On VPS, check:
ipsec version                        # Should show StrongSwan version
cat /proc/sys/net/ipv4/ip_forward    # Should be 1
ufw status | grep -E "500|4500"      # Should show VPN ports
ls -l /etc/ipsec.conf                # Should exist
ls -l /etc/ipsec.secrets             # Should exist with 600 permissions
```

---

## 📄 NEXT STEPS AFTER VPN PREPARATION

Once VPN is prepared and you upload the Airtel VPN document:

1. ✅ I'll extract Airtel's VPN configuration
2. ✅ I'll update `/etc/ipsec.conf` with their settings
3. ✅ I'll update `/etc/ipsec.secrets` with their PSK
4. ✅ I'll start the VPN tunnel
5. ✅ I'll test connectivity
6. ✅ I'll update your USSD app IP whitelist

---

## 🚨 CURRENT STATUS

| Task | Status | Action Required |
|------|--------|-----------------|
| Latest code committed | ✅ Done | None |
| Deploy to VPS | ⏳ Pending | Run deploy script or manual deploy |
| VPN software installation | ⏳ Pending | Run VPN prep script on VPS |
| Airtel VPN document | ⏳ Pending | Upload `airtel ussd vpn.xlsx` |
| VPN configuration | ❌ Blocked | Need Airtel's document first |
| VPN tunnel start | ❌ Blocked | Need Airtel's config |
| USSD testing through VPN | ❌ Blocked | Need VPN running |

---

## 📞 SUMMARY

**What YOU need to do NOW:**

1. **Upload Airtel VPN document** (`airtel ussd vpn.xlsx`)
   - Drag and drop into Cursor workspace
   
2. **SSH into VPS and run VPN prep script**
   - Copy the script above
   - Paste in VPS terminal
   - Wait for completion (~5 minutes)

3. **Optionally: Deploy latest code**
   - Run `./deploy.sh` or manual commands above

**What I'll do AFTER you upload the document:**

1. Extract Airtel's VPN configuration
2. Generate final IPSec config files
3. Guide you through starting VPN
4. Test VPN connectivity
5. Update USSD application
6. Verify end-to-end USSD flow

---

**Ready? Upload the Airtel VPN document and let me know when VPN prep is done!**
