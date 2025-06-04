"""
Tiingo Market Data Provider Implementation

This module implements the Market Data Provider interface for Tiingo,
allowing standardized access to historical market data and technical indicators.
"""

import os
import time
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
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


class TiingoAdapter(MarketDataProvider):
    """Tiingo implementation of the MarketDataProvider interface."""
    
    # API endpoint base URL
    BASE_URL = "https://api.tiingo.com"
    
    # Dictionary mapping interval strings to Tiingo format
    INTERVAL_MAP = {
        '1d': 'daily',
        '1wk': 'weekly', 
        '1mo': 'monthly',
        # For intraday (requires higher subscription level)
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1h': '1hour'
    }
    
    def __init__(self, api_key=None):
        """
        Initialize the Tiingo adapter.
        
        Parameters:
        api_key: Tiingo API key (optional, will use environment variables if not provided)
        """
        import requests
        self.requests = requests
        
        # Get API key
        self.api_key = api_key or os.environ.get('TIINGO_API_KEY')
        
        if not self.api_key:
            raise ValueError("Tiingo API key not provided and not found in environment variables")
        
        # Set up headers for API requests
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Token {self.api_key}'
        }
        
        # Set API call limits
        self.calls_per_minute = 100  # Tiingo's free tier limit
        self.last_call_time = 0
        self.call_count = 0
        
        # Cache for stock universe and historical data
        self._stock_universe_cache = {}
        self._historical_data_cache = {}
        self._supported_tickers_cache = None
        
        logger.info("TiingoAdapter initialized")
    
    def _throttle_api_call(self):
        """
        Throttle API calls to stay within rate limits.
        """
        self.call_count += 1
        
        # Reset counter after a minute
        current_time = time.time()
        if current_time - self.last_call_time > 60:
            self.call_count = 1
            self.last_call_time = current_time
            return
        
        # If we've reached the limit, wait until a minute has passed
        if self.call_count >= self.calls_per_minute:
            wait_time = 60 - (current_time - self.last_call_time) + 1  # Add 1 second buffer
            logger.info(f"Rate limit reached, waiting {wait_time:.2f} seconds")
            time.sleep(wait_time)
            self.call_count = 1
            self.last_call_time = time.time()
    
    def _get_date_range(self, period: str) -> tuple:
        """
        Get date range from period string.
        
        Parameters:
        period: Period string (e.g., '1d', '5d', '1mo', '3mo', '1y', 'ytd', 'max')
        
        Returns:
        Tuple of (start_date, end_date) as date strings in ISO format
        """
        end_date = date.today()
        
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
            start_date = date(end_date.year, 1, 1)
        elif period == 'max':
            # Tiingo has data going back to 1970-01-01
            start_date = date(1970, 1, 1)
        else:
            raise ValueError(f"Unsupported period format: {period}")
        
        return start_date.isoformat(), end_date.isoformat()
    
    def _map_interval(self, interval: str) -> str:
        """
        Map interval string to Tiingo format.
        
        Parameters:
        interval: Interval string (e.g., '1d', '1wk', '1mo')
        
        Returns:
        Tiingo resampleFreq value
        """
        if interval not in self.INTERVAL_MAP:
            valid_intervals = list(self.INTERVAL_MAP.keys())
            raise ValueError(f"Unsupported interval: {interval}. Supported intervals: {valid_intervals}")
        
        return self.INTERVAL_MAP[interval]
    
    def _fetch_eod_data(self, symbol, start_date, end_date):
        """
        Fetch end-of-day data from Tiingo.
        
        Parameters:
        symbol: Stock symbol
        start_date: Start date in ISO format (YYYY-MM-DD)
        end_date: End date in ISO format (YYYY-MM-DD)
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}/tiingo/daily/{symbol}/prices"
        params = {
            'startDate': start_date,
            'endDate': end_date,
            'format': 'json'
        }
        
        response = self.requests.get(url, headers=self.headers, params=params)
        
        # Check for errors
        if response.status_code != 200:
            logger.error(f"Tiingo API error ({response.status_code}): {response.text}")
            raise ValueError(f"Tiingo API error: {response.text}")
        
        data = response.json()
        
        if not data:
            logger.warning(f"No data available for {symbol}")
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Rename columns to match expected format
        df = df.rename(columns={
            'date': 'date',
            'open': 'open',
            'high': 'high',
            'low': 'low',
            'close': 'close',
            'volume': 'volume',
            'adjOpen': 'adj_open',
            'adjHigh': 'adj_high',
            'adjLow': 'adj_low',
            'adjClose': 'adj_close',
            'adjVolume': 'adj_volume',
            'divCash': 'dividend',
            'splitFactor': 'split_factor'
        })
        
        # Convert date string to datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def _fetch_intraday_data(self, symbol, start_date, end_date, interval):
        """
        Fetch intraday data from Tiingo.
        
        Note: This requires a paid Tiingo subscription.
        
        Parameters:
        symbol: Stock symbol
        start_date: Start date in ISO format (YYYY-MM-DD)
        end_date: End date in ISO format (YYYY-MM-DD)
        interval: Tiingo interval format ('1min', '5min', etc.)
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        # Convert ISO dates to formatted string with times
        start_datetime = f"{start_date}T00:00:00"
        end_datetime = f"{end_date}T23:59:59"
        
        url = f"{self.BASE_URL}/iex/{symbol}/prices"
        params = {
            'startDate': start_datetime,
            'endDate': end_datetime,
            'resampleFreq': interval,
            'format': 'json'
        }
        
        response = self.requests.get(url, headers=self.headers, params=params)
        
        # Check for errors
        if response.status_code != 200:
            logger.error(f"Tiingo API error ({response.status_code}): {response.text}")
            raise ValueError(f"Tiingo API error: {response.text}")
        
        data = response.json()
        
        if not data:
            logger.warning(f"No intraday data available for {symbol}")
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Rename columns to match expected format
        df = df.rename(columns={
            'date': 'date',
            'open': 'open',
            'high': 'high',
            'low': 'low',
            'close': 'close',
            'volume': 'volume'
        })
        
        # Convert date string to datetime
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def get_supported_tickers(self, force_update=False):
        """
        Get a list of all tickers supported by Tiingo.
        
        Parameters:
        force_update: Force a refresh of the cached ticker list
        
        Returns:
        DataFrame with supported tickers information
        """
        # Return cached data if available and not forcing update
        if self._supported_tickers_cache is not None and not force_update:
            return self._supported_tickers_cache
        
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}/tiingo/daily/supported-tickers"
        response = self.requests.get(url, headers=self.headers)
        
        # Check for errors
        if response.status_code != 200:
            logger.error(f"Tiingo API error ({response.status_code}): {response.text}")
            raise ValueError(f"Tiingo API error: {response.text}")
        
        data = response.json()
        
        if not data:
            logger.warning("No supported tickers data available")
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Cache the results
        self._supported_tickers_cache = df
        
        return df
    
    def get_historical_data(self, symbols, period='3mo', interval='1d', 
                            retry_count=3, retry_delay=1.0):
        """
        Retrieve historical market data for given symbols from Tiingo.
        
        Parameters:
        symbols: List of ticker symbols or single symbol string
        period: Time period to fetch (e.g., '1d', '5d', '1mo', '3mo', '1y', 'ytd', 'max')
        interval: Data frequency (e.g., '1d', '1wk', '1mo')
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
        
        # Get date range
        start_date, end_date = self._get_date_range(period)
        
        # Map interval to Tiingo format
        tiingo_interval = self._map_interval(interval)
        
        # Process all symbols
        all_data = []
        
        for symbol in symbols:
            # Try up to retry_count times with delay
            for attempt in range(retry_count):
                try:
                    # Determine if we need EOD or intraday data
                    if tiingo_interval in ['daily', 'weekly', 'monthly']:
                        df = self._fetch_eod_data(symbol, start_date, end_date)
                    else:
                        # Note: Intraday data requires a paid Tiingo subscription
                        df = self._fetch_intraday_data(symbol, start_date, end_date, tiingo_interval)
                    
                    if not df.empty:
                        all_data.append(df)
                    
                    break  # Success, exit retry loop
                    
                except Exception as e:
                    if attempt < retry_count - 1:
                        logger.warning(f"Error fetching {symbol}, retrying ({attempt+1}/{retry_count}): {str(e)}")
                        time.sleep(retry_delay)
                    else:
                        logger.error(f"Failed to fetch {symbol} after {retry_count} attempts: {str(e)}")
            
            # Rate limiting - avoid hitting Tiingo API limits
            if len(symbols) > 5 and symbols.index(symbol) < len(symbols) - 1:
                time.sleep(0.2)  # Small pause between symbols
        
        # If no data was retrieved for any symbol
        if not all_data:
            logger.warning("No data retrieved for any symbols")
            # Return empty DataFrame with correct structure
            empty_df = pd.DataFrame(columns=['ticker', 'date', 'open', 'high', 'low', 'close', 'volume'])
            empty_df = empty_df.set_index(['ticker', 'date'])
            return empty_df
        
        # Combine all data
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
        
        return result_df
    
    def get_stock_universe(self, universe_type='default'):
        """
        Get a list of stock symbols based on the specified universe type.
        
        Parameters:
        universe_type: Type of stock universe ('default', 'sp500', 'nasdaq100', 'dow30', 'tiingo_all')
        
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
                    'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'BRK.B', 
                    'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE', 
                    'CRM', 'CMCSA', 'VZ', 'NFLX', 'INTC', 'KO', 'PEP', 'T', 'MRK',
                    'NKE', 'CSCO', 'AVGO', 'ABT', 'TMO', 'ACN', 'ORCL', 'XOM', 'CVX'
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
                    # Handle special characters and convert to Tiingo format
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
                
            elif universe_type == 'tiingo_all':
                # Get all supported tickers from Tiingo
                # Note: This can be a large list
                supported_tickers = self.get_supported_tickers()
                
                # Filter to only get US stock tickers (optional)
                us_stocks = supported_tickers[supported_tickers['assetType'] == 'Stock']
                
                # Extract ticker symbols
                symbols = us_stocks['ticker'].tolist()
                
                # Limit to a reasonable number if too many
                if len(symbols) > 1000:
                    logger.info(f"Limiting symbols from {len(symbols)} to 1000")
                    symbols = symbols[:1000]
                
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
                'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'BAC', 'MA', 'DIS', 'ADBE'
            ]
            return fallback_symbols
    
    def get_meta_data(self, ticker):
        """
        Get metadata for a ticker from Tiingo.
        
        Parameters:
        ticker: Stock symbol
        
        Returns:
        Dictionary with metadata
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}/tiingo/daily/{ticker}"
        response = self.requests.get(url, headers=self.headers)
        
        # Check for errors
        if response.status_code != 200:
            logger.error(f"Tiingo API error ({response.status_code}): {response.text}")
            raise ValueError(f"Tiingo API error: {response.text}")
        
        return response.json()
    
    def is_market_open(self):
        """
        Check if the US stock market is currently open.
        
        Note: Tiingo doesn't have a direct endpoint for market status, so we use time-based check.
        
        Returns:
        bool: True if market is open, False otherwise
        """
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
            # Now check for holidays
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
    
    try:
        # Create provider (API key needed)
        api_key = os.environ.get('TIINGO_API_KEY')
        if not api_key:
            print("Please set TIINGO_API_KEY environment variable")
            exit(1)
            
        provider = TiingoAdapter(api_key)
        
        # Get stock universe
        symbols = provider.get_stock_universe(universe_type='default')
        print(f"Retrieved {len(symbols)} symbols")
        
        # Get a small subset for testing due to API rate limits
        test_symbols = symbols[:3]
        print(f"Testing with symbols: {test_symbols}")
        
        # Get historical data
        print("Fetching historical data...")
        data = provider.get_historical_data(test_symbols, period='1mo', interval='1d')
        print(f"Retrieved {len(data)} data points")
        
        # Calculate indicators
        print("Calculating indicators...")
        data_with_indicators = provider.calculate_indicators(data)
        print(f"Calculated indicators, new shape: {data_with_indicators.shape}")
        
        # Example: Get latest RSI values
        latest_data = data_with_indicators.groupby('ticker').tail(1)
        print("Latest RSI values:")
        for ticker, row in latest_data.iterrows():
            ticker_symbol, date = ticker
            print(f"{ticker_symbol} ({date.date()}): RSI = {row.get('rsi', 'N/A'):.2f}")
            
        # Check if market is open
        is_open = provider.is_market_open()
        print(f"Market is currently {'open' if is_open else 'closed'}")
        
        # Get metadata for a ticker
        first_symbol = test_symbols[0]
        print(f"\nGetting metadata for {first_symbol}...")
        meta_data = provider.get_meta_data(first_symbol)
        print(f"Company Name: {meta_data.get('name')}")
        print(f"Exchange: {meta_data.get('exchange')}")
        print(f"Description: {meta_data.get('description')[:100]}...")
        
    except Exception as e:
        print(f"Error in example: {str(e)}")