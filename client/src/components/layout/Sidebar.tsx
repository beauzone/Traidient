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
  Bug
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

  const navItems = [
    { path: "/dashboard", name: "Dashboard", icon: <LineChart className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/strategies", name: "Strategies", icon: <Bot className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/bot-builder", name: "Bot Builder", icon: <Wand2 className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/backtest", name: "Backtesting", icon: <History className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/live-trading", name: "Live Trading", icon: <PlayCircle className="mr-3 flex-shrink-0 h-5 w-5" /> },
    { path: "/market-data", name: "Market Data", icon: <Database className="mr-3 flex-shrink-0 h-5 w-5" /> },
  ];

  const accountItems = [
    { path: "/settings", name: "Settings", icon: <Settings className="mr-3 flex-shrink-0 h-5 w-5" /> },
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
          <div className="flex items-center space-x-2">
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V5Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 9H20" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 9V20" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 15L15 15" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 18L13 18" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <h1 className="text-xl font-bold">TradeBrain AI</h1>
          </div>
          
          {/* Mobile close button */}
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
