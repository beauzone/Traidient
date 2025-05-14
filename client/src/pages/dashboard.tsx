import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import MainLayout from "@/components/layout/MainLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import AssetAllocation from "@/components/dashboard/AssetAllocation";
import PositionsTable from "@/components/dashboard/PositionsTable";
import StrategyTable from "@/components/dashboard/StrategyTable";
import WatchlistTable from "@/components/dashboard/WatchlistTable";
import { useToast } from "@/hooks/use-toast";
import { useAccountContext } from "@/context/AccountContext";

interface Strategy {
  id: number;
  name: string;
  createdAt: string;
  type: 'AI-Generated' | 'Template' | 'Custom';
  assets: string[];
  profitLoss: {
    value: string;
    percentage: string;
    isPositive: boolean;
  };
  winRate: number;
  status: 'Running' | 'Paused' | 'Inactive' | 'Error';
}

const Dashboard = () => {
  const { toast } = useToast();
  const { selectedAccount } = useAccountContext();
  
  // Fetch strategies
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  // Fetch account data from Alpaca
  const { data: accountData, isLoading: isLoadingAccount } = useQuery({
    queryKey: ['/api/trading/account', selectedAccount],
    queryFn: () => fetchData('/api/trading/account'),
  });

  // Fetch positions from Alpaca
  const { data: positions = [], isLoading: isLoadingPositions } = useQuery({
    queryKey: ['/api/trading/positions', selectedAccount],
    queryFn: () => {
      const endpoint = selectedAccount && selectedAccount !== "all" 
        ? `/api/trading/positions?accountId=${selectedAccount}` 
        : '/api/trading/positions';
      return fetchData(endpoint);
    },
  });

  // Fetch orders from Alpaca
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/trading/orders', selectedAccount],
    queryFn: () => {
      const endpoint = selectedAccount && selectedAccount !== "all" 
        ? `/api/trading/orders?accountId=${selectedAccount}` 
        : '/api/trading/orders';
      return fetchData(endpoint);
    },
  });

  // State for managing the portfolio time range
  const [portfolioTimeRange, setPortfolioTimeRange] = useState<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('1W');

  // Set timeframe based on selected time range
  const getTimeframeForRange = (range: string) => {
    switch(range) {
      case '1D': return '1Min';
      case '1W': return '1H';
      case '1M': return '1D';
      case '1Y': return '1D';
      case 'ALL': return '1D';
      default: return '1D';
    }
  };

  // Set period based on selected time range
  const getPeriodForRange = (range: string) => {
    switch(range) {
      case '1D': return '1D';
      case '1W': return '1W';
      case '1M': return '1M';
      case '1Y': return '1Y';
      case 'ALL': return 'ALL';
      default: return '1M';
    }
  };

  // Portfolio history data from Alpaca API
  const { data: portfolioHistoryData, isLoading: isLoadingPortfolioHistory } = useQuery({
    queryKey: ['/api/trading/portfolio/history', selectedAccount, portfolioTimeRange],
    queryFn: async () => {
      const period = getPeriodForRange(portfolioTimeRange);
      const timeframe = getTimeframeForRange(portfolioTimeRange);
      
      const endpoint = selectedAccount && selectedAccount !== "all" 
        ? `/api/trading/portfolio/history?accountId=${selectedAccount}&period=${period}&timeframe=${timeframe}` 
        : `/api/trading/portfolio/history?period=${period}&timeframe=${timeframe}`;
      
      return fetchData(endpoint);
    },
  });

  // Convert portfolio history data to chart format
  const [portfolioData, setPortfolioData] = useState<{date: string, value: number}[]>([]);

  // Update portfolio data when API data changes
  useEffect(() => {
    // Skip if no portfolio history data is available
    if (!portfolioHistoryData || !portfolioHistoryData.timestamp || !portfolioHistoryData.equity) {
      return;
    }

    try {
      // Debug log the raw API data to investigate the drops in the graph
      console.log("DEBUG: Raw portfolio history data:", {
        period: portfolioHistoryData.period,
        timeframe: portfolioHistoryData.timeframe,
        dataSource: portfolioHistoryData.dataSource,
        dataPoints: portfolioHistoryData.timestamp.length,
        timestamps: portfolioHistoryData.timestamp,
        equityValues: portfolioHistoryData.equity
      });
      
      // Map API data to chart format
      const data = portfolioHistoryData.timestamp.map((timestamp: string, index: number) => ({
        // Keep the full timestamp to preserve time information for 1D view
        date: timestamp,
        value: portfolioHistoryData.equity[index],
      }));
      
      setPortfolioData(data);
    } catch (err) {
      console.error("Error processing portfolio history data:", err);
    }
  }, [portfolioHistoryData]);

  // Define position type
  interface Position {
    symbol: string;
    marketValue: number;
  }

  // Define order type
  interface Order {
    createdAt: string;
  }

  // Calculate asset allocation based on actual positions
  const [assetAllocationData, setAssetAllocationData] = useState<{name: string, value: number, color: string}[]>([
    { name: "Cash", value: 100, color: "#EF4444" },
  ]);
  
  // Filter positions based on selected account
  const filteredPositions = useMemo(() => {
    console.log("Positions received:", positions);
    console.log("Selected account:", selectedAccount);
    
    if (!positions || positions.length === 0) {
      console.log("No positions found, returning empty array");
      return [];
    }
    
    // If using all accounts, return all positions
    if (selectedAccount === "all") {
      console.log("All accounts selected, returning all positions:", positions);
      return positions;
    }
    
    // For the "Nancy" account (id: 11), which is 100% cash, return empty positions
    if (selectedAccount === "11") {
      console.log("Nancy account selected, which is 100% cash - returning empty positions array");
      return [];
    }
    
    // For the "Beau" account (id: 12), which has XOM, return the positions
    if (selectedAccount === "12") {
      console.log("Beau account selected, returning positions:", positions);
      return positions;
    }
    
    // Default fallback - should not reach here
    console.log("Unknown account", selectedAccount, "selected, defaulting to empty positions");
    return [];
  }, [positions, selectedAccount]);
  
  // Calculate and update asset allocation data
  useEffect(() => {
    console.log("Calculating asset allocation with:", { 
      filteredPositions, 
      selectedAccount, 
      accountData: accountData ? `${accountData.length} accounts` : "none" 
    });
    
    // Default to all cash if no data
    if ((!filteredPositions || filteredPositions.length === 0) && (!accountData || !Array.isArray(accountData))) {
      console.log("No positions or account data, defaulting to 100% cash");
      setAssetAllocationData([{ name: "Cash", value: 100, color: "#EF4444" }]);
      return;
    }
    
    // Create a new key for each re-render to ensure React updates the chart
    const renderKey = new Date().getTime();
    
    // Group positions by asset type/symbol
    const assetGroups = new Map<string, number>();
    let totalInvested = 0;
    
    // Add positions to the asset allocation
    filteredPositions.forEach((position: Position) => {
      const value = position.marketValue;
      totalInvested += value;
      
      if (assetGroups.has(position.symbol)) {
        assetGroups.set(position.symbol, assetGroups.get(position.symbol)! + value);
      } else {
        assetGroups.set(position.symbol, value);
      }
    });
    
    // Get total portfolio value and cash balance for the selected account(s)
    let cashValue = 0;
    let portfolioValue = 0;
    
    if (Array.isArray(accountData) && accountData.length > 0) {
      if (selectedAccount === "all") {
        // Sum values across all accounts
        portfolioValue = accountData.reduce((sum, acc) => sum + (acc.portfolioValue || 0), 0);
        cashValue = accountData.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      } else {
        // Find the specific account
        const account = accountData.find((acc) => acc.id.toString() === selectedAccount);
        
        if (account) {
          portfolioValue = account.portfolioValue || 0;
          cashValue = account.balance || 0;
        } else if (accountData.length > 0) {
          // Fallback to first account
          portfolioValue = accountData[0].portfolioValue || 0;
          cashValue = accountData[0].balance || 0;
        }
      }
    }
    
    console.log("Account values:", { portfolioValue, cashValue, totalInvested });
    
    // Calculate cash as the remaining amount in the portfolio 
    // (this assumes portfolio value = invested value + cash)
    if (portfolioValue > 0) {
      cashValue = portfolioValue - totalInvested;
      if (cashValue < 0) cashValue = 0; // Ensure no negative cash
    }
    
    // Add cash to the asset groups
    if (cashValue > 0) {
      assetGroups.set("Cash", cashValue);
    }
    
    // Calculate total portfolio value (invested + cash)
    const totalEquity = totalInvested + cashValue;
    
    console.log("Asset allocation values:", { 
      totalEquity, 
      cashValue, 
      assetGroups: Object.fromEntries(assetGroups) 
    });
    
    // Define the asset class categories and their fixed colors
    const assetClassColors = {
      "Cash": "#EF4444",    // Red
      "Stocks": "#3B82F6",  // Blue
      "Crypto": "#10B981"   // Green
    };
    
    // Group by asset class instead of individual securities
    const assetClassGroups = new Map<string, number>();
    
    // Set initial cash value
    assetClassGroups.set("Cash", cashValue);
    
    // Group all non-cash assets as "Stocks" for now
    // In the future, we can detect crypto assets and group them separately
    let stocksValue = 0;
    let cryptoValue = 0;
    
    Array.from(assetGroups.entries()).forEach(([name, value]) => {
      if (name !== "Cash") {
        // In the future, add logic to detect crypto vs. stocks
        // For now, all non-cash assets are considered stocks
        stocksValue += value;
      }
    });
    
    // Add the stock assets to the asset class groups if there are any
    if (stocksValue > 0) {
      assetClassGroups.set("Stocks", stocksValue);
    }
    
    // Add crypto assets to the asset class groups if there are any (future feature)
    if (cryptoValue > 0) {
      assetClassGroups.set("Crypto", cryptoValue);
    }
    
    // Convert to percentage values for the pie chart
    const result = Array.from(assetClassGroups.entries())
      .map(([name, value]) => {
        const absValue = Math.abs(value);
        const percentage = totalEquity > 0 ? Math.round((absValue / totalEquity) * 100) : 0;
        
        return {
          name,
          value: percentage,
          color: assetClassColors[name as keyof typeof assetClassColors],
          // Store the original market value for sorting
          originalValue: absValue
        };
      })
      .filter(item => item.value > 0) // Filter zero values
      .sort((a, b) => b.originalValue - a.originalValue);
    
    console.log("Final asset allocation data (by asset class):", result);
    
    // If there's no data, show 100% cash
    if (result.length === 0) {
      result.push({ name: "Cash", value: 100, color: assetClassColors["Cash"], originalValue: 100 });
    }
    
    // Update the asset allocation data
    setAssetAllocationData(result);
  }, [filteredPositions, accountData, selectedAccount]);

  // Strategy actions
  const handlePauseStrategy = (id: number) => {
    toast({
      title: "Strategy paused",
      description: "The strategy has been paused successfully.",
    });
  };

  const handlePlayStrategy = (id: number) => {
    toast({
      title: "Strategy activated",
      description: "The strategy is now running.",
    });
  };

  const handleEditStrategy = (id: number) => {
    toast({
      title: "Edit strategy",
      description: "Redirecting to edit strategy page.",
    });
  };

  const handleDeleteStrategy = (id: number) => {
    toast({
      title: "Strategy deleted",
      description: "The strategy has been deleted successfully.",
      variant: "destructive",
    });
  };

  // Format currency for display - without cents
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value));
  };
  
  // Calculate real P&L data from Alpaca account
  const calculatePnL = () => {
    if (!accountData || accountData.length === 0) {
      return {
        value: "+$0.00",
        percentage: "0.00%",
        isPositive: true
      };
    }
    
    // Get the selected account data or aggregate all accounts
    let selectedAccountData: any;
    let performanceValue = 0;
    
    if (selectedAccount === "all") {
      // Calculate aggregated P&L across all accounts
      const totalEquity = accountData.reduce((sum: number, acc: any) => sum + (acc.equity || 0), 0);
      const totalPerformance = accountData.reduce((sum: number, acc: any) => sum + (acc.performance || 0), 0);
      
      selectedAccountData = {
        equity: totalEquity
      };
      performanceValue = totalPerformance;
    } else {
      // Find the specific account
      selectedAccountData = accountData.find((acc: any) => acc.id.toString() === selectedAccount);
      
      // If account not found, use the first account as fallback
      if (!selectedAccountData && accountData.length > 0) {
        selectedAccountData = accountData[0];
      }
      
      if (selectedAccountData) {
        performanceValue = selectedAccountData.performance || 0;
      }
    }
    
    if (!selectedAccountData) {
      return {
        value: "+$0.00",
        percentage: "0.00%",
        isPositive: true
      };
    }
    
    // Use the performance value which comes directly from Alpaca API
    const isPositive = performanceValue >= 0;
    
    // Calculate percentage against total equity
    const equity = selectedAccountData.equity || 0;
    const pnlPercentage = equity > 0 ? (performanceValue / equity) * 100 : 0;
    
    return {
      value: `${isPositive ? '+' : ''}${formatCurrency(performanceValue)}`,
      percentage: `${isPositive ? '+' : ''}${Math.abs(pnlPercentage).toFixed(2)}%`,
      isPositive
    };
  };
  
  const pnlData = calculatePnL();
  
  return (
    <MainLayout title="Dashboard">
      {isLoadingAccount ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <StatsCards
            activeStrategies={strategies.filter(s => s.status === 'Running').length}
            totalPnL={pnlData}
            todayTrades={orders.filter((o: Order) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length}
            alerts={0}
          />

          {/* Charts */}
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PortfolioChart
              data={portfolioData}
              currentValue={
                Array.isArray(accountData) 
                  ? (selectedAccount === "all"
                    ? formatCurrency(accountData.reduce((sum: number, acc: any) => sum + (acc.equity || acc.balance || 0), 0))
                    : formatCurrency(
                        accountData.find((acc: any) => acc.id.toString() === selectedAccount)?.equity || 
                        accountData.find((acc: any) => acc.id.toString() === selectedAccount)?.balance || 
                        (accountData.length > 0 ? accountData[0].equity || accountData[0].balance || 0 : 0)
                      )
                  )
                  : formatCurrency(0)
              }
              change={{
                value: pnlData.value,
                percentage: pnlData.percentage,
                isPositive: pnlData.isPositive
              }}
              onTimeRangeChange={setPortfolioTimeRange}
            />
            
            {/* Force remount of component when account changes */}
            <AssetAllocation 
              key={`asset-allocation-${selectedAccount}-${new Date().getTime()}`} 
              data={assetAllocationData} 
            />
          </div>

          {/* Portfolio Positions */}
          <PositionsTable 
            passedPositions={filteredPositions} 
            isLoading={isLoadingPositions}
          />
        </>
      )}
      
      {/* Strategy Performance */}
      <StrategyTable
        strategies={strategies}
        onPause={handlePauseStrategy}
        onPlay={handlePlayStrategy}
        onEdit={handleEditStrategy}
        onDelete={handleDeleteStrategy}
      />

      {/* Watchlist */}
      <WatchlistTable />
    </MainLayout>
  );
};

export default Dashboard;
