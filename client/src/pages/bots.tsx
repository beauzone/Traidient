import MainLayout from "@/components/layout/MainLayout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Bot, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Webhook, 
  Plus, 
  Activity, 
  Clock,
  Zap 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for UI layout - will be replaced with real data
const mockBots = [
  {
    id: 1,
    name: "Daily MACD Crossover",
    status: "active",
    strategy: "MACD Strategy",
    runningTime: "12 days",
    performance: "+8.2%",
    allocatedCapital: "$10,000",
    lastTrade: "2 hours ago",
    type: "strategy"
  },
  {
    id: 2,
    name: "TradingView Signals",
    status: "paused",
    webhook: "tv-macd-alerts",
    performance: "+3.5%",
    allocatedCapital: "$5,000",
    lastTrade: "1 day ago",
    type: "webhook"
  },
  {
    id: 3,
    name: "Mean Reversion Bot",
    status: "inactive",
    strategy: "Mean Reversion",
    performance: "-1.2%",
    allocatedCapital: "$7,500",
    lastTrade: "5 days ago",
    type: "strategy"
  }
];

const Bots = () => {
  return (
    <MainLayout title="Bots">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bots</h1>
          <p className="text-muted-foreground">
            Deploy, manage, and monitor your trading bots
          </p>
        </div>
        <div className="flex space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Deploy Bot
          </Button>
          <Link href="/webhooks">
            <Button variant="outline">
              <Webhook className="mr-2 h-4 w-4" /> TradingView Webhooks
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Bots</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockBots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <CardDescription>
                        {bot.type === "webhook" ? "TradingView Webhook" : "Strategy Bot"}
                      </CardDescription>
                    </div>
                    <Badge variant={
                      bot.status === 'active' ? 'default' : 
                      bot.status === 'paused' ? 'secondary' : 'outline'
                    }>
                      {bot.status.charAt(0).toUpperCase() + bot.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bot.type === 'strategy' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span>{bot.strategy}</span>
                      </div>
                    )}
                    {bot.type === 'webhook' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Webhook:</span>
                        <span>{bot.webhook}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Performance:</span>
                      <span className={`font-medium ${bot.performance.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {bot.performance}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capital:</span>
                      <span>{bot.allocatedCapital}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Trade:</span>
                      <span>{bot.lastTrade}</span>
                    </div>
                    {bot.runningTime && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Running:</span>
                        <span>{bot.runningTime}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <div className="flex space-x-1">
                    {bot.status === "active" ? (
                      <Button variant="outline" size="icon">
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}

            {/* Create Bot Card */}
            <Card className="bg-card border-dashed">
              <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="rounded-full bg-background p-3">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-1 text-center">
                  <h3 className="text-xl font-semibold">Deploy a Trading Bot</h3>
                  <p className="text-muted-foreground text-sm">
                    Turn your strategy into an automated trading bot
                  </p>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Start Deployment
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockBots.filter(bot => bot.status === 'active').map((bot) => (
              <Card key={bot.id}>
                {/* Same content as above but filtered */}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <CardDescription>
                        {bot.type === "webhook" ? "TradingView Webhook" : "Strategy Bot"}
                      </CardDescription>
                    </div>
                    <Badge>Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bot.type === 'strategy' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span>{bot.strategy}</span>
                      </div>
                    )}
                    {bot.type === 'webhook' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Webhook:</span>
                        <span>{bot.webhook}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Performance:</span>
                      <span className={`font-medium ${bot.performance.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {bot.performance}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capital:</span>
                      <span>{bot.allocatedCapital}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Trade:</span>
                      <span>{bot.lastTrade}</span>
                    </div>
                    {bot.runningTime && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Running:</span>
                        <span>{bot.runningTime}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <div className="flex space-x-1">
                    <Button variant="outline" size="icon">
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Other tab contents follow the same pattern */}
        <TabsContent value="paused">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockBots.filter(bot => bot.status === 'paused').map((bot) => (
              <Card key={bot.id}>
                {/* Content for paused bots */}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <CardDescription>
                        {bot.type === "webhook" ? "TradingView Webhook" : "Strategy Bot"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Paused</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Same content structure */}
                  <div className="space-y-2">
                    {bot.type === 'strategy' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span>{bot.strategy}</span>
                      </div>
                    )}
                    {bot.type === 'webhook' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Webhook:</span>
                        <span>{bot.webhook}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Performance:</span>
                      <span className={`font-medium ${bot.performance.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {bot.performance}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capital:</span>
                      <span>{bot.allocatedCapital}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Trade:</span>
                      <span>{bot.lastTrade}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <div className="flex space-x-1">
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inactive">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockBots.filter(bot => bot.status === 'inactive').map((bot) => (
              <Card key={bot.id}>
                {/* Content for inactive bots */}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <CardDescription>
                        {bot.type === "webhook" ? "TradingView Webhook" : "Strategy Bot"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Inactive</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Same content structure */}
                  <div className="space-y-2">
                    {bot.type === 'strategy' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span>{bot.strategy}</span>
                      </div>
                    )}
                    {bot.type === 'webhook' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Webhook:</span>
                        <span>{bot.webhook}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Performance:</span>
                      <span className={`font-medium ${bot.performance.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {bot.performance}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capital:</span>
                      <span>{bot.allocatedCapital}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Trade:</span>
                      <span>{bot.lastTrade}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <div className="flex space-x-1">
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Bots;