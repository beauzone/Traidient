"""
Integrated Screener

This module demonstrates how to integrate the market data provider architecture with 
the stock screener system, allowing screeners to work with any data source.
"""

import os
import sys
import logging
import importlib
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable, Union

# Import the factory
# In a real implementation, you would use relative imports
# from .market_data_provider_factory import MarketDataProviderFactory

try:
    from market_data_provider_factory import MarketDataProviderFactory
except ImportError:
    print("Market data provider factory not found. Please ensure it's in the same directory.")
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, 
                 format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IntegratedScreener:
    """
    Integrated screener class that combines data providers with screener functions.
    """
    
    def __init__(self, data_provider=None):
        """
        Initialize the integrated screener.
        
        Parameters:
        data_provider: MarketDataProvider instance (optional)
                      If not provided, the default provider will be used
        """
        # Use provided data provider or create default
        if data_provider is None:
            self.data_provider = MarketDataProviderFactory.create_default_provider()
        else:
            self.data_provider = data_provider
        
        logger.info(f"Initialized integrated screener with {type(self.data_provider).__name__}")
        
        # Cache for loaded screener functions
        self._screener_cache = {}
    
    def _load_screener_function(self, screener_code=None, screener_path=None, screener_name=None):
        """
        Load a screener function from code, file path, or name.
        
        Parameters:
        screener_code: Python code string containing the screener function
        screener_path: Path to a Python file containing the screener function
        screener_name: Name of a built-in screener function
        
        Returns:
        Callable screener function
        """
        # Check for cached function
        cache_key = f"{screener_path}_{screener_name}"
        if cache_key in self._screener_cache:
            return self._screener_cache[cache_key]
        
        # Option 1: Load from code string
        if screener_code:
            # Create a module namespace
            module_namespace = {}
            
            try:
                # Execute the code in the namespace
                exec(screener_code, module_namespace)
                
                # Look for screener functions
                # Convention: Functions starting with 'screen_' are screener functions
                screener_funcs = {name: func for name, func in module_namespace.items() 
                                 if name.startswith('screen_') and callable(func)}
                
                if not screener_funcs:
                    raise ValueError("No screener functions found in the provided code")
                
                # If no specific name provided, use the first one
                if not screener_name:
                    func_name, func = next(iter(screener_funcs.items()))
                    logger.info(f"Using screener function: {func_name}")
                    return func
                
                # Otherwise, find the named function
                if screener_name in screener_funcs:
                    return screener_funcs[screener_name]
                
                raise ValueError(f"Screener function '{screener_name}' not found in the provided code")
                
            except Exception as e:
                logger.error(f"Error loading screener from code: {str(e)}")
                raise
        
        # Option 2: Load from file path
        elif screener_path:
            try:
                # Extract module name from path
                if screener_path.endswith('.py'):
                    screener_path = screener_path[:-3]
                
                # Convert path to module name
                module_name = os.path.basename(screener_path)
                
                # If the directory is in sys.path, we can import directly
                module_spec = importlib.util.find_spec(module_name)
                
                if not module_spec:
                    # Add directory to sys.path temporarily
                    dir_path = os.path.dirname(screener_path)
                    if dir_path not in sys.path:
                        sys.path.insert(0, dir_path)
                
                # Import the module
                module = importlib.import_module(module_name)
                
                # Look for screener functions
                screener_funcs = {name: func for name, func in module.__dict__.items() 
                                 if name.startswith('screen_') and callable(func)}
                
                if not screener_funcs:
                    raise ValueError(f"No screener functions found in {screener_path}")
                
                # If no specific name provided, use the first one
                if not screener_name:
                    func_name, func = next(iter(screener_funcs.items()))
                    logger.info(f"Using screener function: {func_name}")
                    self._screener_cache[cache_key] = func
                    return func
                
                # Otherwise, find the named function
                if screener_name in screener_funcs:
                    func = screener_funcs[screener_name]
                    self._screener_cache[cache_key] = func
                    return func
                
                raise ValueError(f"Screener function '{screener_name}' not found in {screener_path}")
                
            except Exception as e:
                logger.error(f"Error loading screener from file: {str(e)}")
                raise
        
        # Option 3: Load built-in screener
        elif screener_name:
            # Define a list of built-in screeners
            built_in_screeners = {
                'momentum': self._screen_momentum,
                'trend_following': self._screen_trend_following,
                'sma_crossover': self._screen_sma_crossover,
                'oversold': self._screen_oversold,
                'breakout': self._screen_breakout
            }
            
            if screener_name in built_in_screeners:
                return built_in_screeners[screener_name]
            
            raise ValueError(f"Built-in screener '{screener_name}' not found. Available screeners: {list(built_in_screeners.keys())}")
        
        raise ValueError("Must provide either screener_code, screener_path, or screener_name")
    
    def run_screener(self, symbols=None, period='3mo', interval='1d', 
                     screener_code=None, screener_path=None, screener_name=None,
                     universe_type='default', 
                     screener_params=None):
        """
        Run a stock screener on market data.
        
        Parameters:
        symbols: List of stock symbols to screen (optional)
                If not provided, symbols will be fetched using universe_type
        period: Time period for historical data (default: '3mo')
        interval: Data interval (default: '1d')
        screener_code: Python code string containing the screener function
        screener_path: Path to a Python file containing the screener function
        screener_name: Name of a screener function
        universe_type: Type of stock universe to use if symbols not provided
        screener_params: Additional parameters to pass to the screener function
        
        Returns:
        DataFrame with screener results
        """
        # Get symbols if not provided
        if not symbols:
            logger.info(f"Fetching symbols for universe type: {universe_type}")
            symbols = self.data_provider.get_stock_universe(universe_type=universe_type)
            logger.info(f"Retrieved {len(symbols)} symbols")
        
        # Ensure symbols is a list
        if isinstance(symbols, str):
            symbols = [symbols]
        
        if not symbols:
            raise ValueError("No symbols provided and failed to retrieve symbols from universe")
        
        # Load historical data
        logger.info(f"Fetching historical data for {len(symbols)} symbols")
        data = self.data_provider.get_historical_data(symbols, period=period, interval=interval)
        logger.info(f"Retrieved data with shape: {data.shape}")
        
        # Calculate indicators
        logger.info("Calculating technical indicators")
        data_with_indicators = self.data_provider.calculate_indicators(data)
        logger.info(f"Added indicators, new shape: {data_with_indicators.shape}")
        
        # Load the screener function
        screener_func = self._load_screener_function(
            screener_code=screener_code,
            screener_path=screener_path,
            screener_name=screener_name
        )
        
        # Prepare parameters
        params = screener_params or {}
        
        # Run the screener
        logger.info(f"Running screener with params: {params}")
        try:
            results = screener_func(data_with_indicators, **params)
            logger.info(f"Screener returned {len(results)} matches")
            return results
        except Exception as e:
            logger.error(f"Error running screener: {str(e)}")
            raise
    
    # Built-in screener functions
    
    def _screen_momentum(self, df, rsi_threshold=60, volume_factor=1.5, price_change_days=5):
        """
        Screens for stocks showing strong momentum based on:
        - RSI above threshold
        - Volume above average
        - Price increasing over the specified period
        
        Parameters:
        df: MultiIndex DataFrame with ['ticker', 'date'] index.
        rsi_threshold: Minimum RSI value (default: 60)
        volume_factor: Minimum volume relative to average (default: 1.5)
        price_change_days: Number of days to measure price change (default: 5)
        
        Returns:
        DataFrame with stocks showing momentum characteristics.
        """
        # Get the latest data for each ticker
        latest_data = df.groupby('ticker').tail(1).copy()
        
        # Calculate price change over specified number of days if not already present
        if 'price_change_pct' not in latest_data.columns:
            # Get data from price_change_days ago
            past_data = df.groupby('ticker').nth(-price_change_days)
            # Calculate the percentage change
            price_changes = {}
            for ticker in latest_data.index.get_level_values('ticker').unique():
                if ticker in past_data.index.get_level_values('ticker'):
                    current_price = latest_data.loc[(ticker,), 'close'].iloc[0]
                    past_price = past_data.loc[(ticker,), 'close'].iloc[0]
                    price_changes[ticker] = ((current_price / past_price) - 1) * 100
            
            # Add the price change to the latest data
            for ticker, change in price_changes.items():
                latest_data.loc[(ticker,), 'price_change_pct'] = change
        
        # Apply conditions
        condition_1 = latest_data['rsi'] > rsi_threshold
        condition_2 = latest_data['volume'] > latest_data['volume_avg_20'] * volume_factor
        condition_3 = latest_data['price_change_pct'] > 0
        
        # Filter the data
        filtered = latest_data[condition_1 & condition_2 & condition_3].copy()
        
        # Handle empty results
        if len(filtered) == 0:
            return pd.DataFrame(columns=['ticker', 'close', 'rsi', 'volume', 
                                        'volume_avg_20', 'price_change_pct', 'score'])
        
        # Calculate score based on multiple factors
        filtered['score'] = (
            (filtered['rsi'] - rsi_threshold) * 0.5 +
            (filtered['volume'] / filtered['volume_avg_20'] - 1) * 20 +
            filtered['price_change_pct'] * 2
        )
        
        # Reset index to get ticker as a column
        filtered = filtered.reset_index(level=0)
        
        # Return the results
        return filtered.sort_values('score', ascending=False)[
            ['ticker', 'close', 'rsi', 'volume', 'volume_avg_20', 'price_change_pct', 'score']
        ]
    
    def _screen_trend_following(self, df, adx_threshold=20):
        """
        Screens for stocks in strong trends based on:
        - Price above both 50-day and 200-day moving averages
        - ADX above threshold (indicating trend strength)
        - Positive directional indicator (DI+) above negative (DI-)
        
        Parameters:
        df: MultiIndex DataFrame with ['ticker', 'date'] index
        adx_threshold: Minimum ADX value (default: 20)
        
        Returns:
        DataFrame with stocks in strong uptrends
        """
        # Get the latest data for each ticker
        latest_data = df.groupby('ticker').tail(1).copy()
        
        # Apply conditions
        condition_1 = latest_data['close'] > latest_data['sma_50']
        condition_2 = latest_data['close'] > latest_data['sma_200']
        condition_3 = latest_data['adx'] > adx_threshold
        condition_4 = latest_data['plus_di'] > latest_data['minus_di']
        
        # Filter the data
        filtered = latest_data[condition_1 & condition_2 & condition_3 & condition_4].copy()
        
        # Handle empty results
        if len(filtered) == 0:
            return pd.DataFrame(columns=['ticker', 'close', 'sma_50', 'sma_200', 
                                        'adx', 'plus_di', 'minus_di', 'score'])
        
        # Calculate score based on trend strength
        filtered['score'] = (
            (filtered['adx'] - adx_threshold) * 1.0 +
            (filtered['plus_di'] - filtered['minus_di']) * 2.0 +
            (filtered['close'] / filtered['sma_50'] - 1) * 50.0
        )
        
        # Reset index to get ticker as a column
        filtered = filtered.reset_index(level=0)
        
        # Return the results
        return filtered.sort_values('score', ascending=False)[
            ['ticker', 'close', 'sma_50', 'sma_200', 'adx', 'plus_di', 'minus_di', 'score']
        ]
    
    def _screen_sma_crossover(self, df, fast_period=20, slow_period=50):
        """
        Screens for stocks where the fast moving average has crossed above
        the slow moving average, indicating potential upward momentum.
        
        Parameters:
        df: MultiIndex DataFrame with ['ticker', 'date'] index
        fast_period: Period for the fast moving average (default: 20)
        slow_period: Period for the slow moving average (default: 50)
        
        Returns:
        DataFrame with stocks that have a recent moving average crossover
        """
        # Verify required columns
        required_columns = ['close']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        # Calculate moving averages if not already present
        if f'sma_{fast_period}' not in df.columns:
            df[f'sma_{fast_period}'] = df.groupby('ticker')['close'].transform(
                lambda x: x.rolling(fast_period).mean())
        
        if f'sma_{slow_period}' not in df.columns:
            df[f'sma_{slow_period}'] = df.groupby('ticker')['close'].transform(
                lambda x: x.rolling(slow_period).mean())
        
        # Get the latest two data points for each ticker
        latest_data = df.groupby('ticker').tail(2)
        
        # Create separate DataFrames for current and previous data points
        current_data = latest_data.groupby('ticker').tail(1)
        previous_data = latest_data.groupby('ticker').head(1)
        
        # Set conditions for crossover
        current_cross_over = current_data[f'sma_{fast_period}'] > current_data[f'sma_{slow_period}']
        previous_cross_under = previous_data[f'sma_{fast_period}'] <= previous_data[f'sma_{slow_period}']
        
        # Filter tickers that match the crossover pattern
        crossover_tickers = current_data[current_cross_over].index.get_level_values('ticker')
        cross_under_tickers = previous_data[previous_cross_under].index.get_level_values('ticker')
        
        # Find tickers that satisfy both conditions
        valid_tickers = set(crossover_tickers) & set(cross_under_tickers)
        
        # Filter the results
        filtered = current_data[current_data.index.get_level_values('ticker').isin(valid_tickers)].copy()
        
        if len(filtered) == 0:
            return pd.DataFrame(columns=['ticker', 'close', f'sma_{fast_period}', 
                                       f'sma_{slow_period}', 'crossover_strength', 'score'])
        
        # Calculate additional metrics
        filtered['crossover_strength'] = (filtered[f'sma_{fast_period}'] / filtered[f'sma_{slow_period}'] - 1) * 100
        
        # Add score based on crossover strength and close position relative to moving averages
        filtered['score'] = filtered['crossover_strength'] + (filtered['close'] / filtered[f'sma_{fast_period}'] - 1) * 50
        
        # Reset index to get ticker as a column
        filtered = filtered.reset_index(level=0)
        
        # Return the results with the most relevant columns
        return filtered.sort_values('score', ascending=False)[
            ['ticker', 'close', f'sma_{fast_period}', f'sma_{slow_period}', 'crossover_strength', 'score']
        ]
    
    def _screen_oversold(self, df, rsi_threshold=30, ma_period=50):
        """
        Screens for oversold stocks based on:
        - RSI below threshold (oversold condition)
        - Price still above longer-term moving average (overall uptrend)
        - Volume above average (increased interest)
        
        Parameters:
        df: MultiIndex DataFrame with ['ticker', 'date'] index
        rsi_threshold: Maximum RSI value (default: 30)
        ma_period: Moving average period to check trend (default: 50)
        
        Returns:
        DataFrame with oversold stocks still in uptrends
        """
        # Get the latest data for each ticker
        latest_data = df.groupby('ticker').tail(1).copy()
        
        # Apply conditions
        condition_1 = latest_data['rsi'] < rsi_threshold
        condition_2 = latest_data['close'] > latest_data[f'sma_{ma_period}']
        condition_3 = latest_data['volume'] > latest_data['volume_avg_20']
        
        # Filter the data
        filtered = latest_data[condition_1 & condition_2 & condition_3].copy()
        
        # Handle empty results
        if len(filtered) == 0:
            return pd.DataFrame(columns=['ticker', 'close', 'rsi', f'sma_{ma_period}', 
                                        'volume', 'volume_avg_20', 'score'])
        
        # Calculate score - lower RSI means higher score
        filtered['score'] = (
            (rsi_threshold - filtered['rsi']) * 2.0 +
            (filtered['close'] / filtered[f'sma_{ma_period}'] - 0.9) * 50.0 +
            (filtered['volume'] / filtered['volume_avg_20'] - 1) * 10.0
        )
        
        # Reset index to get ticker as a column
        filtered = filtered.reset_index(level=0)
        
        # Return the results
        return filtered.sort_values('score', ascending=False)[
            ['ticker', 'close', 'rsi', f'sma_{ma_period}', 'volume', 'volume_avg_20', 'score']
        ]
    
    def _screen_breakout(self, df, lookback_period=20):
        """
        Screens for stocks breaking out above previous resistance level.
        
        Parameters:
        df: MultiIndex DataFrame with ['ticker', 'date'] index
        lookback_period: Period to look back for resistance level (default: 20)
        
        Returns:
        DataFrame with stocks showing breakout patterns
        """
        # Get the latest data for each ticker
        latest_data = df.groupby('ticker').tail(1).copy()
        
        # Calculate resistance level (highest high in lookback period)
        resistance_level = df.groupby('ticker')['high'].rolling(window=lookback_period).max().groupby('ticker').shift(1)
        
        # Get resistance for the latest data point
        for ticker in latest_data.index.get_level_values('ticker'):
            if ticker in resistance_level.index.get_level_values('ticker'):
                # Get the most recent resistance level for this ticker
                ticker_data = resistance_level.loc[ticker].iloc[-1]
                latest_data.loc[(ticker,), 'resistance'] = ticker_data
        
        # Apply conditions
        condition_1 = latest_data['close'] > latest_data['resistance']  # Price above resistance
        condition_2 = latest_data['volume'] > latest_data['volume_avg_20'] * 1.5  # Increased volume
        
        # Filter the data
        filtered = latest_data[condition_1 & condition_2].copy()
        
        # Handle empty results
        if len(filtered) == 0:
            return pd.DataFrame(columns=['ticker', 'close', 'resistance', 'volume', 
                                        'volume_avg_20', 'breakout_pct', 'score'])
        
        # Calculate breakout percentage
        filtered['breakout_pct'] = (filtered['close'] / filtered['resistance'] - 1) * 100
        
        # Calculate score based on breakout strength and volume increase
        filtered['score'] = (
            filtered['breakout_pct'] * 2.0 +
            (filtered['volume'] / filtered['volume_avg_20'] - 1) * 20.0
        )
        
        # Reset index to get ticker as a column
        filtered = filtered.reset_index(level=0)
        
        # Return the results
        return filtered.sort_values('score', ascending=False)[
            ['ticker', 'close', 'resistance', 'volume', 'volume_avg_20', 'breakout_pct', 'score']
        ]


# Example usage
if __name__ == "__main__":
    # Example 1: Use the default data provider and a built-in screener
    try:
        screener = IntegratedScreener()
        
        # Run a built-in momentum screener
        results = screener.run_screener(
            symbols=['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
            period='3mo', 
            interval='1d',
            screener_name='momentum',
            screener_params={'rsi_threshold': 50}
        )
        
        print("\nMomentum Screener Results:")
        print(results)
        
        # Example 2: Define a custom screener and run it
        custom_screener_code = """
def screen_custom(df, min_price=50, max_rsi=70):
    '''
    Simple custom screener that finds stocks:
    - Above a minimum price
    - With RSI below a maximum value
    '''
    # Get the latest data for each ticker
    latest_data = df.groupby('ticker').tail(1).copy()
    
    # Apply conditions
    condition_1 = latest_data['close'] > min_price
    condition_2 = latest_data['rsi'] < max_rsi
    
    # Filter the data
    filtered = latest_data[condition_1 & condition_2].copy()
    
    # Handle empty results
    if len(filtered) == 0:
        return pd.DataFrame(columns=['ticker', 'close', 'rsi', 'score'])
    
    # Calculate a simple score
    filtered['score'] = filtered['close'] * (max_rsi - filtered['rsi']) / 100
    
    # Reset index to get ticker as a column
    filtered = filtered.reset_index(level=0)
    
    # Return the results
    return filtered.sort_values('score', ascending=False)[
        ['ticker', 'close', 'rsi', 'score']
    ]
"""
        
        results2 = screener.run_screener(
            symbols=['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
            period='3mo', 
            interval='1d',
            screener_code=custom_screener_code,
            screener_params={'min_price': 100, 'max_rsi': 60}
        )
        
        print("\nCustom Screener Results:")
        print(results2)
        
    except Exception as e:
        print(f"Error in example: {str(e)}")