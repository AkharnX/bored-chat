export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  public_key?: string;  // E2EE public key (Base64)
  status: 'online' | 'offline';
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  requester?: User;
  addressee?: User;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  name?: string;
  created_by?: string;
  participants: ConversationParticipant[];
  messages?: Message[];
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  user?: User;
  joined_at: string;
  last_read_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'gif';
  media_url?: string;
  media_type?: string;
  media_size?: number;
  is_read: boolean;
  sender?: User;
  created_at: string;
  updated_at: string;
}

export interface WSMessage {
  type: 'message' | 'typing' | 'read' | 'user_status';
  conversation_id?: string;
  sender_id: string;
  recipient_id?: string;
  content?: string;
  message_type?: 'text' | 'image' | 'gif';
  media_url?: string;
  data?: any;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}
