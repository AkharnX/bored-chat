'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { getPublicKey, hasKeys } from '@/services/crypto';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Sync public key with server
async function syncPublicKey(currentUser: User) {
  if (typeof window === 'undefined') return;
  
  const localPublicKey = getPublicKey();
  
  // If user doesn't have a public key on server, or it's different, update it
  if (localPublicKey && (!currentUser.public_key || currentUser.public_key !== localPublicKey)) {
    try {
      await api.updatePublicKey(localPublicKey);
    } catch (error) {
      console.error('Failed to sync public key:', error);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((currentUser) => {
          setUser(currentUser);
          // Sync E2EE public key with server
          syncPublicKey(currentUser);
        })
        .catch(() => {
          api.setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    api.setToken(response.token);
    
    // Sauvegarder l'utilisateur dans localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    setUser(response.user);
    
    // Sync E2EE public key with server after login
    syncPublicKey(response.user);
  };

  const register = async (username: string, email: string, password: string, displayName?: string) => {
    const response = await api.register(username, email, password, displayName);
    api.setToken(response.token);
    
    // Sauvegarder l'utilisateur dans localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    setUser(response.user);
    
    // Sync E2EE public key with server after registration
    syncPublicKey(response.user);
  };

  const logout = () => {
    api.setToken(null);
    
    // Supprimer l'utilisateur du localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
