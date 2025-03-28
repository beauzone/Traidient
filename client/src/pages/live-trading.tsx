import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { fetchData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import StockSearch from "@/components/market-data/StockSearch";
import PositionsTable from "@/components/dashboard/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import StrategyMonitor from "@/components/live-trading/StrategyMonitor";
import DeploymentPanel from "@/components/live-trading/DeploymentPanel";
import { Strategy, Deployment, WatchlistItem } from "../types";
import TradingViewChart from "@/components/market-data/TradingViewChart";

const LiveTradingPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>("AAPL");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState("1D");
  const [timeInterval, setTimeInterval] = useState("1min");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [hideIndicators, setHideIndicators] = useState(true);

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

  const { data: watchlist = [] } = useQuery({
    queryKey: ['/api/watchlist'],
    queryFn: () => fetchData<WatchlistItem[]>('/api/watchlist'),
  });

  // Find the selected deployment
  const selectedDeployment = deployments.find(d => d.id === selectedDeploymentId);

  // Handle select symbol
  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  // Handle select deployment
  const handleSelectDeployment = (deploymentId: number) => {
    setSelectedDeploymentId(deploymentId);
  };

  // Handle status change
  const handleStatusChange = (deploymentId: number, status: string) => {
    // Implementation to update status would be here
    console.log(`Updating deployment ${deploymentId} to status: ${status}`);
  };

  // Chart controls handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col h-full gap-4 p-4">
          {/* Top Row */}
          <div className="flex gap-4">
            {/* Left Side - Stock Search */}
            <div className="w-64">
              <StockSearch onSymbolSelect={handleSymbolSelect} watchlist={watchlist} />
            </div>

            {/* Right Side - Chart Controls */}
            <div className="flex gap-2 ml-auto items-center">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  {["1D", "5D", "1M", "3M", "1Y", "3Y", "All"].map((range) => (
                    <SelectItem key={range} value={range}>{range}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeInterval} onValueChange={setTimeInterval}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  {["1min", "5min", "15min", "30min", "1H", "1D"].map((interval) => (
                    <SelectItem key={interval} value={interval}>{interval}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-1 border rounded-md p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setHideIndicators(!hideIndicators)}
                >
                  Indicators
                </Button>

                {!hideIndicators && (
                  <Select
                    value={selectedIndicators[0] || ""}
                    onValueChange={(value) => setSelectedIndicators([value])}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["SMA", "EMA", "MACD", "RSI", "BB"].map((indicator) => (
                        <SelectItem key={indicator} value={indicator}>
                          {indicator}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <Card className="flex-grow relative min-h-[600px]" ref={chartContainerRef}>
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleZoomIn}
                className="bg-background/90 backdrop-blur-sm"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleZoomOut}
                className="bg-background/90 backdrop-blur-sm"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleResetZoom}
                className="bg-background/90 backdrop-blur-sm"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={toggleFullscreen}
                className="bg-background/90 backdrop-blur-sm"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <div 
              className="w-full h-full transition-transform duration-200 ease-in-out" 
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <TradingViewChart 
                symbol={selectedSymbol || 'AAPL'} 
                interval={timeInterval}
                theme="dark"
                autosize={true}
              />
            </div>
          </Card>
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
                
                <Card>
                  <CardHeader>
                    <CardTitle>Watchlist</CardTitle>
                    <CardDescription>Keep track of interesting stocks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {watchlist.length === 0 ? (
                      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                        No stocks in watchlist
                      </div>
                    ) : (
                      <div className="divide-y border rounded-md">
                        {watchlist.map((item) => (
                          <div 
                            key={item.id} 
                            className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleSymbolSelect(item.symbol)}
                          >
                            <div>
                              <div className="font-medium">{item.symbol}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">{item.name}</div>
                            </div>
                            <div className="text-right">
                              <div className={item.isPositive ? "text-green-500" : "text-negative"}>{item.lastPrice}</div>
                              <div className={`text-xs ${item.isPositive ? "text-green-500" : "text-negative"}`}>
                                {item.isPositive ? "+" : ""}{item.changePercent}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
      </div>
    </MainLayout>
  );
};

export default LiveTradingPage;