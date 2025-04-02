import { createContext, useState, useEffect, ReactNode } from "react";
import { apiRequest, updateData } from "@/lib/api";
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
      const storedToken = localStorage.getItem('token');
      console.log('Checking auth with token:', storedToken ? 'Token exists' : 'No token found');
      
      if (storedToken) {
        try {
          console.log('Making /api/auth/me request with token');
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
            credentials: 'same-origin',
          });

          console.log('Auth check response status:', response.status);
          
          if (response.ok) {
            const userData = await response.json();
            console.log('Auth successful, user data:', userData);
            setUser(userData);
            
            // Ensure token state is in sync with localStorage
            if (token !== storedToken) {
              console.log('Syncing token state with localStorage');
              setToken(storedToken);
            }
          } else {
            console.log('Auth response not OK:', response.status);
            
            try {
              // Try to read error message
              const errorText = await response.text();
              console.error('Auth error details:', errorText);
            } catch (e) {
              console.error('Could not read auth error response');
            }
            
            // Token is invalid or expired - clear it
            console.log('Clearing invalid token');
            localStorage.removeItem('token');
            setToken(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      } else {
        console.log('No token available, user not authenticated');
        // Ensure token state matches localStorage (null)
        if (token !== null) {
          console.log('Clearing token state to match localStorage');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log('Attempting login for user:', username);
      
      // Make direct fetch call with verbose logging for debugging
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login error response:', errorText);
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Login response data received, token exists:', !!data.token);
      
      if (!data.token) {
        console.error('No token in login response:', data);
        throw new Error('No authentication token received from server');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      console.log('Token saved to localStorage');
      
      setToken(data.token);
      setUser(data.user);

      // Reset cache when logging in
      queryClient.resetQueries();
      
      return data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      console.log('Attempting registration for user:', userData.username);
      
      // Make direct fetch call with verbose logging for debugging
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
        credentials: 'same-origin'
      });

      console.log('Registration response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Registration error response:', errorText);
        throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Registration response data received, token exists:', !!data.token);
      
      if (!data.token) {
        console.error('No token in registration response:', data);
        throw new Error('No authentication token received from server');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      console.log('Token saved to localStorage after registration');
      
      setToken(data.token);
      setUser(data.user);

      // Reset cache when registering
      queryClient.resetQueries();
      
      return data;
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
      const updatedUser = await updateData('/api/users/profile', userData);
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
