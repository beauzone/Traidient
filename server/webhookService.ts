/**
 * TradingView Webhook Service
 * 
 * This service handles incoming webhook requests from TradingView alerts
 * and processes them into trading actions using the configured broker.
 */
import crypto from 'crypto';
import { storage } from './storage';
import { getApiIntegrationByIdOrDefault } from './utils';
import { AlpacaAPI } from './alpaca';

/**
 * Verify the webhook payload signature
 * @param payload The webhook payload
 * @param signature The HMAC signature from the request header
 * @param secret The secret key used to generate the signature
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Verify if the requestor's IP is in the whitelist
 * @param ip The requestor's IP address
 * @param whitelist Array of allowed IP addresses
 */
export function verifyIpWhitelist(ip: string, whitelist: string[]): boolean {
  if (!whitelist || whitelist.length === 0) return true; // No whitelist means all IPs are allowed
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
  signature: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Get webhook by token
    const webhook = await storage.getWebhookByToken(webhookToken);
    
    if (!webhook) {
      return { success: false, error: 'Invalid webhook token' };
    }
    
    if (!webhook.isActive) {
      await storage.logWebhookCall(
        webhook.id, 
        payload, 
        'verification', 
        'error', 
        'Webhook is inactive'
      );
      return { success: false, error: 'This webhook is not active' };
    }
    
    // Verify signature if enabled
    if (webhook.configuration?.securitySettings?.useSignature) {
      const secret = webhook.configuration.securitySettings.signatureSecret;
      if (!secret) {
        await storage.logWebhookCall(
          webhook.id, 
          payload, 
          'verification', 
          'error', 
          'Signature verification enabled but no secret key configured'
        );
        return { success: false, error: 'Signature verification configuration error' };
      }
      
      if (!signature) {
        await storage.logWebhookCall(
          webhook.id, 
          payload, 
          'verification', 
          'error', 
          'Missing signature header'
        );
        return { success: false, error: 'Signature required but not provided' };
      }
      
      if (!verifySignature(JSON.stringify(payload), signature, secret)) {
        await storage.logWebhookCall(
          webhook.id, 
          payload, 
          'verification', 
          'error', 
          'Invalid signature'
        );
        return { success: false, error: 'Invalid signature' };
      }
    }
    
    // Verify IP whitelist if configured
    if (webhook.configuration?.securitySettings?.ipWhitelist && 
        webhook.configuration.securitySettings.ipWhitelist.length > 0) {
      if (!verifyIpWhitelist(ip, webhook.configuration.securitySettings.ipWhitelist)) {
        await storage.logWebhookCall(
          webhook.id, 
          payload, 
          'verification', 
          'error', 
          `IP address ${ip} not in whitelist`
        );
        return { success: false, error: 'IP not authorized' };
      }
    }
    
    // Process the webhook based on action type
    let result;
    if ('action' in payload) {
      result = await processEntrySignal(webhook, payload);
    } else if ('cancel_order' in payload) {
      result = await processCancelSignal(webhook, payload);
    } else if ('order_id' in payload) {
      // Just log the request for order status checks
      result = { success: true, data: { message: 'Order status check received' } };
      await storage.logWebhookCall(
        webhook.id, 
        payload, 
        'order_status', 
        'success', 
        'Order status check processed'
      );
    } else {
      await storage.logWebhookCall(
        webhook.id, 
        payload, 
        'unknown', 
        'error', 
        'Unknown webhook payload type'
      );
      return { success: false, error: 'Unknown webhook payload type' };
    }
    
    // Update webhook call count
    await storage.updateWebhook(webhook.id, {
      callCount: (webhook.callCount || 0) + 1,
      lastCalledAt: new Date()
    });
    
    return result;
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Process an entry signal (BUY)
 */
async function processEntrySignal(
  webhook: any, 
  signal: TradeSignal
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Get the integration to use
    const integration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration?.integrationId
    );
    
    if (!integration) {
      await storage.logWebhookCall(
        webhook.id, 
        signal, 
        'trade', 
        'error', 
        'No valid broker integration found'
      );
      return { success: false, error: 'No valid broker integration found' };
    }
    
    // Initialize the API client
    const alpaca = new AlpacaAPI(integration);
    
    // Check if API is valid
    if (!alpaca.isValid) {
      await storage.logWebhookCall(
        webhook.id, 
        signal, 
        'trade', 
        'error', 
        'Invalid broker API configuration'
      );
      return { success: false, error: 'Invalid broker API configuration' };
    }
    
    // Determine trade parameters
    const ticker = signal.ticker.toUpperCase();
    let quantity = signal.quantity;
    
    // If no quantity provided, use position sizing from webhook configuration
    if (!quantity && webhook.configuration?.positionSizing) {
      const positionSizing = webhook.configuration.positionSizing;
      
      if (positionSizing.type === 'fixed') {
        quantity = positionSizing.value;
      } else if (positionSizing.type === 'percentage') {
        // Get account info to calculate position size based on percentage
        const accountInfo = await alpaca.getAccount();
        const equity = accountInfo.equity;
        
        // Get current price for the ticker
        const quoteData = await alpaca.getQuote(ticker);
        const price = quoteData.latestTrade?.p || quoteData.latestQuote?.ap || 0;
        
        if (price === 0) {
          await storage.logWebhookCall(
            webhook.id, 
            signal, 
            'trade', 
            'error', 
            `Could not determine price for ${ticker}`
          );
          return { success: false, error: `Could not determine price for ${ticker}` };
        }
        
        // Calculate number of shares based on percentage of equity
        const allocationAmount = (equity * positionSizing.value) / 100;
        quantity = Math.floor(allocationAmount / price);
      } else if (positionSizing.type === 'risk-based') {
        // Risk-based sizing requires a stop loss
        if (!signal.stop_loss) {
          await storage.logWebhookCall(
            webhook.id, 
            signal, 
            'trade', 
            'error', 
            'Risk-based position sizing requires a stop_loss value'
          );
          return { 
            success: false, 
            error: 'Risk-based position sizing requires a stop_loss value' 
          };
        }
        
        // Get account info
        const accountInfo = await alpaca.getAccount();
        const equity = accountInfo.equity;
        
        // Get current price for the ticker
        const quoteData = await alpaca.getQuote(ticker);
        const price = quoteData.latestTrade?.p || quoteData.latestQuote?.ap || 0;
        
        if (price === 0) {
          await storage.logWebhookCall(
            webhook.id, 
            signal, 
            'trade', 
            'error', 
            `Could not determine price for ${ticker}`
          );
          return { success: false, error: `Could not determine price for ${ticker}` };
        }
        
        // Calculate risk amount
        const riskAmount = (equity * positionSizing.value) / 100;
        
        // Calculate risk per share
        const riskPerShare = Math.abs(price - signal.stop_loss);
        
        if (riskPerShare === 0) {
          await storage.logWebhookCall(
            webhook.id, 
            signal, 
            'trade', 
            'error', 
            'Stop loss is identical to current price, cannot calculate position size'
          );
          return { 
            success: false, 
            error: 'Stop loss is identical to current price, cannot calculate position size' 
          };
        }
        
        // Calculate number of shares based on risk
        quantity = Math.floor(riskAmount / riskPerShare);
      }
    }
    
    // Ensure we have a valid quantity
    if (!quantity || quantity <= 0) {
      await storage.logWebhookCall(
        webhook.id, 
        signal, 
        'trade', 
        'error', 
        'Invalid quantity calculated'
      );
      return { success: false, error: 'Invalid quantity calculated' };
    }
    
    // Prepare order parameters
    const params: any = {
      symbol: ticker,
      qty: quantity.toString(),
      side: signal.action === 'BUY' ? 'buy' : 'sell',
      type: 'market',
      time_in_force: 'day'
    };
    
    // Add limit price if entry_price is provided
    if (signal.entry_price) {
      params.type = 'limit';
      params.limit_price = signal.entry_price;
    }
    
    // Check if short selling is allowed
    if (signal.action === 'SELL' && !webhook.configuration?.allowShortSelling) {
      // Check current position to make sure we're not opening a short
      const positions = await alpaca.getPositions();
      const existingPosition = positions.find((p: any) => p.symbol === ticker);
      
      if (!existingPosition || (existingPosition && existingPosition.qty < quantity)) {
        await storage.logWebhookCall(
          webhook.id, 
          signal, 
          'trade', 
          'error', 
          'Short selling not allowed by webhook configuration'
        );
        return { 
          success: false, 
          error: 'Short selling not allowed by webhook configuration' 
        };
      }
    }
    
    // Place the order
    const order = await alpaca.placeOrder(params);
    
    // Create bracket orders if stop_loss or take_profit are provided
    if (order.id && (signal.stop_loss || signal.take_profit)) {
      try {
        // Stop loss order
        if (signal.stop_loss) {
          await alpaca.placeOrder({
            symbol: ticker,
            qty: quantity.toString(),
            side: signal.action === 'BUY' ? 'sell' : 'buy',
            type: 'stop',
            time_in_force: 'gtc',
            stop_price: signal.stop_loss.toString()
          });
        }
        
        // Take profit order
        if (signal.take_profit) {
          await alpaca.placeOrder({
            symbol: ticker,
            qty: quantity.toString(),
            side: signal.action === 'BUY' ? 'sell' : 'buy',
            type: 'limit',
            time_in_force: 'gtc',
            limit_price: signal.take_profit.toString()
          });
        }
      } catch (error) {
        console.error('Error creating bracket orders:', error);
        // Main order was still placed, so we don't return an error here
      }
    }
    
    await storage.logWebhookCall(
      webhook.id, 
      signal, 
      'trade', 
      'success', 
      `Order placed: ${signal.action} ${quantity} shares of ${ticker}`
    );
    
    return { success: true, data: order };
  } catch (error) {
    console.error('Error processing trade signal:', error);
    await storage.logWebhookCall(
      webhook.id, 
      signal, 
      'trade', 
      'error', 
      (error as Error).message
    );
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Process an exit signal (SELL or CLOSE)
 */
async function processCancelSignal(
  webhook: any, 
  signal: CancelOrderSignal
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Get the integration to use
    const integration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration?.integrationId
    );
    
    if (!integration) {
      await storage.logWebhookCall(
        webhook.id, 
        signal, 
        'cancel', 
        'error', 
        'No valid broker integration found'
      );
      return { success: false, error: 'No valid broker integration found' };
    }
    
    // Initialize the API client
    const alpaca = new AlpacaAPI(integration);
    
    // Check if API is valid
    if (!alpaca.isValid) {
      await storage.logWebhookCall(
        webhook.id, 
        signal, 
        'cancel', 
        'error', 
        'Invalid broker API configuration'
      );
      return { success: false, error: 'Invalid broker API configuration' };
    }
    
    // Cancel the order
    const result = await alpaca.cancelOrder(signal.cancel_order);
    
    await storage.logWebhookCall(
      webhook.id, 
      signal, 
      'cancel', 
      'success', 
      `Order cancelled: ${signal.cancel_order}`
    );
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error cancelling order:', error);
    await storage.logWebhookCall(
      webhook.id, 
      signal, 
      'cancel', 
      'error', 
      (error as Error).message
    );
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Generate a new webhook token
 * @returns A secure random token string
 */
export function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString('hex');
}