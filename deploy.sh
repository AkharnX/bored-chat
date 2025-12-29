#!/bin/bash

# 🚀 Script de Déploiement Production - Bored Chat
# Ce script build et démarre l'application avec PM2

set -e  # Arrêter si une commande échoue

echo "🔥 Bored Chat - Déploiement Production"
echo "======================================"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 n'est pas installé${NC}"
    echo "Installer avec: npm install -g pm2"
    exit 1
fi

# Répertoire du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install --production=false

echo ""
echo -e "${YELLOW}🔨 Build de l'application Next.js...${NC}"
npm run build

echo ""
echo -e "${YELLOW}🐳 Vérification du backend Docker...${NC}"
cd ../chat-service-go
if ! docker-compose ps | grep -q "boredchat-service.*Up"; then
    echo -e "${YELLOW}⚠️  Backend non démarré, démarrage...${NC}"
    docker-compose up -d
    echo "⏳ Attente du backend (5s)..."
    sleep 5
else
    echo -e "${GREEN}✅ Backend déjà en cours d'exécution${NC}"
fi

echo ""
echo -e "${YELLOW}🚀 Démarrage avec PM2...${NC}"
cd "$PROJECT_DIR"

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Arrêter l'ancienne instance si elle existe
pm2 delete bored-chat-frontend 2>/dev/null || true

# Démarrer avec PM2
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

# Configurer PM2 pour démarrer au boot
pm2 startup | grep -o 'sudo .*' | bash || true

echo ""
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
echo "📊 Commandes utiles:"
echo "  pm2 status              - Voir l'état"
echo "  pm2 logs bored-chat     - Voir les logs"
echo "  pm2 restart bored-chat  - Redémarrer"
echo "  pm2 stop bored-chat     - Arrêter"
echo ""
echo "🌐 Application disponible sur:"
echo "  http://localhost:3000"
echo "  http://157.180.36.122:3000"
echo ""
