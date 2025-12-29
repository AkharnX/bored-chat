'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Conversation, Friendship } from '@/types';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import FriendsPanel from './FriendsPanel';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function ChatLayout() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  const { connected, sendTyping, onNewMessage, onTyping } = useWebSocket();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'gif') => {
    if (!selectedConversation) return;

    try {
      await api.sendMessage(selectedConversation.id, content, type);
      // Reload conversations to update last message
      loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('❌ Erreur lors de l\'envoi du message');
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100 overflow-hidden">
      {/* Sidebar - Mobile: pleine largeur, Desktop: 320px fixe */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col max-h-screen">
        {/* Header */}
        <div className="p-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{user?.display_name || user?.username}</h3>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-xs text-gray-600">{connected ? '🟢 En ligne' : '⚫ Hors ligne'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition"
              title="Déconnexion"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          {/* Tab buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFriends(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                !showFriends ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50 border border-orange-200'
              }`}
            >
              💬 Chats
            </button>
            <button
              onClick={() => setShowFriends(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                showFriends ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50 border border-orange-200'
              }`}
            >
              👥 Amis
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatWindow 
            conversation={selectedConversation} 
            onSendMessage={handleSendMessage}
            sendTyping={sendTyping}
            onNewMessage={onNewMessage}
            onTyping={onTyping}
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
    </div>
  );
}
