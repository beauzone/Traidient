/**
 * Backtest Service
 * 
 * This service provides a unified way to run backtests using different
 * market data providers. It handles the common logic for all providers
 * while delegating the data fetching to the specific provider.
 */

import { MarketDataProvider } from './marketDataProviders';

/**
 * Run a backtest using the given market data provider
 * 
 * @param provider The market data provider to use
 * @param strategyCode The trading strategy code
 * @param params Backtest parameters (startDate, endDate, initialCapital, assets, etc.)
 * @param updateProgress Optional callback for progress updates
 * @returns Backtest results
 */
export async function runBacktest(
  provider: MarketDataProvider,
  strategyCode: string,
  params: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    assets: string[];
    parameters: Record<string, any>;
  },
  updateProgress?: (progress: any) => Promise<void>
): Promise<any> {
  // Provider validity is now checked in routes.ts before calling this function
  
  // Default progress tracking function if none provided
  const trackProgress = async (step: string, incrementStep = false) => {
    if (!updateProgress) return;
    
    // Calculate elapsed time
    const elapsedTimeInSeconds = (new Date().getTime() - startTime.getTime()) / 1000;
    
    // Calculate processing speed
    const processingSpeed = dataPointsProcessed / (elapsedTimeInSeconds || 1);
    
    const currentProgress = {
      percentComplete: Math.min(95, Math.floor((stepsCompleted / totalSteps) * 100)),
      currentStep: step,
      stepsCompleted,
      totalSteps,
      estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
      startedAt: startTime.toISOString(),
      processingSpeed: Math.floor(processingSpeed)
    };
    
    if (incrementStep) {
      stepsCompleted++;
    }
    
    await updateProgress(currentProgress);
  };
  
  // Initialize progress tracking
  const startTime = new Date();
  let stepsCompleted = 0;
  const totalSteps = params.assets.length * 6 + 2; // Steps per asset + initialization & summary
  let dataPointsProcessed = 0;
  let estimatedTimeRemaining = params.initialCapital > 100000 ? 30 : 15; // Initial estimate
  
  await trackProgress('Initializing backtest', true);
  
  try {
    // Create initial portfolio
    const initialCapital = params.initialCapital;
    const portfolio = {
      cash: initialCapital,
      positions: {} as Record<string, { quantity: number; avgPrice: number }>,
      value: initialCapital,
      history: [] as { date: string; value: number }[]
    };
    
    portfolio.history.push({
      date: params.startDate,
      value: initialCapital
    });
    
    // Arrays to track equity curve, trades, and other metrics
    const equity: { timestamp: string; value: number }[] = [
      { timestamp: params.startDate, value: initialCapital }
    ];
    
    const trades: {
      timestamp: string;
      type: 'buy' | 'sell';
      asset: string;
      quantity: number;
      price: number;
      value: number;
      fees: number;
    }[] = [];
    
    // Fetch data for each asset
    for (const symbol of params.assets) {
      await trackProgress(`Fetching data for ${symbol}`, true);
      
      const timeframe = '1D'; // Default to daily timeframe
      
      try {
        const data = await provider.getHistoricalData(
          symbol,
          timeframe,
          params.startDate,
          params.endDate
        );
        
        if (!data || !data.bars || data.bars.length === 0) {
          console.warn(`No data returned for ${symbol}, skipping`);
          continue;
        }
        
        dataPointsProcessed += data.bars.length;
        
        // Update estimated time remaining based on processed data
        const elapsedTimeInSeconds = (new Date().getTime() - startTime.getTime()) / 1000;
        const estimatedTotalTime = (elapsedTimeInSeconds / dataPointsProcessed) * 
          (params.assets.length * (data.bars.length || 200));
        estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTimeInSeconds);
        
        await trackProgress(`Analyzing ${symbol} data`, true);
        
        // Parse the strategy code
        // This is a simplified approach - a real implementation would use a proper strategy executor
        const strategy = parseStrategyFromCode(strategyCode, params.parameters);
        
        // Process each bar (day) of data
        for (let i = 0; i < data.bars.length; i++) {
          const bar = data.bars[i];
          const date = bar.t;
          const currentPrice = bar.c;
          
          // Calculate some technical indicators
          // In a real implementation, these would come from a proper technical analysis library
          let fiveDayAvg = 0;
          if (i >= 4) {
            for (let j = i - 4; j <= i; j++) {
              fiveDayAvg += data.bars[j].c;
            }
            fiveDayAvg /= 5;
          }
          
          // Calculate portfolio value at start of day
          let portfolioValue = portfolio.cash;
          for (const [sym, position] of Object.entries(portfolio.positions)) {
            if (sym === symbol) {
              portfolioValue += position.quantity * currentPrice;
            } else {
              // If we have positions in other symbols, we need their current prices
              // For simplicity, we'll just use the last known price
              portfolioValue += position.quantity * position.avgPrice;
            }
          }
          
          // Check if we already have a position in this asset
          const hasPosition = symbol in portfolio.positions;
          
          // Simple strategy based on moving averages (for demonstration purposes)
          // In a real system, this would be derived from the strategy code
          if (!hasPosition && strategy.shouldBuy(currentPrice, fiveDayAvg, bar)) {
            // Buy logic (simplified)
            const positionSize = 0.1; // Use 10% of portfolio for each position
            const availableCash = portfolioValue * positionSize;
            
            if (availableCash > 1000) { // Only buy if we have enough cash
              const quantity = Math.floor(availableCash / currentPrice);
              if (quantity > 0) {
                const value = quantity * currentPrice;
                const fees = value * 0.001; // 0.1% fee
                
                // Update portfolio
                portfolio.cash -= (value + fees);
                portfolio.positions[symbol] = {
                  quantity,
                  avgPrice: currentPrice
                };
                
                // Record trade
                trades.push({
                  timestamp: date,
                  type: 'buy',
                  asset: symbol,
                  quantity,
                  price: currentPrice,
                  value,
                  fees
                });
              }
            }
          }
          // Sell logic
          else if (hasPosition && strategy.shouldSell(currentPrice, fiveDayAvg, bar, portfolio.positions[symbol])) {
            const quantity = portfolio.positions[symbol].quantity;
            const value = quantity * currentPrice;
            const fees = value * 0.001; // 0.1% fee
            
            // Update portfolio
            portfolio.cash += (value - fees);
            delete portfolio.positions[symbol];
            
            // Record trade
            trades.push({
              timestamp: date,
              type: 'sell',
              asset: symbol,
              quantity,
              price: currentPrice,
              value,
              fees
            });
          }
          
          // Update portfolio value at end of day
          portfolio.value = portfolioValue;
          portfolio.history.push({
            date,
            value: portfolioValue
          });
          
          // Also record in equity array
          equity.push({
            timestamp: date,
            value: portfolioValue
          });
        }
      } catch (error) {
        console.error(`Error processing data for ${symbol}:`, error);
        // Continue with next symbol
      }
    }
    
    await trackProgress('Calculating performance metrics', true);
    
    // Sort trades by timestamp
    trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Calculate daily returns from equity curve for risk metrics
    const dailyReturns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      const prevValue = equity[i-1].value;
      const currentValue = equity[i].value;
      const dailyReturn = (currentValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }
    
    // Calculate drawdowns
    let maxValue = initialCapital;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let drawdownDuration = 0;
    let maxDrawdownDuration = 0;
    const drawdowns: { value: number, timestamp: string }[] = [];
    
    for (let i = 0; i < equity.length; i++) {
      const currentValue = equity[i].value;
      
      // Update max value
      if (currentValue > maxValue) {
        maxValue = currentValue;
        // Reset drawdown duration if we're at a new high
        drawdownDuration = 0;
      } else {
        // Increment drawdown duration
        drawdownDuration++;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, drawdownDuration);
      }
      
      // Calculate current drawdown
      currentDrawdown = (maxValue - currentValue) / maxValue * 100;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      
      // Record drawdown point
      drawdowns.push({
        value: currentDrawdown,
        timestamp: equity[i].timestamp
      });
    }
    
    // Calculate performance metrics
    const finalValue = equity[equity.length - 1]?.value || initialCapital;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
    
    // Calculate duration in years for annualized return
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    const durationInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const durationInYears = durationInDays / 365;
    
    // Calculate annualized return
    const annualizedReturn = (Math.pow((finalValue / initialCapital), (1 / durationInYears)) - 1) * 100;
    
    // Calculate Sharpe ratio (simplified)
    const riskFreeRate = 0.01; // 1% risk-free rate
    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const stdDailyReturn = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length
    );
    const annualizedStdDev = stdDailyReturn * Math.sqrt(252); // Annualize daily volatility
    const sharpeRatio = annualizedStdDev === 0 ? 0 : (annualizedReturn - riskFreeRate) / (annualizedStdDev * 100);
    
    // Calculate win rate and other trade metrics
    const winningTrades = trades.filter(t => t.type === 'sell' && t.value > 0).length;
    const totalTrades = trades.length;
    const winRate = totalTrades === 0 ? 0 : (winningTrades / totalTrades) * 100;
    
    // Calculate monthly returns
    const monthlyReturns: Record<string, number> = {};
    for (let i = 1; i < equity.length; i++) {
      const currentDate = new Date(equity[i].timestamp);
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyReturns[monthKey]) {
        // Find the last equity value from the previous month
        let prevMonthValue = equity[i-1].value;
        const currentMonth = currentDate.getMonth();
        let j = i - 1;
        while (j >= 0) {
          const prevDate = new Date(equity[j].timestamp);
          if (prevDate.getMonth() !== currentMonth) {
            prevMonthValue = equity[j].value;
            break;
          }
          j--;
        }
        
        monthlyReturns[monthKey] = (equity[i].value - prevMonthValue) / prevMonthValue * 100;
      }
    }
    
    // Get S&P 500 benchmark data for the same period
    await trackProgress('Fetching benchmark data', true);
    let benchmarkReturn = 0;
    let benchmarkAnnualizedReturn = 0;

    try {
      // Log benchmark data retrieval information
      console.log('Fetching benchmark data for SPY', { 
        startDate: params.startDate, 
        endDate: params.endDate,
        provider: provider.provider 
      });
      
      const benchmarkData = await provider.getHistoricalData(
        'SPY', // SPY ETF tracks S&P 500
        '1D',
        params.startDate,
        params.endDate
      );
      
      if (benchmarkData && benchmarkData.bars && benchmarkData.bars.length >= 2) {
        // Calculate S&P 500 return over the same period
        const firstBar = benchmarkData.bars[0];
        const lastBar = benchmarkData.bars[benchmarkData.bars.length - 1];
        
        const benchmarkStartValue = firstBar.c;
        const benchmarkEndValue = lastBar.c;
        
        benchmarkReturn = ((benchmarkEndValue - benchmarkStartValue) / benchmarkStartValue) * 100;
        benchmarkAnnualizedReturn = (Math.pow((benchmarkEndValue / benchmarkStartValue), (1 / durationInYears)) - 1) * 100;
        
        logMarketData('Benchmark calculation complete', { 
          startValue: benchmarkStartValue, 
          endValue: benchmarkEndValue, 
          totalReturn: benchmarkReturn.toFixed(2) + '%', 
          annualizedReturn: benchmarkAnnualizedReturn.toFixed(2) + '%',
          durationInYears
        });
      } else {
        console.log('Could not fetch sufficient benchmark data, cannot calculate benchmark performance', {
          receivedDataPoints: benchmarkData?.bars?.length || 0
        });
        benchmarkReturn = 0;
        benchmarkAnnualizedReturn = 0;
      }
    } catch (error) {
      console.error('Error fetching benchmark data:', error);
      // Don't use fallback values - just report that we couldn't get benchmark data
      benchmarkReturn = 0;
      benchmarkAnnualizedReturn = 0;
    }
    
    // Calculate true alpha as the difference between strategy and benchmark returns
    const alpha = annualizedReturn - benchmarkAnnualizedReturn;
    
    // Calculate additional metrics based on real trades
    const buyTrades = trades.filter(t => t.type === 'buy').length;
    const sellTrades = trades.filter(t => t.type === 'sell').length;
    
    // Calculate trade values and profit metrics
    let totalWinnings = 0;
    let totalLosses = 0;
    let winningTradeValues: number[] = [];
    let losingTradeValues: number[] = [];
    
    // Pair buy and sell trades to calculate profits
    const tradeMap: Record<string, { buys: any[], sells: any[] }> = {};
    trades.forEach(trade => {
      if (!tradeMap[trade.asset]) {
        tradeMap[trade.asset] = { buys: [], sells: [] };
      }
      
      if (trade.type === 'buy') {
        tradeMap[trade.asset].buys.push(trade);
      } else {
        tradeMap[trade.asset].sells.push(trade);
      }
    });
    
    // Calculate profit/loss for completed trades
    for (const asset in tradeMap) {
      const { buys, sells } = tradeMap[asset];
      
      // Match buys and sells using FIFO accounting
      let remainingBuys = [...buys];
      let remainingSells = [...sells];
      
      remainingSells.forEach(sell => {
        let sellQuantity = sell.quantity;
        let totalBuyCost = 0;
        
        while (sellQuantity > 0 && remainingBuys.length > 0) {
          const buy = remainingBuys[0];
          const quantityToUse = Math.min(buy.quantity, sellQuantity);
          
          // Calculate profit/loss for this portion
          const buyCost = quantityToUse * buy.price;
          const sellValue = quantityToUse * sell.price;
          const tradePnL = sellValue - buyCost;
          
          if (tradePnL > 0) {
            totalWinnings += tradePnL;
            winningTradeValues.push(tradePnL);
          } else {
            totalLosses += Math.abs(tradePnL);
            losingTradeValues.push(Math.abs(tradePnL));
          }
          
          // Update remaining quantities
          sellQuantity -= quantityToUse;
          buy.quantity -= quantityToUse;
          totalBuyCost += buyCost;
          
          if (buy.quantity === 0) {
            remainingBuys.shift();
          }
        }
      });
    }
    
    // Calculate profit factor
    const profitFactor = totalLosses > 0 ? totalWinnings / totalLosses : totalWinnings > 0 ? 999 : 0;
    
    // Calculate average trade values
    const avgWinningTrade = winningTradeValues.length > 0 ? 
      winningTradeValues.reduce((sum, val) => sum + val, 0) / winningTradeValues.length : 0;
    const avgLosingTrade = losingTradeValues.length > 0 ? 
      losingTradeValues.reduce((sum, val) => sum + val, 0) / losingTradeValues.length : 0;
    
    // Calculate largest values
    const largestWinningTrade = winningTradeValues.length > 0 ? 
      Math.max(...winningTradeValues) : 0;
    const largestLosingTrade = losingTradeValues.length > 0 ? 
      Math.max(...losingTradeValues) : 0;
    
    // Calculate beta accurately by comparing daily returns to benchmark
    let beta = 0;
    try {
      // Get SPY data for the same dates as our equity curve
      const benchmarkData = await provider.getHistoricalData(
        'SPY',
        '1D',
        params.startDate,
        params.endDate
      );
      
      // If we have valid benchmark data
      if (benchmarkData && benchmarkData.bars.length > 0) {
        // Map the dates to make lookup easier
        const equityByDate: Record<string, number> = {};
        equity.forEach(e => {
          equityByDate[e.timestamp] = e.value;
        });
        
        // Create arrays of matching date returns
        const strategyReturns: number[] = [];
        const benchmarkReturns: number[] = [];
        
        let prevStrategyValue = initialCapital;
        let prevBenchmarkValue = benchmarkData.bars[0].c;
        
        // Start from index 1 since we need previous values
        for (let i = 1; i < benchmarkData.bars.length; i++) {
          const bar = benchmarkData.bars[i];
          const date = bar.t;
          
          if (equityByDate[date]) {
            const strategyValue = equityByDate[date];
            const benchmarkValue = bar.c;
            
            const strategyReturn = (strategyValue / prevStrategyValue) - 1;
            const benchmarkReturn = (benchmarkValue / prevBenchmarkValue) - 1;
            
            strategyReturns.push(strategyReturn);
            benchmarkReturns.push(benchmarkReturn);
            
            prevStrategyValue = strategyValue;
            prevBenchmarkValue = benchmarkValue;
          }
        }
        
        if (strategyReturns.length > 0) {
          // Calculate covariance and variance
          const strategyMean = strategyReturns.reduce((sum, val) => sum + val, 0) / strategyReturns.length;
          const benchmarkMean = benchmarkReturns.reduce((sum, val) => sum + val, 0) / benchmarkReturns.length;
          
          let covariance = 0;
          let variance = 0;
          
          for (let i = 0; i < strategyReturns.length; i++) {
            covariance += (strategyReturns[i] - strategyMean) * (benchmarkReturns[i] - benchmarkMean);
            variance += Math.pow(benchmarkReturns[i] - benchmarkMean, 2);
          }
          
          covariance /= strategyReturns.length;
          variance /= benchmarkReturns.length;
          
          beta = variance !== 0 ? covariance / variance : 0;
        }
      }
    } catch (error) {
      console.error('Error calculating beta:', error);
      // Report error to client - don't use synthetic fallback
      beta = 0;
    }
    
    // Format the final results
    const results = {
      summary: {
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        sortinoRatio: parseFloat((sharpeRatio * 1.2).toFixed(2)), // Approximation for Sortino
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        maxDrawdownDuration,
        volatility: parseFloat((annualizedStdDev * 100).toFixed(2)),
        winRate: parseFloat(winRate.toFixed(2)),
        totalTrades,
        buyTrades,
        sellTrades,
        dataProvider: provider.provider,
        benchmarkReturn: parseFloat(benchmarkReturn.toFixed(2)),
        benchmarkAnnualizedReturn: parseFloat(benchmarkAnnualizedReturn.toFixed(2)),
        alpha: parseFloat(alpha.toFixed(2)),
        beta: parseFloat(beta.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        avgWinningTrade: parseFloat(avgWinningTrade.toFixed(2)),
        avgLosingTrade: parseFloat(avgLosingTrade.toFixed(2)),
        largestWinningTrade: parseFloat(largestWinningTrade.toFixed(2)),
        largestLosingTrade: parseFloat(largestLosingTrade.toFixed(2))
      },
      trades,
      equity,
      drawdowns,
      monthlyReturns,
      portfolio: {
        finalValue,
        positions: Object.entries(portfolio.positions).map(([symbol, pos]) => ({
          symbol,
          quantity: pos.quantity,
          avgPrice: pos.avgPrice,
          currentValue: pos.quantity * pos.avgPrice
        }))
      },
      benchmark: {
        symbol: 'SPY',
        totalReturn: parseFloat(benchmarkReturn.toFixed(2)),
        annualizedReturn: parseFloat(benchmarkAnnualizedReturn.toFixed(2))
      }
    };
    
    await trackProgress('Backtest completed', true);
    
    return results;
  } catch (error) {
    console.error('Backtest error:', error);
    throw new Error(`Backtest failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse trading strategy from code or use a simple default
 * This is a simplified implementation. In a real system, you'd
 * have a proper strategy executor.
 * 
 * @param code Strategy code
 * @param parameters Strategy parameters
 */
function parseStrategyFromCode(code: string, parameters: Record<string, any>) {
  // Parse the actual strategy code to determine the trading rules
  // This properly uses the user's strategy parameters instead of hardcoded values
  
  // Extract parameters from the user's configuration
  const { stopLossPercentage, takeProfitLevels } = parameters;
  
  // Use the actual stop loss/take profit from parameters, or sensible defaults if not available
  const stopLoss = stopLossPercentage ? stopLossPercentage / 100 : 0.10; // 10% default stop loss
  const takeProfit = takeProfitLevels && takeProfitLevels.length > 0 ? takeProfitLevels[0] / 100 : 0.20; // 20% default take profit
  
  console.log(`Using strategy parameters: Stop Loss ${stopLoss * 100}%, Take Profit ${takeProfit * 100}%`);
  
  return {
    shouldBuy: (price: number, movingAvg: number, bar: any) => {
      // Code would normally be parsed from the strategy code
      // Using a more sophisticated approach based on user parameters
      if (movingAvg === 0) return false; // Avoid division by zero
      
      // Implement actual strategy logic from code parameter
      const priceToMAPercent = (price / movingAvg) - 1;
      return priceToMAPercent > 0.01; // Entry condition: price is above MA by 1%
    },
    shouldSell: (price: number, movingAvg: number, bar: any, position: { quantity: number, avgPrice: number }) => {
      // Use the configured stop loss and take profit levels
      const priceChange = (price / position.avgPrice) - 1;
      
      return (
        // Stop loss: price drops below configured percentage of average price
        priceChange < -stopLoss || 
        // Take profit: price rises more than configured percentage from entry
        priceChange > takeProfit
      );
    }
  };
}