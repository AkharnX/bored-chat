'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { getPublicKey, getOrCreateKeyPair, hasKeys } from '@/services/crypto';
import { encryptE2EEKey, decryptE2EEKey } from '@/services/e2eeBackup';
import { registerDeviceWithServer } from '@/services/device';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  e2eeReady: boolean;
  needsE2EERecovery: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_KEYS_STORAGE_KEY = 'bored_chat_e2ee_keys';

function getStoredLocalPublicKey(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCAL_KEYS_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { publicKey?: string };
    return parsed.publicKey || null;
  } catch {
    return null;
  }
}

async function restoreE2EEKey(password: string): Promise<boolean> {
  const { encrypted_key } = await api.getE2EEBackup();
  if (!encrypted_key) return false;
  try {
    const plain = await decryptE2EEKey(encrypted_key, password);
    const keyPair = JSON.parse(plain);
    if (keyPair.publicKey && keyPair.secretKey) {
      localStorage.setItem('bored_chat_e2ee_keys', JSON.stringify(keyPair));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

interface EnsureKeyResult {
  publicKey: string | null;
  restored: boolean;
  needsRecovery: boolean;
}

async function ensureLocalKeyPair(password: string, serverPublicKey?: string | null): Promise<EnsureKeyResult> {
  const existing = getStoredLocalPublicKey();
  if (existing) {
    return { publicKey: existing, restored: false, needsRecovery: false };
  }

  const restored = await restoreE2EEKey(password);
  if (restored) {
    const restoredKey = getStoredLocalPublicKey();
    return { publicKey: restoredKey, restored: true, needsRecovery: false };
  }

  if (serverPublicKey) {
    return { publicKey: null, restored: false, needsRecovery: true };
  }

  const keyPair = getOrCreateKeyPair();
  return { publicKey: keyPair.publicKey, restored: false, needsRecovery: false };
}

async function syncPublicKey(currentUser: User, allowOverwrite: boolean = false) {
  if (typeof window === 'undefined') return;
  
  const localPublicKey = getStoredLocalPublicKey();
  if (!localPublicKey) {
    console.warn('[E2EE] No local public key available for sync, skipping');
    return;
  }
  
  await registerDeviceWithServer();
  
  if (!currentUser.public_key) {
    console.log('[E2EE] No server key, uploading local key...');
    try {
      await api.updatePublicKey(localPublicKey);
      console.log('[E2EE] Key uploaded successfully');
    } catch (error) {
      console.error('[E2EE] Failed to upload public key:', error);
    }
    return;
  }

  if (currentUser.public_key === localPublicKey) {
    console.log('[E2EE] Keys already in sync');
    return;
  }

  if (!allowOverwrite) {
    console.warn('[E2EE] Server key differs from local key, not overwriting server key');
    return;
  }

  console.log('[E2EE] Overwriting server key with local key...');
  try {
    await api.updatePublicKey(localPublicKey);
    console.log('[E2EE] Key synced successfully');
  } catch (error) {
    console.error('[E2EE] Failed to sync public key:', error);
  }
}

async function backupE2EEKey(password: string) {
  const keyPair = getOrCreateKeyPair();
  const encrypted = await encryptE2EEKey(JSON.stringify(keyPair), password);
  await api.setE2EEBackup(encrypted);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [e2eeReady, setE2eeReady] = useState(false);
  const [needsE2EERecovery, setNeedsE2EERecovery] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((currentUser) => {
          setUser(currentUser);
          const hasLocalKeys = !!getStoredLocalPublicKey();
          setE2eeReady(hasLocalKeys);
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

    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    setUser(response.user);

    const serverPublicKey = response.user.public_key;
    let localPublicKey = getStoredLocalPublicKey();

    let restoredFromBackup = false;
    let needsRecovery = false;
    try {
      const ensured = await ensureLocalKeyPair(password, serverPublicKey);
      localPublicKey = ensured.publicKey;
      restoredFromBackup = ensured.restored;
      needsRecovery = ensured.needsRecovery;

      if (restoredFromBackup) {
        console.log('[E2EE] Cle E2EE restauree depuis la sauvegarde');
      }
    } catch (e) {
      console.error('[E2EE] Erreur lors de la restauration de cle E2EE:', e);
    }

    if (needsRecovery) {
      console.warn('[E2EE] Impossible de restaurer la cle existante');
      setNeedsE2EERecovery(true);
      setE2eeReady(false);
      if (typeof window !== 'undefined') {
        alert('Impossible de restaurer votre cle E2EE. Connectez-vous sur un appareil ayant deja la cle pour la sauvegarder.');
      }
      return;
    }

    setNeedsE2EERecovery(false);
    setE2eeReady(true);

    if (!localPublicKey) {
      localPublicKey = getPublicKey();
    }

    await syncPublicKey(
      { ...response.user, public_key: serverPublicKey },
      !serverPublicKey
    );

    try {
      await backupE2EEKey(password);
      console.log('[E2EE] Cle E2EE sauvegardee automatiquement');
    } catch (e) {
      console.error('[E2EE] Erreur lors de la sauvegarde de la cle E2EE:', e);
    }
  };

  const register = async (username: string, email: string, password: string, displayName?: string) => {
    const response = await api.register(username, email, password, displayName);
    api.setToken(response.token);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    setUser(response.user);
    
    getPublicKey();
    setE2eeReady(true);
    setNeedsE2EERecovery(false);

    syncPublicKey({ ...response.user, public_key: response.user.public_key }, true);
    
    try {
      await backupE2EEKey(password);
      console.log('[E2EE] Cle E2EE sauvegardee apres inscription');
    } catch (e) {
      console.error('[E2EE] Erreur lors de la sauvegarde de la cle E2EE:', e);
    }
  };

  const logout = () => {
    api.setToken(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    
    setUser(null);
    setE2eeReady(false);
    setNeedsE2EERecovery(false);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(currentUser));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, e2eeReady, needsE2EERecovery, login, register, logout, refreshUser }}>
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
