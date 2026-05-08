/**
 * Auth Service - Smart AI Radiology
 */

export interface User {
  id: string;
  email: string;
  role: string;
  is_premium: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const STORAGE_KEY = 'sara_auth_state';
const USER_KEY = 'sara_user';
const TOKEN_KEY = 'sara_token';

export class AuthService {
  private static baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  static async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.error || 'Đăng nhập thất bại' };
      }

      const data = await response.json();
      const user: User = data.user;

      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.setItem(TOKEN_KEY, data.access_token || '');

      return { success: true, user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Lỗi kết nối' };
    }
  }

  static async logout(): Promise<void> {
    const token = this.getStoredToken();
    try {
      await fetch(`${this.baseURL}/auth/logout/`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
    } catch {
      // best-effort
    }

    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  static async getCurrentUser(): Promise<User | null> {
    const token = this.getStoredToken();
    if (!token) return null;

    try {
      const response = await fetch(`${this.baseURL}/auth/me/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const user: User = data.user;

      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return user;
      }
      return null;
    } catch {
      return null;
    }
  }

  static getStoredUser(): User | null {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  static getStoredToken(): string {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  static isAuthenticated(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true' && !!this.getStoredToken();
  }
}
