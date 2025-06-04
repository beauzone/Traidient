"""
Polygon.io Market Data Provider Implementation

This module implements the Market Data Provider interface for Polygon.io,
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


class PolygonAdapter(MarketDataProvider):
    """Polygon.io implementation of the MarketDataProvider interface."""
    
    # API endpoint base URL
    BASE_URL = "https://api.polygon.io"
    
    # Dictionary mapping interval strings to Polygon.io multiplier and timespan
    INTERVAL_MAP = {
        '1m': (1, 'minute'),
        '5m': (5, 'minute'),
        '15m': (15, 'minute'),
        '30m': (30, 'minute'),
        '60m': (1, 'hour'),
        '1h': (1, 'hour'),
        '1d': (1, 'day'),
        '1wk': (1, 'week'),
        '1mo': (1, 'month')
    }
    
    def __init__(self, api_key=None):
        """
        Initialize the Polygon.io adapter.
        
        Parameters:
        api_key: Polygon.io API key (optional, will use environment variables if not provided)
        """
        import requests
        self.requests = requests
        
        # Get API key
        self.api_key = api_key or os.environ.get('POLYGON_API_KEY')
        
        if not self.api_key:
            raise ValueError("Polygon.io API key not provided and not found in environment variables")
        
        # Set API call limits (depends on subscription tier)
        self.calls_per_minute = 5  # Conservative default, adjust based on plan
        self.last_call_time = 0
        self.call_count = 0
        
        # Cache for stock universe
        self._stock_universe_cache = {}
        self._historical_data_cache = {}
        
        logger.info("PolygonAdapter initialized")
    
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
        Tuple of (from_date, to_date) as date strings in ISO format
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
            # Polygon.io's earliest data is from 2004
            start_date = date(2004, 1, 1)
        else:
            raise ValueError(f"Unsupported period format: {period}")
        
        return start_date.isoformat(), end_date.isoformat()
    
    def _map_interval(self, interval: str) -> tuple:
        """
        Map interval string to Polygon.io multiplier and timespan.
        
        Parameters:
        interval: Interval string (e.g., '1m', '5m', '1h', '1d', '1wk')
        
        Returns:
        Tuple of (multiplier, timespan)
        """
        if interval not in self.INTERVAL_MAP:
            raise ValueError(f"Unsupported interval: {interval}. Supported intervals: {list(self.INTERVAL_MAP.keys())}")
        
        return self.INTERVAL_MAP[interval]
    
    def _fetch_aggregates(self, symbol, multiplier, timespan, from_date, to_date, limit=50000):
        """
        Fetch aggregates (OHLC) data from Polygon.io.
        
        Parameters:
        symbol: Stock symbol
        multiplier: Number of timespan units (e.g., 1, 5, 15)
        timespan: Time unit (minute, hour, day, week, month, quarter, year)
        from_date: Start date in ISO format (YYYY-MM-DD)
        to_date: End date in ISO format (YYYY-MM-DD)
        limit: Maximum number of results to return
        
        Returns:
        DataFrame with historical data
        """
        self._throttle_api_call()
        
        url = f"{self.BASE_URL}/v2/aggs/ticker/{symbol}/range/{multiplier}/{timespan}/{from_date}/{to_date}?apiKey={self.api_key}&limit={limit}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if data.get('status') == 'ERROR':
            error_msg = data.get('error', 'Unknown error')
            raise ValueError(f"Polygon.io API error: {error_msg}")
        
        # Get results
        results = data.get('results', [])
        
        if not results:
            logger.warning(f"No data available for {symbol}")
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(results)
        
        # Convert column names
        df = df.rename(columns={
            't': 'timestamp',
            'o': 'open',
            'h': 'high',
            'l': 'low',
            'c': 'close',
            'v': 'volume',
            'n': 'items',
            'vw': 'vwap'
        })
        
        # Convert timestamp (milliseconds) to datetime
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df.drop('timestamp', axis=1)
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def _fetch_intraday_data(self, symbol, multiplier, timespan, from_date, to_date):
        """
        Fetch intraday data from Polygon.io.
        
        This handles pagination for large datasets.
        
        Parameters:
        symbol: Stock symbol
        multiplier: Number of timespan units (e.g., 1, 5, 15)
        timespan: Time unit (minute, hour, day, week, month, quarter, year)
        from_date: Start date in ISO format (YYYY-MM-DD)
        to_date: End date in ISO format (YYYY-MM-DD)
        
        Returns:
        DataFrame with historical data
        """
        all_data = []
        limit = 5000  # Maximum records per request
        
        # Initial request
        self._throttle_api_call()
        url = f"{self.BASE_URL}/v2/aggs/ticker/{symbol}/range/{multiplier}/{timespan}/{from_date}/{to_date}?apiKey={self.api_key}&limit={limit}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if data.get('status') == 'ERROR':
            error_msg = data.get('error', 'Unknown error')
            raise ValueError(f"Polygon.io API error: {error_msg}")
        
        results = data.get('results', [])
        
        if not results:
            logger.warning(f"No data available for {symbol}")
            return pd.DataFrame()
        
        all_data.extend(results)
        
        # Check if we need to paginate
        while data.get('next_url'):
            self._throttle_api_call()
            next_url = f"{data['next_url']}&apiKey={self.api_key}"
            
            response = self.requests.get(next_url)
            data = response.json()
            
            # Check for errors
            if data.get('status') == 'ERROR':
                error_msg = data.get('error', 'Unknown error')
                logger.error(f"Polygon.io API error during pagination: {error_msg}")
                break
            
            results = data.get('results', [])
            if results:
                all_data.extend(results)
            else:
                break
        
        # Convert to DataFrame
        if not all_data:
            return pd.DataFrame()
        
        df = pd.DataFrame(all_data)
        
        # Convert column names
        df = df.rename(columns={
            't': 'timestamp',
            'o': 'open',
            'h': 'high',
            'l': 'low',
            'c': 'close',
            'v': 'volume',
            'n': 'items',
            'vw': 'vwap'
        })
        
        # Convert timestamp (milliseconds) to datetime
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df.drop('timestamp', axis=1)
        
        # Add ticker column
        df['ticker'] = symbol
        
        return df
    
    def get_historical_data(self, symbols, period='3mo', interval='1d', 
                            retry_count=3, retry_delay=1.0):
        """
        Retrieve historical market data for given symbols from Polygon.io.
        
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
        
        # Get date range
        from_date, to_date = self._get_date_range(period)
        
        # Map interval to Polygon.io format
        multiplier, timespan = self._map_interval(interval)
        
        # Process all symbols
        all_data = []
        
        for symbol in symbols:
            # Try up to retry_count times with delay
            for attempt in range(retry_count):
                try:
                    # For intraday data or large date ranges, use paginated approach
                    if timespan in ['minute', 'hour'] or period in ['1y', 'max', 'ytd']:
                        df = self._fetch_intraday_data(symbol, multiplier, timespan, from_date, to_date)
                    else:
                        df = self._fetch_aggregates(symbol, multiplier, timespan, from_date, to_date)
                    
                    if not df.empty:
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
        universe_type: Type of stock universe ('default', 'sp500', 'nasdaq100', 'dow30', 'polygon_all')
        
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
                    'NKE', 'CSCO', 'AVGO', 'ABT', 'TMO', 'ACN', 'ORCL', 'XOM', 'CVX',
                    'DHR', 'WMT', 'COST', 'MCD', 'LLY', 'ABBV', 'PYPL', 'PM', 'NEE'
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
                    # Handle special characters and convert to Polygon.io format
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
                
            elif universe_type == 'polygon_all':
                # Use Polygon.io's tickers endpoint to get all US stocks
                self._throttle_api_call()
                
                url = f"{self.BASE_URL}/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey={self.api_key}"
                
                symbols = []
                
                # Make initial request
                response = self.requests.get(url)
                data = response.json()
                
                if data.get('status') == 'OK':
                    results = data.get('results', [])
                    symbols.extend([result['ticker'] for result in results])
                    
                    # Paginate through all results
                    while data.get('next_url'):
                        self._throttle_api_call()
                        next_url = f"{data['next_url']}&apiKey={self.api_key}"
                        
                        response = self.requests.get(next_url)
                        data = response.json()
                        
                        if data.get('status') == 'OK':
                            results = data.get('results', [])
                            symbols.extend([result['ticker'] for result in results])
                        else:
                            break
                
                # If we got too many symbols, limit to a reasonable number
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
    
    def get_technical_indicators_direct(self, symbol, indicator_type, params=None):
        """
        Get technical indicators directly from Polygon.io API.
        
        Note: This is only available with higher tier Polygon.io subscriptions.
        
        Parameters:
        symbol: Stock symbol
        indicator_type: Technical indicator type (e.g., 'sma', 'ema', 'rsi', 'macd')
        params: Dictionary of parameters for the indicator
        
        Returns:
        DataFrame with the indicator values
        """
        self._throttle_api_call()
        
        # Prepare parameters
        params = params or {}
        params_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        
        # Build URL
        url = f"{self.BASE_URL}/v1/indicators/{indicator_type}/{symbol}?apiKey={self.api_key}"
        if params_str:
            url += f"&{params_str}"
        
        response = self.requests.get(url)
        data = response.json()
        
        # Check for errors
        if data.get('status') == 'ERROR':
            error_msg = data.get('error', 'Unknown error')
            raise ValueError(f"Polygon.io API error: {error_msg}")
        
        # Get results
        results = data.get('results', {})
        
        if not results:
            logger.warning(f"No indicator data available for {symbol}")
            return pd.DataFrame()
        
        # Convert values to DataFrame
        values = results.get('values', [])
        
        if not values:
            return pd.DataFrame()
        
        df = pd.DataFrame(values)
        
        # Convert timestamp (milliseconds) to datetime
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df.drop('timestamp', axis=1)
        
        # Add ticker column
        df['ticker'] = symbol
        
        # Set MultiIndex
        df = df.set_index(['ticker', 'date'])
        
        return df
    
    def is_market_open(self):
        """
        Check if the US stock market is currently open using Polygon.io's API.
        
        Returns:
        bool: True if market is open, False otherwise
        """
        self._throttle_api_call()
        
        # Current date in YYYY-MM-DD format
        today = date.today().isoformat()
        
        url = f"{self.BASE_URL}/v1/marketstatus/now?apiKey={self.api_key}"
        
        try:
            response = self.requests.get(url)
            data = response.json()
            
            # Check market status directly
            market = data.get('market')
            
            return market == 'open'
            
        except Exception as e:
            logger.error(f"Error checking market status: {str(e)}")
            
            # Fallback to time-based check
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
        api_key = os.environ.get('POLYGON_API_KEY')
        if not api_key:
            print("Please set POLYGON_API_KEY environment variable")
            exit(1)
            
        provider = PolygonAdapter(api_key)
        
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
            
        # Check if market is open
        is_open = provider.is_market_open()
        print(f"Market is currently {'open' if is_open else 'closed'}")
        
    except Exception as e:
        print(f"Error in example: {str(e)}")