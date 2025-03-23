import { apiRequest as queryApiRequest } from "./queryClient";

/**
 * Make an API request using fetch with proper error handling
 */
export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown
): Promise<T> {
  try {
    // The queryApiRequest function already parses the JSON response
    const response = await queryApiRequest(method, url, data);
    return response as T;
  } catch (error) {
    console.error(`API error (${method} ${url}):`, error);
    throw error;
  }
}

/**
 * Fetch data from an API endpoint
 */
export async function fetchData<T = any>(url: string): Promise<T> {
  return apiRequest<T>("GET", url);
}

/**
 * Alias for fetchData to match naming in components
 */
export async function getData<T = any>(url: string): Promise<T> {
  return fetchData<T>(url);
}

/**
 * Post data to an API endpoint
 */
export async function postData<T = any>(url: string, data: unknown): Promise<T> {
  return apiRequest<T>("POST", url, data);
}

/**
 * Update data at an API endpoint
 */
export async function updateData<T = any>(url: string, data: unknown): Promise<T> {
  return apiRequest<T>("PUT", url, data);
}

/**
 * Delete data at an API endpoint
 * Special handling for 404 (Not Found) errors in DELETE requests - treat as success
 */
export async function deleteData<T = any>(url: string): Promise<T> {
  try {
    return await apiRequest<T>("DELETE", url);
  } catch (error: any) {
    // If it's a 404 error for a DELETE request, consider it a success
    // (the resource was already deleted or doesn't exist)
    if (error.message && error.message.includes('404')) {
      console.log(`Resource at ${url} not found, but that's OK for DELETE`);
      return {} as T;
    }
    throw error;
  }
}
