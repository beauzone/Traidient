import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import { Router } from "express";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import Database from '@replit/database';


if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// Use provided SESSION_SECRET or a default development secret
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret-for-testing-only';

const router = Router();
const db = new Database();

// In-memory store for auth states (only for the new auth system)
const authStates = new Set<string>();


router.get('/login', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  authStates.add(state);

  const authUrl = `https://replit.com/auth_with_repl_site?state=${state}`;
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || !authStates.has(state as string)) {
    console.error('Invalid auth callback:', { code, state });
    return res.redirect('/');
  }

  authStates.delete(state as string);

  try {
    const user = {
      id: Math.floor(Math.random() * 1000) + 1,
      username: 'dev_user',
      email: 'dev@example.com'
    };

    // Store user in session
    if (req.session) {
      req.session.user = user;
    }

    res.redirect('/');
  } catch (error) {
    console.error('Auth error:', error);
    res.redirect('/');
  }
});

router.get('/user', (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
  } else {
    res.json(null);
  }
});

// Dev-only endpoint
router.get('/dev-user', (req, res) => {
  if (process.env.NODE_ENV === 'development') {
    const devUser = {
      id: 3,
      username: 'dev_user',
      email: 'dev@example.com'
    };

    if (req.session) {
      req.session.user = devUser;
    }

    res.json(devUser);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

export const replitAuthRoutes = router;


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
  app.use('/api/auth', replitAuthRoutes); //Mount the new routes


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
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session?.user) { //Check for session user instead of req.isAuthenticated()
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}