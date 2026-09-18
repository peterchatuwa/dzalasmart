# AIRTEL USSD VPN REQUIREMENT - OPTIONS & SOLUTIONS

**Date:** September 17, 2026  
**Requirement:** Airtel mandates VPN connectivity for all USSD integrations

---

## 🔒 THE REQUIREMENT

Airtel requires a **Site-to-Site (S2S) VPN tunnel** between:
- **Your VPS Server** (37.60.252.211 / api.zammunda.com)
- **Airtel's USSD Gateway** (172.26.x.x network)

This means direct internet HTTPS connections are **NOT permitted** - all USSD traffic must go through an encrypted VPN tunnel.

---

## ⚠️ CURRENT STATUS

**Current Setup:** Direct HTTPS API (Port 443)  
**Required Setup:** VPN Tunnel + HTTPS API  
**Gap:** No VPN infrastructure currently in place

---

## 📋 SOLUTION OPTIONS

### **OPTION 1: Request Airtel to Provide VPN Details** ⭐ RECOMMENDED

**What to do:**
1. Contact Airtel's USSD integration team
2. Request their **S2S VPN Configuration Package**, which should include:
   - VPN Protocol (IPSec, OpenVPN, WireGuard, etc.)
   - Airtel's VPN Concentrator IP address
   - Pre-shared key (PSK) or certificates
   - Encryption settings (IKEv2, AES-256, etc.)
   - Local/remote subnets
   - VPN gateway credentials

**Why this is best:**
- Airtel typically provides pre-configured VPN details
- They have specific security requirements
- Reduces back-and-forth during setup
- Most USSD integrations follow this pattern

**Next Steps:**
- Email Airtel with VPN configuration request
- Wait for their VPN setup documentation
- Configure VPN on your VPS based on their specs

---

### **OPTION 2: Use VPS Provider's VPN Service**

**If your VPS provider offers VPN services:**

**Requirements:**
- Check if your VPS provider supports VPN endpoints
- Verify they can establish S2S VPN with external partners
- Get static IP allocation for VPN endpoint

**Pros:**
- Managed by hosting provider
- Professional support
- Likely already compliant with telecom standards

**Cons:**
- Additional monthly cost
- May require VPS upgrade
- Setup complexity

---

### **OPTION 3: Self-Managed VPN on Your VPS**

**Set up VPN server directly on your VPS:**

#### **3A: IPSec VPN (StrongSwan)** - Industry Standard for Telecom

```bash
# Install StrongSwan
apt update
apt install strongswan strongswan-pki libcharon-extra-plugins -y

# Generate certificates
ipsec pki --gen --type rsa --size 4096 --outform pem > server-key.pem
ipsec pki --self --ca --lifetime 3650 --in server-key.pem \
  --type rsa --dn "CN=VPN CA" --outform pem > ca-cert.pem

# Configure /etc/ipsec.conf (requires Airtel's settings)
# Configure /etc/ipsec.secrets (requires PSK from Airtel)

# Start VPN
systemctl enable strongswan-starter
systemctl start strongswan-starter
```

**Requires from Airtel:**
- Their VPN gateway IP
- Pre-shared key (PSK) or certificate
- IKE/IPSec policy settings
- Remote subnet ranges

---

#### **3B: OpenVPN** - Flexible, Well-Documented

```bash
# Install OpenVPN
apt update
apt install openvpn easy-rsa -y

# Setup PKI and generate certificates
make-cadir ~/openvpn-ca
cd ~/openvpn-ca
./easyrsa init-pki
./easyrsa build-ca
./easyrsa gen-req server nopass
./easyrsa sign-req server server

# Configure server.conf
# Share client certificate with Airtel
```

**Requires from Airtel:**
- Confirmation they support OpenVPN
- Client certificate sharing method
- Port and protocol preferences

---

#### **3C: WireGuard** - Modern, Fast, Simple

```bash
# Install WireGuard
apt update
apt install wireguard -y

# Generate keys
wg genkey | tee privatekey | wg pubkey > publickey

# Configure /etc/wireguard/wg0.conf
[Interface]
Address = 10.0.0.1/24
PrivateKey = <your-private-key>
ListenPort = 51820

[Peer]
PublicKey = <airtel-public-key>
AllowedIPs = 172.26.0.0/16
Endpoint = <airtel-vpn-gateway>:51820
PersistentKeepalive = 25

# Enable and start
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
```

**Requires from Airtel:**
- Confirmation they support WireGuard
- Their public key
- Their VPN gateway endpoint

---

### **OPTION 4: Use Cloud VPN Gateway Service**

**Third-party VPN-as-a-Service:**

**Providers:**
- AWS VPN Gateway
- Google Cloud VPN
- Azure VPN Gateway
- Cloudflare Magic WAN

**Process:**
1. Set up cloud VPN gateway
2. Configure tunnel to Airtel
3. Route USSD traffic through gateway
4. Your VPS connects to cloud gateway

**Pros:**
- Professional management
- High availability
- Compliance certifications
- DDoS protection

**Cons:**
- Additional cost ($50-200/month)
- Requires architecture change
- May add latency

---

## 🎯 RECOMMENDED APPROACH

### **STEP 1: Contact Airtel Immediately**

**Email Template:**

```
Subject: USSD Integration VPN Configuration Request - Nzeru za Alimi

Dear Airtel USSD Integration Team,

We are setting up USSD integration for service code *413# (Nzeru za Alimi 
- Smart Farming Platform) and understand that VPN connectivity is required.

Please provide the following VPN configuration details:

1. VPN Protocol: (IPSec/IKEv2/OpenVPN/WireGuard/Other)
2. Airtel VPN Gateway IP Address
3. Authentication Method: (Pre-shared Key/Certificates)
4. Pre-shared Key or Certificate Authority details
5. Encryption Standards: (IKE Policy, IPSec Policy)
6. Local Subnet Configuration
7. Remote Subnet Configuration (Airtel's side)
8. MTU and other network parameters
9. VPN configuration template or guide

Our Server Details:
- Public IP: 37.60.252.211
- Domain: api.zammunda.com
- USSD Endpoint: https://api.zammunda.com/ussd
- Server Location: Malawi

Contact:
Peter Chatuwa
Email: peter.chatuwa@zammunda.com

Thank you.
```

---

### **STEP 2: Wait for Airtel's VPN Package**

Airtel will typically provide:
- ✅ VPN configuration document
- ✅ Pre-shared keys or certificates
- ✅ Network topology diagram
- ✅ Step-by-step setup guide
- ✅ Testing procedures
- ✅ Support contact for VPN setup

---

### **STEP 3: Implement VPN Based on Their Specs**

Once you receive Airtel's VPN details, I can help you:
1. Install the required VPN software
2. Configure the VPN tunnel
3. Set up routing rules
4. Configure firewall rules
5. Test connectivity
6. Integrate with your USSD endpoint

---

## 🔧 POST-VPN SETUP CHANGES

### **Architecture After VPN:**

```
[User Phone] 
    ↓ *413#
[Airtel Mobile Network]
    ↓
[Airtel USSD Gateway] 172.26.x.x
    ↓
    ↓ ← ← ← VPN TUNNEL (ENCRYPTED) ← ← ←
    ↓
[Your VPS Server] 37.60.252.211
    ↓ Internal routing through VPN
[USSD Application] https://api.zammunda.com/ussd
```

### **Changes Required:**

1. **Firewall Rules:**
   ```bash
   # Allow VPN traffic
   ufw allow 500/udp    # IKE
   ufw allow 4500/udp   # NAT-T
   ufw allow 51820/udp  # WireGuard (if used)
   ```

2. **Routing Rules:**
   ```bash
   # Route Airtel's subnet through VPN
   ip route add 172.26.0.0/16 via <vpn-interface>
   ```

3. **Application Changes:**
   - **Likely NONE** - Your USSD endpoint code stays the same
   - VPN operates at network layer (transparent to application)
   - May need to whitelist VPN subnet instead of public IPs

4. **Nginx/Reverse Proxy:**
   ```nginx
   # Update allowed IPs to VPN subnet
   location /ussd {
       allow 10.0.0.0/24;      # VPN subnet
       allow 172.26.0.0/16;    # Airtel's internal network
       deny all;
   }
   ```

---

## ⏱️ ESTIMATED TIMELINE

| Phase | Duration | Notes |
|-------|----------|-------|
| Request VPN details from Airtel | 1-3 days | Depends on Airtel response time |
| Receive VPN configuration | 3-7 days | May require follow-up |
| VPN setup and configuration | 1-2 days | Technical implementation |
| Testing and troubleshooting | 1-3 days | Connectivity and routing tests |
| Production deployment | 1 day | Final cutover |
| **Total** | **7-16 days** | Depends on Airtel's responsiveness |

---

## 📞 IMMEDIATE ACTION ITEMS

### **TODAY:**
1. ✅ Email Airtel requesting VPN configuration (use template above)
2. ✅ CC their technical team and account manager
3. ✅ Request a VPN setup meeting/call

### **WHILE WAITING:**
1. ✅ Backup current server configuration
2. ✅ Ensure VPS has sufficient resources for VPN overhead
3. ✅ Document current network configuration
4. ✅ Prepare testing plan for post-VPN setup

### **AFTER RECEIVING VPN DETAILS:**
1. ✅ Review Airtel's VPN requirements
2. ✅ Install necessary VPN software
3. ✅ Configure VPN tunnel
4. ✅ Test connectivity
5. ✅ Update USSD application configuration
6. ✅ Perform end-to-end testing

---

## ❓ QUESTIONS TO ASK AIRTEL

1. **Do you provide a pre-configured VPN appliance/image?**
2. **What is the expected VPN uptime SLA?**
3. **Who handles VPN troubleshooting? (Support contact)**
4. **Are there redundant VPN gateways for failover?**
5. **What is the VPN bandwidth allocation?**
6. **Are there any VPN-related costs/fees?**
7. **Can we test VPN in a staging environment first?**
8. **What is the timeline for VPN provisioning?**

---

## 🚨 IMPORTANT NOTES

### **Security Considerations:**
- VPN adds encryption layer (AES-256 typical)
- Reduces attack surface (no public internet exposure)
- Requires proper key management
- Need backup/recovery procedures

### **Performance Impact:**
- VPN adds ~5-20ms latency (negligible for USSD)
- CPU overhead for encryption (~5-10%)
- No impact on USSD user experience

### **Maintenance:**
- VPN certificates may need renewal
- Keep VPN software updated
- Monitor VPN tunnel health
- Have failover plan

---

## 📄 UPDATED PCR FORM NOTES

**Once VPN is set up, you'll need to update the PCR form with:**

- ✅ VPN Type: (e.g., IPSec IKEv2)
- ✅ VPN Concentrator Vendor: (e.g., StrongSwan, OpenVPN)
- ✅ VPN Concentrator Model: (e.g., Software-based on Ubuntu)
- ✅ VPN Local Subnet: (Your VPN subnet, e.g., 10.0.0.0/24)
- ✅ VPN Remote Subnet: (Airtel's subnet, e.g., 172.26.0.0/16)
- ✅ VPN Tunnel IP: (Your VPN tunnel endpoint IP)

---

## 💡 BOTTOM LINE

**You CANNOT proceed with USSD integration until:**
1. ✅ Airtel provides VPN configuration details
2. ✅ VPN tunnel is established and tested
3. ✅ Routing is configured correctly
4. ✅ Both sides can ping each other through VPN
5. ✅ USSD traffic successfully flows through VPN

**Next immediate step:** Email Airtel requesting VPN configuration package using the template above.

---

**Document prepared:** September 17, 2026  
**Status:** Awaiting VPN details from Airtel  
**Contact:** Peter Chatuwa - peter.chatuwa@zammunda.com
