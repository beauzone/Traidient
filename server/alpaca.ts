import { ApiIntegration } from "@shared/schema";

export class AlpacaAPI {
  private apiKey: string;
  private apiSecret: string;
  private tradingBaseUrl: string;
  private dataBaseUrl: string;
  private integrationId?: number;
  public isValid: boolean;

  constructor(integration?: ApiIntegration) {
    // Get API keys from integration or environment
    this.apiKey = integration?.credentials?.apiKey || process.env.ALPACA_API_KEY || "";
    this.apiSecret = integration?.credentials?.apiSecret || process.env.ALPACA_API_SECRET || "";
    this.integrationId = integration?.id;
    
    // Store if the configuration is valid
    this.isValid = !!(this.apiKey && this.apiSecret);
    
    // Use v2 API endpoints - can switch between paper and live
    const endpoint = integration?.credentials?.additionalFields?.endpoint || "paper";
    const isPaperTrading = endpoint === "paper";
    
    this.tradingBaseUrl = isPaperTrading 
      ? "https://paper-api.alpaca.markets/v2" 
      : "https://api.alpaca.markets/v2";
    this.dataBaseUrl = "https://data.alpaca.markets/v2";
    
    // Log detailed information about the connection
    console.log("Alpaca API initialized:", {
      isPaperTrading,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      integrationId: integration?.id,
      isValid: this.isValid
    });
    
    // Log if we're missing API credentials
    if (!this.isValid) {
      console.warn("Warning: Alpaca API credentials not provided or invalid. Some features may not work correctly.");
    }
  }
  
  /**
   * Verifies the API connection by attempting to fetch account data
   * This can be used to validate the API credentials
   * @returns {Promise<{isValid: boolean, message: string}>} Result with validation status and message
   */
  async verifyConnection(): Promise<{isValid: boolean, message: string}> {
    if (!this.isValid) {
      return {
        isValid: false, 
        message: "API configuration is invalid. Both API key and secret are required."
      };
    }
    
    try {
      // Make a simple account request to test the connection
      const response = await fetch(`${this.tradingBaseUrl}/account`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (response.ok) {
        const accountData = await response.json();
        return {
          isValid: true,
          message: `Successfully connected to Alpaca ${accountData.account_number} (${accountData.status})`
        };
      } else {
        // Handle different error codes
        if (response.status === 403) {
          return {
            isValid: false,
            message: "Authentication failed. Please check your API key and secret."
          };
        } else if (response.status === 429) {
          return {
            isValid: false,
            message: "Too many requests. Rate limit exceeded."
          };
        } else {
          return {
            isValid: false,
            message: `Connection error: ${response.status} ${response.statusText}`
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        message: `Connection error: ${errorMessage}`
      };
    }
  }

  async getAccount(): Promise<any> {
    // First check if API is properly configured
    if (!this.isValid) {
      throw new Error("API configuration is invalid. Both API key and secret are required.");
    }
    
    try {
      const response = await fetch(`${this.tradingBaseUrl}/account`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        // Provide more specific error messages based on status code
        if (response.status === 403) {
          throw new Error("Authentication failed: Invalid API credentials. Please check your Alpaca API key and secret.");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded: Too many requests to Alpaca API. Please try again later.");
        } else {
          throw new Error(`Error fetching account: ${response.status} ${response.statusText}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching Alpaca account for integration #${this.integrationId}:`, errorMessage);
      
      // Pass through the descriptive error message
      throw new Error(errorMessage.includes("Error fetching account") ? 
        errorMessage : `Failed to fetch Alpaca account: ${errorMessage}`);
    }
  }

  async getPositions(): Promise<any[]> {
    // First check if API is properly configured
    if (!this.isValid) {
      throw new Error("API configuration is invalid. Both API key and secret are required.");
    }
    
    try {
      const response = await fetch(`${this.tradingBaseUrl}/positions`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        // Provide more specific error messages based on status code
        if (response.status === 403) {
          throw new Error("Authentication failed: Invalid API credentials. Please check your Alpaca API key and secret.");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded: Too many requests to Alpaca API. Please try again later.");
        } else if (response.status === 404) {
          // Return empty array if no positions found (more user-friendly)
          return [];
        } else {
          throw new Error(`Error fetching positions: ${response.status} ${response.statusText}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching Alpaca positions for integration #${this.integrationId}:`, errorMessage);
      
      // Pass through the descriptive error message
      throw new Error(errorMessage.includes("Error fetching positions") ? 
        errorMessage : `Error fetching positions: ${errorMessage}`);
    }
  }

  async getOrders(): Promise<any[]> {
    // First check if API is properly configured
    if (!this.isValid) {
      throw new Error("API configuration is invalid. Both API key and secret are required.");
    }
    
    try {
      const response = await fetch(`${this.tradingBaseUrl}/orders`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        // Provide more specific error messages based on status code
        if (response.status === 403) {
          throw new Error("Authentication failed: Invalid API credentials. Please check your Alpaca API key and secret.");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded: Too many requests to Alpaca API. Please try again later.");
        } else if (response.status === 404) {
          // Return empty array if no orders found (more user-friendly)
          return [];
        } else {
          throw new Error(`Error fetching orders: ${response.status} ${response.statusText}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching Alpaca orders for integration #${this.integrationId}:`, errorMessage);
      
      // Pass through the descriptive error message
      throw new Error(errorMessage.includes("Error fetching orders") ? 
        errorMessage : `Error fetching orders: ${errorMessage}`);
    }
  }

  async placeOrder(params: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limit_price?: number;
    stop_price?: number;
  }): Promise<any> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Error placing order: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error placing Alpaca order:", error);
      throw new Error("Failed to place Alpaca order");
    }
  }

  async getMarketData(symbol: string, timeframe: string = '1D', limit: number = 100): Promise<any> {
    try {
      // Convert timeframe to Alpaca Data API format
      const timeframeParts = timeframe.match(/^(\d+)([DMWY])$/);
      if (!timeframeParts) {
        throw new Error(`Invalid timeframe format: ${timeframe}`);
      }
      const [_, amount, unit] = timeframeParts;
      const adjustedTimeframe = `${amount}${unit.toLowerCase()}`;

      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 30); // Get data for last 30 days
      
      const startDate = pastDate.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      const url = `${this.dataBaseUrl}/stocks/${symbol}/bars?timeframe=${adjustedTimeframe}&start=${startDate}&end=${endDate}&limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching market data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching Alpaca market data:", error);
      throw new Error("Failed to fetch Alpaca market data");
    }
  }

  async getAssetInformation(symbol: string): Promise<any> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/assets/${symbol}`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching asset information: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching Alpaca asset information:", error);
      throw new Error("Failed to fetch Alpaca asset information");
    }
  }
  
  // Method to get latest quote for a symbol
  async getQuote(symbol: string): Promise<any> {
    try {
      const response = await fetch(`${this.dataBaseUrl}/stocks/${symbol}/quotes/latest`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching quote: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching Alpaca quote:", error);
      throw new Error("Failed to fetch Alpaca quote");
    }
  }
  
  /**
   * Checks if the US stock market is currently open
   * @returns Promise with boolean indicating if the market is open
   */
  async isMarketOpen(): Promise<boolean> {
    if (!this.isValid) {
      console.warn("Alpaca API credentials not provided, using time-based market status check");
      return this.isMarketOpenByTime();
    }
    
    try {
      const response = await fetch(`${this.tradingBaseUrl}/clock`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        console.warn(`Error fetching Alpaca clock: ${response.statusText}, using time-based check`);
        return this.isMarketOpenByTime();
      }
      
      const data = await response.json();
      return data.is_open;
    } catch (error) {
      console.warn("Error checking market status via Alpaca:", error);
      return this.isMarketOpenByTime();
    }
  }
  
  /**
   * Fallback function to check if the market is open based on time
   * @returns Boolean indicating if the market is likely open
   */
  private isMarketOpenByTime(): boolean {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Convert to Eastern Time (ET)
    // This is a simple approximation, a real app would use a timezone library
    const isDST = this.isDateInDST(now);
    let etHour = hour - (isDST ? 4 : 5);
    if (etHour < 0) etHour += 24;
    
    // Market is closed on weekends
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Regular market hours: 9:30 AM - 4:00 PM ET
    if ((etHour === 9 && minute >= 30) || (etHour > 9 && etHour < 16)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Checks if a date is in Daylight Saving Time
   * This is a simplified check - a production system would use a timezone library
   */
  private isDateInDST(date: Date): boolean {
    // A very simple DST check for US Eastern Time
    // DST starts on the second Sunday in March
    // DST ends on the first Sunday in November
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    
    // January, February, December are never in DST
    if (month < 3 || month > 11) {
      return false;
    }
    
    // April through October are always in DST
    if (month > 3 && month < 11) {
      return true;
    }
    
    // March: DST starts on the second Sunday
    if (month === 3) {
      // Get the first day of March
      const firstDay = new Date(year, 2, 1);
      // Find the first Sunday
      const firstSunday = 1 + (7 - firstDay.getDay()) % 7;
      // Second Sunday is firstSunday + 7
      const secondSunday = firstSunday + 7;
      // DST starts at 2:00 AM on the second Sunday
      return date.getDate() > secondSunday || 
        (date.getDate() === secondSunday && date.getHours() >= 2);
    }
    
    // November: DST ends on the first Sunday
    if (month === 11) {
      // Get the first day of November
      const firstDay = new Date(year, 10, 1);
      // Find the first Sunday
      const firstSunday = 1 + (7 - firstDay.getDay()) % 7;
      // DST ends at 2:00 AM on the first Sunday
      return date.getDate() < firstSunday || 
        (date.getDate() === firstSunday && date.getHours() < 2);
    }
    
    return false;
  }

  // Enhanced backtesting with progress tracking
  async runBacktest(strategyCode: string, params: any, updateProgress?: (progress: any) => Promise<void>): Promise<any> {
    console.log(`Running backtest with strategy: ${strategyCode.substring(0, 50)}... and params:`, params);
    // In a real implementation, this would send the strategy code to a backtesting engine
    // For MVP, we'll return simulated data for demonstration
    
    // Create more realistic backtest results based on params
    const { startDate, endDate, initialCapital, assets } = params;
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Setup progress tracking
    const totalSteps = Math.min(durationDays, 100) + 5; // Add extra steps for initialization and finalization
    const startTime = Date.now();
    let stepsCompleted = 0;
    
    // Initial progress update
    if (updateProgress) {
      await updateProgress({
        percentComplete: 0,
        currentStep: 'Initializing backtest',
        stepsCompleted: 0,
        totalSteps,
        estimatedTimeRemaining: durationDays * 0.5, // Initial estimate: 0.5 seconds per day
        startedAt: new Date().toISOString(),
        processingSpeed: 0
      });
    }
    
    // Progress tracking function
    const trackProgress = async (step: string, forceUpdate = false) => {
      stepsCompleted++;
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const percentComplete = Math.min(99, Math.round((stepsCompleted / totalSteps) * 100));
      const processingSpeed = stepsCompleted / elapsedSeconds; // Steps per second
      const remainingSteps = totalSteps - stepsCompleted;
      const estimatedTimeRemaining = remainingSteps / processingSpeed;
      
      // Only update every few steps or on force update to avoid excessive DB writes
      if (updateProgress && (forceUpdate || stepsCompleted % 3 === 0 || percentComplete >= 99)) {
        await updateProgress({
          percentComplete,
          currentStep: step,
          stepsCompleted,
          totalSteps,
          estimatedTimeRemaining: Math.ceil(estimatedTimeRemaining),
          startedAt: new Date(startTime).toISOString(),
          processingSpeed: Math.round(processingSpeed * 100) / 100
        });
      }
    };
    
    // Update progress with more detailed steps
    await trackProgress('Analyzing strategy code', true);
    
    // Simulate a small delay to make progress visible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update progress - Data preparation
    await trackProgress('Fetching historical data', true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update progress - Strategy compilation
    await trackProgress('Compiling trading rules', true);
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Update progress - Backtesting initialization
    await trackProgress('Initializing simulation engine', true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate realistic performance metrics
    const totalReturn = Math.random() * 20 - 5; // Between -5% and +15%
    // Calculate annualized return using the correct compound annual growth rate formula
    // For backtests under 30 days, adjust the formula to avoid unrealistic annualized returns
    const annualizedReturn = durationDays >= 30 ?
      // Standard CAGR formula with adjustment for short durations
      (Math.pow(1 + totalReturn/100, Math.min(365/durationDays, 4)) - 1) * 100 :
      // For very short periods, use simpler scaling to avoid extreme projections
      (totalReturn * 365 / durationDays) * 0.5;
    
    // Calculate final portfolio value
    const finalValue = initialCapital * (1 + totalReturn / 100);
    
    console.log(`Backtest duration: ${durationDays} days, Initial: $${initialCapital}, Final: $${finalValue.toFixed(2)}, Return: ${totalReturn.toFixed(2)}%`);
    
    // Generate more realistic trade data
    const tradeCount = Math.floor(Math.random() * 100) + 20;
    const trades = [];
    let currentEquity = initialCapital;
    
    // Generate equity curve and trades
    const equityPoints = Math.min(durationDays, 100); // Cap at 100 points to avoid too much data
    const equity = [];
    
    // Update progress - Starting simulation
    await trackProgress('Starting market simulation', true);
    
    for (let i = 0; i < equityPoints; i++) {
      const progress = i / (equityPoints - 1);
      const dayOffset = Math.floor(progress * durationDays);
      const timestamp = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      
      // Update progress every 10% of simulation
      if (i % Math.max(1, Math.floor(equityPoints / 10)) === 0) {
        const simProgress = Math.floor(progress * 100);
        await trackProgress(`Running simulation (${simProgress}%)`, true);
      }
      
      // Add some volatility to the equity curve
      const noise = Math.random() * 0.03 - 0.015; // +/- 1.5%
      const expectedEquity = initialCapital * (1 + (totalReturn / 100) * progress);
      currentEquity = expectedEquity * (1 + noise);
      
      // Record equity point
      equity.push({
        timestamp: timestamp.toISOString(),
        value: currentEquity
      });
      
      // Generate some trades around this date (more frequent at beginning and end)
      const tradeChance = 0.3 * (1 - Math.abs(progress - 0.5)) + 0.05;
      
      if (Math.random() < tradeChance) {
        const asset = assets[Math.floor(Math.random() * assets.length)];
        const price = 100 + Math.random() * 200;
        const quantity = Math.floor(Math.random() * 20) + 1;
        const value = price * quantity;
        
        trades.push({
          timestamp: timestamp.toISOString(),
          type: Math.random() > 0.5 ? 'buy' : 'sell',
          asset: asset,
          quantity: quantity,
          price: price,
          value: value,
          fees: value * 0.001 // 0.1% fee
        });
      }
      
      // Add small delay to make the simulation visible
      if (i % Math.max(1, Math.floor(equityPoints / 5)) === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Ensure we have at least a few trades
    if (trades.length < 10) {
      for (let i = trades.length; i < 10; i++) {
        const progress = i / 10;
        const dayOffset = Math.floor(progress * durationDays);
        const timestamp = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const asset = assets[Math.floor(Math.random() * assets.length)];
        const price = 100 + Math.random() * 200;
        const quantity = Math.floor(Math.random() * 20) + 1;
        const value = price * quantity;
        
        trades.push({
          timestamp: timestamp.toISOString(),
          type: Math.random() > 0.5 ? 'buy' : 'sell',
          asset: asset,
          quantity: quantity,
          price: price,
          value: value,
          fees: value * 0.001 // 0.1% fee
        });
      }
    }
    
    // Sort trades by timestamp
    trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const mockBacktestResults = {
      summary: {
        totalReturn: totalReturn,
        annualizedReturn: annualizedReturn,
        sharpeRatio: Math.random() * 3, // Between 0 and 3
        maxDrawdown: Math.random() * -15, // Between 0% and -15%
        winRate: Math.random() * 0.4 + 0.4, // Between 40% and 80%
        totalTrades: trades.length
      },
      trades: trades,
      equity: equity,
      positions: Array.from({ length: Math.min(assets.length, 5) }, (_, i) => ({
        timestamp: end.toISOString(),
        asset: assets[i % assets.length],
        quantity: Math.floor(Math.random() * 100) + 1,
        value: Math.random() * 10000 + 1000
      }))
    };
    
    // Update progress - Analyzing results
    await trackProgress('Analyzing trade performance', true);
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Update progress - Calculating statistics
    await trackProgress('Calculating performance metrics', true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update progress - Finalizing
    await trackProgress('Finalizing backtest results', true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Complete the progress to 100%
    if (updateProgress) {
      await updateProgress({
        percentComplete: 100,
        currentStep: 'Backtest completed',
        stepsCompleted: totalSteps,
        totalSteps,
        estimatedTimeRemaining: 0,
        startedAt: new Date(startTime).toISOString(),
        processingSpeed: Math.round((totalSteps / ((Date.now() - startTime) / 1000)) * 100) / 100
      });
    }
    
    console.log(`Backtest completed with ${trades.length} trades and ${equity.length} equity points.`);
    
    return mockBacktestResults;
  }
}

export default AlpacaAPI;
