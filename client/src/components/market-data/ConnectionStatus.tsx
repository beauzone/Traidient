import React from 'react';
import { cn } from '@/lib/utils';
import { useMarketData } from '@/hooks/useMarketData';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WifiIcon, WifiOffIcon, ClockIcon, AlertCircleIcon } from 'lucide-react';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MarketDataConnectionStatus({
  className,
  showLabel = true,
  size = 'md'
}: ConnectionStatusProps) {
  const { 
    connected, 
    usingRealtime, 
    usingFallback, 
    dataFreshness,
    statusMessage,
    marketStatus
  } = useMarketData();
  
  // Determine styling based on connection status
  const getStatusStyles = () => {
    if (!connected) {
      return {
        color: 'text-destructive',
        bgColor: 'bg-destructive/20',
        icon: <WifiOffIcon className="h-4 w-4" />,
        label: 'Disconnected'
      };
    }
    
    if (usingRealtime) {
      return {
        color: 'text-green-600 dark:text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: <WifiIcon className="h-4 w-4" />,
        label: 'Real-time'
      };
    }
    
    if (usingFallback) {
      // If data is stale, show a warning
      if (dataFreshness.isStale) {
        return {
          color: 'text-amber-600 dark:text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-900/20',
          icon: <AlertCircleIcon className="h-4 w-4" />,
          label: `Delayed (${dataFreshness.averageDelay}s)`
        };
      }
      
      // Data is fresh enough for fallback mode
      return {
        color: 'text-blue-600 dark:text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: <ClockIcon className="h-4 w-4" />,
        label: `Delayed (${dataFreshness.averageDelay}s)`
      };
    }
    
    // Default case
    return {
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      icon: <WifiOffIcon className="h-4 w-4" />,
      label: 'Unknown'
    };
  };
  
  const statusStyles = getStatusStyles();
  
  // Size variants
  const sizeClasses = {
    sm: 'text-xs py-0.5 px-2',
    md: 'text-sm py-1 px-3',
    lg: 'text-base py-1.5 px-4'
  };
  
  // Build detailed tooltip content
  const tooltipContent = (
    <div className="space-y-2 p-1 max-w-xs">
      <div className="font-semibold">{statusMessage}</div>
      
      <div className="text-xs space-y-1">
        <div>
          <span className="font-medium">Connection:</span> {usingRealtime ? 'WebSocket (real-time)' : usingFallback ? 'HTTP Polling' : 'Disconnected'}
        </div>
        
        <div>
          <span className="font-medium">Market Status:</span> {
            marketStatus.isMarketOpen 
              ? marketStatus.marketStatus?.isPreMarketHours 
                ? 'Pre-market' 
                : marketStatus.marketStatus?.isAfterMarketHours 
                  ? 'After-hours' 
                  : marketStatus.marketStatus?.isRegularHours 
                    ? 'Regular Hours' 
                    : 'Open'
              : marketStatus.marketStatus?.isWeekend 
                ? 'Weekend (Closed)' 
                : 'Closed'
          }
        </div>
        
        {marketStatus.marketStatus?.nextMarketOpen && (
          <div>
            <span className="font-medium">Next Market Open:</span>{' '}
            {new Date(marketStatus.marketStatus.nextMarketOpen).toLocaleString()}
          </div>
        )}
        
        {marketStatus.marketStatus?.nextMarketClose && marketStatus.isMarketOpen && (
          <div>
            <span className="font-medium">Market Closes:</span>{' '}
            {new Date(marketStatus.marketStatus.nextMarketClose).toLocaleString()}
          </div>
        )}
        
        {marketStatus.marketStatus?.exchangeTimezone && (
          <div>
            <span className="font-medium">Exchange Timezone:</span>{' '}
            {marketStatus.marketStatus.exchangeTimezone}
          </div>
        )}
        
        <div>
          <span className="font-medium">Data Source:</span> {marketStatus.dataSource || 'Unknown'}
        </div>
        
        <div>
          <span className="font-medium">Last Updated:</span> {dataFreshness.lastUpdated}
        </div>
        
        {usingFallback && (
          <div>
            <span className="font-medium">Average Delay:</span> {dataFreshness.averageDelay} seconds
          </div>
        )}
      </div>
    </div>
  );
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center rounded-full transition-colors',
              statusStyles.bgColor,
              statusStyles.color,
              sizeClasses[size],
              className
            )}
          >
            <span className="mr-1.5">{statusStyles.icon}</span>
            {showLabel && <span className="font-medium">{statusStyles.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center" className="bg-background border z-50">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}