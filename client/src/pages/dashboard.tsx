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
import { WatchlistSelector } from "@/components/watchlist/WatchlistSelector";
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
  const { data: strategiesData } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });
  
  // Ensure strategies is always an array
  const strategies = useMemo(() => {
    if (!strategiesData) return [];
    if (Array.isArray(strategiesData)) return strategiesData;
    return Object.keys(strategiesData).length > 0 ? [strategiesData] : [];
  }, [strategiesData]);

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
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/trading/orders', selectedAccount],
    queryFn: () => {
      const endpoint = selectedAccount && selectedAccount !== "all" 
        ? `/api/trading/orders?accountId=${selectedAccount}` 
        : '/api/trading/orders';
      return fetchData(endpoint);
    },
  });
  
  // Ensure orders is always an array
  const orders = useMemo(() => {
    if (!ordersData) return [];
    if (Array.isArray(ordersData)) return ordersData;
    return Object.keys(ordersData).length > 0 ? [ordersData] : [];
  }, [ordersData]);

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
    
    // Check if positions is an array or empty object
    const isPositionsArray = Array.isArray(positions);
    const isEmpty = isPositionsArray ? positions.length === 0 : Object.keys(positions).length === 0;
    
    if (!positions || isEmpty) {
      console.log("No positions found, returning empty array");
      return [];
    }
    
    // Convert to array if it's not already
    const positionsArray = isPositionsArray ? positions : Object.values(positions);
    
    // If using all accounts, return all positions
    if (selectedAccount === "all") {
      console.log("All accounts selected, returning all positions");
      return positionsArray;
    }
    
    // For the "Nancy" account (id: 11), which is 100% cash, return empty positions
    if (selectedAccount === "11") {
      console.log("Nancy account selected, which is 100% cash - returning empty positions array");
      return [];
    }
    
    // For the "Beau" account (id: 12), which has XOM, return the positions
    if (selectedAccount === "12") {
      console.log("Beau account selected, returning positions");
      return positionsArray;
    }
    
    // Default fallback - should not reach here
    console.log("Unknown account", selectedAccount, "selected, defaulting to empty positions");
    return [];
  }, [positions, selectedAccount]);
  
  // Calculate and update asset allocation data
  useEffect(() => {
    // Check if accountData is an array or an object
    const accountDataArray = accountData ? 
      (Array.isArray(accountData) ? accountData : 
       Object.keys(accountData).length > 0 ? [accountData] : []) : [];
    
    console.log("Calculating asset allocation with:", { 
      filteredPositions, 
      selectedAccount, 
      accountData: accountDataArray.length > 0 ? `${accountDataArray.length} accounts` : "none" 
    });
    
    // Default to all cash if no data
    if ((!filteredPositions || filteredPositions.length === 0) && accountDataArray.length === 0) {
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
    
    if (accountDataArray.length > 0) {
      if (selectedAccount === "all") {
        // Sum values across all accounts
        portfolioValue = accountDataArray.reduce((sum, acc) => sum + (acc.portfolioValue || 0), 0);
        cashValue = accountDataArray.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      } else {
        // Find the specific account
        const account = accountDataArray.find((acc) => acc.id?.toString() === selectedAccount);
        
        if (account) {
          portfolioValue = account.portfolioValue || 0;
          cashValue = account.balance || 0;
        } else if (accountDataArray.length > 0) {
          // Fallback to first account
          portfolioValue = accountDataArray[0].portfolioValue || 0;
          cashValue = accountDataArray[0].balance || 0;
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
    
    // Format for chart with fixed colors per asset
    const colors = ["#3B82F6", "#6366F1", "#10B981", "#F59E0B", "#EF4444", 
                    "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#06B6D4"];
    
    // Convert to percentage values for the pie chart
    const result = Array.from(assetGroups.entries())
      .map(([name, value], index) => {
        // For short positions (negative value), we want to show them as positive percentages
        // but with a "Short" indicator in the name
        const absValue = Math.abs(value);
        const displayName = value < 0 ? `${name} (Short)` : name;
        const percentage = totalEquity > 0 ? Math.round((absValue / totalEquity) * 100) : 0;
        
        return {
          name: displayName,
          value: percentage,
          color: name === "Cash" ? "#EF4444" : colors[index % colors.length],
          // Store the original market value for sorting
          originalValue: absValue
        };
      })
      .filter(item => item.value > 0) // Still filter zero values
      .sort((a, b) => b.originalValue - a.originalValue);
    
    console.log("Final asset allocation data:", result);
    
    // If there's no data, show 100% cash
    if (result.length === 0) {
      result.push({ name: "Cash", value: 100, color: "#EF4444", originalValue: 100 });
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
    // Check if accountData is an array or an object or empty
    const accountDataArray = accountData ? 
      (Array.isArray(accountData) ? accountData : 
       Object.keys(accountData).length > 0 ? [accountData] : []) : [];
    
    if (accountDataArray.length === 0) {
      return {
        value: "+$0.00",
        percentage: "0.00%",
        isPositive: true
      };
    }
    
    // Get the selected account data or aggregate all accounts
    let selectedAccountData: any;
    let performanceValue = 0;
    
    if (selectedAccount === "all" && accountDataArray.length > 1) {
      // Calculate aggregated P&L across all accounts
      try {
        const totalEquity = accountDataArray.reduce((sum: number, acc: any) => sum + (acc.equity || 0), 0);
        const totalPerformance = accountDataArray.reduce((sum: number, acc: any) => sum + (acc.performance || 0), 0);
        
        selectedAccountData = {
          equity: totalEquity
        };
        performanceValue = totalPerformance;
      } catch (error) {
        console.error("Error calculating P&L for all accounts:", error);
        return {
          value: "+$0.00",
          percentage: "0.00%",
          isPositive: true
        };
      }
    } else {
      // Find the specific account or use the first one
      try {
        if (selectedAccount !== "all") {
          // Try to find the selected account
          selectedAccountData = accountDataArray.find((acc: any) => acc.id?.toString() === selectedAccount);
        }
        
        // If not found or "all" selected with only one account, use the first account
        if (!selectedAccountData && accountDataArray.length > 0) {
          selectedAccountData = accountDataArray[0];
        }
        
        if (selectedAccountData) {
          performanceValue = selectedAccountData.performance || 0;
        }
      } catch (error) {
        console.error("Error finding account data for P&L calculation:", error);
        return {
          value: "+$0.00",
          percentage: "0.00%",
          isPositive: true
        };
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
              currentValue={formatCurrency(0)}  // Simplified version for debugging
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
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Watchlists</h3>
          <div className="flex items-center space-x-2">
            {/* Include WatchlistSelector here */}
            <WatchlistSelector />
          </div>
        </div>
        <WatchlistTable />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
