import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { AccountProvider } from "@/context/AccountContext";
import { useAuth } from "@/hooks/useAuth";

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Strategies from "@/pages/strategies"; // Renamed from bot-builder to strategies
import EditStrategy from "@/pages/edit-strategy";
import Screeners from "@/pages/screeners"; // New screeners page
import Backtest from "@/pages/backtest";
import Bots from "@/pages/bots"; // New bots (deployment & automation) page
import LiveTrading from "@/pages/live-trading";
import MarketData from "@/pages/market-data";
import MarketTest from "@/pages/market-test";
import Settings from "@/pages/settings";
import NotificationSettings from "@/pages/notification-settings";
import AlertThresholds from "@/pages/alert-thresholds";
import Integrations from "@/pages/integrations";
import BrokerConfiguration from "@/pages/broker-configuration";
import NotFound from "@/pages/not-found";
import DebugPage from "@/pages/debug";
import Webhooks from "@/pages/webhooks";

// Protected Route Component
function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component {...rest} />;
}

function PublicRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>;
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <Component {...rest} />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={Login} />
      </Route>
      <Route path="/register">
        <PublicRoute component={Register} />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      
      {/* Strategy Creation */}
      <Route path="/strategies/new">
        <ProtectedRoute component={EditStrategy} />
      </Route>
      <Route path="/strategies/:id">
        <ProtectedRoute component={EditStrategy} />
      </Route>
      <Route path="/strategies">
        <ProtectedRoute component={Strategies} />
      </Route>
      
      {/* Keep bot-builder route for backward compatibility */}
      <Route path="/bot-builder">
        <Redirect to="/strategies" />
      </Route>
      
      {/* Screeners/Screens */}
      <Route path="/screeners">
        <ProtectedRoute component={Screeners} />
      </Route>
      <Route path="/screens">
        <ProtectedRoute component={Screeners} />
      </Route>
      
      {/* Backtesting */}
      <Route path="/backtest">
        <ProtectedRoute component={Backtest} />
      </Route>
      
      {/* Bots (Deployment & Automation) */}
      <Route path="/bots">
        <ProtectedRoute component={Bots} />
      </Route>
      
      {/* Live Trading Monitor */}
      <Route path="/live-trading">
        <ProtectedRoute component={LiveTrading} />
      </Route>
      
      {/* Market Data */}
      <Route path="/market-data">
        <ProtectedRoute component={MarketData} />
      </Route>
      <Route path="/markets">
        <ProtectedRoute component={MarketData} />
      </Route>
      <Route path="/market-test">
        <ProtectedRoute component={MarketTest} />
      </Route>
      
      {/* Webhooks */}
      <Route path="/webhooks">
        <ProtectedRoute component={Webhooks} />
      </Route>
      
      {/* Settings & Configuration */}
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/notification-settings">
        <ProtectedRoute component={NotificationSettings} />
      </Route>
      <Route path="/alert-thresholds">
        <ProtectedRoute component={AlertThresholds} />
      </Route>
      <Route path="/integrations">
        <ProtectedRoute component={Integrations} />
      </Route>
      <Route path="/broker-configuration">
        <ProtectedRoute component={BrokerConfiguration} />
      </Route>
      
      {/* Debug */}
      <Route path="/debug">
        <ProtectedRoute component={DebugPage} />
      </Route>
      
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AccountProvider>
          <AppRoutes />
          <Toaster />
        </AccountProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
