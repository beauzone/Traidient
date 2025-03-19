import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface AssetAllocationProps {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
}

const COLORS = ['#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EF4444'];

const AssetAllocation = ({ data }: AssetAllocationProps) => {
  const [chartData, setChartData] = useState(data);
  
  // Update chart when data changes
  useEffect(() => {
    console.log("AssetAllocation received new data:", data);
    setChartData(data);
  }, [data]);

  // Calculate the total of all values
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <div className="px-5 py-4">
          <h3 className="text-lg font-medium">Asset Allocation</h3>
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
                      className="w-3 h-3 rounded-sm mr-2" 
                      style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">{((item.value / total) * 100).toFixed(0)}%</span>
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
