import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StrategyScreenerCard } from '@/components/StrategyScreenerCard';
import { ScreenerNav } from '@/components/ScreenerNav';
import MainLayout from "@/components/layout/MainLayout";

export function StrategyScreenerPage() {
  return (
    <MainLayout title="Strategy Screener">
      <PageHeader
        title="Pre-Built Strategy Screener"
        description="Find stocks that match popular trading strategies and technical patterns"
      />
      
      <ScreenerNav />
      
      <StrategyScreenerCard />
    </MainLayout>
  );
}

export default StrategyScreenerPage;