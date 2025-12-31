'use client';

import type { Conversation } from '@/types';
import { api } from '@/lib/api';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onConversationDeleted?: () => void;
}

export default function ConversationList({ conversations, selectedConversation, onSelectConversation, onConversationDeleted }: Props) {
  const { user: currentUser } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation(); // Empêcher la sélection de la conversation
    
    if (!confirm('Supprimer cette conversation ? Cette action est irréversible.')) {
      return;
    }

    setDeletingId(conversationId);
    try {
      await api.deleteConversation(conversationId);
      alert('✅ Conversation supprimée');
      if (onConversationDeleted) {
        onConversationDeleted();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('❌ Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          <span className="text-3xl">💬</span>
        </div>
        <p className="text-gray-700 font-medium">Pas de conversations</p>
        <p className="text-sm mt-1 text-gray-500">Ajoute des amis pour discuter ! 🔥</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conversation) => {
        // Trouver l'autre participant (pas l'utilisateur actuel)
        const otherParticipant = conversation.participants?.find(p => p.user_id !== currentUser?.id)?.user;
        const isSelected = selectedConversation?.id === conversation.id;

        return (
          <div
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={`w-full p-2.5 md:p-4 text-left hover:bg-orange-50 transition relative group cursor-pointer ${
              isSelected ? 'bg-orange-100 border-l-4 border-orange-500' : ''
            }`}
          >
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm md:text-base">
                {otherParticipant?.display_name?.[0]?.toUpperCase() || otherParticipant?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-gray-800 truncate">
                    {otherParticipant?.display_name || otherParticipant?.username || 'Unknown'}
                  </h4>
                  {conversation.messages?.[0] && (
                    <span className="text-xs text-gray-500">
                      {new Date(conversation.messages[0].created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {conversation.messages?.[0] && (
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.messages[0].content || 'Media'}
                  </p>
                )}
              </div>
              
              {/* Bouton de suppression - Visible sur mobile, hover sur desktop */}
              <button
                onClick={(e) => handleDelete(e, conversation.id)}
                disabled={deletingId === conversation.id}
                className="p-2 hover:bg-red-100 rounded-full transition-all disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                title="Supprimer la conversation"
              >
                {deletingId === conversation.id ? (
                  <span className="text-gray-400">⏳</span>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
