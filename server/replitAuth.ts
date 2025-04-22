import { Router } from 'express';
import session from 'express-session';
import { storage } from './storage';

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret-for-testing-only';

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
    const replitId = parseInt(user.id as string);
    let dbUser = await storage.getUserByReplitId(replitId);

    if (!dbUser) {
      dbUser = await storage.createUser({
        replitId,
        username: user.name as string,
        email: `${user.name}@replit.user`,
        name: user.name as string
      });
    }

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

router.get('/logout', (req, res) => {
  req.session?.destroy(() => {});
  res.redirect('/');
});

export function setupAuth(app: any) {
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  }));

  app.use('/api/auth', router);
}

export default router;

export const isAuthenticated: any = (req, res, next) => {
  if (req.session?.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};