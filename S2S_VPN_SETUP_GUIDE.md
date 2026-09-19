# SITE-TO-SITE (S2S) VPN SETUP FOR AIRTEL USSD

**VPN Type Required:** Site-to-Site (S2S) VPN  
**Purpose:** Create a permanent encrypted tunnel between Airtel's network and your VPS  
**Date:** September 17, 2026

---

## 🔒 WHAT IS SITE-TO-SITE (S2S) VPN?

### **S2S VPN vs Other VPN Types:**

**Site-to-Site VPN (REQUIRED):**
- Connects two entire networks together
- Always-on, permanent tunnel
- Both sides act as VPN gateways
- No client software needed on individual devices
- Traffic automatically routed through tunnel
- **Perfect for: Server-to-Server communication (USSD integration)**

**Client-to-Site VPN (NOT what we need):**
- Individual devices connect to a network
- Users manually connect/disconnect
- Used for remote employee access
- NOT suitable for USSD integration

---

## 🏗️ S2S VPN ARCHITECTURE FOR AIRTEL USSD

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SITE-TO-SITE VPN TOPOLOGY                            │
└─────────────────────────────────────────────────────────────────────────┘

    AIRTEL'S SIDE (Site 1)              YOUR SIDE (Site 2)
┌──────────────────────────┐        ┌──────────────────────────┐
│                          │        │                          │
│  Airtel USSD Gateway     │        │   Your VPS Server        │
│  IP: 172.26.x.x          │        │   IP: 37.60.252.211      │
│  (Internal Network)      │        │   (api.zammunda.com)     │
│                          │        │                          │
│  ┌────────────────────┐  │        │  ┌────────────────────┐  │
│  │ VPN Concentrator   │  │        │  │ VPN Gateway        │  │
│  │ (Airtel Gateway)   │◄─┼────────┼─►│ (Your Server)      │  │
│  │ Public IP: ?.?.?.? │  │  S2S   │  │ Public IP:         │  │
│  └────────────────────┘  │  VPN   │  │ 37.60.252.211      │  │
│           ▲              │ TUNNEL │  └────────────────────┘  │
│           │              │◄═════►│             ▲              │
│           ▼              │ IPSec  │             │             │
│  ┌────────────────────┐  │ Encr.  │  ┌──────────▼──────────┐ │
│  │ USSD Application   │  │        │  │ USSD API Server     │ │
│  │ Subnet: 172.26/16  │  │        │  │ Port: 3000 or 443   │ │
│  └────────────────────┘  │        │  └─────────────────────┘ │
│                          │        │                          │
│  Local Subnet:           │        │  Local Subnet:           │
│  172.26.0.0/16           │        │  10.8.0.0/24 (VPN)       │
│                          │        │  192.168.1.0/24 (Local)  │
└──────────────────────────┘        └──────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
                    ENCRYPTED TUNNEL (Always-On)
═══════════════════════════════════════════════════════════════════════════
```

---

## 🔧 S2S VPN COMPONENTS

### **Both Sides Need:**

1. **VPN Gateway/Concentrator**
   - **Airtel's side:** Already have (VPN concentrator)
   - **Your side:** Need to set up on VPS (StrongSwan/OpenVPN)

2. **Public IP Address**
   - **Airtel's side:** Their VPN gateway public IP
   - **Your side:** 37.60.252.211 ✅ (already have)

3. **Private Subnet**
   - **Airtel's side:** 172.26.0.0/16 (their internal network)
   - **Your side:** Need to define (e.g., 10.8.0.0/24 for VPN)

4. **Authentication**
   - Pre-shared Key (PSK) - both sides have the same key
   - OR Digital Certificates - exchange certificates

5. **Routing Configuration**
   - Routes to direct traffic through the tunnel
   - Both sides know how to reach each other

---

## 📋 S2S VPN CONFIGURATION REQUIREMENTS

### **Information Airtel MUST Provide:**

```yaml
# AIRTEL'S SIDE (Remote Peer)
Remote_Gateway_IP: "?.?.?.?"           # Airtel's VPN concentrator public IP
Remote_Subnet: "172.26.0.0/16"         # Airtel's internal network
Remote_VPN_ID: "airtel-vpn-gateway"    # Identity string

# AUTHENTICATION
Auth_Method: "PSK"                      # Or "Certificate"
Pre_Shared_Key: "xxxxxxxxxxxxx"        # Shared secret
# OR
CA_Certificate: "ca.crt"               # Certificate authority
Remote_Certificate: "airtel.crt"        # Airtel's certificate

# ENCRYPTION (Phase 1 - IKE)
IKE_Version: "IKEv2"                    # or IKEv1
IKE_Encryption: "AES-256-CBC"          # Encryption algorithm
IKE_Hash: "SHA256"                      # Hash algorithm
IKE_DH_Group: "modp2048"               # Diffie-Hellman group
IKE_Lifetime: "28800s"                 # 8 hours

# ENCRYPTION (Phase 2 - IPSec)
ESP_Encryption: "AES-256-CBC"          # Encryption algorithm
ESP_Hash: "SHA256"                      # Hash algorithm
PFS_Group: "modp2048"                  # Perfect Forward Secrecy
IPSec_Lifetime: "3600s"                # 1 hour

# NETWORK
MTU: 1400                               # Maximum Transmission Unit
Dead_Peer_Detection: "30s"             # Keepalive interval
NAT_Traversal: "yes"                   # Enable if behind NAT
```

### **Information YOU Provide to Airtel:**

```yaml
# YOUR SIDE (Local Peer)
Local_Gateway_IP: "37.60.252.211"      # Your VPS public IP
Local_Subnet: "10.8.0.0/24"            # Your VPN subnet
Local_VPN_ID: "nzeru-vpn-gateway"      # Identity string
USSD_Endpoint: "https://api.zammunda.com/ussd"
```

---

## 🛠️ S2S VPN IMPLEMENTATION OPTIONS

### **OPTION 1: IPSec with StrongSwan** ⭐ RECOMMENDED

**Why:** Industry standard for telecom, most likely what Airtel uses

#### **Installation:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install StrongSwan
sudo apt install strongswan strongswan-pki libcharon-extra-plugins -y

# Enable IP forwarding (required for S2S VPN)
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
```

#### **Configuration Template:**

**File: `/etc/ipsec.conf`**

```bash
# Basic configuration
config setup
    charondebug="ike 2, knl 2, cfg 2, net 2, esp 2, dmn 2, mgr 2"
    uniqueids=never

# Connection to Airtel
conn airtel-ussd-s2s
    # Connection type
    type=tunnel
    auto=start
    
    # Dead Peer Detection
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s
    
    # Local (Your VPS) settings
    left=37.60.252.211                          # Your public IP
    leftsubnet=10.8.0.0/24                      # Your VPN subnet
    leftid=@nzeru-vpn-gateway                   # Your VPN ID
    leftfirewall=yes
    
    # Remote (Airtel) settings - FILL FROM AIRTEL'S CONFIG
    right=%AIRTEL_VPN_GATEWAY_IP%               # Airtel's VPN gateway IP
    rightsubnet=172.26.0.0/16                   # Airtel's subnet
    rightid=@airtel-vpn-gateway                 # Airtel's VPN ID
    
    # Authentication
    authby=secret                               # Using PSK
    
    # Phase 1 (IKE) - MATCH AIRTEL'S SETTINGS
    ike=aes256-sha256-modp2048!                # Encryption-Hash-DHGroup
    ikelifetime=28800s                         # 8 hours
    
    # Phase 2 (ESP) - MATCH AIRTEL'S SETTINGS
    esp=aes256-sha256-modp2048!                # Encryption-Hash-PFS
    lifetime=3600s                             # 1 hour
    
    # Keepalive
    keyingtries=%forever
    
    # Compression
    compress=no
```

**File: `/etc/ipsec.secrets`**

```bash
# Pre-Shared Key authentication
37.60.252.211 %AIRTEL_VPN_GATEWAY_IP% : PSK "%AIRTEL_PROVIDED_PSK%"

# OR if using IDs
@nzeru-vpn-gateway @airtel-vpn-gateway : PSK "%AIRTEL_PROVIDED_PSK%"
```

#### **Start and Test:**

```bash
# Restart IPSec
sudo ipsec restart

# Check configuration
sudo ipsec statusall

# Test connection
sudo ipsec up airtel-ussd-s2s

# Monitor logs
sudo tail -f /var/log/syslog | grep charon

# Check established tunnels
sudo ipsec status
```

---

### **OPTION 2: OpenVPN S2S**

**Note:** Less common for telecom, but possible if Airtel supports it.

#### **Installation:**

```bash
sudo apt update
sudo apt install openvpn easy-rsa -y
```

#### **Configuration Template:**

**File: `/etc/openvpn/server/airtel-s2s.conf`**

```bash
# Site-to-Site mode
mode server
proto udp
port 1194
dev tun

# Network settings
topology subnet
server 10.8.0.0 255.255.255.0

# Push routes to Airtel's network
route 172.26.0.0 255.255.0.0

# Authentication
tls-server
ca /etc/openvpn/server/ca.crt
cert /etc/openvpn/server/server.crt
key /etc/openvpn/server/server.key
dh /etc/openvpn/server/dh.pem

# Encryption
cipher AES-256-CBC
auth SHA256

# Keepalive
keepalive 10 120

# Logging
status /var/log/openvpn-status.log
log-append /var/log/openvpn.log
verb 3
```

---

## 🔥 FIREWALL CONFIGURATION FOR S2S VPN

### **Allow VPN Traffic:**

```bash
# IPSec ports
sudo ufw allow 500/udp    # IKE (Internet Key Exchange)
sudo ufw allow 4500/udp   # NAT Traversal
sudo ufw allow esp        # ESP protocol

# OpenVPN (if used)
sudo ufw allow 1194/udp

# Allow traffic from VPN interface
sudo ufw allow in on ipsec0
sudo ufw allow in on tun0

# Reload firewall
sudo ufw reload
```

### **NAT/Masquerading (if needed):**

```bash
# Enable masquerading for VPN subnet
sudo iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o eth0 -j MASQUERADE

# Save rules
sudo netfilter-persistent save
```

---

## 🛣️ ROUTING CONFIGURATION

### **Static Routes:**

```bash
# Route Airtel's subnet through VPN
sudo ip route add 172.26.0.0/16 via 10.8.0.1 dev ipsec0

# Make persistent (add to /etc/network/interfaces or use systemd)
```

### **Check Routes:**

```bash
# Show routing table
ip route show

# Test route to Airtel
ping -I 10.8.0.1 172.26.166.100
```

---

## 🧪 TESTING S2S VPN

### **1. Check VPN Tunnel is Up:**

```bash
# IPSec status
sudo ipsec statusall

# Should show:
# Security Associations (1 up, 0 connecting)
# airtel-ussd-s2s[1]: ESTABLISHED
```

### **2. Check VPN Interface:**

```bash
ip addr show

# Should see tunnel interface (ipsec0, tun0, etc.)
```

### **3. Ping Across VPN:**

```bash
# Ping Airtel's gateway through tunnel
ping -c 4 172.26.166.100

# Ping from your VPN IP
ping -I 10.8.0.1 -c 4 172.26.166.100
```

### **4. Test USSD Endpoint Through VPN:**

```bash
# From your server, test local endpoint
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test123&serviceCode=*413#&phoneNumber=%2B265888000001&text="

# Ask Airtel to test from their side
# They should send test USSD request through VPN
```

### **5. Monitor VPN Traffic:**

```bash
# Watch VPN packets
sudo tcpdump -i ipsec0

# Check IPSec status continuously
watch -n 2 'sudo ipsec statusall'
```

---

## 📝 APPLICATION CONFIGURATION CHANGES

### **Update IP Whitelist:**

**File: `server/src/app.js`**

```javascript
// S2S VPN Configuration
const VPN_CONFIG = {
  enabled: true,
  vpnSubnet: '10.8.0.0/24',          // Your VPN subnet
  airtelSubnet: '172.26.0.0/16',     // Airtel's internal network
};

// IP whitelist for USSD endpoint
const ALLOWED_AIRTEL_IPS = [
  // Airtel's internal IPs (accessible through S2S VPN)
  '172.26.166.100',
  '172.26.166.101',
  '172.26.166.102',
  '172.26.166.103',
  '172.26.166.41',
  '172.26.166.42',
  '172.26.166.43',
  '172.26.166.66',
  '172.26.129.4',
  '172.26.129.5',
  '172.26.129.6',
  '172.26.129.23',
  '172.26.129.100',
  '172.26.129.101',
  '172.26.129.102',
  '172.26.129.103',
  
  // Allow entire Airtel VPN subnet (alternatively)
  // '172.26.0.0/16',
];

// USSD endpoint - IP restriction
app.post('/ussd', (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Check if IP is from VPN tunnel
  const isFromVPN = ALLOWED_AIRTEL_IPS.some(ip => {
    if (ip.includes('/')) {
      // CIDR notation - check if IP is in subnet
      return ipInSubnet(clientIP, ip);
    }
    return clientIP === ip;
  });
  
  if (!isFromVPN) {
    console.log(`[USSD] Rejected request from unauthorized IP: ${clientIP}`);
    return res.status(403).send('END Access denied');
  }
  
  next();
}, sessionStorage.bind(null, {}), ussdRouter);

// Helper function to check IP in subnet
function ipInSubnet(ip, cidr) {
  // Implementation depends on your subnet checking library
  // Or use a package like 'ip-range-check' or 'ipaddr.js'
  return require('ip-range-check')(ip, cidr);
}
```

### **Install IP Range Checking:**

```bash
cd server
npm install ip-range-check
```

---

## ✅ S2S VPN CHECKLIST

### **Before Contacting Airtel:**
- [x] Server has public IP: 37.60.252.211
- [x] Server is running and accessible
- [x] Firewall allows VPN ports (will configure after)
- [x] Have root/sudo access to VPS

### **Information to Request from Airtel:**
- [ ] Airtel VPN gateway public IP address
- [ ] VPN protocol (IPSec/IKEv2/OpenVPN)
- [ ] Pre-shared key (PSK) or certificates
- [ ] IKE (Phase 1) encryption settings
- [ ] IPSec (Phase 2) encryption settings
- [ ] Airtel's internal subnet (172.26.x.x/?)
- [ ] Your assigned VPN subnet
- [ ] Dead peer detection settings
- [ ] MTU size
- [ ] Technical contact for VPN support

### **After Receiving Config from Airtel:**
- [ ] Install VPN software (StrongSwan/OpenVPN)
- [ ] Configure VPN with Airtel's settings
- [ ] Set up firewall rules
- [ ] Configure routing
- [ ] Enable IP forwarding
- [ ] Start VPN service
- [ ] Test VPN tunnel connectivity
- [ ] Test ping to Airtel's gateway
- [ ] Update application IP whitelist
- [ ] Test USSD endpoint through VPN
- [ ] Monitor VPN logs for issues
- [ ] Update PCR form with S2S VPN details
- [ ] Submit to Airtel for production

---

## 🚨 COMMON S2S VPN ISSUES & FIXES

### **Issue 1: Tunnel Won't Establish**

```bash
# Check logs
sudo tail -f /var/log/syslog | grep charon

# Common causes:
# - Wrong PSK
# - Encryption mismatch
# - Firewall blocking
# - Wrong gateway IP
```

### **Issue 2: Tunnel Up But Can't Ping**

```bash
# Check routes
ip route show

# Add missing route
sudo ip route add 172.26.0.0/16 dev ipsec0

# Check if IP forwarding enabled
cat /proc/sys/net/ipv4/ip_forward  # Should be "1"
```

### **Issue 3: Tunnel Keeps Disconnecting**

```bash
# Adjust DPD settings in /etc/ipsec.conf
dpdaction=restart
dpddelay=30s
dpdtimeout=120s

# Restart IPSec
sudo ipsec restart
```

---

## 📞 WHAT TO TELL AIRTEL

When requesting S2S VPN setup, clearly state:

> "We need to set up a **Site-to-Site (S2S) VPN** between our server and 
> Airtel's USSD gateway for the USSD integration. Our server will act as 
> one VPN endpoint, and Airtel's VPN concentrator will be the other endpoint.
> 
> This is for a permanent, always-on encrypted tunnel to route USSD traffic
> securely between our networks.
> 
> Please provide your S2S VPN configuration details including gateway IP,
> pre-shared key, encryption settings, and subnet information."

---

## 📄 FILES GENERATED

- `/workspace/S2S_VPN_SETUP_GUIDE.md` - This comprehensive guide
- `/workspace/EMAIL_TO_AIRTEL_VPN_REQUEST.txt` - Email template (update to emphasize S2S)
- `/workspace/AIRTEL_VPN_OPTIONS.md` - General VPN options

---

**Next Step:** Email Airtel requesting **Site-to-Site (S2S) VPN** configuration details.

**Once received:** I'll help configure the S2S VPN on your VPS with the exact settings Airtel provides.

---

**Status:** Waiting for Airtel S2S VPN configuration  
**Blocker:** Need Airtel's VPN gateway IP, PSK, and encryption settings  
**ETA:** 1-2 weeks after Airtel provides configuration
