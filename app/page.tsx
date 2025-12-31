'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/chat');
    }
  }, [user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <main className="flex flex-col items-center justify-center gap-8 px-8 py-16 text-center">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Image src="/logo.png" alt="Bored Chat" width={70} height={70} />
            <h1 className="text-5xl md:text-6xl font-bold">
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Bored Chat
              </span>
            </h1>
          </div>
          <p className="text-lg text-gray-700 max-w-md font-light">
            Je m'ennuyais, alors j'ai fait ça. 🤷‍♂️
          </p>
          <p className="text-base text-gray-600 max-w-md font-light">
            Un chat simple entre potes. Pas de pub, pas de tracking, pas d'inconnus chelous.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link
            href="/register"
            className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-2xl shadow-lg hover:shadow-2xl hover:from-orange-600 hover:to-amber-600 transform hover:scale-105 transition-all duration-200"
          >
            C'est parti ! 🚀
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 bg-white text-gray-800 font-medium rounded-2xl shadow-lg hover:shadow-xl border-2 border-orange-200 hover:border-orange-400 transform hover:scale-105 transition-all duration-200"
          >
            J'ai déjà un compte
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <div className="bg-white/80 backdrop-blur p-6 rounded-3xl shadow-md border border-orange-100 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">🔐</div>
            <h3 className="font-semibold text-gray-800 mb-2">Chiffré E2E</h3>
            <p className="text-sm text-gray-600 font-light">
              Tes messages sont chiffrés de bout en bout. Même nous on peut pas les lire.
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur p-6 rounded-3xl shadow-md border border-orange-100 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-800 mb-2">Temps réel</h3>
            <p className="text-sm text-gray-600 font-light">
              Messages instantanés, indicateur de frappe, accusés de lecture
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur p-6 rounded-3xl shadow-md border border-orange-100 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="font-semibold text-gray-800 mb-2">Entre potes</h3>
            <p className="text-sm text-gray-600 font-light">
              Tu choisis avec qui tu discutes, pas d'inconnus bizarres
            </p>
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-600 font-light">
          <p>Fait avec ❤️ • Aucune pub • Tes données restent chez toi</p>
          <p className="mt-2 text-xs text-gray-500">
            Crafted by <span className="font-semibold text-orange-600">Ibrahim</span>, le créateur tout-puissant 👑✨
          </p>
        </div>
      </main>
    </div>
  );
}
