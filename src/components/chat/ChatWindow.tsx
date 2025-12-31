'use client';

import { useState, useRef, useEffect } from 'react';
import type { Conversation, Message } from '@/types';
import { api } from '@/lib/api';
import { encryptForStorage, tryDecrypt } from '@/services/crypto';

// Fonction pour décoder les entités HTML
function decodeHtmlEntities(text: string): string {
  if (typeof window === 'undefined') return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Décrypter un message (texte uniquement)
function decryptMessageContent(msg: Message, currentUserId: string | null): Message {
  if (msg.message_type !== 'text') return msg;
  
  const isSender = msg.sender_id === currentUserId;
  const decrypted = tryDecrypt(msg.content, isSender);
  return { ...msg, content: decrypted };
}

interface ChatWindowProps {
  conversation: Conversation | null;
  onSendMessage: (content: string, type: 'text' | 'image' | 'gif') => void;
  sendTyping?: (conversationId: string, isTyping: boolean) => void;
  onNewMessage?: (callback: (msg: Message) => void) => void;
  onTyping?: (callback: (userId: string, isTyping: boolean) => void) => void;
  onRead?: (callback: (conversationId: string) => void) => void;
  onBack?: () => void; // Pour fermer la conversation sur mobile
}

export default function ChatWindow({ conversation, onSendMessage, sendTyping, onNewMessage, onTyping, onRead, onBack }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSelfTyping, setIsSelfTyping] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (conversation) {
      currentConversationIdRef.current = conversation.id;
      loadMessages();
      // Réinitialiser le message lors du changement de conversation
      setMessage('');
    }
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!onNewMessage) return;
    
    const handleNewMessage = (msg: Message) => {
      const currentConvId = currentConversationIdRef.current;
      if (!currentConvId) return;
      
      if (msg.conversation_id === currentConvId) {
        // Déchiffrer le message E2EE
        const currentUserId = api.getCurrentUserId();
        const decryptedMsg = decryptMessageContent(msg, currentUserId);
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, decryptedMsg];
        });
      }
    };

    onNewMessage(handleNewMessage);
  }, [onNewMessage]);

  useEffect(() => {
    if (!onTyping || !conversation) return;

    const handleTyping = (userId: string, isTyping: boolean) => {
      const otherUser = conversation.participants?.find(
        p => p.user_id !== api.getCurrentUserId()
      );
      
      if (otherUser && userId === otherUser.user_id) {
        setOtherIsTyping(isTyping);
      }
    };

    onTyping(handleTyping);
  }, [onTyping, conversation?.id]);

  useEffect(() => {
    if (!onRead || !conversation) return;

    const handleRead = (conversationId: string) => {
      if (conversationId === conversation.id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id === api.getCurrentUserId()
              ? { ...msg, is_read: true }
              : msg
          )
        );
      }
    };

    onRead(handleRead);
  }, [onRead, conversation?.id]);

  const loadMessages = async () => {
    if (!conversation) return;
    
    setLoading(true);
    try {
      const data = await api.getMessages(conversation.id);
      // Trier par date : anciens en haut, nouveaux en bas
      const sortedMessages = data.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      // Déchiffrer les messages E2EE
      const currentUserId = api.getCurrentUserId();
      const decryptedMessages = sortedMessages.map(msg => decryptMessageContent(msg, currentUserId));
      setMessages(decryptedMessages);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !conversation) return;

    const messageToSend = message;
    setMessage(''); // Vider immédiatement pour UX fluide

    // Arrêter l'indicateur "est en train d'écrire"
    if (sendTyping && conversation) {
      sendTyping(conversation.id, false);
    }

    try {
      // Récupérer la clé publique du destinataire pour E2EE
      const otherParticipant = conversation.participants?.find(
        p => p.user_id !== api.getCurrentUserId()
      );
      
      let contentToSend = messageToSend;
      
      if (otherParticipant?.user?.public_key) {
        // Chiffrer le message avec la clé publique du destinataire
        const encrypted = encryptForStorage(messageToSend, otherParticipant.user.public_key);
        if (encrypted) {
          contentToSend = encrypted;
        }
      }
      
      await onSendMessage(contentToSend, 'text');
      // Recharger les messages après envoi
      await loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessage(messageToSend); // Restaurer le message en cas d'erreur
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    if (!sendTyping || !conversation) return;

    // Envoyer "est en train d'écrire" si pas déjà envoyé
    if (!isSelfTyping && value.length > 0) {
      setIsSelfTyping(true);
      sendTyping(conversation.id, true);
    }

    // Réinitialiser le timer
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Arrêter d'écrire après 2 secondes d'inactivité
    const timeout = setTimeout(() => {
      setIsSelfTyping(false);
      sendTyping(conversation.id, false);
    }, 2000);

    setTypingTimeout(timeout);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      alert('❌ Seules les images sont supportées pour le moment');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('❌ L\'image est trop grande (max 5MB)');
      return;
    }

    setUploading(true);
    try {
      await api.uploadMedia(file, conversation.id);
      await loadMessages();
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('❌ Erreur lors de l\'envoi de l\'image');
    } finally {
      setUploading(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Bored Chat</h3>
          <p className="text-gray-600 font-light">
            Sélectionne une conversation ou ajoute un ami pour commencer à discuter
          </p>
        </div>
      </div>
    );
  }

  const otherParticipant = conversation.participants?.find(
    p => p.user_id !== api.getCurrentUserId()
  );

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-orange-100 px-3 md:px-6 py-2.5 md:py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Bouton retour mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 hover:bg-orange-100 rounded-full transition"
              title="Retour aux conversations"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {otherParticipant?.user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">
              {otherParticipant?.user?.display_name || otherParticipant?.user?.username || 'Unknown'}
            </h2>
            <p className="text-sm text-gray-500">
              {otherParticipant?.user?.status === 'online' ? '🟢 En ligne' : '⚫ Hors ligne'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 lg:p-6 space-y-2 md:space-y-3 bg-gradient-to-br from-orange-50/30 to-amber-50/30">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500">⏳ Chargement des messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center text-gray-500 font-light">
              <div className="text-4xl mb-2">👋</div>
              <p>Aucun message encore. Dis bonjour !</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === api.getCurrentUserId();
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl ${
                    msg.message_type === 'text' 
                      ? 'px-3 md:px-4 py-2' 
                      : 'overflow-hidden'
                  } ${
                    isOwn
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                      : 'bg-white border border-orange-100 text-gray-900'
                  }`}
                >
                  {msg.message_type === 'text' ? (
                    <p className="break-words">{decodeHtmlEntities(msg.content)}</p>
                  ) : (
                    <div>
                      <img
                        src={msg.media_url?.startsWith('http') 
                          ? msg.media_url 
                          : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:9000'}${msg.media_url}`
                        }
                        alt="Image partagée"
                        className="max-w-[250px] md:max-w-[300px] max-h-[300px] object-contain rounded-t-lg"
                      />
                      {msg.content && (
                        <p className="px-3 py-2 break-words">{decodeHtmlEntities(msg.content)}</p>
                      )}
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-1 mt-1 ${
                      msg.message_type === 'text' ? '' : 'px-3 pb-2'
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        isOwn ? 'text-orange-100' : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {/* Double check pour les messages envoyés */}
                    {isOwn && (
                      <span className={`text-xs ${msg.is_read ? 'text-blue-300' : 'text-orange-100'}`}>
                        {msg.is_read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Indicateur "est en train d'écrire" */}
      {otherIsTyping && (
        <div className="px-3 md:px-6 py-2 text-sm text-gray-500 italic flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span>{otherParticipant?.user?.display_name || otherParticipant?.user?.username} est en train d'écrire...</span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="bg-white border-t border-orange-100 px-2 md:px-4 lg:px-6 py-2 md:py-3 flex-shrink-0 safe-area-bottom">
        <div className="flex gap-1.5 md:gap-2 lg:gap-3 items-center">
          {/* Bouton Image */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-orange-500 hover:bg-orange-100 rounded-full transition disabled:opacity-50 flex-shrink-0"
            title="Envoyer une image"
          >
            {uploading ? (
              <span className="text-xl">⏳</span>
            ) : (
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          <input
            type="text"
            value={message || ''}
            onChange={handleTyping}
            placeholder="Écris ton message..."
            className="flex-1 px-3 py-2 border border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400 text-sm"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-3 md:px-4 lg:px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-2xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg text-sm flex-shrink-0"
          >
            <span className="hidden md:inline">Envoyer 🚀</span>
            <span className="md:hidden">🚀</span>
          </button>
        </div>
      </form>
    </div>
  );
}
