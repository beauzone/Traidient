import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { fetchData } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import StockSearch from "@/components/market-data/StockSearch";
import { Strategy, Deployment, WatchlistItem } from "../types";
import TradingViewChart from "@/components/market-data/TradingViewChart";

export default function LiveTrading() {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState("1D");
  const [timeInterval, setTimeInterval] = useState("1min");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [hideIndicators, setHideIndicators] = useState(true); // Added from original

  // Queries (from original)
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

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4 p-4">
        {/* Top Row */}
        <div className="flex gap-4">
          {/* Left Side - Stock Search */}
          <div className="w-64">
            <StockSearch />
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

            <Select value={timeInterval} onValueChange={setTimeInterval}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Interval" />
              </SelectTrigger>
              <SelectContent>
                {["1min", "5min", "15min", "1H", "2H", "4H", "1D", "1W", "1M"].map((interval) => (
                  <SelectItem key={interval} value={interval}>{interval}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={hideIndicators ? "hide" : "show"} // Modified to use hideIndicators state
              onValueChange={(val) => setHideIndicators(val === "hide")} // Added from original
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Indicators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hide">Hide All</SelectItem>
                <SelectItem value="sma20">SMA (20)</SelectItem>
                <SelectItem value="sma50">SMA (50)</SelectItem>
                <SelectItem value="sma150">SMA (150)</SelectItem>
                <SelectItem value="sma200">SMA (200)</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="resistance">Resistance</SelectItem>
                <SelectItem value="bollinger">Bollinger Bands (20)</SelectItem>
                <SelectItem value="rsi">RSI (14)</SelectItem>
                <SelectItem value="macd">MACD (12, 26, 9)</SelectItem>
              </SelectContent>
            </Select>
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
              symbol={selectedStock || 'AAPL'} 
              interval={timeInterval}
              theme="dark"
              autosize={true}
            />
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}