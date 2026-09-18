# VPN Setup Quick Guide for Airtel USSD Integration

## 🚨 CRITICAL: VPN is Required

**You cannot proceed with USSD integration without VPN.**

Airtel requires all USSD services to connect through a secure VPN tunnel, not direct internet HTTPS.

---

## ⚡ IMMEDIATE ACTION (TODAY)

### **Send Email to Airtel**

1. Open: `/workspace/EMAIL_TO_AIRTEL_VPN_REQUEST.txt`
2. Copy the email template
3. Add your phone number
4. Send to Airtel USSD integration team
5. CC your Airtel account manager

**What to ask for:**
- VPN protocol type (IPSec/OpenVPN/WireGuard)
- Airtel's VPN gateway IP address
- Pre-shared key or certificates
- Encryption settings
- Subnet configuration
- Setup guide

---

## 📋 WHAT HAPPENS NEXT

### **Week 1-2: Airtel Provides VPN Config**
- Airtel sends VPN configuration package
- You receive pre-shared keys or certificates
- Technical contact assigned

### **Week 2-3: VPN Implementation**
- Install VPN software on your VPS (37.60.252.211)
- Configure VPN tunnel to Airtel
- Set up routing rules
- Configure firewall

### **Week 3: Testing**
- Test VPN connectivity
- Verify USSD traffic routing
- End-to-end USSD testing through VPN
- Performance validation

### **Week 4: Production**
- Update PCR form with VPN details
- Submit final documentation to Airtel
- Go live with USSD service

---

## 🔧 TYPICAL VPN SETUP (After Receiving Airtel's Config)

### **Option 1: IPSec VPN (Most Common for Telecom)**

```bash
# Install StrongSwan
sudo apt update
sudo apt install strongswan strongswan-pki -y

# Configure with Airtel's settings
sudo nano /etc/ipsec.conf
sudo nano /etc/ipsec.secrets

# Start VPN
sudo systemctl enable strongswan-starter
sudo systemctl start strongswan-starter

# Check status
sudo ipsec status
```

### **Option 2: OpenVPN**

```bash
# Install OpenVPN
sudo apt update
sudo apt install openvpn -y

# Place Airtel's config file
sudo cp airtel.ovpn /etc/openvpn/client/

# Start VPN
sudo systemctl enable openvpn-client@airtel
sudo systemctl start openvpn-client@airtel

# Check status
sudo systemctl status openvpn-client@airtel
```

### **Option 3: WireGuard (Modern, Fast)**

```bash
# Install WireGuard
sudo apt update
sudo apt install wireguard -y

# Configure with Airtel's settings
sudo nano /etc/wireguard/wg0.conf

# Start VPN
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Check status
sudo wg show
```

---

## 🌐 NETWORK ARCHITECTURE AFTER VPN

### **Before (Current - NOT ALLOWED):**
```
[Airtel Gateway] → Internet → [Your VPS:443]
```

### **After (Required):**
```
[Airtel Gateway] → VPN Tunnel (Encrypted) → [Your VPS] → [USSD App]
```

---

## ✅ FIREWALL CHANGES NEEDED

After VPN is set up, update firewall:

```bash
# Allow VPN protocols
sudo ufw allow 500/udp    # IKE (IPSec)
sudo ufw allow 4500/udp   # NAT-T (IPSec)
sudo ufw allow 1194/udp   # OpenVPN (if used)
sudo ufw allow 51820/udp  # WireGuard (if used)

# Reload firewall
sudo ufw reload
```

---

## 🧪 TESTING VPN CONNECTIVITY

After VPN is established:

```bash
# 1. Check VPN interface is up
ip addr show

# 2. Check VPN routes
ip route show

# 3. Ping Airtel's gateway through VPN
ping <airtel-vpn-gateway-ip>

# 4. Check VPN status
# (depends on VPN type - see commands above)

# 5. Test USSD endpoint accessibility
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test&serviceCode=*413#&phoneNumber=+265888000001&text="
```

---

## 📝 APPLICATION CHANGES (MINIMAL)

**Good news:** Your USSD application code likely needs **NO changes**.

VPN operates at the network layer, so your Express.js app continues working as-is.

**Only change needed:** Update IP whitelist in `server/src/app.js`

```javascript
// Before (current - direct internet)
const ALLOWED_AIRTEL_IPS = [
  '172.26.166.100', '172.26.166.101', // etc.
];

// After (with VPN)
const ALLOWED_AIRTEL_IPS = [
  '10.0.0.0/24',      // VPN subnet
  '172.26.0.0/16',    // Airtel's internal network
];
```

---

## ⏱️ ESTIMATED TIMELINE

| Task | Duration |
|------|----------|
| Email Airtel for VPN config | 1 day (TODAY) |
| Wait for Airtel response | 3-7 days |
| VPN setup on VPS | 1-2 days |
| Testing & troubleshooting | 2-3 days |
| Production deployment | 1 day |
| **TOTAL** | **8-14 days** |

---

## 🎯 SUCCESS CRITERIA

VPN setup is complete when:

✅ VPN tunnel is established  
✅ You can ping Airtel's gateway through VPN  
✅ Airtel can ping your server through VPN  
✅ USSD test request works through VPN  
✅ Firewall rules are configured  
✅ Routing is working correctly  
✅ No packet loss or connectivity issues  

---

## 📞 SUPPORT

After receiving VPN config from Airtel, I can help you with:
- Installing VPN software
- Configuring VPN tunnel
- Troubleshooting connectivity issues
- Testing and validation
- Updating PCR form

---

## 🚀 QUICK START CHECKLIST

- [ ] Send email to Airtel (use template)
- [ ] Wait for VPN configuration package
- [ ] Backup your current VPS configuration
- [ ] Review Airtel's VPN requirements
- [ ] Install VPN software
- [ ] Configure VPN tunnel
- [ ] Update firewall rules
- [ ] Test connectivity
- [ ] Update USSD app IP whitelist
- [ ] Perform end-to-end testing
- [ ] Update and submit PCR form
- [ ] Go live!

---

**Current Status:** Waiting for VPN configuration from Airtel  
**Next Step:** Send email request to Airtel (use template in EMAIL_TO_AIRTEL_VPN_REQUEST.txt)  
**Blocker:** Cannot proceed until Airtel provides VPN details

---

**Files:**
- Full options: `/workspace/AIRTEL_VPN_OPTIONS.md`
- Email template: `/workspace/EMAIL_TO_AIRTEL_VPN_REQUEST.txt`
- This guide: `/workspace/VPN_SETUP_QUICK_GUIDE.md`
