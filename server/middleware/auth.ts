import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import { type User } from '@shared/schema';
import * as crypto from 'crypto';

// Use provided JWT_SECRET or generate a secure one
// Use the JWT_SECRET environment variable, or a default (but consistent) secret for development
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-for-testing-only';

// Define an interface for authenticated requests that works with both JWT and Replit Auth 
export interface AuthRequest extends Request {
  user: {
    id: number; // Common required property
    [key: string]: any; // Allow for other properties from either auth method
  };
}

// Check running environment and auth configuration
const DEV_MODE = process.env.NODE_ENV !== 'production';

// Auto-login should only be enabled explicitly to avoid security issues in public environments like Replit
// In Replit, we prefer to use Replit's OpenID Connect instead of auto-login
const REPLIT_ENV = process.env.REPL_ID && process.env.REPLIT_DOMAINS;

// Only enable auto-login in dev mode when not in Replit environment, or when explicitly configured
const DEV_AUTO_LOGIN = DEV_MODE && 
  (!REPLIT_ENV || process.env.DEV_AUTO_LOGIN === 'true');

console.log(`Server environment: ${DEV_MODE ? 'Development' : 'Production'}, Replit: ${REPLIT_ENV ? 'Yes' : 'No'}`);
console.log(`Auto-login: ${DEV_AUTO_LOGIN ? 'Enabled' : 'Disabled'}`);

// Cache for dev user to avoid repeated DB lookups
let devModeUser: User | null = null;

// Authentication middleware that works with both JWT tokens and Replit Auth
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for existing authenticated user from Replit Auth first
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

    // For development auto-login as fallback
    if (DEV_AUTO_LOGIN) {
      try {
        // Get or create a development user
        const username = 'dev_user';

        // Use cached user if available
        if (devModeUser) {
          // Set the dev user on the request
          (req as AuthRequest).user = {
            id: devModeUser.id,
            username: devModeUser.username,
            email: devModeUser.email,
            name: devModeUser.name,
            role: 'user'
          };
          return next();
        }

        // Try to get existing user
        const existingUser = await storage.getUserByUsername(username);

        if (existingUser) {
          // Use existing user
          devModeUser = existingUser;

          (req as AuthRequest).user = {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            name: existingUser.name,
            role: 'user'
          };
          return next();
        } else {
          try {
            // Create a dev user if not exists
            console.log('Creating development user for auto-login');
            const newUser = await storage.createUser({
              username: username,
              password: await hashPassword('password'),
              email: 'dev@example.com',
              name: 'Development User'
            });

            // Cache the user for future requests
            devModeUser = newUser;

            // Set the dev user on the request
            (req as AuthRequest).user = {
              id: newUser.id,
              username: newUser.username,
              email: newUser.email,
              name: newUser.name,
              role: 'user'
            };
            return next();
          } catch (createError) {
            // If creation fails (likely due to race condition), try fetching again
            console.log('User creation failed, trying to fetch existing user');
            const retryUser = await storage.getUserByUsername(username);

            if (retryUser) {
              // Cache the user for future requests
              devModeUser = retryUser;

              // Set the dev user on the request
              (req as AuthRequest).user = {
                id: retryUser.id,
                username: retryUser.username,
                email: retryUser.email,
                name: retryUser.name,
                role: 'user'
              };
              return next();
            } else {
              throw new Error('Unable to create or fetch dev_user');
            }
          }
        }
      } catch (error) {
        console.error('Auto-login error:', error);
        return res.status(500).json({ message: 'Internal server error during auto-login' });
      }
    }

    // Check for existing authenticated user from Replit Auth (passport.js)
    if (req.session?.authenticated && req.session.user) {
      // User is already authenticated via Replit Auth
      const user = await storage.getUserByReplitId(parseInt(req.session.user.id as string));
      if (user) {
        (req as AuthRequest).user = user;
        return next();
      } else {
        console.warn(`User with Replit ID ${req.session.user.id} authenticated but not found in database`);
        return res.status(401).json({ 
          message: 'Unauthorized: User needs to register',
          replitAuth: true,
          replitUser: req.session.user
        });
      }
    }


    // Fallback to JWT token authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await storage.getUser(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid authentication' });
  }
};

// Enhanced helper to create properly typed route handlers for authenticated routes
// This is a critical function that ensures proper TypeScript typing for auth requirements
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