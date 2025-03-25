import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import DeploymentPanel from "@/components/live-trading/DeploymentPanel";
import PositionsTable from "@/components/live-trading/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import StrategyMonitor from "@/components/live-trading/StrategyMonitor";
import { fetchData, updateData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Strategy, Deployment } from "@/types";

const LiveTradingPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);

  // Fetch strategies
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  // Fetch active deployments
  const { data: deployments = [], isLoading: isLoadingDeployments } = useQuery({
    queryKey: ['/api/deployments'],
    queryFn: () => fetchData<Deployment[]>('/api/deployments'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch selected deployment details
  const { data: selectedDeployment } = useQuery({
    queryKey: ['/api/deployments', selectedDeploymentId],
    queryFn: () => fetchData<Deployment>(`/api/deployments/${selectedDeploymentId}`),
    enabled: !!selectedDeploymentId,
    refetchInterval: 10000, // Refresh every 10 seconds when a deployment is selected
  });

  // Update deployment status mutation
  const updateDeploymentStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      updateData(`/api/deployments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments'] });
      toast({
        title: "Status updated",
        description: "Deployment status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });

  // Handle deployment selection
  const handleSelectDeployment = (deploymentId: number) => {
    setSelectedDeploymentId(deploymentId);
  };

  // Handle status change
  const handleStatusChange = (deploymentId: number, newStatus: string) => {
    updateDeploymentStatus.mutate({ id: deploymentId, status: newStatus });
  };

  return (
    <MainLayout title="Live Trading">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Trading</h1>
          <p className="text-muted-foreground">
            Monitor and manage your active trading strategies
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="monitor">Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DeploymentPanel 
              strategies={strategies}
              deployments={deployments}
              onSelectDeployment={handleSelectDeployment}
              onStatusChange={handleStatusChange}
              isLoading={isLoadingDeployments}
              selectedDeploymentId={selectedDeploymentId}
            />
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <PositionsTable />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <OrdersTable />
          </TabsContent>

          <TabsContent value="monitor" className="space-y-6">
            <StrategyMonitor 
              strategies={strategies}
              deployments={deployments}
              selectedDeployment={selectedDeployment}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default LiveTradingPage;
