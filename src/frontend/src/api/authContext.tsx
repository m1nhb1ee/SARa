/**
 * Auth Context Provider - Smart AI Radiology
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, User, AuthState } from './auth';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = AuthService.getStoredUser();
      const isAuth = AuthService.isAuthenticated();

      if (isAuth && storedUser) {
        setState({
          user: storedUser,
          isAuthenticated: true,
          isLoading: false,
        });

        // Verify with backend
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          setState({
            user: currentUser,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Session expired
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const result = await AuthService.login(username, password);

    if (result.success && result.user) {
      setState({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } else {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return false;
    }
  };

  const logout = async () => {
    await AuthService.logout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
