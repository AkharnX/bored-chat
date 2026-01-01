'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Conversation, Message } from '@/types';
import { api } from '@/lib/api';
import { encryptForStorage, tryDecrypt } from '@/services/crypto';
import { encryptMessageMultiDevice } from '@/services/multiDeviceEncrypt';
import { 
  initMessageStore, 
  getLocalMessages, 
  storeMessages, 
  storeMessage,
  hasLocalMessage,
  deleteLocalMessage
} from '@/services/messageStore';
import AudioPlayer from './AudioPlayer';

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
  if (typeof window === 'undefined') return msg;
  
  const isSender = msg.sender_id === currentUserId;
  const decrypted = tryDecrypt(msg.content, isSender);
  return { ...msg, content: decrypted };
}

// Helper pour afficher le contenu déchiffré
function getDisplayContent(msg: Message, currentUserId: string | null): string {
  if (msg.message_type !== 'text') return msg.content;
  if (typeof window === 'undefined') return msg.content;
  
  const isSender = msg.sender_id === currentUserId;
  return tryDecrypt(msg.content, isSender);
}

// Helper pour formater la date du séparateur
function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) return "Aujourd'hui";
  if (isYesterday) return "Hier";
  
  return date.toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

// Helper pour vérifier si on doit afficher un séparateur de date
function shouldShowDateSeparator(currentMsg: Message, previousMsg: Message | null): boolean {
  if (!previousMsg) return true; // Toujours montrer pour le premier message
  
  const currentDate = new Date(currentMsg.created_at).toDateString();
  const previousDate = new Date(previousMsg.created_at).toDateString();
  
  return currentDate !== previousDate;
}

interface ChatWindowProps {
  conversation: Conversation | null;
  onSendMessage: (content: string, type: 'text' | 'image' | 'gif') => Promise<Message | null>;
  sendTyping?: (conversationId: string, isTyping: boolean) => void;
  onNewMessage?: (callback: (msg: Message) => void) => void;
  onTyping?: (callback: (userId: string, isTyping: boolean) => void) => void;
  onRead?: (callback: (conversationId: string) => void) => void;
  onMessageEdited?: (callback: (msg: Message) => void) => void;
  onMessageDeleted?: (callback: (messageId: string, conversationId: string) => void) => void;
  onBack?: () => void; // Pour fermer la conversation sur mobile
}

export default function ChatWindow({ conversation, onSendMessage, sendTyping, onNewMessage, onTyping, onRead, onMessageEdited, onMessageDeleted, onBack }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSelfTyping, setIsSelfTyping] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null); // URL de l'image en plein écran
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  
  // Message actions state
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure we're on client side before decrypting
  useEffect(() => {
    setIsClient(true);
  }, []);

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
        // Decrypt the E2EE message
        const currentUserId = api.getCurrentUserId();
        const decryptedMsg = decryptMessageContent(msg, currentUserId);
        
        // Store locally only if decryption succeeded
        if (!decryptedMsg.content.includes('🔒')) {
          storeMessage(decryptedMsg);
        }
        
        setMessages((prev) => {
          // Check duplicate
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, decryptedMsg];
        });

        // Marquer comme lu si ce n'est pas notre message
        if (msg.sender_id !== currentUserId) {
          api.markAsRead(currentConvId).catch(() => {});
        }
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

  // Handle message edited from WebSocket
  useEffect(() => {
    if (!onMessageEdited || !conversation) return;

    const handleMessageEdited = (editedMsg: Message) => {
      if (editedMsg.conversation_id === conversation.id) {
        // Decrypt the edited message
        const currentUserId = api.getCurrentUserId();
        const decryptedMsg = decryptMessageContent(editedMsg, currentUserId);
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === editedMsg.id ? decryptedMsg : msg
          )
        );
        
        // Mettre à jour le cache local IndexedDB
        storeMessage(decryptedMsg);
      }
    };

    onMessageEdited(handleMessageEdited);
  }, [onMessageEdited, conversation?.id]);

  // Handle message deleted from WebSocket
  useEffect(() => {
    if (!onMessageDeleted || !conversation) return;

    const handleMessageDeleted = (messageId: string, conversationId: string) => {
      if (conversationId === conversation.id) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        // Supprimer du cache local IndexedDB
        deleteLocalMessage(messageId);
      }
    };

    onMessageDeleted(handleMessageDeleted);
  }, [onMessageDeleted, conversation?.id]);

  // Initialize IndexedDB on mount
  useEffect(() => {
    initMessageStore();
  }, []);

  const loadMessages = useCallback(async () => {
    if (!conversation) return;
    
    setLoading(true);
    const currentUserId = api.getCurrentUserId();
    
    try {
      // 1. First, try to load from local IndexedDB (instant, already decrypted)
      const localMessages = await getLocalMessages(conversation.id);
      
      if (localMessages.length > 0) {
        // Show local messages immediately
        setMessages(localMessages);
        scrollToBottom();
      }
      
      // 2. Fetch from server to get any new messages
      const serverMessages = await api.getMessages(conversation.id);
      
      // Sort by date
      const sortedMessages = serverMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      // 3. Process messages: use local version if exists, otherwise decrypt and store
      const processedMessages: Message[] = [];
      const newMessagesToStore: Message[] = [];
      
      // Create a map of local messages for quick lookup
      const localMessageMap = new Map(localMessages.map(m => [m.id, m]));
      
      for (const serverMsg of sortedMessages) {
        const localMsg = localMessageMap.get(serverMsg.id);
        
        if (localMsg && !localMsg.content.includes('🔒')) {
          // Already have this message locally (already decrypted successfully)
          // Merge with server data to get reply_to and other relations
          processedMessages.push({
            ...serverMsg,
            content: localMsg.content, // Keep decrypted content from local
            reply_to: serverMsg.reply_to ? {
              ...serverMsg.reply_to,
              content: tryDecrypt(serverMsg.reply_to.content, serverMsg.reply_to.sender_id === currentUserId)
            } : undefined
          });
        } else {
          // New message or failed decryption before - try to decrypt again
          const decryptedMsg = decryptMessageContent(serverMsg, currentUserId);
          // Also decrypt reply_to content if exists
          if (serverMsg.reply_to) {
            decryptedMsg.reply_to = {
              ...serverMsg.reply_to,
              content: tryDecrypt(serverMsg.reply_to.content, serverMsg.reply_to.sender_id === currentUserId)
            };
          }
          processedMessages.push(decryptedMsg);
          
          // Only store if decryption was successful (not a locked message)
          if (!decryptedMsg.content.includes('🔒')) {
            newMessagesToStore.push(decryptedMsg);
          }
        }
      }
      
      // 4. Store new messages locally for future use
      if (newMessagesToStore.length > 0) {
        await storeMessages(newMessagesToStore);
      }
      
      setMessages(processedMessages);
      scrollToBottom();
    } catch (error) {
      // If server fails, at least show local messages
      const localMessages = await getLocalMessages(conversation.id);
      if (localMessages.length > 0) {
        setMessages(localMessages);
      }
    } finally {
      setLoading(false);
    }
  }, [conversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !conversation) return;

    const messageToSend = message;
    const replyToId = replyTo?.id || null;
    setMessage(''); // Vider immédiatement pour UX fluide
    setReplyTo(null); // Reset reply

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
      const currentUserId = api.getCurrentUserId();
      
      if (otherParticipant?.user_id && currentUserId) {
        // Utiliser le chiffrement multi-device
        const encrypted = await encryptMessageMultiDevice(
          messageToSend,
          otherParticipant.user_id,
          currentUserId,
          otherParticipant.user?.public_key // fallback legacy key
        );
        if (encrypted) {
          contentToSend = encrypted;
        }
      } else if (otherParticipant?.user?.public_key) {
        // Fallback: chiffrement legacy si pas d'IDs disponibles
        const encrypted = encryptForStorage(messageToSend, otherParticipant.user.public_key);
        if (encrypted) {
          contentToSend = encrypted;
        }
      }
      
      // Envoyer avec reply_to_id si on répond à un message
      const sentMessage = replyToId 
        ? await api.sendMessageWithReply(conversation.id, contentToSend, 'text', replyToId)
        : await onSendMessage(contentToSend, 'text');
      
      // Ajouter le message immédiatement à l'UI (avec le contenu déchiffré)
      if (sentMessage) {
        const displayMessage = { ...sentMessage, content: messageToSend, reply_to_id: replyToId || undefined };
        
        // Store locally
        storeMessage(displayMessage);
        
        setMessages((prev) => {
          if (prev.some(m => m.id === sentMessage.id)) return prev;
          return [...prev, displayMessage];
        });
        scrollToBottom();
      }
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
      const newMessage = await api.uploadMedia(file, conversation.id);
      // Ajouter le message localement (le WebSocket l'enverra aux autres)
      const currentUserId = api.getCurrentUserId();
      const decryptedMsg = decryptMessageContent(newMessage, currentUserId);
      
      // Store locally
      await storeMessage(decryptedMsg);
      
      setMessages((prev) => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, decryptedMsg];
      });
      scrollToBottom();
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

  // Démarrer l'enregistrement vocal
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Arrêter le stream
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendVoiceMessage(audioBlob);
        }
      };
      
      mediaRecorder.start(100); // Collecter des chunks toutes les 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Timer pour afficher la durée
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Erreur accès microphone:', error);
      alert('❌ Impossible d\'accéder au microphone. Vérifie les permissions.');
    }
  };

  // Arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Annuler l'enregistrement
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Arrêter le stream sans envoyer
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
    }
  };

  // Envoyer le message vocal
  const sendVoiceMessage = async (audioBlob: Blob) => {
    if (!conversation) return;
    
    setUploading(true);
    try {
      // Créer un fichier à partir du blob
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      
      const newMessage = await api.uploadMedia(audioFile, conversation.id, 'voice');
      const currentUserId = api.getCurrentUserId();
      const decryptedMsg = decryptMessageContent(newMessage, currentUserId);
      
      await storeMessage(decryptedMsg);
      
      setMessages((prev) => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, decryptedMsg];
      });
      scrollToBottom();
    } catch (error) {
      console.error('Erreur envoi message vocal:', error);
      alert('❌ Erreur lors de l\'envoi du message vocal');
    } finally {
      setUploading(false);
      setRecordingDuration(0);
    }
  };

  // Formater la durée d'enregistrement
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Message actions handlers
  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    setSelectedMsgId(null);
  };

  const handleEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditText(isClient ? getDisplayContent(msg, api.getCurrentUserId()) : msg.content);
    setSelectedMsgId(null);
  };

  const handleDelete = async (msg: Message) => {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      await api.deleteMessage(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      // Supprimer du cache local IndexedDB
      deleteLocalMessage(msg.id);
    } catch (error) {
      console.error('Erreur suppression message:', error);
      alert('❌ Erreur lors de la suppression');
    }
    setSelectedMsgId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editText.trim() || !conversation) return;
    try {
      // Chiffrer le message édité comme pour l'envoi
      const currentUserId = api.getCurrentUserId();
      const otherParticipant = conversation.participants?.find(
        p => p.user_id !== currentUserId
      );
      
      let contentToSend = editText;
      
      // Tenter le chiffrement multi-device d'abord
      if (otherParticipant?.user_id && currentUserId) {
        const encrypted = await encryptMessageMultiDevice(
          editText,
          otherParticipant.user_id,
          currentUserId,
          otherParticipant.user?.public_key
        );
        if (encrypted) {
          contentToSend = encrypted;
        }
      } else if (otherParticipant?.user?.public_key) {
        // Fallback: chiffrement legacy
        const encrypted = encryptForStorage(editText, otherParticipant.user.public_key);
        if (encrypted) {
          contentToSend = encrypted;
        }
      }
      
      await api.editMessage(editingMsg.id, contentToSend);
      
      // Mettre à jour localement avec le texte déchiffré pour l'affichage
      const updatedMsg = { ...editingMsg, content: editText, is_edited: true };
      setMessages((prev) =>
        prev.map((m) => (m.id === editingMsg.id ? updatedMsg : m))
      );
      
      // Mettre à jour le cache local IndexedDB
      storeMessage(updatedMsg);
      
      setEditingMsg(null);
      setEditText('');
    } catch (error) {
      console.error('Erreur modification message:', error);
      alert('❌ Erreur lors de la modification');
    }
  };

  const handleCancelEdit = () => {
    setEditingMsg(null);
    setEditText('');
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  // Touch handlers for mobile long press
  const handleTouchStart = (msgId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsgId(msgId);
    }, 400); // Réduit à 400ms pour plus de réactivité
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Handle tap on message to toggle actions on mobile
  const handleMessageTap = (e: React.MouseEvent, msgId: string) => {
    // Check if it's a touch device
    if (window.matchMedia('(hover: none)').matches) {
      e.preventDefault();
      setSelectedMsgId(selectedMsgId === msgId ? null : msgId);
    }
  };

  // Close actions when tapping outside
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Si on clique sur le container mais pas sur un message ou une action
    if (!target.closest('[data-message-bubble]') && !target.closest('[data-action-button]')) {
      setSelectedMsgId(null);
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
    <div className="flex-1 flex flex-col bg-white min-h-0 h-full">
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

      {/* Messages - scrollable area */}
      <div 
        className="flex-1 overflow-y-auto overscroll-contain p-2 md:p-4 lg:p-6 space-y-2 md:space-y-3 bg-gradient-to-br from-orange-50/30 to-amber-50/30" 
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={handleContainerClick}
      >
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
          messages.map((msg, index) => {
            const isOwn = msg.sender_id === api.getCurrentUserId();
            const displayContent = isClient ? getDisplayContent(msg, api.getCurrentUserId()) : msg.content;
            const previousMsg = index > 0 ? messages[index - 1] : null;
            const showDateSeparator = shouldShowDateSeparator(msg, previousMsg);
            const showActions = selectedMsgId === msg.id;
            
            return (
              <div key={msg.id}>
                {/* Séparateur de date */}
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="px-4 text-xs text-gray-500 font-medium bg-transparent">
                      {formatDateSeparator(new Date(msg.created_at))}
                    </span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>
                )}
                
                {/* Message avec actions */}
                <div 
                  className={`group flex ${isOwn ? 'justify-end' : 'justify-start'} relative`}
                  onMouseEnter={() => setSelectedMsgId(msg.id)}
                  onMouseLeave={() => setSelectedMsgId(null)}
                  onTouchStart={() => handleTouchStart(msg.id)}
                  onTouchEnd={handleTouchEnd}
                  onClick={(e) => handleMessageTap(e, msg.id)}
                  data-message-bubble="true"
                >
                  {/* Actions à gauche du message (si message propre) */}
                  {isOwn && showActions && (
                    <div className={`flex items-center gap-1 mr-2 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} data-action-button="true">
                      <button onClick={(e) => { e.stopPropagation(); handleReply(msg); }} className="p-1.5 bg-white rounded-full shadow hover:bg-orange-100 active:bg-orange-200" title="Répondre">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                      {msg.message_type === 'text' && (
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(msg); }} className="p-1.5 bg-white rounded-full shadow hover:bg-blue-100 active:bg-blue-200" title="Modifier">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(msg); }} className="p-1.5 bg-white rounded-full shadow hover:bg-red-100 active:bg-red-200" title="Supprimer">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-2xl ${
                      msg.message_type === 'text' 
                        ? 'px-3 md:px-4 py-2' 
                        : msg.message_type === 'voice'
                        ? 'px-3 py-2'
                        : 'overflow-hidden'
                    } ${
                      isOwn
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                      : 'bg-white border border-orange-100 text-gray-900'
                  }`}
                >
                  {/* Message cité (reply_to) */}
                  {msg.reply_to_id && msg.reply_to && (
                    <div className={`text-xs mb-1 p-2 rounded ${isOwn ? 'bg-orange-600/30' : 'bg-gray-100'} border-l-2 ${isOwn ? 'border-white/50' : 'border-orange-400'}`}>
                      <p className={`truncate ${isOwn ? 'text-white/80' : 'text-gray-600'}`}>
                        {msg.reply_to.message_type === 'text' 
                          ? tryDecrypt(msg.reply_to.content, msg.reply_to.sender_id === api.getCurrentUserId())
                          : msg.reply_to.message_type === 'voice' 
                            ? '🎤 Message vocal'
                            : '📷 Image'}
                      </p>
                    </div>
                  )}
                  {msg.message_type === 'text' ? (
                    <p className="break-words">{decodeHtmlEntities(displayContent)}</p>
                  ) : msg.message_type === 'voice' ? (
                    // Message vocal avec lecteur personnalisé
                    <AudioPlayer
                      src={msg.media_url?.startsWith('http') 
                        ? msg.media_url 
                        : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:9000'}${msg.media_url}`
                      }
                      isOwn={isOwn}
                    />
                  ) : (
                    // Image
                    <div>
                      <img
                        src={msg.media_url?.startsWith('http') 
                          ? msg.media_url 
                          : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:9000'}${msg.media_url}`
                        }
                        alt="Image partagée"
                        className="max-w-[250px] md:max-w-[300px] max-h-[300px] object-contain rounded-t-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImageModal(
                          msg.media_url?.startsWith('http') 
                            ? msg.media_url 
                            : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:9000'}${msg.media_url}`
                        )}
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
                    {msg.is_edited && (
                      <span className={`text-xs ${isOwn ? 'text-orange-100' : 'text-gray-400'}`}>
                        (modifié)
                      </span>
                    )}
                    {/* Double check pour les messages envoyés */}
                    {isOwn && (
                      <span className={`text-xs ${msg.is_read ? 'text-blue-300' : 'text-orange-100'}`}>
                        {msg.is_read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>

                  {/* Actions à droite du message (si message reçu) */}
                  {!isOwn && showActions && (
                    <div className={`flex items-center gap-1 ml-2 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} data-action-button="true">
                      <button onClick={(e) => { e.stopPropagation(); handleReply(msg); }} className="p-1.5 bg-white rounded-full shadow hover:bg-orange-100 active:bg-orange-200" title="Répondre">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    </div>
                  )}
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

      {/* Barre de réponse (si on répond à un message) */}
      {replyTo && (
        <div className="bg-orange-50 border-t border-orange-200 px-4 py-2 flex items-center gap-2">
          <div className="flex-1 border-l-4 border-orange-400 pl-3">
            <p className="text-xs text-orange-600 font-medium">↩️ Répondre à</p>
            <p className="text-sm text-gray-700 truncate">
              {isClient ? getDisplayContent(replyTo, api.getCurrentUserId()) : replyTo.content}
            </p>
          </div>
          <button onClick={handleCancelReply} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Barre d'édition (si on modifie un message) */}
      {editingMsg && (
        <div className="bg-blue-50 border-t border-blue-200 px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-blue-600 font-medium">✏️ Modification du message</span>
            <button onClick={handleCancelEdit} className="ml-auto p-1 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1 px-3 py-2 border border-blue-200 rounded-2xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-gray-900"
              autoFocus
            />
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 transition"
            >
              Sauvegarder
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="bg-white border-t border-orange-100 px-2 md:px-4 lg:px-6 py-2 md:py-3 flex-shrink-0 safe-area-bottom">
        {isRecording ? (
          // Interface d'enregistrement vocal
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 text-red-500 hover:bg-red-100 rounded-full transition flex-shrink-0"
              title="Annuler"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-red-50 rounded-2xl border border-red-200">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-600 font-medium">{formatDuration(recordingDuration)}</span>
              <div className="flex-1 h-1 bg-red-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 animate-pulse" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full hover:from-orange-600 hover:to-amber-600 transition shadow-lg flex-shrink-0"
              title="Envoyer"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        ) : editingMsg ? null : (
          // Interface normale de message
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
            
            {/* Bouton Micro ou Envoyer */}
            {message.trim() ? (
              <button
                type="submit"
                className="px-3 md:px-4 lg:px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-2xl hover:from-orange-600 hover:to-amber-600 transition shadow-lg text-sm flex-shrink-0"
              >
                <span className="hidden md:inline">Envoyer 🚀</span>
                <span className="md:hidden">🚀</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={uploading}
                className="p-2 text-orange-500 hover:bg-orange-100 rounded-full transition disabled:opacity-50 flex-shrink-0"
                title="Enregistrer un message vocal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </form>

      {/* Modal plein écran pour les images */}
      {imageModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 transition-colors z-10"
            onClick={() => setImageModal(null)}
            aria-label="Fermer"
          >
            ✕
          </button>
          <img
            src={imageModal}
            alt="Image en plein écran"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
