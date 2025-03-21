/**
 * Notification Service
 * 
 * This service handles alert threshold evaluation and notification delivery.
 * It provides functions to:
 * 1. Evaluate alert conditions against market data, strategy performance, etc.
 * 2. Generate and deliver notifications across multiple channels
 * 3. Manage notification throttling and delivery tracking
 */

import { storage } from './storage';
import {
  AlertThreshold,
  InsertNotification,
  Notification
} from '@shared/schema';

/**
 * Evaluate a specific alert threshold against relevant data to determine if it should trigger
 * 
 * @param threshold The alert threshold to evaluate
 * @param context Context data relevant to the threshold (market data, positions, etc.)
 * @returns True if the threshold condition is met, false otherwise
 */
export async function evaluateAlertThreshold(
  threshold: AlertThreshold,
  context: EvaluationContext
): Promise<boolean> {
  // Skip disabled thresholds
  if (!threshold.enabled) {
    return false;
  }

  // Check if threshold is on cooldown
  if (threshold.lastTriggered) {
    const lastTriggered = new Date(threshold.lastTriggered);
    const cooldownMinutes = threshold.notifications.throttle?.cooldownMinutes || 0;
    
    if (cooldownMinutes > 0) {
      const cooldownEnd = new Date(lastTriggered.getTime() + cooldownMinutes * 60 * 1000);
      if (new Date() < cooldownEnd) {
        console.log(`Threshold ${threshold.id} is on cooldown until ${cooldownEnd}`);
        return false;
      }
    }
  }

  // Check daily notification limit
  if (threshold.notifications.throttle?.maxPerDay) {
    // TODO: Implement daily notification limit check
  }

  // Evaluate threshold based on type
  switch (threshold.type) {
    case 'price':
      return evaluatePriceAlert(threshold, context);
    
    case 'price_change_percent':
      return evaluatePriceChangePercentAlert(threshold, context);
    
    case 'volume':
      return evaluateVolumeAlert(threshold, context);
    
    case 'position_profit_loss':
      return evaluatePositionProfitLossAlert(threshold, context);
    
    case 'strategy_performance':
      return evaluateStrategyPerformanceAlert(threshold, context);
    
    case 'market_event':
      return evaluateMarketEventAlert(threshold, context);
    
    case 'technical_indicator':
      return evaluateTechnicalIndicatorAlert(threshold, context);
    
    case 'news':
      return evaluateNewsAlert(threshold, context);
    
    default:
      console.error(`Unknown alert type: ${threshold.type}`);
      return false;
  }
}

/**
 * Creates and delivers a notification based on a triggered alert threshold
 * 
 * @param threshold The triggered alert threshold
 * @param context Context data for the notification
 * @returns The created notification
 */
export async function createNotificationFromThreshold(
  threshold: AlertThreshold,
  context: EvaluationContext
): Promise<Notification> {
  let title = '';
  let message = '';
  const metadata: Record<string, any> = {};

  switch (threshold.type) {
    case 'price':
      title = `Price Alert: ${threshold.conditions.symbol}`;
      message = getPriceAlertMessage(threshold, context);
      metadata.symbol = threshold.conditions.symbol;
      metadata.price = context.marketData?.currentPrice;
      break;
    
    case 'price_change_percent':
      title = `Price Change Alert: ${threshold.conditions.symbol}`;
      message = getPriceChangePercentAlertMessage(threshold, context);
      metadata.symbol = threshold.conditions.symbol;
      metadata.price = context.marketData?.currentPrice;
      metadata.changePercent = context.marketData?.changePercent;
      break;

    case 'volume':
      title = `Volume Alert: ${threshold.conditions.symbol}`;
      message = getVolumeAlertMessage(threshold, context);
      metadata.symbol = threshold.conditions.symbol;
      metadata.volume = context.marketData?.volume;
      break;

    case 'position_profit_loss':
      title = `P&L Alert: ${threshold.conditions.symbol || 'Portfolio'}`;
      message = getProfitLossAlertMessage(threshold, context);
      metadata.symbol = threshold.conditions.symbol;
      if (context.position) {
        metadata.profitLoss = context.position.unrealizedProfitLoss;
        metadata.profitLossPercent = context.position.unrealizedProfitLossPercent;
      }
      break;

    case 'strategy_performance':
      title = `Strategy Performance Alert`;
      message = getStrategyPerformanceAlertMessage(threshold, context);
      metadata.strategyId = threshold.conditions.strategyId;
      break;

    case 'market_event':
      title = `Market Event Alert`;
      message = getMarketEventAlertMessage(threshold, context);
      break;

    case 'technical_indicator':
      title = `Technical Indicator Alert: ${threshold.conditions.symbol}`;
      message = getTechnicalIndicatorAlertMessage(threshold, context);
      metadata.symbol = threshold.conditions.symbol;
      metadata.indicator = threshold.conditions.indicator;
      break;

    case 'news':
      title = `News Alert: ${threshold.conditions.symbol || 'Market'}`;
      message = getNewsAlertMessage(threshold, context);
      break;

    default:
      title = `Alert: ${threshold.name}`;
      message = `Alert condition has been triggered.`;
  }

  const notificationData: InsertNotification = {
    userId: threshold.userId,
    thresholdId: threshold.id,
    title,
    message,
    type: threshold.type,
    severity: threshold.notifications.severity,
    metadata
  };

  // Create notification record
  const notification = await storage.createNotification(notificationData);
  
  // Update the threshold's last triggered timestamp
  await storage.updateAlertThreshold(threshold.id, {
    lastTriggered: new Date()
  });

  // Deliver the notification to configured channels
  await deliverNotification(notification, threshold);

  return notification;
}

/**
 * Deliver a notification through configured delivery channels
 * 
 * @param notification The notification to deliver
 * @param threshold The alert threshold that triggered the notification
 */
async function deliverNotification(
  notification: Notification,
  threshold: AlertThreshold
): Promise<void> {
  const deliveredChannels: { channel: string; status: 'delivered' | 'failed'; failureReason?: string; timestamp: string }[] = [];
  const now = new Date().toISOString();

  // The app channel is always delivered (it's the in-app notification)
  deliveredChannels.push({
    channel: 'app',
    status: 'delivered',
    timestamp: now
  });

  // Process other delivery channels based on threshold configuration
  for (const channel of threshold.notifications.channels) {
    if (channel === 'app') continue; // Already handled

    try {
      switch (channel) {
        case 'email':
          // TODO: Implement email delivery
          console.log(`Would send email notification: ${notification.title}`);
          deliveredChannels.push({
            channel: 'email',
            status: 'delivered',
            timestamp: now
          });
          break;

        case 'sms':
          // TODO: Implement SMS delivery
          console.log(`Would send SMS notification: ${notification.title}`);
          deliveredChannels.push({
            channel: 'sms',
            status: 'delivered',
            timestamp: now
          });
          break;

        case 'push':
          // TODO: Implement push notification delivery
          console.log(`Would send push notification: ${notification.title}`);
          deliveredChannels.push({
            channel: 'push',
            status: 'delivered',
            timestamp: now
          });
          break;
      }
    } catch (error) {
      console.error(`Failed to deliver notification to ${channel}:`, error);
      deliveredChannels.push({
        channel,
        status: 'failed',
        failureReason: error.message || 'Unknown error',
        timestamp: now
      });
    }
  }

  // Update notification with delivery status
  await storage.updateNotification(notification.id, {
    deliveredChannels
  });
}

// Helper functions for generating notification messages
function getPriceAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { symbol, price, priceDirection } = threshold.conditions;
  const currentPrice = context.marketData?.currentPrice || 0;
  
  return `${symbol} price is now ${priceDirection === 'above' ? 'above' : 'below'} ${price} at ${currentPrice.toFixed(2)}.`;
}

function getPriceChangePercentAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { symbol, changePercent } = threshold.conditions;
  const currentChangePercent = context.marketData?.changePercent || 0;
  
  return `${symbol} has moved ${currentChangePercent.toFixed(2)}% today, crossing your ${changePercent}% threshold.`;
}

function getVolumeAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { symbol, volume } = threshold.conditions;
  const currentVolume = context.marketData?.volume || 0;
  
  return `${symbol} volume has reached ${currentVolume.toLocaleString()} shares, exceeding your threshold of ${volume.toLocaleString()}.`;
}

function getProfitLossAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { symbol, profitLossPercent, profitLossAmount } = threshold.conditions;
  
  if (profitLossPercent !== undefined) {
    const currentPL = context.position?.unrealizedProfitLossPercent || 0;
    return `Your ${symbol || 'portfolio'} position has reached ${currentPL.toFixed(2)}% P&L, crossing your ${profitLossPercent}% threshold.`;
  } else if (profitLossAmount !== undefined) {
    const currentPL = context.position?.unrealizedProfitLoss || 0;
    return `Your ${symbol || 'portfolio'} position has reached $${currentPL.toFixed(2)} P&L, crossing your $${profitLossAmount} threshold.`;
  }
  
  return `Your ${symbol || 'portfolio'} position has crossed your profit/loss threshold.`;
}

function getStrategyPerformanceAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { strategyId } = threshold.conditions;
  
  // TODO: Implement strategy performance message generation
  
  return `Your strategy performance has crossed your configured threshold.`;
}

function getMarketEventAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { eventType } = threshold.conditions;
  
  switch (eventType) {
    case 'market_open':
      return 'The market is now open for trading.';
    
    case 'market_close':
      return 'The market is now closed for trading.';
    
    case 'earnings':
      return `Earnings announcement for ${threshold.conditions.symbol} is approaching.`;
    
    case 'economic_announcement':
      return 'An important economic announcement is approaching.';
    
    default:
      return 'A market event has occurred that meets your alert criteria.';
  }
}

function getTechnicalIndicatorAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { symbol, indicator } = threshold.conditions;
  
  if (!indicator) return `Technical indicator alert for ${symbol}.`;
  
  switch (indicator.type) {
    case 'ma':
      return `${symbol} price has ${indicator.condition === 'cross_above' ? 'crossed above' : 'crossed below'} the ${indicator.parameters.period}-period moving average.`;
    
    case 'rsi':
      return `${symbol} RSI has ${indicator.condition === 'cross_above' ? 'crossed above' : 'crossed below'} ${indicator.parameters.level}.`;
    
    case 'macd':
      return `${symbol} MACD has signaled a ${indicator.condition === 'cross_above' ? 'bullish' : 'bearish'} crossover.`;
    
    case 'bollinger':
      return `${symbol} price has ${indicator.condition === 'cross_above' ? 'crossed above the upper' : 'crossed below the lower'} Bollinger Band.`;
    
    default:
      return `${symbol} has triggered a technical indicator alert.`;
  }
}

function getNewsAlertMessage(threshold: AlertThreshold, context: EvaluationContext): string {
  const { symbol } = threshold.conditions;
  
  // TODO: Implement news alert message generation
  
  return `Breaking news for ${symbol || 'the market'} that meets your alert criteria.`;
}

// Alert evaluation functions
function evaluatePriceAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  const { symbol, price, priceDirection } = threshold.conditions;
  
  if (!symbol || price === undefined || !priceDirection || !context.marketData) {
    return false;
  }
  
  const currentPrice = context.marketData.currentPrice;
  
  if (priceDirection === 'above') {
    return currentPrice > price;
  } else {
    return currentPrice < price;
  }
}

function evaluatePriceChangePercentAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  const { symbol, changePercent } = threshold.conditions;
  
  if (!symbol || changePercent === undefined || !context.marketData) {
    return false;
  }
  
  const currentChangePercent = Math.abs(context.marketData.changePercent);
  return currentChangePercent > Math.abs(changePercent);
}

function evaluateVolumeAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  const { symbol, volume } = threshold.conditions;
  
  if (!symbol || volume === undefined || !context.marketData) {
    return false;
  }
  
  return context.marketData.volume > volume;
}

function evaluatePositionProfitLossAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  const { symbol, profitLossPercent, profitLossAmount } = threshold.conditions;
  
  if (!context.position) {
    return false;
  }
  
  // Evaluate percent-based threshold
  if (profitLossPercent !== undefined) {
    const currentPLPercent = context.position.unrealizedProfitLossPercent;
    return Math.abs(currentPLPercent) > Math.abs(profitLossPercent);
  }
  
  // Evaluate amount-based threshold
  if (profitLossAmount !== undefined) {
    const currentPLAmount = context.position.unrealizedProfitLoss;
    return Math.abs(currentPLAmount) > Math.abs(profitLossAmount);
  }
  
  return false;
}

function evaluateStrategyPerformanceAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  // TODO: Implement strategy performance alert evaluation
  return false;
}

function evaluateMarketEventAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  const { eventType } = threshold.conditions;
  
  if (!eventType || !context.marketStatus) {
    return false;
  }
  
  switch (eventType) {
    case 'market_open':
      return context.marketStatus.isOpen && context.marketStatus.justOpened;
    
    case 'market_close':
      return !context.marketStatus.isOpen && context.marketStatus.justClosed;
    
    case 'earnings':
      // TODO: Implement earnings announcement check
      return false;
    
    case 'economic_announcement':
      // TODO: Implement economic announcement check
      return false;
    
    default:
      return false;
  }
}

function evaluateTechnicalIndicatorAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  const { symbol, indicator } = threshold.conditions;
  
  if (!symbol || !indicator || !context.technicalIndicators) {
    return false;
  }
  
  // Get the technical indicator data for this symbol
  const symbolIndicators = context.technicalIndicators[symbol];
  if (!symbolIndicators) {
    return false;
  }
  
  switch (indicator.type) {
    case 'ma':
      return evaluateMovingAverageAlert(indicator, symbolIndicators);
    
    case 'rsi':
      return evaluateRSIAlert(indicator, symbolIndicators);
    
    case 'macd':
      return evaluateMACDAlert(indicator, symbolIndicators);
    
    case 'bollinger':
      return evaluateBollingerBandsAlert(indicator, symbolIndicators);
    
    default:
      return false;
  }
}

function evaluateMovingAverageAlert(indicator: any, technicalData: any): boolean {
  // TODO: Implement MA alert evaluation
  return false;
}

function evaluateRSIAlert(indicator: any, technicalData: any): boolean {
  // TODO: Implement RSI alert evaluation
  return false;
}

function evaluateMACDAlert(indicator: any, technicalData: any): boolean {
  // TODO: Implement MACD alert evaluation
  return false;
}

function evaluateBollingerBandsAlert(indicator: any, technicalData: any): boolean {
  // TODO: Implement Bollinger Bands alert evaluation
  return false;
}

function evaluateNewsAlert(threshold: AlertThreshold, context: EvaluationContext): boolean {
  // TODO: Implement news alert evaluation
  return false;
}

// Interface definitions for alert evaluation
export interface EvaluationContext {
  marketData?: {
    symbol: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: Date;
  };
  
  position?: {
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedProfitLoss: number;
    unrealizedProfitLossPercent: number;
  };
  
  marketStatus?: {
    isOpen: boolean;
    justOpened: boolean;
    justClosed: boolean;
    nextOpenTime?: Date;
    nextCloseTime?: Date;
  };
  
  technicalIndicators?: {
    [symbol: string]: {
      movingAverages?: {
        periods: number[];
        values: number[];
        crossovers: {
          period1: number;
          period2: number;
          direction: 'above' | 'below';
        }[];
      };
      rsi?: {
        period: number;
        value: number;
        crossedAbove70: boolean;
        crossedBelow30: boolean;
      };
      macd?: {
        value: number;
        signal: number;
        histogram: number;
        crossover: 'bullish' | 'bearish' | null;
      };
      bollingerBands?: {
        upper: number;
        middle: number;
        lower: number;
        width: number;
        pricePosition: 'above' | 'within' | 'below';
      };
    };
  };
  
  news?: {
    symbol?: string;
    headlines: {
      title: string;
      url: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      relevance: number;
    }[];
  };
}

/**
 * Updates a notification with new information
 */
export async function updateNotification(id: number, updateData: Partial<Notification>): Promise<Notification | undefined> {
  return await storage.updateNotification(id, updateData);
}

/**
 * Process alert thresholds for a user and generate notifications if conditions are met
 * 
 * @param userId User ID to process alerts for
 * @param context Evaluation context with data for alert evaluation
 * @returns Array of created notifications
 */
export async function processUserAlerts(
  userId: number,
  context: EvaluationContext
): Promise<Notification[]> {
  const thresholds = await storage.getAlertThresholdsByUser(userId);
  const notifications: Notification[] = [];
  
  for (const threshold of thresholds) {
    if (await evaluateAlertThreshold(threshold, context)) {
      const notification = await createNotificationFromThreshold(threshold, context);
      notifications.push(notification);
    }
  }
  
  return notifications;
}