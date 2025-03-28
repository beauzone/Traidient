import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { fetchData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import StockSearch from "@/components/market-data/StockSearch";
import PositionsTable from "@/components/live-trading/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import StrategyMonitor from "@/components/live-trading/StrategyMonitor";
import DeploymentPanel from "@/components/live-trading/DeploymentPanel";
import { Strategy, Deployment, WatchlistItem } from "../types";
import TradingViewChart from "@/components/market-data/TradingViewChart";

const LiveTradingPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>("CRWD");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState("");

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

  // Sample data for mockup illustration
  const sampleWatchlist = [
    { id: 1, symbol: "CRWD", name: "CrowdStrike Inc.", lastPrice: "$367.28", change: "-2.35", changePercent: "-0.64%", isPositive: false },
    { id: 2, symbol: "PANS", name: "Palo Alto Networks Inc.", lastPrice: "$286.75", change: "+3.40", changePercent: "+1.20%", isPositive: true },
    { id: 3, symbol: "META", name: "Meta Platforms Inc.", lastPrice: "$485.12", change: "+5.86", changePercent: "+1.22%", isPositive: true },
    { id: 4, symbol: "GOOG", name: "Alphabet Inc.", lastPrice: "$166.80", change: "-0.29", changePercent: "-0.17%", isPositive: false },
    { id: 5, symbol: "TSLA", name: "Tesla Inc.", lastPrice: "$173.80", change: "+2.54", changePercent: "+1.48%", isPositive: true },
    { id: 6, symbol: "AMZN", name: "Amazon.com Inc.", lastPrice: "$183.80", change: "+1.32", changePercent: "+0.72%", isPositive: true },
    { id: 7, symbol: "NFLX", name: "Netflix Inc.", lastPrice: "$612.44", change: "-4.12", changePercent: "-0.67%", isPositive: false },
    { id: 8, symbol: "PLTR", name: "Palantir Technologies Inc.", lastPrice: "$22.87", change: "+0.43", changePercent: "+1.92%", isPositive: true },
    { id: 9, symbol: "NET", name: "Cloudflare Inc.", lastPrice: "$93.76", change: "+2.11", changePercent: "+2.30%", isPositive: true },
    { id: 10, symbol: "MSFT", name: "Microsoft Corp.", lastPrice: "$416.38", change: "+0.85", changePercent: "+0.20%", isPositive: true },
    { id: 11, symbol: "NOW", name: "ServiceNow Inc.", lastPrice: "$744.29", change: "-3.22", changePercent: "-0.43%", isPositive: false },
    { id: 12, symbol: "CRM", name: "Salesforce Inc.", lastPrice: "$283.51", change: "+1.67", changePercent: "+0.59%", isPositive: true },
    { id: 13, symbol: "GLD", name: "SPDR Gold Trust", lastPrice: "$205.13", change: "+0.32", changePercent: "+0.16%", isPositive: true },
    { id: 14, symbol: "PATH", name: "UiPath Inc.", lastPrice: "$12.17", change: "-0.23", changePercent: "-1.85%", isPositive: false },
    { id: 15, symbol: "OKTA", name: "Okta Inc.", lastPrice: "$112.65", change: "+3.71", changePercent: "+3.40%", isPositive: true },
  ];

  // Filter the watchlist based on the search term
  const displayedWatchlist = searchValue.trim() === "" 
    ? sampleWatchlist 
    : sampleWatchlist.filter(item => 
        item.symbol.toLowerCase().includes(searchValue.toLowerCase()) || 
        item.name.toLowerCase().includes(searchValue.toLowerCase())
      );

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

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Live Trading</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage your active trading strategies</p>
        </div>

        {/* Main Content Area */}
        <div className="flex h-full gap-4">
          {/* Left Sidebar - Watchlist */}
          <div className="w-64 flex flex-col">
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search symbol..."
                  className="pl-9 h-9"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 border rounded-md bg-background">
              <div className="py-3 px-4 border-b border-border">
                <h2 className="text-base md:text-lg font-semibold">Watchlists</h2>
              </div>
              <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
                {displayedWatchlist.length === 0 ? (
                  <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                    No stocks found
                  </div>
                ) : (
                  <div>
                    {displayedWatchlist.map((item) => (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between p-3 px-4 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border last:border-0 ${selectedSymbol === item.symbol ? 'bg-muted/70' : ''}`}
                        onClick={() => handleSymbolSelect(item.symbol)}
                      >
                        <div className="flex flex-col">
                          <div className="font-medium">{item.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{item.name}</div>
                        </div>
                        <div className="text-right">
                          <div className={item.isPositive ? "text-green-500" : "text-red-500"}>{item.lastPrice}</div>
                          <div className={`text-xs ${item.isPositive ? "text-green-500" : "text-red-500"}`}>
                            {item.changePercent}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Chart Area */}
            <div 
              className="relative rounded-lg overflow-hidden bg-muted border border-border mb-4 w-full" 
              style={{ minHeight: '450px', height: 'calc(100vh - 450px)' }}
              ref={chartContainerRef}
            >
              <div className="w-full h-full">
                <TradingViewChart 
                  symbol={selectedSymbol || 'CRWD'} 
                  interval="D"
                  theme="dark"
                  autosize={true}
                  height="100%"
                />
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex-grow">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                <div className="border-b">
                  <TabsList className="bg-transparent h-10 w-full justify-start">
                    <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Overview</TabsTrigger>
                    <TabsTrigger value="positions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Positions</TabsTrigger>
                    <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Orders</TabsTrigger>
                    <TabsTrigger value="monitor" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Monitor</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview" className="h-full mt-0 pt-4 border-none">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Deployments</h3>
                      <p className="text-sm text-muted-foreground">Manage your live trading strategies</p>
                    </div>
                    <Button className="bg-blue-500 hover:bg-blue-600">
                      <Plus className="mr-2 h-4 w-4" />
                      Deploy Strategy
                    </Button>
                  </div>

                  {deployments.length > 0 ? (
                    <DeploymentPanel 
                      strategies={strategies}
                      deployments={deployments}
                      onSelectDeployment={handleSelectDeployment}
                      onStatusChange={handleStatusChange}
                      isLoading={isLoadingDeployments}
                      selectedDeploymentId={selectedDeploymentId}
                    />
                  ) : (
                    <div className="h-[200px] flex flex-col items-center justify-center border rounded-lg bg-muted/30">
                      <p className="text-muted-foreground mb-1">No active deployments found</p>
                      <p className="text-sm text-muted-foreground mb-4">Deploy a strategy to start trading</p>
                      <Badge className="text-xs bg-muted text-muted-foreground">0 active deployment(s)</Badge>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="positions" className="h-full mt-0 pt-4 border-none">
                  <PositionsTable onSymbolSelect={handleSymbolSelect} />
                </TabsContent>

                <TabsContent value="orders" className="h-full mt-0 pt-4 border-none">
                  <OrdersTable />
                </TabsContent>

                <TabsContent value="monitor" className="h-full mt-0 pt-4 border-none">
                  {selectedDeployment ? (
                    <StrategyMonitor 
                      strategies={strategies}
                      deployments={deployments}
                      selectedDeployment={selectedDeployment}
                    />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center border rounded-lg bg-muted/30">
                      <p className="text-muted-foreground">Select a deployment to monitor</p>
                    </div>
                  )}
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