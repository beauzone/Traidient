import React, { useState } from 'react';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChevronDown, Plus, Edit, Trash } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { Watchlist } from '@shared/schema';

export const WatchlistSelector = () => {
  const { 
    watchlists, 
    currentWatchlist, 
    setCurrentWatchlist, 
    createWatchlist, 
    updateWatchlist, 
    deleteWatchlist 
  } = useWatchlist();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [editWatchlistName, setEditWatchlistName] = useState('');
  const [activeWatchlist, setActiveWatchlist] = useState<Watchlist | null>(null);

  // Handle creating a new watchlist
  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    
    try {
      console.log('Creating new watchlist with name:', newWatchlistName.trim());
      const newWatchlist = await createWatchlist(newWatchlistName.trim());
      setNewWatchlistName('');
      setCreateDialogOpen(false);
      // Add empty items array before setting as current watchlist
      setCurrentWatchlist({
        ...newWatchlist,
        items: []
      });
    } catch (error) {
      console.error('Failed to create watchlist:', error);
    }
  };

  // Handle editing a watchlist
  const handleEditWatchlist = async () => {
    if (!activeWatchlist || !editWatchlistName.trim()) return;
    
    try {
      // Make sure we're sending valid update data
      const updateData = {
        name: editWatchlistName.trim()
      };
      
      console.log('Updating watchlist:', activeWatchlist.id, 'with data:', updateData);
      await updateWatchlist(activeWatchlist.id, updateData);
      
      setEditWatchlistName('');
      setEditDialogOpen(false);
      setActiveWatchlist(null);
    } catch (error) {
      console.error('Failed to update watchlist:', error);
    }
  };

  // Handle deleting a watchlist
  const handleDeleteWatchlist = async () => {
    if (!activeWatchlist) return;
    
    try {
      await deleteWatchlist(activeWatchlist.id);
      setDeleteDialogOpen(false);
      setActiveWatchlist(null);
    } catch (error) {
      console.error('Failed to delete watchlist:', error);
    }
  };

  // Open edit dialog for a watchlist
  const openEditDialog = (watchlist: Watchlist) => {
    setActiveWatchlist(watchlist);
    setEditWatchlistName(watchlist.name);
    setEditDialogOpen(true);
  };

  // Open delete dialog for a watchlist
  const openDeleteDialog = (watchlist: Watchlist) => {
    setActiveWatchlist(watchlist);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 px-3 flex items-center">
              {currentWatchlist?.name || 'Select a watchlist'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[200px]">
            {watchlists.map((watchlist) => (
              <div key={watchlist.id} className="flex items-center">
                <DropdownMenuItem 
                  className="flex-1 cursor-pointer"
                  onSelect={() => setCurrentWatchlist(watchlist)}
                >
                  {watchlist.name}
                  {watchlist.isDefault && <span className="ml-2 text-xs opacity-60">(Default)</span>}
                </DropdownMenuItem>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(watchlist);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {watchlists.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(watchlist);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="cursor-pointer"
              onSelect={() => setCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new watchlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create Watchlist Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create new watchlist</DialogTitle>
            <DialogDescription>
              Enter a name for your new watchlist.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                className="col-span-3"
                placeholder="Enter watchlist name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWatchlist();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWatchlist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Watchlist Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit watchlist</DialogTitle>
            <DialogDescription>
              Update the name of your watchlist.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={editWatchlistName}
                onChange={(e) => setEditWatchlistName(e.target.value)}
                className="col-span-3"
                placeholder="Enter watchlist name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEditWatchlist();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditWatchlist}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Watchlist Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete watchlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the watchlist "{activeWatchlist?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteWatchlist}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};