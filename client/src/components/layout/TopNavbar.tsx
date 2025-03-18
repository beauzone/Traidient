import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  Bell, 
  Sun, 
  Moon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

const TopNavbar = () => {
  const { user, updateUser } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(user?.settings?.theme || 'dark');

  // Function to toggle theme
  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Update user settings
    if (user) {
      try {
        await updateUser({
          settings: {
            ...user.settings,
            theme: newTheme,
          },
        });
        
        // You would typically apply theme changes to the document here
        // but we're keeping the dark theme for the demo
      } catch (error) {
        console.error('Failed to update theme preference:', error);
      }
    }
  };

  return (
    <div className="bg-dark-surface border-b border-border">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="hidden sm:flex sm:items-center ml-4">
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <Input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 bg-background border-border"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex items-center md:ml-6">
              {/* Notification dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent rounded-full flex items-center justify-center">
                      <span className="text-xs text-white">3</span>
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>New trade: AAPL Buy $500</DropdownMenuItem>
                  <DropdownMenuItem>Strategy "Momentum" is now active</DropdownMenuItem>
                  <DropdownMenuItem>Your backtest has completed</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Theme toggle */}
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="ml-3">
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;
