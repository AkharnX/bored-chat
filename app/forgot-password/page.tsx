'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('📧 Si votre email existe dans notre système, vous recevrez un lien de réinitialisation.');
        setEmail('');
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Image src="/logo.png" alt="Bored Chat" width={80} height={80} className="mx-auto mb-4" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
              Mot de passe oublié ?
            </h1>
            <p className="text-gray-600 font-light">
              Pas de problème ! Entrez votre email pour recevoir un lien de réinitialisation.
            </p>
          </div>

          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                placeholder="votre@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 focus:ring-4 focus:ring-orange-300 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Envoi en cours...
                </span>
              ) : (
                '📧 Envoyer le lien'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center space-y-3">
            <Link
              href="/login"
              className="block text-orange-600 hover:text-orange-700 font-medium transition"
            >
              ← Retour à la connexion
            </Link>
            <div className="text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <Link href="/register" className="text-orange-600 hover:text-orange-700 font-medium">
                S'inscrire
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
