import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { fetchData } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import StockSearch from "@/components/market-data/StockSearch"; //Import from original
import { Strategy, Deployment, WatchlistItem } from "../types"; //Import from original

const LiveTradingPage = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState("1D");
  const [selectedInterval, setSelectedInterval] = useState("1min");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [hideIndicators, setHideIndicators] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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


  // Chart control handlers
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
    <MainLayout title="Live Trading">
      <div className="flex flex-col h-full gap-4">
        {/* Stock Search */}
        <div className="w-64">
          <StockSearch /> {/*Maintained from original */}
        </div>

        {/* Chart Controls */}
        <div className="flex gap-4 items-center">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              {["1D", "5D", "1M", "3M", "1Y", "3Y", "All"].map(range => (
                <SelectItem key={range} value={range}>{range}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedInterval} onValueChange={setSelectedInterval}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Interval" />
            </SelectTrigger>
            <SelectContent>
              {["1min", "5min", "15min", "1H", "2H", "4H", "1D", "1W", "1M"].map(interval => (
                <SelectItem key={interval} value={interval}>{interval}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={hideIndicators ? "hide" : "show"}
            onValueChange={(val) => setHideIndicators(val === "hide")}
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
              <SelectItem value="bollinger">Bollinger (20)</SelectItem>
              <SelectItem value="rsi">RSI (14)</SelectItem>
              <SelectItem value="macd">MACD (12,26,9)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleResetZoom}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chart Container */}
        <Card className="flex-grow" ref={chartContainerRef}>
          <CardContent className="p-0 h-full">
            <div className="h-full" style={{ transform: `scale(${zoomLevel})` }}>
              {/* TradingView chart will be integrated here */}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default LiveTradingPage;