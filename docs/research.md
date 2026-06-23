# 既存サイト調査メモ

調査日: 2026-06-24

## 結論

Exponential Idle 全体の攻略サイトは存在しますが、ミニゲームを全難易度まとめて扱う完成済みサイトは見つかりませんでした。

既存公開物は、Arrow / Torus / 15-Puzzle などの単体ソルバーが中心です。したがって、このリポジトリではミニゲーム特化の攻略サイトとして、各難易度のページひな形と矢印パズルソルバーから作り始めます。

## 確認した主な候補

| 候補 | 種別 | メモ |
| --- | --- | --- |
| [Exponential Idle Guides](https://exponential-idle-guides.netlify.app/) | 総合攻略サイト | ガイド本体は充実。サイトマップとGitHubツリー上ではミニゲーム専用ページは確認できませんでした。 |
| [exponential-idle-guides/exponential-idle-guides](https://github.com/exponential-idle-guides/exponential-idle-guides) | 総合攻略サイトのリポジトリ | `hard-arrow-lookup.png` はありますが、Arrow / Torus / 15-Puzzle の全難易度ページは見当たりませんでした。 |
| [samjones246/exp-torus](https://github.com/samjones246/exp-torus) | Torus単体ソルバー | Torus puzzle minigame 用。 |
| [facu-et/exponential-idle-puzzle-solver](https://github.com/facu-et/exponential-idle-puzzle-solver) | 15-Puzzle単体ソルバー | Easy / Medium / Hard に対応と説明されています。 |
| [Blue-Beaker/arrow-puzzle-solver](https://github.com/Blue-Beaker/arrow-puzzle-solver) | Arrow単体ソルバー | Hard / Expert に対応と説明されています。 |
| [OmarBuso/ex-arrow-puzzle](https://github.com/OmarBuso/ex-arrow-puzzle) | Arrow再現・ソルバー | Arrow Puzzle の再現とソルバー。 |

## サイト方針

- ミニゲームごとに「Easy / Medium / Hard / Expert」を並べられる構成にする。
- まずはユーザー提供の `main.cpp` をもとに Arrow Puzzle を動くツール化する。
- Arrow Puzzle はゲーム上の制約として、正方形グリッドは最大16マス、六角グリッドは side 4 まで、方向数は2から6に制限する。
