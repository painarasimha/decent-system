import { ethers } from 'ethers';

/**
 * Production-ready wallet connection with proper provider isolation
 */

// Type for Ethereum provider
interface EthereumProvider {
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  providers?: EthereumProvider[];
}

/**
 * Get the correct MetaMask provider, avoiding conflicts
 */
function getMetaMaskProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const ethereum = (window as any).ethereum as EthereumProvider | undefined;

  if (!ethereum) {
    return null;
  }

  // Case 1: Multiple providers array exists
  if (ethereum.providers && Array.isArray(ethereum.providers)) {
    // Find MetaMask that's NOT Brave Wallet
    const metaMask = ethereum.providers.find(
      (provider) => provider.isMetaMask === true && provider.isBraveWallet !== true
    );

    if (metaMask) {
      console.log('✅ Found MetaMask in providers array');
      return metaMask;
    }

    console.warn('⚠️ MetaMask not found in providers array');
    return null;
  }

  // Case 2: Single provider - verify it's MetaMask
  if (ethereum.isMetaMask === true && ethereum.isBraveWallet !== true) {
    console.log('✅ MetaMask is the default provider');
    return ethereum;
  }

  // Case 3: Brave Wallet is active
  if (ethereum.isBraveWallet === true) {
    console.error('❌ Brave Wallet is active - blocking MetaMask');
    return null;
  }

  console.warn('⚠️ Unknown provider detected');
  return null;
}

/**
 * Initialize ethers provider
 */
export const getProvider = () => {
  const metaMask = getMetaMaskProvider();

  if (metaMask) {
    return new ethers.BrowserProvider(metaMask as any);
  }

  // Fallback for server-side or no wallet
  return new ethers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'
  );
};

/**
 * Connect to MetaMask wallet - Production ready
 */
export const connectWallet = async () => {
  console.log('🔌 Initiating wallet connection...');

  // 1. Verify we're in browser
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection only available in browser');
  }

  // 2. Get MetaMask provider
  const metaMask = getMetaMaskProvider();

  if (!metaMask) {
    const ethereum = (window as any).ethereum;
    
    if (!ethereum) {
      throw new Error(
        'MetaMask not installed.\n\n' +
        'Please install MetaMask from:\nhttps://metamask.io/download/'
      );
    }

    if (ethereum.isBraveWallet) {
      throw new Error(
        'Brave Wallet is blocking MetaMask.\n\n' +
        'To fix:\n' +
        '1. Type: brave://settings/web3\n' +
        '2. Set "Default Ethereum wallet" to "None"\n' +
        '3. Restart Brave browser\n' +
        '4. Try connecting again'
      );
    }

    throw new Error(
      'MetaMask not detected.\n\n' +
      'Please ensure MetaMask extension is enabled and refresh the page.'
    );
  }

  try {
    console.log('📞 Requesting accounts from MetaMask...');

    // 3. Request accounts using the isolated provider
    const accounts = await metaMask.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error(
        'No accounts available.\n\n' +
        'Please unlock MetaMask and try again.'
      );
    }

    const address = accounts[0];
    console.log('✅ Account connected:', address);

    // 4. Create ethers provider from the MetaMask provider
    const provider = new ethers.BrowserProvider(metaMask as any);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();

    console.log('✅ Wallet connection complete');
    console.log('   Address:', address);
    console.log('   Network:', Number(network.chainId));

    return {
      provider,
      signer,
      address,
      chainId: Number(network.chainId),
    };

  } catch (error: any) {
    console.error('❌ Wallet connection failed:', error);

    // Handle user rejection
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error(
        'Connection rejected.\n\n' +
        'Please approve the connection request in MetaMask.'
      );
    }

    // Handle pending request
    if (error.code === -32002) {
      throw new Error(
        'Connection request already pending.\n\n' +
        'Please check MetaMask for an open popup and approve it.'
      );
    }

    // Handle locked wallet
    if (error.message?.includes('locked')) {
      throw new Error(
        'MetaMask is locked.\n\n' +
        'Please unlock MetaMask and try again.'
      );
    }

    // Generic error
    throw new Error(
      error.message || 'Failed to connect to MetaMask.\n\n' +
      'Please check MetaMask extension and try again.'
    );
  }
};

/**
 * Sign message
 */
export const signMessage = async (message: string): Promise<string> => {
  const metaMask = getMetaMaskProvider();

  if (!metaMask) {
    throw new Error('MetaMask not available');
  }

  const provider = new ethers.BrowserProvider(metaMask as any);
  const signer = await provider.getSigner();

  return await signer.signMessage(message);
};

/**
 * Switch to Hardhat Local network
 */
export const switchToLocalNetwork = async (): Promise<void> => {
  const metaMask = getMetaMaskProvider();

  if (!metaMask) {
    console.warn('Cannot switch network - MetaMask not available');
    return;
  }

  const chainId = '0x7A69'; // 31337 in hex

  try {
    await metaMask.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    console.log('✅ Switched to Hardhat Local');
  } catch (error: any) {
    // Network doesn't exist - add it
    if (error.code === 4902) {
      try {
        await metaMask.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId,
              chainName: 'Hardhat Local',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['http://127.0.0.1:8545'],
            },
          ],
        });
        console.log('✅ Added Hardhat Local network');
      } catch (addError) {
        console.error('Failed to add network:', addError);
        throw new Error('Failed to add Hardhat Local network');
      }
    } else if (error.code === 4001) {
      throw new Error('Network switch rejected');
    } else {
      console.warn('Network switch error:', error);
    }
  }
};

/**
 * Get current connected address
 */
export const getCurrentAddress = async (): Promise<string | null> => {
  const metaMask = getMetaMaskProvider();

  if (!metaMask) {
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(metaMask as any);
    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch {
    return null;
  }
};

/**
 * Check if on correct network
 */
export const isCorrectNetwork = async (): Promise<boolean> => {
  const metaMask = getMetaMaskProvider();

  if (!metaMask) {
    return false;
  }

  try {
    const provider = new ethers.BrowserProvider(metaMask as any);
    const network = await provider.getNetwork();
    return Number(network.chainId) === 31337;
  } catch {
    return false;
  }
};

/**
 * Listen for account changes
 */
export const onAccountsChanged = (
  callback: (accounts: string[]) => void
): (() => void) | undefined => {
  const metaMask = getMetaMaskProvider();

  if (!metaMask || !metaMask.on) {
    return undefined;
  }

  metaMask.on('accountsChanged', callback);

  return () => {
    metaMask.removeListener?.('accountsChanged', callback);
  };
};

/**
 * Listen for network changes
 */
export const onChainChanged = (
  callback: (chainId: string) => void
): (() => void) | undefined => {
  const metaMask = getMetaMaskProvider();

  if (!metaMask || !metaMask.on) {
    return undefined;
  }

  metaMask.on('chainChanged', callback);

  return () => {
    metaMask.removeListener?.('chainChanged', callback);
  };
};