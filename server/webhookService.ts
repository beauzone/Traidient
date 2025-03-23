/**
 * TradingView Webhook Service
 * 
 * This service handles incoming webhook requests from TradingView alerts
 * and processes them into trading actions using the configured broker.
 */
import { storage } from './storage';
import { AlpacaAPI } from './alpaca';
import { getApiIntegrationByIdOrDefault } from './utils';
import crypto from 'crypto';
import { Webhook } from '@shared/schema';

/**
 * Verify the webhook payload signature
 * @param payload The webhook payload
 * @param signature The HMAC signature from the request header
 * @param secret The secret key used to generate the signature
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Verify if the requestor's IP is in the whitelist
 * @param ip The requestor's IP address
 * @param whitelist Array of allowed IP addresses
 */
export function verifyIpWhitelist(ip: string, whitelist: string[]): boolean {
  if (!whitelist || whitelist.length === 0) {
    return true; // No whitelist means all IPs are allowed
  }
  
  return whitelist.includes(ip);
}

interface TradeSignal {
  action: 'BUY' | 'SELL' | 'CLOSE' | 'REVERSE';
  ticker: string;
  quantity?: number;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  trailing_stop_percent?: number;
  profit_lock?: {
    new_stop_price: number;
  };
  atr_sizing?: boolean;
  risk_percent?: number;
}

interface CancelOrderSignal {
  cancel_order: string;
}

interface OrderStatusSignal {
  order_id: string;
}

type WebhookPayload = TradeSignal | CancelOrderSignal | OrderStatusSignal;

/**
 * Process an incoming webhook signal
 * @param webhookToken The unique token identifying the webhook
 * @param payload The webhook payload
 * @param ip The request IP address
 * @param signature The HMAC signature from request headers
 */
export async function processWebhook(
  webhookToken: string,
  payload: WebhookPayload,
  ip: string,
  signature?: string
): Promise<{ success: boolean, message: string, data?: any }> {
  try {
    // Find the webhook by token
    const webhook = await storage.getWebhookByToken(webhookToken);
    
    if (!webhook) {
      return { 
        success: false, 
        message: 'Invalid webhook token' 
      };
    }
    
    // Webhook must be active
    if (!webhook.isActive) {
      return { 
        success: false, 
        message: 'Webhook is inactive' 
      };
    }
    
    // Verify security settings if enabled
    if (webhook.configuration.securitySettings?.useSignature) {
      if (!signature) {
        return { 
          success: false, 
          message: 'Missing signature for webhook with signature verification enabled' 
        };
      }
      
      if (!webhook.configuration.securitySettings.signatureSecret) {
        return { 
          success: false, 
          message: 'Webhook signature verification is enabled but no secret is configured' 
        };
      }
      
      const isValidSignature = verifySignature(
        JSON.stringify(payload),
        signature,
        webhook.configuration.securitySettings.signatureSecret
      );
      
      if (!isValidSignature) {
        return { 
          success: false, 
          message: 'Invalid signature' 
        };
      }
    }
    
    // Verify IP whitelist if configured
    if (webhook.configuration.securitySettings?.ipWhitelist && 
        webhook.configuration.securitySettings.ipWhitelist.length > 0) {
      const isValidIp = verifyIpWhitelist(ip, webhook.configuration.securitySettings.ipWhitelist);
      
      if (!isValidIp) {
        return { 
          success: false, 
          message: 'IP address not allowed' 
        };
      }
    }
    
    // Log the webhook call
    await storage.updateWebhook(webhook.id, {
      callCount: (webhook.callCount || 0) + 1,
      lastCalledAt: new Date()
    });
    
    // Process the webhook based on the action
    let result;
    
    if (webhook.action === 'trade' && 'action' in payload) {
      if (payload.action === 'BUY') {
        result = await processEntrySignal(webhook, payload);
      } else if (payload.action === 'SELL' || payload.action === 'CLOSE') {
        result = await processExitSignal(webhook, payload);
      } else if (payload.action === 'REVERSE') {
        // Reverse means close any existing position and open a new one in the opposite direction
        const closeResult = await processExitSignal(webhook, {
          ...payload,
          action: 'CLOSE'
        });
        
        // Only proceed with the reverse entry if the close was successful
        if (closeResult.success) {
          // Create a new payload with the opposite action
          const reversePayload = {
            ...payload,
            action: 'BUY' as 'BUY'
          };
          
          result = await processEntrySignal(webhook, reversePayload);
        } else {
          result = closeResult;
        }
      } else {
        result = { 
          success: false, 
          message: `Unknown action: ${payload.action}` 
        };
      }
    } else if (webhook.action === 'cancel' && 'cancel_order' in payload) {
      result = await processCancelSignal(webhook, payload);
    } else if (webhook.action === 'status' && 'order_id' in payload) {
      // Order status check will be implemented in a future version
      result = { 
        success: false, 
        message: 'Order status check is not yet implemented' 
      };
    } else {
      result = { 
        success: false, 
        message: 'Invalid webhook payload for the configured action' 
      };
    }
    
    // Log the webhook action and result
    await storage.logWebhookCall(
      webhook.id,
      payload,
      'action' in payload ? payload.action : webhook.action,
      result.success ? 'success' : 'error',
      result.message
    );
    
    return result;
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      success: false,
      message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process an entry signal (BUY)
 */
async function processEntrySignal(
  webhook: Webhook, 
  signal: TradeSignal
): Promise<{ success: boolean, message: string, data?: any }> {
  try {
    // Get the Alpaca API instance using the webhook's configured integration or the user's default
    const alpacaIntegration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration.integrationId
    );
    
    if (!alpacaIntegration) {
      return {
        success: false,
        message: 'No valid trading account found'
      };
    }
    
    const alpaca = new AlpacaAPI(alpacaIntegration);
    
    // Validate required fields
    if (!signal.ticker) {
      return {
        success: false,
        message: 'Missing required field: ticker'
      };
    }
    
    // Determine the quantity to trade
    let quantity = signal.quantity;
    
    if (!quantity) {
      // If no quantity is specified, use the webhook configuration for position sizing
      // This is a simplified implementation - in a real system you'd have more advanced sizing logic
      const defaultQuantity = 1;
      quantity = defaultQuantity;
    }
    
    // Set up the order parameters
    const orderParams = {
      symbol: signal.ticker,
      qty: quantity.toString(),
      side: 'buy' as 'buy',  // Type assertion to match expected type
      type: 'market' as 'market',  // Type assertion to match expected type
      time_in_force: 'day' as 'day'  // Type assertion to match expected type
    };
    
    // Place the order
    try {
      const order = await alpaca.placeOrder(orderParams);
      
      return {
        success: true,
        message: `Successfully placed buy order for ${quantity} shares of ${signal.ticker}`,
        data: order
      };
    } catch (error) {
      console.error('Error placing order:', error);
      return {
        success: false,
        message: `Error placing order: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('Error processing entry signal:', error);
    return {
      success: false,
      message: `Error processing entry signal: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process an exit signal (SELL or CLOSE)
 */
async function processExitSignal(
  webhook: Webhook, 
  signal: TradeSignal
): Promise<{ success: boolean, message: string, data?: any }> {
  try {
    // Get the Alpaca API instance using the webhook's configured integration or the user's default
    const alpacaIntegration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration.integrationId
    );
    
    if (!alpacaIntegration) {
      return {
        success: false,
        message: 'No valid trading account found'
      };
    }
    
    const alpaca = new AlpacaAPI(alpacaIntegration);
    
    // Validate required fields
    if (!signal.ticker) {
      return {
        success: false,
        message: 'Missing required field: ticker'
      };
    }
    
    // Get current positions to determine quantity
    const positions = await alpaca.getPositions();
    const position = positions.find(p => p.symbol === signal.ticker);
    
    if (!position) {
      // Check if we should allow short selling
      if (webhook.configuration.allowShortSelling && signal.action === 'SELL') {
        // Determine the quantity to short
        let quantity = signal.quantity;
        
        if (!quantity) {
          // Default short quantity
          quantity = 1;
        }
        
        // Set up the order parameters for a short sell
        const orderParams = {
          symbol: signal.ticker,
          qty: quantity.toString(),
          side: 'sell' as 'sell',  // Type assertion to match expected type
          type: 'market' as 'market',  // Type assertion to match expected type
          time_in_force: 'day' as 'day'  // Type assertion to match expected type
        };
        
        // Place the short sell order
        try {
          const order = await alpaca.placeOrder(orderParams);
          
          return {
            success: true,
            message: `Successfully placed short sell order for ${quantity} shares of ${signal.ticker}`,
            data: order
          };
        } catch (error) {
          return {
            success: false,
            message: `Error placing short sell order: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      } else {
        return {
          success: false,
          message: `No position found for ${signal.ticker}`
        };
      }
    }
    
    // Determine quantity to sell
    const quantityToSell = signal.quantity || parseInt(position.qty);
    
    // Set up the order parameters
    const orderParams = {
      symbol: signal.ticker,
      qty: quantityToSell.toString(),
      side: 'sell' as 'sell',  // Type assertion to match expected type
      type: 'market' as 'market',  // Type assertion to match expected type
      time_in_force: 'day' as 'day'  // Type assertion to match expected type
    };
    
    // Place the order
    try {
      const order = await alpaca.placeOrder(orderParams);
      
      return {
        success: true,
        message: `Successfully placed sell order for ${quantityToSell} shares of ${signal.ticker}`,
        data: order
      };
    } catch (error) {
      console.error('Error placing sell order:', error);
      return {
        success: false,
        message: `Error placing sell order: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('Error processing exit signal:', error);
    return {
      success: false,
      message: `Error processing exit signal: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process a cancel order signal
 */
async function processCancelSignal(
  webhook: Webhook, 
  signal: CancelOrderSignal
): Promise<{ success: boolean, message: string, data?: any }> {
  try {
    // Get the Alpaca API instance using the webhook's configured integration or the user's default
    const alpacaIntegration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration.integrationId
    );
    
    if (!alpacaIntegration) {
      return {
        success: false,
        message: 'No valid trading account found'
      };
    }
    
    const alpaca = new AlpacaAPI(alpacaIntegration);
    
    // Validate required fields
    if (!signal.cancel_order) {
      return {
        success: false,
        message: 'Missing required field: cancel_order'
      };
    }
    
    // Cancel the order
    try {
      const cancelResult = await alpaca.cancelOrder(signal.cancel_order);
      
      return {
        success: true,
        message: `Successfully canceled order ${signal.cancel_order}`,
        data: cancelResult
      };
    } catch (error) {
      console.error('Error canceling order:', error);
      return {
        success: false,
        message: `Error canceling order: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('Error processing cancel signal:', error);
    return {
      success: false,
      message: `Error processing cancel signal: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generate a new webhook token
 * @returns A secure random token string
 */
export function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString('hex');
}