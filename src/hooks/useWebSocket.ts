'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { WSMessage, Message } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:9000/api/ws';
const PING_INTERVAL = 25000; // Send ping every 25 seconds to keep connection alive

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageCallbackRef = useRef<((msg: Message) => void) | null>(null);
  const typingCallbackRef = useRef<((userId: string, isTyping: boolean) => void) | null>(null);
  const readCallbackRef = useRef<((conversationId: string) => void) | null>(null);

  const connect = useCallback(() => {
    const token = api.getToken();
    if (!token) return;

    // Clear any existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const wsUrl = `${WS_URL}?token=${token}`;
      console.log('[WebSocket] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnected(true);
        
        // Start ping interval to keep connection alive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          
          // Ignore pong responses
          if (data.type === 'pong') return;
          
          if (data.type === 'message' && data.data) {
            const newMessage = data.data as Message;
            console.log('[WebSocket] New message received:', newMessage.id);
            setMessages((prev) => [...prev, newMessage]);
            if (messageCallbackRef.current) {
              messageCallbackRef.current(newMessage);
            }
          } else if (data.type === 'typing') {
            const user_id = data.sender_id;
            const is_typing = data.data?.is_typing ?? false;
            
            if (is_typing) {
              setTypingUsers((prev) => ({ ...prev, [user_id]: '' }));
            } else {
              setTypingUsers((prev) => {
                const { [user_id]: _, ...rest } = prev;
                return rest;
              });
            }
            if (typingCallbackRef.current) {
              typingCallbackRef.current(user_id, is_typing);
            }
          } else if (data.type === 'read') {
            console.log('[WebSocket] Read event received:', JSON.stringify(data));
            const convId = data.conversation_id?.toString() || (data.data?.conversation_id?.toString());
            console.log('[WebSocket] Read event conversationId:', convId);
            if (readCallbackRef.current && convId) {
              readCallbackRef.current(convId);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected, code:', event.code);
        setConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Reconnecting...');
          connect();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);

  const sendMessage = useCallback((message: Partial<WSMessage>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send, not connected');
    }
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    console.log('[WebSocket] Sending typing:', conversationId, isTyping);
    sendMessage({
      type: 'typing',
      conversation_id: conversationId,
      data: {
        conversation_id: conversationId,
        is_typing: isTyping,
      },
    });
  }, [sendMessage]);

  const onNewMessage = useCallback((callback: (msg: Message) => void) => {
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
