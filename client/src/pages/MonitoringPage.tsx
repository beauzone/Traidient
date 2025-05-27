import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Users,
  Bot,
  Zap,
  Bell,
  Settings,
  BarChart3,
  Shield,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeConnections: number;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface TradingMetrics {
  totalPortfolioValue: number;
  dailyPnL: number;
  activePositions: number;
  activeStrategies: number;
  activeBots: number;
  totalTrades: number;
  errorRate: number;
}

interface DataProviderStatus {
  alpaca: 'connected' | 'degraded' | 'disconnected';
  yahoo: 'connected' | 'degraded' | 'disconnected';
  polygon: 'connected' | 'degraded' | 'disconnected';
  latency: {
    alpaca: number;
    yahoo: number;
    polygon: number;
  };
}

interface AlertRule {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  conditions: {
    type: string;
    metric: string;
    operator: string;
    threshold: number;
  };
  lastTriggered?: string;
  triggerCount: number;
}

export default function MonitoringPage() {
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const queryClient = useQueryClient();

  // Fetch system health
  const { data: systemHealth, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: refreshInterval * 1000,
  });

  // Fetch trading metrics
  const { data: tradingMetrics, isLoading: metricsLoading } = useQuery<TradingMetrics>({
    queryKey: ['/api/monitoring/metrics'],
    refetchInterval: refreshInterval * 1000,
  });

  // Fetch data provider status
  const { data: dataStatus, isLoading: dataLoading } = useQuery<DataProviderStatus>({
    queryKey: ['/api/monitoring/data-status'],
    refetchInterval: refreshInterval * 1000,
  });

  // Fetch alert rules
  const { data: alertRules, isLoading: alertsLoading } = useQuery<AlertRule[]>({
    queryKey: ['/api/monitoring/alerts'],
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
      case 'disconnected':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">Real-time monitoring and alerts for your trading platform</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="refresh">Refresh Rate (seconds):</Label>
            <Input
              id="refresh"
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-20"
              min="5"
              max="300"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trading">Trading Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alert Management</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* System Health Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                {systemHealth && getStatusIcon(systemHealth.status)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {systemHealth?.status || 'Loading...'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uptime: {systemHealth ? formatUptime(systemHealth.uptime) : '---'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemHealth?.responseTime || '---'}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  {systemHealth?.activeConnections || 0} active connections
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemHealth?.memoryUsage || '---'}MB
                </div>
                <p className="text-xs text-muted-foreground">
                  CPU: {systemHealth?.cpuUsage || 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${tradingMetrics?.totalPortfolioValue?.toLocaleString() || '---'}
                </div>
                <p className={`text-xs flex items-center ${
                  (tradingMetrics?.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(tradingMetrics?.dailyPnL || 0) >= 0 ? 
                    <TrendingUp className="h-3 w-3 mr-1" /> : 
                    <TrendingDown className="h-3 w-3 mr-1" />
                  }
                  ${Math.abs(tradingMetrics?.dailyPnL || 0).toLocaleString()} today
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Data Provider Status */}
          <Card>
            <CardHeader>
              <CardTitle>Data Provider Status</CardTitle>
              <CardDescription>Real-time status of market data connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {dataStatus?.alpaca === 'connected' ? 
                      <Wifi className="h-5 w-5 text-green-500" /> : 
                      <WifiOff className="h-5 w-5 text-red-500" />
                    }
                    <div>
                      <p className="font-medium">Alpaca</p>
                      <p className="text-sm text-muted-foreground">
                        {dataStatus?.latency?.alpaca || 0}ms latency
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(dataStatus?.alpaca || 'disconnected')}>
                    {dataStatus?.alpaca || 'Unknown'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {dataStatus?.yahoo === 'connected' ? 
                      <Wifi className="h-5 w-5 text-green-500" /> : 
                      <WifiOff className="h-5 w-5 text-red-500" />
                    }
                    <div>
                      <p className="font-medium">Yahoo Finance</p>
                      <p className="text-sm text-muted-foreground">
                        {dataStatus?.latency?.yahoo || 0}ms latency
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(dataStatus?.yahoo || 'disconnected')}>
                    {dataStatus?.yahoo || 'Unknown'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {dataStatus?.polygon === 'connected' ? 
                      <Wifi className="h-5 w-5 text-green-500" /> : 
                      <WifiOff className="h-5 w-5 text-red-500" />
                    }
                    <div>
                      <p className="font-medium">Polygon</p>
                      <p className="text-sm text-muted-foreground">
                        {dataStatus?.latency?.polygon || 0}ms latency
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(dataStatus?.polygon || 'disconnected')}>
                    {dataStatus?.polygon || 'Unknown'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tradingMetrics?.activePositions || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all strategies
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tradingMetrics?.activeStrategies || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Running strategies
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tradingMetrics?.activeBots || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Automated trading bots
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tradingMetrics?.totalTrades || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Executed today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(tradingMetrics?.errorRate || 0).toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 24 hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  (tradingMetrics?.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${(tradingMetrics?.dailyPnL || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Since market open
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>
                Configure monitoring alerts for your trading system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alertsLoading ? (
                  <p>Loading alert rules...</p>
                ) : alertRules && alertRules.length > 0 ? (
                  alertRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{rule.name}</h4>
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={rule.isActive ? "default" : "secondary"}>
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Triggered {rule.triggerCount} times
                          </span>
                          {rule.lastTriggered && (
                            <span className="text-xs text-muted-foreground">
                              Last: {new Date(rule.lastTriggered).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertDescription>
                      No alert rules configured. Create your first alert to monitor portfolio changes, system health, or trading performance.
                    </AlertDescription>
                  </Alert>
                )}
                <Button className="w-full">
                  <Bell className="h-4 w-4 mr-2" />
                  Create New Alert
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  System and trading performance over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    Performance charts and detailed analytics will be displayed here. 
                    Historical data includes response times, trade execution latency, 
                    and system resource usage trends.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}