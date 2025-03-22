import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchData, deleteData } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Bell, PlusCircle, Trash2, Edit2, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AlertThresholdForm } from '@/components/alert-thresholds/AlertThresholdForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

// Types
interface AlertThreshold {
  id: number;
  userId: number;
  name: string;
  type: string;
  enabled: boolean;
  conditions: {
    symbol?: string;
    strategyId?: number;
    deploymentId?: number;
    price?: number;
    priceDirection?: 'above' | 'below';
    changePercent?: number;
    timeframe?: string;
    volume?: number;
    profitLossAmount?: number;
    profitLossPercent?: number;
    indicator?: {
      type: 'ma' | 'ema' | 'rsi' | 'macd' | 'bollinger';
      parameters: Record<string, any>;
      condition: string;
    };
    eventType?: 'market_open' | 'market_close' | 'earnings' | 'economic_announcement';
    filters?: Record<string, any>;
  };
  notifications: {
    channels: string[];
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    throttle?: {
      enabled: boolean;
      maxPerDay?: number;
      cooldownMinutes?: number;
    };
  };
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
}

const AlertThresholdsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedThreshold, setSelectedThreshold] = useState<AlertThreshold | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [thresholdToDelete, setThresholdToDelete] = useState<number | null>(null);

  // Fetch all alert thresholds
  const { data: thresholds = [], isLoading } = useQuery({
    queryKey: ['/api/alert-thresholds'],
    queryFn: () => fetchData<AlertThreshold[]>('/api/alert-thresholds'),
  });

  // Delete alert threshold mutation
  const deleteThreshold = useMutation({
    mutationFn: (id: number) => deleteData(`/api/alert-thresholds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alert-thresholds'] });
      toast({
        title: "Alert threshold deleted",
        description: "The alert threshold has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete alert threshold",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Toggle alert threshold enabled status mutation
  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => 
      fetchData(`/api/alert-thresholds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alert-thresholds'] });
      toast({
        title: "Alert status updated",
        description: "The alert threshold status has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update alert status",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Handle edit alert threshold
  const handleEdit = (threshold: AlertThreshold) => {
    setSelectedThreshold(threshold);
    setIsFormOpen(true);
  };

  // Handle new alert threshold
  const handleNewThreshold = () => {
    setSelectedThreshold(null);
    setIsFormOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (id: number) => {
    setThresholdToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Handle deletion
  const handleDelete = () => {
    if (thresholdToDelete) {
      deleteThreshold.mutate(thresholdToDelete);
    }
  };

  // Filter thresholds based on active tab
  const filteredThresholds = thresholds.filter(threshold => {
    if (activeTab === 'all') return true;
    if (activeTab === 'price' && ['price', 'price_change_percent'].includes(threshold.type)) return true;
    if (activeTab === 'technical' && threshold.type === 'technical_indicator') return true;
    if (activeTab === 'market' && threshold.type === 'market_event') return true;
    if (activeTab === 'performance' && ['position_profit_loss', 'strategy_performance'].includes(threshold.type)) return true;
    return false;
  });

  // Function to display human-readable threshold type
  const getThresholdTypeLabel = (type: string): string => {
    const typeLabels: Record<string, string> = {
      'price': 'Price Alert',
      'price_change_percent': 'Price Change %',
      'volume': 'Volume Alert',
      'position_profit_loss': 'P&L Alert',
      'strategy_performance': 'Strategy Alert',
      'market_event': 'Market Event',
      'technical_indicator': 'Technical Indicator',
      'news': 'News Alert'
    };

    return typeLabels[type] || type;
  };

  // Function to get threshold condition description
  const getConditionDescription = (threshold: AlertThreshold): string => {
    const { type, conditions } = threshold;

    switch (type) {
      case 'price':
        return `${conditions.symbol} ${conditions.priceDirection === 'above' ? '>' : '<'} $${conditions.price}`;
      
      case 'price_change_percent':
        return `${conditions.symbol} ${conditions.changePercent}% in ${conditions.timeframe || '1d'}`;
      
      case 'volume':
        return `${conditions.symbol} volume ${conditions.volume ? '> ' + conditions.volume.toLocaleString() : ''}`;
      
      case 'position_profit_loss':
        return conditions.profitLossPercent 
          ? `${conditions.symbol || 'Portfolio'} P&L ${conditions.profitLossPercent}%` 
          : `${conditions.symbol || 'Portfolio'} P&L $${conditions.profitLossAmount}`;
      
      case 'technical_indicator':
        if (!conditions.indicator) return 'Technical alert';
        return `${conditions.symbol} ${conditions.indicator.type.toUpperCase()} ${conditions.indicator.condition}`;
      
      case 'market_event':
        return `${conditions.eventType?.replace('_', ' ')}`;
      
      default:
        return threshold.name;
    }
  };

  // Function to get severity badge variant
  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      'info': 'bg-blue-100 text-blue-800',
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'critical': 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[severity] || 'bg-gray-100 text-gray-800'}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  return (
    <MainLayout title="Alert Thresholds">
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Alert Thresholds</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage custom alerts for price movements, technical indicators, and more
            </p>
          </div>
          <Button onClick={handleNewThreshold}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Alert
          </Button>
        </div>

        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Custom Alerts</CardTitle>
                <CardDescription>Configure alerts based on price, technical indicators, or market events</CardDescription>
              </div>
              <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="price">Price</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                  <TabsTrigger value="market">Market</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading ? (
              // Loading skeleton
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 py-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              filteredThresholds.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-3" />
                  <h3 className="text-lg font-medium mb-1">No alerts configured</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === 'all' 
                      ? 'Create your first alert to get notified about important market events.' 
                      : 'No alerts found matching the selected filter.'}
                  </p>
                  <Button onClick={handleNewThreshold} variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Alert
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Last Triggered</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredThresholds.map((threshold) => (
                        <TableRow key={threshold.id}>
                          <TableCell className="font-medium">{threshold.name}</TableCell>
                          <TableCell>{getThresholdTypeLabel(threshold.type)}</TableCell>
                          <TableCell>{getConditionDescription(threshold)}</TableCell>
                          <TableCell>{getSeverityBadge(threshold.notifications.severity)}</TableCell>
                          <TableCell>
                            {threshold.lastTriggered ? formatDate(threshold.lastTriggered) : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Switch 
                              checked={threshold.enabled} 
                              onCheckedChange={(checked) => toggleEnabled.mutate({ id: threshold.id, enabled: checked })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(threshold)} title="Edit">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteConfirm(threshold.id)} title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Threshold Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedThreshold ? 'Edit Alert Threshold' : 'Create Alert Threshold'}
            </DialogTitle>
            <DialogDescription>
              Configure custom alerts for price movements, technical indicators, or market events
            </DialogDescription>
          </DialogHeader>
          
          <AlertThresholdForm 
            threshold={selectedThreshold} 
            onClose={() => setIsFormOpen(false)} 
            onSuccess={() => {
              setIsFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ['/api/alert-thresholds'] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this alert threshold? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={deleteThreshold.isPending}
            >
              {deleteThreshold.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default AlertThresholdsPage;