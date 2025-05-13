import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  Bell, 
  Sun, 
  Moon,
  ChevronDown,
  CircleDollarSign,
  Check,
  Clock,
  AlertCircle,
  CheckCircle2,
  BarChart4,
  Briefcase,
  ShoppingCart,
  ShieldAlert,
  Loader2,
  Database
} from "lucide-react";
import { useMarketData } from "@/hooks/useMarketData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { useAccountContext, BrokerageAccount } from "@/context/AccountContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchData, updateData } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

// Type definition for notification
interface Notification {
  id: number;
  userId: number;
  thresholdId?: number;
  title: string;
  message: string;
  type: string; 
  severity: string;
  metadata: {
    symbol?: string;
    price?: number;
    changePercent?: number;
    volume?: number;
    strategyId?: number;
    deploymentId?: number;
    additionalInfo?: Record<string, any>;
  };
  deliveredChannels: {
    channel: string;
    status: 'delivered' | 'failed';
    failureReason?: string;
    timestamp: string;
  }[];
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
  readAt?: string;
}

interface TopNavbarProps {
  title?: string;
}

const TopNavbar = ({ title }: TopNavbarProps) => {
  const { user, updateUser } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(user?.settings?.theme || 'dark');
  const { accounts, selectedAccount, setSelectedAccount, isLoadingAccounts } = useAccountContext();
  const { marketStatus } = useMarketData();
  
  // State for countdown timer
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOpen: boolean;
  } | null>(null);
  
  // Query to get notifications
  const { data: notifications, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await fetchData<Notification[]>('/api/notifications?limit=10');
      return response;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Mutation to mark a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return await updateData(`/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });
  
  // Mutation to mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await updateData('/api/notifications/mark-all-read', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });
  
  // Count unread notifications
  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.isRead).length : 0;

  // Update the countdown timer every second
  useEffect(() => {
    if (!marketStatus.timing) return;
    
    // Initial calculation of time remaining
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const isOpen = marketStatus.timing?.isOpen || false;
      
      // Get milliseconds to next state change
      const msToChange = isOpen 
        ? (marketStatus.timing?.timeToClose?.milliseconds || 0)
        : (marketStatus.timing?.timeToOpen?.milliseconds || 0);
      
      // Calculate remaining time (adjust for time passed since data was sent)
      const adjustedMs = Math.max(0, msToChange - (Date.now() - now));
      
      // Convert to hours, minutes, seconds
      const hours = Math.floor(adjustedMs / (1000 * 60 * 60));
      const minutes = Math.floor((adjustedMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((adjustedMs % (1000 * 60)) / 1000);
      
      return { hours, minutes, seconds, isOpen };
    };
    
    // Set initial time
    setTimeRemaining(calculateTimeRemaining());
    
    // Update the time remaining every second
    const intervalId = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [marketStatus.timing]);

  // Apply theme to document
  useEffect(() => {
    // Get the document element
    const doc = document.documentElement;
    
    // Remove both theme classes first
    doc.classList.remove('light', 'dark');
    
    // Add the current theme class
    doc.classList.add(theme);
    
    // Update data-theme attribute (for ShadCN/UI components)
    doc.setAttribute('data-theme', theme);
  }, [theme]);

  // Function to toggle theme
  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Update user settings
    if (user) {
      try {
        await updateUser({
          settings: {
            ...user.settings,
            theme: newTheme,
          },
        });
      } catch (error) {
        console.error('Failed to update theme preference:', error);
      }
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    // Ensure value is a number and not NaN
    const validValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(validValue);
  };
  
  // Format percentage
  const formatPercentage = (value: number) => {
    // Ensure value is a number and not NaN
    const validValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    return `${validValue >= 0 ? '+' : ''}${validValue.toFixed(2)}%`;
  };

  return (
    <div className="bg-dark-surface border-b border-border">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Empty space on left side of top nav */}
          </div>
          
          <div className="flex items-center">
            {/* Market Status Indicators */}
            <div className="flex items-center mr-4">
              {/* Market open/close countdown */}
              {timeRemaining && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center mr-3">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs font-medium">
                          {timeRemaining.isOpen 
                            ? `US markets close in ${timeRemaining.hours}:${String(timeRemaining.minutes).padStart(2, '0')}:${String(timeRemaining.seconds).padStart(2, '0')}` 
                            : `US markets open in ${timeRemaining.hours}:${String(timeRemaining.minutes).padStart(2, '0')}:${String(timeRemaining.seconds).padStart(2, '0')}`
                          }
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {timeRemaining.isOpen 
                          ? `Market closes at ${new Date(marketStatus.timing?.nextCloseTime || '').toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} ET` 
                          : `Market opens at ${new Date(marketStatus.timing?.nextOpenTime || '').toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} ET`
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center mr-3">
                      <div className={`w-2 h-2 rounded-full mr-1.5 ${marketStatus.isMarketOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-xs font-medium">
                        Market {marketStatus.isMarketOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">U.S. Stock Market status</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Database className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs font-medium">
                        {marketStatus.dataSource || 'Unknown'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Current data provider</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Notification dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent rounded-full flex items-center justify-center">
                      <span className="text-xs text-white">{unreadCount}</span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px] p-0 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between py-2 px-4 border-b">
                  <div className="font-semibold">Notifications</div>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-2 text-xs" 
                      onClick={() => markAllAsReadMutation.mutate()}
                      disabled={markAllAsReadMutation.isPending}
                    >
                      {markAllAsReadMutation.isPending ? (
                        <span className="flex items-center">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Marking...
                        </span>
                      ) : "Mark all as read"}
                    </Button>
                  )}
                </div>
                
                {isLoadingNotifications && (
                  <div className="py-4 px-4">
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start space-x-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!isLoadingNotifications && (!Array.isArray(notifications) || notifications.length === 0) && (
                  <div className="py-6 px-4 text-center text-muted-foreground">
                    <div className="flex justify-center mb-2">
                      <Bell className="h-8 w-8 opacity-40" />
                    </div>
                    <p>No notifications yet</p>
                  </div>
                )}
                
                {!isLoadingNotifications && Array.isArray(notifications) && notifications.length > 0 && (
                  <div>
                    {notifications.map((notification) => {
                      // Helper to get icon based on notification type
                      const getNotificationIcon = () => {
                        switch(notification.type) {
                          case 'order_placed':
                          case 'order_filled': 
                          case 'order_rejected':
                            return <ShoppingCart className="h-5 w-5" />;
                          case 'backtest_finished':
                            return <Clock className="h-5 w-5" />;
                          case 'strategy_performance':
                            return <BarChart4 className="h-5 w-5" />;
                          case 'price':
                          case 'price_change_percent':
                          case 'volume':
                            return <AlertCircle className="h-5 w-5" />;
                          case 'market_events':
                            return <Briefcase className="h-5 w-5" />;
                          default:
                            return <ShieldAlert className="h-5 w-5" />;
                        }
                      };
                      
                      // Get icon color based on severity
                      const getSeverityColor = () => {
                        switch(notification.severity) {
                          case 'critical': return 'text-red-500';
                          case 'high': return 'text-orange-500';
                          case 'medium': return 'text-yellow-500';
                          case 'low': return 'text-blue-500';
                          default: return 'text-green-500';
                        }
                      };
                      
                      // Format notification time
                      const formattedTime = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
                      
                      return (
                        <DropdownMenuItem 
                          key={notification.id}
                          className={`py-3 px-4 border-b cursor-pointer flex items-start hover:bg-accent/10 ${!notification.isRead ? 'bg-accent/5' : ''}`}
                          onClick={() => !notification.isRead && markAsReadMutation.mutate(notification.id)}
                        >
                          <div className="flex items-start">
                            <div className={`mr-3 mt-1 ${getSeverityColor()}`}>
                              {getNotificationIcon()}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <span className="font-medium text-sm">{notification.title}</span>
                                <span className="text-xs text-muted-foreground ml-2">{formattedTime}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                              
                              {notification.metadata && notification.metadata.symbol && (
                                <Badge variant="outline" className="mt-2">
                                  {notification.metadata.symbol}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                    
                    {/* View all notifications link */}
                    <div className="border-t">
                      <DropdownMenuItem asChild>
                        <Link href="/settings?tab=notifications" className="w-full flex justify-center py-2">
                          <span className="text-sm font-medium text-primary">View all notifications</span>
                        </Link>
                      </DropdownMenuItem>
                    </div>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Theme toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="ml-3">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;