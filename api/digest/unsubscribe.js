const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';

// Public, unauthenticated GET so a one-click unsubscribe link in a
// digest email works with no login — the security boundary is knowing
// the per-pet digest_unsubscribe_token itself (an unguessable uuid),
// not a session. Needs the service-role key because
// digest_unsubscribe_token is deliberately never in the public column
// grant (see supabase/migrations/20260906120000_digest_optin.sql) and
// RLS blocks an anon-key write to another owner's row.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const token = req.query?.token;
  if (!token) {
    return res.status(400).send(unsubscribePage(false));
  }

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pets?digest_unsubscribe_token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ digest_optin: false }),
      }
    );
    const data = await resp.json();
    if (!resp.ok || !Array.isArray(data) || data.length === 0) {
      return res.status(404).send(unsubscribePage(false));
    }
    return res.status(200).send(unsubscribePage(true));
  } catch (e) {
    return res.status(500).send(unsubscribePage(false));
  }
};

function unsubscribePage(success) {
  const message = success
    ? "You're unsubscribed. You won't get any more new-match emails for this listing."
    : "That link didn't work. It may have already been used, or the listing may no longer exist.";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PetMatch &mdash; Unsubscribed</title>
<style>
  body{font-family:'Work Sans',sans-serif;background:#1F4732;color:#FBF6EA;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}
  .card{background:#FBF6EA;color:#14241C;border-radius:14px;padding:32px 28px;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,0.18)}
  h1{font-family:'Fraunces',serif;font-size:22px;margin:0 0 12px}
  p{font-size:15px;line-height:1.6}
  a{color:#8A3D22;font-weight:600}
</style>
</head><body><div class="card"><h1>PetMatch</h1><p>${message}</p><p><a href="/">Back to PetMatch</a></p></div></body></html>`;
}
