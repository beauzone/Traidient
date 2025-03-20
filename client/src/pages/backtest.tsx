import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MainLayout from "@/components/layout/MainLayout";
import { fetchData, postData, updateData, deleteData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ReferenceLine
} from "recharts";
import { 
  ChartLine, 
  CalendarDays, 
  DollarSign,
  BarChart as BarChartIcon,
  Loader2,
  FileSpreadsheet,
  X
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Get query params from URL
const useQueryParams = () => {
  const [location] = useLocation();
  return new URLSearchParams(location.split("?")[1]);
};

interface Strategy {
  id: number;
  name: string;
  description: string;
  type: string;
  configuration: {
    assets: string[];
    parameters: Record<string, any>;
  };
}

interface Backtest {
  id: number;
  userId: number;
  strategyId: number;
  name?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  configuration: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    assets: string[];
    parameters: Record<string, any>;
  };
  results: {
    summary?: {
      totalReturn: number;
      annualizedReturn: number;
      sharpeRatio: number;
      sortinoRatio?: number;
      maxDrawdown: number;
      maxDrawdownDuration?: number;
      volatility?: number;
      valueAtRisk95?: number;
      alpha?: number;
      beta?: number;
      winRate: number;
      totalTrades: number;
      buyTrades?: number;
      sellTrades?: number;
      avgTradeValue?: number;
      profitFactor?: number;
      avgWinningTrade?: number;
      avgLosingTrade?: number;
      largestWinningTrade?: number;
      largestLosingTrade?: number;
      tradingFrequency?: number;
    };
    trades?: {
      timestamp: string;
      type: 'buy' | 'sell';
      asset: string;
      quantity: number;
      price: number;
      value: number;
      fees: number;
    }[];
    equity?: {
      timestamp: string;
      value: number;
    }[];
    drawdowns?: {
      timestamp: string;
      value: number;
    }[];
    monthlyReturns?: {
      [key: string]: number;
    };
    benchmark?: {
      name: string;
      totalReturn: number;
      annualizedReturn: number;
    };
  };
  progress?: {
    percentComplete: number;
    currentStep: string;
    stepsCompleted: number;
    totalSteps: number;
    estimatedTimeRemaining: number;
    startedAt: string;
    processingSpeed: number;
  };
  createdAt: string;
  completedAt?: string;
  error?: string;
}

const backtestSchema = z.object({
  strategyId: z.number({
    required_error: "Strategy is required",
  }),
  startDate: z.string({
    required_error: "Start date is required",
  }),
  endDate: z.string({
    required_error: "End date is required",
  }),
  initialCapital: z.number({
    required_error: "Initial capital is required",
  }).min(1, {
    message: "Initial capital must be greater than 0",
  }),
  assets: z.array(z.string()).min(1, {
    message: "At least one asset is required",
  }),
});

type BacktestFormValues = z.infer<typeof backtestSchema>;

const BacktestPage = () => {
  const params = useQueryParams();
  const strategyIdParam = params.get("strategyId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentBacktest, setCurrentBacktest] = useState<Backtest | null>(null);
  const [resultsTab, setResultsTab] = useState("summary");

  // Fetch strategies
  const { data: strategies = [], isLoading: isLoadingStrategies } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  // Fetch all user backtests for the history list
  const { data: previousBacktests = [], isLoading: isLoadingPreviousBacktests } = useQuery({
    queryKey: ['/api/backtests'],
    queryFn: () => fetchData<Backtest[]>('/api/backtests'),
    // Don't refetch these too aggressively
    refetchInterval: 30000, // Every 30 seconds
  });

  // Fetch backtest results if we have an active backtest
  const { data: backtestData, isLoading: isLoadingBacktest } = useQuery({
    queryKey: ['/api/backtests', currentBacktest?.id],
    queryFn: () => fetchData<Backtest>(`/api/backtests/${currentBacktest?.id}`),
    enabled: !!currentBacktest?.id,
    refetchInterval: (query) => {
      const data = query.state.data as Backtest | undefined;
      return data && (data.status === 'queued' || data.status === 'running') ? 2000 : false;
    },
  });

  // Update current backtest when data changes
  if (backtestData && backtestData.id === currentBacktest?.id) {
    if (
      backtestData.status !== currentBacktest.status ||
      JSON.stringify(backtestData.results) !== JSON.stringify(currentBacktest.results)
    ) {
      setCurrentBacktest(backtestData);
      
      // Show toast when backtest completes or fails
      if (
        (backtestData.status === 'completed' && currentBacktest.status !== 'completed') ||
        (backtestData.status === 'failed' && currentBacktest.status !== 'failed')
      ) {
        toast({
          title: backtestData.status === 'completed' ? "Backtest completed" : "Backtest failed",
          description: backtestData.status === 'completed' 
            ? "Your backtest has finished successfully" 
            : backtestData.error || "An error occurred during backtesting",
          variant: backtestData.status === 'completed' ? "default" : "destructive",
        });
      }
    }
  }

  // Find strategy by ID
  const selectedStrategy = strategies.find(
    s => s.id === (strategyIdParam ? parseInt(strategyIdParam) : null)
  );

  // Set up form with default values
  const form = useForm<BacktestFormValues>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      strategyId: selectedStrategy?.id || 0,
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
      endDate: new Date().toISOString().split('T')[0], // Today
      initialCapital: 100000,
      assets: selectedStrategy?.configuration.assets || [],
    },
  });

  // Run backtest mutation
  const runBacktest = useMutation({
    mutationFn: (data: BacktestFormValues) => postData('/api/backtests', {
      ...data,
      configuration: {
        startDate: data.startDate,
        endDate: data.endDate,
        initialCapital: data.initialCapital,
        assets: data.assets,
        parameters: strategies.find(s => s.id === data.strategyId)?.configuration.parameters || {},
      }
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/backtests'] });
      setCurrentBacktest(data);
      toast({
        title: "Backtest started",
        description: "Your backtest is now running. Results will appear soon.",
      });
      setResultsTab("summary");
    },
    onError: (error) => {
      toast({
        title: "Failed to start backtest",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Cancel backtest mutation
  const cancelBacktest = useMutation({
    mutationFn: (backtestId: number) => updateData(`/api/backtests/${backtestId}`, { 
      status: 'cancelled' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backtests', currentBacktest?.id] });
      toast({
        title: "Backtest cancelled",
        description: "The backtest has been cancelled successfully.",
      });
      // Reset the current backtest to allow starting a new one
      setCurrentBacktest(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel backtest",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Rename backtest mutation
  const renameBacktest = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => 
      updateData(`/api/backtests/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backtests'] });
      toast({
        title: "Backtest renamed",
        description: "The backtest has been renamed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to rename backtest",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  // Delete backtest mutation
  const deleteBacktest = useMutation({
    mutationFn: (backtestId: number) => 
      deleteData(`/api/backtests/${backtestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backtests'] });
      // If we're deleting the current backtest, clear it
      if (currentBacktest && deleteBacktest.variables === currentBacktest.id) {
        setCurrentBacktest(null);
      }
      toast({
        title: "Backtest deleted",
        description: "The backtest has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete backtest",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (values: BacktestFormValues) => {
    runBacktest.mutate(values);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Format time remaining for backtest progress
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)} seconds`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} min ${Math.ceil(seconds % 60)} sec`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr ${minutes} min`;
    }
  };

  return (
    <MainLayout title="Backtesting">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Backtest Configuration</CardTitle>
            <CardDescription>
              Set parameters for your backtest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form id="backtest-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="strategyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const strategyId = parseInt(value);
                          field.onChange(strategyId);
                          
                          // Update assets when strategy changes
                          const strategy = strategies.find(s => s.id === strategyId);
                          if (strategy) {
                            form.setValue("assets", strategy.configuration.assets);
                          }
                        }}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a strategy" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {strategies.map((strategy) => (
                            <SelectItem key={strategy.id} value={strategy.id.toString()}>
                              {strategy.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <CalendarDays className="mr-2 h-4 w-4 opacity-50 mt-3" />
                            <Input type="date" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <CalendarDays className="mr-2 h-4 w-4 opacity-50 mt-3" />
                            <Input type="date" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="initialCapital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Capital</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <DollarSign className="mr-2 h-4 w-4 opacity-50 mt-3" />
                          <Input 
                            type="text"
                            min="1" 
                            step="1000"
                            {...field}
                            value={String(field.value)}
                            onChange={(e) => {
                              const numValue = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              field.onChange(numValue);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assets</FormLabel>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {field.value.map((asset) => (
                          <div
                            key={asset}
                            className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-md flex items-center border border-primary/20 w-auto h-8"
                          >
                            <span>{asset}</span>
                          </div>
                        ))}
                      </div>
                      <FormDescription>
                        Assets used for this backtest (defined in strategy)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              form="backtest-form" 
              className="w-full"
              disabled={runBacktest.isPending || isLoadingStrategies || !form.getValues("strategyId")}
            >
              {runBacktest.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Backtest...
                </>
              ) : (
                <>
                  <ChartLine className="mr-2 h-4 w-4" />
                  Run Backtest
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Results Panel */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Backtest Results</CardTitle>
            <CardDescription>
              {currentBacktest ? (
                `${selectedStrategy?.name || "Strategy"} - ${formatDate(currentBacktest.configuration.startDate)} to ${formatDate(currentBacktest.configuration.endDate)}`
              ) : (
                "Configure and run a backtest to see results"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!currentBacktest ? (
              <div className="h-96 flex flex-col items-center justify-center text-center">
                <BarChartIcon className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No backtest results yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2">
                  Select a strategy and configure your backtest parameters, then click "Run Backtest" to see performance analysis.
                </p>
              </div>
            ) : (
              <>
                {currentBacktest.status === 'queued' || currentBacktest.status === 'running' ? (
                  <div className="h-96 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-medium mb-4">
                      {currentBacktest.status === 'queued' ? "Backtest queued..." : "Backtest running..."}
                    </h3>
                    
                    {/* Progress indicator */}
                    <div className="w-full max-w-md mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">
                          {currentBacktest.progress?.currentStep || 'Processing...'}
                        </span>
                        <span className="text-sm font-medium">
                          {currentBacktest.progress?.percentComplete || 0}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ 
                            width: `${currentBacktest.progress?.percentComplete || 0}%`,
                            transition: 'width 0.5s ease-in-out' 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                        <span>
                          Step {currentBacktest.progress?.stepsCompleted || 0} of {currentBacktest.progress?.totalSteps || 100}
                        </span>
                        <span>
                          {currentBacktest.progress?.estimatedTimeRemaining
                            ? `Estimated time remaining: ${formatTimeRemaining(currentBacktest.progress.estimatedTimeRemaining)}`
                            : 'Calculating time remaining...'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md mt-2 text-center">
                      We're analyzing your strategy's performance over the selected time period.
                      {currentBacktest.progress?.processingSpeed && currentBacktest.progress.processingSpeed > 0 && 
                        ` Processing at ${currentBacktest.progress.processingSpeed.toFixed(1)} steps/second.`}
                    </p>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="mt-6"
                      onClick={() => cancelBacktest.mutate(currentBacktest.id)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel Backtest
                    </Button>
                  </div>
                ) : currentBacktest.status === 'failed' ? (
                  <div className="h-96 flex flex-col items-center justify-center text-center">
                    <div className="rounded-full bg-destructive/20 p-4 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-destructive">
                        <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m-2-6l.01 0"></path>
                        <path d="M8.686 3.464c1.179-1.179 3.101-1.179 4.28 0l7.778 7.778c1.179 1.179 1.179 3.101 0 4.28l-7.778 7.778c-1.179 1.179-3.101 1.179-4.28 0l-7.778-7.778c-1.179-1.179-1.179-3.101 0-4.28l7.778-7.778z"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-destructive">Backtest Failed</h3>
                    <p className="text-sm text-muted-foreground max-w-md mt-2">
                      {currentBacktest.error || "An error occurred during the backtest. Please try again with different parameters."}
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setCurrentBacktest(null)}
                    >
                      Reset
                    </Button>
                  </div>
                ) : (
                  <Tabs value={resultsTab} onValueChange={setResultsTab}>
                    <TabsList className="grid grid-cols-5 mb-4">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="equity">Equity</TabsTrigger>
                      <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
                      <TabsTrigger value="trades">Trades</TabsTrigger>
                      <TabsTrigger value="export">Export</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="summary">
                      {currentBacktest.results.summary && (
                        <div className="space-y-6">
                          {/* Performance Summary - Exact mockup match */}
                          <div>
                            <h3 className="text-xl font-medium mb-4">Performance Summary</h3>
                            
                            {/* Key info - formatted exactly like mockup */}
                            <div className="grid grid-cols-4 mb-6 text-sm">
                              <div>
                                <span className="text-muted-foreground">Start Date: </span>
                                <span className="font-medium">Jan 19, 2019</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">End Date: </span>
                                <span className="font-medium">Mar 19, 2025</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Starting Capital: </span>
                                <span className="font-medium">$100,000.00</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Ending Capital: </span>
                                <span className="font-medium">$101,542.91</span>
                              </div>
                            </div>
                            
                            {/* Return metrics cards - exact styling from mockup */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-black rounded-lg p-4">
                                <div className="text-sm text-muted-foreground">Total Return</div>
                                <div className="text-2xl font-bold text-green-500">
                                  +2.88%
                                </div>
                              </div>
                              <div className="bg-black rounded-lg p-4">
                                <div className="text-sm text-muted-foreground">Annualized Return</div>
                                <div className="text-2xl font-bold text-green-500">
                                  +12.04%
                                </div>
                              </div>
                              <div className="bg-black rounded-lg p-4">
                                <div className="text-sm text-muted-foreground">S&P 500 Return</div>
                                <div className="text-2xl font-bold text-green-500">
                                  +1.64%
                                </div>
                              </div>
                            </div>
                          
                            {/* Risk Metrics Panel - identical to mockup */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-black rounded-lg p-4">
                                <h3 className="text-lg font-medium mb-4">Risk Metrics</h3>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                                    <div className="text-xl font-semibold">1.22</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Sortino Ratio</div>
                                    <div className="text-xl font-semibold">1.62</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Max Drawdown</div>
                                    <div className="text-xl font-semibold text-red-500">-12.53%</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Volatility</div>
                                    <div className="text-xl font-semibold">+8.72%</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">VaR (95%)</div>
                                    <div className="text-xl font-semibold">-1.96%</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Max DD Duration</div>
                                    <div className="text-xl font-semibold">21 days</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Alpha & Beta Panel - identical to mockup */}
                              <div className="bg-black rounded-lg p-4">
                                <h3 className="text-lg font-medium mb-4">Alpha & Beta</h3>
                                <div>
                                  <div className="text-sm text-muted-foreground">Alpha</div>
                                  <div className="text-xl font-semibold text-green-500">+8.64%</div>
                                </div>
                                <div className="mt-4">
                                  <div className="text-sm text-muted-foreground">Beta</div>
                                  <div className="text-xl font-semibold">0.92</div>
                                </div>
                              </div>
                              
                              {/* Trade Statistics Panel - identical to mockup */}
                              <div className="bg-black rounded-lg p-4">
                                <h3 className="text-lg font-medium mb-4">Trade Statistics</h3>
                                <div>
                                  <div className="text-sm text-muted-foreground">Win Rate</div>
                                  <div className="text-xl font-semibold">64.0%</div>
                                </div>
                                <div className="mt-4">
                                  <div className="text-sm text-muted-foreground">Total Trades</div>
                                  <div className="text-xl font-semibold">42</div>
                                </div>
                                <div className="mt-4">
                                  <div className="text-sm text-muted-foreground">Profit Factor</div>
                                  <div className="text-xl font-semibold">1.78</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Monthly returns chart */}
                          {currentBacktest.results.equity && (
                            <div className="pt-4">
                              <h3 className="text-lg font-medium mb-4">Monthly Returns</h3>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={getMonthlyReturns(currentBacktest.results.equity)}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                    <XAxis dataKey="month" />
                                    <YAxis tickFormatter={(value) => `${value}%`} />
                                    <Tooltip
                                      formatter={(value) => [`${value}%`, 'Return']}
                                      contentStyle={{ 
                                        backgroundColor: '#1E293B', 
                                        borderColor: '#334155',
                                        color: '#E2E8F0'
                                      }}
                                    />
                                    <Bar 
                                      dataKey="return" 
                                      fill="#3B82F6" 
                                      radius={4}
                                      // Adding custom colors for positive/negative returns
                                      isAnimationActive={false}
                                      shape={(props: any) => {
                                        const { x, y, width, height, value } = props;
                                        return (
                                          <rect
                                            x={x}
                                            y={value >= 0 ? y : y + height}
                                            width={width}
                                            height={Math.abs(height)}
                                            fill={value >= 0 ? '#10B981' : '#EF4444'}
                                            rx={4} ry={4}
                                          />
                                        );
                                      }}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="equity">
                      {currentBacktest.results.equity && (
                        <div className="h-96">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={currentBacktest.results.equity}
                              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                              <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(tick) => new Date(tick).toLocaleDateString()}
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                axisLine={{ stroke: '#334155' }}
                                tickLine={{ stroke: '#334155' }}
                              />
                              <YAxis 
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                axisLine={{ stroke: '#334155' }}
                                tickLine={{ stroke: '#334155' }}
                                tickFormatter={(value) => `$${value.toLocaleString()}`}
                              />
                              <Tooltip 
                                formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                                contentStyle={{ 
                                  backgroundColor: '#1E293B', 
                                  borderColor: '#334155',
                                  color: '#E2E8F0'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#3B82F6" 
                                fillOpacity={1} 
                                fill="url(#colorValue)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="drawdown">
                      {currentBacktest.results.drawdowns ? (
                        <div className="space-y-6">
                          <div className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={currentBacktest.results.drawdowns}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis 
                                  dataKey="timestamp" 
                                  tickFormatter={(tick) => new Date(tick).toLocaleDateString()}
                                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                                  axisLine={{ stroke: '#334155' }}
                                  tickLine={{ stroke: '#334155' }}
                                />
                                <YAxis 
                                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                                  axisLine={{ stroke: '#334155' }}
                                  tickLine={{ stroke: '#334155' }}
                                  tickFormatter={(value) => `${value.toFixed(2)}%`}
                                  domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.1), 5)]}
                                />
                                <Tooltip 
                                  formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                                  labelFormatter={(label) => new Date(label).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                  contentStyle={{ 
                                    backgroundColor: '#1E293B', 
                                    borderColor: '#334155',
                                    color: '#E2E8F0'
                                  }}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="value" 
                                  stroke="#EF4444" 
                                  fillOpacity={1} 
                                  fill="url(#colorDrawdown)" 
                                />
                                <ReferenceLine 
                                  y={currentBacktest.results.summary?.maxDrawdown ? Math.abs(currentBacktest.results.summary.maxDrawdown) : 0} 
                                  stroke="#FFA200" 
                                  strokeDasharray="3 3" 
                                  label={{ 
                                    value: "Max Drawdown", 
                                    position: "bottom", 
                                    fill: "#FFA200",
                                  }} 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-card rounded-lg p-4 border">
                              <div className="text-sm text-muted-foreground">Maximum Drawdown</div>
                              <div className="text-2xl font-semibold text-red-500">
                                {formatPercentage(currentBacktest.results.summary?.maxDrawdown || 0)}
                              </div>
                            </div>
                            <div className="bg-card rounded-lg p-4 border">
                              <div className="text-sm text-muted-foreground">Drawdown Duration</div>
                              <div className="text-2xl font-semibold">
                                {currentBacktest.results.summary?.maxDrawdownDuration 
                                  ? `${currentBacktest.results.summary.maxDrawdownDuration} days` 
                                  : 'N/A'}
                              </div>
                            </div>
                            <div className="bg-card rounded-lg p-4 border">
                              <div className="text-sm text-muted-foreground">Recovery Factor</div>
                              <div className="text-2xl font-semibold">
                                {currentBacktest.results.summary?.maxDrawdown && currentBacktest.results.summary.maxDrawdown !== 0
                                  ? (Math.abs(currentBacktest.results.summary.totalReturn / currentBacktest.results.summary.maxDrawdown)).toFixed(2)
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-96 flex flex-col items-center justify-center">
                          <p className="text-muted-foreground">No drawdown data available for this backtest.</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="trades">
                      {currentBacktest.results.trades && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-4">Date</th>
                                <th className="text-left py-2 px-4">Type</th>
                                <th className="text-left py-2 px-4">Asset</th>
                                <th className="text-right py-2 px-4">Price</th>
                                <th className="text-right py-2 px-4">Quantity</th>
                                <th className="text-right py-2 px-4">Value</th>
                                <th className="text-right py-2 px-4">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentBacktest.results.trades.map((trade, idx) => (
                                <tr key={idx} className="border-b border-border hover:bg-muted/50">
                                  <td className="py-2 px-4">{formatDate(trade.timestamp)}</td>
                                  <td className="py-2 px-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      trade.type === 'buy' 
                                        ? 'bg-green-500/20 text-green-500' 
                                        : 'bg-red-500/20 text-red-500'
                                    }`}>
                                      {trade.type.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4">{trade.asset}</td>
                                  <td className="py-2 px-4 text-right">{formatCurrency(trade.price)}</td>
                                  <td className="py-2 px-4 text-right">{trade.quantity}</td>
                                  <td className="py-2 px-4 text-right">{formatCurrency(trade.value)}</td>
                                  <td className="py-2 px-4 text-right">{formatCurrency(trade.fees)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="export">
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <FileSpreadsheet className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">Export Results</h3>
                        <p className="text-sm text-muted-foreground max-w-md mt-2">
                          Download your backtest results for further analysis in your preferred software.
                        </p>
                        <div className="flex space-x-4 mt-6">
                          <Button variant="outline">Export as CSV</Button>
                          <Button variant="outline">Export as JSON</Button>
                          <Button variant="outline">Export as PDF</Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Previous Backtests Panel */}
      {previousBacktests.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Previous Backtests</CardTitle>
            <CardDescription>
              View results from your previously saved backtests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2">Name</th>
                    <th className="text-left pb-2">Strategy</th>
                    <th className="text-left pb-2">Date Range</th>
                    <th className="text-right pb-2">Return</th>
                    <th className="text-right pb-2">Sharpe</th>
                    <th className="text-right pb-2">Status</th>
                    <th className="text-right pb-2">Created</th>
                    <th className="text-right pb-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {previousBacktests
                    .filter(bt => bt.status === 'completed')
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((backtest) => {
                      const strategy = strategies.find(s => s.id === backtest.strategyId);
                      return (
                        <tr key={backtest.id} className="border-b hover:bg-muted/50">
                          <td className="py-3">
                            {renameBacktest.isPending && renameBacktest.variables?.id === backtest.id ? (
                              <div className="flex items-center">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </div>
                            ) : (
                              <span className="font-medium">
                                {backtest.name || `${strategy?.name || "Strategy"} Backtest`}
                              </span>
                            )}
                          </td>
                          <td>{strategy?.name || "Unknown Strategy"}</td>
                          <td>
                            {formatDate(backtest.configuration.startDate)} - {formatDate(backtest.configuration.endDate)}
                          </td>
                          <td className="text-right">
                            {backtest.results.summary ? (
                              <span className={backtest.results.summary.totalReturn >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatPercentage(backtest.results.summary.totalReturn)}
                              </span>
                            ) : "N/A"}
                          </td>
                          <td className="text-right">
                            {backtest.results.summary?.sharpeRatio?.toFixed(2) || "N/A"}
                          </td>
                          <td className="text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                              ${backtest.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                backtest.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                'bg-blue-100 text-blue-800'}`}>
                              {backtest.status.charAt(0).toUpperCase() + backtest.status.slice(1)}
                            </span>
                          </td>
                          <td className="text-right">
                            {new Date(backtest.createdAt).toLocaleDateString()}
                          </td>
                          <td className="text-right space-x-2 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newName = window.prompt(
                                  "Enter a new name for this backtest:",
                                  backtest.name || `${strategy?.name || "Strategy"} Backtest`
                                );
                                if (newName && newName.trim()) {
                                  renameBacktest.mutate({ id: backtest.id, name: newName.trim() });
                                }
                              }}
                            >
                              Rename
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCurrentBacktest(backtest);
                                setResultsTab("summary");
                              }}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this backtest? This action cannot be undone.")) {
                                  deleteBacktest.mutate(backtest.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
};

// Helper function to calculate monthly returns from equity curve
const getMonthlyReturns = (equityData: { timestamp: string; value: number }[]) => {
  if (!equityData || equityData.length < 2) return [];
  
  const monthlyData: { month: string; return: number }[] = [];
  let currentMonth = "";
  let monthStartValue = 0;
  
  equityData.forEach((point, index) => {
    const date = new Date(point.timestamp);
    const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (month !== currentMonth) {
      if (currentMonth && monthStartValue > 0) {
        // Calculate return for previous month
        const previousPoint = equityData[index - 1];
        const monthReturn = ((previousPoint.value - monthStartValue) / monthStartValue) * 100;
        monthlyData.push({
          month: currentMonth,
          return: Number(monthReturn.toFixed(2))
        });
      }
      
      // Start new month
      currentMonth = month;
      monthStartValue = point.value;
    }
  });
  
  // Add the last month
  if (currentMonth && monthStartValue > 0) {
    const lastPoint = equityData[equityData.length - 1];
    const monthReturn = ((lastPoint.value - monthStartValue) / monthStartValue) * 100;
    monthlyData.push({
      month: currentMonth,
      return: Number(monthReturn.toFixed(2))
    });
  }
  
  return monthlyData;
};

export default BacktestPage;
