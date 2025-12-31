'use client';

/**
 * Système de chiffrement de bout en bout (E2E) pour Bored Chat
 * 
 * Utilise AES-GCM pour chiffrer les messages
 * Chaque conversation a une clé symétrique partagée entre les participants
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Génère une clé AES aléatoire pour une conversation
 */
export async function generateConversationKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Exporte une clé en format Base64
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Importe une clé depuis Base64
 */
export async function importKey(keyStr: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyStr);
  return await window.crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Chiffre un message
 */
export async function encryptMessage(message: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Générer un IV (Initialization Vector) aléatoire
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );

  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Déchiffre un message
 */
export async function decryptMessage(encryptedData: string, ivStr: string, key: CryptoKey): Promise<string> {
  const data = base64ToArrayBuffer(encryptedData);
  const iv = base64ToArrayBuffer(ivStr);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Stocke la clé d'une conversation
 */
export function storeConversationKey(conversationId: string, key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`e2e_key_${conversationId}`, key);
}

/**
 * Récupère la clé d'une conversation
 */
export function getConversationKey(conversationId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`e2e_key_${conversationId}`);
}

/**
 * Vérifie si une conversation a une clé
 */
export function hasConversationKey(conversationId: string): boolean {
  return getConversationKey(conversationId) !== null;
}

/**
 * Initialise le chiffrement pour une conversation
 */
export async function initializeConversation(conversationId: string): Promise<string> {
  // Vérifier si une clé existe déjà
  const existing = getConversationKey(conversationId);
  if (existing) {
    return existing;
  }

  // Générer une nouvelle clé
  const key = await generateConversationKey();
  const exported = await exportKey(key);

  // Stocker la clé
  storeConversationKey(conversationId, exported);

  return exported;
}

// Fonctions utilitaires
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

