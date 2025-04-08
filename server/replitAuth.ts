import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { User } from "@shared/schema"; // Import the User type

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// Use provided SESSION_SECRET or a default development secret
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret-for-testing-only';

export async function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax'
    }
  };
  
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  const replId = process.env.REPL_ID!;
  const config = await client.discovery(
    new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
    replId,
  );

  const hostname = process.env.REPLIT_DOMAINS!.split(",")[0];
  const callbackURL = `https://${hostname}/api/callback`;
  console.log('Auth callback URL:', callbackURL);
  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback) => {
    try {
      console.log('Verify function called with tokens', tokens ? 'present' : 'missing');
      
      const claims = tokens.claims();
      if (!claims) {
        console.error('No claims found in token');
        return verified(new Error('No claims found in token'));
      }
      
      console.log('Claims retrieved from token:', { sub: claims.sub });
      
      try {
        const userInfoResponse = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
        console.log('User info fetched:', { 
          sub: userInfoResponse.sub,
          username: userInfoResponse.username,
          email: userInfoResponse.email
        });
        
        // Store the original Replit sub as numeric ID for our system
        const replitUserId = parseInt(userInfoResponse.sub as string);
        
        // Check if user exists in our system by Replit ID
        let user = await storage.getUserByReplitId(replitUserId);
        
        // If not found by Replit ID, try by email (handles case where user exists but without Replit ID)
        const userEmail = userInfoResponse.email as string || `${userInfoResponse.username}@example.com`;
        if (!user && userEmail) {
          console.log('User not found by Replit ID, checking by email:', userEmail);
          try {
            user = await storage.getUserByEmail(userEmail);
            
            // If user exists by email but doesn't have Replit ID, update the user with the Replit ID
            if (user && !user.replitId) {
              console.log('Found user by email, updating with Replit ID:', replitUserId);
              user = await storage.updateUser(user.id, { replitId: replitUserId });
            }
          } catch (emailLookupError) {
            console.warn('Error looking up user by email:', emailLookupError);
          }
        }
        
        // If still not found, create a new user
        if (!user) {
          try {
            console.log('Creating new user for Replit ID:', replitUserId);
            user = await storage.createUser({
              username: userInfoResponse.username as string,
              password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), // Random secure password since login is handled by Replit
              email: userEmail,
              name: userInfoResponse.first_name ? `${userInfoResponse.first_name} ${userInfoResponse.last_name || ''}` : userInfoResponse.username as string,
              replitId: replitUserId, // Store the Replit user ID for future lookups
            });
            console.log('New user created:', user.id);
          } catch (createError: any) {
            // If the error is a duplicate constraint violation, try to fetch the user again
            if (createError.code === '23505') {
              console.warn('Duplicate constraint violation during user creation, attempting to fetch existing user');
              
              // Try by email again (in case race condition caused another process to create the user)
              if (userEmail) {
                try {
                  user = await storage.getUserByEmail(userEmail);
                  console.log('Successfully retrieved user by email after creation failed:', user?.id);
                  
                  // Update with Replit ID if needed
                  if (user && !user.replitId) {
                    console.log('Updating existing user with Replit ID');
                    user = await storage.updateUser(user.id, { replitId: replitUserId });
                  }
                } catch (secondEmailLookupError) {
                  console.error('Failed to retrieve user by email after creation error:', secondEmailLookupError);
                  throw createError; // Re-throw if we still can't find the user
                }
              } else {
                throw createError; // Re-throw if we don't have an email to try
              }
            } else {
              // For any other error, re-throw
              throw createError;
            }
          }
        } else {
          console.log('Found existing user for Replit ID:', replitUserId, 'User ID:', user.id);
        }
        
        // Add the original Replit data to our user object for convenience
        const userWithReplitData = {
          ...user,
          sub: userInfoResponse.sub,
          replitProfile: userInfoResponse
        };

        verified(null, userWithReplitData);
      } catch (userInfoError) {
        console.error('Error fetching user info:', userInfoError);
        verified(userInfoError as Error);
      }
    } catch (error) {
      console.error('Unexpected error in verify function:', error);
      verified(error as Error);
    }
  };

  const strategy = new Strategy(
    {
      config,
      scope: "openid email profile",
      callbackURL,
    },
    verify,
  );
  passport.use(strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser(async (user: Express.User, cb) => {
    try {
      // Optionally refresh user data from database here
      const refreshedUser = await storage.getUser((user as any).id);
      cb(null, refreshedUser || user);
    } catch (err) {
      cb(err);
    }
  });

  // Add error logging for the login route
  app.get("/api/login", (req, res, next) => {
    console.log('Starting Replit Auth login process...');
    passport.authenticate(strategy.name, (err) => {
      if (err) {
        console.error('Error during Replit login auth:', err);
        return next(err);
      }
      next();
    })(req, res, next);
  });

  // Add extensive error handling for the callback route
  app.get("/api/callback", (req, res, next) => {
    console.log('Received callback from Replit auth, processing...');
    
    // Extract and log query params for debugging
    const { code, state, error, error_description } = req.query;
    if (error) {
      console.error(`OAuth error: ${error}, Description: ${error_description}`);
      return res.redirect('/');
    }
    
    console.log(`Auth code present: ${!!code}, State present: ${!!state}`);
    
    passport.authenticate(strategy.name, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/",
    }, (err, user, info) => {
      if (err) {
        console.error('Error during Replit callback processing:', err);
        return res.redirect('/');
      }
      
      if (!user) {
        console.error('No user returned from Replit auth:', info);
        return res.redirect('/');
      }
      
      // Log in the user
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Error during login after successful auth:', loginErr);
          return res.redirect('/');
        }
        
        console.log('Replit auth successful, user logged in:', user.id);
        return res.redirect('/');
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: replId,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href,
      );
    });
  });
  
  // Add route to get current user
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      // Don't send the password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.json(null);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}