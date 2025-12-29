# 🔥 Bored Chat - Application de Messagerie en Temps RéelThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).



Application de chat moderne avec WebSocket, upload d'images, et indicateur de frappe en temps réel.## Getting Started



![Version](https://img.shields.io/badge/version-1.2.0-orange)First, run the development server:

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)```bash

npm run dev

## ✨ Fonctionnalités# or

yarn dev

- 💬 **Messagerie en temps réel** via WebSocket# or

- 📸 **Upload d'images** (max 5MB)pnpm dev

- ✍️ **Indicateur "est en train d'écrire"**# or

- 👥 **Gestion d'amis** (demandes, acceptation, refus)bun dev

- 🗑️ **Suppression de conversations**```

- 🟢 **Statut en ligne/hors ligne**

- 📱 **Design responsive** (mobile + desktop)Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

- 🎨 **Thème orange/amber moderne**

- 🔒 **Authentification JWT**You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.



## 🚀 Installation RapideThis project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.



```bash## Learn More

# 1. Cloner le repo

git clone https://github.com/VOTRE_USERNAME/bored-chat.gitTo learn more about Next.js, take a look at the following resources:

cd bored-chat

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

# 2. Installer les dépendances- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

npm install

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

# 3. Configurer l'environnement

cp .env.example .env.local## Deploy on Vercel

# Éditer .env.local avec votre configuration

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

# 4. Démarrer le backend (Docker)

cd ../chat-service-goCheck out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

docker-compose up -d

# 5. Retour au frontend
cd ../bored-chat

# Développement
npm run dev

# Production avec PM2
./deploy.sh
```

## 📊 Commandes PM2

```bash
pm2 status                      # État
pm2 logs bored-chat-frontend   # Logs
pm2 restart bored-chat-frontend # Redémarrer
pm2 stop bored-chat-frontend   # Arrêter
```

## 🛠️ Stack Technique

- **Frontend**: Next.js 16, TypeScript, TailwindCSS
- **Backend**: Go, Gin, PostgreSQL, Docker
- **Temps Réel**: WebSocket
- **Déploiement**: PM2

## 📚 Documentation

- [Installation Complète](INSTALL.md)
- [Nouvelles Fonctionnalités](NOUVELLES_FONCTIONNALITES.md)
- [Corrections et Fixes](FIX_CARACTERES_ET_IMAGES.md)

## 👨‍💻 Auteur

**Ibrahim (Akharn)**

## 📄 License

MIT
