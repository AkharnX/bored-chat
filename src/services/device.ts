// Device management service for multi-device E2EE
// Each device gets a unique ID and its own keypair

import { api } from '@/lib/api';
import { getOrCreateKeyPair, getPublicKey } from './crypto';

const DEVICE_ID_KEY = 'bored_chat_device_id';

// Generate a unique device ID (UUID v4)
function generateDeviceId(): string {
  return crypto.randomUUID();
}

// Get or create a device ID for this browser/device
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// Get the current device ID (returns null if not set)
export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_ID_KEY);
}

// Get a human-readable device name based on browser/OS
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown';
  
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  
  // Detect browser
  if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
  }
  
  // Detect OS
  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  }
  
  return `${browser} on ${os}`;
}

// Register this device with its public key on the server
export async function registerDeviceWithServer(): Promise<boolean> {
  try {
    const deviceId = getOrCreateDeviceId();
    const deviceName = getDeviceName();
    
    // Ensure we have a keypair
    getOrCreateKeyPair();
    const publicKey = getPublicKey();
    
    if (!publicKey) {
      console.error('[Device] No public key available');
      return false;
    }
    
    await api.registerDevice(deviceId, publicKey, deviceName);
    console.log('[Device] Device registered successfully:', deviceId);
    return true;
  } catch (error) {
    console.error('[Device] Failed to register device:', error);
    return false;
  }
}

// Check if we have a valid device registration
export function hasDeviceId(): boolean {
  return !!getDeviceId();
}
