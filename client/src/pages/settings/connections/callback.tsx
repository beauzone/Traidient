import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { SnaptradeConnector } from '@/components/integration/SnaptradeConnector';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/**
 * Callback page for SnapTrade integration
 * This page is redirected to after the user connects a brokerage through SnapTrade
 */
export default function SnaptradeCallbackPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // If user is not authenticated, redirect to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // If loading, show loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authenticated, return null (handled by useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container max-w-6xl py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Connecting Brokerage</h1>
          <p className="text-muted-foreground">
            Completing your brokerage connection through SnapTrade...
          </p>
        </div>

        {/* The SnaptradeConnector component handles the callback logic */}
        <SnaptradeConnector />
      </div>
    </div>
  );
}