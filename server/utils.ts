/**
 * Utility functions for the server
 */

/**
 * Get a standardized error message from various error types
 * @param error The error object
 * @returns A standardized error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  } else {
    return 'Unknown error';
  }
}

/**
 * Extract user ID from session or authorization header
 * @param req The Express request object
 * @returns The user ID or null if not found
 */
export function extractUserId(req: any): number | null {
  // From session (for web app)
  if (req.session?.user?.id) {
    return req.session.user.id;
  }
  
  // From authorization header (for API calls)
  if (req.user?.id) {
    return req.user.id;
  }
  
  return null;
}

/**
 * Check if a parameter exists and is not empty
 * @param param The parameter to check
 * @returns True if the parameter exists and is not empty
 */
export function paramExists(param: any): boolean {
  return param !== undefined && param !== null && param !== '';
}

/**
 * Parse a boolean parameter from a request
 * @param param The parameter to parse
 * @param defaultValue The default value if param is undefined
 * @returns The parsed boolean value
 */
export function parseBoolean(param: any, defaultValue = false): boolean {
  if (param === undefined || param === null) {
    return defaultValue;
  }
  
  if (typeof param === 'boolean') {
    return param;
  }
  
  if (typeof param === 'string') {
    return param.toLowerCase() === 'true' || param === '1';
  }
  
  return Boolean(param);
}

/**
 * Parse an integer parameter from a request
 * @param param The parameter to parse
 * @param defaultValue The default value if param is undefined or invalid
 * @returns The parsed integer value
 */
export function parseInteger(param: any, defaultValue = 0): number {
  if (param === undefined || param === null) {
    return defaultValue;
  }
  
  if (typeof param === 'number') {
    return Math.floor(param);
  }
  
  if (typeof param === 'string') {
    const parsed = parseInt(param, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return defaultValue;
}

/**
 * Get an API integration by ID or use the default if not found
 * @param userId The user ID
 * @param integrationId The integration ID to retrieve (optional)
 * @returns The API integration or null if not found
 */
export async function getApiIntegrationByIdOrDefault(userId: number, integrationId?: number) {
  const { db } = await import('./db');
  const { apiIntegrations } = await import('@shared/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  try {
    // If a specific integration ID was provided, get that one
    if (integrationId) {
      const [integration] = await db
        .select()
        .from(apiIntegrations)
        .where(and(
          eq(apiIntegrations.userId, userId),
          eq(apiIntegrations.id, integrationId)
        ));
      
      return integration || null;
    }
    
    // Otherwise, get the most recently added/updated integration
    const [integration] = await db
      .select()
      .from(apiIntegrations)
      .where(eq(apiIntegrations.userId, userId))
      .orderBy(desc(apiIntegrations.updatedAt))
      .limit(1);
    
    return integration || null;
  } catch (error) {
    console.error('Error retrieving API integration:', error);
    return null;
  }
}

/**
 * Generate a unique request ID
 * @returns A unique ID string
 */
export function generateRequestId(): string {
  const timestamp = new Date().getTime().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}