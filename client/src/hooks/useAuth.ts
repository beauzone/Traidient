import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

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

export function useAuth() {
  const { data: user, isLoading, error, refetch } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

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

  // Create a safe user object
  const safeUser: AuthUser | undefined = user ? {
    ...user, // Start with all original properties
    // Then override specific ones if needed with safe defaults
    id: user.id,
    username: user.username || 'User',
    replitId: user.replitId || user.sub || '', // Handle different property names for Replit ID
  } : undefined;

  return {
    user: safeUser,
    isLoading,
    isAuthenticated: !!safeUser,
    refetch,
    redirectToLogin,
  };
}
