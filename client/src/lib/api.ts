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
 */
export async function deleteData<T = any>(url: string): Promise<T> {
  return apiRequest<T>("DELETE", url);
}
