import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Treemap
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Clock, Database, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { fetchData } from "@/lib/api";
import { useMarketData } from "@/hooks/useMarketData";

// Custom Treemap content component for heatmap view - Finviz exact style
const CustomizedContent = (props: any) => {
  // Make sure we have valid props
  if (!props) return null;
  
  const { x, y, width, height, name, performance, value, root } = props;
  
  // Default values for all required properties to ensure no errors
  const xPos = x || 0;
  const yPos = y || 0;
  const cellWidth = width || 100;
  const cellHeight = height || 100;
  
  // Calculate gradient color based on performance
  const getColorByPerformance = (perf: number) => {
    // Fallback if root data is missing
    if (!root || !root.children) return perf >= 0 ? '#21c44c' : '#FF3B5C';
    
    // Safely get performances
    const allPerformances = root.children
      .filter((child: any) => child && typeof child.performance === 'number')
      .map((child: any) => child.performance);
    
    if (perf >= 0) {
      // For positive values - use exact Finviz colors
      const maxPositive = allPerformances.length > 0
        ? Math.max(...allPerformances.filter((p: number) => p >= 0), 1)
        : 1;
      const intensity = Math.max(0.4, Math.min(1, perf / maxPositive));
      // More saturated green for Finviz look
      return `rgb(${Math.round(33 * intensity)}, ${Math.round(196 * intensity)}, ${Math.round(76 * intensity)})`;
    } else {
      // For negative values
      const minNegative = allPerformances.length > 0
        ? Math.min(...allPerformances.filter((p: number) => p < 0), -1)
        : -1;
      const intensity = Math.max(0.4, Math.min(1, perf / minNegative));
      return `rgb(${Math.round(255 * intensity)}, ${Math.round(59 * intensity)}, ${Math.round(92 * intensity)})`;
    }
  };

  // Safely format performance value - Finviz always shows + prefix
  const formatPerformance = (perf: any): string => {
    if (perf == null || isNaN(parseFloat(perf))) return '0.00%';
    const perfNum = parseFloat(perf);
    return `${perfNum >= 0 ? '+' : ''}${perfNum.toFixed(2)}%`;
  };
  
  // Finviz uses abbreviations for longer names and uppercase for tickers
  const getDisplayName = (fullName: string): string => {
    if (!fullName) return '';
    
    // For sector names, keep as is, for tickers convert to uppercase
    return fullName.length > 5 ? fullName : fullName.toUpperCase();
  };
  
  // Get display name with proper formatting
  const displayName = getDisplayName(typeof name === 'string' ? name : '');
  
  // Color calculation with safety check - using Finviz greens
  const fillColor = typeof performance === 'number' 
    ? getColorByPerformance(performance) 
    : '#21c44c';
  
  // Exact Finviz text style with minimal shadow
  const textStyle = {
    textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
  };
  
  // Calculate position based on cell size like Finviz
  const getTextPosition = (cellSize: number) => {
    // For large cells (like MSFT in your screenshot)
    if (cellSize > 120) return { nameSize: 40, perfSize: 22, nameY: -20, perfY: 25 };
    // For medium cells (like ORCL in your screenshot)
    if (cellSize > 70) return { nameSize: 24, perfSize: 16, nameY: -12, perfY: 18 };
    // For smaller cells (like PLTR in your screenshot)
    return { nameSize: 14, perfSize: 12, nameY: -8, perfY: 12 };
  };
  
  // Get appropriate text sizes based on cell dimensions
  const minDimension = Math.min(cellWidth, cellHeight);
  const textPositions = getTextPosition(minDimension);
  
  return (
    <g>
      {/* Main colored rectangle - Finviz uses very thin/subtle borders */}
      <rect
        x={xPos}
        y={yPos}
        width={cellWidth}
        height={cellHeight}
        style={{
          fill: fillColor,
          stroke: '#0a0a0a',
          strokeWidth: 0.5,
        }}
      />
      
      {/* Only render text labels if there's enough space */}
      {minDimension > 30 && (
        <>
          {/* Ticker/sector name - large white text */}
          <text
            x={xPos + cellWidth / 2}
            y={yPos + cellHeight / 2 + textPositions.nameY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={textPositions.nameSize}
            fill="#FFFFFF"
            style={textStyle}
          >
            {displayName}
          </text>
          
          {/* Performance percentage */}
          <text
            x={xPos + cellWidth / 2}
            y={yPos + cellHeight / 2 + textPositions.perfY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={textPositions.perfSize}
            fill="#FFFFFF"
            style={textStyle}
          >
            {formatPerformance(performance)}
          </text>
        </>
      )}
      
      {/* For tiny cells, just show simple text if possible */}
      {minDimension <= 30 && minDimension > 15 && (
        <text
          x={xPos + cellWidth / 2}
          y={yPos + cellHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="#FFFFFF"
          style={textStyle}
        >
          {displayName}
        </text>
      )}
    </g>
  );
};

interface MarketOverviewProps {
  onSymbolSelect: (symbol: string) => void;
}

interface MarketIndiceData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface SectorPerformanceData {
  name: string;
  performance: number;
  color: string;
}

const MarketOverview = ({ onSymbolSelect }: MarketOverviewProps) => {
  // Use market data hook to get market status
  const { marketStatus } = useMarketData();
  
  // State for sorting gainers and losers
  const [gainersSort, setGainersSort] = useState<{
    column: keyof MarketMover;
    direction: 'asc' | 'desc';
  }>({
    column: 'changePercent',
    direction: 'desc'
  });
  
  const [losersSort, setLosersSort] = useState<{
    column: keyof MarketMover;
    direction: 'asc' | 'desc';
  }>({
    column: 'changePercent',
    direction: 'asc'
  });
  // Fetch market indices data
  const { data: indices, isLoading: isLoadingIndices } = useQuery({
    queryKey: ['/api/market-data/indices'],
    queryFn: () => fetchData<MarketIndiceData[]>('/api/market-data/indices').catch(() => {
      // Fallback data in case API isn't implemented yet
      return [
        { name: "S&P 500", symbol: "SPY", price: 4783.45, change: 32.45, changePercent: 0.68 },
        { name: "Dow Jones", symbol: "DIA", price: 38762.32, change: -28.67, changePercent: -0.07 },
        { name: "Nasdaq", symbol: "QQQ", price: 16748.7, change: 98.36, changePercent: 0.59 },
        { name: "Russell 2000", symbol: "IWM", price: 2032.48, change: 15.23, changePercent: 0.75 }
      ];
    }),
  });

  // Fetch sector performance data
  const { 
    data: sectorPerformance, 
    isLoading: isLoadingSectors,
    dataUpdatedAt: sectorsUpdatedAt
  } = useQuery({
    queryKey: ['/api/market-data/sectors'],
    queryFn: () => fetchData<SectorPerformanceData[]>('/api/market-data/sectors').catch(() => {
      // Fallback data in case API isn't implemented yet
      return [
        { name: "Technology", performance: 1.2, color: "#3B82F6" },
        { name: "Healthcare", performance: 0.8, color: "#10B981" },
        { name: "Energy", performance: -0.5, color: "#EF4444" },
        { name: "Financials", performance: 0.3, color: "#6366F1" },
        { name: "Consumer Cyclical", performance: 0.1, color: "#F59E0B" },
        { name: "Real Estate", performance: -0.7, color: "#EC4899" },
        { name: "Utilities", performance: 0.4, color: "#8B5CF6" },
        { name: "Basic Materials", performance: -0.2, color: "#14B8A6" },
        { name: "Communication Services", performance: 0.6, color: "#F97316" },
        { name: "Industrials", performance: 0.5, color: "#64748B" }
      ];
    }),
  });

  // Type definition for market mover data
  interface MarketMover {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    dataSource?: string;
  }

  // Fetch market movers data with error handling and refresh every 5 minutes
  const { 
    data: topGainers = [], 
    isLoading: isLoadingGainers, 
    error: gainersError,
    dataUpdatedAt: gainersUpdatedAt
  } = useQuery({
    queryKey: ['/api/market-data/gainers'],
    queryFn: () => fetchData<MarketMover[]>('/api/market-data/gainers'),
    retry: 1,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (in milliseconds)
    staleTime: 5 * 60 * 1000 // Consider data fresh for 5 minutes
  });

  const { 
    data: topLosers = [], 
    isLoading: isLoadingLosers, 
    error: losersError,
    dataUpdatedAt: losersUpdatedAt
  } = useQuery({
    queryKey: ['/api/market-data/losers'],
    queryFn: () => fetchData<MarketMover[]>('/api/market-data/losers'),
    retry: 1,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (in milliseconds)
    staleTime: 5 * 60 * 1000 // Consider data fresh for 5 minutes
  });

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };
  
  // Function to handle column sorting for gainers
  const handleGainersSort = (column: keyof MarketMover) => {
    setGainersSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };
  
  // Function to handle column sorting for losers
  const handleLosersSort = (column: keyof MarketMover) => {
    setLosersSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };
  
  // Function to get sorted data
  const getSortedData = (data: MarketMover[], sort: { column: keyof MarketMover, direction: 'asc' | 'desc' }) => {
    return [...data].sort((a, b) => {
      const aValue = a[sort.column];
      const bValue = b[sort.column];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sort.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sort.direction === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  };
  
  // Get sorted gainers and losers
  const sortedGainers = getSortedData(topGainers, gainersSort);
  const sortedLosers = getSortedData(topLosers, losersSort);
  
  // Function to render sort indicator
  const renderSortIndicator = (column: keyof MarketMover, currentSort: { column: keyof MarketMover, direction: 'asc' | 'desc' }) => {
    if (column !== currentSort.column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    }
    
    return currentSort.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 inline text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 inline text-primary" />;
  };

  return (
    <div className="space-y-6">
      
      {/* Market Indices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingIndices ? (
          <div className="col-span-full flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          indices?.map((index) => (
            <Card key={index.symbol} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{index.name}</h3>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(index.price)}</p>
                  </div>
                  <div className={`flex items-center ${index.changePercent >= 0 ? 'text-green-500' : 'text-negative'}`}>
                    {index.changePercent >= 0 ? (
                      <TrendingUp className="h-5 w-5 mr-1" />
                    ) : (
                      <TrendingDown className="h-5 w-5 mr-1" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{formatCurrency(index.change)}</div>
                      <div className="text-xs">{formatPercentage(index.changePercent)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Sector Performance */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium uppercase">1 DAY PERFORMANCE</h3>
            <div className="text-xs text-muted-foreground">
              {sectorsUpdatedAt ? `Last updated: ${new Date(sectorsUpdatedAt).toLocaleTimeString()}` : ''}
            </div>
          </div>
          
          <Tabs defaultValue="bar">
            <TabsList className="mb-4 w-full grid grid-cols-3">
              <TabsTrigger value="bar">Bar Chart</TabsTrigger>
              <TabsTrigger value="heatmap">Heat Map</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
            
            {isLoadingSectors ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Bar Chart View */}
                <TabsContent value="bar">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={
                          Array.isArray(sectorPerformance) 
                            ? [...sectorPerformance].sort((a, b) => b.performance - a.performance) 
                            : []
                        }
                        layout="vertical"
                        margin={{ top: 5, right: 50, left: 240, bottom: 5 }}
                        barSize={12}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} horizontal={false} />
                        <XAxis 
                          type="number" 
                          tickFormatter={(value) => `${value}%`} 
                          domain={[
                            (dataMin: number) => Math.floor(Math.min(dataMin, -1)), 
                            (dataMax: number) => Math.ceil(Math.max(dataMax + 1, 5))
                          ]}
                          tick={{ fontSize: 12, fill: '#94a3b8' }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          tick={{ fontSize: 12, fill: '#e2e8f0', fontWeight: 500 }}
                          width={220}
                        />
                        <Bar 
                          dataKey="performance" 
                          radius={[0, 4, 4, 0]}
                          label={{
                            position: 'right',
                            formatter: (value: number) => `+${value.toFixed(2)}`,
                            fill: '#e2e8f0',
                            fontSize: 12,
                            offset: 5,
                            content: (props: any) => {
                              const { x, y, width, height, value } = props;
                              const valueDisplay = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
                              return (
                                <text x={x + width + 5} y={y + height / 2} fill="#e2e8f0" fontSize={12} textAnchor="start" dominantBaseline="middle">
                                  {valueDisplay}
                                </text>
                              );
                            }
                          }}
                        >
                          {(Array.isArray(sectorPerformance) ? sectorPerformance : []).map((entry, index, array) => {
                            // For positive values (green)
                            if (entry.performance >= 0) {
                              // Find the max positive performance to create a gradient scale
                              const maxPositive = Math.max(...array.filter(item => item.performance >= 0).map(item => item.performance), 1);
                              // Calculate intensity - higher percentage = more intense color
                              const intensity = Math.max(0.3, Math.min(1, entry.performance / maxPositive));
                              // Generate color from light green to vivid green
                              return (
                                <Cell 
                                  key={`cell-${index}`}
                                  // Use rgb format to easily adjust the intensity
                                  fill={`rgb(${Math.round(74 * intensity)}, ${Math.round(222 * intensity)}, ${Math.round(128 * intensity)})`} 
                                />
                              );
                            } 
                            // For negative values (red)
                            else {
                              // Find the min negative performance to create a gradient scale
                              const minNegative = Math.min(...array.filter(item => item.performance < 0).map(item => item.performance), -1);
                              // Calculate intensity - more negative = more intense color
                              const intensity = Math.max(0.4, Math.min(1, entry.performance / minNegative));
                              // Generate color from light red to vivid red
                              return (
                                <Cell 
                                  key={`cell-${index}`}
                                  // Use rgb format to easily adjust the intensity
                                  fill={`rgb(${Math.round(255 * intensity)}, ${Math.round(59 * intensity)}, ${Math.round(92 * intensity)})`} 
                                />
                              );
                            }
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                {/* Heat Map View */}
                <TabsContent value="heatmap">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={Array.isArray(sectorPerformance) ? sectorPerformance.map(sector => ({
                          ...sector,
                          // Use absolute value for sizing but keep original value for coloring
                          value: Math.abs(sector.performance),
                          performance: sector.performance
                        })) : []}
                        dataKey="value"
                        aspectRatio={1}
                        stroke="#1E293B"
                        fill="#1E293B"
                        content={<CustomizedContent />}
                      />
                    </ResponsiveContainer>
                    <div className="flex justify-center mt-2">
                      <div className="w-full max-w-md flex">
                        <div className="h-2 flex-1 bg-[#FF3B5C]"></div>
                        <div className="h-2 flex-1 bg-[#4ADE80]"></div>
                      </div>
                      <div className="flex text-xs text-muted-foreground justify-between w-full max-w-md px-2 -mt-1">
                        <span>Negative</span>
                        <span>0%</span>
                        <span>Positive</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Table View */}
                <TabsContent value="table">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Sector</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Performance</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(sectorPerformance) && 
                          [...sectorPerformance]
                            .sort((a, b) => b.performance - a.performance)
                            .map((sector, index, array) => {
                              // Calculate gradient colors
                              let textColor = "";
                              let dotColor = "";
                              
                              if (sector.performance >= 0) {
                                const maxPositive = Math.max(...array.filter(item => item.performance >= 0).map(item => item.performance), 1);
                                const intensity = Math.max(0.3, Math.min(1, sector.performance / maxPositive));
                                const textIntensity = Math.max(0.6, Math.min(1, sector.performance / maxPositive));
                                
                                dotColor = `rgb(${Math.round(74 * intensity)}, ${Math.round(222 * intensity)}, ${Math.round(128 * intensity)})`;
                                textColor = `rgb(${Math.round(74 * textIntensity)}, ${Math.round(222 * textIntensity)}, ${Math.round(128 * textIntensity)})`;
                              } else {
                                const minNegative = Math.min(...array.filter(item => item.performance < 0).map(item => item.performance), -1);
                                const intensity = Math.max(0.4, Math.min(1, sector.performance / minNegative));
                                const textIntensity = Math.max(0.7, Math.min(1, sector.performance / minNegative));
                                
                                dotColor = `rgb(${Math.round(255 * intensity)}, ${Math.round(59 * intensity)}, ${Math.round(92 * intensity)})`;
                                textColor = `rgb(${Math.round(255 * textIntensity)}, ${Math.round(59 * textIntensity)}, ${Math.round(92 * textIntensity)})`;
                              }
                              
                              const status = sector.performance >= 3 ? 'Strong Outperform' : 
                                         sector.performance >= 1 ? 'Outperform' :
                                         sector.performance >= 0 ? 'Neutral' :
                                         sector.performance >= -1 ? 'Underperform' : 
                                         'Strong Underperform';
                                         
                              return (
                                <tr 
                                  key={sector.name} 
                                  className="border-b border-border hover:bg-muted/50"
                                >
                                  <td className="py-3 px-4 font-medium">{sector.name}</td>
                                  <td className="py-3 px-4 text-right" style={{ color: textColor }}>
                                    {sector.performance.toFixed(2)}%
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center">
                                      <div 
                                        className="w-3 h-3 rounded-full mr-2" 
                                        style={{ backgroundColor: dotColor }}
                                      ></div>
                                      <span>{status}</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                        }
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Market Movers */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Market Movers</h3>
            <div className="text-xs text-muted-foreground">
              Auto-updates every 5 minutes
            </div>
          </div>
          <Tabs defaultValue="gainers">
            <TabsList className="mb-4">
              <TabsTrigger value="gainers">Top Gainers</TabsTrigger>
              <TabsTrigger value="losers">Top Losers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="gainers">
              {isLoadingGainers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : gainersError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-negative mb-2">Unable to fetch top gainers</div>
                  <div className="text-sm text-muted-foreground">Market data service may be temporarily unavailable</div>
                </div>
              ) : topGainers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-muted-foreground mb-2">No top gainers available</div>
                  <div className="text-sm text-muted-foreground">Check back during market hours for live updates</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th 
                            className="text-left py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleGainersSort('symbol')}
                          >
                            <span className="flex items-center">
                              Symbol
                              {renderSortIndicator('symbol', gainersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-left py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleGainersSort('name')}
                          >
                            <span className="flex items-center">
                              Name
                              {renderSortIndicator('name', gainersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-right py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleGainersSort('price')}
                          >
                            <span className="flex items-center justify-end">
                              Price
                              {renderSortIndicator('price', gainersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-right py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleGainersSort('change')}
                          >
                            <span className="flex items-center justify-end">
                              Change
                              {renderSortIndicator('change', gainersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-right py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleGainersSort('changePercent')}
                          >
                            <span className="flex items-center justify-end">
                              % Change
                              {renderSortIndicator('changePercent', gainersSort)}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedGainers.map((stock) => (
                          <tr 
                            key={stock.symbol} 
                            className="border-b border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => onSymbolSelect(stock.symbol)}
                          >
                            <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                            <td className="py-3 px-4">{stock.name}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(stock.price)}</td>
                            <td className="py-3 px-4 text-right text-green-500">{formatCurrency(stock.change)}</td>
                            <td className="py-3 px-4 text-right text-green-500">{formatPercentage(stock.changePercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-2 px-4 text-xs text-muted-foreground">
                      <div>Data Source: {topGainers[0]?.dataSource || 'Yahoo Finance'}</div>
                      <div>Last Updated: {gainersUpdatedAt ? new Date(gainersUpdatedAt).toLocaleTimeString() : 'Just now'}</div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="losers">
              {isLoadingLosers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : losersError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-negative mb-2">Unable to fetch top losers</div>
                  <div className="text-sm text-muted-foreground">Market data service may be temporarily unavailable</div>
                </div>
              ) : topLosers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-muted-foreground mb-2">No top losers available</div>
                  <div className="text-sm text-muted-foreground">Check back during market hours for live updates</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th 
                            className="text-left py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleLosersSort('symbol')}
                          >
                            <span className="flex items-center">
                              Symbol
                              {renderSortIndicator('symbol', losersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-left py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleLosersSort('name')}
                          >
                            <span className="flex items-center">
                              Name
                              {renderSortIndicator('name', losersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-right py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleLosersSort('price')}
                          >
                            <span className="flex items-center justify-end">
                              Price
                              {renderSortIndicator('price', losersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-right py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleLosersSort('change')}
                          >
                            <span className="flex items-center justify-end">
                              Change
                              {renderSortIndicator('change', losersSort)}
                            </span>
                          </th>
                          <th 
                            className="text-right py-2 px-4 text-sm font-medium text-muted-foreground cursor-pointer"
                            onClick={() => handleLosersSort('changePercent')}
                          >
                            <span className="flex items-center justify-end">
                              % Change
                              {renderSortIndicator('changePercent', losersSort)}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLosers.map((stock) => (
                          <tr 
                            key={stock.symbol} 
                            className="border-b border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => onSymbolSelect(stock.symbol)}
                          >
                            <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                            <td className="py-3 px-4">{stock.name}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(stock.price)}</td>
                            <td className="py-3 px-4 text-right text-negative">{formatCurrency(stock.change)}</td>
                            <td className="py-3 px-4 text-right text-negative">{formatPercentage(stock.changePercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-2 px-4 text-xs text-muted-foreground">
                      <div>Data Source: {topLosers[0]?.dataSource || 'Yahoo Finance'}</div>
                      <div>Last Updated: {losersUpdatedAt ? new Date(losersUpdatedAt).toLocaleTimeString() : 'Just now'}</div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketOverview;
