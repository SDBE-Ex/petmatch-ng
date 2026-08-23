const SUPABASE_URL = 'https://pnawdtpavemfjzdsevey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l';
const DEFAULT_IMAGE = 'https://petmatch.fit/petmatch-og.jpg';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;
function renderBody(body) {
  return String(body ?? '')
    .split(/\n\s*\n/)
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => {
      const escaped = escapeHtml(para).replace(/\n/g, '<br>');
      const linked = escaped.replace(URL_RE, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
      return `<p>${linked}</p>`;
    })
    .join('');
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function notFoundPage(res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Post not found | PetMatch</title>
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
    <h1 style="margin-top:0">This post is no longer available</h1>
    <p>It may have been unpublished, or the link is out of date.</p>
    <div class="cta-row"><a class="btn btn-clay" href="/updates">See all updates</a></div>
  </article>
  <div style="display:flex; justify-content:center; padding:12px 16px 0; text-align:center;">
  <p style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:#B9CBBD; max-width:640px; line-height:1.7; margin:0 auto;"><span style="color:var(--marigold)">🌐</span> Prefer another language? Your browser can translate this page: check the translate icon in your address bar. · Kana son wani harshe? Mai binciken ka zai iya fassara wannan shafin: duba alamar fassara a cikin akwatin adireshi. · You wan use another language? Your browser fit translate dis page: check di translate icon for your address bar. · Vous préférez une autre langue ? Votre navigateur peut traduire cette page : cherchez l'icône de traduction dans la barre d'adresse.</p>
  </div>
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
  :root{ --ink:#14241C; --paper:#FBF6EA; --forest:#1F4732; --forest-dark:#132E20; --marigold:#E8A33D; --clay:#A64B2A; --clay-dark:#8A3D22; --line:#D8CBA8; --radius:14px; }
  *{box-sizing:border-box;}
  body{margin:0; background:var(--forest); color:var(--ink); font-family:'Work Sans', sans-serif; -webkit-font-smoothing:antialiased;}
  header.top{ background:var(--forest); color:var(--paper); padding:30px 20px 22px; text-align:center; }
  header.top .eyebrow{font-family:'IBM Plex Mono',monospace; letter-spacing:.14em; text-transform:uppercase; font-size:11.5px; color:var(--marigold); margin-bottom:10px;}
  header.top .brand-mark{font-family:'Fraunces',serif; font-weight:600; font-size:clamp(26px,5vw,40px); margin:0; letter-spacing:-0.01em;}
  header.top .brand-mark a{color:inherit; text-decoration:none;}
  main{max-width:700px; margin:0 auto; padding:28px 16px 80px;}
  .formcard{background:var(--paper); border-radius:var(--radius); padding:30px 28px; box-shadow:0 10px 30px rgba(0,0,0,0.18);}
  .formcard h1{font-family:'Fraunces',serif; font-size:26px; margin:0 0 6px; color:var(--forest-dark); line-height:1.25;}
  .formcard h2{font-family:'Fraunces',serif; font-size:19px; margin:26px 0 10px; color:var(--forest-dark);}
  .post-date{font-family:'IBM Plex Mono',monospace; font-size:11.5px; letter-spacing:.03em; text-transform:uppercase; color:#8a7f65; margin:0 0 16px;}
  .photo{width:calc(100% + 56px); margin:-30px -28px 20px; display:block; max-width:none; height:260px; object-fit:cover; border-radius:var(--radius) var(--radius) 0 0;}
  .formcard p{font-size:15px; line-height:1.65; color:#3c3628; margin:0 0 14px;}
  .formcard p:last-of-type{margin-bottom:0;}
  .formcard a:not(.btn){color:var(--clay-dark); font-weight:600; text-decoration:underline; text-decoration-color:rgba(138,61,34,0.4); text-underline-offset:2px;}
  .formcard a:not(.btn):hover{color:var(--clay); text-decoration-color:currentColor;}
  .btn{font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; border:none; border-radius:9px; padding:11px 20px; cursor:pointer; transition:.15s ease; display:inline-flex; align-items:center; justify-content:center; gap:6px; text-decoration:none;}
  .btn-clay{background:var(--clay); color:#fff;} .btn-clay:hover{background:var(--clay-dark);}
  .btn-ghost{background:transparent; border:1.5px solid var(--forest); color:var(--forest);}
  .btn-ghost:hover{background:var(--forest); color:#fff;}
  .btn:disabled{opacity:.55; cursor:not-allowed; transform:none;}
  .btn:hover{transform:translateY(-1px);}
  .btn:focus-visible{outline:3px solid var(--marigold); outline-offset:2px;}
  .cta-row{margin-top:20px;}
  .engage-row{display:flex; gap:8px; flex-wrap:wrap; margin:18px 0;}
  .back-link{display:inline-block; margin-top:18px; font-size:13px; color:var(--forest-dark); font-weight:600;}
  .comment-card{background:#fff; border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:10px;}
  .comment-card .who{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.03em; text-transform:uppercase; color:#8a7f65; display:flex; justify-content:space-between; gap:10px; margin-bottom:4px;}
  .comment-card p{font-size:14px; margin:0;}
  .comment-report{background:none; border:none; padding:0; font-size:11px; color:#a89f8a; cursor:pointer; text-decoration:underline;}
  .comment-report:hover{color:var(--clay-dark);}
  .comment-empty{color:#8a7f65; font-size:14px; margin:0 0 14px;}
  .comment-form{margin-top:14px;}
  .comment-form input, .comment-form textarea{width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:9px; font-size:14px; font-family:inherit; background:#fff; color:var(--ink); margin-bottom:10px;}
  .comment-form textarea{resize:vertical;}
  .comment-form .hp{position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden;}
  .comment-msg{font-size:13px; color:#5b5142; margin:8px 0 0;}
  footer{text-align:center; color:#B9CBBD; font-size:12px; padding:24px 16px 40px; font-family:'IBM Plex Mono',monospace;}
  footer a{color:inherit;}
  `;
}

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id || !/^[0-9a-fA-F-]{8,36}$/.test(id)) {
    return notFoundPage(res);
  }

  let post;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&published=eq.true&select=*`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await resp.json();
    post = Array.isArray(rows) ? rows[0] : null;
  } catch (e) {
    return notFoundPage(res);
  }

  if (!post) {
    return notFoundPage(res);
  }

  const p = post;
  const title = escapeHtml(p.title);
  const canonicalUrl = `https://petmatch.fit/updates/${p.id}`;
  const image = p.image_url || DEFAULT_IMAGE;
  const plainBody = String(p.body ?? '').replace(/\s+/g, ' ').trim();
  const description = plainBody.slice(0, 300);
  const shareText = encodeURIComponent(`🐾 ${p.title} on PetMatch: ${canonicalUrl}`);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description,
    image,
    datePublished: p.created_at,
    dateModified: p.updated_at || p.created_at,
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    isPartOf: { '@type': 'WebSite', name: 'PetMatch', url: 'https://petmatch.fit' },
    author: { '@type': 'Organization', name: 'PetMatch', url: 'https://petmatch.fit' },
    publisher: {
      '@type': 'Organization',
      name: 'PetMatch',
      url: 'https://petmatch.fit',
      logo: { '@type': 'ImageObject', url: 'https://petmatch.fit/petmatch-mark-512.png' }
    }
  };

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
<title>${title} | PetMatch Updates</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="PetMatch">
<meta property="og:title" content="${title} | PetMatch Updates">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} | PetMatch Updates">
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
</header>
<main>
  <article class="formcard">
    ${p.image_url ? `<img class="photo" src="${escapeHtml(p.image_url)}" alt="${title}">` : ''}
    <h1>${title}</h1>
    <p class="post-date">${fmtDate(p.created_at)}</p>
    ${renderBody(p.body)}
    ${p.link_url ? `<div class="cta-row" style="margin-bottom:0"><a class="btn btn-clay" href="${escapeHtml(p.link_url)}" target="_blank" rel="noopener">${escapeHtml(p.link_label || 'Read more')}</a></div>` : ''}

    <div class="engage-row">
      <button class="btn btn-ghost" type="button" id="likeBtn">🤍 Like<span id="likeCount">${p.like_count || 0}</span></button>
      <a class="btn btn-clay" target="_blank" rel="noopener" href="https://wa.me/?text=${shareText}">Share</a>
    </div>

    <h2 id="comments">Comments</h2>
    <div id="commentsList"><p class="comment-empty">Loading comments…</p></div>

    <form class="comment-form" id="commentForm">
      <input type="text" id="commentWebsite" name="website" class="hp" tabindex="-1" autocomplete="off">
      <input type="text" id="commentName" required maxlength="60" placeholder="Your name">
      <textarea id="commentBody" required maxlength="1000" rows="3" placeholder="Say something…"></textarea>
      <button class="btn btn-clay" type="submit" id="commentSubmitBtn">Post comment</button>
      <p class="comment-msg" id="commentMsg"></p>
    </form>

    <div class="cta-row"><a class="back-link" href="/updates">&larr; See all updates</a></div>
  </article>
</main>

<div style="display:flex; justify-content:center; padding:12px 16px 0; text-align:center;">
<p style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:#B9CBBD; max-width:640px; line-height:1.7; margin:0 auto;"><span style="color:var(--marigold)">🌐</span> Prefer another language? Your browser can translate this page: check the translate icon in your address bar. · Kana son wani harshe? Mai binciken ka zai iya fassara wannan shafin: duba alamar fassara a cikin akwatin adireshi. · You wan use another language? Your browser fit translate dis page: check di translate icon for your address bar. · Vous préférez une autre langue ? Votre navigateur peut traduire cette page : cherchez l'icône de traduction dans la barre d'adresse.</p>
</div>

<footer>PETMATCH · A simple directory, not a broker. Meet safely, and check health and vaccination records before any pairing.<br>Contact: <a href="mailto:hello@petmatch.fit">hello@petmatch.fit</a> · <a href="/">Home</a> · <a href="/about">About</a> · <a href="/faq">FAQ</a> · <a href="/safety">Trust &amp; Safety</a></footer>

<script type="module">
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('${SUPABASE_URL}', '${SUPABASE_ANON_KEY}');
const POST_ID = ${JSON.stringify(p.id)};

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmtDate(iso){
  if(!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}

async function loadComments(){
  const wrap = document.getElementById('commentsList');
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', POST_ID)
    .order('created_at', { ascending: true });
  if(error){
    wrap.innerHTML = '<p class="comment-empty">Comments aren\\'t available right now.</p>';
    return;
  }
  if(!data || data.length === 0){
    wrap.innerHTML = '<p class="comment-empty">No comments yet. Be the first to say something.</p>';
    return;
  }
  wrap.innerHTML = data.map(c => \`
    <div class="comment-card">
      <div class="who"><span>\${escapeHtml(c.author_name)} · \${fmtDate(c.created_at)}</span><button type="button" class="comment-report" data-report="\${c.id}">Report</button></div>
      <p>\${escapeHtml(c.body)}</p>
    </div>\`).join('');
  wrap.querySelectorAll('[data-report]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Report this comment to the PetMatch team?')) return;
      btn.disabled = true;
      btn.textContent = 'Reported';
      await supabase.rpc('report_comment', { comment_id: btn.dataset.report });
    });
  });
}
loadComments();

document.getElementById('commentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(document.getElementById('commentWebsite').value){ return; }
  const btn = document.getElementById('commentSubmitBtn');
  const msg = document.getElementById('commentMsg');
  const author_name = document.getElementById('commentName').value.trim();
  const body = document.getElementById('commentBody').value.trim();
  if(!author_name || !body) return;
  btn.disabled = true;
  msg.textContent = 'Posting…';
  const { error } = await supabase.from('comments').insert({ post_id: POST_ID, author_name, body });
  btn.disabled = false;
  if(error){
    msg.textContent = "That didn't go through: " + error.message;
    return;
  }
  msg.textContent = '';
  document.getElementById('commentBody').value = '';
  await loadComments();
});

const likedKey = 'petmatch_liked_' + POST_ID;
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
if(localStorage.getItem(likedKey)){
  likeBtn.disabled = true;
  likeBtn.firstChild.textContent = '💛 Liked ';
}
likeBtn.addEventListener('click', async ()=>{
  if(localStorage.getItem(likedKey)) return;
  likeBtn.disabled = true;
  const { data, error } = await supabase.rpc('like_post', { post_id: POST_ID });
  if(!error){
    localStorage.setItem(likedKey, '1');
    likeBtn.firstChild.textContent = '💛 Liked ';
    if(typeof data === 'number') likeCount.textContent = data;
    else likeCount.textContent = String(Number(likeCount.textContent) + 1);
  } else {
    likeBtn.disabled = false;
  }
});
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.status(200).send(html);
};
