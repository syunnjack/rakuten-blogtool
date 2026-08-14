import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist");
const esc = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const money = (v) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
const config = JSON.parse(await fs.readFile(path.join(root, "config/site.json"), "utf8"));
config.name = process.env.BLOG_NAME || config.name; config.description = process.env.BLOG_DESCRIPTION || config.description; config.url = process.env.SITE_URL || config.url;
const files = (await fs.readdir(path.join(root, "content"))).filter((v) => v.endsWith(".json"));
const posts = (await Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(root, "content", file), "utf8"))))).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
await fs.rm(out, { recursive: true, force: true }); await fs.mkdir(path.join(out, "posts"), { recursive: true });
const css = `:root{font-family:system-ui,sans-serif;color:#202124;background:#f7f5f0}body{margin:0}header,main,footer{max-width:960px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;align-items:center}a{color:#8b2b16}.hero,.card,article{background:white;border-radius:16px;padding:clamp(20px,5vw,48px);margin:20px 0;box-shadow:0 8px 30px #0001}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}.product{border:1px solid #ddd;border-radius:12px;padding:16px}.product img{width:100%;aspect-ratio:4/3;object-fit:contain}.button{display:inline-block;background:#b33b20;color:white;padding:12px 18px;border-radius:8px;text-decoration:none}.notice{background:#fff7dc;padding:14px;border-radius:8px}h1{line-height:1.35}h2{margin-top:2em}small{color:#666}`;
const frame = (title, description, body, structured = "") => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(config.url)}"><link rel="stylesheet" href="/rakuten-blogtool/style.css">${structured}</head><body><header><a href="/rakuten-blogtool/"><strong>${esc(config.name)}</strong></a><span>商品選びをシンプルに</span></header><main>${body}</main><footer><p>${esc(config.description)}</p><p><a href="/rakuten-blogtool/about.html">運営方針・広告について</a></p></footer></body></html>`;
await fs.writeFile(path.join(out, "style.css"), css);
const cards = posts.map((p) => `<section class="card"><small>${esc(p.publishedAt.slice(0,10))} · ${esc(p.keyword)}</small><h2><a href="/rakuten-blogtool/posts/${esc(p.slug)}.html">${esc(p.title)}</a></h2><p>${esc(p.description)}</p></section>`).join("");
await fs.writeFile(path.join(out, "index.html"), frame(config.name, config.description, `<section class="hero"><h1>${esc(config.name)}</h1><p>${esc(config.description)}</p></section>${cards || "<p>最初の記事を準備中です。</p>"}`));
await fs.writeFile(path.join(out, "about.html"), frame(`運営方針 | ${config.name}`, "当ブログの記事作成方針と広告掲載について", `<article><h1>運営方針・広告について</h1><p>読者が商品を比較し、自分に合う選択肢を絞るための情報を提供します。楽天市場の商品データとAIを利用しますが、存在しない仕様や使用体験は掲載しません。</p><h2>広告</h2><p>当サイトは楽天アフィリエイトを利用し、リンク経由の購入により報酬を受け取る場合があります。</p><h2>更新方針</h2><p>価格・在庫は変動します。購入前にリンク先の最新情報をご確認ください。</p></article>`));
for (const p of posts) {
  const recs = p.recommendations.map((rec) => { const item = p.items.find((x) => x.id === rec.itemId); return `<section class="product"><img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy"><h3>${esc(item.name)}</h3><p><b>${money(item.price)}</b>（掲載時点）</p><p><b>向く人:</b> ${esc(rec.bestFor)}</p><p>${esc(rec.reason)}</p><p><b>注意:</b> ${esc(rec.caution)}</p><a class="button" href="${esc(item.url)}" rel="sponsored nofollow noopener">楽天市場で確認</a></section>`; }).join("");
  const faq = p.faq.map((x) => `<h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p>`).join("");
  const guide = p.selectionGuide.map((x) => `<h3>${esc(x.heading)}</h3><p>${esc(x.body)}</p>`).join("");
  const data = JSON.stringify({ "@context":"https://schema.org", "@type":"Article", headline:p.title, description:p.description, datePublished:p.publishedAt, dateModified:p.updatedAt, author:{"@type":"Organization",name:config.author}, mainEntityOfPage:`${config.url}/posts/${p.slug}.html` }).replaceAll("<", "\\u003c");
  const body = `<article><small>${esc(p.publishedAt.slice(0,10))}</small><h1>${esc(p.title)}</h1><p class="notice">${esc(p.disclosure)}</p><p>${esc(p.intro)}</p><h2>失敗しない選び方</h2>${guide}<h2>おすすめ商品</h2><div class="grid">${recs}</div><h2>よくある質問</h2>${faq}<h2>編集メモ</h2><p>${esc(p.editorNote)}</p><small>${esc(p.aiDisclosure)} 出典: ${esc(p.source)}</small></article>`;
  await fs.writeFile(path.join(out, "posts", `${p.slug}.html`), frame(`${p.title} | ${config.name}`, p.description, body, `<script type="application/ld+json">${data}</script>`));
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${config.url}/</loc></url>${posts.map((p)=>`<url><loc>${config.url}/posts/${p.slug}.html</loc><lastmod>${p.updatedAt.slice(0,10)}</lastmod></url>`).join("")}</urlset>`;
await fs.writeFile(path.join(out, "sitemap.xml"), sitemap); await fs.writeFile(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`); await fs.writeFile(path.join(out, ".nojekyll"), "");
console.log(`Built ${posts.length} posts`);
