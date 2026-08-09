const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l';

const STATIC_URLS = [
  { loc: 'https://petmatch.fit/', changefreq: 'daily' },
  { loc: 'https://petmatch.fit/about', changefreq: 'monthly' },
  { loc: 'https://petmatch.fit/updates', changefreq: 'weekly' },
  { loc: 'https://petmatch.fit/safety', changefreq: 'monthly' },
];

function urlEntry({ loc, lastmod, changefreq }) {
  return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}</url>`;
}

module.exports = async (req, res) => {
  let pets = [];
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pets?select=id,created_at`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (resp.ok) pets = await resp.json();
  } catch (e) {
    // fall through with just the static pages below
  }

  const urls = [
    ...STATIC_URLS,
    ...pets.map(p => ({
      loc: `https://petmatch.fit/pets/${p.id}`,
      lastmod: p.created_at ? p.created_at.slice(0, 10) : undefined,
      changefreq: 'weekly',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlEntry).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400');
  res.status(200).send(xml);
};
