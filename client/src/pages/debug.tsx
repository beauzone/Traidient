import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchData } from "@/lib/api";

export default function DebugPage() {
  const { user, token, login, logout } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("password");
  const [testApiResponse, setTestApiResponse] = useState<string | null>(null);
  const [testApiError, setTestApiError] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testIntegrationsResponse, setTestIntegrationsResponse] = useState<string | null>(null);
  const [testIntegrationsError, setTestIntegrationsError] = useState<string | null>(null);
  const [isTestingIntegrations, setIsTestingIntegrations] = useState(false);

  // Effect to check token in localStorage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const storedToken = localStorage.getItem('token');
      console.log('Debug page checking token:', storedToken ? 'Token exists' : 'No token');
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    try {
      await login(username, password);
      toast({
        title: "Login successful",
        description: "You're now logged in.",
      });
      
      // When login successful, reset API test state
      setTestApiResponse(null);
      setTestApiError(null);
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Login failed",
        variant: "destructive",
      });
    }
  };
  
  const handleTestApiCall = async () => {
    setIsTestingApi(true);
    setTestApiResponse(null);
    setTestApiError(null);
    
    try {
      // Test basic authenticated endpoint
      const response = await fetchData('/api/auth/me');
      setTestApiResponse(JSON.stringify(response, null, 2));
      
      toast({
        title: "API Test Successful",
        description: "Successfully called the authenticated endpoint",
      });
    } catch (error) {
      console.error('API test failed:', error);
      setTestApiError(error instanceof Error ? error.message : String(error));
      
      toast({
        title: "API Test Failed",
        description: error instanceof Error ? error.message : "API call failed",
        variant: "destructive",
      });
    } finally {
      setIsTestingApi(false);
    }
  };
  
  const handleManualTokenCheck = () => {
    const storedToken = localStorage.getItem('token');
    toast({
      title: "Token Check",
      description: storedToken 
        ? "Token exists in localStorage" 
        : "No token found in localStorage",
      variant: storedToken ? "default" : "destructive",
    });
  };
  
  const handleTestIntegrationsApi = async () => {
    setIsTestingIntegrations(true);
    setTestIntegrationsResponse(null);
    setTestIntegrationsError(null);
    
    try {
      // Test the integrations endpoint that's failing
      console.log('Testing integrations API with token:', localStorage.getItem('token'));
      const response = await fetchData('/api/integrations');
      setTestIntegrationsResponse(JSON.stringify(response, null, 2));
      
      toast({
        title: "Integrations API Test Successful",
        description: "Successfully called the integrations endpoint",
      });
    } catch (error) {
      console.error('Integrations API test failed:', error);
      setTestIntegrationsError(error instanceof Error ? error.message : String(error));
      
      toast({
        title: "Integrations API Test Failed",
        description: error instanceof Error ? error.message : "Integrations API call failed",
        variant: "destructive",
      });
    } finally {
      setIsTestingIntegrations(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Debug Authentication</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-semibold">Is Authenticated:</p> 
                <p className={`text-lg bg-muted p-2 rounded ${user ? "text-green-500" : "text-red-500"}`}>
                  {user ? "Yes ✓" : "No ✗"}
                </p>
              </div>
              
              <div>
                <p className="font-semibold">Token:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-20">
                  {token || "No token"}
                </pre>
              </div>
              
              <div>
                <p className="font-semibold">User:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                  {user ? JSON.stringify(user, null, 2) : "No user data"}
                </pre>
              </div>
              
              <div>
                <p className="font-semibold">LocalStorage Token:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-20">
                  {localStorage.getItem('token') || "No token in localStorage"}
                </pre>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button onClick={handleManualTokenCheck} variant="outline" size="sm">
                  Check Token
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Authentication Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button onClick={handleLogin}>
                  Login
                </Button>
                
                <Button variant="destructive" onClick={logout}>
                  Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>API Testing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col space-y-4">
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleTestApiCall} 
                    disabled={isTestingApi}
                    variant="secondary"
                  >
                    {isTestingApi ? "Testing API..." : "Test Auth API"}
                  </Button>
                  
                  <Button 
                    onClick={handleTestIntegrationsApi} 
                    disabled={isTestingIntegrations}
                    variant="outline"
                  >
                    {isTestingIntegrations ? "Testing..." : "Test Integrations API"}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold mb-2">Auth API Test Results:</p>
                    
                    {testApiResponse && (
                      <div>
                        <p className="text-xs font-semibold text-green-500">Success Response:</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-60 mt-1">
                          {testApiResponse}
                        </pre>
                      </div>
                    )}
                    
                    {testApiError && (
                      <div>
                        <p className="text-xs font-semibold text-red-500">Error Response:</p>
                        <pre className="text-xs bg-red-50 text-red-500 p-2 rounded overflow-x-auto max-h-60 mt-1">
                          {testApiError}
                        </pre>
                      </div>
                    )}
                    
                    {!testApiResponse && !testApiError && (
                      <div className="text-xs italic text-gray-500 p-2">
                        Click "Test Auth API" to run the test...
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Integrations API Test Results:</p>
                    
                    {testIntegrationsResponse && (
                      <div>
                        <p className="text-xs font-semibold text-green-500">Success Response:</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-60 mt-1">
                          {testIntegrationsResponse}
                        </pre>
                      </div>
                    )}
                    
                    {testIntegrationsError && (
                      <div>
                        <p className="text-xs font-semibold text-red-500">Error Response:</p>
                        <pre className="text-xs bg-red-50 text-red-500 p-2 rounded overflow-x-auto max-h-60 mt-1">
                          {testIntegrationsError}
                        </pre>
                      </div>
                    )}
                    
                    {!testIntegrationsResponse && !testIntegrationsError && (
                      <div className="text-xs italic text-gray-500 p-2">
                        Click "Test Integrations API" to run the test...
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-amber-50 rounded border border-amber-200 text-amber-800 text-sm mt-2">
                <p className="font-semibold">Debug Tips:</p>
                <ol className="list-decimal pl-4 space-y-1 mt-2">
                  <li>Make sure you login successfully first</li>
                  <li>Verify that the token is stored in localStorage</li>
                  <li>Test the API to check if authentication works</li>
                  <li>Check browser console for detailed logs</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}