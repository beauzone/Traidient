import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { ScreenerNav } from '@/components/ScreenerNav';
import { PageHeader } from '@/components/PageHeader';
import { ProviderSelector } from '@/components/screener/ProviderSelector';

/**
 * Screener Settings Page
 * Allows users to configure screener settings like data providers
 */
const ScreenerSettingsPage: React.FC = () => {
  return (
    <MainLayout title="Screener Settings">
      <PageHeader
        title="Screener Settings"
        description="Configure screener data providers and preferences"
      />
      
      <ScreenerNav />
      
      <div className="grid grid-cols-1 gap-6 mb-8">
        <ProviderSelector />
      </div>
    </MainLayout>
  );
};

export default ScreenerSettingsPage;