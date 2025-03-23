/**
 * Webhook routes for handling webhook operations
 */
import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { processWebhook, generateWebhookToken } from '../webhookService';
import { z } from 'zod';
import { insertWebhookSchema } from '@shared/schema';

const router = express.Router();

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req: any, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Get all webhooks for the authenticated user
router.get('/', ensureAuthenticated, async (req: any, res: Response) => {
  try {
    const webhooks = await storage.getWebhooksByUser(req.user.id);
    
    // Don't expose sensitive data like signature secrets
    const safeWebhooks = webhooks.map(webhook => {
      // Create a copy of the webhook
      const safeWebhook = { ...webhook };
      
      // Remove sensitive data from the configuration
      if (safeWebhook.configuration?.securitySettings?.signatureSecret) {
        safeWebhook.configuration.securitySettings.signatureSecret = '•••••••••';
      }
      
      return safeWebhook;
    });
    
    res.json(safeWebhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ message: 'Error fetching webhooks' });
  }
});

// Create a new webhook
router.post('/', ensureAuthenticated, async (req: any, res: Response) => {
  try {
    // Validate the request body
    const webhookSchema = insertWebhookSchema.extend({
      strategyId: z.number().optional(),
      integrationId: z.number().optional(),
      action: z.enum(['trade', 'cancel', 'status']),
      configuration: z.object({
        description: z.string().optional(),
        securitySettings: z.object({
          useSignature: z.boolean(),
          signatureSecret: z.string().optional(),
          ipWhitelist: z.array(z.string()).optional()
        }),
        allowShortSelling: z.boolean().optional(),
        positionSizing: z.object({
          type: z.enum(['fixed', 'percent', 'risk']),
          value: z.number()
        }).optional(),
        integrationId: z.number().optional()
      })
    });
    
    const webhookData = webhookSchema.parse(req.body);
    
    // Generate a unique token for the webhook
    const token = generateWebhookToken();
    
    // Create the webhook
    const webhook = await storage.createWebhook({
      name: webhookData.name,
      userId: req.user.id,
      token,
      strategyId: webhookData.strategyId,
      action: webhookData.action,
      isActive: true,
      configuration: webhookData.configuration,
      logs: [],
      callCount: 0
    });
    
    // Don't expose the token in the response for security
    res.status(201).json(webhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid webhook data', errors: error.errors });
    }
    res.status(500).json({ message: 'Error creating webhook' });
  }
});

// Get a specific webhook by ID
router.get('/:id', ensureAuthenticated, async (req: any, res: Response) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    if (isNaN(webhookId)) {
      return res.status(400).json({ message: 'Invalid webhook ID' });
    }
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    // Ensure the user owns the webhook
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Don't expose sensitive data
    if (webhook.configuration?.securitySettings?.signatureSecret) {
      webhook.configuration.securitySettings.signatureSecret = '•••••••••';
    }
    
    res.json(webhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ message: 'Error fetching webhook' });
  }
});

// Update a webhook
router.put('/:id', ensureAuthenticated, async (req: any, res: Response) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    if (isNaN(webhookId)) {
      return res.status(400).json({ message: 'Invalid webhook ID' });
    }
    
    const existingWebhook = await storage.getWebhook(webhookId);
    
    if (!existingWebhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    // Ensure the user owns the webhook
    if (existingWebhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Validate the request body
    const updateWebhookSchema = z.object({
      name: z.string().optional(),
      action: z.enum(['trade', 'cancel', 'status']).optional(),
      isActive: z.boolean().optional(),
      configuration: z.object({
        description: z.string().optional(),
        securitySettings: z.object({
          useSignature: z.boolean().optional(),
          signatureSecret: z.string().optional(),
          ipWhitelist: z.array(z.string()).optional()
        }).optional(),
        allowShortSelling: z.boolean().optional(),
        positionSizing: z.object({
          type: z.enum(['fixed', 'percent', 'risk']),
          value: z.number()
        }).optional(),
        integrationId: z.number().optional()
      }).optional()
    });
    
    const updateData = updateWebhookSchema.parse(req.body);
    
    // Special handling for the signature secret - don't overwrite it if not provided
    if (updateData.configuration?.securitySettings?.signatureSecret === '•••••••••') {
      delete updateData.configuration.securitySettings.signatureSecret;
    }
    
    // Update the webhook
    const updatedWebhook = await storage.updateWebhook(webhookId, updateData);
    
    if (!updatedWebhook) {
      return res.status(500).json({ message: 'Error updating webhook' });
    }
    
    // Don't expose sensitive data
    if (updatedWebhook.configuration?.securitySettings?.signatureSecret) {
      updatedWebhook.configuration.securitySettings.signatureSecret = '•••••••••';
    }
    
    res.json(updatedWebhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid webhook data', errors: error.errors });
    }
    res.status(500).json({ message: 'Error updating webhook' });
  }
});

// Delete a webhook
router.delete('/:id', ensureAuthenticated, async (req: any, res: Response) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    if (isNaN(webhookId)) {
      return res.status(400).json({ message: 'Invalid webhook ID' });
    }
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    // Ensure the user owns the webhook
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Delete the webhook
    const success = await storage.deleteWebhook(webhookId);
    
    if (!success) {
      return res.status(500).json({ message: 'Error deleting webhook' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ message: 'Error deleting webhook' });
  }
});

// Get webhook logs
router.get('/:id/logs', ensureAuthenticated, async (req: any, res: Response) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    if (isNaN(webhookId)) {
      return res.status(400).json({ message: 'Invalid webhook ID' });
    }
    
    const webhook = await storage.getWebhook(webhookId);
    
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    
    // Ensure the user owns the webhook
    if (webhook.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Return the logs
    res.json(webhook.logs || []);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ message: 'Error fetching webhook logs' });
  }
});

// Process an incoming webhook (public endpoint)
router.post('/trigger/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const payload = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const signature = req.headers['x-signature'] as string;
    
    if (!token) {
      return res.status(400).json({ message: 'Missing webhook token' });
    }
    
    if (!payload) {
      return res.status(400).json({ message: 'Missing webhook payload' });
    }
    
    // Process the webhook
    const result = await processWebhook(token, payload, ip, signature);
    
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    
    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ message: 'Error processing webhook' });
  }
});

export default router;