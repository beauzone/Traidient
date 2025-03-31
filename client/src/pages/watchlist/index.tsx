import React from 'react';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
import { WatchlistSelector } from '@/components/watchlist/WatchlistSelector';
import { WatchlistTable } from '@/components/watchlist/WatchlistTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WatchlistPage() {
  return (
    <WatchlistProvider>
      <div className="container mx-auto py-6">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Watchlists</h1>
            <p className="text-muted-foreground">
              Track your favorite stocks, ETFs, and other financial instruments.
            </p>
          </div>
          
          <Card>
            <CardHeader className="px-6 py-5 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-xl">My Watchlists</CardTitle>
                <CardDescription>
                  Create and manage multiple watchlists to track different market segments or strategies.
                </CardDescription>
              </div>
              <WatchlistSelector />
            </CardHeader>
            <CardContent className="p-0">
              <WatchlistTable />
            </CardContent>
          </Card>
        </div>
      </div>
    </WatchlistProvider>
  );
}