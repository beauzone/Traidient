import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useAccountContext } from "@/context/AccountContext";
import UserAvatar from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

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
  MonitorPlay,
  ChevronDown
} from "lucide-react";

const Sidebar = () => {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { accounts, selectedAccount, setSelectedAccount } = useAccountContext();
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
    // Webhooks as the last item
    { path: "/webhooks", name: "Webhooks", icon: <Webhook className="mr-3 flex-shrink-0 h-5 w-5" /> },
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

  // Adding solid background color for mobile view
  const sidebarClasses = `fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border flex flex-col transition-all duration-300 ease-in-out lg:relative shadow-xl ${
    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
  }`;

  return (
    <>
      {/* Mobile menu backdrop - only shown when menu is open */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
      
      {/* Mobile menu button - positioned with more margin from the left edge */}
      <button 
        className="fixed top-4 left-2 z-40 lg:hidden p-1.5 rounded-md bg-card text-foreground shadow-md border border-border"
        onClick={toggleMobileMenu}
        aria-label="Open menu"
        style={{ marginTop: '2px' }}
      >
        <Menu size={18} />
      </button>

      <div className={sidebarClasses}>
        <div className="flex flex-col p-4 border-b border-border">
          <div className="flex items-start gap-3 w-full">
            {/* Placeholder App Logo - Square yellow background similar to Alpaca */}
            <div className="h-10 w-10 bg-yellow-400 rounded-md flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            </div>
            
            {/* Account name and dropdown */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {selectedAccount === "all" 
                      ? "All Accounts" 
                      : accounts.find(a => a.id.toString() === selectedAccount)?.name || "Select Account"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedAccount === "all" 
                      ? "Multiple Accounts" 
                      : accounts.find(a => a.id.toString() === selectedAccount)?.accountNumber || ""}
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-0 py-0 ml-2">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[300px]">
                    <DropdownMenuItem 
                      className="flex justify-between py-2 px-4 cursor-pointer"
                      onClick={() => setSelectedAccount("all")}
                    >
                      <div className="font-semibold">All Accounts</div>
                      <div>${accounts.reduce((sum, account) => sum + (account.portfolioValue || account.equity || account.balance || 0), 0).toLocaleString()}</div>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>PAPER ACCOUNTS</DropdownMenuLabel>
                    
                    {accounts
                      .filter(account => account.accountType === 'paper')
                      .map(account => (
                        <DropdownMenuItem
                          key={account.id}
                          className="flex justify-between py-2 px-4 cursor-pointer"
                          onClick={() => setSelectedAccount(account.id.toString())}
                        >
                          <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-xs text-muted-foreground">{account.accountNumber}</div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div>${(account.portfolioValue || account.equity || account.balance || 0).toLocaleString()}</div>
                            {account.performance !== undefined && (
                              <div className={account.performance >= 0 ? "text-green-500" : "text-red-500"}>
                                {account.performance >= 0 ? '+' : ''}{account.performance.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    
                    {accounts.some(account => account.accountType === 'live') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>LIVE ACCOUNTS</DropdownMenuLabel>
                        
                        {accounts
                          .filter(account => account.accountType === 'live')
                          .map(account => (
                            <DropdownMenuItem
                              key={account.id}
                              className="flex justify-between py-2 px-4 cursor-pointer"
                              onClick={() => setSelectedAccount(account.id.toString())}
                            >
                              <div>
                                <div className="font-medium">{account.name}</div>
                                <div className="text-xs text-muted-foreground">{account.accountNumber}</div>
                              </div>
                              <div className="flex flex-col items-end">
                                <div>${(account.portfolioValue || account.equity || account.balance || 0).toLocaleString()}</div>
                                {account.performance !== undefined && (
                                  <div className={account.performance >= 0 ? "text-green-500" : "text-red-500"}>
                                    {account.performance >= 0 ? '+' : ''}{account.performance.toFixed(2)}%
                                  </div>
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))
                        }
                      </>
                    )}
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>ACCOUNT MANAGEMENT</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Link href="/settings" className="w-full">
                        Account Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mobile close button */}
            <button 
              className="lg:hidden text-foreground hover:text-primary ml-2 p-1.5 rounded-full bg-muted hover:bg-muted-foreground/10"
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          <div className="px-3 py-4">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link 
                  key={item.path}
                  href={item.path}
                  onClick={closeMobileMenu}
                  className={`flex items-center px-3 py-3 md:py-2 text-sm font-medium rounded-md hover:bg-accent hover:bg-opacity-10 group ${
                    location === item.path
                      ? "bg-accent bg-opacity-20 border-l-2 border-primary text-primary"
                      : ""
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>
            
            <div className="mt-8">
              <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account
              </h3>
              <div className="mt-1 space-y-1">
                {accountItems.map((item) => (
                  <Link 
                    key={item.path}
                    href={item.path}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-3 py-3 md:py-2 text-sm font-medium rounded-md hover:bg-accent hover:bg-opacity-10 group ${
                      location === item.path
                        ? "bg-accent bg-opacity-20 border-l-2 border-primary text-primary"
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

        <div className="p-5 border-t border-border">
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
              className="text-sm font-medium bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground px-3 py-1.5 rounded-md transition-colors"
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