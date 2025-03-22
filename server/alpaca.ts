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
      integrationId: this.integrationId,
      isValid: this.isValid
    });
  }

  /**
   * Verifies the API connection by attempting to fetch account data
   * This can be used to validate the API credentials
   * @returns {Promise<{isValid: boolean, message: string}>} Result with validation status and message
   */
  async verifyConnection(): Promise<{isValid: boolean, message: string}> {
    try {
      if (!this.isValid) {
        return { isValid: false, message: "API keys not provided" };
      }
      
      const response = await fetch(`${this.tradingBaseUrl}/account`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return { 
          isValid: true, 
          message: `Successfully connected to Alpaca API for account ${data.account_number}`
        };
      } else {
        const errorText = await response.text();
        return { 
          isValid: false, 
          message: `Failed to connect to Alpaca API: ${response.status} ${errorText}`
        };
      }
    } catch (error) {
      return { 
        isValid: false, 
        message: `Error connecting to Alpaca API: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async getAccount(): Promise<any> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/account`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching Alpaca account:', error);
      throw error;
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/positions`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      
      const positions = await response.json();
      
      // Add positionStatus to identify these as open positions
      return positions.map((position: any) => ({
        ...position,
        positionStatus: 'open'
      }));
    } catch (error) {
      console.error('Error fetching Alpaca positions:', error);
      throw error;
    }
  }
  
  /**
   * Get closed positions from Alpaca
   * @param startDate Optional start date in YYYY-MM-DD format
   * @param endDate Optional end date in YYYY-MM-DD format
   * @param limit Maximum number of positions to return
   * @returns Array of closed position objects
   */
  async getClosedPositions(startDate?: string, endDate?: string, limit: number = 100): Promise<any[]> {
    try {
      // Build the query parameters
      const queryParams = new URLSearchParams();
      
      if (startDate) {
        queryParams.append('after', `${startDate}T00:00:00Z`);
      } else {
        // Default to the last 90 days if no date is provided
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        queryParams.append('after', ninetyDaysAgo.toISOString().split('T')[0] + 'T00:00:00Z');
      }
      
      if (endDate) {
        queryParams.append('until', `${endDate}T23:59:59Z`);
      }
      
      if (limit) {
        queryParams.append('limit', limit.toString());
      }
      
      const response = await fetch(`${this.tradingBaseUrl}/positions/closed?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Retrieved ${data.length} closed positions from Alpaca`);
      
      // Format closed positions to match our Position interface
      return data.map((position: any) => ({
        symbol: position.symbol,
        assetName: position.symbol, // Alpaca doesn't provide asset name in closed positions API
        positionStatus: 'closed',
        quantity: parseFloat(position.qty),
        averageEntryPrice: parseFloat(position.avg_entry_price),
        exitPrice: parseFloat(position.avg_exit_price),
        costBasis: parseFloat(position.cost_basis),
        realizedPnL: parseFloat(position.profit_loss),
        realizedPnLPercent: parseFloat(position.profit_loss_pct) * 100, // Convert from decimal to percentage
        entryDate: position.entered_at,
        exitDate: position.closed_at
      }));
    } catch (error) {
      console.error('Error fetching closed Alpaca positions:', error);
      return []; // Return empty array instead of throwing to prevent UI disruption
    }
  }

  async getOrders(): Promise<any[]> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/orders?status=open`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching Alpaca orders:', error);
      throw error;
    }
  }

  async placeOrder(params: {
    symbol: string;
    qty: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limit_price?: string;
    stop_price?: string;
  }): Promise<any> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error placing Alpaca order:', error);
      throw error;
    }
  }

  /**
   * Get historical market data for a symbol from Alpaca
   * 
   * @param symbol The stock symbol to fetch data for
   * @param timeframe The timeframe for the data (e.g., "1D" for daily)
   * @param limit The maximum number of bars to return
   * @param startDate Optional start date in YYYY-MM-DD format
   * @param endDate Optional end date in YYYY-MM-DD format
   * @returns Market data from Alpaca
   */
  async getMarketData(
    symbol: string,
    timeframe: string = "1Day",
    limit: number = 100,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    try {
      // Convert timeframe to Alpaca format
      const timeframeMap: Record<string, string> = {
        "1m": "1Min",
        "5m": "5Min",
        "15m": "15Min",
        "30m": "30Min",
        "1h": "1Hour",
        "1d": "1Day",
        "1w": "1Week",
        "1M": "1Month"
      };
      
      // Map our standard timeframe to Alpaca's format
      const alpacaTimeframe = timeframeMap[timeframe.toLowerCase()] || timeframe;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("symbols", symbol);
      queryParams.append("timeframe", alpacaTimeframe);
      queryParams.append("limit", limit.toString());
      
      if (startDate) {
        queryParams.append("start", startDate);
      }
      
      if (endDate) {
        queryParams.append("end", endDate);
      }
      
      // Make the API request
      const response = await fetch(`${this.dataBaseUrl}/stocks/bars?${queryParams.toString()}`, {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Format the response
      return {
        symbol,
        bars: data.bars?.[symbol] || []
      };
    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error);
      throw new Error(`Failed to fetch market data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAssetInformation(symbol: string): Promise<any> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/assets/${symbol}`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching asset information for ${symbol}:`, error);
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<any> {
    try {
      const response = await fetch(`${this.dataBaseUrl}/stocks/${symbol}/quotes/latest`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Checks if the US stock market is currently open
   * @returns Promise with boolean indicating if the market is open
   */
  async isMarketOpen(): Promise<boolean> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/clock`, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret
        }
      });
      
      if (!response.ok) {
        console.warn('Error checking market status, falling back to time-based check');
        return this.isMarketOpenByTime();
      }
      
      const data = await response.json();
      return data.is_open === true;
    } catch (error) {
      console.warn('Error checking market status via API, falling back to time-based check:', error);
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
    // This is a simplified approach - a real implementation would handle time zones properly
    const isDST = this.isDateInDST(now);
    const etOffset = isDST ? -4 : -5; // EST: UTC-5, EDT: UTC-4
    
    // Current hour in ET
    const etHour = (hour + 24 + etOffset) % 24;
    
    // Markets are closed on weekends
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Regular market hours: 9:30 AM - 4:00 PM ET
    return (etHour > 9 || (etHour === 9 && minute >= 30)) && etHour < 16;
  }

  /**
   * Checks if a date is in Daylight Saving Time
   * This is a simplified check - a production system would use a timezone library
   */
  private isDateInDST(date: Date): boolean {
    // Roughly approximate DST for US
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    
    // If timezone offset in January and July are different, DST is observed
    // If the current offset equals the smaller of the two offsets, it's DST
    return Math.max(jan, jul) !== Math.min(jan, jul) && 
           date.getTimezoneOffset() === Math.min(jan, jul);
  }

  /**
   * Run a backtest using real historical market data
   * @param strategyCode The trading strategy code to execute
   * @param params The backtest parameters
   * @param updateProgress Optional callback for tracking progress
   * @returns Detailed backtest results
   */
  async runBacktest(strategyCode: string, params: any, updateProgress?: (progress: any) => Promise<void>): Promise<any> {
    console.log(`Running backtest with strategy using real market data. Params:`, params);
    
    // Import the runBacktest function and data provider
    const { runBacktest } = await import('./backtestService');
    const { AlpacaDataProvider } = await import('./marketDataProviders');
    
    // Create Alpaca data provider
    const dataProvider = new AlpacaDataProvider({
      credentials: {
        apiKey: this.apiKey,
        apiSecret: this.apiSecret
      },
      provider: 'alpaca',
      type: 'data',
      description: 'Alpaca Data Provider',
      isActive: true,
      isPrimary: true,
      userId: 0,
      id: this.integrationId || 0,
      lastUsed: new Date(),
      lastStatus: 'ok',
      lastError: null
    });
    
    // Run the backtest using the Alpaca data provider
    return runBacktest(dataProvider, strategyCode, params, updateProgress);
  }
}