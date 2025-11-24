# ⚡ Quick Testing Checklist

## Setup (5 minutes)
- [ ] Hardhat node running
- [ ] Contracts deployed
- [ ] Frontend running at localhost:3000
- [ ] MetaMask on Hardhat Local network
- [ ] 2 test accounts imported

## Patient Flow (5 minutes)
- [1] Connect wallet
- [1] Register as patient
- [1] Upload 1 PDF file
- [1] View record details
- [ ] Download & decrypt file
- [ ] File opens correctly

## Doctor Flow (5 minutes)
- [ ] Register as doctor
- [ ] Admin verify doctor (console)
- [ ] Login as doctor
- [ ] Request access to record
- [ ] Patient grant access
- [ ] Doctor view record
- [ ] Doctor download file

## ✅ All Critical Paths




# 🎯 Detailed Test Cases

## How to Use This Document

Each test case includes:
- **Preconditions:** What must be true before starting
- **Test Data:** Specific inputs to use
- **Expected Results:** What should happen at each step
- **Validation Points:** How to verify success
- **Rollback Steps:** How to undo if needed

---

## TC-001: Patient Registration (First Time)

### Preconditions
- [ ] Hardhat node running
- [ ] Contracts deployed
- [ ] MetaMask connected to Hardhat Local
- [ ] Using Account #0 (never registered before)
- [ ] Account has >0.1 ETH

### Test Data
- **Account Address:** 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **Account Name:** "Patient - Test Account"
- **Private Key:** 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

### Detailed Steps

#### Step 1: Navigate to Application
1. Open Chrome/Brave browser
2. Enter URL: `http://localhost:3000`
3. Wait for page to load (< 3 seconds)

**Validation:**
- ✅ Page loads without errors
- ✅ Login page displays
- ✅ "Connect MetaMask Wallet" button visible
- ✅ Background gradients animated

#### Step 2: Connect Wallet
1. Click "Connect MetaMask Wallet" button
2. Wait for MetaMask popup (< 2 seconds)

**Validation:**
- ✅ MetaMask popup appears
- ✅ Shows "Connect with MetaMask"
- ✅ Displays site: localhost:3000
- ✅ Shows account address

#### Step 3: Approve Connection
1. In MetaMask popup, click "Next"
2. Click "Connect"
3. Wait for confirmation

**Validation:**
- ✅ Popup closes
- ✅ Browser shows "checking registration..."
- ✅ No errors in console

#### Step 4: Blockchain Registration Check
**What happens in background:**
```javascript
// Calls smart contract
const isRegistered = await patientRegistry.isPatient(address);
// Returns: false (new user)
```

**Validation:**
- ✅ Smart contract call succeeds
- ✅ Returns false
- ✅ UI proceeds to role selection

#### Step 5: Role Selection
1. Screen shows "Select your role"
2. Two options visible: Patient and Doctor
3. Patient option pre-selected (default)

**Validation:**
- ✅ Role selection screen displayed
- ✅ Wallet address shown: 0xf39F...2266
- ✅ Patient option has blue highlight
- ✅ Description text visible

#### Step 6: Confirm Role
1. Verify Patient is selected
2. Click "Register & Continue" button

**Validation:**
- ✅ Button is enabled
- ✅ Button changes to "Registering..."
- ✅ Loading spinner appears

#### Step 7: Sign Registration Transaction
1. MetaMask popup appears
2. Shows contract interaction
3. Displays gas estimate

**Expected Transaction Details:**
```
Contract: PatientRegistry
Function: registerPatient
Gas Limit: ~100,000
Gas Price: 1.5 gwei (Hardhat default)
Total Fee: ~0.00015 ETH
```

**Validation:**
- ✅ Correct contract address shown
- ✅ Gas estimate reasonable
- ✅ Account has sufficient balance

#### Step 8: Confirm Transaction
1. Click "Confirm" in MetaMask
2. Wait for transaction (2-3 seconds on Hardhat)

**What happens:**
```javascript
// Smart contract stores user
users[0xf39Fd6...] = {
  walletAddress: 0xf39Fd6...,
  profileCID: "QmXXX...",
  isRegistered: true,
  registeredAt: 1700000000
}

// Event emitted
emit PatientRegistered(0xf39Fd6..., "QmXXX...", 1700000000);
```

**Validation:**
- ✅ Transaction hash returned
- ✅ Transaction confirmed
- ✅ No errors in console
- ✅ MetaMask shows success

#### Step 9: Authentication Signature
1. New MetaMask popup appears
2. Shows message to sign (not a transaction)
3. No gas fee

**Message Content:**
```
Sign this message to authenticate with AI Decentralized HRS.

Nonce: [random hex]
Role: patient
```

**Validation:**
- ✅ Message displayed correctly
- ✅ "Sign" button enabled
- ✅ Shows "This request will not trigger a transaction"

#### Step 10: Sign Message
1. Click "Sign" in MetaMask
2. Wait for signature generation (< 1 second)

**What happens:**
```javascript
// MetaMask signs message with private key
const signature = await signer.signMessage(message);

// Backend verifies signature
const recoveredAddress = ethers.verifyMessage(message, signature);
// Returns: 0xf39Fd6... (matches!)

// Backend generates JWT
const token = jwt.sign({ address, role: 'patient' }, JWT_SECRET, { expiresIn: '24h' });
```

**Validation:**
- ✅ Signature generated
- ✅ Backend verification succeeds
- ✅ JWT token returned
- ✅ Token stored in localStorage

#### Step 11: Dashboard Load
1. Page redirects to `/dashboard`
2. Dashboard loads

**Validation:**
- ✅ URL changes to /dashboard
- ✅ Patient dashboard displays (blue/indigo theme)
- ✅ Navbar shows wallet address
- ✅ Stats show "0 Total Records"
- ✅ No pending requests
- ✅ "Upload New Record" button visible

### Expected Final State

**Blockchain:**
```solidity
users[0xf39Fd6...] = {
  walletAddress: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
  profileCID: "QmProfile123...",
  isRegistered: true,
  registeredAt: 1700000000
}
```

**LocalStorage:**
```javascript
{
  "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "wallet_address": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "user_role": "patient",
  "publicKey_0xf39...": "MIIBIjANBgkq...",
  "privateKey_0xf39...": "MIIEvQIBADAN..."
}
```

**MetaMask:**
- Account balance reduced by ~0.00015 ETH (gas fees)
- Transaction history shows: "Contract Interaction"

### Rollback Steps (if needed)
1. Restart Hardhat node (clears blockchain state)
2. Redeploy contracts
3. Clear browser localStorage
4. Clear MetaMask activity data

### Performance Benchmarks
- Total Time: < 30 seconds
- Wallet Connection: 2-3 seconds
- Registration TX: 2-3 seconds  
- Authentication: 1-2 seconds
- Dashboard Load: 1-2 seconds

### Common Issues & Solutions

**Issue 1:** MetaMask doesn't popup
- **Check:** MetaMask is unlocked
- **Check:** MetaMask extension enabled
- **Fix:** Refresh page, try again

**Issue 2:** Transaction fails
- **Check:** Hardhat node running
- **Check:** Contracts deployed
- **Check:** Sufficient ETH balance
- **Fix:** Restart node, redeploy

**Issue 3:** "User already registered" error
- **Cause:** Account used before
- **Fix:** Use different account or restart Hardhat node

---

## TC-002: File Upload with Encryption

### Preconditions
- [ ] Logged in as patient
- [ ] Have test file ready (PDF, < 10MB)
- [ ] Pinata API keys configured
- [ ] Account has >0.1 ETH

### Test Data
- **File:** `test-lab-report.pdf`
- **File Size:** 2.5 MB
- **File Type:** application/pdf
- **Record Type:** Lab Result
- **Description:** "Annual blood work - Complete metabolic panel"

### Detailed Steps

#### Step 1: Open Upload Modal
1. On patient dashboard
2. Click "Upload New Record" button

**Validation:**
- ✅ Modal opens
- ✅ Drag & drop zone visible
- ✅ Record type options displayed
- ✅ Description field empty
- ✅ Character counter shows "0/100"

#### Step 2: Select File
1. Click drag & drop zone
2. File browser opens
3. Navigate to test-lab-report.pdf
4. Select file
5. Click "Open"

**Validation:**
- ✅ File loads
- ✅ File name displayed: "test-lab-report.pdf"
- ✅ File size displayed: "2.5 MB"
- ✅ Green checkmark appears
- ✅ "Remove file" button visible

#### Step 3: Select Record Type
1. Click "🧪 Lab Result" button

**Validation:**
- ✅ Button highlights (border changes)
- ✅ Other options dim
- ✅ Selection saved

#### Step 4: Enter Description
1. Click description textarea
2. Type: "Annual blood work - Complete metabolic panel"

**Validation:**
- ✅ Text appears as typed
- ✅ Character counter updates: "48/100"
- ✅ No error message
- ✅ Upload button enabled

#### Step 5: Initiate Upload
1. Click "Upload Record" button

**What happens in background:**
```javascript
// 1. Calculate file hash
const fileHash = await calculateFileHash(file);
console.log('File hash:', fileHash);
// Output: "a1b2c3d4e5f6..."

// 2. Generate encryption key
const key = await generateEncryptionKey();
console.log('Encryption key generated');

// 3. Encrypt file
const { encryptedData } = await encryptFile(file);
console.log('File encrypted:', {
  ciphertextLength: encryptedData.ciphertext.length,
  ivLength: encryptedData.iv.length
});
```

**Validation:**
- ✅ Button disabled
- ✅ Progress bar appears
- ✅ Progress: 10-20%
- ✅ Stage indicator: "🔐 Encrypting file..."
- ✅ Console logs encryption steps

#### Step 6: IPFS Upload - Encrypted File
**Progress: 30-50%**
**Stage: "☁️ Uploading to IPFS..."**
```javascript
// Upload encrypted file
const fileCID = await uploadFileToIPFS(encryptedBlob);
console.log('File uploaded to IPFS:', fileCID);
// Output: "QmX5ZaP..."
```

**Validation:**
- ✅ Progress advances
- ✅ Stage text updates
- ✅ Network request to Pinata API
- ✅ CID returned

#### Step 7: IPFS Upload - Encryption Key
**Progress: 50-70%**
```javascript
// Upload encryption key
const keyCID = await uploadJSONToIPFS(keyData);
console.log('Key uploaded to IPFS:', keyCID);
// Output: "QmY7BqW..."
```

**Validation:**
- ✅ Second IPFS upload succeeds
- ✅ Key CID returned
- ✅ Different from file CID

#### Step 8: Blockchain Transaction
**Progress: 70-90%**
**Stage: "⛓️ Storing on blockchain..."**
```javascript
// Call smart contract
const result = await recordRegistry.addRecord(
  patientAddress,      // 0xf39Fd6...
  fileCID,             // QmX5ZaP...
  keyCID,              // QmY7BqW...
  1,                   // Lab Result
  fileHash,            // 0xa1b2c3...
  description          // "Annual blood work..."
);
console.log('Transaction:', result);
```

**Validation:**
- ✅ MetaMask popup appears
- ✅ Transaction details shown
- ✅ Gas estimate: ~150,000

#### Step 9: Confirm Transaction
1. Review transaction in MetaMask
2. Click "Confirm"

**Expected Gas:**
```
Gas Limit: 150,000
Gas Price: 1.5 gwei
Total: ~0.000225 ETH
```

**Validation:**
- ✅ Transaction confirmed
- ✅ Transaction hash returned
- ✅ Event emitted:
```solidity
emit RecordAdded(
  1,              // recordId
  0xf39Fd6...,    // owner
  "QmX5ZaP...",   // dataCID
  1,              // Lab Result
  0xf39Fd6...,    // addedBy
  1700000100      // timestamp
);
```

#### Step 10: Audit Log
**Progress: 90-100%**
**Stage: "✅ Finalizing..."**
```javascript
// Log audit event
await auditLog.logEvent(
  1,              // recordId
  patientAddress, // actor
  1,              // RecordAdded
  fileHash        // actionHash
);
```

**Validation:**
- ✅ Audit transaction succeeds
- ✅ Event stored on blockchain

#### Step 11: Success & Refresh
1. Progress reaches 100%
2. Success message appears
3. Modal closes
4. Dashboard refreshes

**Validation:**
- ✅ Success message: "Record uploaded successfully!"
- ✅ Modal closes automatically
- ✅ New record appears in grid
- ✅ Stats updated: "1 Total Records"
- ✅ Record shows:
  - Type badge: "🧪 Lab Result"
  - Description: "Annual blood work..."
  - Date: Today's date
  - Added by: Own address

### Expected Final State

**Blockchain (RecordRegistry):**
```solidity
records[1] = {
  recordId: 1,
  owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
  dataCID: "QmX5ZaP...",
  encryptedKeyCID: "QmY7BqW...",
  recordType: 1,
  recordHash: 0xa1b2c3d4...,
  shortDescription: "Annual blood work - Complete metabolic panel",
  addedBy: 0xf39Fd6...,
  createdAt: 1700000100,
  isActive: true
}
```

**IPFS (Pinata):**
```
File: QmX5ZaP... (encrypted JSON blob)
Content: {
  version: "1.0",
  encrypted: true,
  algorithm: "AES-GCM-256",
  ciphertext: "base64_encrypted_data...",
  iv: "base64_iv...",
  salt: "base64_salt...",
  originalFileName: "test-lab-report.pdf",
  originalFileType: "application/pdf",
  originalFileSize: 2621440
}

Key: QmY7BqW... (encryption key JSON)
Content: {
  encryptedFor: "0xf39Fd6...",
  key: "base64_aes_key...",
  algorithm: "AES-GCM-256",
  createdAt: "2024-01-15T10:30:00.000Z"
}
```

**Blockchain (AuditLog):**
```solidity
Event: AuditEvent(
  recordId: 1,
  actor: 0xf39Fd6...,
  actionType: 1, // RecordAdded
  actionHash: 0xa1b2c3...,
  timestamp: 1700000100
)
```

### Performance Benchmarks
- File Hash Calculation: < 1 second
- Client-side Encryption: < 2 seconds
- IPFS Upload (File): 3-5 seconds
- IPFS Upload (Key): 1-2 seconds
- Blockchain TX: 2-3 seconds
- **Total Time: 10-15 seconds**

### Security Verification

**Verify Encryption:**
1. Check IPFS file content:
```bash
curl https://gateway.pinata.cloud/ipfs/QmX5ZaP...
```
2. Verify it's encrypted JSON, not plaintext PDF
3. Cannot open as PDF directly

**Verify Key Storage:**
1. Check key CID content
2. Verify key is present
3. Encrypted for specific address

**Verify Blockchain:**
1. Query record from smart contract
2. Verify CIDs match
3. Verify owner is correct
4. Verify hash matches

### Rollback Steps
1. Deactivate record:
```javascript
await recordRegistry.deactivateRecord(1);
```
2. Unpin from IPFS (optional):
```javascript
await unpinFromIPFS(fileCID);
await unpinFromIPFS(keyCID);
```

---

[Additional detailed test cases for TC-003 through TC-020 would follow the same format...]