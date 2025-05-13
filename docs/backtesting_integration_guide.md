# Backtesting Integration Guide

## Overview

This guide outlines how to structure your trading strategies to work with our backtesting engine. Following these guidelines will ensure your AI-generated strategies can be properly backtested and evaluated on historical data.

## Backtesting Requirements

For a strategy to be compatible with our backtesting engine, it needs to meet these requirements:

1. Implement the standard strategy interface described in the main Strategy Development Guide
2. Handle batch processing of historical data
3. Provide properly formatted entry and exit signals
4. Include appropriate risk management parameters
5. Account for realistic trading conditions (slippage, commission, etc.)

## Backtesting Engine Integration

### Strategy Input Format for Backtesting

When your strategy is executed in the backtesting environment, it will receive:

1. A complete historical dataset with OHLCV data
2. Starting capital and account configuration
3. Market condition parameters (e.g., commission rates, slippage models)

### Strategy Output for Backtesting

Your strategy's output should follow this format for the backtester to properly process it:

```python
{
    "signals": [
        {
            "timestamp": "2025-01-02T10:15:00",  # ISO format timestamp
            "action": "BUY",                     # BUY, SELL, EXIT
            "symbol": "AAPL",                    # The ticker symbol
            "price": 150.25,                     # Optional: Entry price (will use market price if not specified)
            "order_type": "MARKET",              # Optional: MARKET, LIMIT, STOP, STOP_LIMIT
            "quantity": 100,                     # Number of shares/contracts
            "stop_loss": 148.50,                 # Optional: Stop loss price
            "take_profit": 155.00,               # Optional: Take profit price
            "trailing_stop_percent": 2.0,        # Optional: Trailing stop as percentage
            "position_sizing": {                 # Optional: Position sizing rules
                "type": "RISK",                  # FIXED, RISK, PERCENT
                "value": 1.0                     # 1% risk, percent of portfolio, or fixed value
            }
        }
        # More signals...
    ],
    "metadata": {
        "strategy_name": "My RSI Strategy",
        "parameters": {
            "period": 14,
            "threshold": 70,
            # Any other parameters
        }
    }
}
```

## Handling Entry and Exit Logic

### Position Entry

For entering positions, specify:

1. **Action**: "BUY" for long positions, "SELL" for short positions
2. **Entry Price**: Optional, will use market price if not specified
3. **Order Type**: "MARKET", "LIMIT", "STOP", or "STOP_LIMIT"
4. **Quantity**: Number of shares/contracts

Example:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "BUY",
    "symbol": "AAPL",
    "price": current_bar['Close'],
    "order_type": "LIMIT",
    "quantity": 100
}
```

### Position Exit

For exiting positions, you can use:

1. **Explicit Exit Signals**: Generate an "EXIT" action
2. **Stop Loss and Take Profit**: Specify prices when entering the position
3. **Trailing Stops**: Use percentage-based trailing stops

Example for explicit exit:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "EXIT",
    "symbol": "AAPL",
    "price": current_bar['Close'],
    "order_type": "MARKET"
}
```

Example for stop loss and take profit at entry:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "BUY",
    "symbol": "AAPL",
    "price": current_bar['Close'],
    "quantity": 100,
    "stop_loss": current_bar['Close'] * 0.95,  # 5% stop loss
    "take_profit": current_bar['Close'] * 1.10  # 10% take profit
}
```

Example for trailing stop:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "BUY",
    "symbol": "AAPL",
    "price": current_bar['Close'],
    "quantity": 100,
    "trailing_stop_percent": 2.5  # 2.5% trailing stop
}
```

## Position Sizing for Backtesting

The backtesting engine supports several position sizing methods:

### 1. Fixed Size

Specify a fixed number of shares/contracts:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "BUY",
    "symbol": "AAPL",
    "quantity": 100  # Always buy 100 shares
}
```

### 2. Percentage of Portfolio

Allocate a percentage of the current portfolio value:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "BUY",
    "symbol": "AAPL",
    "position_sizing": {
        "type": "PERCENT",
        "value": 10.0  # Use 10% of portfolio value
    }
}
```

### 3. Risk-Based Sizing

Risk a specific percentage of the portfolio based on the distance to stop loss:

```python
signal = {
    "timestamp": current_bar.name.isoformat(),
    "action": "BUY",
    "symbol": "AAPL",
    "price": current_bar['Close'],
    "stop_loss": current_bar['Close'] * 0.95,  # 5% stop loss
    "position_sizing": {
        "type": "RISK",
        "value": 1.0  # Risk 1% of portfolio value
    }
}
```

## Handling Multiple Assets

For multi-asset strategies, ensure you specify the correct symbol for each signal:

```python
signals = []

# Process each symbol in your universe
for symbol in symbols:
    symbol_data = data[symbol]  # Get data for this symbol
    
    # Generate signals using your strategy logic
    if buy_condition(symbol_data.iloc[-1]):
        signal = {
            "timestamp": symbol_data.iloc[-1].name.isoformat(),
            "action": "BUY",
            "symbol": symbol,
            "quantity": 100
        }
        signals.append(signal)
```

## Accounting for Realistic Conditions

To make your backtest more realistic, account for:

### 1. Slippage

The backtesting engine applies slippage models, but you can specify custom slippage assumptions:

```python
# For the entire strategy
strategy_params = {
    "slippage_model": {
        "type": "fixed",
        "value": 0.01  # Fixed $0.01 per share slippage
    }
}

# Or for individual orders
signal = {
    "timestamp": timestamp,
    "action": "BUY",
    "symbol": symbol,
    "slippage": {
        "type": "percentage",
        "value": 0.001  # 0.1% slippage
    }
}
```

### 2. Commission

The backtesting engine applies commission models based on the broker configuration:

```python
# For the entire strategy
strategy_params = {
    "commission_model": {
        "type": "per_share",
        "value": 0.005  # $0.005 per share
    }
}
```

### 3. Market Hours

The backtesting engine respects market hours by default. Ensure your signals account for this:

```python
def is_market_hours(timestamp):
    """Check if timestamp is during regular market hours"""
    dt = pd.to_datetime(timestamp)
    
    # Check if it's a weekday (Monday=0, Sunday=6)
    if dt.weekday() > 4:  # Saturday or Sunday
        return False
        
    # Convert to Eastern Time for US markets
    dt_eastern = dt.tz_localize('UTC').tz_convert('US/Eastern')
    
    # Regular market hours: 9:30 AM to 4:00 PM Eastern
    market_open = dt_eastern.replace(hour=9, minute=30, second=0)
    market_close = dt_eastern.replace(hour=16, minute=0, second=0)
    
    return market_open <= dt_eastern <= market_close
```

## Sample Complete Backtesting Strategy

Here's a complete example of a strategy optimized for backtesting:

```python
import pandas as pd
import pandas_ta as ta
from datetime import datetime

class MACDCrossoverStrategy:
    def __init__(self, parameters=None):
        self.name = "MACD Crossover Strategy"
        self.description = "Buys when MACD line crosses above signal line, sells when it crosses below."
        self.parameters = parameters or {}
        self.setup_parameters()
        
    def setup_parameters(self):
        # MACD parameters
        self.fast_length = self.parameters.get('fast_length', 12)
        self.slow_length = self.parameters.get('slow_length', 26)
        self.signal_length = self.parameters.get('signal_length', 9)
        
        # Risk management
        self.stop_loss_pct = self.parameters.get('stop_loss_pct', 5.0)
        self.take_profit_pct = self.parameters.get('take_profit_pct', 10.0)
        self.trailing_stop_pct = self.parameters.get('trailing_stop_pct', 3.0)
        
        # Position sizing
        self.position_sizing_type = self.parameters.get('position_sizing_type', 'RISK')
        self.position_sizing_value = self.parameters.get('position_sizing_value', 1.0)
        
    def run(self, data, symbols=None):
        """
        Main entry point for the strategy
        
        Args:
            data: DataFrame with OHLCV data or dictionary of DataFrames by symbol
            symbols: List of symbols to process (if data is a dictionary)
            
        Returns:
            dict: Strategy output with signals
        """
        all_signals = []
        
        # Handle single-symbol or multi-symbol data
        if isinstance(data, dict):
            # Multi-symbol: data is a dictionary of DataFrames by symbol
            for symbol, symbol_data in data.items():
                symbol_signals = self.process_symbol(symbol_data, symbol)
                all_signals.extend(symbol_signals)
        else:
            # Single-symbol: data is a DataFrame for one symbol
            symbol = symbols[0] if symbols and len(symbols) > 0 else "UNKNOWN"
            all_signals = self.process_symbol(data, symbol)
        
        # Format output
        return self.format_output(all_signals)
    
    def process_symbol(self, data, symbol):
        """Process data for a single symbol"""
        # Calculate indicators
        df = self.add_indicators(data)
        
        # Generate signals
        signals = self.generate_signals(df, symbol)
        
        return signals
    
    def add_indicators(self, data):
        """Add technical indicators to the dataframe"""
        df = data.copy()
        
        # Calculate MACD
        macd = ta.macd(df['Close'], 
                      fast=self.fast_length, 
                      slow=self.slow_length, 
                      signal=self.signal_length)
        df = pd.concat([df, macd], axis=1)
        
        # Rename columns for easier access
        df.rename(columns={
            f'MACD_{self.fast_length}_{self.slow_length}_{self.signal_length}': 'macd',
            f'MACDs_{self.fast_length}_{self.slow_length}_{self.signal_length}': 'macd_signal',
            f'MACDh_{self.fast_length}_{self.slow_length}_{self.signal_length}': 'macd_hist'
        }, inplace=True)
        
        return df
    
    def generate_signals(self, df, symbol):
        """Generate trading signals based on MACD crossover"""
        signals = []
        
        # Skip the beginning until indicators are calculated
        min_periods = max(self.fast_length, self.slow_length) + self.signal_length
        
        for i in range(min_periods + 1, len(df)):
            current = df.iloc[i]
            prev = df.iloc[i-1]
            
            # Check for MACD crossover
            macd_cross_above = (
                prev['macd'] <= prev['macd_signal'] and 
                current['macd'] > current['macd_signal']
            )
            
            macd_cross_below = (
                prev['macd'] >= prev['macd_signal'] and 
                current['macd'] < current['macd_signal']
            )
            
            if macd_cross_above:
                # Calculate stop loss and take profit
                entry_price = current['Close']
                stop_loss = entry_price * (1 - self.stop_loss_pct/100)
                take_profit = entry_price * (1 + self.take_profit_pct/100)
                
                signal = {
                    "timestamp": current.name.isoformat() if hasattr(current.name, 'isoformat') else str(current.name),
                    "action": "BUY",
                    "symbol": symbol,
                    "price": entry_price,
                    "order_type": "MARKET",
                    "stop_loss": stop_loss,
                    "take_profit": take_profit,
                    "trailing_stop_percent": self.trailing_stop_pct,
                    "position_sizing": {
                        "type": self.position_sizing_type,
                        "value": self.position_sizing_value
                    },
                    "metadata": {
                        "indicator_values": {
                            "macd": current['macd'],
                            "macd_signal": current['macd_signal'],
                            "macd_hist": current['macd_hist']
                        }
                    }
                }
                signals.append(signal)
                
            elif macd_cross_below:
                # For existing positions, generate EXIT signal
                signal = {
                    "timestamp": current.name.isoformat() if hasattr(current.name, 'isoformat') else str(current.name),
                    "action": "EXIT",
                    "symbol": symbol,
                    "price": current['Close'],
                    "order_type": "MARKET",
                    "metadata": {
                        "indicator_values": {
                            "macd": current['macd'],
                            "macd_signal": current['macd_signal'],
                            "macd_hist": current['macd_hist']
                        }
                    }
                }
                signals.append(signal)
        
        return signals
    
    def format_output(self, signals):
        """Format the strategy output for the backtesting engine"""
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

## Backtesting Execution

To backtest your strategy, you'll use the backtesting engine in our platform:

```javascript
// Client-side code to execute a backtest
const backtest = await fetch('/api/backtest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    strategyId: 123,  // ID of your saved strategy
    parameters: {
      // Strategy parameters to override defaults
      fast_length: 12,
      slow_length: 26,
      signal_length: 9,
      stop_loss_pct: 5.0,
      risk_per_trade_pct: 1.0
    },
    symbols: ['AAPL', 'MSFT', 'GOOG'],  // Symbols to backtest on
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    initialCapital: 100000,
    commission: {
      type: 'per_trade',
      value: 0.00
    },
    slippage: {
      type: 'percentage',
      value: 0.001  // 0.1% slippage
    }
  })
});

const results = await backtest.json();
```

## Analyzing Backtest Results

The backtesting engine provides comprehensive results:

```javascript
// Sample backtest results structure
{
  "summary": {
    "totalReturn": 15.7,            // Percentage
    "annualizedReturn": 12.5,       // Percentage
    "maxDrawdown": -8.3,            // Percentage
    "sharpeRatio": 1.2,
    "sortinoRatio": 1.5,
    "winRate": 65.2,                // Percentage
    "profitFactor": 2.1,
    "averageWin": 3.2,              // Percentage
    "averageLoss": -1.5,            // Percentage
    "numberOfTrades": 48,
    "profitableTrades": 31,
    "unprofitableTrades": 17
  },
  "equity": [
    // Daily equity values
    { "timestamp": "2024-01-01", "equity": 100000 },
    { "timestamp": "2024-01-02", "equity": 100450 },
    // ...
  ],
  "trades": [
    {
      "symbol": "AAPL",
      "entryTime": "2024-01-05T10:30:00",
      "entryPrice": 180.25,
      "exitTime": "2024-01-10T14:15:00",
      "exitPrice": 185.50,
      "quantity": 100,
      "side": "LONG",
      "pnl": 525.00,
      "pnlPercent": 2.91,
      "exitReason": "SIGNAL"  // SIGNAL, STOP_LOSS, TAKE_PROFIT, TRAILING_STOP
    },
    // ...
  ],
  "drawdowns": [
    {
      "startDate": "2024-02-01",
      "endDate": "2024-02-15",
      "recoveryDate": "2024-03-01",
      "depthPercent": -8.3,
      "lengthDays": 14,
      "recoveryDays": 14
    },
    // ...
  ]
}
```

## Optimization

The platform supports strategy parameter optimization:

```javascript
// Client-side code to run optimization
const optimization = await fetch('/api/optimize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    strategyId: 123,  // ID of your saved strategy
    parameterRanges: {
      fast_length: [8, 10, 12, 14, 16],
      slow_length: [20, 24, 26, 28, 32],
      signal_length: [7, 8, 9, 10, 11]
    },
    optimizationTarget: 'SHARPE_RATIO',  // TOTAL_RETURN, SHARPE_RATIO, SORTINO_RATIO, etc.
    symbols: ['AAPL'],
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    initialCapital: 100000
  })
});

const optimizationResults = await optimization.json();
```

## Best Practices for Backtesting

1. **Avoid Lookahead Bias**: Ensure your strategy only uses data available at the point of decision
2. **Account for Realistic Execution**: Include slippage and commission in your analysis
3. **Test Multiple Market Conditions**: Backtest over different time periods and market regimes
4. **Use Realistic Position Sizing**: Implement proper risk management
5. **Account for Survivorship Bias**: Test on a realistic universe of stocks, not just current winners
6. **Out-of-Sample Testing**: Hold back some data for validation after optimization
7. **Walk-Forward Analysis**: Use rolling backtests to verify robustness
8. **Benchmark Comparison**: Compare results to relevant benchmarks (e.g., S&P 500)

## Common Pitfalls to Avoid

1. **Data Snooping**: Don't repeatedly optimize until you get good results on the same dataset
2. **Overfitting**: Too many parameters can lead to strategies that work in backtest but fail in live trading
3. **Ignoring Transaction Costs**: Always include realistic slippage and commission
4. **Ignoring Liquidity**: Consider whether the strategy would work with your capital in real markets
5. **Unrealistic Assumptions**: Be conservative in your execution assumptions
6. **Cherry-Picking Time Periods**: Test across full market cycles
7. **Ignoring Practical Constraints**: Account for position limits, margin requirements, etc.

---

By following these guidelines, your trading strategy will be compatible with our backtesting engine, allowing for thorough evaluation before deployment to live trading.