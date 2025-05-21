import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { fetchData } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import StockSearch from "@/components/market-data/StockSearch";
import { Strategy, Deployment, WatchlistItem } from "../types";
import TradingViewChart from "@/components/market-data/TradingViewChart";
import WatchlistTable from "@/components/live-trading/WatchlistTable";
import PositionsTable from "@/components/live-trading/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import StrategyMonitor from "@/components/live-trading/StrategyMonitor";
import { useLocation } from "wouter";

function LiveTrading() {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState("1D");
  const [timeInterval, setTimeInterval] = useState("1min");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [hideIndicators, setHideIndicators] = useState(true);
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [activeTab, setActiveTab] = useState("positions");
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | undefined>(undefined);
  const [, navigate] = useLocation();
  
  // Parse URL parameters on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const symbolParam = searchParams.get('symbol');
    const actionParam = searchParams.get('action');
    
    // Set the selected stock if symbol is provided in URL
    if (symbolParam) {
      setSelectedStock(symbolParam);
    }
    
    // If there's an action specified, set the active tab to positions
    if (actionParam) {
      setActiveTab("positions");
    }
  }, []);

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

  // Handle stock selection from various components
  const handleSelectStock = (symbol: string) => {
    // Navigate to the Quote page instead of updating selected stock
    navigate(`/quote?symbol=${symbol}`);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <MainLayout>
      <div className="flex h-full p-4 gap-4">
        {/* Left sidebar - Watchlist */}
        <div className="w-64 h-full">
          <WatchlistTable onSelectStock={handleSelectStock} />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Top Row - Controls and Search */}
          <div className="flex gap-4 items-center">
            {/* Stock Search */}
            <div className="w-64">
              <StockSearch onSelectStock={handleSelectStock} />
            </div>

            {/* Chart Controls */}
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
                  {["1min", "5min", "15min", "30min", "1H", "1D", "1W", "1M"].map((interval) => (
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
          <Card className="relative min-h-[450px]" ref={chartContainerRef}>
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
              className="w-full h-[450px] transition-transform duration-200 ease-in-out" 
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <TradingViewChart 
                symbol={selectedStock} 
                interval={timeInterval}
                theme="dark"
                autosize={true}
              />
            </div>
          </Card>

          {/* Tabs Section */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="strategy-monitor">Strategy Monitor</TabsTrigger>
            </TabsList>
            
            <TabsContent value="positions" className="flex-1">
              <PositionsTable onSymbolSelect={handleSelectStock} />
            </TabsContent>
            
            <TabsContent value="orders" className="flex-1">
              <OrdersTable />
            </TabsContent>
            
            <TabsContent value="strategy-monitor" className="flex-1">
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
}

export default LiveTrading;