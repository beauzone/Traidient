import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, SearchIcon, ChevronRightIcon, InfoIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface ScreenResult {
  matches: string[];
  details: Record<string, any>;
  timestamp: string;
  execution_time_ms: number;
  strategy: string;
  status: string;
  message: string;
}

const strategyOptions = [
  { id: 'momentum', name: 'Momentum', description: 'Price above 20 MA, RSI 30-70, Vol > Avg Vol' },
  { id: 'trend_following', name: 'Trend Following', description: 'Price > 50/200 MA, ADX > 20, +DI > -DI' },
  { id: 'williams', name: 'Williams %R', description: 'Oversold to recovery pattern using Williams %R' },
  { id: 'cup_handle', name: 'Cup & Handle', description: 'Detects cup and handle pattern formations' },
  { id: 'canslim', name: 'CANSLIM', description: 'Growth stocks with strong fundamentals & technicals' }
];

export function StrategyScreenerCard() {
  const [activeStrategy, setActiveStrategy] = useState('momentum');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ScreenResult | null>(null);
  const [activeTab, setActiveTab] = useState('stocks');
  
  const runScreener = async () => {
    setIsLoading(true);
    try {
      // Use fetch directly since apiRequest is configured differently
      const response = await fetch('/api/parameterized-screener', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strategy: activeStrategy })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
      toast({
        title: "Screener completed",
        description: `Found ${data.matches.length} matching stocks.`,
      });
    } catch (error) {
      console.error('Error running screener:', error);
      toast({
        title: "Error running screener",
        description: "There was a problem running the stock screener.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format a detail value based on its type
  const formatDetailValue = (value: any): string => {
    if (typeof value === 'number') {
      // If it's likely a percentage
      if (value < 100 && value > -100 && value.toString().includes('.')) {
        return `${value.toFixed(2)}%`;
      }
      // For regular numbers with decimals
      else if (value.toString().includes('.')) {
        return value.toFixed(2);
      }
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  // Get the appropriate details for the active strategy
  const getDetailsColumns = () => {
    if (!results || !results.details || Object.keys(results.details).length === 0) return [];
    
    // Get the first stock's details as a reference
    const firstStock = Object.keys(results.details)[0];
    if (!firstStock) return [];
    
    // Extract column names from the first stock's details
    return Object.keys(results.details[firstStock]);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Strategy Screener</span>
          <Badge variant="outline" className="ml-2">Real-time</Badge>
        </CardTitle>
        <CardDescription>
          Screen stocks using pre-built technical and fundamental strategies
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <Select value={activeStrategy} onValueChange={setActiveStrategy}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategyOptions.map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {strategyOptions.find(s => s.id === activeStrategy)?.description}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button 
              variant="default" 
              onClick={runScreener} 
              disabled={isLoading}
              className="ml-auto"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
              Run Screener
            </Button>
          </div>
          
          {results && (
            <div className="mt-4">
              <Tabs defaultValue="stocks" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="stocks">Matching Stocks</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                <TabsContent value="stocks">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.matches.map((symbol) => (
                          <TableRow key={symbol}>
                            <TableCell className="font-medium">{symbol}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                View <ChevronRightIcon className="ml-1 h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="details">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          {getDetailsColumns().map((column) => (
                            <TableHead key={column}>
                              {column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.matches.map((symbol) => (
                          <TableRow key={symbol}>
                            <TableCell className="font-medium">{symbol}</TableCell>
                            {getDetailsColumns().map((column) => (
                              <TableCell key={`${symbol}-${column}`}>
                                {formatDetailValue(results.details[symbol][column])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {results && (
          <div className="w-full flex justify-between">
            <span>
              Found {results.matches.length} matches using {results.strategy} strategy
            </span>
            <span>
              Execution time: {results.execution_time_ms}ms
            </span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}