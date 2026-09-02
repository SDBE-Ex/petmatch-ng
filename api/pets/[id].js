const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l';
// owner_email is withheld from anon via a column-level GRANT — select=*
// fails outright against a partial grant, so this lists columns explicitly.
const PETS_PUBLIC_COLUMNS = 'id,owner_id,owner_name,whatsapp,pet_name,species,breed,gender,age,state,notes,breeder,photo_url,created_at,available_for_mating,lat,lng,accepts_whatsapp,accepts_calls,accepts_text,is_partner,partner_business_name';
const DEFAULT_IMAGE = 'https://petmatch.fit/petmatch-og.jpg';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
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
  <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav">Menu &#9662;</button>
  <nav class="site-nav" id="siteNav" aria-label="Site navigation">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/updates">Updates</a>
    <a href="/partners">For Pet Businesses</a>
  </nav>
</header>
<main>
  <article class="formcard" style="text-align:center">
    <h1 style="margin-top:0">This listing is no longer available</h1>
    <p>It may have been removed by its owner, or the link is out of date.</p>
    <div class="cta-row"><a class="btn btn-clay" href="/">Find a Match</a></div>
  </article>
  <div style="display:flex; justify-content:center; padding:12px 16px 0; text-align:center;">
  <p style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:#B9CBBD; max-width:640px; line-height:1.7; margin:0 auto;"><span style="color:var(--marigold)">🌐</span> Prefer another language? Your browser can translate this page: check the translate icon in your address bar. · Kana son wani harshe? Mai binciken ka zai iya fassara wannan shafin: duba alamar fassara a cikin akwatin adireshi. · You wan use another language? Your browser fit translate dis page: check di translate icon for your address bar. · Vous préférez une autre langue ? Votre navigateur peut traduire cette page : cherchez l'icône de traduction dans la barre d'adresse.</p>
  </div>
</main>
<footer style="text-align:center; color:#B9CBBD; font-size:12px; padding:24px 16px 40px; font-family:'IBM Plex Mono',monospace;">PETMATCH · A simple directory, not a broker. Meet safely, and check health and vaccination records before any pairing.<br>Contact: <a style="color:inherit" href="mailto:hello@petmatch.fit">hello@petmatch.fit</a> · <a style="color:inherit" href="/">Home</a> · <a style="color:inherit" href="/about">About</a> · <a style="color:inherit" href="/faq">FAQ</a> · <a style="color:inherit" href="/compare">Compare</a> · <a style="color:inherit" href="/safety">Trust &amp; Safety</a> · <a style="color:inherit" href="/updates">Updates</a> · <a style="color:inherit" href="/partners">For Pet Businesses</a></footer>
<script>
(function(){
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if(!toggle || !nav) return;
  toggle.addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();
</script>
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
  header.top .nav-toggle{display:none; margin:14px auto 0; font-family:'IBM Plex Mono',monospace; font-size:11.5px; letter-spacing:.04em; text-transform:uppercase; color:var(--marigold); background:transparent; border:1.5px solid rgba(232,163,61,0.5); border-radius:999px; padding:7px 16px; cursor:pointer;}
  header.top .nav-toggle:focus-visible{outline:3px solid var(--marigold); outline-offset:2px;}
  .site-nav{display:flex; flex-wrap:wrap; justify-content:center; gap:16px; margin:16px auto 0; max-width:600px;}
  .site-nav a{font-family:'IBM Plex Mono',monospace; font-size:11.5px; letter-spacing:.03em; text-transform:uppercase; color:#DCE7DD; text-decoration:none;}
  .site-nav a:hover{color:var(--marigold);}
  @media (max-width:640px){
    header.top .nav-toggle{display:inline-block;}
    .site-nav{display:none; flex-direction:column; gap:2px; background:rgba(0,0,0,0.15); border-radius:10px; padding:10px; max-width:280px;}
    .site-nav.open{display:flex;}
    .site-nav a{padding:9px 14px; border-radius:6px; text-align:center;}
    .site-nav a:hover{background:rgba(255,255,255,0.08);}
  }
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
      `${SUPABASE_URL}/rest/v1/pets?id=eq.${encodeURIComponent(id)}&select=${PETS_PUBLIC_COLUMNS}`,
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
    ? `${p.pet_name}, ${p.breed} ${p.species}, Available for Mating in ${p.state} | PetMatch`
    : `${p.pet_name}, ${p.breed} ${p.species} in ${p.state} | PetMatch`;

  const descBase = `${p.pet_name} is a ${p.age} year old ${p.gender.toLowerCase()} ${p.breed} ${p.species.toLowerCase()} in ${p.state}${p.available_for_mating ? ', available for mating now' : ''}.`;
  const description = (p.notes ? `${descBase} ${p.notes}` : descBase).slice(0, 300);
  const ownerFirstName = escapeHtml(p.owner_name.split(' ')[0]);

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonicalUrl,
      inLanguage: 'en',
      datePublished: p.created_at,
      image,
      isPartOf: { '@type': 'WebSite', name: 'PetMatch', url: 'https://petmatch.fit' },
      publisher: { '@type': 'Organization', name: 'PetMatch', url: 'https://petmatch.fit' },
      mainEntity: {
        '@type': 'Thing',
        name: p.pet_name,
        description,
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'species', value: p.species },
          { '@type': 'PropertyValue', name: 'breed', value: p.breed },
          { '@type': 'PropertyValue', name: 'gender', value: p.gender },
          { '@type': 'PropertyValue', name: 'age', value: `${p.age} year${p.age == 1 ? '' : 's'}` },
          { '@type': 'PropertyValue', name: 'location', value: p.state },
          { '@type': 'PropertyValue', name: 'availableForMating', value: p.available_for_mating ? 'Yes' : 'No' }
        ]
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PetMatch', item: 'https://petmatch.fit/' },
        { '@type': 'ListItem', position: 2, name: p.pet_name, item: canonicalUrl }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `How do I contact ${p.pet_name}'s owner on PetMatch?`,
          acceptedAnswer: { '@type': 'Answer', text: `Use the contact buttons on this page to reach ${p.owner_name.split(' ')[0]} directly on WhatsApp, call, or text, whichever they've made available. PetMatch doesn't have its own messaging system, so you connect and arrange everything between yourselves.` }
        },
        {
          '@type': 'Question',
          name: 'Does PetMatch charge a fee to connect with a pet owner?',
          acceptedAnswer: { '@type': 'Answer', text: 'No. PetMatch is a free directory, not a marketplace. There are no listing fees, no referral fees, and no commissions on anything you arrange with another owner.' }
        },
        {
          '@type': 'Question',
          name: `Should I check ${p.pet_name}'s vaccination and health records before meeting?`,
          acceptedAnswer: { '@type': 'Answer', text: `Yes. Listings on PetMatch are self-reported, so PetMatch does not independently verify health or vaccination records. Ask to see proof of vaccination and general health before any pairing; the WSAVA vaccination guidelines are a useful reference for what's normal for a ${p.species.toLowerCase()}.` }
        }
      ]
    }
  ];

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
<script type="application/ld+json">${jsonLd(structuredData)}</script>
${fontLinks()}
<style>${sharedStyles()}</style>
</head>
<body>
<header class="top">
  <div class="eyebrow">Dogs &amp; Cats · Near You</div>
  <p class="brand-mark"><a href="/" title="Back to the PetMatch homepage">PetMatch</a></p>
  <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav">Menu &#9662;</button>
  <nav class="site-nav" id="siteNav" aria-label="Site navigation">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/updates">Updates</a>
    <a href="/partners">For Pet Businesses</a>
  </nav>
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
      <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`🐾 Check out ${p.pet_name} on PetMatch, a ${breed} ${p.species.toLowerCase()} in ${state}: ${canonicalUrl}`)}">Share ${name}'s profile</a>
    </div>
  </article>

  <article class="formcard" style="margin-top:20px; text-align:center">
    <h2 style="font-family:'Fraunces',serif; font-size:19px; margin:0 0 8px; color:var(--forest-dark)">Have a dog or cat of your own?</h2>
    <p style="font-size:14.5px; color:#3c3628; line-height:1.6; margin:0 0 16px">List them free and find matches like ${name} nearby. Takes under a minute, no fees ever.</p>
    <div class="cta-row"><a class="btn btn-clay" href="/">List Your Pet</a></div>
    <div class="cta-row" style="margin-top:10px"><a class="back-link" href="/">&larr; See more pets on PetMatch</a></div>
  </article>

  <article class="formcard" style="margin-top:20px">
    <h2 style="font-family:'Fraunces',serif; font-size:19px; margin:0 0 14px; color:var(--forest-dark)">Questions about ${name}'s listing</h2>
    <h3 style="font-family:'Work Sans',sans-serif; font-weight:600; font-size:14.5px; color:var(--forest-dark); margin:0 0 4px">How do I contact ${name}'s owner on PetMatch?</h3>
    <p style="font-size:14px; color:#3c3628; line-height:1.6; margin:0 0 14px">Use the buttons above to reach ${ownerFirstName} directly on WhatsApp, call, or text, whichever they've made available. PetMatch doesn't have its own messaging, so you connect and arrange everything between yourselves.</p>
    <h3 style="font-family:'Work Sans',sans-serif; font-weight:600; font-size:14.5px; color:var(--forest-dark); margin:0 0 4px">Does PetMatch charge a fee to connect with a pet owner?</h3>
    <p style="font-size:14px; color:#3c3628; line-height:1.6; margin:0 0 14px">No. PetMatch is a free directory, not a marketplace. No listing fees, no referral fees, no commissions on anything you arrange with another owner.</p>
    <h3 style="font-family:'Work Sans',sans-serif; font-weight:600; font-size:14.5px; color:var(--forest-dark); margin:0 0 4px">Should I check ${name}'s vaccination and health records before meeting?</h3>
    <p style="font-size:14px; color:#3c3628; line-height:1.6; margin:0 0 14px">Yes. Listings are self-reported, so PetMatch doesn't independently verify health or vaccination records. Ask to see proof before any pairing &mdash; <a href="https://www.wsava.org/" target="_blank" rel="noopener">WSAVA's vaccination guidelines</a> are a useful reference for what's normal.</p>
    <p style="font-size:13px; color:#7a7261; margin:0"><a href="/faq" style="color:var(--clay-dark); font-weight:600">Read the full FAQ</a> or <a href="/compare" style="color:var(--clay-dark); font-weight:600">see how PetMatch compares</a> to other ways to find a match.</p>
  </article>

  <div style="display:flex; justify-content:center; padding:12px 16px 0; text-align:center;">
  <p style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:#B9CBBD; max-width:640px; line-height:1.7; margin:0 auto;"><span style="color:var(--marigold)">🌐</span> Prefer another language? Your browser can translate this page: check the translate icon in your address bar. · Kana son wani harshe? Mai binciken ka zai iya fassara wannan shafin: duba alamar fassara a cikin akwatin adireshi. · You wan use another language? Your browser fit translate dis page: check di translate icon for your address bar. · Vous préférez une autre langue ? Votre navigateur peut traduire cette page : cherchez l'icône de traduction dans la barre d'adresse.</p>
  </div>
</main>
<footer style="text-align:center; color:#B9CBBD; font-size:12px; padding:24px 16px 40px; font-family:'IBM Plex Mono',monospace;">PETMATCH · A simple directory, not a broker. Meet safely, and check health and vaccination records before any pairing.<br>Contact: <a style="color:inherit" href="mailto:hello@petmatch.fit">hello@petmatch.fit</a> · <a style="color:inherit" href="/">Home</a> · <a style="color:inherit" href="/about">About</a> · <a style="color:inherit" href="/faq">FAQ</a> · <a style="color:inherit" href="/compare">Compare</a> · <a style="color:inherit" href="/safety">Trust &amp; Safety</a> · <a style="color:inherit" href="/updates">Updates</a> · <a style="color:inherit" href="/partners">For Pet Businesses</a></footer>
<script>
(function(){
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if(!toggle || !nav) return;
  toggle.addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.status(200).send(html);
};
