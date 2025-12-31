# 🚀 Guide de Déploiement Production - Bored Chat

## ✅ Checklist Complète

### 1. 📦 Préparer les Fichiers

```bash
cd /home/akharn/chat-app/bored-chat

# Vérifier que tous les fichiers sont là
ls -la

# Doit contenir:
# ✅ ecosystem.config.js  (config PM2)
# ✅ deploy.sh           (script de déploiement)
# ✅ .env.example        (exemple de config)
# ✅ .gitignore          (fichiers à ignorer)
# ✅ README.md           (documentation)
```

### 2. 🌐 Créer le Repository GitHub

1. **Aller sur GitHub**: https://github.com/new

2. **Remplir le formulaire**:
   - Repository name: `bored-chat`
   - Description: `🔥 Application de chat temps réel avec Next.js, TypeScript et Go`
   - Visibility: **Public** (ou Private si tu préfères)
   - ⚠️ **NE PAS** cocher "Initialize with README"
   - ⚠️ **NE PAS** ajouter .gitignore
   - ⚠️ **NE PAS** choisir de license

3. **Créer le repository**

4. **Copier l'URL HTTPS** (affichée après création):
   ```
   https://github.com/TON_USERNAME/bored-chat.git
   ```

### 3. 📤 Pousser le Code sur GitHub

**Option A - Script automatique** (recommandé):
```bash
./push-to-github.sh
# Puis coller ton URL GitHub quand demandé
```

**Option B - Manuellement**:
```bash
# Ajouter le remote
git remote add origin https://github.com/TON_USERNAME/bored-chat.git

# Vérifier la branche
git branch -M main

# Pousser
git push -u origin main
```

### 4. 🎨 Personnaliser le README sur GitHub

1. Aller sur ton repo GitHub
2. Éditer `README.md`
3. Remplacer `VOTRE_USERNAME` par ton vrai username GitHub
4. Commit les changements

### 5. 🏗️ Déployer en Production avec PM2

```bash
cd /home/akharn/chat-app/bored-chat

# Exécuter le script de déploiement
./deploy.sh
```

**Ce script va** :
1. ✅ Installer les dépendances
2. ✅ Build Next.js en mode production
3. ✅ Vérifier que le backend Docker tourne
4. ✅ Démarrer l'app avec PM2
5. ✅ Sauvegarder la config PM2
6. ✅ Configurer auto-start au boot

### 6. ✅ Vérifier que tout fonctionne

```bash
# Vérifier PM2
pm2 status

# Doit afficher:
# ┌─────┬──────────────────────┬─────────┬─────────┐
# │ id  │ name                 │ status  │ restart │
# ├─────┼──────────────────────┼─────────┼─────────┤
# │ 0   │ bored-chat-frontend  │ online  │ 0       │
# └─────┴──────────────────────┴─────────┴─────────┘

# Voir les logs
pm2 logs bored-chat-frontend --lines 50

# Vérifier le backend Docker
cd ../chat-service-go
docker-compose ps

# Doit afficher:
# boredchat-service   Up   0.0.0.0:9000->8080/tcp
# boredchat-postgres  Up   0.0.0.0:5433->5432/tcp
```

### 7. 🌍 Tester l'Application

**Sur le serveur** :
```bash
curl http://localhost:3000
# Doit retourner du HTML
```

**Dans le navigateur** :
- Local: http://localhost:3000
- Réseau: http://157.180.36.122:3000

**Tester** :
1. ✅ Landing page charge
2. ✅ Inscription fonctionne
3. ✅ Login fonctionne
4. ✅ Chat en temps réel
5. ✅ Upload d'image
6. ✅ Indicateur de frappe

### 8. 🔄 Mettre à Jour après un Git Pull

```bash
# Pull les changements
git pull origin main

# Rebuild et redémarrer
npm install
npm run build
pm2 restart bored-chat-frontend
```

Ou simplement :
```bash
./deploy.sh
```

---

## 🛠️ Commandes Utiles

### PM2

```bash
# État général
pm2 status

# Logs en temps réel
pm2 logs bored-chat-frontend

# Logs des erreurs uniquement
pm2 logs bored-chat-frontend --err

# Redémarrer
pm2 restart bored-chat-frontend

# Arrêter
pm2 stop bored-chat-frontend

# Supprimer
pm2 delete bored-chat-frontend

# Monitorer (CPU, RAM)
pm2 monit

# Sauvegarder la config
pm2 save

# Liste des apps sauvegardées
pm2 list

# Flush les logs
pm2 flush
```

### Docker (Backend)

```bash
cd ../chat-service-go

# Voir les conteneurs
docker-compose ps

# Logs du backend
docker-compose logs -f chat-service

# Logs de PostgreSQL
docker-compose logs -f postgres

# Redémarrer le backend
docker-compose restart chat-service

# Rebuild le backend
docker-compose build chat-service
docker-compose up -d chat-service

# Tout arrêter
docker-compose down

# Tout redémarrer
docker-compose up -d
```

### Git

```bash
# Voir les changements
git status

# Ajouter tous les fichiers modifiés
git add -A

# Commit
git commit -m "Description des changements"

# Push
git push origin main

# Pull
git pull origin main

# Voir l'historique
git log --oneline

# Annuler le dernier commit (garder les changements)
git reset --soft HEAD~1
```

---

## 🔥 Script de Redéploiement Rapide

Créer un alias dans `~/.bashrc` :

```bash
echo 'alias redeploy-chat="cd /home/akharn/chat-app/bored-chat && git pull && ./deploy.sh"' >> ~/.bashrc
source ~/.bashrc
```

Puis :
```bash
redeploy-chat
```

---

## 🐛 Troubleshooting

### PM2 ne démarre pas

```bash
# Vérifier Node.js
node --version  # Doit être >= 18

# Vérifier PM2
pm2 --version

# Réinstaller PM2
npm install -g pm2

# Rebuild l'app
rm -rf .next
npm run build
pm2 restart bored-chat-frontend
```

### Backend Docker ne démarre pas

```bash
cd ../chat-service-go

# Voir les erreurs
docker-compose logs chat-service

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Port 3000 déjà utilisé

```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 PID

# Ou changer le port dans ecosystem.config.js
env: {
  PORT: 3001
}
```

### Images ne chargent pas

```bash
# Vérifier .env.local
cat .env.local

# Doit contenir l'URL correcte
NEXT_PUBLIC_API_URL=http://157.180.36.122:9000/api

# Rebuild
npm run build
pm2 restart bored-chat-frontend
```

---

## 📊 Monitoring

### PM2 Plus (optionnel)

```bash
# Créer un compte sur https://app.pm2.io
# Puis connecter
pm2 plus
```

### Logs Système

```bash
# Logs PM2
tail -f /home/akharn/chat-app/bored-chat/logs/pm2-out.log
tail -f /home/akharn/chat-app/bored-chat/logs/pm2-error.log

# Logs système
journalctl -u pm2-akharn -f
```

---

## 🎯 Prochaines Étapes

1. ✅ Configurer un domaine (ex: chat.mondomaine.com)
2. ✅ Installer Nginx comme reverse proxy
3. ✅ Ajouter SSL/HTTPS avec Let's Encrypt
4. ✅ Configurer un backup automatique de la DB
5. ✅ Mettre en place un monitoring (Grafana/Prometheus)

---

**L'application tourne maintenant 24/7 en production ! 🎉**
