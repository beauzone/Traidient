/**
 * TradingView Webhook Service
 * 
 * This service handles incoming webhook requests from TradingView alerts
 * and processes them into trading actions using the configured broker.
 */

import { storage } from "./storage";
import { Webhook } from "@shared/schema";
import { AlpacaAPI } from "./alpaca";
import crypto from 'crypto';

/**
 * Verify the webhook payload signature
 * @param payload The webhook payload
 * @param signature The HMAC signature from the request header
 * @param secret The secret key used to generate the signature
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(computedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

/**
 * Verify if the requestor's IP is in the whitelist
 * @param ip The requestor's IP address
 * @param whitelist Array of allowed IP addresses
 */
export function verifyIpWhitelist(ip: string, whitelist: string[]): boolean {
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
  payload: Record<string, any>,
  ip: string,
  signature?: string
): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // Find the webhook configuration by token
    const webhook = await storage.getWebhookByToken(webhookToken);
    if (!webhook) {
      return { success: false, message: "Invalid webhook token" };
    }
    
    // Get strategy information
    const strategy = await storage.getStrategy(webhook.strategyId);
    if (!strategy) {
      return { success: false, message: "Strategy not found" };
    }
    
    // Get user information and integrations
    const user = await storage.getUser(webhook.userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }
    
    // Verify IP if IP whitelisting is enabled
    // TradingView IPs: "52.89.214.238", "34.212.75.30", ...
    const tradingViewIps = ["52.89.214.238", "34.212.75.30"];
    if (!verifyIpWhitelist(ip, tradingViewIps)) {
      await storage.logWebhookCall(
        webhook.id, 
        payload, 
        "SECURITY_CHECK", 
        "error", 
        "IP not in whitelist"
      );
      return { success: false, message: "IP not allowed" };
    }
    
    // Verify signature if signature verification is enabled
    const securitySettings = (webhook.configuration as any)?.securitySettings;
    if (signature && securitySettings?.useSignatureVerification) {
      const isValidSignature = verifySignature(
        JSON.stringify(payload),
        signature,
        securitySettings?.signatureSecret || ''
      );
      
      if (!isValidSignature) {
        await storage.logWebhookCall(
          webhook.id, 
          payload, 
          "SECURITY_CHECK", 
          "error", 
          "Invalid signature"
        );
        return { success: false, message: "Invalid signature" };
      }
    }
    
    // Process based on webhook action type
    switch (webhook.action) {
      case 'entry':
        return await processEntrySignal(webhook, payload as TradeSignal);
      case 'exit':
        return await processExitSignal(webhook, payload as TradeSignal);
      case 'cancel':
        return await processCancelSignal(webhook, payload as CancelOrderSignal);
      default:
        await storage.logWebhookCall(
          webhook.id, 
          payload, 
          "UNKNOWN_ACTION", 
          "error", 
          `Unknown action: ${webhook.action}`
        );
        return { success: false, message: `Unknown action: ${webhook.action}` };
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return { 
      success: false, 
      message: `Error processing webhook: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Process an entry signal (BUY)
 */
async function processEntrySignal(
  webhook: Webhook, 
  signal: TradeSignal
): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // Log the webhook call
    await storage.logWebhookCall(
      webhook.id,
      signal,
      "ENTRY",
      "success"
    );
    
    // Get user's integration for the broker
    const integration = await storage.getApiIntegrationByProviderAndUser(
      webhook.userId, 
      "alpaca"
    );
    
    if (!integration) {
      return { 
        success: false, 
        message: "No broker integration found for user" 
      };
    }
    
    // Initialize the broker API
    const broker = new AlpacaAPI(integration);
    
    // Calculate position size
    let quantity = signal.quantity;
    
    // If ATR sizing is enabled, calculate position size based on risk
    if (signal.atr_sizing && signal.risk_percent) {
      // We would need to implement ATR calculation here
      // For simplicity, we'll use a fixed calculation based on risk percentage
      const accountInfo = await broker.getAccount();
      const portfolioValue = accountInfo.equity;
      const riskAmount = portfolioValue * (signal.risk_percent / 100);
      
      // If stop loss is provided, calculate quantity based on risk amount
      if (signal.stop_loss && signal.entry_price) {
        const riskPerShare = Math.abs(signal.entry_price - signal.stop_loss);
        quantity = Math.floor(riskAmount / riskPerShare);
      }
    }
    
    // Ensure minimum quantity
    quantity = Math.max(quantity || 1, 1);
    
    // Place the order
    // Create order parameters with correct typing
    const orderParams: any = {
      symbol: signal.ticker,
      qty: quantity.toString(), // Convert to string as required by Alpaca API
      side: signal.action === 'BUY' ? 'buy' : 'sell',
      type: 'market', // Default to market order
      time_in_force: 'gtc',
    };
    
    // Add stop loss if specified
    if (signal.stop_loss) {
      orderParams.order_class = 'bracket';
      orderParams.stop_loss = {
        stop_price: signal.stop_loss.toString()
      };
    }
    
    // Add take profit if specified
    if (signal.take_profit) {
      orderParams.order_class = 'bracket';
      orderParams.take_profit = {
        limit_price: signal.take_profit.toString()
      };
    }
    
    // Place the order
    const order = await broker.placeOrder(orderParams);
    
    return {
      success: true,
      message: `Order placed successfully for ${signal.ticker}`,
      data: order
    };
  } catch (error) {
    console.error("Error processing entry signal:", error);
    
    // Log the error
    await storage.logWebhookCall(
      webhook.id,
      signal,
      "ENTRY",
      "error",
      error instanceof Error ? error.message : String(error)
    );
    
    return {
      success: false,
      message: `Error placing order: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Process an exit signal (SELL or CLOSE)
 */
async function processExitSignal(
  webhook: Webhook, 
  signal: TradeSignal
): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // Log the webhook call
    await storage.logWebhookCall(
      webhook.id,
      signal,
      "EXIT",
      "success"
    );
    
    // Get user's integration for the broker
    const integration = await storage.getApiIntegrationByProviderAndUser(
      webhook.userId, 
      "alpaca"
    );
    
    if (!integration) {
      return { 
        success: false, 
        message: "No broker integration found for user" 
      };
    }
    
    // Initialize the broker API
    const broker = new AlpacaAPI(integration);
    
    // For CLOSE action, close the position completely
    if (signal.action === 'CLOSE') {
      const positions = await broker.getPositions();
      const position = positions.find(p => p.symbol === signal.ticker);
      
      if (!position) {
        return {
          success: false,
          message: `No position found for ${signal.ticker}`
        };
      }
      
      // Place a market order to close the position
      const orderParams: any = {
        symbol: signal.ticker,
        qty: position.qty.toString(),
        side: position.side === 'long' ? 'sell' : 'buy',
        type: 'market',
        time_in_force: 'gtc',
      };
      
      const order = await broker.placeOrder(orderParams);
      
      return {
        success: true,
        message: `Position closed for ${signal.ticker}`,
        data: order
      };
    } 
    // For SELL, sell the specified quantity
    else if (signal.action === 'SELL') {
      const orderParams: any = {
        symbol: signal.ticker,
        qty: (signal.quantity || 1).toString(),
        side: 'sell',
        type: 'market',
        time_in_force: 'gtc',
      };
      
      const order = await broker.placeOrder(orderParams);
      
      return {
        success: true,
        message: `Sell order placed for ${signal.ticker}`,
        data: order
      };
    }
    // For REVERSE, close the current position and open a new one in the opposite direction
    else if (signal.action === 'REVERSE') {
      const positions = await broker.getPositions();
      const position = positions.find(p => p.symbol === signal.ticker);
      
      if (!position) {
        // If no position exists, treat as a new entry
        return processEntrySignal(webhook, signal);
      }
      
      // Close the current position
      const closeParams = {
        symbol: signal.ticker,
        qty: position.qty.toString(),
        side: (position.side === 'long' ? 'sell' : 'buy') as 'buy' | 'sell',
        type: 'market' as 'market',
        time_in_force: 'gtc' as 'gtc',
      };
      
      await broker.placeOrder(closeParams);
      
      // Open a new position in the opposite direction
      const newSide = position.side === 'long' ? 'sell' : 'buy';
      const openParams = {
        symbol: signal.ticker,
        qty: (signal.quantity || position.qty).toString(),
        side: newSide as 'buy' | 'sell',
        type: 'market' as 'market',
        time_in_force: 'gtc' as 'gtc',
      };
      
      const order = await broker.placeOrder(openParams);
      
      return {
        success: true,
        message: `Position reversed for ${signal.ticker}`,
        data: order
      };
    }
    
    return {
      success: false,
      message: `Unsupported action: ${signal.action}`
    };
  } catch (error) {
    console.error("Error processing exit signal:", error);
    
    // Log the error
    await storage.logWebhookCall(
      webhook.id,
      signal,
      "EXIT",
      "error",
      error instanceof Error ? error.message : String(error)
    );
    
    return {
      success: false,
      message: `Error processing exit signal: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Process a cancel order signal
 */
async function processCancelSignal(
  webhook: Webhook, 
  signal: CancelOrderSignal
): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // Log the webhook call
    await storage.logWebhookCall(
      webhook.id,
      signal,
      "CANCEL",
      "success"
    );
    
    // Get user's integration for the broker
    const integration = await storage.getApiIntegrationByProviderAndUser(
      webhook.userId, 
      "alpaca"
    );
    
    if (!integration) {
      return { 
        success: false, 
        message: "No broker integration found for user" 
      };
    }
    
    // Initialize the broker API
    const broker = new AlpacaAPI(integration);
    
    // Cancel the order
    await broker.cancelOrder(signal.cancel_order);
    
    return {
      success: true,
      message: `Order ${signal.cancel_order} cancelled successfully`
    };
  } catch (error) {
    console.error("Error processing cancel signal:", error);
    
    // Log the error
    await storage.logWebhookCall(
      webhook.id,
      signal,
      "CANCEL",
      "error",
      error instanceof Error ? error.message : String(error)
    );
    
    return {
      success: false,
      message: `Error cancelling order: ${error instanceof Error ? error.message : String(error)}`
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