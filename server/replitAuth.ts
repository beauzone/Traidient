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

export async function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-jwt-secret-key-should-be-in-env-var",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
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

  const hostname = `${process.env.REPLIT_DOMAINS!.split(",")[0]}`;
  const callbackURL = `https://${hostname}/api/callback`;
  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback) => {
    const claims = tokens.claims();
    if (!claims) {
      return
    }

    const userInfoResponse = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
    
    // Store the original Replit sub as numeric ID for our system
    const replitUserId = parseInt(userInfoResponse.sub as string);
    
    // Check if user exists in our system by Replit ID
    let user = await storage.getUserByReplitId(replitUserId);
    
    // If not, create a new user with the Replit ID
    if (!user) {
      user = await storage.createUser({
        username: userInfoResponse.username as string,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), // Random secure password since login is handled by Replit
        email: userInfoResponse.email as string || `${userInfoResponse.username}@example.com`, // Fallback email if not provided
        name: userInfoResponse.first_name ? `${userInfoResponse.first_name} ${userInfoResponse.last_name || ''}` : userInfoResponse.username as string,
        replitId: replitUserId, // Store the Replit user ID for future lookups
      });
    }
    
    // Add the original Replit data to our user object for convenience
    const userWithReplitData = {
      ...user,
      sub: userInfoResponse.sub,
      replitProfile: userInfoResponse
    };

    verified(null, userWithReplitData);
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

  app.get("/api/login", passport.authenticate(strategy.name));

  app.get(
    "/api/callback",
    passport.authenticate(strategy.name, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    }),
  );

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