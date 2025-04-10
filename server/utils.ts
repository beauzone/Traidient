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
  integrationId?: number,
  provider?: string
): Promise<ApiIntegration | undefined> {
  if (integrationId) {
    return await storage.getApiIntegration(integrationId);
  }

  // Try to get a provider-specific integration
  if (provider) {
    const integration = await storage.getApiIntegrationByProviderAndUser(userId, provider);
    if (integration) {
      return integration;
    }
  }

  // Get all integrations and return the first active one
  const integrations = await storage.getApiIntegrationsByUser(userId);
  
  // Filter for exchange/broker integrations if no specific provider requested
  const activeIntegrations = integrations.filter(
    i => i.isActive && (!provider || i.provider.toLowerCase() === provider.toLowerCase())
  );
  
  // First try to find the primary integration
  const primaryIntegration = activeIntegrations.find(i => i.isPrimary);
  if (primaryIntegration) {
    return primaryIntegration;
  }
  
  // Otherwise return the first active integration
  return activeIntegrations[0];
}