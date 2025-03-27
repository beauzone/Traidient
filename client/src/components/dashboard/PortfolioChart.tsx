import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useState, useMemo, useEffect } from "react";

interface PortfolioChartProps {
  data: {
    date: string;
    value: number;
  }[];
  currentValue: string;
  change: {
    value: string;
    percentage: string;
    isPositive: boolean;
  };
  onTimeRangeChange?: (range: TimeRange) => void;
}

export type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'ALL';

const PortfolioChart = ({ data, currentValue, change, onTimeRangeChange }: PortfolioChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');

  // Notify parent component when time range changes
  useEffect(() => {
    if (onTimeRangeChange) {
      onTimeRangeChange(timeRange);
    }
  }, [timeRange, onTimeRangeChange]);

  // Determine if we're showing intraday data (1-minute intervals)
  const isIntraday = useMemo(() => {
    return timeRange === '1D' && data?.length > 0 && data[0].date.includes('T');
  }, [timeRange, data]);

  // Format the tooltip timestamp with proper time information in Eastern Time for market hours
  const formatTooltipTime = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Eastern Time (ET) timezone for market hours
    const easternOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/New_York'
    };
    
    if (isIntraday) {
      // Properly typed format options
      const options: Intl.DateTimeFormatOptions = {
        ...easternOptions,
        month: "short" as const,
        day: "numeric" as const,
        hour: "2-digit" as const,
        minute: "2-digit" as const,
        hour12: false // Use 24-hour format for consistency
      };
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } else {
      // Use standard date format for non-intraday views
      const options: Intl.DateTimeFormatOptions = {
        month: "short" as const,
        day: "numeric" as const,
        year: "numeric" as const
      };
      return new Intl.DateTimeFormat('en-US', options).format(date);
    }
  };

  // Helper to format dates on the X-axis based on selected time range
  // Using Eastern Time (ET) for market hours
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    
    // Create formatter with explicit Eastern Time (ET) timezone
    // for market hours (9:30 AM - 4:00 PM ET)
    const easternOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/New_York'
    };
    
    switch(timeRange) {
      case '1D':
        if (isIntraday) {
          // For intraday, show time in Eastern Time (market hours timezone)
          // Properly typed format options
          const options: Intl.DateTimeFormatOptions = {
            ...easternOptions,
            hour: "2-digit" as const, 
            minute: "2-digit" as const,
            hour12: false // Use 24-hour format
          };
          return new Intl.DateTimeFormat('en-US', options).format(date);
        }
        // 1D non-intraday view - also use Eastern Time for market data
        const options1d: Intl.DateTimeFormatOptions = {
          ...easternOptions, // Use Eastern Time for market data
          month: "short" as const,
          day: "numeric" as const
        };
        return new Intl.DateTimeFormat('en-US', options1d).format(date);
      case '1W':
        // Weekly view - show day of week with Eastern Time for market data
        const options1w: Intl.DateTimeFormatOptions = {
          ...easternOptions, // Use Eastern Time for market data
          weekday: "short" as const
        };
        return new Intl.DateTimeFormat('en-US', options1w).format(date);
      case '1M':
        // Monthly view - show day and month with Eastern Time for market data
        const options1m: Intl.DateTimeFormatOptions = {
          ...easternOptions, // Use Eastern Time for market data
          day: "numeric" as const,
          month: "short" as const
        };
        return new Intl.DateTimeFormat('en-US', options1m).format(date);
      case '1Y':
      case 'ALL':
        // Yearly/All-time view - show month and year with Eastern Time for market data
        const optionsYear: Intl.DateTimeFormatOptions = {
          ...easternOptions, // Use Eastern Time for market data
          month: "short" as const,
          year: "2-digit" as const
        };
        return new Intl.DateTimeFormat('en-US', optionsYear).format(date);
      default:
        return tickItem;
    }
  };

  // Calculate the appropriate tick interval based on data length
  const getTickInterval = () => {
    const dataLength = data?.length || 0;
    
    if (dataLength <= 7) return 0; // Show all points for small datasets
    if (timeRange === '1D') {
      // For intraday, show less frequent ticks (approximately hourly)
      if (isIntraday && dataLength > 60) {
        return Math.floor(dataLength / 7); // About 7 ticks for a full trading day
      }
      return Math.floor(dataLength / 6); // 6 ticks for 1D
    }
    if (timeRange === '1W') return Math.floor(dataLength / 7); // 7 ticks for 1W (one per day)
    if (timeRange === '1M') return Math.floor(dataLength / 10); // 10 ticks for 1M
    if (timeRange === '1Y') return Math.floor(dataLength / 12); // 12 ticks for 1Y (monthly)
    
    return Math.max(1, Math.floor(dataLength / 10)); // Default to 10 ticks
  };

  // Calculate Y-axis domain to focus on the data variation
  const yAxisDomain = useMemo(() => {
    if (!data || data.length === 0) {
      return ['auto', 'auto'];
    }
    
    // Find min and max values
    const values = data.map(d => Number(d.value)); // Ensure values are numbers
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate the range
    const range = max - min;
    
    // For the 1D view, use a much tighter range to emphasize small movements
    if (timeRange === '1D') {
      // First, find the average value to center around
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Calculate a tighter range - use the larger of:
      // 1. Actual min-max range
      // 2. 0.2% of the average value (to ensure we always see some movement)
      const minVisibleRange = avgValue * 0.002; 
      const effectiveRange = Math.max(range, minVisibleRange);
      
      // Use minimal padding for intraday view
      const padding = effectiveRange * 0.5; // Add 50% padding to the range
      
      // Round to nice values
      const scaledMin = min - padding;
      const scaledMax = max + padding;
      
      // For large numbers, round to the nearest 10
      const roundingFactor = avgValue > 10000 ? 10 : 1;
      
      return [
        Math.floor(scaledMin / roundingFactor) * roundingFactor,
        Math.ceil(scaledMax / roundingFactor) * roundingFactor
      ];
    }
    
    // For other time periods
    // If the range is very small (less than 1% of the max), expand it 
    if (range < max * 0.01) {
      const padding = max * 0.05; // 5% padding
      return [min - padding, max + padding];
    }
    
    // Otherwise, use a reasonable padding to focus on the data
    const paddingPercentage = timeRange === '1W' ? 0.02 : 0.05;
    const padding = range * paddingPercentage;
    
    // Floor and ceiling to clean values 
    // Use appropriate rounding bases for different value ranges
    const roundingBase = max > 10000 ? 100 : (max > 1000 ? 10 : 1);
    
    return [
      Math.floor((min - padding) / roundingBase) * roundingBase, // Round down
      Math.ceil((max + padding) / roundingBase) * roundingBase   // Round up
    ];
  }, [data, timeRange]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    if (onTimeRangeChange) {
      onTimeRangeChange(range);
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Portfolio Performance</h3>
          <div className="flex space-x-2">
            {(['1D', '1W', '1M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                className="px-3 py-1 h-8"
                onClick={() => handleTimeRangeChange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
        <div className="px-5 pt-2 pb-5">
          <div className="flex items-baseline">
            <h2 className="text-2xl font-semibold">{currentValue}</h2>
            <span className={`ml-2 text-sm font-medium flex items-center ${change.isPositive ? 'text-secondary' : 'text-negative'}`}>
              {change.isPositive ? (
                <ArrowUpRight className="mr-1 h-4 w-4" />
              ) : (
                <ArrowDownRight className="mr-1 h-4 w-4" />
              )}
              {change.value} ({change.percentage})
            </span>
          </div>
        </div>
        <div className="h-72 px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: 10,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxis} 
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={{ stroke: '#334155' }}
                tickLine={{ stroke: '#334155' }}
                interval={getTickInterval()}
              />
              <YAxis 
                domain={yAxisDomain}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={{ stroke: '#334155' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(value) => `$${Math.round(value).toLocaleString()}`}
                width={70} // Less space needed for whole numbers
              />
              <Tooltip 
                formatter={(value) => [`$${Math.round(Number(value)).toLocaleString()}`, 'Value']}
                labelFormatter={(label) => formatTooltipTime(label)}
                contentStyle={{ 
                  backgroundColor: '#1E293B', 
                  borderColor: '#334155',
                  color: '#E2E8F0'
                }}
              />
              {/* Add a reference line at y=0 if needed */}
              {Array.isArray(yAxisDomain) && 
               typeof yAxisDomain[0] === 'number' && 
               yAxisDomain[0] < 0 && 
               <ReferenceLine y={0} stroke="#666" />}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={isIntraday ? false : { r: 2, fill: '#3B82F6', stroke: '#3B82F6' }}
                activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioChart;
