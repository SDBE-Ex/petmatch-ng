const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1558821078-8b2696bae783?w=1200&h=630&fit=crop&q=80&auto=format';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function waLink(number, petName) {
  const intl = String(number).replace(/[^0-9]/g, '');
  const msg = encodeURIComponent(`Hi! I found ${petName} on PetMatch and I'm interested in a possible match.`);
  return `https://wa.me/${intl}?text=${msg}`;
}

function callLink(number) {
  return `tel:+${String(number).replace(/[^0-9]/g, '')}`;
}

function smsLink(number, petName) {
  const intl = String(number).replace(/[^0-9]/g, '');
  const msg = encodeURIComponent(`Hi! I found ${petName} on PetMatch and I'm interested in a possible match.`);
  return `sms:+${intl}?body=${msg}`;
}

function connectButtonsHtml(p) {
  const buttons = [];
  const firstName = escapeHtml(p.owner_name.split(' ')[0]);
  if (p.accepts_whatsapp) {
    buttons.push(`<a class="btn btn-clay contact-btn" target="_blank" rel="noopener" href="${waLink(p.whatsapp, p.pet_name)}">WhatsApp ${firstName}</a>`);
  }
  if (p.accepts_text) {
    buttons.push(`<a class="btn btn-ghost contact-btn" href="${smsLink(p.whatsapp, p.pet_name)}">Text ${firstName}</a>`);
  }
  if (p.accepts_calls) {
    buttons.push(`<a class="btn btn-forest contact-btn" href="${callLink(p.whatsapp)}">Call ${firstName}</a>`);
  }
  if (buttons.length === 0) {
    buttons.push(`<span class="btn btn-ghost contact-btn" style="cursor:default">This owner hasn't listed a way to be reached yet</span>`);
  }
  return buttons.join('');
}

function notFoundPage(res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Listing not found | PetMatch</title>
<meta name="robots" content="noindex">
${fontLinks()}
<style>${sharedStyles()}</style>
</head>
<body>
<header class="top">
  <div class="eyebrow">Dogs &amp; Cats · Near You</div>
  <p class="brand-mark"><a href="/" title="Back to the PetMatch homepage">PetMatch</a></p>
</header>
<main>
  <article class="formcard" style="text-align:center">
    <h1 style="margin-top:0">This listing is no longer available</h1>
    <p>It may have been removed by its owner, or the link is out of date.</p>
    <div class="cta-row"><a class="btn btn-clay" href="/">Find a Match</a></div>
  </article>
</main>
</body>
</html>`;
  res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}

function fontLinks() {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">`;
}

function sharedStyles() {
  return `
  :root{ --ink:#14241C; --paper:#FBF6EA; --forest:#1F4732; --forest-dark:#132E20; --marigold:#E8A33D; --clay:#A64B2A; --clay-dark:#8A3D22; --line:#D8CBA8; --male:#3C6E9C; --female:#B5507A; --radius:14px; }
  *{box-sizing:border-box;}
  body{margin:0; background:var(--forest); color:var(--ink); font-family:'Work Sans', sans-serif; -webkit-font-smoothing:antialiased;}
  header.top{ background:var(--forest); color:var(--paper); padding:30px 20px 22px; text-align:center; }
  header.top .eyebrow{font-family:'IBM Plex Mono',monospace; letter-spacing:.14em; text-transform:uppercase; font-size:11.5px; color:var(--marigold); margin-bottom:10px;}
  header.top .brand-mark{font-family:'Fraunces',serif; font-weight:600; font-size:clamp(26px,5vw,40px); margin:0; letter-spacing:-0.01em;}
  header.top .brand-mark a{color:inherit; text-decoration:none;}
  main{max-width:700px; margin:0 auto; padding:28px 16px 80px;}
  .formcard{background:var(--paper); border-radius:var(--radius); padding:30px 28px; box-shadow:0 10px 30px rgba(0,0,0,0.18);}
  .formcard h1{font-family:'Fraunces',serif; font-size:26px; margin:0 0 4px; color:var(--forest-dark); padding-right:0;}
  .photo{width:calc(100% + 56px); margin:-30px -28px 20px; display:block; max-width:none; height:260px; object-fit:cover; border-radius:var(--radius) var(--radius) 0 0;}
  .tagrow{display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 14px;}
  .tag{font-family:'IBM Plex Mono',monospace; font-size:11px; padding:3px 8px; border-radius:999px; background:rgba(31,71,50,0.09); color:var(--forest-dark); display:inline-block;}
  .tag.male{background:rgba(60,110,156,0.14); color:var(--male);} .tag.female{background:rgba(181,80,122,0.14); color:var(--female);}
  .tag.breeder{background:rgba(232,163,61,0.22); color:#8a5f16;}
  .tag.partner{background:rgba(232,163,61,0.28); color:#8a5f16; font-weight:600;}
  .tag.available{background:rgba(31,71,50,0.14); color:var(--forest);}
  .tag.unavailable{background:rgba(166,75,42,0.14); color:var(--clay-dark);}
  .meta{font-size:13px; color:#7a7261; margin:0 0 12px;}
  .notes{font-size:14.5px; color:#3c3628; line-height:1.6; margin:0 0 16px;}
  .owner-line{font-size:13px; color:#5b5142; margin:0 0 18px;}
  .connect-row{display:flex; gap:8px; flex-wrap:wrap;}
  .btn{font-family:'IBM Plex Mono',monospace; font-size:12.5px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; border:none; border-radius:9px; padding:11px 16px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; text-decoration:none; flex:1; min-width:120px; text-align:center;}
  .btn-clay{background:var(--clay); color:#fff;}
  .btn-forest{background:var(--forest); color:#fff;}
  .btn-ghost{background:transparent; border:1.5px solid var(--forest); color:var(--forest);}
  .cta-row{margin-top:20px;}
  .back-link{display:inline-block; margin-top:18px; font-size:13px; color:var(--forest-dark); font-weight:600;}
  `;
}

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id || !/^[0-9a-fA-F-]{8,36}$/.test(id)) {
    return notFoundPage(res);
  }

  let pet;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pets?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await resp.json();
    pet = Array.isArray(rows) ? rows[0] : null;
  } catch (e) {
    return notFoundPage(res);
  }

  if (!pet) {
    return notFoundPage(res);
  }

  const p = pet;
  const genderClass = p.gender === 'Male' ? 'male' : 'female';
  const name = escapeHtml(p.pet_name);
  const breed = escapeHtml(p.breed);
  const state = escapeHtml(p.state);
  const canonicalUrl = `https://petmatch.fit/pets/${p.id}`;
  const image = p.photo_url || DEFAULT_IMAGE;

  const title = p.available_for_mating
    ? `${name}, ${breed} ${p.species}, Available for Mating in ${state} | PetMatch`
    : `${name}, ${breed} ${p.species} in ${state} | PetMatch`;

  const descBase = `${name} is a ${p.age} year old ${p.gender.toLowerCase()} ${breed} ${p.species.toLowerCase()} in ${state}${p.available_for_mating ? ', available for mating now' : ''}.`;
  const description = (p.notes ? `${descBase} ${p.notes}` : descBase).slice(0, 300);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-22NDCVE8MB"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-22NDCVE8MB');
</script>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PetMatch">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
${fontLinks()}
<style>${sharedStyles()}</style>
</head>
<body>
<header class="top">
  <div class="eyebrow">Dogs &amp; Cats · Near You</div>
  <p class="brand-mark"><a href="/" title="Back to the PetMatch homepage">PetMatch</a></p>
</header>
<main>
  <article class="formcard">
    ${p.photo_url ? `<img class="photo" src="${escapeHtml(p.photo_url)}" alt="${name}, a ${breed} ${p.species.toLowerCase()} in ${state}">` : ''}
    <h1>${name}</h1>
    <div class="tagrow">
      <span class="tag">${escapeHtml(p.species)}</span>
      <span class="tag ${genderClass}">${escapeHtml(p.gender)}</span>
      <span class="tag">${breed}</span>
      ${p.breeder ? '<span class="tag breeder">Breeder</span>' : ''}
      ${p.is_partner ? '<span class="tag partner">🏪 PetMatch Partner</span>' : ''}
      <span class="tag ${p.available_for_mating ? 'available' : 'unavailable'}">${p.available_for_mating ? 'Available now' : 'Not available now'}</span>
    </div>
    <p class="meta">${p.age} yr${p.age == 1 ? '' : 's'} old · ${state}</p>
    ${p.notes ? `<p class="notes">${escapeHtml(p.notes)}</p>` : ''}
    <p class="owner-line">${p.is_partner ? `Listed by PetMatch Partner: ${escapeHtml(p.partner_business_name || p.owner_name)}` : `Listed by ${escapeHtml(p.owner_name)}`}</p>
    <div class="connect-row">${connectButtonsHtml(p)}</div>
    <div class="connect-row" style="margin-top:8px">
      <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`🐾 Check out ${p.pet_name} on PetMatch — a ${breed} ${p.species.toLowerCase()} in ${state} looking for a mate: ${canonicalUrl}`)}">Share ${name}'s profile</a>
    </div>
  </article>

  <article class="formcard" style="margin-top:20px; text-align:center">
    <h2 style="font-family:'Fraunces',serif; font-size:19px; margin:0 0 8px; color:var(--forest-dark)">Have a dog or cat of your own?</h2>
    <p style="font-size:14.5px; color:#3c3628; line-height:1.6; margin:0 0 16px">List them free and find matches like ${name} nearby — takes under a minute, no fees ever.</p>
    <div class="cta-row"><a class="btn btn-clay" href="/">List Your Pet</a></div>
    <div class="cta-row" style="margin-top:10px"><a class="back-link" href="/">&larr; See more pets on PetMatch</a></div>
  </article>
</main>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.status(200).send(html);
};
