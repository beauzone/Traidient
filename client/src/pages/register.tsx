import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const Register = () => {
  const [_, navigate] = useLocation();

  useEffect(() => {
    // Redirect to Replit login on component mount
    window.location.href = "/api/login";
  }, []);

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <svg className="h-12 w-12 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V5Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M4 9H20" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 9V20" stroke="currentColor" strokeWidth="2"/>
            <path d="M9 15L15 15" stroke="currentColor" strokeWidth="2"/>
            <path d="M9 18L13 18" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold">
          Create Your TradeBrain AI Account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Redirecting to Replit authentication...
        </p>
        
        <div className="mt-8 flex justify-center">
          <Button 
            className="w-full" 
            onClick={() => window.location.href = "/api/login"}
          >
            Sign up with Replit
          </Button>
        </div>
        
        <p className="mt-10 text-center text-sm text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="font-medium text-primary hover:text-primary/80">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-primary hover:text-primary/80">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
