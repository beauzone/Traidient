import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Deployment, Strategy } from "../../types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Terminal, Box, ChevronDown, ChevronUp } from "lucide-react";

interface StrategyMonitorProps {
  strategies: Strategy[];
  deployments: Deployment[];
  selectedDeployment: Deployment | undefined;
}

const StrategyMonitor = ({ strategies, deployments, selectedDeployment }: StrategyMonitorProps) => {
  const [strategy, setStrategy] = useState<Strategy | undefined>();
  const [showConsole, setShowConsole] = useState(false);
  const [performanceData, setPerformanceData] = useState<{ timestamp: string; value: number }[]>([]);

  // Use effect to set the strategy when selectedDeployment changes
  useEffect(() => {
    if (selectedDeployment) {
      const matchedStrategy = strategies.find(s => s.id === selectedDeployment.strategyId);
      setStrategy(matchedStrategy);
      
      // Generate mock performance data
      if (selectedDeployment.status === 'running') {
        const startDate = new Date(selectedDeployment.createdAt);
        const now = new Date();
        const data = [];
        const initialValue = selectedDeployment.configuration.capital;
        let currentValue = initialValue;
        
        // Generate data points every hour
        for (let d = new Date(startDate); d <= now; d.setHours(d.getHours() + 1)) {
          // Add small random fluctuation
          const change = (Math.random() * 0.02 - 0.01) * currentValue;
          currentValue += change;
          
          data.push({
            timestamp: new Date(d).toISOString(),
            value: currentValue
          });
        }
        
        setPerformanceData(data);
      }
    }
  }, [selectedDeployment, strategies]);

  if (!selectedDeployment || !strategy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Strategy Monitor</CardTitle>
          <CardDescription>
            Select a deployment to monitor its performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No deployment selected</p>
            <p className="text-sm text-muted-foreground mt-1">Select a strategy deployment from the Overview tab</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  // Calculate uptime
  const calculateUptime = () => {
    if (!selectedDeployment.runtime?.lastHeartbeat) return "N/A";
    
    const uptime = selectedDeployment.runtime.uptime || 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{strategy.name}</CardTitle>
              <CardDescription>
                {selectedDeployment.environment === 'paper' ? 'Paper Trading' : 'Live Trading'} on {selectedDeployment.exchange}
              </CardDescription>
            </div>
            <Badge variant="outline" className={`
              ${selectedDeployment.status === 'running' ? 'bg-green-500 bg-opacity-20 text-green-500' : 
                selectedDeployment.status === 'paused' ? 'bg-yellow-500 bg-opacity-20 text-yellow-500' : 
                selectedDeployment.status === 'error' ? 'bg-red-500 bg-opacity-20 text-red-500' : 
                'bg-muted bg-opacity-20 text-muted-foreground'} border-none
            `}>
              {selectedDeployment.status.charAt(0).toUpperCase() + selectedDeployment.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {selectedDeployment.status === 'error' && selectedDeployment.runtime?.errors && selectedDeployment.runtime.errors.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Detected</AlertTitle>
              <AlertDescription>
                {selectedDeployment.runtime.errors[0].message}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-card rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground">Initial Capital</div>
              <div className="text-2xl font-semibold">
                {formatCurrency(selectedDeployment.configuration.capital)}
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground">Current Value</div>
              <div className="text-2xl font-semibold">
                {formatCurrency(selectedDeployment.performance?.currentValue || selectedDeployment.configuration.capital)}
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground">Profit/Loss</div>
              <div className={`text-2xl font-semibold ${
                (selectedDeployment.performance?.profitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {(selectedDeployment.performance?.profitLoss || 0) >= 0 ? '+' : ''}
                {(selectedDeployment.performance?.profitLossPercent || 0).toFixed(2)}%
              </div>
            </div>
            <div className="bg-card rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-2xl font-semibold">
                {selectedDeployment.performance?.trades || 0}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Performance Chart</h3>
              <div className="text-sm text-muted-foreground">
                Started {formatDate(selectedDeployment.createdAt)}
              </div>
            </div>
            <div className="h-64 w-full">
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={performanceData}
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
                      tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      labelFormatter={(label) => new Date(label).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
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
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No performance data available</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-card rounded-lg p-4 border">
              <h3 className="font-medium mb-2">Runtime Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span>{selectedDeployment.status.charAt(0).toUpperCase() + selectedDeployment.status.slice(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Heartbeat:</span>
                  <span>{selectedDeployment.runtime?.lastHeartbeat ? formatTime(selectedDeployment.runtime.lastHeartbeat) : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span>{calculateUptime()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deployed:</span>
                  <span>{formatDate(selectedDeployment.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border">
              <h3 className="font-medium mb-2">Strategy Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{strategy.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Assets:</span>
                  <span>{strategy.configuration.assets.join(', ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk Controls:</span>
                  <span>
                    {strategy.configuration.riskControls ? (
                      `${strategy.configuration.riskControls.maxPositionSize}% max position`
                    ) : 'Default'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{formatDate(strategy.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Button 
              variant="outline" 
              className="w-full flex justify-between items-center"
              onClick={() => setShowConsole(!showConsole)}
            >
              <div className="flex items-center">
                <Terminal className="mr-2 h-4 w-4" />
                Strategy Console
              </div>
              {showConsole ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            
            {showConsole && (
              <div className="mt-4 bg-black rounded-md p-4 font-mono text-xs text-gray-300 h-64 overflow-y-auto">
                <div className="space-y-1">
                  <div>[{formatDate(selectedDeployment.createdAt)} 09:30:00] Strategy started</div>
                  <div>[{formatDate(selectedDeployment.createdAt)} 09:30:05] Connected to {selectedDeployment.exchange}</div>
                  <div>[{formatDate(selectedDeployment.createdAt)} 09:31:22] Analyzing market data for {strategy.configuration.assets.join(', ')}</div>
                  <div>[{formatDate(selectedDeployment.createdAt)} 09:35:12] Executed buy order: AAPL x 10 @ $180.25</div>
                  <div>[{formatDate(selectedDeployment.createdAt)} 10:15:45] Technical indicators updated</div>
                  <div>[{formatDate(selectedDeployment.createdAt)} 11:22:33] Executed sell order: AAPL x 10 @ $182.50</div>
                  <div>[{formatDate(selectedDeployment.createdAt)} 11:22:34] Profit realized: $22.50</div>
                  {selectedDeployment.runtime?.errors && selectedDeployment.runtime.errors.map((error, index) => (
                    <div key={index} className="text-red-500">
                      [{formatDate(error.timestamp)} {formatTime(error.timestamp)}] ERROR: {error.message}
                    </div>
                  ))}
                  <div>[{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}] Strategy running...</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StrategyMonitor;
