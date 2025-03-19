import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function DebugPage() {
  const { user, token, login, logout } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("password");

  const handleLogin = async () => {
    try {
      await login(username, password);
      toast({
        title: "Login successful",
        description: "You're now logged in.",
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Login failed",
        variant: "destructive",
      });
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
                <p className="text-lg bg-muted p-2 rounded">{user ? "Yes" : "No"}</p>
              </div>
              
              <div>
                <p className="font-semibold">Token:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {token || "No token"}
                </pre>
              </div>
              
              <div>
                <p className="font-semibold">User:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {user ? JSON.stringify(user, null, 2) : "No user data"}
                </pre>
              </div>
              
              <div>
                <p className="font-semibold">LocalStorage Token:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {localStorage.getItem('token') || "No token in localStorage"}
                </pre>
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
      </div>
    </div>
  );
}