'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { WSMessage, Message } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:9000/api/ws';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCallbackRef = useRef<((msg: Message) => void) | null>(null);
  const typingCallbackRef = useRef<((userId: string, isTyping: boolean) => void) | null>(null);
  const readCallbackRef = useRef<((conversationId: string) => void) | null>(null);

  const connect = useCallback(() => {
    const token = api.getToken();
    if (!token) {
      console.log('WebSocket: No token, skipping connection');
      return;
    }

    try {
      const wsUrl = `${WS_URL}?token=${token}`;
      console.log('WebSocket: Connecting to', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          console.log('🔔 WebSocket message received:', data.type, data);
          
          if (data.type === 'message' && data.data) {
            const newMessage = data.data as Message;
            setMessages((prev) => [...prev, newMessage]);
            // Appeler le callback si défini (pour rafraîchir ChatWindow)
            if (messageCallbackRef.current) {
              console.log('📤 Calling message callback for:', newMessage.id);
              messageCallbackRef.current(newMessage);
            } else {
              console.warn('⚠️ No message callback registered!');
            }
          } else if (data.type === 'typing') {
            console.log('🔍 Typing data:', data);
            // Le sender_id est au niveau racine, pas dans data.data
            const user_id = data.sender_id;
            const is_typing = data.data?.is_typing ?? false;
            
            console.log('🔍 Extracted:', { user_id, is_typing });
            
            if (is_typing) {
              setTypingUsers((prev) => ({ ...prev, [user_id]: '' }));
            } else {
              setTypingUsers((prev) => {
                const { [user_id]: _, ...rest } = prev;
                return rest;
              });
            }
            // Appeler le callback de typing
            if (typingCallbackRef.current) {
              typingCallbackRef.current(user_id, is_typing);
            }
          } else if (data.type === 'read') {
            // Messages lus - notifier pour rafraîchir
            if (readCallbackRef.current && data.conversation_id) {
              readCallbackRef.current(data.conversation_id);
            }
          }
          
          // Handle other message types (user_status)
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error (normal si pas encore connecté):', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 3s...');
        setConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);

  const sendMessage = useCallback((message: Partial<WSMessage>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    sendMessage({
      type: 'typing',
      conversation_id: conversationId, // Mettre à la racine pour le backend
      data: {
        conversation_id: conversationId,
        is_typing: isTyping,
      },
    });
  }, [sendMessage]);

  const onNewMessage = useCallback((callback: (msg: Message) => void) => {
    console.log('📝 Registering new message callback');
    messageCallbackRef.current = callback;
  }, []);

  const onTyping = useCallback((callback: (userId: string, isTyping: boolean) => void) => {
    typingCallbackRef.current = callback;
  }, []);

  const onRead = useCallback((callback: (conversationId: string) => void) => {
    readCallbackRef.current = callback;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected,
    messages,
    typingUsers,
    sendMessage,
    sendTyping,
    onNewMessage,
    onTyping,
    onRead,
    connect,
    disconnect,
  };
}
