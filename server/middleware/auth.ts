import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-for-testing-only';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First check for Replit Auth session
    if (req.session?.authenticated && req.session.user) {
      const user = await storage.getUserByReplitId(parseInt(req.session.user.id as string));
      if (user) {
        (req as AuthRequest).user = user;
        return next();
      }
    }

    // Then check for JWT token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        const user = await storage.getUser(decoded.userId);
        if (user) {
          (req as AuthRequest).user = user;
          return next();
        }
      } catch (error) {
        console.error('JWT verification failed:', error);
      }
    }

    // If in development, allow dev user login
    if (process.env.NODE_ENV === 'development') {
      const devUser = await storage.getUserByUsername('dev_user');
      if (devUser) {
        (req as AuthRequest).user = devUser;
        return next();
      }
    }

    return res.status(401).json({ message: 'Unauthorized: Please log in' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

export function createAuthHandler<P = any, ResBody = any, ReqBody = any>(
  handler: (req: AuthRequest, res: Response<ResBody>) => Promise<any>
): RequestHandler<P, ResBody, ReqBody> {
  return async (req, res, next) => {
    try {
      // First, make sure the request is authenticated and has valid user data
      const authReq = req as unknown as AuthRequest;

      // Add additional diagnostics for auth debugging in Replit environment
      const REPLIT_ENV = process.env.REPL_ID && process.env.REPLIT_DOMAINS;
      const DEBUG_AUTH = REPLIT_ENV || process.env.DEBUG_AUTH === 'true';

      if (DEBUG_AUTH) {
        console.log(`Auth debug - Req path: ${req.path}`);
        console.log(`Auth debug - isAuthenticated method exists: ${typeof req.isAuthenticated === 'function'}`);
        console.log(`Auth debug - isAuthenticated result: ${req.isAuthenticated ? req.isAuthenticated() : 'N/A'}`);
        console.log(`Auth debug - Has user object: ${!!req.user}`);
        console.log(`Auth debug - Auth header: ${req.headers.authorization ? 'Present' : 'Missing'}`);
        console.log(`Auth debug - Session user: ${req.session?.user ? 'Present' : 'Missing'}`);
        console.log(`Auth debug - Session authenticated: ${req.session?.authenticated ? 'Yes' : 'No'}`);
      }


      // Handle development auto-login
      if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTO_LOGIN === 'true' && !authReq.user) {
        return res.redirect('/api/auth/dev-user');
      }

      // Check for valid user object with required id property
      if (!authReq.user || typeof authReq.user.id !== 'number') {
        console.warn(`Authentication failure: No valid user for request to ${req.path}`);

        // Provide more specific error information
        const errorDetails = {
          message: 'Authentication required',
          path: req.path,
          reason: !authReq.user ? 'No user object present' : 'Invalid user ID',
          fix: 'Please log in again'
        };

        return res.status(401).json(errorDetails as any);
      }

      // Execute the handler with proper error handling
      try {
        return await handler(authReq, res);
      } catch (handlerError) {
        console.error(`Error in auth handler for ${req.path}:`, handlerError);
        // Pass to next middleware for standard Express error handling
        next(handlerError);
      }
    } catch (authError) {
      // Catch any unexpected errors in the auth wrapper itself
      console.error(`Critical error in auth wrapper:`, authError);
      res.status(500).json({
        message: 'Internal server error in authentication handler',
        path: req.path
      } as any);
    }
  };
}

// Function to generate a JWT token for a user
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Helper function to hash a password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Helper function to compare a password with a hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}