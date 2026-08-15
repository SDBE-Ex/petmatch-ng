// Vercel populates x-vercel-ip-* headers on every edge request in
// production — free, no API key, and no browser permission prompt,
// unlike navigator.geolocation. These headers are absent in local dev
// (e.g. `vercel dev`), so this degrades to nulls rather than erroring.
module.exports = async (req, res) => {
  const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;
  const region = req.headers['x-vercel-ip-country-region'] || null;
  const lat = req.headers['x-vercel-ip-latitude'] ? Number(req.headers['x-vercel-ip-latitude']) : null;
  const lng = req.headers['x-vercel-ip-longitude'] ? Number(req.headers['x-vercel-ip-longitude']) : null;

  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ city, region, lat, lng });
};
