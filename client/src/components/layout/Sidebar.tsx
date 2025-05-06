import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import UserAvatar from "@/components/common/UserAvatar";

import {
  LineChart,
  Bot,
  Wand2,
  History,
  PlayCircle,
  BarChart4,
  Database,
  Settings,
  Plug,
  HelpCircle,
  X,
  Menu,
  DollarSign,
  Bug,
  BellRing,
  Webhook,
  Binoculars,
  LucideIcon,
  MonitorPlay
} from "lucide-react";

const Sidebar = () => {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Main navigation items based on the new structure and requested order
  const navItems = [
    // Dashboard always comes first
    { path: "/dashboard", name: "Dashboard", icon: <LineChart className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // Trading Monitor
    { path: "/live-trading", name: "Trading", icon: <MonitorPlay className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // Markets (renamed from Market Data)
    { path: "/markets", name: "Markets", icon: <Database className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // Screens (renamed from Screeners)
    { path: "/screens", name: "Screens", icon: <Binoculars className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // Strategies - Where users define trading logic
    { path: "/strategies", name: "Strategies", icon: <Wand2 className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // Bots - Deployment & Automation
    { path: "/bots", name: "Bots", icon: <Bot className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // Backtesting - Where users validate and optimize strategies
    { path: "/backtest", name: "Backtesting", icon: <History className="mr-3 flex-shrink-0 h-5 w-5" /> },
    // TradingView Webhooks as the last item
    { path: "/webhooks", name: "TradingView Webhooks", icon: <Webhook className="mr-3 flex-shrink-0 h-5 w-5" /> },
  ];

  // Account and configuration items
  const accountItems = [
    { path: "/settings", name: "Settings", icon: <Settings className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/alert-thresholds", name: "Alert Thresholds", icon: <BellRing className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/integrations", name: "Integrations", icon: <Plug className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/broker-configuration", name: "Broker Accounts", icon: <DollarSign className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/help", name: "Help & Support", icon: <HelpCircle className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/debug", name: "Debug", icon: <Bug className="mr-3 flex-shrink-0 h-5 w-5" /> },
  ];

  const sidebarClasses = `fixed inset-y-0 left-0 z-50 w-64 bg-dark-surface border-r border-border flex flex-col transition-all duration-300 ease-in-out lg:relative ${
    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
  }`;

  return (
    <>
      {/* Mobile menu button */}
      <button 
        className="fixed top-4 left-4 z-40 lg:hidden p-2 rounded-md bg-primary text-white"
        onClick={toggleMobileMenu}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className={sidebarClasses}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          {/* Mobile close button only */}
          <button 
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          <div className="px-3 py-4">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link 
                  key={item.path}
                  href={item.path}
                  onClick={closeMobileMenu}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:bg-opacity-10 group ${
                    location === item.path
                      ? "bg-accent bg-opacity-10 border-l-2 border-primary"
                      : ""
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>
            
            <div className="mt-8">
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account
              </h3>
              <div className="mt-1 space-y-1">
                {accountItems.map((item) => (
                  <Link 
                    key={item.path}
                    href={item.path}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:bg-opacity-10 group ${
                      location === item.path
                        ? "bg-accent bg-opacity-10 border-l-2 border-primary"
                        : ""
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <UserAvatar user={user} className="h-10 w-10 mr-3" />
              <div>
                <p className="text-base font-medium">{user?.name || "Guest"}</p>
                <div className="flex items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-secondary mr-2"></div>
                  <p className="text-xs text-muted-foreground">
                    {user?.subscription?.tier === 'professional' ? 'Pro Plan' : 
                     user?.subscription?.tier === 'standard' ? 'Standard Plan' : 'Free Plan'}
                  </p>
                </div>
              </div>
            </div>
            <button 
              onClick={logout}
              className="text-sm text-primary hover:text-primary-foreground p-1"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
