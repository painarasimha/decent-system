import { ethers } from 'ethers';

/**
 * Initialize provider with Brave compatibility
 */
export const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    // For Brave browser, ensure we're using MetaMask specifically
    if (window.ethereum.providers?.length) {
      // Multiple providers detected (Brave Wallet + MetaMask)
      const metaMaskProvider = window.ethereum.providers.find(
        (provider: any) => provider.isMetaMask
      );
      if (metaMaskProvider) {
        return new ethers.BrowserProvider(metaMaskProvider);
      }
    }
    
    // Single provider or MetaMask is default
    return new ethers.BrowserProvider(window.ethereum);
  }
  
  // Fallback for server-side or no wallet
  return new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545');
};

/**
 * Connect wallet with comprehensive error handling
 */
export const connectWallet = async (opts?: { 
  requiredChainIdHex?: string; 
  autoSwitch?: boolean; 
  timeoutMs?: number 
}) => {
  const requiredChainIdHex = opts?.requiredChainIdHex || '0x7A69'; // Hardhat local by default
  const autoSwitch = opts?.autoSwitch !== false; // default true
  const timeoutMs = opts?.timeoutMs || 15000;

  if (typeof window === 'undefined') {
    throw new Error('Window not available (SSR).');
  }

  const eth: any = (window as any).ethereum;
  if (!eth) {
    throw new Error('MetaMask not installed. Install the extension and refresh.');
  }

  let targetEthereum = eth;
  
  // Handle multiple wallet providers (Brave Wallet + MetaMask)
  if (eth.providers?.length) {
    const metaMaskProvider = eth.providers.find((p: any) => p.isMetaMask);
    if (!metaMaskProvider) {
      throw new Error(
        'Multiple wallets detected but MetaMask provider not found. ' +
        'Disable other wallets or select MetaMask as default (Brave Settings > Web3).'
      );
    }
    targetEthereum = metaMaskProvider;
  } else if (!eth.isMetaMask) {
    throw new Error('Non-MetaMask provider detected. Please use MetaMask.');
  }

  const provider = new ethers.BrowserProvider(targetEthereum);

  // Request accounts with timeout guard
  const accountRequest = provider.send('eth_requestAccounts', []);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('MetaMask request timed out. Open the extension and retry.'));
    }, timeoutMs);
  });

  let accounts: string[];
  try {
    accounts = await Promise.race([accountRequest, timeout]);
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error('Connection rejected in MetaMask.');
    }
    if (err.code === -32002) {
      throw new Error('Request already pending. Open MetaMask and complete the prompt.');
    }
    throw err;
  }

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts returned. Ensure MetaMask is unlocked.');
  }

  // Ensure correct network
  let network = await provider.getNetwork();
  const currentHex = '0x' + Number(network.chainId).toString(16).toUpperCase();
  
  if (autoSwitch && currentHex !== requiredChainIdHex.toUpperCase()) {
    try {
      await targetEthereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: requiredChainIdHex }],
      });
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        // Network doesn't exist, add it first
        await targetEthereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: requiredChainIdHex,
            chainName: 'Hardhat Local',
            nativeCurrency: { 
              name: 'Ether', 
              symbol: 'ETH', 
              decimals: 18 
            },
            rpcUrls: ['http://127.0.0.1:8545'],
          }],
        });
      } else {
        throw new Error('Failed to switch network: ' + (switchErr.message || switchErr.code));
      }
    }
    
    // Re-fetch network after switch
    network = await provider.getNetwork();
  }

  const signer = await provider.getSigner();
  const address = accounts[0];

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
  };
};

/**
 * Sign message with provider detection
 */
export const signMessage = async (message: string) => {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  let targetEthereum = window.ethereum;
  
  // Handle multiple providers
  if (window.ethereum.providers?.length) {
    const metaMaskProvider = window.ethereum.providers.find(
      (p: any) => p.isMetaMask
    );
    if (metaMaskProvider) {
      targetEthereum = metaMaskProvider;
    }
  }

  const provider = new ethers.BrowserProvider(targetEthereum);
  const signer = await provider.getSigner();
  
  return await signer.signMessage(message);
};

/**
 * Switch to local network (Hardhat)
 */
export const switchToLocalNetwork = async () => {
  if (!window.ethereum) {
    return;
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7A69' }], // 31337 in hex
    });
  } catch (error: any) {
    // If network doesn't exist, add it
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x7A69',
          chainName: 'Hardhat Local',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: ['http://127.0.0.1:8545'],
        }],
      });
    } else {
      // Don't throw error, just log
      console.warn('Failed to switch network:', error);
    }
  }
};

/**
 * Check if user is connected to correct network
 */
export const isCorrectNetwork = async (): Promise<boolean> => {
  if (!window.ethereum) {
    return false;
  }

  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    return chainId === 31337; // Hardhat local
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};

/**
 * Get current wallet address (if connected)
 */
export const getCurrentAddress = async (): Promise<string | null> => {
  if (!window.ethereum) {
    return null;
  }

  try {
    const provider = getProvider();
    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch (error) {
    return null;
  }
};

/**
 * Listen for account changes
 */
export const onAccountsChanged = (callback: (accounts: string[]) => void) => {
  if (!window.ethereum) {
    return;
  }

  const ethereum = window.ethereum; // ✅ Capture reference
  ethereum.on?.('accountsChanged', callback);
  
  // Return cleanup function
  return () => {
    ethereum.removeListener?.('accountsChanged', callback);
  };
};

/**
 * Listen for network changes
 */
export const onChainChanged = (callback: (chainId: string) => void) => {
  if (!window.ethereum) {
    return;
  }

  const ethereum = window.ethereum; // ✅ Capture reference
  ethereum.on?.('chainChanged', callback);
  
  // Return cleanup function
  return () => {
    ethereum.removeListener?.('chainChanged', callback);
  };
};