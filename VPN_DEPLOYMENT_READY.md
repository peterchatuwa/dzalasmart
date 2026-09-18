# ✅ VPN CONFIGURATION EXTRACTED & READY TO DEPLOY

**Date:** September 18, 2026  
**Status:** Configuration complete, ready for deployment  
**Source:** Airtel USSD VPN Excel document

---

## 🎉 SUCCESS - VPN Configuration Extracted!

I've successfully extracted Airtel's VPN configuration from the Excel document and prepared everything for deployment.

---

## 📊 AIRTEL VPN CONFIGURATION (EXTRACTED)

### **VPN Gateway Information:**
```
Airtel VPN Gateway IP:    41.78.57.35
Your VPS IP:               37.60.252.211
VPN Type:                  Site-to-Site IPSec with IKEv2
Airtel Platform:           Palo Alto PA-850
Your Platform:             StrongSwan (Linux IPSec)
```

### **Security Parameters:**
```
IKE Version:               IKEv2
Phase 1 Encryption:        AES-256
Phase 1 Hashing:           SHA-256
Phase 1 DH Group:          Group 5 (modp1536)
Phase 1 Lifetime:          28800 seconds (8 hours)

Phase 2 Encryption:        AES-256
Phase 2 Authentication:    ESP-SHA2-HMAC
Phase 2 DH Group:          Group 5 (modp1536)
Phase 2 Lifetime:          3600 seconds (1 hour)
Perfect Forward Secrecy:   Enabled
```

---

## 📁 FILES GENERATED

### **1. Configuration Files:**
- ✅ `ipsec.conf.airtel` - Complete IPSec configuration
- ✅ `ipsec.secrets.airtel` - PSK authentication file (template)
- ✅ `deploy-vpn-to-vps.sh` - Automated deployment script

### **2. Documentation:**
- ✅ `AIRTEL_VPN_CONFIG_EXTRACTED.md` - Full technical details
- ✅ `VPN_DEPLOYMENT_READY.md` - This file

---

## ⚠️ ONE CRITICAL PIECE MISSING

**Pre-Shared Key (PSK)** - The secret password for VPN authentication

**The Excel document did NOT contain the PSK.**

You must obtain it from Airtel before deploying.

---

## 🚀 DEPLOYMENT OPTIONS

### **OPTION 1: Automated Deployment (Recommended)** ⭐

**If you have the PSK from Airtel:**

```bash
cd /workspace
./deploy-vpn-to-vps.sh
```

The script will:
1. Ask you for the PSK
2. Install StrongSwan on VPS
3. Configure firewall
4. Deploy IPSec configuration
5. Start VPN tunnel
6. Verify connectivity

**Time:** ~5 minutes

---

### **OPTION 2: Manual Deployment**

**If you prefer manual control:**

1. **Get PSK from Airtel** (if you haven't already)

2. **SSH into VPS:**
   ```bash
   ssh root@37.60.252.211
   # Password: S$SyF4vVs*T@g!Fw4kqnH
   ```

3. **Install StrongSwan:**
   ```bash
   apt update && apt install -y strongswan strongswan-pki libcharon-extra-plugins
   ```

4. **Enable IP forwarding:**
   ```bash
   sysctl -w net.ipv4.ip_forward=1
   echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
   ```

5. **Configure firewall:**
   ```bash
   ufw allow 500/udp
   ufw allow 4500/udp
   ufw reload
   ```

6. **Copy configuration from workspace:**
   ```bash
   # On your local machine
   scp /workspace/ipsec.conf.airtel root@37.60.252.211:/etc/ipsec.conf
   scp /workspace/ipsec.secrets.airtel root@37.60.252.211:/etc/ipsec.secrets
   ```

7. **On VPS, update PSK:**
   ```bash
   nano /etc/ipsec.secrets
   # Replace "GET_PSK_FROM_AIRTEL" with actual PSK
   chmod 600 /etc/ipsec.secrets
   ```

8. **Start VPN:**
   ```bash
   ipsec restart
   ipsec up airtel-ussd-s2s
   ipsec statusall
   ```

---

## 📞 HOW TO GET PSK FROM AIRTEL

### **Email Template:**

```
Subject: Pre-Shared Key Request - S2S VPN Setup for USSD Integration

Dear Airtel Technical Team,

We have received and reviewed your S2S VPN configuration document.
All parameters have been extracted and we are ready to configure our
VPN endpoint.

To complete the setup, we need the Pre-Shared Key (PSK) for authentication.

Our VPN Configuration (Ready):
- Client Peer IP:       37.60.252.211
- Airtel Gateway IP:    41.78.57.35 (from your document)
- IKE Version:          IKEv2 (as specified)
- Encryption:           AES-256, SHA-256, DH Group 5 (as specified)
- VPN Software:         StrongSwan (compatible with Palo Alto)

Airtel Contact Info (from your document):
- OpCo: Airtel - Malawi
- Gateway IP: 41.78.57.35
- Model: PA-850

Please provide the Pre-Shared Key so we can:
1. Complete VPN configuration
2. Establish the tunnel
3. Begin USSD integration testing

Service Details:
- Service: Nzeru za Alimi (Smart Farming Platform)
- USSD Code: *384#
- API Endpoint: https://api.zammunda.com/ussd

Thank you for your support.

Best regards,
Peter Chatuwa
Technical Lead
Email: peter.chatuwa@zammunda.com
```

---

## ✅ VERIFICATION CHECKLIST

After VPN is deployed, verify:

```bash
# On VPS:
ssh root@37.60.252.211

# 1. Check VPN service is running
systemctl status strongswan-starter

# 2. Check tunnel status
ipsec statusall
# Look for: "ESTABLISHED" status

# 3. Test ping to Airtel
ping -c 4 41.78.57.35

# 4. Check VPN logs
tail -f /var/log/syslog | grep charon

# 5. Use monitoring script
/root/check-vpn.sh
```

**Success Indicators:**
- ✅ `ESTABLISHED` in ipsec status
- ✅ Can ping 41.78.57.35
- ✅ No errors in logs
- ✅ Security associations (SA) are up

---

## 🔧 AFTER VPN IS WORKING

### **Update USSD Application:**

**File:** `server/src/app.js`

Update IP whitelist to allow Airtel's internal network through VPN:

```javascript
// Allow traffic from VPN tunnel
const ALLOWED_AIRTEL_IPS = [
  '172.26.0.0/16',  // Airtel's internal network (through VPN)
  '10.8.0.0/24',    // VPN subnet (if needed)
];

// Or install ip-range-check package
// npm install ip-range-check
```

**Deploy updated code:**
```bash
ssh root@37.60.252.211
cd /opt/nzeru-za-alimi
git pull
cd server
npm install
pm2 restart nzeru-server
```

---

## 🧪 END-TO-END TESTING

**Coordinate with Airtel:**

1. **VPN Connectivity Test:**
   - Confirm both sides can ping through VPN
   - Verify tunnel is stable

2. **USSD Test Request:**
   - Airtel sends test USSD request through VPN
   - Verify your server receives it
   - Verify response goes back

3. **Full USSD Flow:**
   - Test dialing *384#
   - Test menu navigation
   - Test farmer registration
   - Test full workflows

---

## 📊 DEPLOYMENT STATUS

| Task | Status | Action |
|------|--------|--------|
| Extract VPN config | ✅ Done | None |
| Generate IPSec files | ✅ Done | None |
| Create deployment script | ✅ Done | None |
| Get PSK from Airtel | ⏳ Pending | Contact Airtel |
| Deploy VPN to VPS | ⏳ Ready | Run script after PSK |
| Start VPN tunnel | ⏳ Ready | Automatic |
| Test connectivity | ⏳ Waiting | After VPN starts |
| Update USSD app | ⏳ Waiting | After VPN works |
| End-to-end test | ⏳ Waiting | Coordinate with Airtel |

---

## 🎯 NEXT IMMEDIATE STEPS

### **1. Contact Airtel for PSK** ⭐ URGENT
- Use email template above
- Request Pre-Shared Key
- Confirm internal subnet (172.26.0.0/16)

### **2. Once You Have PSK:**
```bash
cd /workspace
./deploy-vpn-to-vps.sh
# Enter PSK when prompted
# Wait ~5 minutes for completion
```

### **3. Verify VPN is Working:**
```bash
ssh root@37.60.252.211
/root/check-vpn.sh
```

### **4. Update USSD App:**
```bash
# Update IP whitelist in server/src/app.js
# Deploy changes
# Restart app
```

### **5. Test with Airtel:**
```bash
# Coordinate USSD test
# Verify end-to-end flow
# Go live!
```

---

## 💡 KEY POINTS

### **What's Complete:**
- ✅ VPN configuration extracted from Airtel's document
- ✅ IPSec config files generated (ipsec.conf, ipsec.secrets)
- ✅ Deployment script ready
- ✅ Monitoring tools prepared
- ✅ All parameters verified against Airtel specs

### **What's Needed:**
- ⏳ Pre-Shared Key (PSK) from Airtel
- ⏳ Confirmation of Airtel's internal subnet
- ⏳ Coordination for testing

### **Estimated Time to Production:**
- Get PSK: 1-2 days (Airtel response time)
- Deploy VPN: 5 minutes
- Test connectivity: 10 minutes
- Update app: 5 minutes
- End-to-end test: 30 minutes
- **Total: ~1 hour of actual work + waiting for PSK**

---

## 📞 SUPPORT

**If VPN doesn't connect:**

1. Check PSK is correct (most common issue)
2. Verify firewall ports are open (500, 4500 UDP)
3. Check IP forwarding is enabled
4. Review logs: `tail -f /var/log/syslog | grep charon`
5. Verify Airtel's gateway IP is correct (41.78.57.35)

**Common Issues:**
- Wrong PSK → Tunnel won't establish
- Firewall blocking → No IKE packets
- Wrong encryption settings → Phase 1/2 mismatch
- IP forwarding disabled → Packets not routed

**Monitoring:**
- Tunnel status: `ipsec statusall`
- Live logs: `tail -f /var/log/syslog | grep charon`
- Restart VPN: `/root/restart-vpn.sh`

---

## 🎉 SUMMARY

**You're 95% ready!**

Everything is configured and ready to deploy. The only missing piece is the Pre-Shared Key (PSK) from Airtel.

**Once you get the PSK:**
1. Run deployment script (5 minutes)
2. VPN establishes automatically
3. Test and go live

**The hard work is done - just need that PSK!** 🚀

---

**Files Ready:**
- `/workspace/ipsec.conf.airtel` - IPSec configuration
- `/workspace/ipsec.secrets.airtel` - Authentication (needs PSK)
- `/workspace/deploy-vpn-to-vps.sh` - Deployment automation
- `/workspace/AIRTEL_VPN_CONFIG_EXTRACTED.md` - Full documentation

**Next Action:** Contact Airtel for PSK using email template above

---

**Last Updated:** September 18, 2026, 9:45 AM UTC  
**Status:** Ready to deploy, waiting for PSK from Airtel
