'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet, signMessage, switchToLocalNetwork } from '@/lib/web3';
import { blockchainAPI } from '@/lib/blockchain-api';
import { storage } from '@/lib/storage';
import { generateUserKeyPair, exportPublicKey, exportPrivateKey } from '@/lib/encryption';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'connect' | 'role' | 'register' | 'auth'>('connect');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor'>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [walletCheck, setWalletCheck] = useState<'checking' | 'ready' | 'error'>('checking');
  const router = useRouter();

  // Check wallet availability on mount
  useEffect(() => {
    const checkWallet = () => {
      if (typeof window === 'undefined') {
        setWalletCheck('error');
        setError('Not in browser environment');
        return;
      }

      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        setWalletCheck('error');
        setError('MetaMask not installed. Please install MetaMask extension.');
        return;
      }

      // Check for Brave Wallet interference
      if (ethereum.isBraveWallet && !ethereum.providers) {
        setWalletCheck('error');
        setError(
          'Brave Wallet is blocking MetaMask.\n\n' +
          'To fix:\n' +
          '1. Open brave://settings/web3\n' +
          '2. Set wallet to "None (use extensions)"\n' +
          '3. Restart Brave\n' +
          '4. Refresh this page'
        );
        return;
      }

      // Check for MetaMask
      let hasMetaMask = false;

      if (ethereum.providers) {
        hasMetaMask = ethereum.providers.some(
          (p: any) => p.isMetaMask && !p.isBraveWallet
        );
      } else {
        hasMetaMask = ethereum.isMetaMask && !ethereum.isBraveWallet;
      }

      if (!hasMetaMask) {
        setWalletCheck('error');
        setError(
          'MetaMask not detected.\n\n' +
          'Please install MetaMask or disable other wallets.'
        );
        return;
      }

      console.log('✅ MetaMask detected and ready');
      setWalletCheck('ready');
      setError('');
    };

    checkWallet();
  }, []);

  const handleWalletConnect = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('=== WALLET CONNECTION START ===');

      // Connect wallet (no network switch yet)
      console.log('Connecting to MetaMask...');
      const walletResult = await connectWallet();

      const { address, chainId } = walletResult;
      console.log('✅ Connected:', address, 'Chain:', chainId);

      setWalletAddress(address);

      // Switch network if needed
      if (chainId !== 31337) {
        console.log('Wrong network detected, switching...');
        try {
          await switchToLocalNetwork();
          // Wait a moment for network switch
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.warn('Network switch failed:', err);
          setError('Please switch to Hardhat Local network in MetaMask manually');
          setLoading(false);
          return;
        }
      }

      // Check registration status
      console.log('Checking registration status...');

      let isPatient = false;
      try {
        isPatient = await blockchainAPI.isPatient(address);
      } catch (err) {
        console.log('Not a patient');
      }

      if (isPatient) {
        console.log('✅ Registered as patient');
        setSelectedRole('patient');
        setStep('auth');
        await handleAuthenticate(address, 'patient');
        return;
      }

      let isDoctor = false;
      try {
        isDoctor = await blockchainAPI.isVerifiedDoctor(address);
      } catch (err) {
        console.log('Not a verified doctor');
      }

      if (isDoctor) {
        console.log('✅ Registered as doctor');
        setSelectedRole('doctor');
        setStep('auth');
        await handleAuthenticate(address, 'doctor');
        return;
      }

      // Check if doctor pending
      try {
        const doctorInfo = await blockchainAPI.getDoctorInfo(address);
        if (doctorInfo.status === 0) {
          setError('Your doctor account is pending verification. Please wait for admin approval.');
          setLoading(false);
          return;
        } else if (doctorInfo.status === 2) {
          setError('Your doctor account was rejected. Please contact support.');
          setLoading(false);
          return;
        } else if (doctorInfo.status === 3) {
          setError('Your doctor account is suspended. Please contact support.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log('Not a registered doctor');
      }

      // New user
      console.log('New user - showing registration');
      setStep('register');
      setLoading(false);

    } catch (err: any) {
      console.error('=== CONNECTION ERROR ===');
      console.error(err);

      let errorMessage = err.message || 'Failed to connect wallet';

      // Make multi-line errors readable
      if (errorMessage.includes('\n')) {
        errorMessage = errorMessage.split('\n').map((line: string) => line.trim()).join('\n');
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Starting registration as:', selectedRole);

      // Step 1: Generate RSA key pair (with error handling)
      console.log('Generating encryption keys...');
      let keyPair, publicKey, privateKey;
      try {
        keyPair = await generateUserKeyPair();
        publicKey = await exportPublicKey(keyPair.publicKey);
        privateKey = await exportPrivateKey(keyPair.privateKey);
      } catch (err) {
        console.error('Key generation failed:', err);
        throw new Error('Failed to generate encryption keys. Please try again.');
      }

      // Step 2: Store keys in localStorage
      console.log('Storing keys...');
      try {
        localStorage.setItem(`publicKey_${walletAddress}`, publicKey);
        localStorage.setItem(`privateKey_${walletAddress}`, privateKey);
      } catch (err) {
        console.error('LocalStorage error:', err);
        throw new Error('Failed to store encryption keys. Please check browser storage permissions.');
      }

      // Step 3: Create profile metadata
      const profileMetadata = {
        publicKey,
        createdAt: new Date().toISOString(),
        role: selectedRole,
      };

      // Step 4: Upload profile to IPFS (with proper token handling)
      console.log('Uploading profile to IPFS...');
      let profileCID;
      try {
        // Generate temporary token or use empty auth
        const tempToken = storage.getToken() || '';

        const response = await fetch('/api/ipfs/upload-json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(tempToken ? { Authorization: `Bearer ${tempToken}` } : {}),
          },
          body: JSON.stringify({
            json: profileMetadata,
            metadata: {
              name: `${selectedRole}-profile-${walletAddress.slice(0, 10)}`,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'IPFS upload failed' }));
          throw new Error(errorData.error || 'Failed to upload profile to IPFS');
        }

        const data = await response.json();
        profileCID = data.cid;
        console.log('Profile uploaded to IPFS:', profileCID);
      } catch (err: any) {
        console.error('IPFS upload error:', err);
        throw new Error('Failed to upload profile: ' + (err.message || 'Unknown error'));
      }

      // Step 5: Register on blockchain
      console.log('Registering on blockchain...');
      try {
        if (selectedRole === 'patient') {
          await blockchainAPI.registerPatient(profileCID);
          console.log('Patient registered successfully');
        } else {
          if (!licenseNumber.trim()) {
            throw new Error('Medical license number is required for doctors');
          }
          await blockchainAPI.registerDoctor(profileCID, licenseNumber);
          console.log('Doctor registered successfully');

          setError('Doctor registration submitted! Your account is pending verification by an administrator. You will be able to login once approved.');
          setStep('connect');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error('Blockchain registration error:', err);

        // Handle "already registered" error gracefully
        if (err.message?.includes('already registered')) {
          console.log('User already registered, proceeding to authentication');
          await handleAuthenticate(walletAddress, selectedRole);
          return;
        }

        throw new Error('Blockchain registration failed: ' + (err.message || 'Unknown error'));
      }

      // Step 6: Authenticate
      console.log('Proceeding to authentication...');
      await handleAuthenticate(walletAddress, selectedRole);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
      setLoading(false);
    }
  };

  const handleAuthenticate = async (address: string, role: 'patient' | 'doctor') => {
    try {
      setLoading(true);
      console.log('Starting authentication for:', address, 'as', role);

      // Step 1: Request nonce
      console.log('Requesting nonce...');
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!nonceRes.ok) {
        const errorData = await nonceRes.json().catch(() => ({ error: 'Failed to get nonce' }));
        throw new Error(errorData.error || 'Failed to get nonce');
      }

      const { nonce } = await nonceRes.json();
      console.log('Nonce received:', nonce);

      // Step 2: Sign message
      console.log('Requesting signature...');
      const message = `Sign this message to authenticate with AI Decentralized HRS.\n\nNonce: ${nonce}\nRole: ${role}`;
      const signature = await signMessage(message);
      console.log('Message signed');

      // Step 3: Verify signature
      console.log('Verifying signature...');
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, role }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json().catch(() => ({ error: 'Verification failed' }));
        throw new Error(errorData.error || 'Verification failed');
      }

      const { token } = await verifyRes.json();
      console.log('Authentication successful');

      // Step 4: Store credentials
      storage.setToken(token);
      storage.setAddress(address);
      storage.setRole(role);

      // Step 5: Redirect to dashboard
      console.log('Redirecting to dashboard...');
      router.push('/dashboard');

    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="relative max-w-md w-full mx-4">
        {/* Decorative blob */}
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -top-10 -right-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-10 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

        <div className="relative bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 space-y-6 border border-white/20">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center transform rotate-3 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Health Records
            </h1>
            <p className="text-sm text-gray-600">
              Decentralized • Secure • Patient-Owned
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg animate-shake">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Connect Step */}
          {step === 'connect' && (
            <div className="space-y-4">
              <button
                onClick={handleWalletConnect}
                disabled={loading || walletCheck !== 'ready'}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {walletCheck === 'checking' ? (
                  'Checking MetaMask...'
                ) : walletCheck === 'error' ? (
                  'MetaMask Not Available'
                ) : loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                    Connect MetaMask Wallet
                  </>
                )}
              </button>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <div className="text-indigo-600 mb-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Encrypted</h3>
                  <p className="text-xs text-gray-600">AES-256 encryption</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                  <div className="text-purple-600 mb-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Blockchain</h3>
                  <p className="text-xs text-gray-600">Immutable records</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Requirements:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• MetaMask extension installed</li>
                      <li>• Connected to Hardhat Local network</li>
                      <li>• Test ETH in wallet</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Registration Step */}
          {step === 'register' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">Welcome! Select your role:</p>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </p>
              </div>

              <div className="space-y-3">
                {/* Patient Option */}
                <button
                  onClick={() => setSelectedRole('patient')}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${selectedRole === 'patient'
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedRole === 'patient' ? 'border-indigo-600' : 'border-gray-300'
                      }`}>
                      {selectedRole === 'patient' && (
                        <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">👤</span>
                        <p className="font-semibold text-gray-900">Patient</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Manage your health records and grant access to doctors
                      </p>
                    </div>
                  </div>
                </button>

                {/* Doctor Option */}
                <button
                  onClick={() => setSelectedRole('doctor')}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${selectedRole === 'doctor'
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedRole === 'doctor' ? 'border-purple-600' : 'border-gray-300'
                      }`}>
                      {selectedRole === 'doctor' && (
                        <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">⚕️</span>
                        <p className="font-semibold text-gray-900">Doctor</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Access patient records with permission
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* License Number for Doctors */}
              {selectedRole === 'doctor' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medical License Number *
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g., MD123456"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ Doctor accounts require admin verification before access
                  </p>
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={loading || (selectedRole === 'doctor' && !licenseNumber.trim())}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'Registering...' : 'Register & Continue'}
              </button>

              <button
                onClick={() => setStep('connect')}
                className="w-full text-gray-600 py-2 text-sm hover:text-gray-800 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Authentication Step */}
          {step === 'auth' && (
            <div className="text-center space-y-4 py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg animate-bounce">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Authenticating...</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Please sign the message in MetaMask
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Signing as: <span className="font-semibold">{selectedRole}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              🔒 Your private keys never leave your device
            </p>
          </div>
        </div>
      </div >

      <style jsx>{`
    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-blob {
      animation: blob 7s infinite;
    }
    .animation-delay-2000 {
      animation-delay: 2s;
    }
    .animation-delay-4000 {
      animation-delay: 4s;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
      20%, 40%, 60%, 80% { transform: translateX(2px); }
    }
    .animate-shake {
      animation: shake 0.5s;
    }
    .bg-grid-pattern {
      background-image: 
        linear-gradient(to right, rgb(229, 231, 235) 1px, transparent 1px),
        linear-gradient(to bottom, rgb(229, 231, 235) 1px, transparent 1px);
      background-size: 20px 20px;
    }
  `}</style>
    </div >
  );
}