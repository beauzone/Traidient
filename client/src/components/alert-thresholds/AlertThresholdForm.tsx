import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { postData, updateData } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

// Define alert threshold schema
const alertThresholdSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  enabled: z.boolean().default(true),
  conditions: z.object({
    symbol: z.string().optional(),
    strategyId: z.number().optional(),
    deploymentId: z.number().optional(),
    price: z.number().optional(),
    priceDirection: z.enum(['above', 'below']).optional(),
    changePercent: z.number().optional(),
    timeframe: z.string().optional(),
    volume: z.number().optional(),
    profitLossAmount: z.number().optional(),
    profitLossPercent: z.number().optional(),
    eventType: z.enum(['market_open', 'market_close', 'earnings', 'economic_announcement']).optional(),
    indicator: z.object({
      type: z.enum(['ma', 'ema', 'rsi', 'macd', 'bollinger']),
      parameters: z.record(z.any()),
      condition: z.string()
    }).optional(),
    filters: z.record(z.any()).optional()
  }).refine((data) => {
    // Custom validation based on type
    const isValid = true; // We'll implement proper validation
    return isValid;
  }, {
    message: "Missing required fields for this alert type",
  }),
  notifications: z.object({
    channels: z.array(z.string()),
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
    throttle: z.object({
      enabled: z.boolean(),
      maxPerDay: z.number().optional(),
      cooldownMinutes: z.number().optional()
    }).optional()
  })
});

type AlertThresholdFormValues = z.infer<typeof alertThresholdSchema>;

interface AlertThresholdFormProps {
  threshold?: any; // The existing threshold to edit (optional)
  onClose: () => void;
  onSuccess: () => void;
}

export const AlertThresholdForm: React.FC<AlertThresholdFormProps> = ({ 
  threshold, 
  onClose, 
  onSuccess 
}) => {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState(threshold?.type || 'price');
  const [userWatchlist, setUserWatchlist] = useState<{symbol: string, name: string}[]>([]);
  const [userStrategies, setUserStrategies] = useState<{id: number, name: string}[]>([]);

  // Fetch watchlist items and strategies for dropdowns
  useEffect(() => {
    // Fetch watchlist
    fetch('/api/watchlist')
      .then(res => res.json())
      .then(data => setUserWatchlist(data))
      .catch(err => console.error('Error fetching watchlist:', err));
    
    // Fetch strategies
    fetch('/api/strategies')
      .then(res => res.json())
      .then(data => setUserStrategies(data))
      .catch(err => console.error('Error fetching strategies:', err));
  }, []);

  // Create alert mutation
  const createAlert = useMutation({
    mutationFn: (data: AlertThresholdFormValues) => postData('/api/alert-thresholds', data),
    onSuccess: () => {
      toast({
        title: "Alert created",
        description: "Your alert threshold has been created successfully.",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to create alert",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Update alert mutation
  const updateAlert = useMutation({
    mutationFn: (data: AlertThresholdFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      return updateData(`/api/alert-thresholds/${id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Alert updated",
        description: "Your alert threshold has been updated successfully.",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to update alert",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Setup form with default values
  const defaultValues: AlertThresholdFormValues = threshold ? {
    ...threshold,
  } : {
    name: '',
    type: 'price',
    enabled: true,
    conditions: {
      symbol: '',
      priceDirection: 'above',
      price: 0,
      timeframe: '1d',
    },
    notifications: {
      channels: ['app'],
      severity: 'medium',
      throttle: {
        enabled: false,
        maxPerDay: 5,
        cooldownMinutes: 30
      }
    }
  };
  
  const form = useForm<AlertThresholdFormValues>({
    resolver: zodResolver(alertThresholdSchema),
    defaultValues: defaultValues
  });

  // Update form when type changes
  useEffect(() => {
    const type = form.watch('type');
    setSelectedType(type);
    
    // Reset conditions based on type
    let conditions = {};
    
    switch (type) {
      case 'price':
        conditions = {
          symbol: form.getValues('conditions.symbol') || '',
          priceDirection: form.getValues('conditions.priceDirection') || 'above',
          price: form.getValues('conditions.price') || 0
        };
        break;
      case 'price_change_percent':
        conditions = {
          symbol: form.getValues('conditions.symbol') || '',
          changePercent: form.getValues('conditions.changePercent') || 5,
          timeframe: form.getValues('conditions.timeframe') || '1d'
        };
        break;
      case 'volume':
        conditions = {
          symbol: form.getValues('conditions.symbol') || '',
          volume: form.getValues('conditions.volume') || 0
        };
        break;
      case 'position_profit_loss':
        conditions = {
          symbol: form.getValues('conditions.symbol') || '',
          profitLossPercent: form.getValues('conditions.profitLossPercent') || 0
        };
        break;
      case 'strategy_performance':
        conditions = {
          strategyId: form.getValues('conditions.strategyId') || null
        };
        break;
      case 'market_event':
        conditions = {
          eventType: form.getValues('conditions.eventType') || 'market_open'
        };
        break;
      case 'technical_indicator':
        conditions = {
          symbol: form.getValues('conditions.symbol') || '',
          indicator: form.getValues('conditions.indicator') || {
            type: 'ma',
            parameters: { period: 20 },
            condition: 'cross_above'
          }
        };
        break;
    }
    
    form.setValue('conditions', conditions as any);
  }, [form.watch('type')]);

  // Handle form submission
  const onSubmit = (values: AlertThresholdFormValues) => {
    if (threshold) {
      updateAlert.mutate({ ...values, id: threshold.id });
    } else {
      createAlert.mutate(values);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter a name for this alert" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select alert type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="price">Price Alert</SelectItem>
                      <SelectItem value="price_change_percent">Price Change %</SelectItem>
                      <SelectItem value="volume">Volume Alert</SelectItem>
                      <SelectItem value="position_profit_loss">Profit/Loss Alert</SelectItem>
                      <SelectItem value="strategy_performance">Strategy Performance</SelectItem>
                      <SelectItem value="market_event">Market Event</SelectItem>
                      <SelectItem value="technical_indicator">Technical Indicator</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of alert to create
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Render different condition fields based on alert type */}
            {selectedType === 'price' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a symbol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userWatchlist.map(item => (
                            <SelectItem key={item.symbol} value={item.symbol}>
                              {item.symbol} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.priceDirection"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Price Direction</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="above" id="above" />
                            <Label htmlFor="above">Above</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="below" id="below" />
                            <Label htmlFor="below">Below</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Threshold ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          placeholder="Enter price threshold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === 'price_change_percent' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a symbol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userWatchlist.map(item => (
                            <SelectItem key={item.symbol} value={item.symbol}>
                              {item.symbol} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.changePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Change Percentage (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          placeholder="Enter percentage change"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert will trigger when the price changes by this percentage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.timeframe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeframe</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1h">1 Hour</SelectItem>
                          <SelectItem value="1d">1 Day</SelectItem>
                          <SelectItem value="1w">1 Week</SelectItem>
                          <SelectItem value="1m">1 Month</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === 'volume' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a symbol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userWatchlist.map(item => (
                            <SelectItem key={item.symbol} value={item.symbol}>
                              {item.symbol} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.volume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume Threshold</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="Enter volume threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert will trigger when volume exceeds this value
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === 'position_profit_loss' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol (Optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All positions (portfolio)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All Positions (Portfolio)</SelectItem>
                          {userWatchlist.map(item => (
                            <SelectItem key={item.symbol} value={item.symbol}>
                              {item.symbol} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Leave empty to monitor entire portfolio P&L
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.profitLossPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profit/Loss Percentage (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          placeholder="Enter P&L percentage threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert will trigger when P&L reaches this percentage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === 'strategy_performance' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.strategyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a strategy" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userStrategies.map(strategy => (
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
              </>
            )}

            {selectedType === 'market_event' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="market_open">Market Open</SelectItem>
                          <SelectItem value="market_close">Market Close</SelectItem>
                          <SelectItem value="earnings">Earnings Announcement</SelectItem>
                          <SelectItem value="economic_announcement">Economic Announcement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedType === 'technical_indicator' && (
              <>
                <FormField
                  control={form.control}
                  name="conditions.symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a symbol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userWatchlist.map(item => (
                            <SelectItem key={item.symbol} value={item.symbol}>
                              {item.symbol} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.indicator.type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indicator</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select indicator type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ma">Moving Average (MA)</SelectItem>
                          <SelectItem value="ema">Exponential Moving Average (EMA)</SelectItem>
                          <SelectItem value="rsi">Relative Strength Index (RSI)</SelectItem>
                          <SelectItem value="macd">MACD</SelectItem>
                          <SelectItem value="bollinger">Bollinger Bands</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conditions.indicator.condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cross_above">Crosses Above</SelectItem>
                          <SelectItem value="cross_below">Crosses Below</SelectItem>
                          <SelectItem value="above">Above Threshold</SelectItem>
                          <SelectItem value="below">Below Threshold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>

          {/* Right column - Notification settings */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Notification Settings</h3>
              
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Enable Alert</FormLabel>
                      <FormDescription>
                        Toggle to enable or disable this alert
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div>
              <h4 className="text-md font-medium mb-2">Alert Channels</h4>
              
              <FormField
                control={form.control}
                name="notifications.channels"
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Checkbox 
                          id="app" 
                          checked={field.value.includes('app')}
                          onCheckedChange={(checked) => {
                            const updatedValue = checked 
                              ? [...field.value, 'app']
                              : field.value.filter(val => val !== 'app');
                            field.onChange(updatedValue);
                          }}
                        />
                        <label
                          htmlFor="app"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          In-App Notification
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <Checkbox 
                          id="email" 
                          checked={field.value.includes('email')}
                          onCheckedChange={(checked) => {
                            const updatedValue = checked 
                              ? [...field.value, 'email']
                              : field.value.filter(val => val !== 'email');
                            field.onChange(updatedValue);
                          }}
                        />
                        <label
                          htmlFor="email"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Email
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="sms" 
                          checked={field.value.includes('sms')}
                          onCheckedChange={(checked) => {
                            const updatedValue = checked 
                              ? [...field.value, 'sms']
                              : field.value.filter(val => val !== 'sms');
                            field.onChange(updatedValue);
                          }}
                        />
                        <label
                          htmlFor="sms"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          SMS (requires verified phone number)
                        </label>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div>
              <h4 className="text-md font-medium mb-2">Alert Severity</h4>
              
              <FormField
                control={form.control}
                name="notifications.severity"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Set the importance level of this alert
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-md font-medium">Throttling Settings</h4>
                
                <FormField
                  control={form.control}
                  name="notifications.throttle.enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm">Enable Throttling</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              
              {form.watch('notifications.throttle.enabled') && (
                <div className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="notifications.throttle.maxPerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Alerts Per Day</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            placeholder="Enter max alerts per day"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum number of alerts to receive per day
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notifications.throttle.cooldownMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cooldown Period (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            placeholder="Enter cooldown period in minutes"
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum time between alerts
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createAlert.isPending || updateAlert.isPending}
          >
            {(createAlert.isPending || updateAlert.isPending) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {threshold ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              threshold ? 'Update Alert' : 'Create Alert'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};