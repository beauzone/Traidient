/**
 * Webhook routes for handling webhook operations
 */
import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { generateWebhookToken, processWebhook } from '../webhookService';

const router = Router();

// Get all webhooks for the authenticated user
router.get('/', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const webhookList = await storage.getWebhooksByUser(userId);
    
    res.json(webhookList);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ message: 'Error fetching webhooks', error: String(error) });
  }
});

// Create a new webhook
router.post('/', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { name, description, strategyId, action, configuration } = req.body;
    
    // Generate a new webhook token
    const token = generateWebhookToken();
    
    const webhook = await storage.createWebhook({
      userId,
      name,
      description: description || '',
      token,
      strategyId: strategyId || null,
      action,
      configuration,
      callCount: 0
    });
    
    res.status(201).json(webhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ message: 'Error creating webhook', error: String(error) });
  }
});

// Get webhook details
router.get('/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const webhookId = parseInt(req.params.id);
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized access to webhook' });
    }
    
    res.json(webhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ message: 'Error fetching webhook', error: String(error) });
  }
});

// Update a webhook
router.put('/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const webhookId = parseInt(req.params.id);
    const { name, description, strategyId, action, configuration } = req.body;
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized access to webhook' });
    }
    
    const updatedWebhook = await storage.updateWebhook(webhookId, {
      name,
      description,
      strategyId,
      action, 
      configuration,
    });
    
    res.json(updatedWebhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ message: 'Error updating webhook', error: String(error) });
  }
});

// Delete a webhook
router.delete('/:id', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const webhookId = parseInt(req.params.id);
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized access to webhook' });
    }
    
    await storage.deleteWebhook(webhookId);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ message: 'Error deleting webhook', error: String(error) });
  }
});

// Get webhook logs
router.get('/:id/logs', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const webhookId = parseInt(req.params.id);
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized access to webhook' });
    }
    
    // Here we would typically get logs from the database
    // For now, we'll return a placeholder response with sample logs
    const logs = [
      {
        id: 1,
        webhookId,
        timestamp: new Date().toISOString(),
        action: 'ENTRY',
        status: 'success',
        message: 'Successfully processed entry signal for AAPL',
      },
      {
        id: 2,
        webhookId,
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        action: 'EXIT',
        status: 'error',
        message: 'Failed to process exit signal: No position found for TSLA',
      },
    ];
    
    res.json({ webhook, logs });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ message: 'Error fetching webhook logs', error: String(error) });
  }
});

// Process an incoming webhook request by token
router.post('/external/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const signature = req.headers['x-signature'] as string;
    const ip = req.ip || req.socket.remoteAddress || '';
    
    // Process the webhook
    const result = await processWebhook(token, req.body, ip, signature);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error processing webhook',
      error: String(error)
    });
  }
});

export default router;