---
name: kanbn
description: >-
  Maintain a site's living SEO report and social post proposals as files in git
  (pipeline/reports/<page>.md and pipeline/social/*.md). A GitHub Action mirrors
  them onto the shared kan.bn board. Load this skill whenever you need to update
  the report after SEO research or after publishing an article, or to propose a
  LinkedIn/Reddit post. Site-agnostic: the page is selected by KAN_PAGE.
---

# kan.bn — rapport vivant + social posts (git-first)

Ce skill est **générique** : il sert à plusieurs sites. Le site courant est
identifié par la variable `KAN_PAGE` (définie dans le workflow du repo, ex.
`cassou.app`, `linventaire.app`…). Partout ci-dessous, `<page>` = la valeur de
`KAN_PAGE` de **ce** repo. Ne code jamais un nom de site en dur.

## Architecture (important — lis ça en premier)

Tu **ne parles jamais à l'API kan.bn directement**. L'environnement d'exécution
distant de Claude Code n'a pas `kan.bn` dans son allowlist réseau, donc tout
appel sortant échoue (`403 Host not in allowlist`).

À la place, **tout vit dans le git** :

| Source de vérité (git) | Carte kan.bn (miroir) |
|---|---|
| `pipeline/reports/<page>.md` | Board **Reports** → liste `<page>` → carte unique `Rapport SEO — <page>` |
| `pipeline/social/*.md` (1 fichier = 1 post) | Board **Social** → liste `<page>` → 1 carte par fichier |

Une seule workspace kan.bn héberge deux boards partagés (**Reports** et
**Social**), chacun avec **une liste par site**. `KAN_PAGE` sélectionne la liste
de ce repo dans les deux boards.

Le workflow GitHub **`.github/workflows/kanbn-sync.yml`** (script
`pipeline/kanbn-sync.ts`) copie ces fichiers sur le board à chaque push sur
`main` qui les modifie. Le runner CI a l'accès réseau ; toi non.

### Ton process

1. Édite le rapport `pipeline/reports/<page>.md` (en général un seul fichier
   dans `pipeline/reports/`) et/ou ajoute des fichiers dans `pipeline/social/`.
2. Commit + push sur `main` (ou ouvre une PR qui sera mergée).
3. L'action de sync s'occupe du board. Tu n'as rien d'autre à faire.

La sync est **idempotente** : le rapport est upserté, et une carte social
n'est créée que si aucune carte du même titre n'existe déjà. Donc **ne renomme
pas** le keyword/date d'un post déjà synchronisé (ça créerait un doublon).

---

## Le rapport vivant — `pipeline/reports/<page>.md`

C'est le **journal de bord SEO du site**. Tu le lis à chaque run pour comprendre
le contexte, puis tu le réécris en intégrant les nouvelles infos. Garde-le
**factuel et chiffré** — pas de remplissage : si une donnée n'existe pas (ex.
GSC pas encore connecté), dis-le explicitement plutôt que d'inventer.

### Schéma attendu (Markdown)

Le rapport suit **ces sections, dans cet ordre**. Une ligne d'en-tête optionnelle
(`_Dernière compilation : <date> · …_`) peut précéder la première section.

```markdown
## Résumé des chiffres et analyse

Chiffres clés du moment, puis analyse courte. À couvrir si dispo :
- Production : nb d'articles publiés, cadence, volume de recherche cumulé ciblé, plage de KD.
- Performance (GSC) : impressions, clics, positions — ou mention explicite si non connecté.
- Couverture par pillar/cluster : ce qui est couvert, ce qui manque.
- 2–4 puces d'analyse (patterns, gisements, risques).

| Date | Keyword | Vol/mo | KD | Score | Pillar | Article |
|---|---|---|---|---|---|---|
| <date> | <keyword> | <vol> | <kd> | <score> | <pillar> | [<slug>](/<locale>/blog/<slug>) |

## Dernières stratégies

Les approches effectivement appliquées sur les derniers runs (puces courtes).

## Stratégies prévues

Ce qui est planifié à court terme (clusters à approfondir, satellites, maillage…).

## Propositions pour la suite

Top candidats non encore publiés, par score (depuis `pipeline/out/morning-report.md`),
+ pistes complémentaires.

| Keyword | Vol/mo | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|
| <keyword> | <vol> | <kd> | <intent> | <pillar> | <score> |

## À faire par l'utilisateur

Cases à cocher actionnables que **toi (Claude) tu ne peux pas faire** : connecter
un service externe, vérifier une donnée manuelle, trancher une décision produit…
Garde-les ouvertes (`- [ ]`), ne les coche jamais à sa place.

- [ ] <tâche concrète>

## Historique des runs

Journal append-only (ne jamais retirer de lignes).

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| <date> | <keyword> | <score> | Oui/Non |
```

### Règles de mise à jour

1. **Lis le fichier actuel** avant d'écrire quoi que ce soit.
2. **Ne supprime jamais de données historiques** (table Publications, Historique
   des runs) — ajoute des lignes, ne retire pas.
3. **Résumé des chiffres** : recalcule à partir des articles publiés
   (`content/blog/*`), de `pipeline/data/candidates.json` et, si disponible, des
   données GSC du `morning-report.md`. Sois honnête sur ce qui manque.
4. **Stratégies (dernières / prévues)** : synthèse évolutive ; mets à jour au lieu
   d'empiler des redites.
5. **Propositions pour la suite** : recopie les top candidats depuis
   `pipeline/out/morning-report.md`, retire ceux déjà publiés.
6. **À faire par l'utilisateur** : uniquement des tâches hors de ta portée. Ne
   coche pas à sa place.

---

## Les posts social — `pipeline/social/*.md`

Un fichier Markdown par proposition, avec frontmatter + corps. Nom suggéré :
`<date>-<platform>-<keyword-slug>.md`.

```markdown
---
platform: linkedin        # linkedin | reddit
keyword: <keyword cible>
date: <YYYY-MM-DD>
# subreddit: <subreddit>   # reddit only
---
<corps du post / commentaire, prêt à copier-coller>
```

Le titre de la carte est dérivé du frontmatter :
- LinkedIn → `[LinkedIn] <keyword> — <date>`
- Reddit → `[Reddit/r/<subreddit>] <keyword> — <date>`

### Format du corps

Respecte la voix de marque du site (charge le skill `brand-voice` du repo s'il
existe). À défaut, reste utile et non publicitaire.

**LinkedIn**
```
**Accroche**

Phrase d'accroche forte, problème concret de l'audience cible.

**Texte**

• Point 1 (insight ou astuce de l'article)
• Point 2
• Point 3

Lire l'article complet : https://<site>/<locale>/blog/<slug>

#Hashtag1 #Hashtag2
```
Règles : max 1 200 caractères · locale de l'article · 0–2 hashtags pertinents · pas de ton publicitaire.

**Reddit** — le corps est le commentaire/post tel quel.
Règles : 2–4 paragraphes courts, pas de headers · répondre complètement à la
question · mentionner le produit uniquement si c'est la réponse directe au
besoin · choisir un subreddit pertinent pour la thématique et écrire dans sa
langue.

---

## Sync manuelle / debug (optionnel)

La sync tourne en CI. Pour la lancer à la main depuis une machine avec accès
réseau à kan.bn :

```bash
cd pipeline
KAN_API_TOKEN=kan_... KAN_PAGE=<page> npm run kanbn:sync
```

`KAN_API_TOKEN` est configuré dans les secrets GitHub du repo et `KAN_PAGE` dans
le workflow. La workspace/les boards/les listes sont auto-découverts par nom —
pas de fichier de config à maintenir. Les boards **Reports** et **Social**
doivent exister sur kan.bn, chacun avec une liste nommée `<page>`.

Pour répliquer ce système sur un nouveau site : voir `pipeline/KANBN-REPLICATION.md`.
