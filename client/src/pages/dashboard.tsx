import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import MainLayout from "@/components/layout/MainLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import AssetAllocation from "@/components/dashboard/AssetAllocation";
import StrategyTable from "@/components/dashboard/StrategyTable";
import WatchlistTable from "@/components/dashboard/WatchlistTable";
import { useToast } from "@/hooks/use-toast";

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
  
  // Fetch strategies
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  // Sample data for charts - in a real app this would come from the API
  const [portfolioData] = useState([
    { date: "2023-01-01", value: 100000 },
    { date: "2023-01-15", value: 102500 },
    { date: "2023-02-01", value: 105000 },
    { date: "2023-02-15", value: 103000 },
    { date: "2023-03-01", value: 106000 },
    { date: "2023-03-15", value: 108000 },
    { date: "2023-04-01", value: 110000 },
    { date: "2023-04-15", value: 112000 },
    { date: "2023-05-01", value: 114000 },
    { date: "2023-05-15", value: 115500 },
    { date: "2023-06-01", value: 118000 },
    { date: "2023-06-15", value: 121000 },
    { date: "2023-07-01", value: 124500 },
  ]);

  const [assetAllocationData] = useState([
    { name: "Stocks", value: 45, color: "#3B82F6" },
    { name: "ETFs", value: 20, color: "#6366F1" },
    { name: "Bonds", value: 15, color: "#10B981" },
    { name: "Crypto", value: 10, color: "#F59E0B" },
    { name: "Cash", value: 10, color: "#EF4444" },
  ]);

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

  return (
    <MainLayout title="Dashboard">
      {/* Stats Cards */}
      <StatsCards
        activeStrategies={strategies.filter(s => s.status === 'Running').length}
        totalPnL={{
          value: "+$5,839.12",
          percentage: "8.34%",
          isPositive: true,
        }}
        todayTrades={24}
        alerts={2}
      />

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PortfolioChart
          data={portfolioData}
          currentValue="$124,394.48"
          change={{
            value: "$3,256.83",
            percentage: "2.7%",
            isPositive: true,
          }}
        />
        
        <AssetAllocation data={assetAllocationData} />
      </div>

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
