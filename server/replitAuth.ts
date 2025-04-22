import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import { Router } from "express";
import type { Express } from "express";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret-for-testing-only';
const router = Router();

// Initialize OpenID Connect client
let issuer: client.Issuer<client.Client>;
let client: client.Client;

async function initializeOIDC() {
  issuer = await client.Issuer.discover('https://replit.com/.well-known/openid-configuration');
  client = new issuer.Client({
    client_id: process.env.REPLIT_CLIENT_ID || 'client_id',
    redirect_uris: [`https://${process.env.REPLIT_DOMAINS}/api/auth/callback`],
    response_types: ['id_token'],
  });
}

router.get('/login', (req, res) => {
  const authUrl = `https://replit.com/auth_with_repl_site?domain=${req.headers.host}`;
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const user = {
      id: req.headers['x-replit-user-id'],
      name: req.headers['x-replit-user-name'],
      profileImage: req.headers['x-replit-user-profile-image']
    };

    if (!user.id) {
      return res.redirect('/login?error=auth_failed');
    }

    // Store or update user in database
    const existingUser = await storage.getUserByReplitId(parseInt(user.id as string));

    if (!existingUser) {
      await storage.createUser({
        replitId: parseInt(user.id as string),
        username: user.name as string,
        email: `${user.name}@replit.user`,
        name: user.name as string
      });
    }

    // Set session
    if (req.session) {
      req.session.user = user;
      req.session.authenticated = true;
    }

    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect('/login?error=auth_failed');
  }
});

router.get('/user', (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
  } else {
    res.json(null);
  }
});

router.get('/logout', (req, res) => {
  req.session?.destroy(() => {});
  res.redirect('/');
});

export const replitAuthRoutes = router;

export async function setupAuth(app: Express) {
  // Initialize OpenID Connect
  await initializeOIDC();

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
  app.use('/api/auth', replitAuthRoutes);

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

export const isAuthenticated: any = (req, res, next) => {
  if (req.session?.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};