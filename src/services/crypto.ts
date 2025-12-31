/**
 * End-to-End Encryption Service using TweetNaCl
 * 
 * This service provides:
 * - Key pair generation (public/private)
 * - Message encryption using recipient's public key
 * - Message decryption using own private key
 * - Key storage in localStorage
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const KEYS_STORAGE_KEY = 'bored_chat_e2ee_keys';

export interface KeyPair {
  publicKey: string;  // Base64 encoded
  secretKey: string;  // Base64 encoded
}

export interface EncryptedMessage {
  ciphertext: string;  // Base64 encoded
  nonce: string;       // Base64 encoded
  ephemeralPublicKey: string;  // Base64 encoded (for box seal)
}

export interface DualEncryptedMessage {
  forRecipient: EncryptedMessage;
  forSender: EncryptedMessage;
}

/**
 * Generate a new key pair for E2EE
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}

/**
 * Get or create the user's key pair from localStorage
 */
export function getOrCreateKeyPair(): KeyPair {
  if (typeof window === 'undefined') {
    // SSR: return empty keys
    return { publicKey: '', secretKey: '' };
  }

  const stored = localStorage.getItem(KEYS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as KeyPair;
    } catch {
      // Invalid stored keys, regenerate
    }
  }

  const keyPair = generateKeyPair();
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keyPair));
  return keyPair;
}

/**
 * Get the user's public key (for sharing with others)
 */
export function getPublicKey(): string {
  return getOrCreateKeyPair().publicKey;
}

/**
 * Check if the user has E2EE keys
 */
export function hasKeys(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEYS_STORAGE_KEY) !== null;
}

/**
 * Clear stored keys (use with caution - messages will become unreadable!)
 */
export function clearKeys(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KEYS_STORAGE_KEY);
  }
}

/**
 * Encrypt a message for a recipient using their public key
 * Uses nacl.box with ephemeral keys for forward secrecy
 */
export function encryptMessage(plaintext: string, recipientPublicKey: string): EncryptedMessage | null {
  try {
    // Generate ephemeral key pair for this message (forward secrecy)
    const ephemeralKeyPair = nacl.box.keyPair();
    
    // Decode recipient's public key
    const recipientPubKeyBytes = decodeBase64(recipientPublicKey);
    
    // Generate random nonce
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    
    // Encrypt the message
    const messageBytes = decodeUTF8(plaintext);
    const ciphertext = nacl.box(
      messageBytes,
      nonce,
      recipientPubKeyBytes,
      ephemeralKeyPair.secretKey
    );

    if (!ciphertext) {
      return null;
    }

    return {
      ciphertext: encodeBase64(ciphertext),
      nonce: encodeBase64(nonce),
      ephemeralPublicKey: encodeBase64(ephemeralKeyPair.publicKey),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt a message using own private key
 */
export function decryptMessage(encrypted: EncryptedMessage): string | null {
  try {
    const keyPair = getOrCreateKeyPair();
    if (!keyPair.secretKey) {
      return null;
    }

    const secretKeyBytes = decodeBase64(keyPair.secretKey);
    const ciphertextBytes = decodeBase64(encrypted.ciphertext);
    const nonceBytes = decodeBase64(encrypted.nonce);
    const ephemeralPubKeyBytes = decodeBase64(encrypted.ephemeralPublicKey);

    const decrypted = nacl.box.open(
      ciphertextBytes,
      nonceBytes,
      ephemeralPubKeyBytes,
      secretKeyBytes
    );

    if (!decrypted) {
      return null;
    }

    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Check if a message content is encrypted (JSON with expected fields)
 */
export function isEncryptedMessage(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    // Check for dual encryption format (new)
    if (parsed.forRecipient && parsed.forSender) {
      return true;
    }
    // Check for single encryption format (legacy)
    return (
      typeof parsed === 'object' &&
      'ciphertext' in parsed &&
      'nonce' in parsed &&
      'ephemeralPublicKey' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Try to decrypt a message content, return original if not encrypted or decryption fails
 */
export function tryDecrypt(content: string, isSender: boolean = false, fallbackToOriginal: boolean = true): string {
  if (!isEncryptedMessage(content)) {
    return content;
  }

  try {
    const parsed = JSON.parse(content);
    
    // New dual encryption format
    if (parsed.forRecipient && parsed.forSender) {
      const encryptedVersion = isSender ? parsed.forSender : parsed.forRecipient;
      const decrypted = decryptMessage(encryptedVersion as EncryptedMessage);
      
      if (decrypted !== null) {
        return decrypted;
      }
      return fallbackToOriginal ? '🔒 Message chiffré (impossible à déchiffrer)' : content;
    }
    
    // Legacy single encryption format
    const encrypted = parsed as EncryptedMessage;
    const decrypted = decryptMessage(encrypted);
    
    if (decrypted !== null) {
      return decrypted;
    }
    
    // Decryption failed - message was encrypted for someone else or keys changed
    return fallbackToOriginal ? '🔒 Message chiffré (impossible à déchiffrer)' : content;
  } catch {
    return fallbackToOriginal ? content : '🔒 Message chiffré (erreur)';
  }
}

/**
 * Encrypt a message and return JSON string for storage
 * Includes both sender and recipient encrypted versions
 */
export function encryptForStorage(plaintext: string, recipientPublicKey: string): string | null {
  const myKeyPair = getOrCreateKeyPair();
  
  // Encrypt for recipient
  const forRecipient = encryptMessage(plaintext, recipientPublicKey);
  if (!forRecipient) {
    return null;
  }
  
  // Encrypt for sender (so they can re-read their own messages)
  const forSender = encryptMessage(plaintext, myKeyPair.publicKey);
  if (!forSender) {
    return null;
  }
  
  return JSON.stringify({
    forRecipient,
    forSender,
  });
}
