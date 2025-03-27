import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import DeploymentPanel from "@/components/live-trading/DeploymentPanel";
import PositionsTable from "@/components/live-trading/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import StrategyMonitor from "@/components/live-trading/StrategyMonitor";
import StockSearch from "@/components/market-data/StockSearch";
import { fetchData, updateData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Strategy, Deployment } from "../types";

interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  lastPrice: string;
  change: string;
  changePercent: string;
  volume: string;
  marketCap: string;
  isPositive: boolean;
}

const LiveTradingPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Fetch strategies
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  // Fetch active deployments
  const { data: deployments = [], isLoading: isLoadingDeployments } = useQuery({
    queryKey: ['/api/deployments'],
    queryFn: () => fetchData<Deployment[]>('/api/deployments'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch selected deployment details
  const { data: selectedDeployment } = useQuery({
    queryKey: ['/api/deployments', selectedDeploymentId],
    queryFn: () => fetchData<Deployment>(`/api/deployments/${selectedDeploymentId}`),
    enabled: !!selectedDeploymentId,
    refetchInterval: 10000, // Refresh every 10 seconds when a deployment is selected
  });

  // Fetch watchlist data
  const { data: watchlist = [] } = useQuery({
    queryKey: ['/api/watchlist'],
    queryFn: () => fetchData<WatchlistItem[]>('/api/watchlist'),
  });

  // Update deployment status mutation
  const updateDeploymentStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      updateData(`/api/deployments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments'] });
      toast({
        title: "Status updated",
        description: "Deployment status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });

  // Handle deployment selection
  const handleSelectDeployment = (deploymentId: number) => {
    setSelectedDeploymentId(deploymentId);
  };

  // Handle status change
  const handleStatusChange = (deploymentId: number, newStatus: string) => {
    updateDeploymentStatus.mutate({ id: deploymentId, status: newStatus });
  };

  // Handle symbol selection
  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Could add additional handling here, like automatically opening a trade dialog
  };

  return (
    <MainLayout title="Live Trading">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Trading</h1>
          <p className="text-muted-foreground">
            Monitor and manage your active trading strategies
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left sidebar with search and watchlist */}
          <div className="md:col-span-1">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Search</CardTitle>
                  <CardDescription>Find assets to analyze</CardDescription>
                </CardHeader>
                <CardContent>
                  <StockSearch onSymbolSelect={handleSymbolSelect} watchlist={watchlist} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main content area */}
          <div className="md:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="positions">Positions</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="monitor">Monitor</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <DeploymentPanel 
                  strategies={strategies}
                  deployments={deployments}
                  onSelectDeployment={handleSelectDeployment}
                  onStatusChange={handleStatusChange}
                  isLoading={isLoadingDeployments}
                  selectedDeploymentId={selectedDeploymentId}
                />
              </TabsContent>

              <TabsContent value="positions" className="space-y-6">
                <PositionsTable />
              </TabsContent>

              <TabsContent value="orders" className="space-y-6">
                <OrdersTable />
              </TabsContent>

              <TabsContent value="monitor" className="space-y-6">
                <StrategyMonitor 
                  strategies={strategies}
                  deployments={deployments}
                  selectedDeployment={selectedDeployment}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LiveTradingPage;
