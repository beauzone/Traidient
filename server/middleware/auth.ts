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

// Authentication middleware that works with both JWT tokens and Replit Auth
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for existing authenticated user from Replit Auth (passport.js)
    if (req.isAuthenticated && req.isAuthenticated()) {
      // User is already authenticated via Replit Auth
      // Passport puts the user object directly in req.user
      const passportUser = req.user as any;
      
      if (!passportUser || !passportUser.sub) {
        console.error('Invalid user from Replit Auth');
        return res.status(401).json({ message: 'Unauthorized: Invalid Replit Auth user' });
      }
      
      // Look up the user in our database using their Replit ID
      const replitId = parseInt(passportUser.sub);
      const dbUser = await storage.getUserByReplitId(replitId);
      
      if (dbUser) {
        // If user exists in our DB, use that record
        (req as AuthRequest).user = {
          id: dbUser.id,
          replitId: replitId,
          username: dbUser.username,
          email: dbUser.email,
          name: dbUser.name,
          ...passportUser // Keep all other Replit properties
        };
      } else {
        // User authenticated with Replit but not in our DB yet
        // This could happen if they're a new user
        console.warn(`User with Replit ID ${replitId} authenticated but not found in database`);
        return res.status(401).json({ 
          message: 'Unauthorized: User needs to register',
          replitAuth: true,
          replitUser: {
            sub: passportUser.sub,
            username: passportUser.username,
            email: passportUser.email,
            name: passportUser.name || passportUser.username
          }
        });
      }
      
      return next();
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

    (req as AuthRequest).user = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      replitId: user.replitId
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid authentication' });
  }
};

// Helper to create properly typed route handlers for authenticated routes
export function createAuthHandler<P = any, ResBody = any, ReqBody = any>(
  handler: (req: AuthRequest, res: Response<ResBody>) => Promise<any>
): RequestHandler<P, ResBody, ReqBody> {
  return (req, res, next) => {
    // Make sure we have a valid authenticated user before proceeding
    // First, check if there's a user attribute and cast the request properly
    const authReq = req as unknown as AuthRequest;
    
    if (!authReq.user || !authReq.user.id) {
      console.error('No valid user in authenticated request');
      res.status(401).json({ message: 'Unauthorized' } as any);
      return;
    }
    
    return handler(authReq, res).catch(next);
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