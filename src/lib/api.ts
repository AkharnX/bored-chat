import type { AuthResponse, User, Conversation, Message, Friendship, ApiError } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr);
      return user.id || null;
    } catch {
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers as Record<string, string>,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as ApiError).error || 'An error occurred');
    }

    return data as T;
  }

  // Auth
  async register(username: string, email: string, password: string, displayName?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, display_name: displayName }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  async getUserById(id: string): Promise<User> {
    return this.request<User>(`/users/${id}`);
  }

  // Friendships
  async sendFriendRequest(addresseeId: string): Promise<Friendship> {
    return this.request<Friendship>('/friendships/request', {
      method: 'POST',
      body: JSON.stringify({ addressee_id: addresseeId }),
    });
  }

  async acceptFriendRequest(friendshipId: string): Promise<Friendship> {
    return this.request<Friendship>(`/friendships/${friendshipId}/accept`, {
      method: 'POST',
    });
  }

  async rejectFriendRequest(friendshipId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/friendships/${friendshipId}/reject`, {
      method: 'POST',
    });
  }

  async getFriendRequests(): Promise<Friendship[]> {
    return this.request<Friendship[]>('/friendships/requests');
  }

  async getFriends(): Promise<Friendship[]> {
    return this.request<Friendship[]>('/friendships');
  }

  // Conversations & Messages
  async getConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/conversations');
  }

  async createConversation(participantIds: string[], type: 'private' | 'group' = 'private', name?: string): Promise<Conversation> {
    return this.request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ participant_ids: participantIds, type, name }),
    });
  }

  async deleteConversation(conversationId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.request<Message[]>(`/conversations/${conversationId}/messages`);
  }

  async sendMessage(conversationId: string, content: string, messageType: 'text' | 'image' | 'gif' = 'text'): Promise<Message> {
    return this.request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, content, message_type: messageType }),
    });
  }

  // Media
  async uploadMedia(file: File, conversationId: string, caption?: string): Promise<Message> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversation_id', conversationId);
    if (caption) {
      formData.append('content', caption);
    }

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as ApiError).error || 'Upload failed');
    }

    return data as Message;
  }

  async deleteMessage(messageId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
