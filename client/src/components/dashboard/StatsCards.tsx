import { Card, CardContent } from "@/components/ui/card";
import * as LucideIcons from "lucide-react";
import { Link } from "wouter";

interface StatsCardsProps {
  activeStrategies: number;
  totalPnL: {
    value: string;
    percentage: string;
    isPositive: boolean;
  };
  todayTrades: number;
  alerts: number;
}

const StatsCards = ({ activeStrategies, totalPnL, todayTrades, alerts }: StatsCardsProps) => {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Active Strategies Card */}
      <Card>
        <CardContent className="p-0">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/20 rounded-md p-3">
                <LucideIcons.Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium truncate">Active Strategies</dt>
                  <dd>
                    <div className="text-lg font-semibold">{activeStrategies}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/strategies" className="font-medium text-primary hover:text-primary/80 flex items-center">
                <span>View all</span> <LucideIcons.ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total P&L Card */}
      <Card>
        <CardContent className="p-0">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/20 rounded-md p-3">
                <LucideIcons.TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium truncate">Total P&L</dt>
                  <dd>
                    <div className="flex items-baseline">
                      <div className="text-lg font-semibold">{totalPnL.value}</div>
                      <div className={`ml-2 text-sm font-medium flex items-center ${totalPnL.isPositive ? 'text-green-500' : 'text-negative'}`}>
                        {totalPnL.isPositive ? 
                          <LucideIcons.ArrowUp className="mr-1 h-3 w-3" /> : 
                          <LucideIcons.ArrowDown className="mr-1 h-3 w-3" />
                        }
                        {totalPnL.percentage}
                      </div>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80 flex items-center">
                <span>View details</span> <LucideIcons.ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Trades Card */}
      <Card>
        <CardContent className="p-0">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-md p-3">
                <LucideIcons.BarChart3 className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium truncate">Today's Trades</dt>
                  <dd>
                    <div className="text-lg font-semibold">{todayTrades}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80 flex items-center">
                <span>View history</span> <LucideIcons.ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Card */}
      <Card>
        <CardContent className="p-0">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/20 rounded-md p-3">
                <LucideIcons.Bell className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium truncate">Alerts</dt>
                  <dd>
                    <div className="text-lg font-semibold">{alerts}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80 flex items-center">
                <span>Configure alerts</span> <LucideIcons.ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
