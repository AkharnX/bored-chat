// E2EE Backup Service: Chiffre/déchiffre la clé privée avec le mot de passe utilisateur (AES)

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const saltFixed = new Uint8Array(salt);
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltFixed,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptE2EEKey(plainKey: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainKey)
  );
  // Format: base64(salt).base64(iv).base64(ciphertext)
  return [
    btoa(String.fromCharCode(...salt)),
    btoa(String.fromCharCode(...iv)),
    btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  ].join('.');
}

export async function decryptE2EEKey(encrypted: string, password: string): Promise<string> {
  const [saltB64, ivB64, ctB64] = encrypted.split('.');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
