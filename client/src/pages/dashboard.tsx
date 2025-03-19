import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import MainLayout from "@/components/layout/MainLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import AssetAllocation from "@/components/dashboard/AssetAllocation";
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
    queryKey: ['/api/trading/account'],
    queryFn: () => fetchData('/api/trading/account'),
  });

  // Fetch positions from Alpaca
  const { data: positions = [], isLoading: isLoadingPositions } = useQuery({
    queryKey: ['/api/trading/positions'],
    queryFn: () => fetchData('/api/trading/positions'),
  });

  // Fetch orders from Alpaca
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/trading/orders'],
    queryFn: () => fetchData('/api/trading/orders'),
  });

  // Portfolio history data from account data
  // Use the account data to determine portfolio value
  const [portfolioData, setPortfolioData] = useState<{date: string, value: number}[]>([]);

  // Update portfolio data when account data changes
  useEffect(() => {
    if (!accountData) return;

    // Get the selected account data
    const selectedAccountData = selectedAccount === "all" 
      ? accountData 
      : accountData.find((acc: any) => acc.id.toString() === selectedAccount);
    
    if (!selectedAccountData) return;
    
    // Starting portfolio value - use equity if available, otherwise use balance
    const currentValue = selectedAccountData.equity || selectedAccountData.balance || 0;
    
    // Generate historical data (starting with stable value until we implement history API)
    const today = new Date();
    const data = [];
    
    // Use real account data for current value, simulate for history until we have history API
    for (let i = 90; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      
      const value = i === 0 
        ? currentValue // Current value is accurate
        : currentValue; // Use same value for historical (will be replaced with real data)
        
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100,
      });
    }
    
    setPortfolioData(data);
  }, [accountData, selectedAccount]);

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
  
  // Update asset allocation when positions change
  useEffect(() => {
    if ((!positions || positions.length === 0) && !accountData) {
      setAssetAllocationData([{ name: "Cash", value: 100, color: "#EF4444" }]);
      return;
    }
    
    // Group positions by asset type/symbol
    const assetGroups = new Map<string, number>();
    let totalEquity = 0;
    
    // Add positions
    positions.forEach((position: Position) => {
      const value = position.marketValue;
      totalEquity += value;
      
      if (assetGroups.has(position.symbol)) {
        assetGroups.set(position.symbol, assetGroups.get(position.symbol)! + value);
      } else {
        assetGroups.set(position.symbol, value);
      }
    });
    
    // Add cash
    const cashValue = accountData?.cash || 0;
    totalEquity += cashValue;
    assetGroups.set("Cash", cashValue);
    
    // Format for chart
    const colors = ["#3B82F6", "#6366F1", "#10B981", "#F59E0B", "#EF4444", 
                    "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#06B6D4"];
                    
    const result = Array.from(assetGroups.entries())
      .map(([name, value], index) => ({
        name,
        value: Math.round((value / totalEquity) * 100),
        color: colors[index % colors.length]
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
      
    setAssetAllocationData(result);
  }, [positions, accountData]);

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

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
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
    
    if (selectedAccount === "all") {
      // Calculate aggregated P&L across all accounts
      const totalEquity = accountData.reduce((sum, acc) => sum + (acc.equity || 0), 0);
      const totalLastEquity = accountData.reduce((sum, acc) => sum + (acc.lastEquity || acc.equity || 0), 0);
      
      selectedAccountData = {
        equity: totalEquity,
        lastEquity: totalLastEquity
      };
    } else {
      // Find the specific account
      selectedAccountData = accountData.find((acc: any) => acc.id.toString() === selectedAccount);
      
      // If account not found, use the first account as fallback
      if (!selectedAccountData && accountData.length > 0) {
        selectedAccountData = accountData[0];
      }
    }
    
    if (!selectedAccountData) {
      return {
        value: "+$0.00",
        percentage: "0.00%",
        isPositive: true
      };
    }
    
    // If lastEquity is missing, use equity for both to prevent NaN
    const pnlValue = (selectedAccountData.equity || 0) - (selectedAccountData.lastEquity || selectedAccountData.equity || 0);
    const pnlPercentage = selectedAccountData.lastEquity && selectedAccountData.lastEquity > 0 
      ? (pnlValue / selectedAccountData.lastEquity) * 100 
      : 0;
    const isPositive = pnlValue >= 0;
    
    return {
      value: `${isPositive ? '+' : ''}${formatCurrency(pnlValue)}`,
      percentage: `${isPositive ? '+' : ''}${pnlPercentage.toFixed(2)}%`,
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
              currentValue={formatCurrency(accountData?.equity || 0)}
              change={{
                value: pnlData.value,
                percentage: pnlData.percentage,
                isPositive: pnlData.isPositive
              }}
            />
            
            <AssetAllocation data={assetAllocationData} />
          </div>
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
