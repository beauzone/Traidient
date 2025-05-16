import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/PageHeader';
import { ScreenerNav } from '@/components/ScreenerNav';
import { ScreenForm } from '@/components/screen-builder/ScreenForm';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const EditScreen: React.FC = () => {
  const [, params] = useRoute('/edit-screen/:id');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenData, setScreenData] = useState<any>(null);
  const screennerId = params?.id ? parseInt(params.id) : null;

  useEffect(() => {
    const fetchScreenData = async () => {
      if (!screennerId) {
        setError('Invalid screen ID');
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest(`/api/screeners/${screennerId}`, {
          method: 'GET'
        });
        
        setScreenData(response);
      } catch (err) {
        console.error('Failed to fetch screen data:', err);
        setError('Failed to load screen data. Please try again.');
        toast({
          title: 'Error',
          description: 'Failed to load screen data',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchScreenData();
  }, [screennerId, toast]);

  return (
    <MainLayout title="Edit Screen">
      <PageHeader
        title="Edit Screen"
        description="Modify your custom stock screening strategy"
      />
      
      <ScreenerNav />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center p-8 text-destructive">
          <p>{error}</p>
        </div>
      ) : screenData ? (
        <ScreenForm
          screenCode={screenData.source.content}
          explanation={screenData.explanation || ''}
          configuration={screenData.configuration || {}}
          defaultName={screenData.name}
          defaultDescription={screenData.description}
          isNew={false}
          id={screenData.id}
        />
      ) : (
        <div className="text-center p-8">
          <p>Screen not found</p>
        </div>
      )}
    </MainLayout>
  );
};

export default EditScreen;