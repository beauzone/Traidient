import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Plus } from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

interface AddToWatchlistButtonProps {
  symbol: string;
  companyName?: string;
  className?: string;
}

const AddToWatchlistButton: React.FC<AddToWatchlistButtonProps> = ({ 
  symbol,
  companyName,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const { 
    watchlists, 
    addToWatchlist, 
    createWatchlist,
    createDefaultWatchlist
  } = useWatchlist();

  const handleAddToWatchlist = async (watchlistId: number) => {
    await addToWatchlist(watchlistId, {
      symbol,
      name: companyName || symbol,
      type: 'stock',
      exchange: 'NYSE' // Default to NYSE if not provided
    });
    setIsOpen(false);
  };

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    
    try {
      const newWatchlist = await createWatchlist(newWatchlistName);
      if (newWatchlist) {
        await addToWatchlist(newWatchlist.id, {
          symbol,
          name: companyName || symbol,
          type: 'stock',
          exchange: 'NYSE' // Default to NYSE if not provided
        });
      }
      setNewWatchlistName('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating watchlist:', error);
    }
  };

  const handleCreateDefault = async () => {
    try {
      const defaultWatchlist = await createDefaultWatchlist();
      if (defaultWatchlist) {
        await addToWatchlist(defaultWatchlist.id, {
          symbol,
          name: companyName || symbol,
          type: 'stock',
          exchange: 'NYSE' // Default to NYSE if not provided
        });
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating default watchlist:', error);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 ${className}`}
          title="Add to watchlist"
        >
          <Heart className="h-4 w-4 mr-1" />
          <span className="sr-only sm:not-sr-only sm:inline-block">Watchlist</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Add {symbol} to watchlist</h3>
          <Separator className="my-2" />
          
          {watchlists.length === 0 ? (
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-2">No watchlists found</p>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full"
                onClick={handleCreateDefault}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Default Watchlist
              </Button>
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {watchlists.map((list) => (
                <Button
                  key={list.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => handleAddToWatchlist(list.id)}
                >
                  <Heart className="h-3.5 w-3.5 mr-2" />
                  {list.name} {list.isDefault && <span className="text-xs ml-1 opacity-60">(Default)</span>}
                </Button>
              ))}
            </div>
          )}
          
          <Separator className="my-2" />
          
          <div className="flex space-x-1">
            <Input
              placeholder="New watchlist name"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateWatchlist();
                }
              }}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="shrink-0"
              onClick={handleCreateWatchlist}
              disabled={!newWatchlistName.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddToWatchlistButton;