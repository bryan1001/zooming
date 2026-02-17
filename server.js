const express = require('express');
const crypto = require('crypto');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

const OIDC_ISSUER = process.env.OIDC_ISSUER || 'https://auth.eliln.com';
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || '';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI || '';
const AUTH_DISABLED = ['true','1','yes'].includes((process.env.AUTH_DISABLED||'').toLowerCase());

const sessions = new Map();
const states = new Map();

app.get('/oidc/callback', async (req, res) => {
  const { code, state } = req.query;
  const nextUrl = states.get(state) || '/';
  states.delete(state);
  if (!code) return res.redirect('/');
  try {
    const tokenRes = await fetch(`${OIDC_ISSUER}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        redirect_uri: OIDC_REDIRECT_URI,
        client_id: OIDC_CLIENT_ID, client_secret: OIDC_CLIENT_SECRET,
      }),
    });
    if (!tokenRes.ok) return res.redirect('/');
    const tokens = await tokenRes.json();
    const userRes = await fetch(`${OIDC_ISSUER}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = userRes.ok ? await userRes.json() : {};
    const sessionToken = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionToken, user);
    res.cookie('oidc_session', sessionToken, { maxAge: 30*24*3600*1000, httpOnly: true, secure: true, sameSite: 'lax' });
    res.redirect(nextUrl);
  } catch { res.redirect('/'); }
});

app.get('/oidc/logout', (req, res) => {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => { const [k,...v] = c.trim().split('='); if(k) cookies[k]=v.join('='); });
  if (cookies.oidc_session) sessions.delete(cookies.oidc_session);
  res.clearCookie('oidc_session');
  res.redirect(`${OIDC_ISSUER}/logout`);
});

app.use((req, res, next) => {
  if (AUTH_DISABLED) return next();
  if (req.path.startsWith('/oidc/') || req.path === '/health') return next();
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => { const [k,...v] = c.trim().split('='); if(k) cookies[k]=v.join('='); });
  if (cookies.oidc_session && sessions.has(cookies.oidc_session)) return next();
  if (/\.(js|css|png|jpg|svg|ico|woff2?|ttf|map|webp)$/.test(req.path)) return res.sendStatus(401);
  const state = crypto.randomBytes(16).toString('hex');
  states.set(state, req.originalUrl);
  const params = new URLSearchParams({
    response_type: 'code', client_id: OIDC_CLIENT_ID,
    redirect_uri: OIDC_REDIRECT_URI, scope: 'openid profile',
    state, nonce: crypto.randomBytes(16).toString('hex'),
  });
  res.redirect(`${OIDC_ISSUER}/authorize?${params}`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('{*path}', (req, res) => {
  const f = path.join(__dirname, 'public', 'index.html');
  res.sendFile(f);
});

app.listen(PORT, () => console.log(`Zooming on port ${PORT}`));
