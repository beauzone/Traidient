"""
Alpaca Market Data Provider Implementation

This module implements the Market Data Provider interface for Alpaca,
allowing standardized access to historical market data and technical indicators.
"""

import os
import time
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Union, Optional, Any

# Create logger
logger = logging.getLogger(__name__)

class MarketDataProvider:
    """Base interface for market data providers."""
    
    def get_historical_data(self, symbols, period='3mo', interval='1d'):
        """Retrieve historical market data for given symbols."""
        raise NotImplementedError
    
    def calculate_indicators(self, dataframe):
        """Calculate standard technical indicators on the provided data."""
        raise NotImplementedError
    
    def get_stock_universe(self, universe_type='default'):
        """Get a list of stock symbols based on the specified universe type."""
        raise NotImplementedError


class AlpacaAdapter(MarketDataProvider):
    """Alpaca implementation of the MarketDataProvider interface."""
    
    def __init__(self, api_key=None, api_secret=None, paper=True):
        """
        Initialize the Alpaca API connection.
        
        Parameters:
        api_key: Alpaca API key (optional, will use environment variables if not provided)
        api_secret: Alpaca API secret (optional, will use environment variables if not provided)
        paper: Whether to use the paper trading API (default: True)
        """
        try:
            from alpaca.trading.client import TradingClient
            from alpaca.data.historical import StockHistoricalDataClient
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
        except ImportError:
            raise ImportError("Please install alpaca-py package: pip install alpaca-py")
        
        # Store for later use
        self.TimeFrame = TimeFrame
        self.StockBarsRequest = StockBarsRequest
        
        # Use provided credentials or get from environment
        self.api_key = api_key or os.environ.get('ALPACA_API_KEY')
        self.api_secret = api_secret or os.environ.get('ALPACA_API_SECRET')
        
        if not self.api_key or not self.api_secret:
            raise ValueError("Alpaca API credentials not provided and not found in environment variables")
        
        # Initialize clients
        self.trading_client = TradingClient(self.api_key, self.api_secret, paper=paper)
        self.data_client = StockHistoricalDataClient(self.api_key, self.api_secret)
        
        # Cache for stock universe
        self._stock_universe_cache = {}
        
        logger.info("AlpacaAdapter initialized")
    
    def _convert_period_to_dates(self, period: str) -> tuple:
        """
        Convert a period string to start and end dates.
        
        Parameters:
        period: Period string (e.g., '1d', '5d', '1mo', '3mo', '1y', 'ytd')
        
        Returns:
        Tuple of (start_date, end_date) as datetime objects
        """
        end_date = datetime.now()
        
        if period.endswith('d'):
            days = int(period[:-1])
            start_date = end_date - timedelta(days=days)
        elif period.endswith('mo'):
            months = int(period[:-2])
            start_date = end_date - timedelta(days=30 * months)
        elif period.endswith('y'):
            years = int(period[:-1])
            start_date = end_date - timedelta(days=365 * years)
        elif period == 'ytd':
            start_date = datetime(end_date.year, 1, 1)
        else:
            raise ValueError(f"Unsupported period format: {period}")
        
        return start_date, end_date
    
    def _convert_interval_to_timeframe(self, interval: str) -> Any:
        """
        Convert an interval string to Alpaca TimeFrame.
        
        Parameters:
        interval: Interval string (e.g., '1m', '5m', '1h', '1d', '1wk')
        
        Returns:
        Alpaca TimeFrame object
        """
        if interval.endswith('m'):
            minutes = int(interval[:-1])
            return self.TimeFrame.Minute if minutes == 1 else self.TimeFrame(minutes, self.TimeFrame.Minute)
        elif interval.endswith('h'):
            hours = int(interval[:-1])
            return self.TimeFrame.Hour if hours == 1 else self.TimeFrame(hours, self.TimeFrame.Hour)
        elif interval == '1d':
            return self.TimeFrame.Day
        elif interval == '1wk':
            return self.TimeFrame.Week
        elif interval == '1mo':
            return self.TimeFrame.Month
        else:
            raise ValueError(f"Unsupported interval format: {interval}")
    
    def get_historical_data(self, symbols, period='3mo', interval='1d', 
                            retry_count=3, retry_delay=1.0):
        """
        Retrieve historical market data for given symbols from Alpaca.
        
        Parameters:
        symbols: List of ticker symbols
        period: Time period to fetch (e.g., '1d', '5d', '1mo', '3mo', '1y')
        interval: Data frequency (e.g., '1m', '5m', '1h', '1d', '1wk')
        retry_count: Number of retries for API calls
        retry_delay: Delay between retries in seconds
        
        Returns:
        MultiIndex DataFrame with ['ticker', 'date'] index
        """
        # Convert period to start and end dates
        start_date, end_date = self._convert_period_to_dates(period)
        
        # Convert interval to Alpaca TimeFrame
        timeframe = self._convert_interval_to_timeframe(interval)
        
        # Ensure symbols is a list
        if isinstance(symbols, str):
            symbols = [symbols]
        
        # Limit symbols to 100 at a time (Alpaca API limit)
        all_data = []
        for i in range(0, len(symbols), 100):
            symbol_batch = symbols[i:i+100]
            logger.info(f"Fetching data for {len(symbol_batch)} symbols (batch {i//100 + 1})")
            
            # Create request parameters
            request_params = self.StockBarsRequest(
                symbol_or_symbols=symbol_batch,
                timeframe=timeframe,
                start=start_date,
                end=end_date
            )
            
            # Make API call with retry
            for attempt in range(retry_count):
                try:
                    bars = self.data_client.get_stock_bars(request_params)
                    
                    # Process the data
                    if bars and bars.data:
                        # Convert to DataFrame
                        batch_data = []
                        for symbol, symbol_bars in bars.data.items():
                            # Skip empty data
                            if not symbol_bars:
                                continue
                                
                            # Convert to DataFrame
                            symbol_df = pd.DataFrame([bar.dict() for bar in symbol_bars])
                            symbol_df['ticker'] = symbol
                            batch_data.append(symbol_df)
                        
                        if batch_data:
                            # Combine all symbols in this batch
                            batch_df = pd.concat(batch_data, ignore_index=True)
                            all_data.append(batch_df)
                    
                    # Successful API call, break retry loop
                    break
                    
                except Exception as e:
                    if attempt < retry_count - 1:
                        logger.warning(f"API call failed, retrying ({attempt+1}/{retry_count}): {str(e)}")
                        time.sleep(retry_delay)
                    else:
                        logger.error(f"API call failed after {retry_count} attempts: {str(e)}")
                        raise
            
            # Rate limiting - avoid hitting Alpaca API limits
            if i + 100 < len(symbols):
                time.sleep(0.5)
        
        # Combine all batches
        if not all_data:
            logger.warning("No data retrieved for any symbols")
            # Return empty DataFrame with correct structure
            return pd.DataFrame(columns=['ticker', 'timestamp', 'open', 'high', 'low', 'close', 'volume']).set_index(['ticker', 'timestamp'])
        
        df = pd.concat(all_data, ignore_index=True)
        
        # Rename columns to match expected format
        df = df.rename(columns={
            'timestamp': 'date',
            'trade_count': 'trades',
            'vwap': 'vwap'
        })
        
        # Convert timestamp to datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Set MultiIndex
        df = df.set_index(['ticker', 'date'])
        
        # Sort index for efficient operations
        df = df.sort_index()
        
        return df
    
    def calculate_indicators(self, df):
        """
        Calculate standard technical indicators using numpy and pandas.
        
        Parameters:
        df: MultiIndex DataFrame with ['ticker', 'date'] index
        
        Returns:
        DataFrame with added technical indicator columns
        """
        # Create a copy to avoid modifying the original
        result_df = df.copy()
        
        # Process each ticker separately
        for ticker in df.index.get_level_values('ticker').unique():
            ticker_data = df.loc[ticker]
            
            # Skip if not enough data
            if len(ticker_data) < 30:
                continue
            
            # Calculate SMAs
            for period in [5, 10, 20, 50, 200]:
                result_df.loc[ticker, f'sma_{period}'] = ticker_data['close'].rolling(window=period).mean()
            
            # Calculate EMAs
            for period in [9, 12, 26]:
                result_df.loc[ticker, f'ema_{period}'] = ticker_data['close'].ewm(span=period, adjust=False).mean()
            
            # Calculate RSI
            delta = ticker_data['close'].diff()
            gain = delta.where(delta > 0, 0)
            loss = -delta.where(delta < 0, 0)
            
            avg_gain = gain.rolling(window=14).mean()
            avg_loss = loss.rolling(window=14).mean()
            
            rs = avg_gain / avg_loss
            result_df.loc[ticker, 'rsi'] = 100 - (100 / (1 + rs))
            
            # Calculate MACD
            ema_12 = ticker_data['close'].ewm(span=12, adjust=False).mean()
            ema_26 = ticker_data['close'].ewm(span=26, adjust=False).mean()
            result_df.loc[ticker, 'macd'] = ema_12 - ema_26
            result_df.loc[ticker, 'macd_signal'] = result_df.loc[ticker, 'macd'].ewm(span=9, adjust=False).mean()
            result_df.loc[ticker, 'macd_hist'] = result_df.loc[ticker, 'macd'] - result_df.loc[ticker, 'macd_signal']
            
            # Calculate Bollinger Bands
            sma_20 = ticker_data['close'].rolling(window=20).mean()
            std_20 = ticker_data['close'].rolling(window=20).std()
            result_df.loc[ticker, 'bbands_upper'] = sma_20 + 2 * std_20
            result_df.loc[ticker, 'bbands_middle'] = sma_20
            result_df.loc[ticker, 'bbands_lower'] = sma_20 - 2 * std_20
            
            # Calculate ATR
            high_low = ticker_data['high'] - ticker_data['low']
            high_close = (ticker_data['high'] - ticker_data['close'].shift()).abs()
            low_close = (ticker_data['low'] - ticker_data['close'].shift()).abs()
            
            tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            result_df.loc[ticker, 'atr'] = tr.rolling(window=14).mean()
            
            # Calculate ADX and DI
            plus_dm = ticker_data['high'].diff()
            minus_dm = ticker_data['low'].diff(-1).abs()
            
            plus_dm = plus_dm.where((plus_dm > 0) & (plus_dm > minus_dm), 0)
            minus_dm = minus_dm.where((minus_dm > 0) & (minus_dm > plus_dm), 0)
            
            plus_di = 100 * (plus_dm.rolling(window=14).mean() / tr.rolling(window=14).mean())
            minus_di = 100 * (minus_dm.rolling(window=14).mean() / tr.rolling(window=14).mean())
            
            result_df.loc[ticker, 'plus_di'] = plus_di
            result_df.loc[ticker, 'minus_di'] = minus_di
            
            dx = 100 * ((plus_di - minus_di).abs() / (plus_di + minus_di).abs())
            result_df.loc[ticker, 'adx'] = dx.rolling(window=14).mean()
            
            # Calculate Volume Averages
            for period in [5, 10, 20, 50]:
                result_df.loc[ticker, f'volume_avg_{period}'] = ticker_data['volume'].rolling(window=period).mean()
            
            # Calculate high and low over periods
            for period in [10, 20, 50]:
                result_df.loc[ticker, f'high_{period}'] = ticker_data['high'].rolling(window=period).max()
                result_df.loc[ticker, f'low_{period}'] = ticker_data['low'].rolling(window=period).min()
            
            # Calculate close change percentage
            result_df.loc[ticker, 'close_prev'] = ticker_data['close'].shift(1)
            result_df.loc[ticker, 'close_change_pct'] = (ticker_data['close'] / ticker_data['close'].shift(1) - 1) * 100
        
        return result_df
    
    def get_stock_universe(self, universe_type='default'):
        """
        Get a list of stock symbols based on the specified universe type.
        
        Parameters:
        universe_type: Type of stock universe ('default', 'sp500', 'nasdaq100', 'dow30', 'tradable')
        
        Returns:
        List of stock symbols
        """
        # Check cache first
        if universe_type in self._stock_universe_cache:
            # Refresh cache if it's more than a day old
            cache_age = time.time() - self._stock_universe_cache[universe_type]['timestamp']
            if cache_age < 86400:  # 24 hours in seconds
                return self._stock_universe_cache[universe_type]['symbols']
        
        try:
            # Get assets based on universe type
            if universe_type == 'default':
                # Default is a sensible set of liquid US stocks
                assets = self.trading_client.get_all_assets()
                symbols = [asset.symbol for asset in assets 
                          if asset.status == 'active' and asset.tradable and asset.exchange != 'OTC']
                
                # Limit to reasonable set (around 500 stocks)
                # You might want to refine this with additional filtering logic
                symbols = symbols[:500]
                
            elif universe_type == 'sp500':
                # For S&P 500, we need to use a specific endpoint or external source
                # Alpaca doesn't provide a direct method to get S&P 500 constituents
                try:
                    import requests
                    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
                    response = requests.get(url)
                    tables = pd.read_html(response.text)
                    sp500_table = tables[0]
                    symbols = sp500_table['Symbol'].tolist()
                    
                    # Clean symbols
                    symbols = [s.strip().replace('.', '-') for s in symbols]
                except Exception as e:
                    logger.error(f"Failed to get S&P 500 list: {str(e)}")
                    # Fallback to default universe
                    return self.get_stock_universe('default')
                
            elif universe_type == 'nasdaq100':
                # For NASDAQ 100, we need to use an external source
                try:
                    import requests
                    url = "https://en.wikipedia.org/wiki/Nasdaq-100"
                    response = requests.get(url)
                    tables = pd.read_html(response.text)
                    # Find the table containing the NASDAQ-100 components
                    for table in tables:
                        if 'Ticker' in table.columns and 'Company' in table.columns:
                            nasdaq100_table = table
                            break
                    symbols = nasdaq100_table['Ticker'].tolist()
                    
                    # Clean symbols
                    symbols = [s.strip().replace('.', '-') for s in symbols]
                except Exception as e:
                    logger.error(f"Failed to get NASDAQ 100 list: {str(e)}")
                    # Fallback to default universe
                    return self.get_stock_universe('default')
                
            elif universe_type == 'dow30':
                # For Dow 30, we need to use an external source
                try:
                    import requests
                    url = "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average"
                    response = requests.get(url)
                    tables = pd.read_html(response.text)
                    # Find the table containing the DJIA components
                    for table in tables:
                        if 'Symbol' in table.columns and 'Company' in table.columns:
                            dow30_table = table
                            break
                    symbols = dow30_table['Symbol'].tolist()
                    
                    # Clean symbols
                    symbols = [s.strip().replace('.', '-') for s in symbols]
                except Exception as e:
                    logger.error(f"Failed to get Dow 30 list: {str(e)}")
                    # Fallback to default universe
                    return self.get_stock_universe('default')
                
            elif universe_type == 'tradable':
                # Get all tradable assets
                assets = self.trading_client.get_all_assets()
                symbols = [asset.symbol for asset in assets 
                          if asset.status == 'active' and asset.tradable]
                
            else:
                raise ValueError(f"Unknown universe type: {universe_type}")
            
            # Update cache
            self._stock_universe_cache[universe_type] = {
                'symbols': symbols,
                'timestamp': time.time()
            }
            
            return symbols
            
        except Exception as e:
            logger.error(f"Error fetching stock universe '{universe_type}': {str(e)}")
            # Return a minimal list of major stocks as a fallback
            fallback_symbols = [
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK.B', 
                'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 
                'CRM', 'CMCSA', 'VZ', 'NFLX', 'INTC', 'KO', 'PEP', 'T', 'MRK'
            ]
            return fallback_symbols


# Example factory implementation
class MarketDataProviderFactory:
    """Factory for creating and managing data provider instances."""
    
    _instances = {}
    
    @classmethod
    def get_provider(cls, provider_name, **credentials):
        """
        Get a configured market data provider instance.
        
        Parameters:
        provider_name: Name of the provider to use
        credentials: API keys or other credentials needed
        
        Returns:
        A configured MarketDataProvider instance
        """
        # Only Alpaca is implemented in this example
        if provider_name != 'alpaca':
            raise ValueError(f"Provider not implemented: {provider_name}")
        
        # Create a cache key based on provider and credentials
        cache_key = f"{provider_name}_{hash(frozenset(credentials.items()))}"
        
        # Return cached instance if available
        if cache_key in cls._instances:
            return cls._instances[cache_key]
        
        # Create a new instance
        provider = AlpacaAdapter(**credentials)
        cls._instances[cache_key] = provider
        
        return provider


# Example usage
if __name__ == "__main__":
    # Get provider
    try:
        provider = MarketDataProviderFactory.get_provider('alpaca')
        
        # Get stock universe
        symbols = provider.get_stock_universe(universe_type='default')
        print(f"Retrieved {len(symbols)} symbols")
        
        # Get a small subset for testing
        test_symbols = symbols[:5]
        print(f"Testing with symbols: {test_symbols}")
        
        # Get historical data
        data = provider.get_historical_data(test_symbols, period='1mo', interval='1d')
        print(f"Retrieved {len(data)} data points")
        
        # Calculate indicators
        data_with_indicators = provider.calculate_indicators(data)
        print(f"Calculated indicators, new shape: {data_with_indicators.shape}")
        
        # Example: Get latest RSI values
        latest_data = data_with_indicators.groupby('ticker').tail(1)
        print("Latest RSI values:")
        for ticker, row in latest_data.iterrows():
            print(f"{ticker[0]}: RSI = {row.get('rsi', 'N/A'):.2f}")
            
    except Exception as e:
        print(f"Error in example: {str(e)}")