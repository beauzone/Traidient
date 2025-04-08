import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

// Define a proper user interface
export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  replitId?: string;
  [key: string]: any; // For any other properties that might be present
}

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV || window.location.hostname.includes('localhost') || window.location.hostname.includes('.replit.dev');

export function useAuth() {
  const [hasAutoLoginFailed, setHasAutoLoginFailed] = useState(false);

  // For development, we'll use special error handling to detect auto-login issues
  const { data: user, isLoading, error, refetch } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: isDevelopment ? 2 : false, // More retries in development
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Handle error case in a useEffect to avoid TanStack v5 TypeScript errors
  useEffect(() => {
    if (error) {
      console.error("Auth query error:", error);

      // In development, attempt dev login
      if (isDevelopment) {
        fetch('/api/auth/dev-user', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setFallbackUser(data);
          } else {
            setHasAutoLoginFailed(true);
          }
        })
        .catch(() => {
          setHasAutoLoginFailed(true);
        });
      } else {
        setHasAutoLoginFailed(true);
      }
    }
  }, [error, isDevelopment]);

  // For dev auto-login, we'll also try a fallback to a direct API call if needed
  const [fallbackUser, setFallbackUser] = useState<AuthUser | null>(null);

  // Use fallback auth for development when the primary method fails
  useEffect(() => {
    if (isDevelopment && (hasAutoLoginFailed || !user)) {
      // Use a direct API call to try to get the dev user
      const tryFallbackAuth = async () => {
        try {
          console.log("Attempting fallback dev auth...");

          // Try to get the dev user directly - this endpoint respects DEV_AUTO_LOGIN
          // Use relative path and more detailed error handling
          const fullUrl = new URL('/api/auth/dev-user', window.location.origin).href;
          console.log("Fetching from:", fullUrl);

          const response = await fetch(fullUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          console.log("Dev endpoint response:", response.status, response.statusText);

          if (response.ok) {
            const data = await response.json();
            if (data && ('id' in data)) {
              console.log("Using fallback dev user:", data);
              setFallbackUser(data);
            } else {
              console.warn("Dev user endpoint returned unexpected data format:", data);
            }
          } else {
            console.warn("Dev user endpoint error:", response.status, response.statusText);
            // Try using a hard-coded dev user in extreme cases
            if (isDevelopment && hasAutoLoginFailed) {
              const backupDevUser = {
                id: 999,
                username: 'backup_dev',
                email: 'backup@example.com'
              };
              console.warn("Using backup dev user as last resort");
              setFallbackUser(backupDevUser as AuthUser);
            }
          }
        } catch (err) {
          console.error("Fallback auth failed:", err);
          // Only use backup user when network errors occur
          if (isDevelopment && hasAutoLoginFailed) {
            const backupDevUser = {
              id: 999,
              username: 'backup_dev',
              email: 'backup@example.com'
            };
            console.warn("Using backup dev user due to network error");
            setFallbackUser(backupDevUser as AuthUser);
          }
        }
      };

      // Only attempt fallback auth if we don't already have a fallbackUser
      if (!fallbackUser) {
        tryFallbackAuth();
      }
    }
  }, [hasAutoLoginFailed, user, fallbackUser, isDevelopment]);

  // Redirect to login page
  const redirectToLogin = () => {
    window.location.href = "/api/login";
  };

  // Use useEffect to handle auth errors and auto redirect if needed
  useEffect(() => {
    if (error) {
      console.error("Auth error:", error);

      // If the error indicates a Replit Auth issue, we should set up an automatic redirect
      // after a short delay to not interrupt user's current task
      if (error instanceof Error &&
          (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Authentication'))) {
        console.warn('Authentication error detected, likely a Replit session issue');

        // Only redirect for auth errors that occur during the initial load (not manual refresh)
        if (!user) {
          const timer = setTimeout(() => {
            console.log('Redirecting to login due to authentication error');
            redirectToLogin();
          }, 1500);

          // Clear timeout if component unmounts
          return () => clearTimeout(timer);
        }
      }
    }
  }, [error, user]);

  // Use either the primary user or fallback user
  const effectiveUser = user || fallbackUser;

  // Create a safe user object
  const safeUser: AuthUser | undefined = effectiveUser ? {
    ...effectiveUser, // Start with all original properties
    // Then override specific ones if needed with safe defaults
    id: ('id' in effectiveUser) ? effectiveUser.id : 0,
    username: ('username' in effectiveUser) ? effectiveUser.username : 'User',
    replitId: ('replitId' in effectiveUser) ? effectiveUser.replitId : 
              ('sub' in effectiveUser) ? String(effectiveUser.sub) : '', 
  } : undefined;

  return {
    user: safeUser,
    isLoading: isLoading && !fallbackUser,
    isAuthenticated: !!safeUser,
    refetch,
    redirectToLogin,
    isDevelopment,
    isUsingFallback: !!fallbackUser
  };
}