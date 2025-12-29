# 🔧 Correctifs et Nouvelles Fonctionnalités

## ✅ Problèmes Corrigés

### 1. 🔤 Caractères Spéciaux (&#39; etc.)

**Problème** : Les apostrophes et caractères spéciaux s'affichaient en HTML encodé (`&#39;` au lieu de `'`)

**Cause** : Double encodage HTML dans le backend
- `strictPolicy.Sanitize()` encodait déjà
- `html.EscapeString()` encodait une 2ème fois

**Solution** :
Modifié `/chat-service-go/pkg/utils/sanitize.go` pour utiliser uniquement `ugcPolicy.Sanitize()` qui permet les caractères normaux tout en bloquant les tags HTML dangereux.

```go
func SanitizeMessage(message string) string {
	// Utilise ugcPolicy qui permet emojis et caractères spéciaux
	sanitized := ugcPolicy.Sanitize(message)
	sanitized = strings.TrimSpace(sanitized)
	return sanitized
}
```

**Résultat** : 
- ✅ `c'est` s'affiche correctement (au lieu de `c&#39;est`)
- ✅ Les emojis fonctionnent : 🔥❤️😊
- ✅ Les accents : é è à ù ç
- ✅ Protection contre XSS maintenue

---

### 2. 📸 Upload d'Images

**Problème** : Impossible d'envoyer des images dans le chat

**Solution** : Ajout d'un bouton d'upload avec preview et validation

**Fichier modifié** : `/src/components/chat/ChatWindow.tsx`

**Fonctionnalités** :
- ✅ Bouton icône image 📷 à gauche de l'input
- ✅ Upload d'images (JPG, PNG, GIF, WebP)
- ✅ Validation de taille (max 5MB)
- ✅ État de chargement avec spinner ⏳
- ✅ Auto-refresh après upload
- ✅ Affichage des images dans les bulles de chat

**Code ajouté** :
```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !conversation) return;

  // Validation type
  if (!file.type.startsWith('image/')) {
    alert('❌ Seules les images sont supportées');
    return;
  }

  // Validation taille (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    alert('❌ Image trop grande (max 5MB)');
    return;
  }

  setUploading(true);
  try {
    await api.uploadMedia(file, conversation.id);
    await loadMessages();
  } catch (error) {
    alert('❌ Erreur lors de l\'envoi');
  } finally {
    setUploading(false);
  }
};
```

**UI** :
```tsx
{/* Bouton Upload Image */}
<button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={uploading}
  className="p-2 md:p-3 text-orange-500 hover:bg-orange-100 rounded-full"
>
  {uploading ? '⏳' : <ImageIcon />}
</button>

{/* Input fichier caché */}
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  onChange={handleFileUpload}
  className="hidden"
/>
```

---

## 🎨 UI/UX

### Bouton Image
- **Position** : À gauche de l'input texte
- **Style** : Icône orange, fond orange clair au hover
- **États** :
  - Normal : Icône image SVG
  - Upload : Horloge ⏳
  - Disabled pendant upload

### Messages Image
- Affichés dans des bulles arrondies
- Largeur responsive : 85% mobile, 70% desktop
- Coins arrondis : `rounded-lg`
- Même style que messages texte (gradients orange/blanc)

---

## 🧪 Tests

### Test Caractères Spéciaux
1. Tape : `C'est l'été ! 🔥`
2. Envoie le message
3. ✅ Doit s'afficher : `C'est l'été ! 🔥`
4. ❌ PAS : `C&#39;est l&#39;été ! 🔥`

### Test Upload Image
1. Clique sur le bouton 📷
2. Sélectionne une image (< 5MB)
3. ✅ Spinner ⏳ s'affiche pendant upload
4. ✅ Image apparaît dans le chat après upload
5. ✅ Scroll automatique vers le bas

### Test Validation Taille
1. Essaye d'uploader une image > 5MB
2. ✅ Alert : "❌ Image trop grande (max 5MB)"

### Test Type de Fichier
1. Essaye d'uploader un PDF ou vidéo
2. ✅ Alert : "❌ Seules les images sont supportées"

---

## 📁 Fichiers Modifiés

### Backend
- `/chat-service-go/pkg/utils/sanitize.go` - Fix double encodage

### Frontend
- `/src/components/chat/ChatWindow.tsx` - Upload d'images

---

## 🚀 Déploiement

### Backend
```bash
cd /home/akharn/chat-app/chat-service-go
docker-compose build chat-service
docker-compose up -d chat-service
```

### Frontend
Hot reload automatique (Next.js)

---

## 📝 Notes Techniques

### Sanitization
- **ugcPolicy** : Permet texte riche mais bloque `<script>`, `<iframe>`, etc.
- **strictPolicy** : Retire TOUS les tags HTML (trop strict pour chat)

### Upload Backend
L'endpoint `/api/media/upload` existe déjà :
- Accepte : `multipart/form-data`
- Champs : `file`, `conversation_id`, `content` (caption optionnel)
- Retourne : Objet `Message` avec `media_url`
- Stockage : `/app/uploads/images/`

### Types MIME Supportés
```typescript
accept="image/*"
// Accepte : .jpg, .jpeg, .png, .gif, .webp, .svg, etc.
```

---

## 🎯 Prochaines Améliorations

- [ ] Preview d'image avant envoi
- [ ] Compression d'image côté client
- [ ] Support vidéos
- [ ] Support audio/voix
- [ ] Emojis picker
- [ ] GIF via Giphy API
- [ ] Drag & drop d'images
- [ ] Copier-coller d'images
- [ ] Lightbox pour zoomer sur images

---

**Date** : 29 Décembre 2025  
**Auteur** : Ibrahim (Akharn)  
**Version** : 1.1.0
