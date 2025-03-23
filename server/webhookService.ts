/**
 * TradingView Webhook Service
 * 
 * This service handles incoming webhook requests from TradingView alerts
 * and processes them into trading actions using the configured broker.
 */
import crypto from 'crypto';
import { Webhook } from '@shared/schema';
import { storage } from './storage';
import { AlpacaAPI } from './alpaca';
import { getApiIntegrationByIdOrDefault } from './utils';

/**
 * Verify the webhook payload signature
 * @param payload The webhook payload
 * @param signature The HMAC signature from the request header
 * @param secret The secret key used to generate the signature
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  const calculatedSignature = hmac.update(payload).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(signature)
  );
}

/**
 * Verify if the requestor's IP is in the whitelist
 * @param ip The requestor's IP address
 * @param whitelist Array of allowed IP addresses
 */
export function verifyIpWhitelist(ip: string, whitelist: string[]): boolean {
  if (!whitelist || whitelist.length === 0) {
    return true; // No whitelist means allow all
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
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Get the webhook from database by token
    const webhook = await storage.getWebhookByToken(webhookToken);
    
    if (!webhook) {
      return {
        success: false,
        message: 'Invalid webhook token'
      };
    }
    
    // Verify IP whitelist if configured
    if (webhook.configuration && webhook.configuration.securitySettings && 
        webhook.configuration.securitySettings.ipWhitelist && 
        webhook.configuration.securitySettings.ipWhitelist.length > 0) {
      const isValidIp = verifyIpWhitelist(ip, webhook.configuration.securitySettings.ipWhitelist);
      if (!isValidIp) {
        await storage.logWebhookCall(
          webhook.id, 
          payload as Record<string, any>, 
          'AUTHENTICATE',
          'error',
          `IP address ${ip} not in whitelist`
        );
        return {
          success: false,
          message: 'IP address not authorized'
        };
      }
    }
    
    // Verify signature if required
    if (webhook.configuration && webhook.configuration.securitySettings && 
        webhook.configuration.securitySettings.useSignature && 
        webhook.configuration.securitySettings.signatureSecret) {
      const isValidSignature = verifySignature(
        JSON.stringify(payload),
        signature || '',
        webhook.configuration.securitySettings.signatureSecret
      );
      
      if (!isValidSignature) {
        await storage.logWebhookCall(
          webhook.id, 
          payload as Record<string, any>, 
          'AUTHENTICATE',
          'error',
          'Invalid signature'
        );
        return {
          success: false,
          message: 'Invalid signature'
        };
      }
    }
    
    // Update call count
    await storage.updateWebhook(webhook.id, {
      callCount: (webhook.callCount || 0) + 1,
      lastCalledAt: new Date().toISOString()
    });
    
    // Process by signal type
    if ('action' in payload) {
      // It's a trade signal
      const signal = payload as TradeSignal;
      
      if (signal.action === 'BUY') {
        return await processEntrySignal(webhook, signal);
      } else if (signal.action === 'SELL' || signal.action === 'CLOSE') {
        return await processExitSignal(webhook, signal);
      } else if (signal.action === 'REVERSE') {
        // First close any existing position
        const closeResult = await processExitSignal(webhook, { 
          ...signal, 
          action: 'CLOSE' 
        });
        
        // Then open a new position in the opposite direction
        if (closeResult.success) {
          return await processEntrySignal(webhook, signal);
        } else {
          return closeResult;
        }
      }
    } else if ('cancel_order' in payload) {
      // It's a cancel order signal
      return await processCancelSignal(webhook, payload as CancelOrderSignal);
    } else if ('order_id' in payload) {
      // It's an order status request
      const orderId = (payload as OrderStatusSignal).order_id;
      
      // Get the integration based on the webhook configuration
      const integration = await getApiIntegrationByIdOrDefault(
        webhook.userId,
        webhook.configuration?.integrationId
      );
      
      if (!integration) {
        return {
          success: false,
          message: 'No broker integration available'
        };
      }
      
      const alpaca = new AlpacaAPI(integration);
      const orders = await alpaca.getOrders();
      const order = orders.find(o => o.id === orderId);
      
      return {
        success: true,
        message: order ? `Order ${orderId} status: ${order.status}` : `Order ${orderId} not found`,
        data: order
      };
    }
    
    // Log the invalid payload
    await storage.logWebhookCall(
      webhook.id, 
      payload as Record<string, any>, 
      'UNKNOWN',
      'error',
      'Invalid payload format'
    );
    
    return {
      success: false,
      message: 'Invalid webhook payload format'
    };
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      success: false,
      message: `Error processing webhook: ${error.message}`
    };
  }
}

/**
 * Process an entry signal (BUY)
 */
async function processEntrySignal(
  webhook: Webhook, 
  signal: TradeSignal
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Get the integration based on the webhook configuration
    const integration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration?.integrationId
    );
    
    if (!integration) {
      return {
        success: false,
        message: 'No broker integration available'
      };
    }
    
    const alpaca = new AlpacaAPI(integration);
    
    // Get current price if not provided
    let entryPrice = signal.entry_price;
    if (!entryPrice) {
      const quote = await alpaca.getQuote(signal.ticker);
      entryPrice = quote.latestTrade ? quote.latestTrade.p : null;
    }
    
    // Calculate quantity based on risk if not provided
    let quantity = signal.quantity;
    if (!quantity && signal.risk_percent) {
      const account = await alpaca.getAccount();
      const accountValue = parseFloat(account.equity);
      const riskAmount = accountValue * (signal.risk_percent / 100);
      
      if (signal.stop_loss && entryPrice) {
        const riskPerShare = Math.abs(entryPrice - signal.stop_loss);
        if (riskPerShare > 0) {
          quantity = Math.floor(riskAmount / riskPerShare);
        }
      } else if (entryPrice) {
        // Default 2% max loss per position if no stop loss
        quantity = Math.floor(riskAmount / entryPrice);
      }
    }
    
    // Default to 1 share if we couldn't calculate
    if (!quantity || quantity <= 0) {
      quantity = 1;
    }
    
    // Place the order
    const orderParams = {
      symbol: signal.ticker,
      qty: quantity,
      side: 'buy',
      type: 'market',
      time_in_force: 'day'
    };
    
    const order = await alpaca.placeOrder(orderParams);
    
    // Log the webhook call
    await storage.logWebhookCall(
      webhook.id, 
      signal as Record<string, any>, 
      'BUY',
      'success',
      `Buy order placed for ${quantity} ${signal.ticker}`
    );
    
    return {
      success: true,
      message: `Buy order placed for ${quantity} ${signal.ticker}`,
      data: order
    };
  } catch (error) {
    console.error('Error processing entry signal:', error);
    
    // Log the webhook failure
    await storage.logWebhookCall(
      webhook.id, 
      signal as Record<string, any>, 
      'BUY',
      'error',
      `Error: ${error.message}`
    );
    
    return {
      success: false,
      message: `Error placing buy order: ${error.message}`
    };
  }
}

/**
 * Process an exit signal (SELL or CLOSE)
 */
async function processExitSignal(
  webhook: Webhook, 
  signal: TradeSignal
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Get the integration based on the webhook configuration
    const integration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration?.integrationId
    );
    
    if (!integration) {
      return {
        success: false,
        message: 'No broker integration available'
      };
    }
    
    const alpaca = new AlpacaAPI(integration);
    
    // Check if we have a position for this symbol
    const positions = await alpaca.getPositions();
    const position = positions.find(p => p.symbol === signal.ticker);
    
    // If no position, handle based on configuration
    if (!position) {
      if (webhook.configuration && webhook.configuration.allowShortSelling) {
        // Place a short sell order if shorting is allowed
        const quantity = signal.quantity || 1;
        
        const orderParams = {
          symbol: signal.ticker,
          qty: quantity,
          side: 'sell',
          type: 'market',
          time_in_force: 'day'
        };
        
        const order = await alpaca.placeOrder(orderParams);
        
        // Log the webhook call
        await storage.logWebhookCall(
          webhook.id, 
          signal as Record<string, any>, 
          'SHORT',
          'success',
          `Short sell order placed for ${quantity} ${signal.ticker}`
        );
        
        return {
          success: true,
          message: `Short sell order placed for ${quantity} ${signal.ticker}`,
          data: order
        };
      } else {
        await storage.logWebhookCall(
          webhook.id, 
          signal as Record<string, any>, 
          'SELL',
          'error',
          `No position found for ${signal.ticker} and short selling is disabled`
        );
        
        return {
          success: false,
          message: `No position found for ${signal.ticker} and short selling is disabled`
        };
      }
    }
    
    // Place the sell order for the existing position
    const orderParams = {
      symbol: signal.ticker,
      qty: signal.quantity || position.qty,
      side: 'sell',
      type: 'market',
      time_in_force: 'day'
    };
    
    // If we're specifying a smaller quantity than the position, adjust
    if (signal.quantity && parseInt(position.qty) > signal.quantity) {
      orderParams.qty = signal.quantity;
    }
    
    const order = await alpaca.placeOrder(orderParams);
    
    // Log the webhook call
    await storage.logWebhookCall(
      webhook.id, 
      signal as Record<string, any>, 
      'SELL',
      'success',
      `Sell order placed for ${orderParams.qty} ${signal.ticker}`
    );
    
    return {
      success: true,
      message: `Sell order placed for ${orderParams.qty} ${signal.ticker}`,
      data: order
    };
  } catch (error) {
    console.error('Error processing exit signal:', error);
    
    // Log the webhook failure
    await storage.logWebhookCall(
      webhook.id, 
      signal as Record<string, any>, 
      'SELL',
      'error',
      `Error: ${error.message}`
    );
    
    return {
      success: false,
      message: `Error placing sell order: ${error.message}`
    };
  }
}

/**
 * Process a cancel order signal
 */
async function processCancelSignal(
  webhook: Webhook, 
  signal: CancelOrderSignal
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Get the integration based on the webhook configuration
    const integration = await getApiIntegrationByIdOrDefault(
      webhook.userId,
      webhook.configuration?.integrationId
    );
    
    if (!integration) {
      return {
        success: false,
        message: 'No broker integration available'
      };
    }
    
    const alpaca = new AlpacaAPI(integration);
    
    // Cancel the order
    const result = await alpaca.cancelOrder(signal.cancel_order);
    
    // Log the webhook call
    await storage.logWebhookCall(
      webhook.id, 
      signal as Record<string, any>, 
      'CANCEL',
      'success',
      `Order ${signal.cancel_order} cancelled`
    );
    
    return {
      success: true,
      message: `Order ${signal.cancel_order} cancelled`,
      data: result
    };
  } catch (error) {
    console.error('Error processing cancel signal:', error);
    
    // Log the webhook failure
    await storage.logWebhookCall(
      webhook.id, 
      signal as Record<string, any>, 
      'CANCEL',
      'error',
      `Error: ${error.message}`
    );
    
    return {
      success: false,
      message: `Error cancelling order: ${error.message}`
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