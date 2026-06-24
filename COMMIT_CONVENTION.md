# Commit Message Convention

手動で作成するコミットメッセージは、次の形式に統一します。

```text
type: short imperative summary
```

例:

```text
site: serve guide from public path
redirect: add root redirect page
cloudflare: point Workers assets at public
docs: document commit message convention
chore: clean obsolete files
```

ルール:

- `type` は小文字にします。
- summary は英語の命令形で短く書きます。
- 末尾に句点は付けません。
- 手動コミットでは `[add]` や `[delete]` のような独自プレフィックスは使いません。
- Merge commit、revert commit、bot やサービスが自動生成したコミットは、生成元の形式をそのまま使って構いません。

よく使う `type`:

- `site`: 公開ページや静的サイトの変更
- `redirect`: 転送ページやURL移行の変更
- `cloudflare`: Cloudflare Pages、Workers、Wrangler の設定変更
- `docs`: ドキュメント変更
- `chore`: 仕様に直接影響しない整理
