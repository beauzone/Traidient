import MainLayout from "@/components/layout/MainLayout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Binoculars, Filter, List, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const Screeners = () => {
  return (
    <MainLayout title="Screens">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screens</h1>
          <p className="text-muted-foreground">
            Create and manage screens to identify trading opportunities
          </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Screen
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder for future screens */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Create Your First Screen</CardTitle>
            <CardDescription>
              Build custom filters to find trading opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Binoculars className="h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                Screens help you scan the market for stocks that match specific criteria
              </p>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Get Started
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Example cards for popular screen types */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Momentum Screen</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Finds stocks with strong price momentum
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price Change:</span>
                <span>+5% over 5 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Volume:</span>
                <span>Above 1M shares</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">RSI:</span>
                <span>Above 65</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span>Example template</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Value Finder</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Identifies undervalued stocks based on fundamentals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">P/E Ratio:</span>
                <span>Below 15</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dividend Yield:</span>
                <span>Above 2%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Debt/Equity:</span>
                <span>Below 0.5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span>Example template</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Screeners;