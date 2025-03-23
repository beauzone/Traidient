/**
 * Utility functions for the server
 */
import { ApiIntegration } from '@shared/schema';
import { storage } from './storage';

/**
 * Get an API integration by ID or get the default one for the user
 * 
 * @param userId User ID
 * @param integrationId Optional integration ID to use
 * @returns The requested integration or the default one
 */
export async function getApiIntegrationByIdOrDefault(
  userId: number,
  integrationId?: number
): Promise<ApiIntegration | undefined> {
  try {
    if (integrationId) {
      // Get the specified integration
      const integration = await storage.getApiIntegration(integrationId);
      
      // Make sure it belongs to the user
      if (integration && integration.userId === userId) {
        return integration;
      }
    }
    
    // No integration specified or invalid ID, get the first one of type 'exchange'
    const integrations = await storage.getApiIntegrationsByUser(userId);
    const exchangeIntegration = integrations.find(i => 
      i.provider === 'alpaca' || 
      i.type === 'exchange'
    );
    
    return exchangeIntegration;
  } catch (error) {
    console.error('Error getting API integration:', error);
    return undefined;
  }
}