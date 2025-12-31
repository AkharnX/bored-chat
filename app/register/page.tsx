'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(username, email, password, displayName || undefined);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-4">
      <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl p-8 w-full max-w-md border border-orange-100">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Bored Chat" width={80} height={80} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Bienvenue ! 🎉</h1>
          <p className="text-gray-600 font-light">Crée ton compte et commence à discuter</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50/80 backdrop-blur border border-red-300 text-red-700 px-4 py-3 rounded-2xl text-sm font-light">
              😕 {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Ton pseudo
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={50}
              className="w-full px-4 py-3 border border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
              placeholder="SuperPseudo"
            />
            <p className="mt-1 text-xs text-gray-500 font-light">Entre 3 et 50 caractères</p>
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
              Nom affiché (optionnel)
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 border border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
              placeholder="Ton vrai nom si tu veux"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Ton email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
              placeholder="ton.email@exemple.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-gray-500 font-light">Minimum 8 caractères</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? '⏳ Création du compte...' : '✨ Créer mon compte'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 font-light">
            Tu as déjà un compte ?{' '}
            <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium">
              Connecte-toi
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-orange-100">
          <p className="text-center text-xs text-gray-400">
            Propulsé par <span className="text-orange-500 font-medium">Ibrahim</span>, le tout-puissant de la plateforme 👑⚡
          </p>
        </div>
      </div>
    </div>
  );
}
