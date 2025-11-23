// Client-side storage utilities
export const storage = {
  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  },

  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  },

  removeToken: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('user_role');
    }
  },

  getAddress: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wallet_address');
    }
    return null;
  },

  setAddress: (address: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_address', address);
    }
  },

  getRole: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_role') as 'patient' | 'doctor' | null;
    }
    return null;
  },

  setRole: (role: 'patient' | 'doctor') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_role', role);
    }
  }
};