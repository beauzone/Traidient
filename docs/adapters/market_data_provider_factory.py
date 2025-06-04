"""
Market Data Provider Factory

This module defines the factory for creating and managing market data provider instances.
"""

import os
import logging
from typing import Dict, Any, Type, Optional

# Import provider implementations
# In a real implementation, you would use relative imports like:
# from .alpaca_adapter import AlpacaAdapter
# from .yahoo_finance_adapter import YahooFinanceAdapter
# etc.

# For the purpose of this example, we'll assume all providers are in the same directory
try:
    from alpaca_adapter import AlpacaAdapter
    from yahoo_finance_adapter import YahooFinanceAdapter
    from alpha_vantage_adapter import AlphaVantageAdapter
    from polygon_adapter import PolygonAdapter
    from tiingo_adapter import TiingoAdapter
except ImportError:
    # This allows the module to be imported even if some adapters are missing
    # Each adapter will be checked for actual availability when requested
    pass

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


class MarketDataProviderFactory:
    """Factory for creating and managing data provider instances."""
    
    _instances = {}
    _adapter_classes = {}
    
    @classmethod
    def _load_adapter_classes(cls):
        """Load adapter classes if they're available."""
        if not cls._adapter_classes:
            # Try to load each adapter class
            try:
                from alpaca_adapter import AlpacaAdapter
                cls._adapter_classes['alpaca'] = AlpacaAdapter
            except ImportError:
                logger.warning("AlpacaAdapter not available")
            
            try:
                from yahoo_finance_adapter import YahooFinanceAdapter
                cls._adapter_classes['yahoo'] = YahooFinanceAdapter
            except ImportError:
                logger.warning("YahooFinanceAdapter not available")
            
            try:
                from alpha_vantage_adapter import AlphaVantageAdapter
                cls._adapter_classes['alphavantage'] = AlphaVantageAdapter
            except ImportError:
                logger.warning("AlphaVantageAdapter not available")
            
            try:
                from polygon_adapter import PolygonAdapter
                cls._adapter_classes['polygon'] = PolygonAdapter
            except ImportError:
                logger.warning("PolygonAdapter not available")
            
            try:
                from tiingo_adapter import TiingoAdapter
                cls._adapter_classes['tiingo'] = TiingoAdapter
            except ImportError:
                logger.warning("TiingoAdapter not available")
    
    @classmethod
    def available_providers(cls):
        """
        Get a list of available provider names.
        
        Returns:
        List of provider names
        """
        cls._load_adapter_classes()
        return list(cls._adapter_classes.keys())
    
    @classmethod
    def get_provider(cls, provider_name, **credentials):
        """
        Get a configured market data provider instance.
        
        Parameters:
        provider_name: Name of the provider to use ('yahoo', 'alpaca', 'alphavantage', 'polygon', 'tiingo')
        credentials: API keys or other credentials needed
        
        Returns:
        A configured MarketDataProvider instance
        """
        cls._load_adapter_classes()
        
        if provider_name not in cls._adapter_classes:
            available = cls.available_providers()
            raise ValueError(f"Provider not available: {provider_name}. Available providers: {available}")
        
        # Create a cache key based on provider and credentials
        cache_key = f"{provider_name}_{hash(frozenset(credentials.items() if credentials else []))}"
        
        # Return cached instance if available
        if cache_key in cls._instances:
            return cls._instances[cache_key]
        
        # Create a new instance
        provider_class = cls._adapter_classes[provider_name]
        
        try:
            # Special case for YahooFinance which doesn't need credentials
            if provider_name == 'yahoo':
                provider = provider_class()
            else:
                provider = provider_class(**credentials)
            
            cls._instances[cache_key] = provider
            return provider
            
        except Exception as e:
            logger.error(f"Error creating provider '{provider_name}': {str(e)}")
            raise
    
    @classmethod
    def get_credentials_requirements(cls, provider_name):
        """
        Get information about the credentials required for a provider.
        
        Parameters:
        provider_name: Name of the provider
        
        Returns:
        Dictionary with credential requirements information
        """
        cls._load_adapter_classes()
        
        if provider_name not in cls._adapter_classes:
            available = cls.available_providers()
            raise ValueError(f"Provider not available: {provider_name}. Available providers: {available}")
        
        # Define credential requirements for each provider
        requirements = {
            'yahoo': {
                'required': [],
                'optional': [],
                'description': 'Yahoo Finance does not require API credentials.'
            },
            'alpaca': {
                'required': ['api_key', 'api_secret'],
                'optional': ['paper'],
                'description': 'Alpaca requires API key and secret. Optional paper parameter (boolean) to use paper trading.'
            },
            'alphavantage': {
                'required': ['api_key'],
                'optional': [],
                'description': 'Alpha Vantage requires an API key.'
            },
            'polygon': {
                'required': ['api_key'],
                'optional': [],
                'description': 'Polygon.io requires an API key.'
            },
            'tiingo': {
                'required': ['api_key'],
                'optional': [],
                'description': 'Tiingo requires an API key.'
            }
        }
        
        return requirements.get(provider_name, {
            'required': [],
            'optional': [],
            'description': 'Unknown provider.'
        })
    
    @classmethod
    def get_environment_credentials(cls, provider_name):
        """
        Get credentials for a provider from environment variables.
        
        Parameters:
        provider_name: Name of the provider
        
        Returns:
        Dictionary with available credentials from environment
        """
        # Map provider names to environment variable names
        env_var_map = {
            'alpaca': {
                'api_key': 'ALPACA_API_KEY',
                'api_secret': 'ALPACA_API_SECRET'
            },
            'alphavantage': {
                'api_key': 'ALPHA_VANTAGE_API_KEY'
            },
            'polygon': {
                'api_key': 'POLYGON_API_KEY'
            },
            'tiingo': {
                'api_key': 'TIINGO_API_KEY'
            }
        }
        
        # Yahoo Finance doesn't need credentials
        if provider_name == 'yahoo':
            return {}
        
        if provider_name not in env_var_map:
            return {}
        
        # Get credentials from environment variables
        credentials = {}
        for cred_key, env_var in env_var_map[provider_name].items():
            value = os.environ.get(env_var)
            if value:
                credentials[cred_key] = value
        
        return credentials
    
    @classmethod
    def get_default_provider(cls):
        """
        Get the default provider based on available credentials.
        
        Returns:
        Tuple of (provider_name, credentials)
        """
        # Check in this order - from most preferred to least
        preferred_order = ['alpaca', 'polygon', 'alphavantage', 'tiingo', 'yahoo']
        
        for provider_name in preferred_order:
            # Check if provider is available
            if provider_name not in cls._adapter_classes:
                continue
            
            # For Yahoo, no credentials needed
            if provider_name == 'yahoo':
                return 'yahoo', {}
            
            # For others, check environment variables
            credentials = cls.get_environment_credentials(provider_name)
            requirements = cls.get_credentials_requirements(provider_name)
            
            # Check if all required credentials are available
            if all(req in credentials for req in requirements['required']):
                return provider_name, credentials
        
        # If no provider with credentials is available, use Yahoo
        if 'yahoo' in cls._adapter_classes:
            return 'yahoo', {}
        
        # If Yahoo is not available, raise an error
        raise ValueError("No data provider available. Please install at least one provider package.")
    
    @classmethod
    def create_default_provider(cls):
        """
        Create a provider instance using the default provider.
        
        Returns:
        MarketDataProvider instance
        """
        provider_name, credentials = cls.get_default_provider()
        return cls.get_provider(provider_name, **credentials)


# Example usage
if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(level=logging.INFO, 
                     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Get available providers
    providers = MarketDataProviderFactory.available_providers()
    print(f"Available providers: {providers}")
    
    # Get default provider
    provider_name, credentials = MarketDataProviderFactory.get_default_provider()
    print(f"Default provider: {provider_name}")
    
    # Create a provider instance
    try:
        provider = MarketDataProviderFactory.create_default_provider()
        
        # Get a small list of symbols
        symbols = provider.get_stock_universe(universe_type='default')[:3]
        print(f"Testing with symbols: {symbols}")
        
        # Get historical data
        data = provider.get_historical_data(symbols, period='1mo', interval='1d')
        print(f"Retrieved {len(data)} data points")
        
        # Calculate indicators
        data_with_indicators = provider.calculate_indicators(data)
        print(f"Calculated indicators, new shape: {data_with_indicators.shape}")
        
        # Check if market is open
        is_open = hasattr(provider, 'is_market_open') and provider.is_market_open()
        print(f"Market is currently {'open' if is_open else 'closed'}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        print("To use a specific provider, install the required dependencies and set the appropriate API keys in environment variables.")