const crypto = require('crypto');

const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l';
// Domain property (not a URL-prefix property) — matches the DNS-based
// google-site-verification TXT record already on petmatch.fit, which is
// how Domain properties are verified.
const SITE_URL = 'sc-domain:petmatch.fit';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signServiceAccountJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer
    .sign(sa.private_key)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${unsigned}.${signature}`;
}

async function getAccessToken(sa) {
  const assertion = signServiceAccountJwt(sa);
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to get a Google access token');
  }
  return data.access_token;
}

async function verifyCallerIsAdmin(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=email`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) return false;
  const rows = await resp.json();
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAdmin = await verifyCallerIsAdmin(req.headers.authorization);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Admin sign-in required' });
  }

  const rawKey = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!rawKey) {
    return res.status(200).json({ configured: false, rows: [] });
  }

  let sa;
  try {
    sa = JSON.parse(rawKey);
  } catch (e) {
    return res.status(500).json({ error: 'GSC_SERVICE_ACCOUNT_JSON is not valid JSON' });
  }

  try {
    const accessToken = await getAccessToken(sa);

    // ?inspect=<full URL> — real-time index status for one URL via the
    // URL Inspection API, same read-only scope as the query below. Used
    // to verify actual indexing, not just technical indexability
    // (noindex/canonical/sitemap, which are checked separately and don't
    // prove Google has actually crawled+indexed the page).
    if (req.query && req.query.inspect) {
      const inspResp = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl: req.query.inspect, siteUrl: SITE_URL }),
      });
      const inspData = await inspResp.json();
      if (!inspResp.ok) {
        return res.status(200).json({ configured: true, error: inspData.error?.message || 'Inspection failed' });
      }
      const result = inspData.inspectionResult?.indexStatusResult;
      return res.status(200).json({
        configured: true,
        verdict: result?.verdict,
        coverageState: result?.coverageState,
        lastCrawlTime: result?.lastCrawlTime,
        indexingState: result?.indexingState,
      });
    }

    // Search Console data lags a couple of days; end 3 days ago, 28-day window.
    const end = new Date();
    end.setDate(end.getDate() - 3);
    const start = new Date(end);
    start.setDate(start.getDate() - 28);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const gscResp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: fmt(start),
          endDate: fmt(end),
          dimensions: ['page'],
          rowLimit: 5000,
        }),
      }
    );
    const gscData = await gscResp.json();

    if (!gscResp.ok) {
      // Most likely cause: the service account hasn't been added as a
      // restricted user on the petmatch.fit property yet (Search Console
      // has no API for that — it's a manual step in Settings > Users and
      // permissions). Surface the real error rather than a generic 500.
      return res.status(200).json({
        configured: true,
        rows: [],
        error: gscData.error?.message || 'Search Console query failed',
      });
    }

    const rows = (gscData.rows || [])
      .map((r) => {
        const url = r.keys[0];
        const match = url.match(/\/updates\/([0-9a-fA-F-]{8,36})/);
        if (!match) return null;
        return {
          path: `/updates/${match[1]}`,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ configured: true, rows });
  } catch (e) {
    return res.status(200).json({ configured: true, rows: [], error: e.message });
  }
};
