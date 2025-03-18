import { ApiIntegration } from "@shared/schema";

export class AlpacaAPI {
  private apiKey: string;
  private apiSecret: string;
  private tradingBaseUrl: string;
  private dataBaseUrl: string;

  constructor(integration?: ApiIntegration) {
    this.apiKey = integration?.credentials.apiKey || process.env.ALPACA_API_KEY || "";
    this.apiSecret = integration?.credentials.apiSecret || process.env.ALPACA_API_SECRET || "";
    
    // Use v2 API endpoints
    this.tradingBaseUrl = "https://paper-api.alpaca.markets/v2";
    this.dataBaseUrl = "https://data.alpaca.markets/v2";
    
    // Log if we're missing API credentials
    if (!this.apiKey || !this.apiSecret) {
      console.warn("Warning: Alpaca API credentials not provided. Some features may not work correctly.");
    }
  }

  async getAccount(): Promise<any> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/account`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching account: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching Alpaca account:", error);
      throw new Error("Failed to fetch Alpaca account");
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/positions`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching positions: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching Alpaca positions:", error);
      throw new Error("Failed to fetch Alpaca positions");
    }
  }

  async getOrders(): Promise<any[]> {
    try {
      const response = await fetch(`${this.tradingBaseUrl}/orders`, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching orders: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching Alpaca orders:", error);
      throw new Error("Failed to fetch Alpaca orders");
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

  // Additional mock methods for backtesting
  async runBacktest(strategyCode: string, params: any): Promise<any> {
    // In a real implementation, this would send the strategy code to a backtesting engine
    // For MVP, we'll return mock data for demonstration
    
    const mockBacktestResults = {
      summary: {
        totalReturn: Math.random() * 20 - 5, // Between -5% and +15%
        annualizedReturn: Math.random() * 25 - 5, // Between -5% and +20%
        sharpeRatio: Math.random() * 3, // Between 0 and 3
        maxDrawdown: Math.random() * -15, // Between 0% and -15%
        winRate: Math.random() * 0.4 + 0.4, // Between 40% and 80%
        totalTrades: Math.floor(Math.random() * 100) + 20 // Between 20 and 120 trades
      },
      trades: Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        asset: params.assets[Math.floor(Math.random() * params.assets.length)],
        quantity: Math.floor(Math.random() * 100) + 1,
        price: Math.random() * 1000 + 50,
        value: Math.random() * 10000 + 1000,
        fees: Math.random() * 10
      })),
      equity: Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000).toISOString(),
        value: 10000 + (Math.random() * 1000 * i / 10)
      })),
      positions: Array.from({ length: 5 }, () => ({
        timestamp: new Date().toISOString(),
        asset: params.assets[Math.floor(Math.random() * params.assets.length)],
        quantity: Math.floor(Math.random() * 100) + 1,
        value: Math.random() * 10000 + 1000
      }))
    };
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return mockBacktestResults;
  }
}

export default AlpacaAPI;
