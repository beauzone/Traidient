import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { postData } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';

import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Save, PlayCircle } from "lucide-react";

// Define the strategy schema 
const codeStrategySchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
  type: z.enum(['ai-generated', 'template', 'custom']),
  source: z.object({
    type: z.literal('code'),
    content: z.string().min(1, { message: 'Strategy code is required' }),
  }),
  configuration: z.object({
    assets: z.array(z.string()).min(1, { message: 'At least one asset is required' }),
    parameters: z.record(z.any()),
    riskControls: z.object({
      maxPositionSize: z.number().min(0),
      stopLoss: z.number().min(0),
      takeProfit: z.number().min(0),
    }),
    schedule: z.object({
      isActive: z.boolean(),
      timezone: z.string(),
      activeDays: z.array(z.number()),
      activeHours: z.object({
        start: z.string(),
        end: z.string(),
      }),
    }),
  }),
});

type CodeStrategyFormValues = z.infer<typeof codeStrategySchema>;

const lumibotTemplate = `from lumibot.strategies.strategy import Strategy
from lumibot.backtesting import YahooDataBacktesting
from datetime import datetime
import pandas as pd
import numpy as np

class MyStrategy(Strategy):
    """
    This is a custom trading strategy built with Lumibot.
    
    Parameters:
    - symbol: The trading symbol (e.g., "AAPL")
    - lookback_period: The lookback period for calculating indicators (default: 20)
    - rsi_threshold_low: RSI threshold for buy signal (default: 30)
    - rsi_threshold_high: RSI threshold for sell signal (default: 70)
    """
    
    # Strategy parameters (these can be customized)
    parameters = {
        "symbol": "AAPL",
        "lookback_period": 20,
        "rsi_threshold_low": 30,
        "rsi_threshold_high": 70,
    }

    def initialize(self):
        # Set the assets to trade
        self.symbols = [self.parameters["symbol"]]
        self.sleeptime = "1D"  # Check for trading opportunities daily
        self.last_trade_price = None

    def position_sizing(self):
        """Determine the position size based on risk management settings"""
        cash = self.get_cash()
        # Max position size as percentage of portfolio
        return cash * 0.10  # 10% of portfolio per position

    def calculate_rsi(self, symbol, bars):
        """Calculate the RSI indicator"""
        close_prices = np.array([bar.close for bar in bars])
        delta = np.diff(close_prices)
        gain = np.copy(delta)
        loss = np.copy(delta)
        
        gain[gain < 0] = 0
        loss[loss > 0] = 0
        loss = abs(loss)
        
        avg_gain = np.mean(gain[:self.parameters["lookback_period"]])
        avg_loss = np.mean(loss[:self.parameters["lookback_period"]])
        
        if avg_loss == 0:
            return 100
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def on_trading_iteration(self):
        """Main trading logic executed on each iteration"""
        for symbol in self.symbols:
            # Get historical bars
            bars = self.get_historical_prices(
                symbol, 
                self.parameters["lookback_period"] + 1, 
                self.sleeptime
            )
            
            if len(bars) < self.parameters["lookback_period"] + 1:
                self.log_message(f"Not enough historical data for {symbol}")
                continue
                
            # Calculate indicators
            rsi = self.calculate_rsi(symbol, bars)
            current_price = bars[-1].close
            
            # Get current position
            position = self.get_position(symbol)
            
            # Trading logic
            if position is None and rsi < self.parameters["rsi_threshold_low"]:
                # BUY SIGNAL - RSI below threshold
                self.log_message(f"BUY signal for {symbol}: RSI={rsi:.2f}")
                
                # Determine how much to buy
                quantity = self.position_sizing() / current_price
                
                # Execute buy order
                self.submit_order(
                    symbol=symbol, 
                    order_type="market", 
                    quantity=quantity, 
                    side="buy"
                )
                self.last_trade_price = current_price
                
            elif position is not None and rsi > self.parameters["rsi_threshold_high"]:
                # SELL SIGNAL - RSI above threshold
                self.log_message(f"SELL signal for {symbol}: RSI={rsi:.2f}")
                
                # Execute sell order for all shares
                self.submit_order(
                    symbol=symbol, 
                    order_type="market", 
                    quantity=position.quantity, 
                    side="sell"
                )
                self.last_trade_price = None
                
            # Implement stop loss and take profit if we have a position
            if position is not None and self.last_trade_price is not None:
                price_change_pct = (current_price - self.last_trade_price) / self.last_trade_price * 100
                
                # Stop loss - 5% loss
                if price_change_pct < -5:
                    self.log_message(f"STOP LOSS triggered for {symbol}")
                    self.submit_order(
                        symbol=symbol, 
                        order_type="market", 
                        quantity=position.quantity, 
                        side="sell"
                    )
                    self.last_trade_price = None
                
                # Take profit - 15% gain
                elif price_change_pct > 15:
                    self.log_message(f"TAKE PROFIT triggered for {symbol}")
                    self.submit_order(
                        symbol=symbol, 
                        order_type="market", 
                        quantity=position.quantity, 
                        side="sell"
                    )
                    self.last_trade_price = None

# Code for backtesting the strategy (this won't be executed in live trading)
if __name__ == "__main__":
    # Set up the backtesting period
    backtesting_start = datetime(2020, 1, 1)
    backtesting_end = datetime(2023, 1, 1)
    
    # Initialize the backtesting engine
    strategy = MyStrategy()
    strategy.parameters["symbol"] = "AAPL"
    
    # Run the backtest
    engine = YahooDataBacktesting(
        strategy,
        backtesting_start,
        backtesting_end,
    )
    
    # Run the backtest and get the results
    results = engine.run()
    print(results)
`;

const CodeEditorImproved = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('code');
  const [assetInput, setAssetInput] = useState('');
  const [codeValue, setCodeValue] = useState(lumibotTemplate);
  
  const defaultValues: CodeStrategyFormValues = {
    name: 'New Lumibot Strategy',
    description: 'A custom trading strategy implemented using Lumibot',
    type: 'custom',
    source: {
      type: 'code',
      content: lumibotTemplate,
    },
    configuration: {
      assets: ['AAPL'],
      parameters: {},
      riskControls: {
        maxPositionSize: 10,
        stopLoss: 5,
        takeProfit: 15,
      },
      schedule: {
        isActive: true,
        timezone: 'America/New_York',
        activeDays: [1, 2, 3, 4, 5], // Monday to Friday
        activeHours: {
          start: '09:30',
          end: '16:00',
        },
      },
    },
  };

  const form = useForm<CodeStrategyFormValues>({
    resolver: zodResolver(codeStrategySchema),
    defaultValues,
  });

  // Synchronize code editor with form value
  useEffect(() => {
    form.setValue('source.content', codeValue);
  }, [codeValue, form]);

  const createStrategy = useMutation({
    mutationFn: (data: CodeStrategyFormValues) => postData('/api/strategies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: 'Strategy created',
        description: 'Your Lumibot strategy has been saved successfully.',
      });
      navigate('/strategies');
    },
    onError: (error) => {
      toast({
        title: 'Failed to create strategy',
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (values: CodeStrategyFormValues) => {
    createStrategy.mutate(values);
  };

  const addAsset = () => {
    if (!assetInput) return;
    
    // Split input by commas or spaces to handle multiple tickers at once
    const inputTickers = assetInput
      .split(/[,\s]+/) // Split by commas or any whitespace
      .map(ticker => ticker.trim().toUpperCase())
      .filter(ticker => ticker.length > 0); // Filter out empty entries
    
    // Get current assets
    const assets = form.getValues('configuration.assets');
    
    // Add new tickers that aren't already in the list
    const newAssets = [...assets];
    let addedCount = 0;
    
    inputTickers.forEach(ticker => {
      if (!newAssets.includes(ticker)) {
        newAssets.push(ticker);
        addedCount++;
      }
    });
    
    // Update form assets
    if (addedCount > 0) {
      form.setValue('configuration.assets', newAssets);
    }
    
    setAssetInput('');
  };

  const removeAsset = (asset: string) => {
    const assets = form.getValues('configuration.assets');
    form.setValue(
      'configuration.assets',
      assets.filter((a) => a !== asset)
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom Strategy Code Editor</CardTitle>
          <CardDescription>
            Create or modify a Lumibot trading strategy directly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="code">Code Editor</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>
            
            <Form {...form}>
              <form id="code-strategy-form" onSubmit={form.handleSubmit(onSubmit)}>
                <TabsContent value="code" className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Code Editor</AlertTitle>
                    <AlertDescription>
                      Edit your Lumibot strategy code below. This code will be executed when your strategy is deployed.
                    </AlertDescription>
                  </Alert>
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Strategy Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter a strategy name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe what your strategy does" 
                            className="h-24"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="source.content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Strategy Code</FormLabel>
                        <FormControl>
                          <div className="border rounded-md overflow-hidden">
                            <CodeMirror
                              value={codeValue}
                              height="500px"
                              extensions={[python()]}
                              onChange={(value) => {
                                setCodeValue(value);
                                field.onChange(value);
                              }}
                              theme="dark"
                              basicSetup={{
                                lineNumbers: true,
                                highlightActiveLineGutter: true,
                                highlightSpecialChars: true,
                                foldGutter: true,
                                drawSelection: true,
                                dropCursor: true,
                                allowMultipleSelections: true,
                                indentOnInput: true,
                                syntaxHighlighting: true,
                                bracketMatching: true,
                                closeBrackets: true,
                                autocompletion: true,
                                rectangularSelection: true,
                                crosshairCursor: true,
                                highlightActiveLine: true,
                                highlightSelectionMatches: true,
                                closeBracketsKeymap: true,
                                searchKeymap: true,
                                foldKeymap: true,
                                completionKeymap: true,
                                lintKeymap: true,
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                  <FormField
                    control={form.control}
                    name="configuration.riskControls.maxPositionSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Position Size (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            max="100" 
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum percentage of portfolio to allocate to a single position
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="configuration.riskControls.stopLoss"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stop Loss (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Percentage loss at which to exit a position
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="configuration.riskControls.takeProfit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Take Profit (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Percentage gain at which to exit a position
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="assets" className="space-y-6">
                  <FormItem>
                    <FormLabel>Trading Assets</FormLabel>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Add assets (e.g. AAPL MSFT GOOG or AAPL,MSFT,GOOG)"
                        value={assetInput}
                        onChange={(e) => setAssetInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAsset();
                          }
                        }}
                      />
                      <Button type="button" onClick={addAsset}>
                        Add
                      </Button>
                    </div>
                    <FormDescription>
                      Add the assets you want this strategy to trade. You can paste multiple symbols at once separated by spaces or commas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Selected Assets:</h4>
                    <div className="flex flex-wrap gap-2">
                      {form.watch("configuration.assets").map((asset) => (
                        <div
                          key={asset}
                          className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-md flex items-center border border-primary/20 w-auto h-8"
                        >
                          <span>{asset}</span>
                          <button
                            type="button"
                            className="ml-2 text-primary hover:text-primary/80"
                            onClick={() => removeAsset(asset)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="space-y-6">
                  <FormField
                    control={form.control}
                    name="configuration.schedule.isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Activate Schedule</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="configuration.schedule.timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                            <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                            <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Active Days</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 0, label: "Sun" },
                        { value: 1, label: "Mon" },
                        { value: 2, label: "Tue" },
                        { value: 3, label: "Wed" },
                        { value: 4, label: "Thu" },
                        { value: 5, label: "Fri" },
                        { value: 6, label: "Sat" },
                      ].map((day) => (
                        <FormField
                          key={day.value}
                          control={form.control}
                          name="configuration.schedule.activeDays"
                          render={({ field }) => {
                            const isActive = field.value.includes(day.value);
                            return (
                              <Button
                                type="button"
                                variant={isActive ? "default" : "outline"}
                                className="h-8 px-2"
                                onClick={() => {
                                  const activeDays = isActive
                                    ? field.value.filter((d) => d !== day.value)
                                    : [...field.value, day.value];
                                  field.onChange(activeDays);
                                }}
                              >
                                {day.label}
                              </Button>
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="configuration.schedule.activeHours.start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="configuration.schedule.activeHours.end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </form>
            </Form>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/strategies')}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                navigate('/backtest');
                toast({
                  title: 'Strategy ready for backtesting',
                  description: 'Please configure your backtest parameters',
                });
              }}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Backtest
            </Button>
            <Button 
              type="submit"
              form="code-strategy-form"
              disabled={createStrategy.isPending}
            >
              {createStrategy.isPending ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Strategy
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CodeEditorImproved;