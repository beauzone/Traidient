import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Play, Pause, RotateCcw, StopCircle, Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { postData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Deployment, Strategy } from "@/types";

const deploymentSchema = z.object({
  strategyId: z.number({
    required_error: "Please select a strategy",
  }),
  environment: z.enum(["paper", "live"], {
    required_error: "Please select an environment",
  }),
  exchange: z.string({
    required_error: "Please select an exchange",
  }),
  configuration: z.object({
    capital: z.number().min(1, "Initial capital must be at least 1"),
    startDate: z.string(),
    parameters: z.record(z.any()).optional(),
  }),
});

type DeploymentFormValues = z.infer<typeof deploymentSchema>;

interface DeploymentPanelProps {
  strategies: Strategy[];
  deployments: Deployment[];
  onSelectDeployment: (deploymentId: number) => void;
  onStatusChange: (deploymentId: number, status: string) => void;
  isLoading: boolean;
  selectedDeploymentId: number | null;
}

const DeploymentPanel = ({ 
  strategies, 
  deployments,
  onSelectDeployment,
  onStatusChange,
  isLoading,
  selectedDeploymentId
}: DeploymentPanelProps) => {
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<DeploymentFormValues>({
    resolver: zodResolver(deploymentSchema),
    defaultValues: {
      environment: "paper",
      exchange: "alpaca",
      configuration: {
        capital: 10000,
        startDate: new Date().toISOString(),
      },
    },
  });

  const deployStrategy = useMutation({
    mutationFn: (data: DeploymentFormValues) => postData('/api/deployments', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments'] });
      toast({
        title: "Strategy deployed",
        description: "Your strategy is now running in the selected environment.",
      });
      setIsDeployDialogOpen(false);
      onSelectDeployment(data.id);
    },
    onError: (error) => {
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: DeploymentFormValues) => {
    deployStrategy.mutate(values);
  };

  // Helper to get the status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="outline" className="bg-green-500 bg-opacity-20 text-green-500 border-none">Running</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-yellow-500 bg-opacity-20 text-yellow-500 border-none">Paused</Badge>;
      case 'stopped':
        return <Badge variant="outline" className="bg-muted bg-opacity-20 text-muted-foreground border-none">Stopped</Badge>;
      case 'starting':
        return <Badge variant="outline" className="bg-blue-500 bg-opacity-20 text-blue-500 border-none">Starting</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-destructive bg-opacity-20 text-destructive border-none">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>
            Manage your live trading strategies
          </CardDescription>
        </div>
        <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Deploy Strategy
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deploy Trading Strategy</DialogTitle>
              <DialogDescription>
                Configure and deploy a strategy for live trading
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="strategyId"
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
                          {strategies.map((strategy) => (
                            <SelectItem key={strategy.id} value={strategy.id.toString()}>
                              {strategy.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the strategy you want to deploy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="environment"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Trading Environment</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="paper" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Paper Trading (Simulated)
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="live" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Live Trading (Real Money)
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exchange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exchange</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an exchange" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="alpaca">Alpaca</SelectItem>
                          <SelectItem value="binance">Binance</SelectItem>
                          <SelectItem value="coinbase">Coinbase</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the exchange for execution
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="configuration.capital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Capital</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="10000" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Starting capital for this deployment
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={deployStrategy.isPending}>
                    {deployStrategy.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deploying...
                      </>
                    ) : (
                      "Deploy Strategy"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No active deployments found</p>
            <p className="text-sm text-muted-foreground mt-1">Deploy a strategy to start trading</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deployments.map((deployment) => {
              const strategy = strategies.find(s => s.id === deployment.strategyId);
              const isSelected = selectedDeploymentId === deployment.id;
              
              return (
                <div 
                  key={deployment.id}
                  className={`p-4 rounded-lg border ${isSelected ? 'border-primary bg-primary/5' : 'border-border'} 
                              hover:border-primary/50 transition-colors cursor-pointer`}
                  onClick={() => onSelectDeployment(deployment.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        <h3 className="font-medium">{strategy?.name || `Strategy #${deployment.strategyId}`}</h3>
                        <div className="ml-2">{getStatusBadge(deployment.status)}</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {deployment.environment === 'paper' ? 'Paper Trading' : 'Live Trading'} on {deployment.exchange}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      {deployment.status === 'running' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(deployment.id, 'paused');
                          }}
                          title="Pause"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {deployment.status === 'paused' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(deployment.id, 'running');
                          }}
                          title="Resume"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {deployment.status === 'error' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(deployment.id, 'inactive');
                          }}
                          title="Reset Error"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(deployment.id, 'stopped');
                        }}
                        title="Stop"
                      >
                        <StopCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {deployment.performance && (
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Value</p>
                        <p className="font-medium">
                          ${deployment.performance.currentValue?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">P&L</p>
                        <p className={`font-medium ${
                          (deployment.performance.profitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {(deployment.performance.profitLoss || 0) >= 0 ? '+' : ''}
                          {deployment.performance.profitLoss?.toFixed(2) || '0.00'}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trades</p>
                        <p className="font-medium">{deployment.performance.trades || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="font-medium">{deployment.performance.winRate?.toFixed(1) || '0.0'}%</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          {deployments.filter(d => d.status === 'running').length} active deployment(s)
        </p>
      </CardFooter>
    </Card>
  );
};

export default DeploymentPanel;
