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
    if (!token) return;

    try {
      const wsUrl = `${WS_URL}?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          
          if (data.type === 'message' && data.data) {
            const newMessage = data.data as Message;
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
            if (readCallbackRef.current && data.conversation_id) {
              readCallbackRef.current(data.conversation_id);
            }
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        setConnected(false);
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
