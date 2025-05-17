import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/PageHeader';
import { ScreenerNav } from '@/components/ScreenerNav';
import { ScreenForm } from '@/components/screen-builder/ScreenForm';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const EditScreen: React.FC = () => {
  const [, params] = useRoute('/edit-screen/:id');
  const screenerId = params?.id ? parseInt(params.id) : null;

  // Use React Query for data fetching instead of custom useState/useEffect
  const { 
    data: screenData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/screeners', screenerId],
    queryFn: async () => {
      if (!screenerId) {
        throw new Error('Invalid screen ID');
      }
      
      const response = await fetch(`/api/screeners/${screenerId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch screen data');
      }
      
      return response.json();
    },
    enabled: !!screenerId,
    retry: 1,
    refetchOnWindowFocus: false
  });

  return (
    <MainLayout title="Edit Screen">
      <PageHeader
        title="Edit Screen"
        description="Modify your custom stock screening strategy"
      />
      
      <ScreenerNav />

      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/screens" className="flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Screens
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading screen data...</p>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load screen data. Please try again.'}
            <div className="mt-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/screens">Return to Screens</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : screenData ? (
        <ScreenForm
          screenCode={screenData.source?.content || ''}
          explanation={screenData.explanation || ''}
          configuration={screenData.configuration || {}}
          defaultName={screenData.name || ''}
          defaultDescription={screenData.description || ''}
          isNew={false}
          id={screenData.id}
        />
      ) : (
        <div className="text-center p-8">
          <p className="text-muted-foreground mb-4">Screen not found</p>
          <Button variant="outline" asChild>
            <Link to="/screens">Return to Screens</Link>
          </Button>
        </div>
      )}
    </MainLayout>
  );
};

export default EditScreen;