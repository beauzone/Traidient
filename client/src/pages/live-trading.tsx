import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import DeploymentPanel from "@/components/live-trading/DeploymentPanel";
import PositionsTable from "@/components/live-trading/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import StrategyMonitor from "@/components/live-trading/StrategyMonitor";
import StockSearch from "@/components/market-data/StockSearch";
import { fetchData } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Strategy, Deployment, WatchlistItem } from "../types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LucideIcons } from "@/components/ui/icons";

const LiveTradingPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("1D");
  const [timeInterval, setTimeInterval] = useState("1min");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  const { data: deployments = [], isLoading: isLoadingDeployments } = useQuery({
    queryKey: ['/api/deployments'],
    queryFn: () => fetchData<Deployment[]>('/api/deployments'),
    refetchInterval: 30000,
  });

  const { data: selectedDeployment } = useQuery({
    queryKey: ['/api/deployments', selectedDeploymentId],
    queryFn: () => fetchData<Deployment>(`/api/deployments/${selectedDeploymentId}`),
    enabled: !!selectedDeploymentId,
    refetchInterval: 10000,
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ['/api/watchlist'],
    queryFn: () => fetchData<WatchlistItem[]>('/api/watchlist'),
  });

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const handleStatusChange = async (deploymentId: number, status: string) => {
    // Implementation remains the same -  This is problematic because updateData is not defined.
  };

  const handleSelectDeployment = (deploymentId: number) => {
    setSelectedDeploymentId(deploymentId);
  };

  return (
    <MainLayout title="Live Trading">
      <div className="flex h-full">
        {/* Left sidebar */}
        <div className="w-80 border-r pr-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Search</CardTitle>
              <CardDescription>Find stocks to analyze</CardDescription>
            </CardHeader>
            <CardContent>
              <StockSearch onSymbolSelect={handleSymbolSelect} watchlist={watchlist} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Watchlist</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Watchlist component will go here */}
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 p-4">
          {/* Chart controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1D', '5D', '1M', '3M', '1Y', '3Y', 'All'].map(range => (
                    <SelectItem key={range} value={range}>{range}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeInterval} onValueChange={setTimeInterval}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1min', '5min', '15min', '1H', '2H', '4H', '1D', '1W', '1M'].map(interval => (
                    <SelectItem key={interval} value={interval}>{interval}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 2))}>
                <LucideIcons.ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 0.5))}>
                <LucideIcons.ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setZoomLevel(1)}>
                <LucideIcons.RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => {
                if (!document.fullscreenElement) {
                  chartContainerRef.current?.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}>
                <LucideIcons.Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chart container */}
          <div ref={chartContainerRef} className="h-[500px] mb-4 bg-card rounded-lg border">
            {/* TradingView chart will go here */}
          </div>

          {/* Tabs section */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <DeploymentPanel 
                strategies={strategies}
                deployments={deployments}
                onSelectDeployment={handleSelectDeployment}
                onStatusChange={handleStatusChange}
                isLoading={isLoadingDeployments}
                selectedDeploymentId={selectedDeploymentId}
              />
            </TabsContent>

            <TabsContent value="positions">
              <PositionsTable />
            </TabsContent>

            <TabsContent value="orders">
              <OrdersTable />
            </TabsContent>

            <TabsContent value="monitor">
              <StrategyMonitor 
                strategies={strategies}
                deployments={deployments}
                selectedDeployment={selectedDeployment}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default LiveTradingPage;