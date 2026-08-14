import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const required = ["OPENAI_API_KEY", "RAKUTEN_APPLICATION_ID", "RAKUTEN_ACCESS_KEY", "RAKUTEN_AFFILIATE_ID"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);

const root = process.cwd();
const contentDir = path.join(root, "content");
const keywords = (process.env.ARTICLE_KEYWORDS || "防災グッズ").split(",").map((v) => v.trim()).filter(Boolean);
const existingFiles = (await fs.readdir(contentDir)).filter((name) => name.endsWith(".json"));
const existing = await Promise.all(existingFiles.map(async (name) => JSON.parse(await fs.readFile(path.join(contentDir, name), "utf8"))));
const counts = new Map(keywords.map((keyword) => [keyword, existing.filter((post) => post.keyword === keyword).length]));
const keyword = [...counts].sort((a, b) => a[1] - b[1])[0][0];

const params = new URLSearchParams({
  applicationId: process.env.RAKUTEN_APPLICATION_ID,
  affiliateId: process.env.RAKUTEN_AFFILIATE_ID,
  keyword,
  format: "json",
  formatVersion: "2",
  hits: String(Math.min(Number(process.env.MAX_ITEMS || 6), 10)),
  availability: "1",
  imageFlag: "1",
  hasReviewFlag: "1"
});
const rakutenUrl = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701?${params}`;
const rakutenResponse = await fetch(rakutenUrl, { headers: { accessKey: process.env.RAKUTEN_ACCESS_KEY } });
if (!rakutenResponse.ok) throw new Error(`Rakuten API ${rakutenResponse.status}: ${await rakutenResponse.text()}`);
const rakuten = await rakutenResponse.json();
const rawItems = rakuten.Items || rakuten.items || [];
if (rawItems.length < 3) throw new Error(`Not enough products for ${keyword}`);

const items = rawItems.map((entry) => entry.Item || entry).map((item, index) => ({
  id: index + 1,
  name: item.itemName,
  catchcopy: item.catchcopy || "",
  price: item.itemPrice,
  url: item.affiliateUrl || item.itemUrl,
  image: item.mediumImageUrls?.[0]?.imageUrl || item.imageUrl || "",
  shop: item.shopName || "",
  reviewAverage: item.reviewAverage || null,
  reviewCount: item.reviewCount || null,
  description: (item.itemCaption || "").slice(0, 700)
}));

const schema = {
  type: "object", additionalProperties: false,
  required: ["title", "description", "slug", "intro", "selectionGuide", "recommendations", "faq", "editorNote"],
  properties: {
    title: { type: "string" }, description: { type: "string" }, slug: { type: "string" }, intro: { type: "string" },
    selectionGuide: { type: "array", minItems: 3, items: { type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: { type: "string" }, body: { type: "string" } } } },
    recommendations: { type: "array", minItems: 3, items: { type: "object", additionalProperties: false, required: ["itemId", "bestFor", "reason", "caution"], properties: { itemId: { type: "integer" }, bestFor: { type: "string" }, reason: { type: "string" }, caution: { type: "string" } } } },
    faq: { type: "array", minItems: 3, items: { type: "object", additionalProperties: false, required: ["question", "answer"], properties: { question: { type: "string" }, answer: { type: "string" } } } },
    editorNote: { type: "string" }
  }
};
const prompt = `日本語の商品選び記事を作成してください。検索語: ${keyword}\n商品データ: ${JSON.stringify(items)}\n商品データにない性能・体験・ランキングを創作しない。価格は変動すると明記。比較軸と向く人を具体的にし、誇大表現を避ける。slugは英数字とハイフンのみ。SEO/AIO/LLMOを意識し、結論を先に、見出しだけでも要点が伝わる構成にする。`;
const aiResponse = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions: "あなたは読者本位の商品選び編集者です。提供データだけを根拠に、正確で有用な記事構造を返してください。",
    input: prompt,
    text: { format: { type: "json_schema", name: "article", strict: true, schema } }
  })
});
if (!aiResponse.ok) throw new Error(`OpenAI API ${aiResponse.status}: ${await aiResponse.text()}`);
const ai = await aiResponse.json();
const outputText = ai.output_text || ai.output?.flatMap((x) => x.content || []).find((x) => x.type === "output_text")?.text;
const article = JSON.parse(outputText);
const usedIds = new Set(article.recommendations.map((v) => v.itemId));
if (usedIds.size < 3 || [...usedIds].some((id) => !items.find((item) => item.id === id))) throw new Error("Quality gate failed: invalid product references");
if (article.description.length < 50 || article.description.length > 160) throw new Error("Quality gate failed: description length");
if (!/^[a-z0-9-]+$/.test(article.slug)) throw new Error("Quality gate failed: slug");

const publishedAt = new Date().toISOString();
const post = { ...article, keyword, publishedAt, updatedAt: publishedAt, disclosure: "本記事には楽天アフィリエイトのリンクが含まれます。価格・在庫・ポイントは掲載時点から変わる場合があります。", aiDisclosure: "商品データの整理と文章作成にAIを利用し、公開前に自動品質チェックを行っています。", items: items.filter((item) => usedIds.has(item.id)), source: "Rakuten Ichiba Item Search API" };
const filename = `${publishedAt.slice(0, 10)}-${article.slug}.json`;
if (existing.some((value) => value.slug === article.slug)) throw new Error(`Duplicate slug: ${article.slug}`);
if (process.env.DRY_RUN === "true") console.log(JSON.stringify(post, null, 2));
else await fs.writeFile(path.join(contentDir, filename), `${JSON.stringify(post, null, 2)}\n`);
console.log(`Generated ${filename} (${crypto.createHash("sha256").update(JSON.stringify(post)).digest("hex").slice(0, 12)})`);
