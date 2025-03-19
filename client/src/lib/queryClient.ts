import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('token');
  console.log(`API Request to ${url} - Token exists: ${!!token}`);
  
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };

  console.log('Request headers:', headers);

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  console.log(`Response from ${url}:`, res.status, res.statusText);
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const token = localStorage.getItem('token');
    console.log(`Query to ${url} - Token exists: ${!!token}`);
    
    const headers: Record<string, string> = token 
      ? { "Authorization": `Bearer ${token}` } 
      : {};
      
    console.log('Query headers:', headers);

    const res = await fetch(url, {
      headers
    });
    
    console.log(`Query response from ${url}:`, res.status, res.statusText);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`Returning null for 401 response from ${url}`);
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
