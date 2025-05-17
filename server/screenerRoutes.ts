/**
 * Enhanced Screener API Routes
 * Integrates with the multi-provider screener service
 */

import { Request, Response, Router } from 'express';
import { PythonScreenerService } from './pythonScreenerService';
import { ScreenerDataService } from './screenerDataService';
import { storage } from './storage';

// Initialize services
const dataService = new ScreenerDataService();
const screenerService = new PythonScreenerService(undefined, dataService);

const router = Router();

// Get available data providers
router.get('/providers', (req: Request, res: Response) => {
  const providers = screenerService.getAvailableProviders();
  const availableProviders = providers.map(name => ({
    name,
    isReady: dataService.isProviderReady(name)
  }));

  res.json({ providers: availableProviders });
});

// Get last used provider and available provider order
router.get('/last-provider', (req: Request, res: Response) => {
  const lastProvider = screenerService.getLastUsedProvider();
  const availableProviders = screenerService.getProviderOrder();
  
  res.json({ 
    lastProvider: lastProvider || 'None',
    availableProviders 
  });
});

// Set provider order
router.post('/provider-order', (req: Request, res: Response) => {
  try {
    const { providerOrder } = req.body;
    
    if (!Array.isArray(providerOrder)) {
      return res.status(400).json({ error: 'Provider order must be an array' });
    }
    
    screenerService.setProviderOrder(providerOrder);
    res.json({ success: true, message: 'Provider order updated' });
  } catch (error) {
    console.error('Error setting provider order:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
});

// Clear market data cache
router.post('/clear-cache', (req: Request, res: Response) => {
  try {
    dataService.clearCache();
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
});

// Get available symbols
router.get('/symbols', (req: Request, res: Response) => {
  const symbols = screenerService.getAllAvailableSymbols();
  res.json({ symbols });
});

// Run a screener with custom code
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { code, symbols, provider } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'No screener code provided' });
    }
    
    // Run the screener
    const result = await screenerService.runScreener(code, symbols, provider);
    
    res.json(result);
  } catch (error) {
    console.error('Error running screener:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      isScreenerError: true
    });
  }
});

// Run a saved screener by ID
router.post('/run/:id', async (req: Request, res: Response) => {
  try {
    const screenerId = parseInt(req.params.id);
    const { provider } = req.body;
    
    if (isNaN(screenerId)) {
      return res.status(400).json({ error: 'Invalid screener ID' });
    }
    
    // Run the screener
    const result = await screenerService.runScreenerById(screenerId, provider);
    
    res.json(result);
  } catch (error) {
    console.error(`Error running screener ID ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      isScreenerError: true
    });
  }
});

// Save a screener
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { name, description, code, universe = [], userId } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
    
    // Create the screen
    const screen = await storage.createScreen({
      name,
      description: description || '',
      code,
      universe,
      userId,
      isActive: true,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.status(201).json(screen);
  } catch (error) {
    console.error('Error saving screener:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update a screener
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const screenerId = parseInt(req.params.id);
    const { name, description, code, universe, isActive, isPublic } = req.body;
    
    if (isNaN(screenerId)) {
      return res.status(400).json({ error: 'Invalid screener ID' });
    }
    
    // Check if the screen exists
    const existingScreen = await storage.getScreenById(screenerId);
    if (!existingScreen) {
      return res.status(404).json({ error: 'Screen not found' });
    }
    
    // Update the screen
    const updatedScreen = await storage.updateScreen(screenerId, {
      name: name !== undefined ? name : existingScreen.name,
      description: description !== undefined ? description : existingScreen.description,
      code: code !== undefined ? code : existingScreen.code,
      universe: universe !== undefined ? universe : existingScreen.universe,
      isActive: isActive !== undefined ? isActive : existingScreen.isActive,
      isPublic: isPublic !== undefined ? isPublic : existingScreen.isPublic,
      updatedAt: new Date()
    });
    
    res.json(updatedScreen);
  } catch (error) {
    console.error(`Error updating screener ID ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a screener
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const screenerId = parseInt(req.params.id);
    
    if (isNaN(screenerId)) {
      return res.status(400).json({ error: 'Invalid screener ID' });
    }
    
    // Delete the screen
    await storage.deleteScreen(screenerId);
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting screener ID ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all screeners
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    
    // Get screens from the database
    const screens = await storage.getScreens(userId);
    
    res.json(screens);
  } catch (error) {
    console.error('Error getting screeners:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get a screener by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const screenerId = parseInt(req.params.id);
    
    if (isNaN(screenerId)) {
      return res.status(400).json({ error: 'Invalid screener ID' });
    }
    
    // Get the screen
    const screen = await storage.getScreenById(screenerId);
    
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }
    
    res.json(screen);
  } catch (error) {
    console.error(`Error getting screener ID ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear data cache
router.post('/clear-cache', (req: Request, res: Response) => {
  screenerService.clearCache();
  res.json({ message: 'Cache cleared successfully' });
});

// Get the last used provider
router.get('/last-provider', (req: Request, res: Response) => {
  const lastProvider = dataService.getLastUsedProvider();
  res.json({ 
    lastProvider: lastProvider || 'None',
    availableProviders: screenerService.getAvailableProviders()
  });
});

// Set provider preferences
router.post('/provider-order', (req: Request, res: Response) => {
  try {
    const { providerOrder } = req.body;
    
    if (!providerOrder || !Array.isArray(providerOrder)) {
      return res.status(400).json({ 
        error: 'Invalid provider order. Must be an array of provider names' 
      });
    }
    
    // Verify that all providers exist
    const availableProviders = screenerService.getAvailableProviders();
    const invalidProviders = providerOrder.filter(p => !availableProviders.includes(p));
    
    if (invalidProviders.length > 0) {
      return res.status(400).json({ 
        error: `Invalid providers: ${invalidProviders.join(', ')}`,
        availableProviders
      });
    }
    
    // Set the provider order (note: this only affects the current session)
    // A production version would save this to user preferences
    dataService.setProviderOrder(providerOrder);
    
    res.json({ 
      message: 'Provider order updated successfully',
      providerOrder
    });
  } catch (error) {
    console.error('Error setting provider order:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;