import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { processWebhook, generateWebhookToken } from '../webhookService';
import { insertWebhookSchema } from '@shared/schema';
import { z } from 'zod';

const router = express.Router();

// Note: This route is now protected by the main authMiddleware from routes.ts

// Get all webhooks for current user
router.get('/', async (req: any, res: Response) => {
  try {
    const webhooks = await storage.getWebhooksByUser(req.user.id);
    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ message: 'Error fetching webhooks', error: (error as Error).message });
  }
});

// Create a new webhook
router.post('/', async (req: any, res: Response) => {
  try {
    // Validate request body
    const validatedData = insertWebhookSchema.parse({
      ...req.body,
      userId: req.user.id,
      token: generateWebhookToken(),
      callCount: 0,
      lastCalledAt: null
    });

    const webhook = await storage.createWebhook(validatedData);
    res.status(201).json(webhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid webhook data', errors: error.errors });
    } else {
      console.error('Error creating webhook:', error);
      res.status(500).json({ message: 'Error creating webhook', error: (error as Error).message });
    }
  }
});

// Get a specific webhook by ID
router.get('/:id', async (req: any, res: Response) => {
  try {
    const webhook = await storage.getWebhook(Number(req.params.id));
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: You do not have access to this webhook' });
    }
    
    res.json(webhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ message: 'Error fetching webhook', error: (error as Error).message });
  }
});

// Update a webhook
router.put('/:id', async (req: any, res: Response) => {
  try {
    const webhookId = Number(req.params.id);
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: You do not have access to this webhook' });
    }
    
    // Don't allow changing the userId or token
    const { userId, token, ...updateData } = req.body;
    
    const updatedWebhook = await storage.updateWebhook(webhookId, updateData);
    res.json(updatedWebhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ message: 'Error updating webhook', error: (error as Error).message });
  }
});

// Delete a webhook
router.delete('/:id', async (req: any, res: Response) => {
  try {
    const webhookId = Number(req.params.id);
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: You do not have access to this webhook' });
    }
    
    await storage.deleteWebhook(webhookId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ message: 'Error deleting webhook', error: (error as Error).message });
  }
});

// Get logs for a webhook
router.get('/:id/logs', async (req: any, res: Response) => {
  try {
    const webhookId = Number(req.params.id);
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: You do not have access to this webhook' });
    }
    
    // This assumes the logs are stored in the webhook object
    // You might want to fetch them separately if they're stored elsewhere
    const logs = webhook.logs || [];
    res.json(logs);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ message: 'Error fetching webhook logs', error: (error as Error).message });
  }
});

// Public endpoint for receiving webhook triggers
router.post('/trigger/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const payload = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const signature = req.headers['x-signature'] as string || '';

    const result = await processWebhook(token, payload, ip, signature);
    
    if (result.success) {
      return res.status(200).json({ message: 'Webhook processed successfully', result: result.data });
    } else {
      return res.status(400).json({ message: 'Failed to process webhook', error: result.error });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ message: 'Error processing webhook', error: (error as Error).message });
  }
});

export default router;