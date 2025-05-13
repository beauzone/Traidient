# Trading Strategy Development Guide

## Overview

This guide outlines how to create trading strategies that are compatible with our algorithmic trading platform. Following these guidelines will ensure your AI-generated strategies integrate seamlessly with our system.

## Strategy Structure

Each trading strategy should be structured as a Python class that follows these conventions:

### 1. Basic Structure

```python
class MyTradingStrategy:
    def __init__(self, parameters=None):
        # Initialize strategy parameters
        self.name = "My Trading Strategy"
        self.description = "A detailed description of what this strategy does"
        self.parameters = parameters or {}
        self.setup_parameters()
        
    def setup_parameters(self):
        # Set default parameters if not provided
        self.period = self.parameters.get('period', 14)
        self.threshold = self.parameters.get('threshold', 70)
        # Add any other parameters your strategy needs
        
    def run(self, data):
        """
        Main entry point for the strategy
        
        Args:
            data: A pandas DataFrame with OHLCV data (Open, High, Low, Close, Volume)
                 with a DatetimeIndex
        
        Returns:
            dict: A dictionary containing signal information
        """
        # Implement your strategy logic here
        signals = self.generate_signals(data)
        return self.format_output(signals)
        
    def generate_signals(self, data):
        # Implement your signal generation logic
        # Example: Using an indicator to generate buy/sell signals
        pass
        
    def format_output(self, signals):
        # Format the output in the expected structure
        return {
            "signals": signals,
            "metadata": {
                "strategy_name": self.name,
                "parameters": self.parameters
            }
        }
```

### 2. Input Data Format

Your strategy should expect to receive data in this format:

- A pandas DataFrame with OHLCV (Open, High, Low, Close, Volume) data
- DatetimeIndex for the time series
- Example:

```
                     Open    High     Low   Close     Volume
2025-01-01 09:30:00  150.25  151.20  149.80  150.90  1000000
2025-01-01 09:31:00  150.90  151.30  150.50  151.10   950000
...
```

### 3. Signal Output Format

Your strategy should return signals in this format:

```python
{
    "signals": [
        {
            "timestamp": "2025-01-02T10:15:00",  # ISO format timestamp
            "action": "BUY",                     # BUY, SELL, EXIT, or NONE
            "symbol": "AAPL",                    # The ticker symbol
            "price": 150.25,                     # Optional: Target price
            "quantity": 100,                     # Optional: Position size
            "stop_loss": 148.50,                 # Optional: Stop loss price
            "take_profit": 155.00,               # Optional: Take profit price
            "confidence": 0.85,                  # Optional: Signal confidence (0-1)
            "metadata": {                        # Optional: Additional information
                "indicator_values": {
                    "rsi": 68.5,
                    "macd": 0.25
                }
            }
        }
        # Additional signals...
    ],
    "metadata": {
        "strategy_name": "My RSI Strategy",
        "parameters": {
            "period": 14,
            "threshold": 70
        }
    }
}
```

## Technical Indicators

Our platform supports a wide range of technical indicators through the `pandas-ta` library. Here's how to use them:

```python
import pandas as pd
import pandas_ta as ta

def example_indicators(data):
    # Make a copy to avoid modifying the original data
    df = data.copy()
    
    # Add RSI
    df['rsi'] = ta.rsi(df['Close'], length=14)
    
    # Add MACD
    macd = ta.macd(df['Close'])
    df = pd.concat([df, macd], axis=1)
    
    # Add Bollinger Bands
    bbands = ta.bbands(df['Close'])
    df = pd.concat([df, bbands], axis=1)
    
    # Add Moving Averages
    df['sma_20'] = ta.sma(df['Close'], length=20)
    df['ema_50'] = ta.ema(df['Close'], length=50)
    
    return df
```

The platform supports all indicators from the `pandas-ta` library, including:

- Momentum: RSI, MACD, Stochastic, CCI, etc.
- Trend: Moving Averages, ADX, PSAR, etc.
- Volatility: Bollinger Bands, ATR, etc.
- Volume: OBV, Volume Oscillators, etc.
- Pattern Recognition: Candlestick patterns

## Trading Logic Examples

### Example 1: RSI Strategy

```python
def generate_signals(self, data):
    # Calculate RSI
    df = data.copy()
    df['rsi'] = ta.rsi(df['Close'], length=self.period)
    
    signals = []
    for i in range(len(df) - 1):
        if i < self.period:  # Skip until we have enough data for the indicators
            continue
            
        current_row = df.iloc[i]
        
        if current_row['rsi'] < 30:  # Oversold condition
            signal = {
                "timestamp": current_row.name.isoformat(),
                "action": "BUY",
                "symbol": "AAPL",  # Replace with actual symbol
                "confidence": min(1.0, (30 - current_row['rsi']) / 30),
                "metadata": {
                    "indicator_values": {
                        "rsi": current_row['rsi']
                    }
                }
            }
            signals.append(signal)
            
        elif current_row['rsi'] > 70:  # Overbought condition
            signal = {
                "timestamp": current_row.name.isoformat(),
                "action": "SELL",
                "symbol": "AAPL",  # Replace with actual symbol
                "confidence": min(1.0, (current_row['rsi'] - 70) / 30),
                "metadata": {
                    "indicator_values": {
                        "rsi": current_row['rsi']
                    }
                }
            }
            signals.append(signal)
    
    return signals
```

### Example 2: Moving Average Crossover

```python
def generate_signals(self, data):
    # Calculate moving averages
    df = data.copy()
    df['sma_fast'] = ta.sma(df['Close'], length=self.parameters.get('fast_period', 10))
    df['sma_slow'] = ta.sma(df['Close'], length=self.parameters.get('slow_period', 30))
    
    # Calculate crossover
    df['cross_above'] = (df['sma_fast'] > df['sma_slow']) & (df['sma_fast'].shift(1) <= df['sma_slow'].shift(1))
    df['cross_below'] = (df['sma_fast'] < df['sma_slow']) & (df['sma_fast'].shift(1) >= df['sma_slow'].shift(1))
    
    signals = []
    for i in range(1, len(df)):
        current_row = df.iloc[i]
        
        if current_row['cross_above']:
            signal = {
                "timestamp": current_row.name.isoformat(),
                "action": "BUY",
                "symbol": "AAPL",  # Replace with actual symbol
                "confidence": 0.8,
                "metadata": {
                    "indicator_values": {
                        "fast_ma": current_row['sma_fast'],
                        "slow_ma": current_row['sma_slow']
                    }
                }
            }
            signals.append(signal)
            
        elif current_row['cross_below']:
            signal = {
                "timestamp": current_row.name.isoformat(),
                "action": "SELL",
                "symbol": "AAPL",  # Replace with actual symbol
                "confidence": 0.8,
                "metadata": {
                    "indicator_values": {
                        "fast_ma": current_row['sma_fast'],
                        "slow_ma": current_row['sma_slow']
                    }
                }
            }
            signals.append(signal)
    
    return signals
```

## Risk Management Guidelines

Include risk management in your strategy with these approaches:

### 1. Fixed Stop Loss and Take Profit

```python
signal = {
    "timestamp": timestamp,
    "action": "BUY",
    "symbol": symbol,
    "price": entry_price,
    "stop_loss": entry_price * 0.95,  # 5% stop loss
    "take_profit": entry_price * 1.15  # 15% take profit
}
```

### 2. ATR-Based Stop Loss

```python
# Calculate ATR
df['atr'] = ta.atr(df['High'], df['Low'], df['Close'], length=14)

# For a buy signal
stop_loss = entry_price - (df.iloc[-1]['atr'] * 3)  # 3 ATR units below entry
```

### 3. Trailing Stop Loss

Specify a trailing stop as a percentage:

```python
signal = {
    "timestamp": timestamp,
    "action": "BUY",
    "symbol": symbol,
    "trailing_stop_percent": 3.5  # 3.5% trailing stop
}
```

## Position Sizing

Include position sizing logic in your strategy:

### 1. Fixed Size

```python
signal = {
    "timestamp": timestamp,
    "action": "BUY",
    "symbol": symbol,
    "quantity": 100  # Always buy 100 shares
}
```

### 2. Risk-Based Sizing

```python
# Risk 1% of portfolio on each trade
def calculate_position_size(self, price, stop_loss, portfolio_value, risk_percent=1.0):
    risk_amount = portfolio_value * (risk_percent / 100)
    risk_per_share = abs(price - stop_loss)
    
    if risk_per_share == 0:
        return 0
        
    shares = int(risk_amount / risk_per_share)
    return max(1, shares)  # At least 1 share
```

## Best Practices

1. **Handle Missing Data**: Always check for and handle NaN values in your indicators.
2. **Proper Lookback Periods**: Ensure you have enough data for your indicators.
3. **Avoid Lookahead Bias**: Don't use future data in your calculations.
4. **Include Metadata**: Add relevant indicator values to help with debugging.
5. **Parameterize Your Strategy**: Make key values configurable parameters.
6. **Document Your Code**: Include docstrings and comments explaining your logic.
7. **Optimize Performance**: Vectorize calculations when possible rather than using loops.
8. **Test Edge Cases**: Ensure your strategy handles unusual market conditions.

## Complete Example Strategy

Here's a complete example of a strategy following these guidelines:

```python
import pandas as pd
import pandas_ta as ta
from datetime import datetime

class RSIBollingerStrategy:
    def __init__(self, parameters=None):
        self.name = "RSI Bollinger Band Strategy"
        self.description = "Buys when RSI is oversold and price is near lower Bollinger Band. Sells when RSI is overbought and price is near upper Bollinger Band."
        self.parameters = parameters or {}
        self.setup_parameters()
        
    def setup_parameters(self):
        # RSI parameters
        self.rsi_length = self.parameters.get('rsi_length', 14)
        self.rsi_oversold = self.parameters.get('rsi_oversold', 30)
        self.rsi_overbought = self.parameters.get('rsi_overbought', 70)
        
        # Bollinger Band parameters
        self.bb_length = self.parameters.get('bb_length', 20)
        self.bb_std = self.parameters.get('bb_std', 2.0)
        
        # Risk management
        self.stop_loss_atr_mult = self.parameters.get('stop_loss_atr_mult', 2.0)
        self.take_profit_atr_mult = self.parameters.get('take_profit_atr_mult', 4.0)
        self.risk_per_trade_pct = self.parameters.get('risk_per_trade_pct', 1.0)
        
    def run(self, data, symbol="AAPL", portfolio_value=100000):
        """
        Main entry point for the strategy
        
        Args:
            data: DataFrame with OHLCV data
            symbol: Trading symbol (default: AAPL)
            portfolio_value: Current portfolio value for position sizing
            
        Returns:
            dict: Strategy output with signals
        """
        # Add indicators
        df = self.add_indicators(data)
        
        # Generate signals
        signals = self.generate_signals(df, symbol, portfolio_value)
        
        # Format output
        return self.format_output(signals)
    
    def add_indicators(self, data):
        """Add technical indicators to the dataframe"""
        df = data.copy()
        
        # Calculate RSI
        df['rsi'] = ta.rsi(df['Close'], length=self.rsi_length)
        
        # Calculate Bollinger Bands
        bbands = ta.bbands(df['Close'], length=self.bb_length, std=self.bb_std)
        df = pd.concat([df, bbands], axis=1)
        
        # Calculate ATR for stop loss
        df['atr'] = ta.atr(df['High'], df['Low'], df['Close'], length=14)
        
        # Calculate percentage distance from price to Bollinger Bands
        df['bb_lower_pct'] = (df['Close'] - df['BBL_20_2.0']) / df['Close'] * 100
        df['bb_upper_pct'] = (df['BBU_20_2.0'] - df['Close']) / df['Close'] * 100
        
        return df
    
    def generate_signals(self, df, symbol, portfolio_value):
        """Generate trading signals based on indicators"""
        signals = []
        
        # Skip the first few bars until indicators are calculated
        start_idx = max(self.rsi_length, self.bb_length) + 5
        
        for i in range(start_idx, len(df)):
            current = df.iloc[i]
            prev = df.iloc[i-1]
            
            # Buy condition: RSI crosses below oversold and price is near lower BB
            buy_signal = (
                prev['rsi'] >= self.rsi_oversold and 
                current['rsi'] < self.rsi_oversold and
                current['bb_lower_pct'] < 1.0  # Price is within 1% of lower band
            )
            
            # Sell condition: RSI crosses above overbought and price is near upper BB
            sell_signal = (
                prev['rsi'] <= self.rsi_overbought and 
                current['rsi'] > self.rsi_overbought and
                current['bb_upper_pct'] < 1.0  # Price is within 1% of upper band
            )
            
            if buy_signal:
                # Calculate stop loss and take profit levels
                entry_price = current['Close']
                stop_loss = entry_price - (current['atr'] * self.stop_loss_atr_mult)
                take_profit = entry_price + (current['atr'] * self.take_profit_atr_mult)
                
                # Calculate position size based on risk
                quantity = self.calculate_position_size(
                    entry_price, stop_loss, portfolio_value, self.risk_per_trade_pct
                )
                
                signal = {
                    "timestamp": current.name.isoformat(),
                    "action": "BUY",
                    "symbol": symbol,
                    "price": entry_price,
                    "quantity": quantity,
                    "stop_loss": stop_loss,
                    "take_profit": take_profit,
                    "confidence": min(1.0, (self.rsi_oversold - current['rsi']) / 10),
                    "metadata": {
                        "indicator_values": {
                            "rsi": current['rsi'],
                            "lower_band": current['BBL_20_2.0'],
                            "middle_band": current['BBM_20_2.0'],
                            "upper_band": current['BBU_20_2.0'],
                            "atr": current['atr']
                        }
                    }
                }
                signals.append(signal)
                
            elif sell_signal:
                # Calculate stop loss and take profit levels for short
                entry_price = current['Close']
                stop_loss = entry_price + (current['atr'] * self.stop_loss_atr_mult)
                take_profit = entry_price - (current['atr'] * self.take_profit_atr_mult)
                
                # Calculate position size based on risk
                quantity = self.calculate_position_size(
                    entry_price, stop_loss, portfolio_value, self.risk_per_trade_pct
                )
                
                signal = {
                    "timestamp": current.name.isoformat(),
                    "action": "SELL",
                    "symbol": symbol,
                    "price": entry_price,
                    "quantity": quantity,
                    "stop_loss": stop_loss,
                    "take_profit": take_profit,
                    "confidence": min(1.0, (current['rsi'] - self.rsi_overbought) / 10),
                    "metadata": {
                        "indicator_values": {
                            "rsi": current['rsi'],
                            "lower_band": current['BBL_20_2.0'],
                            "middle_band": current['BBM_20_2.0'],
                            "upper_band": current['BBU_20_2.0'],
                            "atr": current['atr']
                        }
                    }
                }
                signals.append(signal)
        
        return signals
    
    def calculate_position_size(self, price, stop_loss, portfolio_value, risk_percent):
        """Calculate position size based on risk percentage"""
        risk_amount = portfolio_value * (risk_percent / 100)
        risk_per_share = abs(price - stop_loss)
        
        if risk_per_share <= 0:
            return 1  # Fallback to 1 share if calculation fails
            
        shares = int(risk_amount / risk_per_share)
        return max(1, shares)  # At least 1 share
    
    def format_output(self, signals):
        """Format the strategy output"""
        return {
            "signals": signals,
            "metadata": {
                "strategy_name": self.name,
                "description": self.description,
                "parameters": self.parameters,
                "generated_at": datetime.now().isoformat()
            }
        }
```

## Testing Your Strategy

Before submitting your strategy, test it with sample data to ensure it generates valid signals and follows the expected format.

```python
# Example test
import pandas as pd
import yfinance as yf

# Get sample data
data = yf.download("AAPL", start="2024-01-01", end="2025-01-01", interval="1d")

# Initialize your strategy
strategy = RSIBollingerStrategy(parameters={
    'rsi_length': 14,
    'bb_length': 20
})

# Run the strategy
result = strategy.run(data, symbol="AAPL", portfolio_value=100000)

# Check the output
print(f"Generated {len(result['signals'])} signals")
print(result['signals'][0] if result['signals'] else "No signals generated")
```

---

Follow these guidelines to ensure your AI-generated trading strategies integrate seamlessly with our platform. For any questions or clarifications, please refer to our support documentation.