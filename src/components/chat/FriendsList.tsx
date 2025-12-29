'use client';

import { useState, useEffect } from 'react';
import type { User, Friendship } from '@/types';
import { api } from '@/lib/api';

interface FriendsListProps {
  onClose: () => void;
}

export default function FriendsList({ onClose }: FriendsListProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'requests' | 'friends'>('search');
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
      const results = await api.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      alert('✅ Demande d\'ami envoyée !');
      setSearchResults(searchResults.filter(u => u.id !== userId));
    } catch (error) {
      alert('❌ Erreur lors de l\'envoi de la demande');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.acceptFriendRequest(requestId);
      alert('✅ Demande acceptée !');
      loadFriendRequests();
    } catch (error) {
      alert('❌ Erreur lors de l\'acceptation');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.rejectFriendRequest(requestId);
      alert('✅ Demande rejetée');
      loadFriendRequests();
    } catch (error) {
      alert('❌ Erreur lors du rejet');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-4 rounded-t-3xl flex justify-between items-center">
          <h2 className="text-2xl font-bold">👥 Amis</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-orange-100">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 font-medium transition ${
              activeTab === 'search'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-orange-500'
            }`}
          >
            🔍 Rechercher
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 font-medium transition ${
              activeTab === 'requests'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-orange-500'
            }`}
          >
            📬 Demandes
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 font-medium transition ${
              activeTab === 'friends'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-orange-500'
            }`}
          >
            ✅ Mes amis
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cherche un pote par nom ou email..."
                  className="flex-1 px-4 py-3 border border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-400 outline-none text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-2xl hover:from-orange-600 hover:to-amber-600 transition shadow-lg"
                >
                  🔍
                </button>
              </form>

              {loading ? (
                <div className="text-center py-8 text-gray-500">⏳ Recherche...</div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.username}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-amber-600 transition text-sm"
                      >
                        ➕ Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery && !loading ? (
                <div className="text-center py-8 text-gray-500 font-light">
                  Aucun utilisateur trouvé 😕
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-500">⏳ Chargement...</div>
              ) : friendRequests.length > 0 ? (
                friendRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                        {request.requester?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {request.requester?.username}
                        </p>
                        <p className="text-sm text-gray-600">Demande d'ami</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="px-4 py-2 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition text-sm"
                      >
                        ✅ Accepter
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="px-4 py-2 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition text-sm"
                      >
                        ❌ Refuser
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 font-light">
                  Aucune demande d'ami en attente 📭
                </div>
              )}
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-500">⏳ Chargement...</div>
              ) : friends.length > 0 ? (
                friends.map((friendship) => {
                  const friend = friendship.requester || friendship.addressee;
                  return (
                    <div
                      key={friendship.id}
                      className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-semibold">
                        {friend?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{friend?.username}</p>
                        <p className="text-sm text-gray-600">
                          {friend?.status === 'online' ? '🟢 En ligne' : '⚫ Hors ligne'}
                        </p>
                      </div>
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
    </div>
  );
}
