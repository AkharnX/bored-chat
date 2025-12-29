'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-4">
      <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl p-8 w-full max-w-md border border-orange-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Content de te revoir ! 👋</h1>
          <p className="text-gray-600 font-light">Entre tes identifiants pour retrouver tes potes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50/80 backdrop-blur border border-red-300 text-red-700 px-4 py-3 rounded-2xl font-light">
              😕 {error}
            </div>
          )}

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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? '⏳ Connexion...' : '🚀 Let\'s go !'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 font-light">
            Pas encore inscrit ?{' '}
            <Link href="/register" className="text-orange-600 hover:text-orange-700 font-medium">
              Crée ton compte ici
            </Link>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-orange-100">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 font-light">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Tes données restent privées 🔒</span>
          </div>
          <p className="text-center mt-3 text-xs text-gray-400">
            Made by <span className="text-orange-500 font-medium">Ibrahim</span> 👑
          </p>
        </div>
      </div>
    </div>
  );
}
