# rakuten-blogtool

楽天市場の商品データを取得し、AIで読者本位の記事を1本ずつ生成してGitHub Pagesへ自動公開する静的ブログです。GitHub Actionsのcronは毎週火・金曜日の日本時間8:17に動きます。

## セットアップ

1. 楽天Web ServiceでアプリID・アクセスキーを、楽天アフィリエイトでアフィリエイトIDを取得します。
2. GitHubリポジトリの `Settings > Secrets and variables > Actions` に次を登録します。
   - Secrets: `OPENAI_API_KEY`, `RAKUTEN_APPLICATION_ID`, `RAKUTEN_ACCESS_KEY`, `RAKUTEN_AFFILIATE_ID`
   - Variables: `SITE_URL`, `ARTICLE_KEYWORDS`, `BLOG_NAME`, `BLOG_DESCRIPTION`, `OPENAI_MODEL`（任意）
3. `Settings > Pages > Source` を `GitHub Actions` にします。
4. Actionsの `Generate and publish article` を手動実行し、初回記事を確認します。

`ARTICLE_KEYWORDS` はカンマ区切りです。最も記事数が少ないテーマが選ばれ、同じテーマへの偏りを抑えます。

## ローカル確認

`.env.example` を参考に環境変数を設定してから実行します。

```bash
npm run generate
npm run build
npx serve dist
```

## 品質・コンプライアンス

- 楽天APIの商品データ以外の性能や使用体験を創作しないプロンプト
- JSON Schema、参照商品ID、slug、meta descriptionの自動検証
- 1回1記事・週2回の公開制限、重複slug防止
- `rel="sponsored nofollow"`、広告表示、価格変動表示、AI利用開示
- Article構造化データ、canonical、sitemap、robots、意味的HTML

自動生成は最終的な正確性を保証しません。公開後の記事とリンク先情報を定期的に人が監査してください。
