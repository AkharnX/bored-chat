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
 * Check if local public key matches server public key
 */
export function keysMatch(serverPublicKey: string | null | undefined): boolean {
  if (!serverPublicKey) return false;
  const localKey = getPublicKey();
  return localKey === serverPublicKey;
}

/**
 * Force regenerate keys and return the new public key
 */
export function regenerateKeys(): string {
  if (typeof window === 'undefined') return '';
  const keyPair = generateKeyPair();
  localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keyPair));
  return keyPair.publicKey;
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
      console.error('[E2EE] No secret key available');
      return null;
    }

    console.log('[E2EE] Attempting decrypt with local key:', keyPair.publicKey.substring(0, 20) + '...');

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
      console.warn('[E2EE] Decryption failed - wrong key or corrupted message');
      return null;
    }

    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('[E2EE] decryptMessage error:', error);
    return null;
  }
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
  if (typeof window === 'undefined') return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Check if a message content is encrypted (JSON with expected fields)
 */
export function isEncryptedMessage(content: string): boolean {
  try {
    // Decode HTML entities first (backend may encode " as &#34;)
    const decoded = decodeHtmlEntities(content);
    
    const parsed = JSON.parse(decoded);
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
export function tryDecrypt(content: string, isSender: boolean = false, fallbackToOriginal: boolean = true, myDeviceId?: string): string {
  // Client-side only
  if (typeof window === 'undefined') {
    return content;
  }

  if (!isEncryptedMessage(content)) {
    return content;
  }

  try {
    // Decode HTML entities first (backend may encode " as &#34;)
    const decoded = decodeHtmlEntities(content);
    const parsed = JSON.parse(decoded);
    
    console.log('[E2EE] tryDecrypt - isSender:', isSender, 'has forRecipient:', !!parsed.forRecipient, 'has forSender:', !!parsed.forSender);
    
    // Multi-device format (new)
    if (parsed.recipientDevices || parsed.senderDevices) {
      const deviceId = myDeviceId || localStorage.getItem('bored_chat_device_id') || '';
      const decrypted = decryptMultiDeviceMessage(parsed as MultiDeviceEncryptedMessage, deviceId, isSender);
      if (decrypted !== null) {
        return decrypted;
      }
      console.warn('[E2EE] Could not decrypt multi-device message');
      return '🔒 Message chiffré (clés incompatibles)';
    }
    
    // Dual encryption format (backward compat)
    if (parsed.forRecipient && parsed.forSender) {
      // Try the expected version first
      const primaryVersion = isSender ? parsed.forSender : parsed.forRecipient;
      console.log('[E2EE] Trying primary version (', isSender ? 'forSender' : 'forRecipient', ')');
      let decrypted = decryptMessage(primaryVersion as EncryptedMessage);
      
      if (decrypted !== null) {
        console.log('[E2EE] Primary decryption successful');
        return decrypted;
      }
      
      // If that fails, try the other version (in case of role confusion)
      const fallbackVersion = isSender ? parsed.forRecipient : parsed.forSender;
      console.log('[E2EE] Trying fallback version (', isSender ? 'forRecipient' : 'forSender', ')');
      decrypted = decryptMessage(fallbackVersion as EncryptedMessage);
      
      if (decrypted !== null) {
        return decrypted;
      }
      
      // Try both versions regardless of sender status
      decrypted = decryptMessage(parsed.forSender as EncryptedMessage);
      if (decrypted !== null) return decrypted;
      
      decrypted = decryptMessage(parsed.forRecipient as EncryptedMessage);
      if (decrypted !== null) return decrypted;
      
      console.warn('[E2EE] Could not decrypt with any key version');
      return '🔒 Message chiffré (clés incompatibles)';
    }
    
    // Legacy single encryption format
    const encrypted = parsed as EncryptedMessage;
    const decrypted = decryptMessage(encrypted);
    
    if (decrypted !== null) {
      return decrypted;
    }
    
    // Decryption failed - message was encrypted for someone else or keys changed
    return '🔒 Message chiffré (clés incompatibles)';
  } catch (e) {
    console.error('[E2EE] tryDecrypt error:', e);
    return fallbackToOriginal ? content : '🔒 Erreur de déchiffrement';
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

export interface DeviceEncryptedEnvelope {
  deviceId: string;
  encrypted: EncryptedMessage;
}

export interface MultiDeviceEncryptedMessage {
  // Array of envelopes for each device of the recipient
  recipientDevices: DeviceEncryptedEnvelope[];
  // Array of envelopes for each device of the sender (so sender can read on all their devices)
  senderDevices: DeviceEncryptedEnvelope[];
  // Fallback for single recipient key (backward compat)
  forRecipient?: EncryptedMessage;
  // Fallback for single sender key (backward compat)
  forSender?: EncryptedMessage;
}

/**
 * Encrypt a message for multiple devices
 * Each device gets its own encrypted envelope
 */
export function encryptForMultipleDevices(
  plaintext: string,
  recipientDeviceKeys: { deviceId: string; publicKey: string }[],
  senderDeviceKeys: { deviceId: string; publicKey: string }[]
): MultiDeviceEncryptedMessage | null {
  const recipientDevices: DeviceEncryptedEnvelope[] = [];
  const senderDevices: DeviceEncryptedEnvelope[] = [];
  
  // Encrypt for each recipient device
  for (const device of recipientDeviceKeys) {
    const encrypted = encryptMessage(plaintext, device.publicKey);
    if (encrypted) {
      recipientDevices.push({ deviceId: device.deviceId, encrypted });
    }
  }
  
  // Encrypt for each sender device
  for (const device of senderDeviceKeys) {
    const encrypted = encryptMessage(plaintext, device.publicKey);
    if (encrypted) {
      senderDevices.push({ deviceId: device.deviceId, encrypted });
    }
  }
  
  // At least one recipient and one sender envelope required
  if (recipientDevices.length === 0 || senderDevices.length === 0) {
    console.error('[E2EE] Failed to encrypt for all devices');
    return null;
  }
  
  // Also include single-key fallback for backward compat
  // Use the first device's key as fallback
  const forRecipient = recipientDevices[0]?.encrypted;
  const forSender = senderDevices[0]?.encrypted;
  
  return {
    recipientDevices,
    senderDevices,
    forRecipient,
    forSender,
  };
}

/**
 * Try to decrypt a multi-device message by finding the envelope for our device
 */
export function decryptMultiDeviceMessage(
  message: MultiDeviceEncryptedMessage,
  myDeviceId: string,
  isSender: boolean
): string | null {
  const envelopes = isSender ? message.senderDevices : message.recipientDevices;
  
  // First, try to find our exact device envelope
  if (envelopes && Array.isArray(envelopes)) {
    const myEnvelope = envelopes.find(e => e.deviceId === myDeviceId);
    if (myEnvelope) {
      const decrypted = decryptMessage(myEnvelope.encrypted);
      if (decrypted) return decrypted;
    }
    
    // Try all envelopes in case deviceId changed
    for (const envelope of envelopes) {
      const decrypted = decryptMessage(envelope.encrypted);
      if (decrypted) return decrypted;
    }
  }
  
  // Fallback to single-key format
  const fallback = isSender ? message.forSender : message.forRecipient;
  if (fallback) {
    const decrypted = decryptMessage(fallback);
    if (decrypted) return decrypted;
  }
  
  // Try the other direction as well
  const otherEnvelopes = isSender ? message.recipientDevices : message.senderDevices;
  if (otherEnvelopes && Array.isArray(otherEnvelopes)) {
    for (const envelope of otherEnvelopes) {
      const decrypted = decryptMessage(envelope.encrypted);
      if (decrypted) return decrypted;
    }
  }
  
  const otherFallback = isSender ? message.forRecipient : message.forSender;
  if (otherFallback) {
    const decrypted = decryptMessage(otherFallback);
    if (decrypted) return decrypted;
  }
  
  return null;
}
