#!/bin/bash

# 🚀 Script pour Pousser sur GitHub - Bored Chat

echo "📦 Bored Chat - Push vers GitHub"
echo "================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📝 Instructions:${NC}"
echo ""
echo "1. Va sur GitHub.com et crée un nouveau repository:"
echo "   https://github.com/new"
echo ""
echo "   Nom: bored-chat"
echo "   Description: Application de chat temps réel avec Next.js et Go"
echo "   Public ou Private: au choix"
echo "   ⚠️  NE PAS initialiser avec README, .gitignore ou license"
echo ""
echo "2. Une fois créé, copie l'URL du repo (format HTTPS ou SSH)"
echo "   Exemple: https://github.com/TON_USERNAME/bored-chat.git"
echo ""

read -p "Colle l'URL de ton repo GitHub ici: " GITHUB_URL

if [ -z "$GITHUB_URL" ]; then
    echo "❌ URL vide. Arrêt."
    exit 1
fi

echo ""
echo -e "${YELLOW}🔗 Ajout du remote GitHub...${NC}"
git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_URL"

echo ""
echo -e "${YELLOW}🌿 Vérification de la branche...${NC}"
git branch -M main

echo ""
echo -e "${YELLOW}📤 Push vers GitHub...${NC}"
git push -u origin main

echo ""
echo -e "${GREEN}✅ Succès !${NC}"
echo ""
echo "🌐 Ton repo est maintenant sur GitHub:"
echo "   $GITHUB_URL"
echo ""
echo "📚 Prochaines étapes:"
echo "  - Ajoute une belle image de preview"
echo "  - Configure GitHub Pages si besoin"
echo "  - Invite des collaborateurs"
echo ""
