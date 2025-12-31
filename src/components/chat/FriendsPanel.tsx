'use client';

import { useState, useEffect } from 'react';
import type { User, Friendship } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface FriendsPanelProps {
  onConversationCreated: () => void;
}

export default function FriendsPanel({ onConversationCreated }: FriendsPanelProps) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'search' | 'requests' | 'friends'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'requests') {
      loadFriendRequests();
    } else if (activeTab === 'friends') {
      loadFriends();
    }
  }, [activeTab]);

  const loadFriendRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getFriendRequests();
      setFriendRequests(data);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    setLoading(true);
    try {
      const data = await api.getFriends();
      setFriends(data);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const users = await api.searchUsers(searchQuery);
      setSearchResults(users);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      alert('✅ Demande envoyée !');
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      alert('❌ Erreur lors de l\'envoi');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await api.acceptFriendRequest(friendshipId);
      alert('✅ Ami ajouté !');
      loadFriendRequests();
      onConversationCreated();
    } catch (error) {
      alert('❌ Erreur lors de l\'acceptation');
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await api.rejectFriendRequest(friendshipId);
      alert('❌ Demande rejetée');
      loadFriendRequests();
    } catch (error) {
      alert('❌ Erreur lors du rejet');
    }
  };

  const handleStartConversation = async (friendId: string) => {
    try {
      // Check if conversation already exists
      const existingConversations = await api.getConversations();
      const existingConv = existingConversations.find(conv => 
        conv.participants?.some(p => p.user?.id === friendId)
      );

      if (existingConv) {
        // Conversation exists, just notify and reload
        onConversationCreated();
        alert('💬 Conversation déjà existante !');
      } else {
        // Create new conversation
        await api.createConversation([friendId]);
        onConversationCreated();
        alert('✅ Conversation créée !');
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      alert('❌ Erreur lors de la création');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'friends'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-orange-500'
          }`}
        >
          👥 Amis
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-3 text-sm font-medium transition relative ${
            activeTab === 'requests'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-orange-500'
          }`}
        >
          📬 Demandes
          {friendRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {friendRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'search'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-orange-500'
          }`}
        >
          🔍 Chercher
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cherche un utilisateur..."
                className="w-full px-4 py-2 border border-gray-300 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 rounded-2xl font-medium hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Recherche...' : '🔍 Chercher'}
              </button>
            </form>

            <div className="space-y-3">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 hover:border-orange-300 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{user.username}</p>
                    <p className="text-xs text-gray-500">{user.display_name}</p>
                  </div>
                  <button
                    onClick={() => handleSendRequest(user.id)}
                    className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium hover:bg-orange-600 transition"
                  >
                    ➕ Ajouter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {friendRequests.length > 0 ? (
              friendRequests.map((request) => {
                // L'expéditeur est toujours celui qui a envoyé la demande (requester)
                const sender = request.requester;
                return (
                  <div
                    key={request.id}
                    className="p-4 bg-orange-50 rounded-2xl border border-orange-200 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                        {sender?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{sender?.username}</p>
                        <p className="text-xs text-gray-600">Veut être ton ami</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 rounded-xl font-medium hover:shadow-lg transition"
                      >
                        ✅ Accepter
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl font-medium hover:bg-gray-300 transition"
                      >
                        ❌ Refuser
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500 font-light">
                Aucune demande d'ami 📭
              </div>
            )}
          </div>
        )}

        {/* FRIENDS TAB */}
        {activeTab === 'friends' && (
          <div className="space-y-3">
            {friends.length > 0 ? (
              friends.map((friendship) => {
                // Déterminer qui est l'ami (l'autre personne, pas l'utilisateur actuel)
                const friend = friendship.requester_id === currentUser?.id 
                  ? friendship.addressee 
                  : friendship.requester;
                return (
                  <div
                    key={friendship.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 hover:border-orange-300 transition cursor-pointer"
                    onClick={() => handleStartConversation(friend?.id || '')}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                      {friend?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{friend?.username}</p>
                      <p className="text-xs text-gray-600">
                        {friend?.status === 'online' ? '🟢 En ligne' : '⚫ Hors ligne'}
                      </p>
                    </div>
                    <button className="text-orange-500 hover:text-orange-600">
                      💬
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500 font-light">
                Tu n'as pas encore d'amis 😕
                <br />
                <span className="text-sm">Commence par en chercher !</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
