import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";

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
}

type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'ALL';

const PortfolioChart = ({ data, currentValue, change }: PortfolioChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');

  // Filter data based on selected time range
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const now = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        // Correctly set to 30 days, not 3 months
        startDate.setDate(now.getDate() - 30);
        break;
      case '1Y':
        // Correctly set to 365 days, full year
        startDate.setDate(now.getDate() - 365);
        break;
      case 'ALL':
        // Use all available data
        return data;
      default:
        startDate.setDate(now.getDate() - 7);
    }
    
    return data.filter(item => new Date(item.date) >= startDate);
  }, [data, timeRange]);

  // Helper to format dates on the X-axis based on selected time range
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    
    switch(timeRange) {
      case '1D':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '1W':
        return date.toLocaleDateString([], { weekday: 'short' });
      case '1M':
        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      case '1Y':
      case 'ALL':
        return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      default:
        return tickItem;
    }
  };

  // Calculate the appropriate tick interval based on data length
  const getTickInterval = () => {
    const dataLength = filteredData.length;
    
    if (dataLength <= 7) return 1; // Show all points for small datasets
    if (timeRange === '1D') return Math.floor(dataLength / 6); // 6 ticks for 1D
    if (timeRange === '1W') return Math.floor(dataLength / 7); // 7 ticks for 1W (one per day)
    if (timeRange === '1M') return Math.floor(dataLength / 10); // 10 ticks for 1M
    if (timeRange === '1Y') return Math.floor(dataLength / 12); // 12 ticks for 1Y (monthly)
    
    return Math.max(1, Math.floor(dataLength / 10)); // Default to 10 ticks
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
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
        <div className="px-5 pt-2 pb-5">
          <div className="flex items-baseline">
            <h2 className="text-2xl font-semibold">{currentValue}</h2>
            <span className={`ml-2 text-sm font-medium flex items-center ${change.isPositive ? 'text-secondary' : 'text-destructive'}`}>
              <ArrowUpRight className="mr-1 h-4 w-4" />
              {change.value} ({change.percentage})
            </span>
          </div>
        </div>
        <div className="h-72 px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredData}
              margin={{
                top: 10,
                right: 10,
                left: 0,
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
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={{ stroke: '#334155' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
                labelFormatter={(label) => new Date(label).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
                contentStyle={{ 
                  backgroundColor: '#1E293B', 
                  borderColor: '#334155',
                  color: '#E2E8F0'
                }}
              />
              <Bar
                dataKey="value"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]} // Rounded top corners
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioChart;
