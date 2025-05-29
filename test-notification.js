// Test script to create a notification directly and verify the system works
import { storage } from './server/storage.js';

async function createTestNotification() {
  try {
    console.log('Creating test notification...');
    
    const notification = await storage.createNotification({
      userId: 2, // Your user ID
      title: 'Webhook Test Notification',
      message: 'BUY order for 10 shares of AAPL placed successfully via webhook',
      type: 'trading',
      severity: 'info',
      metadata: {
        symbol: 'AAPL',
        additionalInfo: {
          quantity: 10,
          action: 'BUY',
          orderId: 'test-order-123',
          webhookId: 5,
          orderType: 'market'
        }
      }
    });
    
    console.log('Test notification created successfully:', notification);
    process.exit(0);
  } catch (error) {
    console.error('Error creating test notification:', error);
    process.exit(1);
  }
}

createTestNotification();