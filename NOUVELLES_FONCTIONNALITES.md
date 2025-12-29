# 🎉 Nouvelles Fonctionnalités - Bored Chat

## ✅ Fonctionnalités Implémentées

### 1. 📨 Réception Automatique des Messages via WebSocket

**Problème résolu** : Avant, le destinataire devait rafraîchir la page pour voir les nouveaux messages.

**Solution** :
- Le hook `useWebSocket` écoute maintenant les événements `'message'` en temps réel
- ChatWindow s'abonne aux nouveaux messages via `onNewMessage()`
- Les messages reçus sont automatiquement ajoutés à la liste sans refresh
- Évite les doublons grâce à une vérification par ID

**Fichiers modifiés** :
- `/src/hooks/useWebSocket.ts` - Ajout de callbacks pour nouveaux messages
- `/src/components/chat/ChatWindow.tsx` - useEffect pour écouter les nouveaux messages
- `/src/components/chat/ChatLayout.tsx` - Passage de la fonction onNewMessage

**Code clé** :
```typescript
// Dans ChatWindow.tsx
useEffect(() => {
  if (onNewMessage && conversation) {
    onNewMessage((msg: Message) => {
      if (msg.conversation_id === conversation.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
  }
}, [onNewMessage, conversation?.id]);
```

---

### 2. ✍️ Indicateur "Est en train d'écrire"

**Fonctionnalité** : Affiche un indicateur visuel quand l'autre personne tape un message.

**Implémentation** :
- WebSocket envoie des événements `'typing'` avec `is_typing: true/false`
- Détection automatique quand l'utilisateur tape
- Arrêt automatique après 2 secondes d'inactivité
- Animation de 3 points oranges qui rebondissent

**Fichiers modifiés** :
- `/src/hooks/useWebSocket.ts` - Support des événements typing
- `/src/components/chat/ChatWindow.tsx` - Envoi typing + affichage indicateur
- `/src/components/chat/ChatLayout.tsx` - Passage de sendTyping et onTyping

**Envoi de typing** :
```typescript
const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setMessage(value);

  if (!sendTyping || !conversation) return;

  if (!isSelfTyping && value.length > 0) {
    setIsSelfTyping(true);
    sendTyping(conversation.id, true);
  }

  if (typingTimeout) clearTimeout(typingTimeout);

  const timeout = setTimeout(() => {
    setIsSelfTyping(false);
    sendTyping(conversation.id, false);
  }, 2000);

  setTypingTimeout(timeout);
};
```

**Affichage visuel** :
```tsx
{otherIsTyping && (
  <div className="px-3 md:px-6 py-2 text-sm text-gray-500 italic flex items-center gap-2">
    <div className="flex gap-1">
      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" 
           style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" 
           style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" 
           style={{ animationDelay: '300ms' }}></div>
    </div>
    <span>{otherUser.display_name} est en train d'écrire...</span>
  </div>
)}
```

---

### 3. 🗑️ Suppression de Conversations

**Fonctionnalité** : Permet de supprimer une conversation complète.

**Implémentation** :
- Bouton de suppression (icône poubelle) visible au survol de chaque conversation
- Confirmation avant suppression
- Suppression côté backend : messages → participants → conversation
- Rechargement automatique de la liste après suppression

**Fichiers modifiés** :

**Frontend** :
- `/src/lib/api.ts` - Ajout de `deleteConversation()`
- `/src/components/chat/ConversationList.tsx` - Bouton et logique de suppression
- `/src/components/chat/ChatLayout.tsx` - Callback onConversationDeleted

**Backend** :
- `/internal/handlers/message.go` - Méthode `DeleteConversation()`
- `/cmd/server/main.go` - Route `DELETE /conversations/:id`

**Code frontend** :
```typescript
const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
  e.stopPropagation();
  
  if (!confirm('Supprimer cette conversation ? Cette action est irréversible.')) {
    return;
  }

  setDeletingId(conversationId);
  try {
    await api.deleteConversation(conversationId);
    alert('✅ Conversation supprimée');
    if (onConversationDeleted) {
      onConversationDeleted();
    }
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    alert('❌ Erreur lors de la suppression');
  } finally {
    setDeletingId(null);
  }
};
```

**Code backend** :
```go
func (h *MessageHandler) DeleteConversation(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	// Vérifier que l'utilisateur est participant
	var participant models.ConversationParticipant
	if err := database.DB.Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		First(&participant).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant"})
		return
	}

	// Supprimer dans l'ordre : messages → participants → conversation
	database.DB.Where("conversation_id = ?", conversationID).Delete(&models.Message{})
	database.DB.Where("conversation_id = ?", conversationID).Delete(&models.ConversationParticipant{})
	database.DB.Where("id = ?", conversationID).Delete(&models.Conversation{})

	c.JSON(http.StatusOK, gin.H{"message": "Conversation deleted successfully"})
}
```

**UI du bouton** :
```tsx
<button
  onClick={(e) => handleDelete(e, conversation.id)}
  disabled={deletingId === conversation.id}
  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-full transition-all"
  title="Supprimer la conversation"
>
  {deletingId === conversation.id ? (
    <span className="text-gray-400">⏳</span>
  ) : (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )}
</button>
```

---

## 🎨 Design & UX

### Indicateur de Typing
- 3 points oranges qui rebondissent (`animate-bounce`)
- Délais d'animation décalés (0ms, 150ms, 300ms) pour effet de vague
- Affiche le nom de l'utilisateur qui tape
- Positionnement juste au-dessus du champ de saisie

### Bouton de Suppression
- Invisible par défaut, visible au survol (`opacity-0 group-hover:opacity-100`)
- Icône poubelle rouge
- État de chargement avec ⏳ pendant la suppression
- Empêche la sélection de la conversation lors du clic

---

## 🔄 Flux de Données WebSocket

### Message Reçu
```
Utilisateur A envoie message 
  → Backend broadcast via WebSocket
  → useWebSocket reçoit événement 'message'
  → messageCallbackRef.current() appelé
  → ChatWindow ajoute le message à la liste
  → Auto-scroll vers le bas
```

### Typing Indicator
```
Utilisateur A tape
  → handleTyping() détecte changement
  → sendTyping(conversationId, true) envoyé
  → Backend broadcast via WebSocket
  → useWebSocket reçoit événement 'typing'
  → typingCallbackRef.current() appelé
  → ChatWindow affiche/cache indicateur
  → Timeout 2s → sendTyping(conversationId, false)
```

---

## ✅ Tests Recommandés

### Test 1 : Réception de Messages
1. Ouvrir deux navigateurs (ou deux onglets en navigation privée)
2. Connecter deux utilisateurs différents
3. Créer une conversation entre eux
4. Envoyer un message depuis le navigateur A
5. ✅ Le message doit apparaître automatiquement dans le navigateur B sans refresh

### Test 2 : Indicateur "Est en train d'écrire"
1. Même setup que Test 1
2. Dans navigateur A, commencer à taper un message (ne pas envoyer)
3. ✅ Le navigateur B doit afficher "Utilisateur A est en train d'écrire..."
4. Arrêter de taper pendant 2 secondes
5. ✅ L'indicateur doit disparaître

### Test 3 : Suppression de Conversation
1. Créer plusieurs conversations
2. Survoler une conversation dans la liste
3. ✅ Icône poubelle rouge doit apparaître à droite
4. Cliquer sur l'icône
5. ✅ Confirmation "Supprimer cette conversation ?" doit s'afficher
6. Confirmer
7. ✅ Conversation doit disparaître de la liste
8. ✅ Messages et participants doivent être supprimés de la DB

---

## 🚀 Déploiement

### Backend
```bash
cd /home/akharn/chat-app/chat-service-go
docker-compose restart chat-service
```

### Frontend
Le frontend Next.js se recompile automatiquement grâce au hot reload.

Vérifier la compilation :
```bash
tail -f /tmp/next.log
```

---

## 📚 Architecture Technique

### WebSocket Hook
```
useWebSocket.ts
├── État: connected, messages, typingUsers
├── Refs: wsRef, messageCallbackRef, typingCallbackRef
├── Fonctions:
│   ├── connect() - Connexion WS avec token
│   ├── sendMessage() - Envoyer message JSON
│   ├── sendTyping() - Envoyer événement typing
│   ├── onNewMessage() - S'abonner aux nouveaux messages
│   └── onTyping() - S'abonner aux événements typing
└── Reconnexion automatique après 3s
```

### Flux de Props
```
ChatLayout
├── useWebSocket() → { sendTyping, onNewMessage, onTyping }
└── ChatWindow
    ├── Props: sendTyping, onNewMessage, onTyping
    ├── useEffect → onNewMessage → setMessages
    ├── useEffect → onTyping → setOtherIsTyping
    └── handleTyping → sendTyping
```

---

## 🐛 Debugging

### WebSocket ne connecte pas
```bash
# Vérifier le backend
docker logs boredchat-service --tail 50

# Vérifier le token
localStorage.getItem('token')

# Console navigateur
# Doit afficher : "✅ WebSocket connected"
```

### Messages ne s'affichent pas automatiquement
```javascript
// Console navigateur
// Vérifier que le callback est enregistré
useWebSocket.onNewMessage((msg) => console.log('New message:', msg))
```

### Typing indicator ne fonctionne pas
```javascript
// Console backend
// Vérifier que les événements typing sont broadcast
```

---

## 📋 TODO Futures Améliorations

- [ ] Optimistic UI : afficher message immédiatement avant confirmation backend
- [ ] Read receipts : afficher "✓✓" quand message lu
- [ ] Pagination des messages : charger par lots de 50
- [ ] Recherche dans les messages
- [ ] Archivage de conversations (au lieu de suppression)
- [ ] Notifications push navigateur
- [ ] Émojis et réactions aux messages
- [ ] Partage de fichiers (PDF, vidéos)
- [ ] Messages vocaux
- [ ] Appels vidéo/audio

---

**Date de création** : 29 Décembre 2025  
**Auteur** : Ibrahim (Akharn)  
**Version** : 1.0.0
