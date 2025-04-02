import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Adding custom RequestOptions interface with data property
interface RequestOptions extends RequestInit {
  data?: unknown;
}

export async function apiRequest(
  url: string,
  options?: RequestOptions,
): Promise<any> { // Change return type to any to handle JSON responses
  // TEMPORARY: In demo mode, we don't actually need to send tokens since auth is bypassed
  // But we'll still include the demo token in the headers for consistency
  const token = localStorage.getItem('token');
  console.log(`API Request to ${url} - Token exists: ${!!token}`);
  
  // Extract data from options
  const data = options?.data;
  
  // Create headers object
  const defaultHeaders: Record<string, string> = {};
  if (data) defaultHeaders["Content-Type"] = "application/json";
  if (token) defaultHeaders["Authorization"] = `Bearer ${token}`;
  
  // Add custom headers from options, ensuring they're all strings
  const headersFromOptions: Record<string, string> = {};
  if (options?.headers && typeof options.headers === 'object') {
    for (const key in options.headers) {
      const value = options.headers[key as keyof typeof options.headers];
      if (value !== undefined && value !== null) {
        headersFromOptions[key] = String(value);
      }
    }
  }
  
  const headers = { ...defaultHeaders, ...headersFromOptions };

  console.log('Request headers:', headers);
  if (data) console.log('Request data:', data);

  try {
    const res = await fetch(url, {
      ...(options || {}),
      headers,
      body: data ? JSON.stringify(data) : options?.body,
      // Adding credentials to ensure cookies are sent if applicable
      credentials: 'same-origin'
    });

    console.log(`Response from ${url}:`, res.status, res.statusText);
    
    // Check for auth errors specifically
    if (res.status === 401) {
      console.warn('Authentication error detected, token may be invalid or expired');
      
      // Clone the response to read it multiple times
      const clonedRes = res.clone();
      try {
        const errorData = await clonedRes.json();
        console.error('Auth error details:', errorData);
      } catch (e) {
        console.error('Could not parse auth error response as JSON');
      }
    }
    
    await throwIfResNotOk(res);
    
    // For successful responses, parse JSON data if there is content
    // For 204 No Content responses (common with DELETE operations), return empty object
    if (res.status === 204) {
      return {};
    }
    
    // Otherwise, try to parse the JSON content
    try {
      const responseData = await res.json();
      console.log(`Response data from ${url}:`, responseData);
      return responseData;
    } catch (error) {
      console.warn(`Could not parse response from ${url} as JSON:`, error);
      // Return empty object for successful requests that don't return JSON
      return {};
    }
  } catch (error) {
    console.error(`API error (${options?.method || 'GET'} ${url}):`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    
    // TEMPORARY: In demo mode, we don't need to send tokens since auth is bypassed on server
    // But we'll still include the demo token in the headers for consistency
    const token = localStorage.getItem('token');
    console.log(`Query to ${url} - Token exists: ${!!token}`);
    
    const headers: Record<string, string> = token 
      ? { "Authorization": `Bearer ${token}` } 
      : {};
      
    console.log('Query headers:', headers);

    try {
      const res = await fetch(url, {
        headers,
        // Adding credentials to ensure cookies are sent if applicable
        credentials: 'same-origin'
      });
      
      console.log(`Query response from ${url}:`, res.status, res.statusText);
      
      // Check for auth errors specifically
      if (res.status === 401) {
        console.warn('Authentication error detected in query, token may be invalid or expired');
        
        // Clone the response to read it multiple times
        const clonedRes = res.clone();
        try {
          const errorData = await clonedRes.json();
          console.error('Auth error details for query:', errorData);
        } catch (e) {
          console.error('Could not parse auth error response as JSON');
        }
        
        if (unauthorizedBehavior === "returnNull") {
          console.log(`Returning null for 401 response from ${url}`);
          return null;
        }
      }
      
      await throwIfResNotOk(res);
      
      // For 204 No Content responses, return empty object
      if (res.status === 204) {
        return {};
      }
      
      // Try to parse JSON response, handle empty responses
      try {
        const data = await res.json();
        console.log(`Query data from ${url}:`, data);
        return data;
      } catch (error) {
        console.warn(`Could not parse query response from ${url} as JSON:`, error);
        // Return empty object for successful requests that don't return JSON
        return {};
      }
    } catch (error) {
      console.error(`Query error (${url}):`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
