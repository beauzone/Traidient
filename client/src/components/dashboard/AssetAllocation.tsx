import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface AssetAllocationProps {
  data: {
    name: string;
    value: number;
    color: string;
    originalValue?: number;
  }[];
}

const COLORS = ['#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EF4444'];

const AssetAllocation = ({ data }: AssetAllocationProps) => {
  // Store the data in state with a random key to force re-render
  const [chartData, setChartData] = useState(data);
  
  // Use a ref to compare previous data with new data
  const previousDataRef = useRef<string>("");
  
  // Update chart when data changes
  useEffect(() => {
    // Stringify data to compare content
    const currentDataString = JSON.stringify(data);
    console.log("AssetAllocation received new data:", data);
    
    // Only update if data has actually changed
    if (previousDataRef.current !== currentDataString) {
      console.log("Data changed, updating chart");
      setChartData([...data]); // Create a new array to ensure React detects the change
      previousDataRef.current = currentDataString;
    }
  }, [data]);

  // Calculate the total of all values
  const total = chartData.reduce((sum, item) => sum + (item?.value || 0), 0);
  
  // Log for debugging
  useEffect(() => {
    console.log("AssetAllocation chart data:", chartData);
    console.log("Asset allocation total:", total);
  }, [chartData, total]);

  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <div className="px-5 py-4">
          <h3 className="text-lg font-medium">Asset Allocation by Type</h3>
        </div>
        <div className="flex flex-col md:flex-row p-4">
          <div className="w-full md:w-1/2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${entry.name}-${index}`} 
                      fill={entry.color || COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${((Number(value) / total) * 100).toFixed(1)}%`, 'Allocation']}
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    borderColor: '#334155',
                    color: '#E2E8F0'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full md:w-1/2 flex items-center mt-4 md:mt-0">
            <div className="space-y-4 w-full">
              {chartData.map((item, index) => (
                <div key={`legend-${item.name}-${index}`} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-sm mr-2" 
                      style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium">{((item.value / total) * 100).toFixed(0)}%</span>
                    {item.originalValue && (
                      <span className="text-xs text-muted-foreground">
                        ${new Intl.NumberFormat('en-US').format(Math.round(item.originalValue))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetAllocation;
