import { createContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  subscription: {
    tier: 'free' | 'standard' | 'professional';
    status: 'active' | 'inactive' | 'trial';
    expiresAt: string;
  };
  settings: {
    theme: 'dark' | 'light';
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    defaultExchange: string;
    defaultAssets: string[];
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface RegisterData {
  username: string;
  password: string;
  email: string;
  name: string;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: async () => {},
});

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token is invalid or expired
            localStorage.removeItem('token');
            setToken(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (username: string, password: string) => {
    try {
      // The apiRequest in lib/api.ts already processes the response to JSON
      const data = await apiRequest('POST', '/api/auth/login', { username, password });

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      // Reset cache when logging in
      queryClient.resetQueries();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      // The apiRequest in lib/api.ts already processes the response to JSON
      const data = await apiRequest('POST', '/api/auth/register', userData);

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      // Reset cache when registering
      queryClient.resetQueries();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);

    // Reset cache when logging out
    queryClient.resetQueries();
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      // The apiRequest in lib/api.ts already processes the response to JSON
      const updatedUser = await apiRequest('PUT', '/api/users/profile', userData);
      setUser(updatedUser);
    } catch (error) {
      console.error('User update failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
