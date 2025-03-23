import React from 'react';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import WebhookManager from '@/components/webhook/WebhookManager';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'wouter';

export default function WebhooksPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="space-y-6 p-6 pb-16">
      <div>
        <Heading title="TradingView Webhooks" description="Create and manage TradingView webhook endpoints for automated trading" />
        <Separator className="my-6" />
      </div>
      <WebhookManager />
    </div>
  );
}