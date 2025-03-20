import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Award, BarChart2, TrendingUp, Minimize2 } from "lucide-react";
import { postData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OptimizeStrategyProps {
  strategyId: number;
  strategyCode: string;
  backtestId: number;
  backtestResults: any;
  onOptimizationApplied: (optimizedStrategy: string) => void;
}

const optimizationGoals = [
  {
    id: "max-return",
    label: "Maximize Returns",
    description: "Optimize for highest total returns, even if it means higher risk",
    icon: TrendingUp,
  },
  {
    id: "max-sharpe",
    label: "Maximize Sharpe Ratio",
    description: "Balance returns and risk for the best risk-adjusted performance",
    icon: BarChart2,
  },
  {
    id: "min-drawdown",
    label: "Minimize Drawdowns",
    description: "Focus on reducing losses and volatility, even if returns are lower",
    icon: Minimize2,
  },
  {
    id: "max-win-rate",
    label: "Maximize Win Rate",
    description: "Increase the percentage of winning trades over losing trades",
    icon: Award,
  },
];

const OptimizeStrategy = ({ 
  strategyId, 
  strategyCode, 
  backtestId, 
  backtestResults,
  onOptimizationApplied
}: OptimizeStrategyProps) => {
  const [selectedGoal, setSelectedGoal] = useState("max-sharpe");
  const [activeTab, setActiveTab] = useState("original");
  const { toast } = useToast();
  
  const optimizeMutation = useMutation({
    mutationFn: (optimizationGoal: string) => 
      postData('/api/bot-builder/optimize', { 
        strategyCode, 
        backtestResults, 
        optimizationGoal 
      }),
    onSuccess: (data) => {
      toast({
        title: "Strategy optimization complete",
        description: "AI has suggested improvements based on your backtest results",
      });
      setActiveTab("optimized");
    },
    onError: (error: any) => {
      console.error("Strategy optimization error:", error);
      const errorMessage = error?.response?.data?.message || 
                          (error instanceof Error ? error.message : "Failed to optimize strategy");
      
      // Check if it's an API key issue
      const isApiKeyIssue = errorMessage.toLowerCase().includes("api key") || 
                            errorMessage.toLowerCase().includes("authentication");
      
      toast({
        title: "Optimization failed",
        description: isApiKeyIssue 
          ? "OpenAI API key is invalid or missing. Please contact an administrator."
          : errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleOptimize = () => {
    let optimizationGoalText;
    
    switch (selectedGoal) {
      case "max-return":
        optimizationGoalText = "Maximize total returns while maintaining reasonable risk parameters.";
        break;
      case "max-sharpe":
        optimizationGoalText = "Optimize the strategy for the best Sharpe ratio (risk-adjusted returns).";
        break;
      case "min-drawdown":
        optimizationGoalText = "Minimize maximum drawdown and overall volatility, even if it means lower returns.";
        break;
      case "max-win-rate":
        optimizationGoalText = "Maximize the win rate (percentage of profitable trades).";
        break;
      default:
        optimizationGoalText = "Provide general improvements based on backtest results.";
    }
    
    optimizeMutation.mutate(optimizationGoalText);
  };

  const handleApplyChanges = () => {
    if (optimizeMutation.data) {
      onOptimizationApplied(optimizeMutation.data.optimizedStrategy);
      toast({
        title: "Changes applied",
        description: "Optimized strategy has been applied to your code editor",
      });
    }
  };

  const SelectedGoalIcon = optimizationGoals.find(g => g.id === selectedGoal)?.icon || TrendingUp;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <SelectedGoalIcon className="mr-2 h-5 w-5" />
          AI Strategy Optimization
        </CardTitle>
        <CardDescription>
          Let AI analyze your backtest results and suggest improvements to your strategy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!optimizeMutation.data ? (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Select optimization goal:</h3>
              <RadioGroup 
                value={selectedGoal} 
                onValueChange={setSelectedGoal}
                className="grid grid-cols-1 md:grid-cols-2 gap-2"
              >
                {optimizationGoals.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <div key={goal.id} className="flex items-start space-x-2">
                      <RadioGroupItem value={goal.id} id={goal.id} className="mt-1" />
                      <div className="grid gap-1.5">
                        <Label htmlFor={goal.id} className="flex items-center">
                          <Icon className="mr-1.5 h-4 w-4" />
                          {goal.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{goal.description}</p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
            
            <Alert>
              <AlertTitle className="flex items-center text-sm">
                <SelectedGoalIcon className="mr-2 h-4 w-4" />
                How this works
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Our AI will analyze your strategy and backtest results to suggest specific improvements
                aligned with your selected goal. You'll be able to review the suggested changes before
                applying them to your strategy.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="original">Original Strategy</TabsTrigger>
              <TabsTrigger value="optimized">Optimized Strategy</TabsTrigger>
            </TabsList>
            
            <TabsContent value="original" className="space-y-4 mt-4">
              <ScrollArea className="h-48 w-full rounded-md border p-4">
                <pre className="text-xs whitespace-pre-wrap">{strategyCode}</pre>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="optimized" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Changes Made:</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {optimizeMutation.data?.changes || "No specific changes detailed."}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium">Expected Improvements:</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {optimizeMutation.data?.expectedImprovements || "No specific improvements detailed."}
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-sm font-medium">Optimized Code:</h3>
                  <ScrollArea className="h-48 w-full rounded-md border p-4 mt-2">
                    <pre className="text-xs whitespace-pre-wrap">{optimizeMutation.data?.optimizedStrategy}</pre>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {!optimizeMutation.data ? (
          <Button 
            onClick={handleOptimize}
            disabled={optimizeMutation.isPending}
            className="w-full"
          >
            {optimizeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing...
              </>
            ) : (
              <>
                <SelectedGoalIcon className="mr-2 h-4 w-4" /> Optimize Strategy
              </>
            )}
          </Button>
        ) : (
          <>
            <Button 
              variant="outline" 
              onClick={() => optimizeMutation.reset()}
            >
              Start Over
            </Button>
            <Button 
              onClick={handleApplyChanges}
            >
              Apply Changes
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default OptimizeStrategy;