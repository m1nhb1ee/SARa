/**
 * Auth Context & Storage - Smart AI Radiology
 */

export interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Local Storage Keys
const STORAGE_KEY = 'sara_auth_state';
const USER_KEY = 'sara_user';

// Helper to get CSRF token from cookie
function getCSRFToken(): string {
  const name = 'csrftoken';
  let cookieValue = '';
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export class AuthService {
  private static baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  static async login(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const csrfToken = getCSRFToken();
      const response = await fetch(`${this.baseURL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.error || 'Đăng nhập thất bại' };
      }

      const data = await response.json();
      const user = data.user;

      // Store user in localStorage
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEY, 'true');

      return { success: true, user };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Lỗi kết nối' };
    }
  }

  static async logout(): Promise<void> {
    try {
      const csrfToken = getCSRFToken();
      await fetch(`${this.baseURL}/auth/logout/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseURL}/auth/me/`, {
        credentials: 'include',
      });

      if (!response.ok) return null;

      const data = await response.json();
      const user = data.user;

      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(STORAGE_KEY, 'true');
        return user;
      }

      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  static getStoredUser(): User | null {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  static isAuthenticated(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }
}
