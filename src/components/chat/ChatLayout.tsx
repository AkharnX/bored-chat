'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Conversation, Friendship, Message } from '@/types';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import FriendsPanel from './FriendsPanel';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNotifications } from '@/hooks/useNotifications';
import { tryDecrypt } from '@/services/crypto';

export default function ChatLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  const { connected, sendTyping, onNewMessage, onTyping, onRead, onMessageEdited, onMessageDeleted } = useWebSocket();
  const { permission, requestPermission, showNotification, isSupported } = useNotifications();
  const [notificationRequested, setNotificationRequested] = useState(false);
  const conversationsRef = useRef<Conversation[]>([]);
  const selectedConversationIdRef = useRef<string | null>(null);

  // Fonction pour jouer un son de notification programmatique
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Créer un oscillateur pour un son de notification doux
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Son de notification: deux notes rapides
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // La 5
      oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.1); // Do 6
      
      oscillator.type = 'sine';
      
      // Volume avec fade out
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Fermer le contexte audio après le son
      setTimeout(() => {
        audioContext.close();
      }, 500);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, []);

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id || null;
  }, [selectedConversation?.id]);

  // Ne plus demander automatiquement - géré dans les paramètres
  // useEffect supprimé

  // Vérifier si les notifications sont activées dans les paramètres
  const areNotificationsEnabled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('notifications_enabled');
    return saved !== 'false'; // Par défaut true si non défini
  }, []);

  useEffect(() => {
    if (!onNewMessage) return;
    
    onNewMessage((msg: Message) => {
      const currentConvId = selectedConversationIdRef.current;
      
      if (msg.conversation_id === currentConvId) {
        return;
      }

      if (msg.sender_id === user?.id) {
        return;
      }

      const conversation = conversationsRef.current.find(c => c.id === msg.conversation_id);
      const sender = conversation?.participants?.find(p => p.user_id === msg.sender_id)?.user;
      const senderName = sender?.display_name || sender?.username || 'Quelqu\'un';
      const decryptedBody = msg.message_type === 'text'
        ? tryDecrypt(msg.content, false)
        : '📷 Image';

      // Vérifier si les notifications sont activées dans les paramètres
      if (permission === 'granted' && areNotificationsEnabled()) {
        showNotification(`💬 ${senderName}`, {
          body: decryptedBody,
          tag: msg.conversation_id,
          requireInteraction: false,
        });
      }

      // Jouer le son de notification seulement si activé
      if (areNotificationsEnabled()) {
        playNotificationSound();
      }
      
      loadConversations();
    });
  }, [onNewMessage, user?.id, permission, showNotification, playNotificationSound, areNotificationsEnabled]);

  // Handle message edited - refresh conversations to update preview
  useEffect(() => {
    if (!onMessageEdited) return;
    
    onMessageEdited((msg: Message) => {
      loadConversations();
    });
  }, [onMessageEdited]);

  // Handle message deleted - refresh conversations to update preview
  useEffect(() => {
    if (!onMessageDeleted) return;
    
    onMessageDeleted((messageId: string, conversationId: string) => {
      loadConversations();
    });
  }, [onMessageDeleted]);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSendMessage = useCallback(async (content: string, type: 'text' | 'image' | 'gif'): Promise<Message | null> => {
    if (!selectedConversation) return null;

    try {
      const message = await api.sendMessage(selectedConversation.id, content, type);
      loadConversations();
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('❌ Erreur lors de l\'envoi du message');
      return null;
    }
  }, [selectedConversation, loadConversations]);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-gray-100">
      <div className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col md:h-full ${
        selectedConversation ? 'hidden md:flex' : 'flex flex-1'
      }`}>
        <div className="p-2 md:p-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-semibold text-sm md:text-base">
                {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm md:text-base">{user?.display_name || user?.username}</h3>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-xs text-gray-600">{connected ? '🟢 En ligne' : '⚫ Hors ligne'}</span>
                </div>
              </div>
            </div>
            {/* Boutons desktop uniquement */}
            <div className="hidden md:flex items-center space-x-1">
              {isSupported && permission !== 'granted' && (
                <button
                  onClick={requestPermission}
                  className="p-1.5 md:p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition"
                  title="Activer les notifications"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              )}
              {permission === 'granted' && (
                <span className="p-1.5 md:p-2 text-green-600" title="Notifications activées">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </span>
              )}
              <button
                onClick={() => router.push('/settings')}
                className="p-1.5 md:p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition"
                title="Paramètres"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={logout}
                className="p-1.5 md:p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition"
                title="Déconnexion"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs desktop */}
          <div className="hidden md:flex space-x-1.5 md:space-x-2">
            <button
              onClick={() => setShowFriends(false)}
              className={`flex-1 py-1.5 px-3 md:py-2 md:px-4 rounded-lg font-medium transition text-sm ${
                !showFriends ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50 border border-orange-200'
              }`}
            >
              💬 Chats
            </button>
            <button
              onClick={() => setShowFriends(true)}
              className={`flex-1 py-1.5 px-3 md:py-2 md:px-4 rounded-lg font-medium transition text-sm ${
                showFriends ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50 border border-orange-200'
              }`}
            >
              👥 Amis
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {showFriends ? (
            <FriendsPanel onConversationCreated={loadConversations} />
          ) : (
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              onConversationDeleted={loadConversations}
            />
          )}
        </div>
      </div>

      {/* Main chat area - Mobile: pleine largeur quand sélectionnée */}
      <div className={`flex-1 flex flex-col min-h-0 h-full ${
        selectedConversation ? 'flex absolute inset-0 md:relative md:inset-auto z-10' : 'hidden md:flex'
      }`}>
        {selectedConversation ? (
          <ChatWindow 
            conversation={selectedConversation} 
            onSendMessage={handleSendMessage}
            sendTyping={sendTyping}
            onNewMessage={onNewMessage}
            onTyping={onTyping}
            onRead={onRead}
            onMessageEdited={onMessageEdited}
            onMessageDeleted={onMessageDeleted}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the list or add a new friend to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Mobile */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb ${
        selectedConversation ? 'hidden' : 'block'
      }`}>
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => setShowFriends(false)}
            className={`flex flex-col items-center px-4 py-2 rounded-lg transition ${
              !showFriends ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs mt-1">Chats</span>
          </button>
          <button
            onClick={() => setShowFriends(true)}
            className={`flex flex-col items-center px-4 py-2 rounded-lg transition ${
              showFriends ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs mt-1">Amis</span>
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="flex flex-col items-center px-4 py-2 rounded-lg transition text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-1">Paramètres</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
