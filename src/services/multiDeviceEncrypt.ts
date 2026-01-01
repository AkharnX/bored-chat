// Multi-device E2EE message encryption helper
// Fetches all device keys for recipient and sender, then encrypts for each

import { api } from '@/lib/api';
import { encryptForStorage, encryptForMultipleDevices } from './crypto';
import { getOrCreateDeviceId } from './device';

interface DeviceKey {
  deviceId: string;
  publicKey: string;
}

/**
 * Encrypt a message for all devices of recipient and sender
 * Falls back to single-key encryption if multi-device fetch fails
 */
export async function encryptMessageMultiDevice(
  plaintext: string,
  recipientUserId: string,
  senderUserId: string,
  recipientLegacyKey?: string | null
): Promise<string | null> {
  try {
    // Fetch device keys for both users in parallel
    const [recipientDevicesRes, senderDevicesRes] = await Promise.all([
      api.getUserDevices(recipientUserId).catch(() => ({ devices: [] })),
      api.getMyDevices().catch(() => ({ devices: [] })),
    ]);

    const recipientDeviceKeys: DeviceKey[] = recipientDevicesRes.devices.map(d => ({
      deviceId: d.device_id,
      publicKey: d.public_key,
    }));

    const senderDeviceKeys: DeviceKey[] = senderDevicesRes.devices.map(d => ({
      deviceId: d.device_id,
      publicKey: d.public_key,
    }));

    console.log('[E2EE MultiDevice] Recipient devices:', recipientDeviceKeys.length, 'Sender devices:', senderDeviceKeys.length);

    // If we have device keys for both, use multi-device encryption
    if (recipientDeviceKeys.length > 0 && senderDeviceKeys.length > 0) {
      const multiDeviceEncrypted = encryptForMultipleDevices(
        plaintext,
        recipientDeviceKeys,
        senderDeviceKeys
      );
      
      if (multiDeviceEncrypted) {
        console.log('[E2EE MultiDevice] Successfully encrypted for multiple devices');
        return JSON.stringify(multiDeviceEncrypted);
      }
    }

    // Fallback to legacy single-key encryption
    console.log('[E2EE MultiDevice] Falling back to single-key encryption');
    if (recipientLegacyKey) {
      return encryptForStorage(plaintext, recipientLegacyKey);
    }

    // No keys available at all
    console.error('[E2EE MultiDevice] No encryption keys available');
    return null;
  } catch (error) {
    console.error('[E2EE MultiDevice] Error:', error);
    
    // Try fallback to legacy encryption
    if (recipientLegacyKey) {
      return encryptForStorage(plaintext, recipientLegacyKey);
    }
    
    return null;
  }
}
