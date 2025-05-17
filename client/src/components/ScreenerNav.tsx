import React from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ListFilter, Code, Filter, Settings } from 'lucide-react';

export function ScreenerNav() {
  const [location] = useLocation();
  
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Button
        variant={location === '/screeners' ? "default" : "outline"}
        size="sm"
        asChild
      >
        <Link href="/screeners">
          <ListFilter className="mr-2 h-4 w-4" />
          My Screeners
        </Link>
      </Button>
      
      <Button
        variant={location === '/strategy-screener' ? "default" : "outline"}
        size="sm"
        asChild
      >
        <Link href="/strategy-screener">
          <Filter className="mr-2 h-4 w-4" />
          Strategy Screener
        </Link>
      </Button>
      
      <Button
        variant={location === '/screen-builder' ? "default" : "outline"}
        size="sm"
        asChild
      >
        <Link href="/screen-builder">
          <Code className="mr-2 h-4 w-4" />
          Screen Builder
        </Link>
      </Button>

      <Button
        variant={location === '/screener-settings' ? "default" : "outline"}
        size="sm"
        asChild
      >
        <Link href="/screener-settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </Button>
    </div>
  );
}