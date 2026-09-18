# AIRTEL USSD VPN CONFIGURATION - EXTRACTED

**Source:** airtel_ussd_vpn_b397.xlsx  
**Date Extracted:** September 18, 2026

---

## 🔑 CRITICAL VPN PARAMETERS

### **Airtel's VPN Gateway**
```
VPN Peer IP Address (Airtel): 41.78.57.35
VPN Concentrator Vendor:       Palo Alto
VPN Concentrator Model:        Palo Alto PA-850
```

### **Your Configuration (Client Side)**
```
VPN Peer IP Address (Client):  37.60.252.211 (your VPS)
VPN Concentrator Vendor:       StrongSwan (Linux IPSec)
VPN Concentrator Model:        Software-based
```

---

## 🔐 PHASE 1 (IKE) PARAMETERS

| Parameter | Value |
|-----------|-------|
| **IKE Version** | IKEv2 |
| **Hashing Algorithm** | SHA2 (SHA-256) |
| **Encryption** | AES-256 |
| **Authentication** | Pre-Shared Key (PSK) |
| **Diffie-Hellman Group** | Group 5 (modp1536) |
| **IKE SA Lifetime** | 28800 seconds (8 hours) |

**StrongSwan Format:**
```
ike=aes256-sha256-modp1536!
ikelifetime=28800s
```

---

## 🔐 PHASE 2 (IPSEC) PARAMETERS

| Parameter | Value |
|-----------|-------|
| **Encryption** | AES-256 |
| **Authentication** | ESP-SHA2-HMAC (SHA-256) |
| **Perfect Forward Secrecy** | Enabled |
| **Diffie-Hellman Group** | Group 5 (modp1536) |
| **IPSec SA Lifetime** | 3600 seconds (1 hour) |
| **Transform Set** | esp-aes esp-sha2-hmac |

**StrongSwan Format:**
```
esp=aes256-sha256-modp1536!
lifetime=3600s
```

---

## ⚠️ MISSING INFORMATION

**Not provided in document:**
- ❌ Pre-Shared Key (PSK) - **YOU MUST GET THIS FROM AIRTEL**
- ❌ VPN Subnet Configuration (leftsubnet/rightsubnet)
- ❌ VPN Host IP addresses (Airtel's internal USSD gateway IPs)

**Action Required:**
Contact Airtel to obtain:
1. The actual Pre-Shared Key (PSK) - secret password
2. Airtel's internal subnet (likely 172.26.0.0/16 based on earlier info)
3. Specific USSD gateway IPs that will access your server

---

## 📊 NETWORK CONFIGURATION

### **Assumed Configuration:**
```
Your Side (Local):
- Public IP:      37.60.252.211
- VPN Subnet:     10.8.0.0/24
- VPN ID:         @nzeru-vpn-gateway

Airtel Side (Remote):
- Public IP:      41.78.57.35
- VPN Subnet:     172.26.0.0/16 (assumed from earlier info)
- VPN ID:         @airtel-vpn-gateway
```

---

## 🔧 IPSEC CONFIGURATION FILES

### **File: `/etc/ipsec.conf`**

```bash
# Nzeru za Alimi - Airtel USSD S2S VPN
# Configuration extracted from Airtel's VPN form

config setup
    charondebug="ike 2, knl 2, cfg 2"
    uniqueids=never
    strictcrlpolicy=no

conn airtel-ussd-s2s
    # Connection type
    type=tunnel
    auto=start
    
    # IKE Version (from Airtel specs)
    keyexchange=ikev2
    
    # Dead Peer Detection
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s
    
    # Local (Your VPS) Configuration
    left=37.60.252.211
    leftsubnet=10.8.0.0/24
    leftid=@nzeru-vpn-gateway
    leftfirewall=yes
    
    # Remote (Airtel) Configuration
    right=41.78.57.35
    rightsubnet=172.26.0.0/16
    rightid=@airtel-vpn-gateway
    
    # Authentication Method (from Airtel specs)
    authby=secret
    
    # Phase 1 (IKE) Settings (from Airtel specs)
    # IKEv2 | AES-256 | SHA2-256 | DH Group 5 | 28800s lifetime
    ike=aes256-sha256-modp1536!
    ikelifetime=28800s
    
    # Phase 2 (ESP) Settings (from Airtel specs)
    # AES-256 | ESP-SHA2-HMAC | DH Group 5 | 3600s lifetime
    esp=aes256-sha256-modp1536!
    lifetime=3600s
    
    # Perfect Forward Secrecy (from Airtel specs)
    # PFS Enabled with Group 5
    
    # Connection Settings
    keyingtries=%forever
    compress=no
    rekey=yes
    margintime=540s
```

### **File: `/etc/ipsec.secrets`**

```bash
# Nzeru za Alimi - Airtel USSD S2S VPN
# Pre-Shared Key Configuration

# TODO: REPLACE "YOUR_PSK_FROM_AIRTEL" WITH ACTUAL PSK
37.60.252.211 41.78.57.35 : PSK "YOUR_PSK_FROM_AIRTEL"

# Alternative format (using VPN IDs):
# @nzeru-vpn-gateway @airtel-vpn-gateway : PSK "YOUR_PSK_FROM_AIRTEL"
```

---

## 📝 TECHNICAL SUMMARY

### **Airtel's VPN Setup:**
- **Platform:** Palo Alto Networks firewall (PA-850)
- **Location:** Malawi
- **Public IP:** 41.78.57.35
- **VPN Type:** Site-to-Site IPSec with IKEv2
- **Security Level:** Enterprise-grade (AES-256, SHA-256, DH Group 5)

### **Your VPN Setup:**
- **Platform:** StrongSwan (Open-source IPSec)
- **Location:** VPS (37.60.252.211)
- **Public IP:** 37.60.252.211
- **VPN Type:** Site-to-Site IPSec with IKEv2
- **Compatibility:** Fully compatible with Palo Alto

### **Encryption Strength:**
- **Encryption:** AES-256 (Very Strong)
- **Hashing:** SHA-256 (Very Strong)
- **Key Exchange:** DH Group 5 / modp1536 (Strong)
- **IKE Version:** IKEv2 (Modern, Recommended)
- **PFS:** Enabled (Additional Security)

---

## ✅ NEXT STEPS

### **1. Get PSK from Airtel** ⭐ CRITICAL
**Contact:** Airtel Technical Team  
**Request:** "Please provide the Pre-Shared Key (PSK) for VPN peer 37.60.252.211"

### **2. Confirm Subnet Configuration**
**Ask Airtel:**
- What is your internal subnet? (assuming 172.26.0.0/16)
- Which specific USSD gateway IPs will connect to us?

### **3. Deploy IPSec Configuration**
Once you have the PSK:
```bash
# Copy configurations to VPS
# Update PSK in /etc/ipsec.secrets
# Restart IPSec
# Start tunnel
```

### **4. Test VPN Connectivity**
```bash
sudo ipsec statusall
ping 172.26.x.x  # Airtel's internal IP
```

---

## 📞 CONTACT AIRTEL

**Email Template:**

```
Subject: Pre-Shared Key Request for S2S VPN - Nzeru za Alimi

Dear Airtel Technical Team,

We have received your S2S VPN configuration document and are ready to 
configure our VPN endpoint.

To complete the setup, we need:

1. Pre-Shared Key (PSK) for authentication
2. Confirmation of internal subnet (is it 172.26.0.0/16?)
3. Specific USSD gateway IPs that will access our server

Our VPN Configuration:
- Peer IP: 37.60.252.211
- Endpoint: api.zammunda.com
- VPN Software: StrongSwan (compatible with Palo Alto)
- IKE Version: IKEv2 (as per your specs)
- Encryption: AES-256, SHA-256, DH Group 5 (as per your specs)

Please provide the PSK at your earliest convenience so we can complete
the VPN setup and begin USSD testing.

Thank you.
```

---

## 🔒 SECURITY NOTES

1. **PSK Security:**
   - PSK is a shared secret password
   - Treat it like a password - never commit to git
   - Store securely in `/etc/ipsec.secrets` with 600 permissions
   - Only root should be able to read it

2. **VPN Configuration Backup:**
   - Always backup working configs before changes
   - Keep PSK in secure password manager
   - Document who has access to PSK

3. **Monitoring:**
   - Monitor VPN logs regularly
   - Set up alerts for VPN disconnections
   - Check tunnel status daily

---

**Status:** Configuration ready, waiting for PSK from Airtel  
**Blocker:** Need Pre-Shared Key to activate VPN tunnel  
**ETA:** Can complete setup within 5 minutes of receiving PSK
