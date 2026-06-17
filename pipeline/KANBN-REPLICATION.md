# Répliquer la couche kan.bn sur une autre landing page

Ce guide explique comment rebrancher le système **rapport SEO + social posts → kan.bn**
(celui de `cassou.app`) sur une autre landing page, dans son propre repo.

## Le modèle

Une seule **workspace kan.bn** (`Claude`) contient **deux boards partagés** :

| Board | Rôle | Une liste par page |
|---|---|---|
| **Reports** | Le rapport SEO vivant (1 carte / page) | `cassou.app`, `linventaire.app`, `photographe.ai`, `humanlogs.app` |
| **Social** | Les propositions de posts (1 carte / post) | `cassou.app`, `linventaire.app`, `photographe.ai`, `humanlogs.app` |

Chaque repo de landing page sync **uniquement sa propre liste** dans chaque board.
Le repo ne parle jamais à kan.bn directement : il écrit dans le git, et une GitHub
Action (`kanbn-sync`) copie le git → kan.bn. C'est la variable d'env **`KAN_PAGE`**
qui sélectionne la liste (et le fichier de rapport) — c'est la *seule* chose qui
change d'un repo à l'autre. Le code est identique partout.

> Les listes des 3 autres pages (`linventaire.app`, `photographe.ai`, `humanlogs.app`)
> existent déjà dans les deux boards. Pour une page nouvelle, crée d'abord une liste
> du même nom (le slug du domaine) dans **Reports** ET dans **Social**.

## Pré-requis (une fois)

1. Le board **Reports** et le board **Social** existent dans la workspace kan.bn,
   chacun avec une liste nommée comme la page (ex. `linventaire.app`).
2. Le token kan.bn (le même que pour cassou) est ajouté en **secret GitHub** du
   repo cible : *Settings → Secrets and variables → Actions → New repository secret*
   - Nom : `KAN_API_TOKEN`
   - Valeur : le token `kan_…`
3. La machine qui exécute Claude Code n'a **pas** d'accès réseau à `kan.bn`
   (allowlist d'egress) — c'est voulu : c'est l'Action GitHub qui a l'accès, pas
   le process. Rien à configurer côté egress pour le repo cible.

## Fichiers à copier dans le repo cible

Depuis ce repo (`cassou.app`), copie tels quels :

```
pipeline/kanbn.ts                     # client API (aucune modif)
pipeline/kanbn-sync.ts                # script de sync (aucune modif)
.claude/skills/kanbn/SKILL.md         # le skill (adapter le nom de page dedans)
.github/workflows/kanbn-sync.yml      # le workflow (changer KAN_PAGE)
```

Crée les dossiers de contenu :

```
pipeline/reports/<page>.md            # le rapport vivant (seed vide, voir ci-dessous)
pipeline/social/README.md             # doc du format des posts
```

`pipeline/package.json` doit contenir le script (copie la ligne si absente) :

```json
"scripts": {
  "kanbn:sync": "tsx kanbn-sync.ts"
}
```

et les devDeps `tsx` + `typescript` + `@types/node` (déjà présents si tu copies
le `package.json` du pipeline).

## Les 2 choses à personnaliser

### 1. `KAN_PAGE` dans le workflow

Dans `.github/workflows/kanbn-sync.yml`, mets le slug de la page :

```yaml
      - name: Sync report + social posts to kan.bn
        env:
          KAN_API_TOKEN: ${{ secrets.KAN_API_TOKEN }}
          KAN_PAGE: linventaire.app        # <-- le nom EXACT de la liste kan.bn
        run: cd pipeline && npm run kanbn:sync
```

`KAN_PAGE` doit correspondre (en minuscules, sous-chaîne suffit) au nom de la
liste dans les boards Reports et Social. C'est aussi le nom du fichier rapport :
`KAN_PAGE=linventaire.app` → `pipeline/reports/linventaire.app.md`.

> Optionnel : `KAN_REPORT_CARD_TITLE` pour forcer le titre de la carte rapport.
> Par défaut c'est `Rapport SEO — <KAN_PAGE>`.

### 2. Le fichier rapport seed

Crée `pipeline/reports/<page>.md` avec ce squelette :

```markdown
## Publications

| Date | Keyword | Vol | KD | Score | Article |
|---|---|---|---|---|---|

## Run en cours

_(Aucun run en cours.)_

## Observations

- _(Le premier run SEO remplira cette section.)_

## Prochains keywords recommandés

| Keyword | Vol | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|

## Tâches pour Romaric

_(Aucune tâche en attente.)_

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
```

Pense aussi à mettre à jour le nom de page mentionné dans
`.claude/skills/kanbn/SKILL.md` (chemins `pipeline/reports/<page>.md`).

## Vérifier

1. Commit + push des fichiers sur `main` du repo cible (le workflow se déclenche
   sur push touchant `pipeline/reports/**`, `pipeline/social/**`, `pipeline/kanbn*.ts`).
2. Ou lance-le à la main : *Actions → kan.bn sync → Run workflow*.
3. Le log doit afficher :

   ```
   Page: linventaire.app
   Reports list: "linventaire.app" (…)
   Social list:  "linventaire.app" (…)
   • Report: created card …    (puis "updated"/"already up to date" aux runs suivants)
   Sync done.
   ```

4. La carte `Rapport SEO — linventaire.app` apparaît dans la liste de la page sur
   le board Reports.

## Notes

- **Idempotent** : le rapport est upserté (PUT seulement si le contenu change) ;
  une carte social n'est créée que si aucune carte du même titre n'existe déjà.
- **Pas de `kanbn-config.json`** : la workspace/les boards/les listes sont
  auto-découverts par nom. Rien à committer en plus.
- **Multi-pages, mêmes boards** : comme tous les repos pointent vers les deux
  mêmes boards, chaque page reste isolée dans sa propre liste via `KAN_PAGE`.
```
