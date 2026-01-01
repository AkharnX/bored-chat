'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { user, isAuthenticated, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  
  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Delete account
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.username);
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleUpdateProfile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      await api.updateProfile(displayName || undefined, avatarUrl || undefined);
      setProfileSuccess('Profil mis à jour avec succès !');
      refreshUser();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setProfileLoading(false);
    }
  }, [displayName, avatarUrl, refreshUser]);

  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      setPasswordLoading(false);
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Mot de passe changé avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe');
    } finally {
      setPasswordLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  const handleDeleteAccount = useCallback(async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      await api.deleteAccount(deletePassword);
      logout();
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setDeleteLoading(false);
    }
  }, [deleteConfirm, deletePassword, logout, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <div className="w-20"></div>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profil
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d&apos;utilisateur
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Le nom d&apos;utilisateur ne peut pas être modifié</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom affiché
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none placeholder:text-gray-500"
                placeholder="Votre nom affiché"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de l&apos;avatar
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none placeholder:text-gray-500"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            {profileError && (
              <p className="text-red-500 text-sm">{profileError}</p>
            )}
            {profileSuccess && (
              <p className="text-green-500 text-sm">{profileSuccess}</p>
            )}

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {profileLoading ? 'Mise à jour...' : 'Mettre à jour le profil'}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Changer le mot de passe
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none placeholder:text-gray-500"
                placeholder="Entrez votre mot de passe actuel"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none placeholder:text-gray-500"
                placeholder="Entrez le nouveau mot de passe"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none placeholder:text-gray-500"
                placeholder="Confirmez le nouveau mot de passe"
                required
              />
            </div>

            {passwordError && (
              <p className="text-red-500 text-sm">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-green-500 text-sm">{passwordSuccess}</p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {passwordLoading ? 'Changement...' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-100">
          <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Zone dangereuse
          </h2>

          {!deleteConfirm ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                La suppression de votre compte est irréversible. Toutes vos conversations et messages seront définitivement supprimés.
              </p>
              <button
                onClick={handleDeleteAccount}
                className="w-full bg-red-500 text-white py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer mon compte
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-red-600 font-medium">
                ⚠️ Êtes-vous sûr ? Cette action est irréversible !
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entrez votre mot de passe pour confirmer
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none placeholder:text-gray-500"
                  placeholder="Votre mot de passe"
                />
              </div>

              {deleteError && (
                <p className="text-red-500 text-sm">{deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteConfirm(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || !deletePassword}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? 'Suppression...' : 'Confirmer la suppression'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <div className="mt-6">
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
