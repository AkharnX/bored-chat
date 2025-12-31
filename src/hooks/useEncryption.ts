'use client';

import { useState, useEffect, useCallback } from 'react';
import * as encryption from '@/lib/encryption';

export function useEncryption(conversationId: string | undefined) {
  const [initialized, setInitialized] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);

  // Initialiser le chiffrement pour cette conversation
  useEffect(() => {
    if (!conversationId) return;

    const init = async () => {
      try {
        // Initialiser ou récupérer la clé
        const keyStr = await encryption.initializeConversation(conversationId);
        const imported = await encryption.importKey(keyStr);
        setKey(imported);
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize encryption:', error);
      }
    };

    init();
  }, [conversationId]);

  /**
   * Chiffre un message avant de l'envoyer
   */
  const encrypt = useCallback(async (message: string): Promise<{ encrypted: string; iv: string } | null> => {
    if (!key) {
      console.warn('Encryption key not initialized');
      return null;
    }

    try {
      return await encryption.encryptMessage(message, key);
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      return null;
    }
  }, [key]);

  /**
   * Déchiffre un message reçu
   */
  const decrypt = useCallback(async (encryptedMessage: string, iv: string): Promise<string | null> => {
    if (!key) {
      console.warn('Encryption key not initialized');
      return null;
    }

    try {
      return await encryption.decryptMessage(encryptedMessage, iv, key);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return null;
    }
  }, [key]);

  return {
    initialized,
    encrypt,
    decrypt,
  };
}
