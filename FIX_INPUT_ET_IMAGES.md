# 🔧 Correctifs Affichage Images et Input

## ✅ Problèmes Corrigés

### 1. ⚠️ Warning Input Non Contrôlé

**Erreur** :
```
A component is changing a controlled input to be uncontrolled
```

**Cause** : `message` pouvait devenir `undefined` lors du changement de conversation

**Solutions appliquées** :

1. **Réinitialisation explicite lors du changement de conversation** :
```typescript
useEffect(() => {
  if (conversation) {
    loadMessages();
    setMessage(''); // Reset le message
  }
}, [conversation?.id]);
```

2. **Garantie que value est toujours une chaîne** :
```tsx
<input
  type="text"
  value={message || ''} // Toujours une chaîne
  onChange={handleTyping}
  placeholder="Écris ton message..."
/>
```

---

### 2. 🖼️ Images Affichent "Media" au lieu de l'Image

**Problème** : Les images uploadées s'affichaient avec le texte "Media" dans les bulles de chat

**Causes** :
1. Padding de la bulle appliqué autour de l'image
2. URL relative des images (`/uploads/...`) sans le domaine du backend
3. Texte alternatif générique "Media"

**Solutions** :

#### A. Structure HTML améliorée
```tsx
{msg.message_type === 'text' ? (
  <p className="break-words">{msg.content}</p>
) : (
  <div>
    <img
      src={imageUrl}
      alt="Image partagée"
      className="max-w-full rounded-t-lg"
    />
    {msg.content && (
      <p className="px-3 py-2 break-words">{msg.content}</p>
    )}
  </div>
)}
```

#### B. Padding conditionnel sur la bulle
```tsx
<div
  className={`max-w-[85%] md:max-w-[70%] rounded-2xl ${
    msg.message_type === 'text' 
      ? 'px-3 md:px-4 py-2'      // Padding pour texte
      : 'overflow-hidden'         // Pas de padding pour images
  } ...`}
>
```

#### C. URL absolue pour les images
```tsx
src={msg.media_url?.startsWith('http') 
  ? msg.media_url 
  : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${msg.media_url}`
}
```

#### D. Horodatage avec padding conditionnel
```tsx
<p
  className={`text-xs mt-1 ${
    msg.message_type === 'text' ? '' : 'px-3 pb-2'  // Padding seulement pour images
  } ${
    isOwn ? 'text-orange-100' : 'text-gray-500'
  }`}
>
  {timeString}
</p>
```

---

## 🎨 Résultat Visuel

### Messages Texte
```
┌─────────────────────────┐
│ Salut ! Comment ça va ? │  ← Padding 12px
│ 14:30                   │
└─────────────────────────┘
```

### Messages Image
```
┌─────────────────────────┐
│                         │
│    [IMAGE COMPLÈTE]     │  ← Pas de padding
│                         │
├─────────────────────────┤
│ Belle photo !           │  ← Caption (si présent)
│ 14:32                   │  ← Padding 12px
└─────────────────────────┘
```

---

## 📁 Fichiers Modifiés

### Frontend
- `/src/components/chat/ChatWindow.tsx`
  * Padding conditionnel selon type de message
  * URL absolue pour images
  * Réinitialisation du message lors du changement de conversation
  * Input toujours contrôlé avec `|| ''`

---

## 🧪 Tests

### Test Input Contrôlé
1. Ouvrir une conversation
2. Taper du texte
3. Changer de conversation
4. ✅ Pas de warning dans la console
5. ✅ Input est vide dans la nouvelle conversation

### Test Affichage Image
1. Uploader une image
2. ✅ Image s'affiche en pleine largeur
3. ✅ Pas de texte "Media" visible
4. ✅ Coins arrondis corrects
5. ✅ Timestamp en bas avec padding

### Test URL Image
1. Inspecter l'élément `<img>`
2. ✅ `src` doit être : `http://157.180.36.122:9000/uploads/images/...`
3. ✅ Image charge correctement (pas 404)

---

## 🌐 Variables d'Environnement

Fichier `/chat-app/bored-chat/.env.local` :
```bash
NEXT_PUBLIC_API_URL=http://157.180.36.122:9000/api
NEXT_PUBLIC_WS_URL=ws://157.180.36.122:9000/api/ws
NEXT_PUBLIC_UPLOAD_URL=http://157.180.36.122:9000/uploads
```

**Note** : Le code utilise `NEXT_PUBLIC_API_URL` et retire `/api` pour construire l'URL des uploads :
```typescript
const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')
// Résultat: http://157.180.36.122:9000
```

---

## 🚀 Déploiement

### Frontend
```bash
# Next.js hot reload automatique
# Si problème, redémarrer:
pkill -f "next dev"
# Puis relancer depuis VS Code ou manuellement
```

### Backend
Aucun changement nécessaire (routes déjà en place)

---

## 🐛 Debugging

### Image ne charge pas (404)
```bash
# Vérifier l'URL dans le navigateur
console.log(msg.media_url) // /uploads/images/...

# Vérifier la variable d'env
console.log(process.env.NEXT_PUBLIC_API_URL) // http://...

# Vérifier l'URL finale
console.log(finalImageUrl) // http://157.180.36.122:9000/uploads/...
```

### Warning Input
```bash
# Console doit afficher:
# ✅ Rien (pas de warning)

# Si warning persiste:
# 1. Vérifier que useState('') a bien '' initial
# 2. Vérifier que setMessage n'est jamais appelé avec undefined
# 3. Vérifier value={message || ''}
```

---

## 📝 Notes Techniques

### Pourquoi `overflow-hidden` pour les images ?
- Sans padding sur la bulle, l'image irait jusqu'aux bords
- `overflow-hidden` + `rounded-2xl` sur la bulle = coins arrondis
- `rounded-t-lg` sur l'image = coins arrondis seulement en haut

### Pourquoi `replace('/api', '')` ?
- `NEXT_PUBLIC_API_URL` = `http://...9000/api`
- Uploads sont à `http://...9000/uploads` (pas dans /api)
- On retire `/api` pour avoir juste le domaine:port

### Structure du message image
```typescript
{
  id: "uuid",
  message_type: "image",
  media_url: "/uploads/images/user-id_uuid.png",
  content: "Caption optionnel",  // Peut être vide
  sender_id: "uuid",
  created_at: "2025-12-29T..."
}
```

---

**Date** : 29 Décembre 2025  
**Auteur** : Ibrahim (Akharn)  
**Version** : 1.2.0
