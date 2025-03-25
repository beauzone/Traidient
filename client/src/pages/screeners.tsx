import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/MainLayout";
import { Link } from "wouter";
import * as React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Binoculars, 
  Filter, 
  PlusCircle, 
  Code,
  ArrowRight,
  MoreVertical,
  Play,
  Pencil,
  Copy,
  Trash,
  Loader2,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Screener {
  id: number;
  name: string;
  description: string;
  type: 'python' | 'javascript';
  status: 'active' | 'inactive' | 'error';
  userId: number;
  source: {
    type: 'code' | 'natural-language';
    content: string;
  };
  configuration: {
    assets: string[];
    parameters: Record<string, any>;
  };
  results?: {
    matches: string[];
    details?: Record<string, any>;
    lastRun: string;
    executionTime: number;
    error?: string;
  };
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

import { BarChart3, Download, LineChart, PieChart, Save, Search, SlidersHorizontal, SortAsc, SortDesc, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart as RechartLineChart,
  Line,
  PieChart as RechartPieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from "recharts";

const ResultsDialog = ({ 
  screener, 
  onRun,
  isRunning 
}: { 
  screener: Screener; 
  onRun: (id: number) => void;
  isRunning: boolean;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("symbol");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [savedResults, setSavedResults] = useState<Array<{date: string, matches: string[]}>>([]);
  const [selectedChartField, setSelectedChartField] = useState<string>("");
  
  // Get available numerical fields for charts - memoized value
  const numericalFields = React.useMemo(() => {
    if (!screener.results?.details || !screener.results.matches || screener.results.matches.length === 0) {
      return [];
    }
    
    const firstSymbol = screener.results.matches[0];
    const details = screener.results.details[firstSymbol] || {};
    
    return Object.entries(details)
      .filter(([key, value]) => 
        key !== 'close' && 
        key !== 'price' && 
        typeof value === 'number'
      )
      .map(([key]) => key);
  }, [screener.results]);
  
  // Initialize the selected chart field when fields change
  useEffect(() => {
    if (numericalFields.length > 0 && !selectedChartField) {
      setSelectedChartField(numericalFields[0]);
    }
  }, [numericalFields, selectedChartField]);
  
  // Generate price distribution data for bar chart
  const getPriceDistributionData = () => {
    if (!screener.results?.details || !screener.results.matches || screener.results.matches.length === 0) {
      return [];
    }
    
    // Get all prices
    const prices = filteredMatches.map(symbol => 
      Number(screener.results?.details?.[symbol]?.close || 
             screener.results?.details?.[symbol]?.price || 0)
    ).filter(price => !isNaN(price) && price > 0);
    
    // Find min and max prices
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Create 10 price ranges
    const rangeSize = (maxPrice - minPrice) / 10;
    const ranges = Array.from({ length: 10 }, (_, i) => ({
      min: minPrice + i * rangeSize,
      max: minPrice + (i + 1) * rangeSize,
      range: `$${(minPrice + i * rangeSize).toFixed(0)} - $${(minPrice + (i + 1) * rangeSize).toFixed(0)}`,
      count: 0
    }));
    
    // Count stocks in each range
    prices.forEach(price => {
      const rangeIndex = Math.min(Math.floor((price - minPrice) / rangeSize), 9);
      if (rangeIndex >= 0 && rangeIndex < 10) {
        ranges[rangeIndex].count++;
      }
    });
    
    return ranges;
  };
  
  // Generate indicator distribution data for line chart
  const getIndicatorDistributionData = () => {
    if (!selectedChartField || !screener.results?.details || filteredMatches.length === 0) {
      return [];
    }
    
    // Get values for the selected indicator, filter out any non-numeric values
    const data = filteredMatches
      .map(symbol => {
        const value = screener.results?.details?.[symbol]?.[selectedChartField];
        return { 
          symbol,
          value: typeof value === 'number' ? value : null
        };
      })
      .filter(item => item.value !== null)
      // Sort by value for better visualization
      .sort((a, b) => a.value! - b.value!);
    
    return data;
  };
  
  // Generate sector breakdown data for pie chart
  const getSectorBreakdownData = () => {
    // This is a simple mock implementation - in a real app, you would get sector data from an API
    // For now, we'll just create random sector distribution
    const sectors = ['Technology', 'Healthcare', 'Consumer Cyclical', 'Financial Services', 'Communication Services'];
    
    // Create a distribution
    let remaining = filteredMatches.length;
    const data = sectors.map((name, index) => {
      // Last sector gets all remaining stocks
      if (index === sectors.length - 1) {
        return { name, value: remaining };
      }
      
      const value = Math.max(1, Math.floor(Math.random() * Math.min(remaining, filteredMatches.length / 3)));
      remaining -= value;
      return { name, value };
    }).filter(item => item.value > 0);
    
    return data;
  };
  
  // Chart colors
  const getChartColors = () => {
    return [
      '#6366F1', // Indigo
      '#8B5CF6', // Violet
      '#EC4899', // Pink
      '#F43F5E', // Rose
      '#F97316', // Orange
      '#EAB308', // Yellow
      '#22C55E', // Green
      '#06B6D4', // Cyan
      '#3B82F6', // Blue
      '#A855F7'  // Purple
    ];
  };
  
  // Get average price
  const getAveragePrice = () => {
    if (!screener.results?.details || filteredMatches.length === 0) {
      return 0;
    }
    
    const prices = filteredMatches.map(symbol => 
      Number(screener.results?.details?.[symbol]?.close || 
             screener.results?.details?.[symbol]?.price || 0)
    ).filter(price => !isNaN(price) && price > 0);
    
    if (prices.length === 0) return 0;
    
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  };
  
  // Get min price
  const getMinPrice = () => {
    if (!screener.results?.details || filteredMatches.length === 0) {
      return 0;
    }
    
    const prices = filteredMatches.map(symbol => 
      Number(screener.results?.details?.[symbol]?.close || 
             screener.results?.details?.[symbol]?.price || 0)
    ).filter(price => !isNaN(price) && price > 0);
    
    if (prices.length === 0) return 0;
    
    return Math.min(...prices);
  };
  
  // Get max price
  const getMaxPrice = () => {
    if (!screener.results?.details || filteredMatches.length === 0) {
      return 0;
    }
    
    const prices = filteredMatches.map(symbol => 
      Number(screener.results?.details?.[symbol]?.close || 
             screener.results?.details?.[symbol]?.price || 0)
    ).filter(price => !isNaN(price) && price > 0);
    
    if (prices.length === 0) return 0;
    
    return Math.max(...prices);
  };
  
  // Get indicator statistics
  const getIndicatorStats = () => {
    if (!selectedChartField || !screener.results?.details || filteredMatches.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }
    
    const values = filteredMatches
      .map(symbol => Number(screener.results?.details?.[symbol]?.[selectedChartField] || 0))
      .filter(value => !isNaN(value));
    
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    return { min, max, avg };
  };
  
  // Get available sort fields from the first result if available
  const getSortFields = () => {
    if (!screener.results?.details || !screener.results.matches || screener.results.matches.length === 0) {
      return ["symbol"];
    }
    
    const firstSymbol = screener.results.matches[0];
    const details = screener.results.details[firstSymbol] || {};
    
    return ["symbol", "price", ...Object.keys(details).filter(key => key !== "close" && key !== "price")];
  };
  
  // Filter and sort the matches based on search query and sort settings
  const getFilteredAndSortedMatches = () => {
    if (!screener.results?.matches) return [];
    
    // Filter by search query
    let filteredMatches = screener.results.matches.filter(symbol => 
      symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Sort results
    if (sortField === "symbol") {
      filteredMatches.sort((a, b) => {
        return sortDirection === "asc" ? a.localeCompare(b) : b.localeCompare(a);
      });
    } else if (sortField === "price") {
      filteredMatches.sort((a, b) => {
        const priceA = screener.results?.details?.[a]?.close || screener.results?.details?.[a]?.price || 0;
        const priceB = screener.results?.details?.[b]?.close || screener.results?.details?.[b]?.price || 0;
        return sortDirection === "asc" ? priceA - priceB : priceB - priceA;
      });
    } else if (screener.results?.details) {
      filteredMatches.sort((a, b) => {
        const valueA = screener.results?.details?.[a]?.[sortField];
        const valueB = screener.results?.details?.[b]?.[sortField];
        
        // Handle different data types
        if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
          return sortDirection === "asc" 
            ? (valueA === valueB ? 0 : valueA ? -1 : 1)
            : (valueA === valueB ? 0 : valueA ? 1 : -1);
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
        }
        
        // Default string comparison
        const strA = String(valueA || '');
        const strB = String(valueB || '');
        return sortDirection === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    
    return filteredMatches;
  };
  
  // Export results to CSV
  const exportToCSV = () => {
    if (!screener.results?.matches || screener.results.matches.length === 0) return;
    
    const filteredMatches = getFilteredAndSortedMatches();
    
    // Get all possible headers
    const headers = ["Symbol", "Price"];
    if (screener.results.details && filteredMatches.length > 0) {
      const firstSymbol = filteredMatches[0];
      const details = screener.results.details[firstSymbol] || {};
      
      Object.keys(details)
        .filter(key => key !== "close" && key !== "price")
        .forEach(key => {
          headers.push(key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
        });
    }
    
    // Create CSV content
    let csvContent = headers.join(",") + "\n";
    
    filteredMatches.forEach(symbol => {
      const price = screener.results?.details?.[symbol]?.close || 
                  screener.results?.details?.[symbol]?.price || 'N/A';
      
      let row = [symbol, price];
      
      if (screener.results?.details) {
        const details = screener.results.details[symbol] || {};
        
        Object.entries(details)
          .filter(([key]) => key !== "close" && key !== "price")
          .forEach(([_, value]) => {
            // Format the value based on type
            let formattedValue = value;
            if (typeof value === 'boolean') {
              formattedValue = value ? 'Yes' : 'No';
            } else if (typeof value === 'number') {
              formattedValue = Number(value).toFixed(2);
            }
            row.push(formattedValue);
          });
      }
      
      csvContent += row.join(",") + "\n";
    });
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${screener.name}_results_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Save current results
  const saveCurrentResults = () => {
    if (!screener.results?.matches || !screener.lastRunAt) return;
    
    const newSavedResult = {
      date: screener.lastRunAt,
      matches: [...screener.results.matches]
    };
    
    setSavedResults(prev => [...prev, newSavedResult]);
  };
  
  const filteredMatches = getFilteredAndSortedMatches();
  const sortFields = getSortFields();
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs" 
          disabled={!screener.results?.matches || screener.results.matches.length === 0}
        >
          <Eye className="mr-1 h-3 w-3" /> View Results ({screener.results?.matches?.length || 0})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{screener.name} Results</DialogTitle>
          <DialogDescription>
            Screening results from {screener.lastRunAt ? format(new Date(screener.lastRunAt), 'PPpp') : 'N/A'}
            {screener.results?.executionTime ? 
              ` (completed in ${screener.results.executionTime.toFixed(2)}s)` : 
              ''
            }
          </DialogDescription>
        </DialogHeader>
        
        {screener.results?.error ? (
          <div className="bg-destructive/10 p-4 rounded-md flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h4 className="font-medium text-destructive">Error running screen</h4>
              <p className="text-sm text-muted-foreground">{screener.results.error}</p>
            </div>
          </div>
        ) : screener.results?.matches?.length === 0 ? (
          <div className="text-center py-8">
            <h3 className="font-medium text-xl">No matches found</h3>
            <p className="text-muted-foreground mt-2">
              Try adjusting the screener parameters or running it again later.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search symbols..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      >
                        {sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4" />
                        ) : (
                          <SortDesc className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {sortDirection === "asc" ? "Ascending Order" : "Descending Order"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <Select value={sortField} onValueChange={setSortField}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortFields.map(field => (
                      <SelectItem key={field} value={field}>
                        {field === "symbol" ? "Symbol" : 
                         field === "price" ? "Price" : 
                         field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={saveCurrentResults}
                        disabled={!screener.results?.matches || screener.results.matches.length === 0}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Save current results
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <Tabs defaultValue="table" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="table" className="flex items-center gap-1">
                  <SlidersHorizontal className="h-4 w-4" /> Table View
                </TabsTrigger>
                <TabsTrigger value="charts" className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" /> Charts
                </TabsTrigger>
                <TabsTrigger value="insights" className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> Insights
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="table" className="mt-0">
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableCaption>
                      Showing {filteredMatches.length} of {screener.results.matches.length} matches
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        {screener.results?.details && Object.keys(screener.results.details).length > 0 && (
                          <>
                            {Object.keys(screener.results.details[screener.results.matches[0]] || {})
                              .filter(key => key !== 'close' && key !== 'price')
                              .map(key => (
                                <TableHead key={key} className="text-right capitalize">
                                  {key.replace(/_/g, ' ')}
                                </TableHead>
                              ))
                            }
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatches.map(symbol => (
                        <TableRow key={symbol}>
                          <TableCell className="font-medium">{symbol}</TableCell>
                          <TableCell className="text-right">
                            ${screener.results?.details?.[symbol]?.close || 
                               screener.results?.details?.[symbol]?.price || 'N/A'}
                          </TableCell>
                          {screener.results?.details && Object.keys(screener.results.details).length > 0 && (
                            <>
                              {Object.entries(screener.results.details[symbol] || {})
                                .filter(([key]) => key !== 'close' && key !== 'price')
                                .map(([key, value]) => (
                                  <TableCell key={key} className="text-right">
                                    {typeof value === 'boolean' ? (
                                      value ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4 text-red-500 ml-auto" />
                                      )
                                    ) : typeof value === 'number' ? (
                                      Number(value).toFixed(2)
                                    ) : (
                                      String(value)
                                    )}
                                  </TableCell>
                                ))
                              }
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="charts" className="mt-0">
                <div className="space-y-6">
                  {/* Price Distribution Chart */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Price Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={getPriceDistributionData()}
                        margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill="#6366F1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Numeric Indicator Distribution */}
                  {numericalFields.length > 0 && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Indicator Distribution</h3>
                        <Select 
                          value={selectedChartField} 
                          onValueChange={setSelectedChartField}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select indicator" />
                          </SelectTrigger>
                          <SelectContent>
                            {numericalFields.map(field => (
                              <SelectItem key={field} value={field}>
                                {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartLineChart
                          data={getIndicatorDistributionData()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="symbol" />
                          <YAxis />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="value" stroke="#6366F1" activeDot={{ r: 8 }} />
                        </RechartLineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="insights" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sectors / Industries Breakdown */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Sector Breakdown</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartPieChart>
                          <Pie
                            data={getSectorBreakdownData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {getSectorBreakdownData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </RechartPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Summary Statistics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Matches:</span>
                        <span className="font-medium">{filteredMatches.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Price:</span>
                        <span className="font-medium">
                          ${getAveragePrice().toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min Price:</span>
                        <span className="font-medium">
                          ${getMinPrice().toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Price:</span>
                        <span className="font-medium">
                          ${getMaxPrice().toFixed(2)}
                        </span>
                      </div>
                      
                      {selectedChartField && (
                        <>
                          <div className="border-t my-2 pt-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Selected Indicator:</span>
                              <span className="font-medium">
                                {selectedChartField.charAt(0).toUpperCase() + selectedChartField.slice(1).replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg {selectedChartField.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">
                              {getIndicatorStats().avg.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Min {selectedChartField.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">
                              {getIndicatorStats().min.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max {selectedChartField.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">
                              {getIndicatorStats().max.toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {savedResults.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-sm mb-2">Saved Results</h4>
                <div className="flex flex-wrap gap-2">
                  {savedResults.map((result, index) => (
                    <Badge key={index} variant="outline" className="px-3 py-1">
                      {format(new Date(result.date), 'MMM d, yyyy')} ({result.matches.length} matches)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        <DialogFooter className="gap-2">
          <Button 
            variant="secondary" 
            type="button" 
            onClick={() => onRun(screener.id)}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Run Again
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            type="button" 
            onClick={exportToCSV}
            disabled={!screener.results?.matches || screener.results.matches.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ScreenerCard = ({ 
  screener, 
  onEdit, 
  onRun, 
  onDelete,
  isRunning 
}: { 
  screener: Screener; 
  onEdit: (id: number) => void;
  onRun: (id: number) => void;
  onDelete: (id: number) => void;
  isRunning: boolean;
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">{screener.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(screener.id)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRun(screener.id)}>
                <Play className="mr-2 h-4 w-4" /> Run Screen
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive" 
                onClick={() => onDelete(screener.id)}
              >
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription>
          {screener.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Type:</span>
            <span className="flex items-center">
              {screener.type === 'python' ? (
                <>Python <Code className="ml-1 h-3 w-3" /></>
              ) : (
                <>JavaScript <Code className="ml-1 h-3 w-3" /></>
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Assets:</span>
            <span>{screener.configuration.assets.length} symbols</span>
          </div>
          {screener.results?.matches && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Matches:</span>
              <span>
                {screener.results.matches.length > 0 ? (
                  <span className="text-green-600 dark:text-green-500 font-medium flex items-center">
                    {screener.results.matches.length} found
                    <CheckCircle2 className="ml-1 h-3 w-3" />
                  </span>
                ) : (
                  <span className="text-muted-foreground">None found</span>
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Created:</span>
            <span>{format(new Date(screener.createdAt), 'MMM d, yyyy')}</span>
          </div>
          {screener.lastRunAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last run:</span>
              <span title={format(new Date(screener.lastRunAt), 'PPpp')}>
                <span className="flex items-center">
                  <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
                  {formatDistanceToNow(new Date(screener.lastRunAt), { addSuffix: true })}
                </span>
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-3">
        <ResultsDialog 
          screener={screener} 
          onRun={onRun} 
          isRunning={isRunning} 
        />
        <Button 
          variant="default" 
          size="sm" 
          className="text-xs"
          onClick={() => onRun(screener.id)}
        >
          Run Screen <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const EmptyStateCard = ({ onClick }: { onClick: () => void }) => (
  <Card className="bg-card">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg font-medium">Create Your First Screen</CardTitle>
      <CardDescription>
        Build custom filters to find trading opportunities
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <Binoculars className="h-12 w-12 text-muted-foreground" />
        <p className="text-center text-sm text-muted-foreground">
          Screens help you scan the market for stocks that match specific criteria
        </p>
        <Button onClick={onClick}>
          <PlusCircle className="mr-2 h-4 w-4" /> Get Started
        </Button>
      </div>
    </CardContent>
  </Card>
);

const SkeletonCard = () => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4 mt-2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </CardContent>
    <CardFooter className="flex justify-end pt-2">
      <Skeleton className="h-8 w-24" />
    </CardFooter>
  </Card>
);

const DeleteConfirmDialog = ({ 
  isOpen, 
  screenerId,
  screenerName,
  onClose, 
  onConfirm,
  isDeleting
}: { 
  isOpen: boolean;
  screenerId: number | null;
  screenerName: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Screen</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete the screen "{screenerName}"? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button 
          variant="destructive" 
          onClick={onConfirm} 
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete Screen'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const Screeners = () => {
  const { toast } = useToast();
  const [screenToDelete, setScreenToDelete] = useState<{id: number, name: string} | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch screeners
  const { 
    data: screeners, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/screeners'],
    refetchOnWindowFocus: false,
  });

  // Delete mutation
  const { 
    mutate: deleteScreener, 
    isPending: isDeleting 
  } = useMutation({
    mutationFn: async (id: number) => {
      return fetch(`/api/screeners/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/screeners'] });
      toast({
        title: "Screen deleted",
        description: "The screen has been successfully deleted.",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete the screen. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting screen:", error);
    }
  });

  // Run screener mutation
  const { 
    mutate: runScreener, 
    isPending: isRunning 
  } = useMutation({
    mutationFn: async (id: number) => {
      // Get the token from localStorage
      const token = localStorage.getItem('token');
      
      return fetch(`/api/screeners/${id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      }).then(res => {
        if (!res.ok) throw new Error('Failed to run screener');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/screeners'] });
      toast({
        title: "Screen executed",
        description: "The screen has been executed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to run the screen. Please try again.",
        variant: "destructive",
      });
      console.error("Error running screen:", error);
    }
  });

  const handleCreateScreen = () => {
    // Create a new empty screen
    const newScreener = {
      name: "New Screen",
      description: "My custom stock screen",
      type: "python",
      source: {
        type: "code",
        content: "# Python code to screen stocks\nimport numpy as np\n\ndef screen_stocks(data_dict):\n    \"\"\"Screen stocks based on criteria\"\"\"\n    matches = []\n    \n    for symbol, df in data_dict.items():\n        # Skip if we don't have enough data\n        if len(df) < 20:\n            continue\n            \n        # Example criteria - stocks above their 20-day moving average\n        df['ma20'] = df['Close'].rolling(window=20).mean()\n        latest = df.iloc[-1]\n        \n        if latest['Close'] > latest['ma20']:\n            matches.append(symbol)\n            \n    return {\n        'matches': matches,\n        'details': {}\n    }"
      },
      configuration: {
        assets: ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "META"],
        parameters: {}
      }
    };
    
    // Send mutation request to create new screen
    fetch('/api/screeners', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(newScreener)
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to create screen');
      return response.json();
    })
    .then(data => {
      // Refresh the screeners list
      queryClient.invalidateQueries({ queryKey: ['/api/screeners'] });
      toast({
        title: "Screen Created",
        description: "New screen has been created successfully.",
      });
    })
    .catch(error => {
      console.error("Error creating screen:", error);
      toast({
        title: "Error",
        description: "Failed to create screen. Please try again.",
        variant: "destructive",
      });
    });
  };

  const handleEditScreen = (id: number) => {
    // For simplicity, let's just run the screen instead of implementing a full edit UI
    toast({
      title: "Running screen",
      description: "For now, we'll just run the screen instead of editing it.",
    });
    handleRunScreen(id);
  };

  const handleRunScreen = (id: number) => {
    runScreener(id);
  };

  const handleDeleteClick = (id: number) => {
    const screener = screeners?.find((s: Screener) => s.id === id);
    if (screener) {
      setScreenToDelete({id, name: screener.name});
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (screenToDelete) {
      deleteScreener(screenToDelete.id);
    }
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setScreenToDelete(null);
  };

  if (error) {
    return (
      <MainLayout title="Screens">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Screens</h1>
            <p className="text-muted-foreground">
              Create and manage screens to identify trading opportunities
            </p>
          </div>
          <Button onClick={handleCreateScreen}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Screen
          </Button>
        </div>
        
        <Card className="bg-card border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Screens</CardTitle>
          </CardHeader>
          <CardContent>
            <p>There was a problem loading your screens. Please try refreshing the page.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Screens">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screens</h1>
          <p className="text-muted-foreground">
            Create and manage screens to identify trading opportunities
          </p>
        </div>
        <Button onClick={handleCreateScreen}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Screen
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          // Show skeleton cards while loading
          Array(3).fill(0).map((_, index) => (
            <SkeletonCard key={index} />
          ))
        ) : screeners?.length === 0 ? (
          // Show empty state if no screeners exist
          <>
            <EmptyStateCard onClick={handleCreateScreen} />
            
            {/* Example template cards */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Momentum Screen</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>
                  Finds stocks with strong price momentum (Template)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price Change:</span>
                    <span>+5% over 5 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Volume:</span>
                    <span>Above 1M shares</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RSI:</span>
                    <span>Above 65</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={handleCreateScreen}
                >
                  Use Template <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Value Finder</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>
                  Identifies undervalued stocks based on fundamentals (Template)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">P/E Ratio:</span>
                    <span>Below 15</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dividend Yield:</span>
                    <span>Above 2%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Debt/Equity:</span>
                    <span>Below 0.5</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={handleCreateScreen}
                >
                  Use Template <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          </>
        ) : (
          // Show actual screeners
          <>
            {screeners.map((screener: Screener) => (
              <ScreenerCard 
                key={screener.id} 
                screener={screener} 
                onEdit={handleEditScreen}
                onRun={handleRunScreen}
                onDelete={handleDeleteClick}
                isRunning={isRunning}
              />
            ))}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog 
        isOpen={isDeleteDialogOpen}
        screenerId={screenToDelete?.id || null}
        screenerName={screenToDelete?.name || ''}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </MainLayout>
  );
};

export default Screeners;