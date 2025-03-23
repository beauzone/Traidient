/**
 * Utility functions for the server
 */
import { storage } from './storage';
import { ApiIntegration } from '@shared/schema';

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
    let integration: ApiIntegration | undefined;
    
    // If an integration ID is provided, try to get it
    if (integrationId) {
      integration = await storage.getApiIntegration(integrationId);
      
      // Make sure the integration belongs to the user
      if (integration && integration.userId !== userId) {
        console.warn(`User ${userId} tried to access integration ${integrationId} which belongs to user ${integration.userId}`);
        integration = undefined;
      }
    }
    
    // If no integration was found or no ID was provided, try to get the default one
    if (!integration) {
      const integrations = await storage.getApiIntegrationsByUser(userId);
      
      // Find an Alpaca integration
      integration = integrations.find(i => i.provider === 'alpaca');
      
      if (!integration && integrations.length > 0) {
        // If no Alpaca integration, use the first available one
        integration = integrations[0];
      }
    }
    
    return integration;
  } catch (error) {
    console.error('Error getting API integration:', error);
    return undefined;
  }
}