/**
 * Webhook routes for handling webhook operations
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { storage } from '../storage';
import { insertWebhookSchema } from '@shared/schema';

const router = Router();

// Get all webhooks for the authenticated user
router.get('/', async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const webhooks = await storage.getWebhooksByUser(req.user.id);
    res.json(webhooks);
  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({ message: 'Error fetching webhooks' });
  }
});

// Create a new webhook
router.post('/', async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Generate a unique token for the webhook URL
    const token = crypto.randomBytes(32).toString('hex');
    
    // Parse and validate the webhook data
    const webhookData = {
      ...req.body,
      userId: req.user.id,
      token,
      description: req.body.description
    };
    
    const validatedData = insertWebhookSchema.parse(webhookData);
    
    // Create the webhook
    const webhook = await storage.createWebhook(validatedData);
    
    res.status(201).json(webhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Create webhook error:', error);
    res.status(500).json({ message: 'Error creating webhook' });
  }
});

// Get a specific webhook by ID
router.get('/:id', async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const id = parseInt(req.params.id);
    const webhook = await storage.getWebhook(id);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: Not your webhook' });
    }
    
    res.json(webhook);
  } catch (error) {
    console.error('Get webhook error:', error);
    res.status(500).json({ message: 'Error fetching webhook' });
  }
});

// Update a webhook
router.put('/:id', async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const id = parseInt(req.params.id);
    const webhook = await storage.getWebhook(id);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: Not your webhook' });
    }
    
    // Update only allowed fields
    const updateData = {
      ...req.body,
      description: req.body.description
    };
    
    const updatedWebhook = await storage.updateWebhook(id, updateData);
    res.json(updatedWebhook);
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ message: 'Error updating webhook' });
  }
});

// Delete a webhook
router.delete('/:id', async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const id = parseInt(req.params.id);
    const webhook = await storage.getWebhook(id);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: Not your webhook' });
    }
    
    const deleted = await storage.deleteWebhook(id);
    
    if (deleted) {
      res.status(204).end();
    } else {
      res.status(500).json({ message: 'Failed to delete webhook' });
    }
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ message: 'Error deleting webhook' });
  }
});

// Get logs for a specific webhook
router.get('/:id/logs', async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const id = parseInt(req.params.id);
    const webhook = await storage.getWebhook(id);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: Not your webhook' });
    }
    
    // Return the webhook logs
    res.json({
      webhookId: id,
      logs: webhook.logs || []
    });
  } catch (error) {
    console.error('Get webhook logs error:', error);
    res.status(500).json({ message: 'Error fetching webhook logs' });
  }
});

export default router;