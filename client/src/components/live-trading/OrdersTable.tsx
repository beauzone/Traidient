import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchData, deleteData, postData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSnapTrade } from "@/hooks/useSnapTrade";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'bracket';
  status: 'open' | 'new' | 'accepted' | 'filled' | 'executed' | 'partially_filled' | 'canceled' | 'rejected' | 'expired';
  quantity: number;
  filledQuantity: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  bracket?: {
    takeProfitPrice: number;
    stopLossPrice: number;
  };
  createdAt: string;
  updatedAt: string;
  submittedBy: 'user' | 'system';
  strategyName?: string;
}

// Schema for new order form
const orderSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["buy", "sell"], {
    required_error: "Side is required",
  }),
  type: z.enum(["market", "limit", "stop", "stop_limit", "bracket"], {
    required_error: "Order type is required",
  }),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  limitPrice: z.number().optional(),
  stopPrice: z.number().optional(),
  timeInForce: z.enum(["day", "gtc", "opg", "cls", "ioc", "fok"], {
    required_error: "Time in force is required",
  }),
  // Bracket order parameters
  takeProfitPrice: z.number().positive("Take profit price must be positive").optional(),
  stopLossPrice: z.number().positive("Stop loss price must be positive").optional(),
}).refine(data => {
  if (data.type === 'limit' || data.type === 'stop_limit') {
    return data.limitPrice !== undefined && data.limitPrice > 0;
  }
  return true;
}, {
  message: "Limit price is required for limit and stop-limit orders",
  path: ["limitPrice"],
}).refine(data => {
  if (data.type === 'stop' || data.type === 'stop_limit') {
    return data.stopPrice !== undefined && data.stopPrice > 0;
  }
  return true;
}, {
  message: "Stop price is required for stop and stop-limit orders",
  path: ["stopPrice"],
}).refine(data => {
  if (data.type === 'bracket') {
    return data.takeProfitPrice !== undefined && data.stopLossPrice !== undefined;
  }
  return true;
}, {
  message: "Both take profit and stop loss prices are required for bracket orders",
  path: ["takeProfitPrice"],
}).refine(data => {
  if (data.type === 'bracket' && data.side === 'buy') {
    return data.takeProfitPrice! > data.limitPrice! || data.limitPrice === undefined;
  }
  return true;
}, {
  message: "Take profit price must be higher than entry price for buy orders",
  path: ["takeProfitPrice"],
}).refine(data => {
  if (data.type === 'bracket' && data.side === 'buy') {
    return data.stopLossPrice! < data.limitPrice! || data.limitPrice === undefined;
  }
  return true;
}, {
  message: "Stop loss price must be lower than entry price for buy orders",
  path: ["stopLossPrice"],
}).refine(data => {
  if (data.type === 'bracket' && data.side === 'sell') {
    return data.takeProfitPrice! < data.limitPrice! || data.limitPrice === undefined;
  }
  return true;
}, {
  message: "Take profit price must be lower than entry price for sell orders",
  path: ["takeProfitPrice"],
}).refine(data => {
  if (data.type === 'bracket' && data.side === 'sell') {
    return data.stopLossPrice! > data.limitPrice! || data.limitPrice === undefined;
  }
  return true;
}, {
  message: "Stop loss price must be higher than entry price for sell orders",
  path: ["stopLossPrice"],
});

type OrderFormValues = z.infer<typeof orderSchema>;

// Extended type for order data that includes bracket structure
interface OrderDataWithBracket extends Omit<OrderFormValues, 'type'> {
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  bracket?: {
    takeProfitPrice?: number;
    stopLossPrice?: number;
  };
}

// Update OrderFormValues to include bracket property
type OrderFormValuesWithBracket = OrderFormValues & {
  bracket?: {
    takeProfitPrice?: number;
    stopLossPrice?: number;
  };
}

const OrdersTable = () => {
  const [orderTab, setOrderTab] = useState("open");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isReadOnly } = useSnapTrade();

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/trading/orders'],
    queryFn: () => fetchData<Order[]>('/api/trading/orders'),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Filter orders based on tab
  const filteredOrders = orders.filter((order) => {
    if (orderTab === "open") {
      return ["open", "new", "accepted"].includes(order.status);
    } else if (orderTab === "filled") {
      return ["filled", "executed", "partially_filled"].includes(order.status);
    } else if (orderTab === "canceled") {
      return ["canceled", "rejected", "expired"].includes(order.status);
    }
    return true;
  });

  // Set up form for new order
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      symbol: "",
      side: "buy",
      type: "market",
      quantity: 1,
      timeInForce: "day",
    },
  });

  // Watch order type to conditionally show form fields
  const orderType = form.watch("type");

  // Cancel order mutation
  const cancelOrder = useMutation({
    mutationFn: (orderId: string) => deleteData(`/api/trading/orders/${orderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/orders'] });
      toast({
        title: "Order canceled",
        description: "Your order has been canceled successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel order",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Place order mutation
  const placeOrder = useMutation({
    mutationFn: (data: any) => postData('/api/trading/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/orders'] });
      toast({
        title: "Order placed",
        description: "Your order has been submitted successfully.",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to place order",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (values: OrderFormValues) => {
    // Create a modified order based on the values - start with safe copy 
    const orderData: OrderFormValuesWithBracket = { ...values };
    
    // Special handling for bracket orders
    if (values.type === 'bracket') {
      // Convert bracket order to a parent order with take-profit and stop-loss child orders
      orderData.type = 'limit'; // Entry order is a limit order
      orderData.bracket = {
        takeProfitPrice: values.takeProfitPrice,
        stopLossPrice: values.stopLossPrice
      };
      
      // Remove the bracket-specific fields from the main order
      delete orderData.takeProfitPrice;
      delete orderData.stopLossPrice;
    }
    
    placeOrder.mutate(orderData);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
      case 'new':
      case 'accepted':
        return <Badge variant="outline" className="bg-blue-500 bg-opacity-20 text-blue-500 border-none">Open</Badge>;
      case 'filled':
      case 'executed':
      case 'partially_filled':
        return <Badge variant="outline" className="bg-green-500 bg-opacity-20 text-green-500 border-none">Filled</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="bg-yellow-500 bg-opacity-20 text-yellow-500 border-none">Canceled</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500 bg-opacity-20 text-red-500 border-none">Rejected</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-gray-500 bg-opacity-20 text-gray-500 border-none">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Orders</CardTitle>

            {isReadOnly && (
              <div className="flex items-center p-2 mt-2 text-blue-800 border border-blue-200 rounded-lg bg-blue-50 text-xs">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>
                  SnapTrade is currently in read-only mode. Trading capabilities will be available after upgrading from the free plan.
                </span>
              </div>
            )}
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus className="mr-2 h-4 w-4" /> Place Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Place New Order</DialogTitle>

              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="symbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Symbol</FormLabel>
                        <FormControl>
                          <Input placeholder="AAPL" {...field} />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="side"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Side</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select side" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="buy">Buy</SelectItem>
                              <SelectItem value="sell">Sell</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="market">Market</SelectItem>
                              <SelectItem value="limit">Limit</SelectItem>
                              <SelectItem value="stop">Stop</SelectItem>
                              <SelectItem value="stop_limit">Stop Limit</SelectItem>
                              <SelectItem value="bracket">Bracket</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            step="1" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(orderType === "limit" || orderType === "stop_limit") && (
                    <FormField
                      control={form.control}
                      name="limitPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limit Price</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0.01" 
                              step="0.01" 
                              {...field} 
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {(orderType === "stop" || orderType === "stop_limit") && (
                    <FormField
                      control={form.control}
                      name="stopPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stop Price</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0.01" 
                              step="0.01" 
                              {...field} 
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Bracket Order Fields */}
                  {orderType === "bracket" && (
                    <>
                      <FormField
                        control={form.control}
                        name="limitPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entry Price</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0.01" 
                                step="0.01" 
                                {...field} 
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="takeProfitPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Take Profit</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0.01" 
                                  step="0.01" 
                                  {...field} 
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="stopLossPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stop Loss</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0.01" 
                                  step="0.01" 
                                  {...field} 
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="timeInForce"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time in Force</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select time in force" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="gtc">Good Till Canceled</SelectItem>
                            <SelectItem value="opg">Market on Open</SelectItem>
                            <SelectItem value="cls">Market on Close</SelectItem>
                            <SelectItem value="ioc">Immediate or Cancel</SelectItem>
                            <SelectItem value="fok">Fill or Kill</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isReadOnly && (
                    <div className="flex items-center p-3 mb-4 text-blue-800 border border-blue-200 rounded-lg bg-blue-50">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="text-sm">
                        SnapTrade is currently in read-only mode. Orders can only be placed through direct integrations like Alpaca.
                      </span>
                    </div>
                  )}
                  
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={placeOrder.isPending || isReadOnly}
                      title={isReadOnly ? "SnapTrade is in read-only mode" : ""}
                    >
                      {placeOrder.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing Order...
                        </>
                      ) : (
                        "Place Order"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="inline-flex rounded-lg shadow-sm bg-muted/50 p-1">
            {['open', 'filled', 'canceled'].map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 text-sm font-medium rounded-md relative transition-all ${
                  orderTab === tab 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={() => setOrderTab(tab)}
              >
                {tab === 'open' && orders.filter(o => ["open", "new", "accepted"].includes(o.status)).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {orders.filter(o => ["open", "new", "accepted"].includes(o.status)).length}
                  </span>
                )}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <p>No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">Symbol</TableHead>
                  <TableHead className="font-medium">Side</TableHead>
                  <TableHead className="font-medium">Type</TableHead>
                  <TableHead className="font-medium">Quantity</TableHead>
                  <TableHead className="font-medium">Price</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Created At</TableHead>
                  <TableHead className="font-medium">Source</TableHead>
                  <TableHead className="text-right font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{order.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={order.side === 'buy' ? 'default' : 'destructive'} className={order.side === 'sell' ? 'bg-red-500' : ''}>
                          {order.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{order.type.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>
                        {order.filledQuantity > 0 && order.filledQuantity < order.quantity ? (
                          <span>{order.filledQuantity}/{order.quantity}</span>
                        ) : (
                          <span>{order.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.type === 'market' ? (
                          'Market'
                        ) : order.type === 'limit' ? (
                          `$${order.limitPrice?.toFixed(2)}`
                        ) : order.type === 'stop' ? (
                          `Stop $${order.stopPrice?.toFixed(2)}`
                        ) : order.type === 'stop_limit' ? (
                          <div className="text-xs">
                            <div>Stop: ${order.stopPrice?.toFixed(2)}</div>
                            <div>Limit: ${order.limitPrice?.toFixed(2)}</div>
                          </div>
                        ) : order.type === 'bracket' || (order.bracket && order.type === 'limit') ? (
                          <div className="text-xs">
                            <div>Entry: ${order.limitPrice?.toFixed(2)}</div>
                            <div className="text-green-500">TP: ${(order.bracket?.takeProfitPrice || order.takeProfitPrice)?.toFixed(2) || 'N/A'}</div>
                            <div className="text-negative">SL: ${(order.bracket?.stopLossPrice || order.stopLossPrice)?.toFixed(2) || 'N/A'}</div>
                          </div>
                        ) : (
                          order.type
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        {order.submittedBy === 'user' ? (
                          <Badge variant="outline">Manual</Badge>
                        ) : (
                          <Badge variant="outline">{order.strategyName || 'System'}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.status === 'open' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => cancelOrder.mutate(order.id)}
                            disabled={cancelOrder.isPending}
                            title="Cancel Order"
                            className="hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrdersTable;
