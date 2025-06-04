"""
Alpha Vantage Market Data Provider Implementation

This module implements the Market Data Provider interface for Alpha Vantage,
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


class AlphaVantageAdapter(MarketDataProvider):
    """Alpha Vantage implementation of the MarketDataProvider interface."""
    
    # API endpoint base URL
    BASE_URL = "https://www.alphavantage.co/query"
    
    # Dictionary mapping interval strings to Alpha Vantage interval strings
    INTERVAL_MAP = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '60m': '60min',
        '1h': '60min',
        '1d': 'daily',
        '1wk': 'weekly',
        '1mo': 'monthly'
    }
    
    def __init__(self, api_key=None):
        """
        Initialize the Alpha Vantage adapter.
        
        Parameters:
        api_key: Alpha Vantage API key (optional, will use environment variables if not provided)
        """
        import requests
        self.requests = requests
        
        # Get API key
        self.api_key = api_key or os.environ.get('ALPHA_VANTAGE_API_KEY')
        
        if not self.api_key:
            raise ValueError("Alpha Vantage API key not provided and not found in environment variables")
        
        # Set API call limits
        self.calls_per_minute = 5  # Standard tier limit
        self.last_call_time = 0
        self.call_count = 0
        
        # Cache for stock universe
        self._stock_universe_cache = {}
        self._historical_data_cache = {}
        
        logger.info("AlphaVantageAdapter initialized")
    
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
        
    def _convert_period_to_days(self, period: str) -> int:
        """
        Convert a period string to number of days.
        
        Parameters:
        period: Period string (e.g., '1d', '5d', '1mo', '3mo', '1y', 'ytd', 'max')
        
        Returns:
        Number of days
        """
        today = datetime.now()
        
        if period.endswith('d'):
            return int(period[:-1])
        elif period.endswith('mo'):
            return int(period[:-2]) * 30
        elif period.endswith('y'):
            return int(period[:-1]) * 365
        elif period == 'ytd':
            start_of_year = datetime(today.year, 1, 1)
            return (today - start_of_year).days
        elif period == 'max':
            return 20 * 365  # 20 years as "max"
        else:
            raise ValueError(f"Unsupported period format: {period}")
    
    def _get_output_size(self, period: str) -> str:
        """
        Determine Alpha Vantage output size based on period.
        
        Parameters:
        period: Period string
        
        Returns:
        'full' or 'compact'
        """
        days = self._convert_period_to_days(period)
        
        # Alpha Vantage 'compact' returns latest 100 data points
        # 'full' returns up to 20 years of data
        if days <= 100:
            return 'compact'
        else:
            return 'full'
    
    def _map_interval(self, interval: str) -> str:
        """
        Map interval string to Alpha Vantage format.
        
        Parameters:
        interval: Interval string (e.g., '1m', '5m', '1h', '1d', '1wk')
        
        Returns:
        Alpha Vantage interval string
        """
        if interval not in self.INTERVAL_MAP:
            raise ValueError(f"Unsupported interval: {interval}. Supported intervals: {list(self.INTERVAL_MAP.keys())}")
        
        return self.INTERVAL_MAP[interval]
    
    def _fetch_intraday_data(self, symbol, interval, output_size='full'):
        """
        Fetch intraday data from Alpha Vantage.
        
        Parameters:
        symbol: Stock symbol
        interval: Data interval (1min, 5min, 15min, 30min, 60min)
        output_size: 'compact' or 'full'
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval={interval}&outputsize={output_size}&apikey={self.api_key}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
            
        if "Note" in data:
            logger.warning(f"Alpha Vantage API note: {data['Note']}")
        
        # Get time series data
        time_series_key = f"Time Series ({interval})"
        if time_series_key not in data:
            logger.error(f"Unexpected API response: {data}")
            raise ValueError(f"Unexpected API response format. Missing key: {time_series_key}")
        
        time_series = data[time_series_key]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(time_series, orient='index')
        
        # Convert column names
        df = df.rename(columns={
            '1. open': 'open',
            '2. high': 'high',
            '3. low': 'low',
            '4. close': 'close',
            '5. volume': 'volume'
        })
        
        # Convert string values to float
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col])
        
        # Reset index to convert date string to column
        df = df.reset_index()
        df = df.rename(columns={'index': 'date'})
        
        # Convert date strings to datetime objects
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def _fetch_daily_data(self, symbol, output_size='full'):
        """
        Fetch daily data from Alpha Vantage.
        
        Parameters:
        symbol: Stock symbol
        output_size: 'compact' or 'full'
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize={output_size}&apikey={self.api_key}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
            
        if "Note" in data:
            logger.warning(f"Alpha Vantage API note: {data['Note']}")
        
        # Get time series data
        if "Time Series (Daily)" not in data:
            logger.error(f"Unexpected API response: {data}")
            raise ValueError("Unexpected API response format. Missing key: 'Time Series (Daily)'")
        
        time_series = data["Time Series (Daily)"]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(time_series, orient='index')
        
        # Convert column names
        df = df.rename(columns={
            '1. open': 'open',
            '2. high': 'high',
            '3. low': 'low',
            '4. close': 'close',
            '5. volume': 'volume'
        })
        
        # Convert string values to float
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col])
        
        # Reset index to convert date string to column
        df = df.reset_index()
        df = df.rename(columns={'index': 'date'})
        
        # Convert date strings to datetime objects
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def _fetch_weekly_data(self, symbol):
        """
        Fetch weekly data from Alpha Vantage.
        
        Parameters:
        symbol: Stock symbol
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}?function=TIME_SERIES_WEEKLY&symbol={symbol}&apikey={self.api_key}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
            
        if "Note" in data:
            logger.warning(f"Alpha Vantage API note: {data['Note']}")
        
        # Get time series data
        if "Weekly Time Series" not in data:
            logger.error(f"Unexpected API response: {data}")
            raise ValueError("Unexpected API response format. Missing key: 'Weekly Time Series'")
        
        time_series = data["Weekly Time Series"]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(time_series, orient='index')
        
        # Convert column names
        df = df.rename(columns={
            '1. open': 'open',
            '2. high': 'high',
            '3. low': 'low',
            '4. close': 'close',
            '5. volume': 'volume'
        })
        
        # Convert string values to float
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col])
        
        # Reset index to convert date string to column
        df = df.reset_index()
        df = df.rename(columns={'index': 'date'})
        
        # Convert date strings to datetime objects
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def _fetch_monthly_data(self, symbol):
        """
        Fetch monthly data from Alpha Vantage.
        
        Parameters:
        symbol: Stock symbol
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}?function=TIME_SERIES_MONTHLY&symbol={symbol}&apikey={self.api_key}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
            
        if "Note" in data:
            logger.warning(f"Alpha Vantage API note: {data['Note']}")
        
        # Get time series data
        if "Monthly Time Series" not in data:
            logger.error(f"Unexpected API response: {data}")
            raise ValueError("Unexpected API response format. Missing key: 'Monthly Time Series'")
        
        time_series = data["Monthly Time Series"]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(time_series, orient='index')
        
        # Convert column names
        df = df.rename(columns={
            '1. open': 'open',
            '2. high': 'high',
            '3. low': 'low',
            '4. close': 'close',
            '5. volume': 'volume'
        })
        
        # Convert string values to float
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col])
        
        # Reset index to convert date string to column
        df = df.reset_index()
        df = df.rename(columns={'index': 'date'})
        
        # Convert date strings to datetime objects
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def get_historical_data(self, symbols, period='3mo', interval='1d', 
                            retry_count=3, retry_delay=1.0):
        """
        Retrieve historical market data for given symbols from Alpha Vantage.
        
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
        
        # Determine output size based on period
        output_size = self._get_output_size(period)
        
        # Map interval to Alpha Vantage format
        av_interval = self._map_interval(interval)
        
        # Process all symbols
        all_data = []
        
        for symbol in symbols:
            # Try up to retry_count times with delay
            for attempt in range(retry_count):
                try:
                    # Fetch appropriate data based on interval
                    if av_interval in ['1min', '5min', '15min', '30min', '60min']:
                        df = self._fetch_intraday_data(symbol, av_interval, output_size)
                    elif av_interval == 'daily':
                        df = self._fetch_daily_data(symbol, output_size)
                    elif av_interval == 'weekly':
                        df = self._fetch_weekly_data(symbol)
                    elif av_interval == 'monthly':
                        df = self._fetch_monthly_data(symbol)
                    else:
                        raise ValueError(f"Unsupported interval: {av_interval}")
                    
                    # Filter data based on period
                    days = self._convert_period_to_days(period)
                    cutoff_date = datetime.now() - timedelta(days=days)
                    df = df[df['date'] >= cutoff_date]
                    
                    all_data.append(df)
                    break  # Success, exit retry loop
                    
                except Exception as e:
                    if attempt < retry_count - 1:
                        logger.warning(f"Error fetching {symbol}, retrying ({attempt+1}/{retry_count}): {str(e)}")
                        time.sleep(retry_delay)
                    else:
                        logger.error(f"Failed to fetch {symbol} after {retry_count} attempts: {str(e)}")
        
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
        universe_type: Type of stock universe ('default', 'sp500', 'nasdaq100', 'dow30')
        
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
                    # Handle special characters and convert to Alpha Vantage format
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
    
    def get_technical_indicators_direct(self, symbol, indicator, interval='daily', time_period=14):
        """
        Get technical indicators directly from Alpha Vantage API.
        
        This is useful for indicators that are complex to calculate manually.
        
        Parameters:
        symbol: Stock symbol
        indicator: Indicator function name from Alpha Vantage
                  (e.g., 'RSI', 'MACD', 'BBANDS', 'ADX', etc.)
        interval: Time interval ('daily', 'weekly', 'monthly')
        time_period: Number of data points to use
        
        Returns:
        DataFrame with the indicator values
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}?function={indicator}&symbol={symbol}&interval={interval}&time_period={time_period}&apikey={self.api_key}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
            
        if "Note" in data:
            logger.warning(f"Alpha Vantage API note: {data['Note']}")
        
        # Get the indicator data
        meta_data_key = list(filter(lambda x: x.startswith('Meta Data'), data.keys()))
        if not meta_data_key:
            logger.error(f"Unexpected API response: {data}")
            raise ValueError(f"Unexpected API response format. Missing Meta Data")
        
        # Find technical indicator data key
        indicator_keys = [k for k in data.keys() if k != meta_data_key[0]]
        if not indicator_keys:
            logger.error(f"Unexpected API response: {data}")
            raise ValueError(f"Unexpected API response format. Missing indicator data")
        
        # Get the data
        indicator_data = data[indicator_keys[0]]
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(indicator_data, orient='index')
        
        # Convert string values to float
        for col in df.columns:
            df[col] = pd.to_numeric(df[col])
        
        # Reset index to convert date string to column
        df = df.reset_index()
        df = df.rename(columns={'index': 'date'})
        
        # Convert date strings to datetime objects
        df['date'] = pd.to_datetime(df['date'])
        
        # Add ticker column
        df['ticker'] = symbol
        
        # Set MultiIndex
        df = df.set_index(['ticker', 'date'])
        
        return df


# Example usage
if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(level=logging.INFO, 
                     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    try:
        # Create provider (API key needed)
        api_key = os.environ.get('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            print("Please set ALPHA_VANTAGE_API_KEY environment variable")
            exit(1)
            
        provider = AlphaVantageAdapter(api_key)
        
        # Get stock universe
        symbols = provider.get_stock_universe(universe_type='default')
        print(f"Retrieved {len(symbols)} symbols")
        
        # Get a small subset for testing due to API rate limits
        test_symbols = symbols[:2]
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
            
        # Example: Get RSI directly from Alpha Vantage API
        print("\nFetching RSI directly from Alpha Vantage API...")
        first_symbol = test_symbols[0]
        rsi_data = provider.get_technical_indicators_direct(first_symbol, 'RSI', time_period=14)
        print(f"Retrieved {len(rsi_data)} RSI data points for {first_symbol}")
        print(rsi_data.head())
        
    except Exception as e:
        print(f"Error in example: {str(e)}")