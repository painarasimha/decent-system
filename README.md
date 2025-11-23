---

## 🧪 COMPLETE TESTING GUIDE

### Test Scenario 1: Patient Registration and Authentication

1. **Open browser**: http://localhost:3000

2. **You'll be redirected to login page**

3. **Click "Connect MetaMask Wallet"**
   - MetaMask popup appears
   - Click "Next" → "Connect"
   - Select Hardhat Local network

4. **Since you're a new user, you'll see role selection**:
   - Select "👤 Patient"
   - Click "Register & Continue"

5. **MetaMask asks to sign transaction** (registration on blockchain):
   - Click "Confirm"
   - Wait for transaction...

6. **MetaMask asks to sign message** (authentication):
   - Click "Sign"

7. **✅ You're now on the Dashboard!**

### Test Scenario 2: Add Health Record (Patient)

1. **On Dashboard**, scroll to "Add New Health Record"

2. **Enter a record hash**: `QmTest123PatientRecord`

3. **Click "Add Record"**

4. **MetaMask popup**: Click "Confirm"

5. **Wait for transaction...** (should take 1-2 seconds)

6. **✅ Success message appears!**

7. **Scroll to "Health Records" section** - you should see your record!

### Test Scenario 3: Doctor Registration

1. **Open Incognito/Private browsing window** (or different browser)

2. **In MetaMask, import another test account**:
   - Use Account #1 from Hardhat node output
   - Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

3. **Go to** http://localhost:3000

4. **Click "Connect MetaMask Wallet"**

5. **Select "⚕️ Doctor"**

6. **Click "Register & Continue"**

7. **Sign transaction and message**

8. **✅ Doctor dashboard loads!**

### Test Scenario 4: Grant Access (Patient → Doctor)

1. **Go back to Patient window**

2. **Copy Doctor's wallet address** (from Doctor's dashboard or MetaMask)

3. **In Patient dashboard**, scroll to "Grant Doctor Access"

4. **Paste doctor's address**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

5. **Click "Grant Access"**

6. **Confirm in MetaMask**

7. **✅ Success! Doctor now has access**

### Test Scenario 5: Doctor Views Patient Records

1. **Switch to Doctor window**

2. **Try to add a record for the patient**:
   - Enter Patient Address: (copy from patient dashboard)
   - Enter Record Hash: `QmDoctorAddedRecord456`
   - Click "Add Record"

3. **Confirm in MetaMask**

4. **✅ Record added!**

5. **Go back to Patient window** - the new record appears!

---

## ✅ SUCCESS CHECKLIST

After testing, verify:

- [ ] Patient can register and login
- [ ] Doctor can register and login
- [ ] Patient can add their own records
- [ ] Patient can grant access to doctor
- [ ] Doctor can view patient records (after access granted)
- [ ] Doctor can add records for patient (after access granted)
- [ ] Records show correct timestamps
- [ ] Wallet addresses display correctly
- [ ] Logout works and redirects to login
- [ ] MetaMask signatures work properly
- [ ] Transactions confirm on Hardhat network

---

## 🐛 Troubleshooting

### Problem: "Contract address not found"

**Solution**:
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Make sure `full-stack/lib/contracts/deployments.json` has the contract address.

### Problem: MetaMask shows "Nonce too high"

**Solution**:
- Go to MetaMask → Settings → Advanced → "Clear activity tab data"
- Or restart Hardhat node and re-deploy

### Problem: "User denied transaction"

**Solution**:
- Make sure you're clicking "Confirm" in MetaMask, not "Reject"

### Problem: Records not showing

**Solution**:
```bash
# Check console for errors
# Make sure contract is deployed
# Try refreshing the page
```

---

## 🎉 YOU'RE DONE!

Your full-stack blockchain health records system is now running with:

✅ Smart contracts on local blockchain  
✅ Wallet-based authentication (MetaMask)  
✅ Role-based access (Patient/Doctor)  
✅ Health records on blockchain  
✅ Access control system  
✅ Beautiful UI with Tailwind CSS  

**Next Steps**:
- Deploy to testnet (Sepolia