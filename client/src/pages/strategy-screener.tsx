import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StrategyScreenerCard } from '@/components/StrategyScreenerCard';
import { ScreenerNav } from '@/components/ScreenerNav';
import { useTitle } from '@/lib/useTitle';

export function StrategyScreenerPage() {
  // Set page title
  useTitle('Strategy Screener');

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        title="Pre-Built Strategy Screener"
        description="Find stocks that match popular trading strategies and technical patterns"
      />
      
      <ScreenerNav />
      
      <StrategyScreenerCard />
    </div>
  );
}

export default StrategyScreenerPage;