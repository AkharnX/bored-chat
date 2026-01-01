/**
 * Local Message Store using IndexedDB
 * 
 * Stores decrypted messages locally so they remain readable even if E2EE keys change.
 * Like WhatsApp - messages are decrypted once and stored in clear text locally.
 */

import type { Message } from '@/types';

const DB_NAME = 'bored_chat_messages';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initMessageStore(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('[MessageStore] Failed to open IndexedDB');
        resolve(false);
      };
      
      request.onsuccess = () => {
        db = request.result;
        console.log('[MessageStore] IndexedDB initialized');
        resolve(true);
      };
      
      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        
        // Create messages store with indexes
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('conversation_id', 'conversation_id', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          console.log('[MessageStore] Created messages store');
        }
      };
    } catch (error) {
      console.error('[MessageStore] IndexedDB not available:', error);
      resolve(false);
    }
  });
}

/**
 * Get the database instance, initializing if needed
 */
async function getDb(): Promise<IDBDatabase | null> {
  if (db) return db;
  await initMessageStore();
  return db;
}

/**
 * Store a single decrypted message
 */
export async function storeMessage(message: Message): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Store with decrypted content
      const request = store.put({
        ...message,
        _stored_at: new Date().toISOString(),
      });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('[MessageStore] Failed to store message');
        resolve(false);
      };
    } catch (error) {
      console.error('[MessageStore] Store error:', error);
      resolve(false);
    }
  });
}

/**
 * Store multiple decrypted messages
 */
export async function storeMessages(messages: Message[]): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      let completed = 0;
      let errors = 0;
      
      messages.forEach((message) => {
        const request = store.put({
          ...message,
          _stored_at: new Date().toISOString(),
        });
        
        request.onsuccess = () => {
          completed++;
          if (completed + errors === messages.length) {
            resolve(errors === 0);
          }
        };
        
        request.onerror = () => {
          errors++;
          if (completed + errors === messages.length) {
            resolve(errors === 0);
          }
        };
      });
      
      if (messages.length === 0) resolve(true);
    } catch (error) {
      console.error('[MessageStore] Store batch error:', error);
      resolve(false);
    }
  });
}

/**
 * Get all messages for a conversation from local store
 */
export async function getLocalMessages(conversationId: string): Promise<Message[]> {
  const database = await getDb();
  if (!database) return [];
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('conversation_id');
      
      const request = index.getAll(conversationId);
      
      request.onsuccess = () => {
        const messages = request.result as Message[];
        // Sort by created_at
        messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        resolve(messages);
      };
      
      request.onerror = () => {
        console.error('[MessageStore] Failed to get messages');
        resolve([]);
      };
    } catch (error) {
      console.error('[MessageStore] Get error:', error);
      resolve([]);
    }
  });
}

/**
 * Get a single message by ID
 */
export async function getLocalMessage(messageId: string): Promise<Message | null> {
  const database = await getDb();
  if (!database) return null;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(messageId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        resolve(null);
      };
    } catch (error) {
      resolve(null);
    }
  });
}

/**
 * Check if a message exists locally
 */
export async function hasLocalMessage(messageId: string): Promise<boolean> {
  const message = await getLocalMessage(messageId);
  return message !== null;
}

/**
 * Delete a message from local store
 */
export async function deleteLocalMessage(messageId: string): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(messageId);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Delete all messages for a conversation
 */
export async function deleteConversationMessages(conversationId: string): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('conversation_id');
      
      const request = index.openCursor(conversationId);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      
      request.onerror = () => resolve(false);
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Clear all local messages (for logout)
 */
export async function clearAllMessages(): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[MessageStore] All messages cleared');
        resolve(true);
      };
      request.onerror = () => resolve(false);
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Get message count for a conversation
 */
export async function getMessageCount(conversationId: string): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('conversation_id');
      
      const request = index.count(conversationId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    } catch (error) {
      resolve(0);
    }
  });
}
