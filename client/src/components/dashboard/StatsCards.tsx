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
              <div className="flex-shrink-0 bg-primary bg-opacity-20 rounded-md p-3">
                <LucideIcons.Cpu className="text-primary" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">Active Strategies</dt>
                  <dd>
                    <div className="text-lg font-semibold">{activeStrategies}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/strategies" className="font-medium text-primary hover:text-primary/80">
                View all <LucideIcons.ArrowUpRight className="inline ml-1 h-4 w-4" />
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
              <div className="flex-shrink-0 bg-secondary bg-opacity-20 rounded-md p-3">
                <LucideIcons.BarChart className="text-secondary" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">Total P&L</dt>
                  <dd>
                    <div className="flex flex-col">
                      <div className="text-lg font-semibold">{totalPnL.value}</div>
                      <div className={`text-sm font-medium flex items-center ${totalPnL.isPositive ? 'text-green-500' : 'text-destructive'}`}>
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
              <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80">
                View details <LucideIcons.ArrowUpRight className="inline ml-1 h-4 w-4" />
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
              <div className="flex-shrink-0 bg-accent bg-opacity-20 rounded-md p-3">
                <LucideIcons.DollarSign className="text-accent" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">Today's Trades</dt>
                  <dd>
                    <div className="text-lg font-semibold">{todayTrades}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80">
                View history <LucideIcons.ArrowUpRight className="inline ml-1 h-4 w-4" />
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
              <div className="flex-shrink-0 bg-destructive bg-opacity-20 rounded-md p-3">
                <LucideIcons.AlertTriangle className="text-destructive" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">Alerts</dt>
                  <dd>
                    <div className="text-lg font-semibold">{alerts}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-muted px-5 py-3">
            <div className="text-sm">
              <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80">
                Configure alerts <LucideIcons.ArrowUpRight className="inline ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
