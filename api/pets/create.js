const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';

const REQUIRED_FIELDS = ['owner_name', 'whatsapp', 'pet_name', 'species', 'breed', 'gender', 'age', 'state', 'owner_email'];
const SPECIES = ['Dog', 'Cat'];
const GENDERS = ['Male', 'Female'];

async function verifyTurnstile(token, remoteip) {
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token || '' });
  if (remoteip) body.append('remoteip', remoteip);
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json();
  return !!data.success;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { turnstileToken, ...pet } = body;

  if (!turnstileToken) {
    return res.status(400).json({ error: 'Missing verification token.' });
  }

  const remoteip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  const verified = await verifyTurnstile(turnstileToken, remoteip);
  if (!verified) {
    return res.status(400).json({ error: "We couldn't verify you're not a bot. Please try again." });
  }

  for (const field of REQUIRED_FIELDS) {
    if (pet[field] === undefined || pet[field] === null || pet[field] === '') {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }
  if (!SPECIES.includes(pet.species)) {
    return res.status(400).json({ error: 'Invalid species.' });
  }
  if (!GENDERS.includes(pet.gender)) {
    return res.status(400).json({ error: 'Invalid gender.' });
  }
  if (!pet.accepts_whatsapp && !pet.accepts_text && !pet.accepts_calls) {
    return res.status(400).json({ error: 'Choose at least one way for owners to reach you.' });
  }

  // owner_id/is_partner are never taken from the client — this endpoint
  // runs with the service-role key (bypasses RLS), so it is the sole
  // trust boundary for what an anonymous submission is allowed to set.
  const row = {
    owner_id: null,
    owner_email: String(pet.owner_email).trim().toLowerCase(),
    owner_name: String(pet.owner_name).trim(),
    whatsapp: String(pet.whatsapp).trim(),
    pet_name: String(pet.pet_name).trim(),
    species: pet.species,
    breed: String(pet.breed).trim(),
    gender: pet.gender,
    age: Number(pet.age),
    state: String(pet.state).trim(),
    notes: pet.notes ? String(pet.notes).trim() : null,
    breeder: !!pet.breeder,
    available_for_mating: !!pet.available_for_mating,
    accepts_whatsapp: !!pet.accepts_whatsapp,
    accepts_text: !!pet.accepts_text,
    accepts_calls: !!pet.accepts_calls,
    is_partner: false,
    partner_business_name: null,
    lat: pet.lat ?? null,
    lng: pet.lng ?? null,
    photo_url: pet.photo_url || null,
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/pets`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(400).json({ error: (data && data.message) || "That didn't go through." });
    }
    return res.status(200).json({ id: Array.isArray(data) ? data[0]?.id : null });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
