"""
Yahoo Finance Market Data Provider Implementation

This module implements the Market Data Provider interface for Yahoo Finance,
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


class YahooFinanceAdapter(MarketDataProvider):
    """Yahoo Finance implementation of the MarketDataProvider interface."""
    
    def __init__(self):
        """
        Initialize the Yahoo Finance adapter.
        
        No API key required for basic Yahoo Finance functionality.
        """
        try:
            import yfinance as yf
            self.yf = yf
        except ImportError:
            raise ImportError("Please install yfinance package: pip install yfinance")
        
        # Cache for stock universe and historical data
        self._stock_universe_cache = {}
        self._historical_data_cache = {}
        
        logger.info("YahooFinanceAdapter initialized")
    
    def _get_period_days(self, period: str) -> int:
        """
        Convert a period string to number of days.
        
        Parameters:
        period: Period string (e.g., '1d', '5d', '1mo', '3mo', '1y', 'ytd', 'max')
        
        Returns:
        Number of days
        """
        if period.endswith('d'):
            return int(period[:-1])
        elif period.endswith('mo'):
            return int(period[:-2]) * 30
        elif period.endswith('y'):
            return int(period[:-1]) * 365
        elif period == 'ytd':
            today = datetime.now()
            start_of_year = datetime(today.year, 1, 1)
            return (today - start_of_year).days
        elif period == 'max':
            return 10000  # Very large number to get all available data
        else:
            raise ValueError(f"Unsupported period format: {period}")
    
    def get_historical_data(self, symbols, period='3mo', interval='1d', 
                            retry_count=3, retry_delay=1.0):
        """
        Retrieve historical market data for given symbols from Yahoo Finance.
        
        Parameters:
        symbols: List of ticker symbols or single symbol string
        period: Time period to fetch (e.g., '1d', '5d', '1mo', '3mo', '1y', 'ytd', 'max')
        interval: Data frequency (e.g., '1m', '5m', '1h', '1d', '1wk', '1mo')
        retry_count: Number of retries for API calls
        retry_delay: Delay between retries in seconds
        
        Returns:
        MultiIndex DataFrame with ['ticker', 'date'] index
        """
        # Ensure symbols is a list
        if isinstance(symbols, str):
            symbols = [symbols]
        
        # Cache key based on parameters
        cache_key = f"{'-'.join(symbols)}_{period}_{interval}"
        
        # Check if we have cached data that's less than 5 minutes old
        if cache_key in self._historical_data_cache:
            cache_time = self._historical_data_cache[cache_key]['timestamp']
            if time.time() - cache_time < 300:  # 5 minutes in seconds
                logger.info(f"Using cached data for {len(symbols)} symbols")
                return self._historical_data_cache[cache_key]['data']
        
        # Process in batches to avoid timeout issues
        all_data = []
        batch_size = 50  # Process up to 50 symbols at once
        
        for i in range(0, len(symbols), batch_size):
            symbol_batch = symbols[i:i+batch_size]
            logger.info(f"Fetching data for {len(symbol_batch)} symbols (batch {i//batch_size + 1})")
            
            batch_data = []
            for symbol in symbol_batch:
                # Try up to retry_count times with delay
                for attempt in range(retry_count):
                    try:
                        # Get data for individual symbol
                        ticker = self.yf.Ticker(symbol)
                        hist = ticker.history(period=period, interval=interval)
                        
                        # Skip if no data
                        if hist.empty:
                            logger.warning(f"No data available for {symbol}")
                            break
                        
                        # Add ticker as column for later MultiIndex creation
                        hist['ticker'] = symbol
                        
                        # Convert index to datetime column
                        hist = hist.reset_index()
                        
                        # Rename Date/Datetime to date for consistency
                        if 'Date' in hist.columns:
                            hist = hist.rename(columns={'Date': 'date'})
                        elif 'Datetime' in hist.columns:
                            hist = hist.rename(columns={'Datetime': 'date'})
                        
                        # Standardize column names
                        hist = hist.rename(columns={
                            'Open': 'open',
                            'High': 'high',
                            'Low': 'low',
                            'Close': 'close',
                            'Volume': 'volume',
                            'Dividends': 'dividends',
                            'Stock Splits': 'stock_splits'
                        })
                        
                        batch_data.append(hist)
                        break  # Success, exit retry loop
                        
                    except Exception as e:
                        if attempt < retry_count - 1:
                            logger.warning(f"Error fetching {symbol}, retrying ({attempt+1}/{retry_count}): {str(e)}")
                            time.sleep(retry_delay)
                        else:
                            logger.error(f"Failed to fetch {symbol} after {retry_count} attempts: {str(e)}")
            
            # Combine this batch
            if batch_data:
                batch_df = pd.concat(batch_data, ignore_index=True)
                all_data.append(batch_df)
            
            # Add delay between batches to avoid rate limiting
            if i + batch_size < len(symbols):
                time.sleep(0.5)
        
        # If no data was retrieved for any symbol
        if not all_data:
            logger.warning("No data retrieved for any symbols")
            # Return empty DataFrame with correct structure
            empty_df = pd.DataFrame(columns=['ticker', 'date', 'open', 'high', 'low', 'close', 'volume'])
            empty_df = empty_df.set_index(['ticker', 'date'])
            return empty_df
        
        # Combine all batches
        df = pd.concat(all_data, ignore_index=True)
        
        # Set MultiIndex
        df = df.set_index(['ticker', 'date'])
        
        # Sort index for efficient operations
        df = df.sort_index()
        
        # Cache the results
        self._historical_data_cache[cache_key] = {
            'data': df.copy(),
            'timestamp': time.time()
        }
        
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
            
            tr_14 = tr.rolling(window=14).mean()
            plus_di = 100 * (plus_dm.rolling(window=14).mean() / tr_14)
            minus_di = 100 * (minus_dm.rolling(window=14).mean() / tr_14)
            
            result_df.loc[ticker, 'plus_di'] = plus_di
            result_df.loc[ticker, 'minus_di'] = minus_di
            
            dx = 100 * (abs(plus_di - minus_di) / (plus_di + minus_di).abs())
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
            
            # Calculate weekly MACD for better trend confirmation
            # Group by week and get last price of each week
            weekly_data = ticker_data['close'].resample('W-FRI').last()
            if len(weekly_data) > 26:  # Need enough data for MACD
                weekly_ema_12 = weekly_data.ewm(span=12, adjust=False).mean()
                weekly_ema_26 = weekly_data.ewm(span=26, adjust=False).mean()
                weekly_macd = weekly_ema_12 - weekly_ema_26
                
                # Map weekly MACD back to daily data (fill forward)
                weekly_macd = weekly_macd.reindex(ticker_data.index, method='ffill')
                result_df.loc[ticker, 'weekly_macd'] = weekly_macd
        
        return result_df
    
    def get_stock_universe(self, universe_type='default'):
        """
        Get a list of stock symbols based on the specified universe type.
        
        Parameters:
        universe_type: Type of stock universe ('default', 'sp500', 'nasdaq100', 'dow30', 'mostactive')
        
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
            import requests
            import bs4
            
            if universe_type == 'default':
                # Default is a curated list of major stocks
                symbols = [
                    'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'BRK-B', 
                    'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 
                    'CRM', 'CMCSA', 'VZ', 'NFLX', 'INTC', 'KO', 'PEP', 'T', 'MRK',
                    'NKE', 'CSCO', 'AVGO', 'ABT', 'TMO', 'ACN', 'ORCL', 'XOM', 'CVX',
                    'DHR', 'WMT', 'COST', 'MCD', 'LLY', 'ABBV', 'PYPL', 'PM', 'NEE',
                    'WFC', 'TXN', 'AMD', 'UPS', 'CAT', 'HON', 'QCOM', 'LIN', 'SBUX',
                    'MS', 'BA', 'RTX', 'GS', 'SPGI', 'BLK', 'AMAT', 'GE', 'AMT',
                    'IBM', 'DE', 'AXP', 'C', 'AMGN', 'ISRG', 'TGT', 'BKNG', 'MMM',
                    'CHTR', 'LMT', 'MU', 'SYK', 'PLD', 'GILD', 'USB', 'MDLZ', 'CB'
                ]
                
            elif universe_type == 'sp500':
                # For S&P 500, scrape from Wikipedia
                url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
                response = requests.get(url)
                soup = bs4.BeautifulSoup(response.text, 'html.parser')
                table = soup.find('table', {'class': 'wikitable', 'id': 'constituents'})
                
                symbols = []
                for row in table.find_all('tr')[1:]:  # Skip header row
                    symbol = row.find_all('td')[0].text.strip()
                    # Handle special characters and convert to Yahoo Finance format
                    symbol = symbol.replace('.', '-')
                    symbols.append(symbol)
                
            elif universe_type == 'nasdaq100':
                # For NASDAQ 100, scrape from Wikipedia
                url = "https://en.wikipedia.org/wiki/Nasdaq-100"
                response = requests.get(url)
                soup = bs4.BeautifulSoup(response.text, 'html.parser')
                
                # Find the right table (look for "Ticker" in header)
                tables = soup.find_all('table', {'class': 'wikitable'})
                nasdaq_table = None
                for table in tables:
                    headers = [th.text.strip() for th in table.find_all('th')]
                    if 'Ticker' in headers:
                        nasdaq_table = table
                        break
                
                if not nasdaq_table:
                    raise ValueError("Could not find NASDAQ 100 table on Wikipedia")
                
                symbols = []
                # Find the index of the Ticker column
                ticker_index = headers.index('Ticker')
                
                for row in nasdaq_table.find_all('tr')[1:]:  # Skip header row
                    cells = row.find_all('td')
                    if len(cells) > ticker_index:
                        symbol = cells[ticker_index].text.strip()
                        symbols.append(symbol)
                
            elif universe_type == 'dow30':
                # For Dow 30, scrape from Wikipedia
                url = "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average"
                response = requests.get(url)
                soup = bs4.BeautifulSoup(response.text, 'html.parser')
                
                # Find the right table (Companies section)
                tables = soup.find_all('table', {'class': 'wikitable'})
                dow_table = None
                for table in tables:
                    headers = [th.text.strip() for th in table.find_all('th')]
                    if 'Symbol' in headers:
                        dow_table = table
                        break
                
                if not dow_table:
                    raise ValueError("Could not find Dow 30 table on Wikipedia")
                
                symbols = []
                # Find the index of the Symbol column
                symbol_index = headers.index('Symbol')
                
                for row in dow_table.find_all('tr')[1:]:  # Skip header row
                    cells = row.find_all('td')
                    if len(cells) > symbol_index:
                        symbol = cells[symbol_index].text.strip()
                        symbols.append(symbol)
                
            elif universe_type == 'mostactive':
                # Get most active stocks from Yahoo Finance
                url = "https://finance.yahoo.com/most-active"
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                response = requests.get(url, headers=headers)
                soup = bs4.BeautifulSoup(response.text, 'html.parser')
                
                symbols = []
                # Find all symbols in the table
                symbol_links = soup.find_all('a', {'class': 'Fw(600) C($linkColor)'})
                for link in symbol_links:
                    symbols.append(link.text)
                
                # Limit to top 100
                symbols = symbols[:100]
                
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
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK-B', 
                'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE'
            ]
            return fallback_symbols
    
    def is_market_open(self):
        """
        Check if the U.S. stock market is currently open.
        
        Returns:
        bool: True if market is open, False otherwise
        """
        # Define market hours (9:30 AM to 4:00 PM Eastern Time)
        import pytz
        from datetime import datetime, time
        
        et_timezone = pytz.timezone('US/Eastern')
        now_et = datetime.now(et_timezone)
        
        # Check if weekend
        if now_et.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
            return False
        
        # Check if within market hours
        market_open = time(9, 30)
        market_close = time(16, 0)
        
        current_time = now_et.time()
        
        if market_open <= current_time < market_close:
            # Now check for holidays using pandas
            from pandas.tseries.holiday import USFederalHolidayCalendar
            
            cal = USFederalHolidayCalendar()
            holidays = cal.holidays(start=now_et.date(), end=now_et.date())
            
            # If today is a holiday, market is closed
            if now_et.date() in holidays:
                return False
                
            return True
        
        return False


# Example usage
if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(level=logging.INFO, 
                     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Create provider
    provider = YahooFinanceAdapter()
    
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
        ticker_symbol, date = ticker
        print(f"{ticker_symbol} ({date.date()}): RSI = {row.get('rsi', 'N/A'):.2f}")