_Dernière compilation : 2026-06-17 · 7 articles publiés · DataForSEO **non configuré** et GSC **non connecté** → données keywords (volume/KD/score) et performance indisponibles, à brancher (voir « À faire par Romaric »)._

## Résumé des chiffres et analyse

**Production de contenu**
- **7 articles publiés** entre le 2026-05-20 et le 2026-06-17 (4 en FR, 3 en EN).
- Cadence forte sur les 7 derniers jours : **6 articles entre le 10 et le 17 juin** (~1 article/jour).
- **Pas de données de volume/difficulté (KD)/score** : la recherche DataForSEO est désactivée (aucun identifiant), le pipeline retombe donc sur les seeds (`pipeline/seeds/fr.json`) et tous les `searchVolume`/`difficulty`/`score` ressortent à 0. Les colonnes Vol/KD/Score ci-dessous sont donc à `—` tant que DataForSEO n'est pas branché.

| Date | Keyword | Vol/mo | KD | Score | Pillar | Article |
|---|---|---|---|---|---|---|
| 2026-05-20 | transcrire des entretiens plus vite | — | — | — | productivite-recherche | [how-to-transcribe-research-interviews-faster](/en/blog/how-to-transcribe-research-interviews-faster) |
| 2026-06-10 | conformité IRB / RGPD transcription | — | — | — | confidentialite-recherche | [irb-compliant-transcription-checklist-qualitative-research](/en/blog/irb-compliant-transcription-checklist-qualitative-research) |
| 2026-06-10 | retranscrire entretien semi-directif | — | — | — | these-master | [retranscrire-entretien-semi-directif-guide-doctorants](/fr/blog/retranscrire-entretien-semi-directif-guide-doctorants) |
| 2026-06-11 | ai transcription tools (comparatif) | — | — | — | transcription | [ai-transcription-tools-research-compared](/en/blog/ai-transcription-tools-research-compared) |
| 2026-06-13 | transcription entretien | — | — | — | transcription | [transcription-entretien](/fr/blog/transcription-entretien) |
| 2026-06-15 | retranscrire audio | — | — | — | transcription | [retranscrire-audio](/fr/blog/retranscrire-audio) |
| 2026-06-17 | logiciel de transcription | — | — | — | transcription | [logiciel-de-transcription](/fr/blog/logiciel-de-transcription) |

**Couverture par pillar** (6 pillars définis dans `pipeline/seeds/fr.json`)
- `transcription` (productFit 1.0) : **4 articles** — pillar le plus couvert (tête de cluster `logiciel de transcription`, `transcription entretien`, `retranscrire audio`, comparatif outils IA).
- `confidentialite-recherche` (0.95) : **1 article** (checklist IRB/RGPD).
- `these-master` (0.85) : **1 article** (entretien semi-directif doctorants).
- `productivite-recherche` (0.8) : **1 article** (transcrire plus vite).
- `recherche-qualitative` (0.9) : **0 article dédié** (seulement effleuré) — **gisement sous-exploité à fort productFit.**
- `entretien-terrain` (0.75) : **0 article.**

**Analyse**
- Le contenu est aujourd'hui **concentré sur le pillar `transcription`** (4/7). C'est cohérent (productFit 1.0) mais les pillars voisins à fort productFit — `recherche-qualitative` (0.9) et `confidentialite-recherche` (0.95) — sont très peu couverts : ce sont les prochains gisements évidents.
- **Bilingue FR/EN** : 4 FR / 3 EN. Bonne couverture des deux marchés, mais pas encore de symétrie de clusters entre les deux langues.
- ⚠️ **Aucune mesure d'opportunité ni de performance pour l'instant.** Deux causes, toutes deux côté configuration (pas un blocage technique du pipeline) :
  1. **DataForSEO non configuré** — le secret `DATAFORSEO_BASE64` est absent, donc l'expansion de keywords est sautée (`Skipping keyword expansion — no DataForSEO credentials`) et on travaille à l'aveugle sur volume/KD/intent.
  2. **GSC non connecté** — `GSC_SITE_URL` vide et erreur d'authentification (`GSC token error 400`), donc aucune impression/clic/position. Les données ne seraient de toute façon significatives que vers J+15–J+30 après publication.

## Dernières stratégies

- **Approche par pillars/clusters** plutôt que keywords isolés, pilotée par `pipeline/seeds/fr.json` (6 pillars pondérés par `productFit`).
- **Tête de cluster `transcription` d'abord** : couverture des requêtes génériques à forte intention produit (`logiciel de transcription`, `transcription entretien`, `retranscrire audio`).
- **Contenu bilingue FR/EN** pour adresser les deux audiences (doctorants/chercheurs francophones + marché anglophone).
- **Angle confiance/conformité** comme différenciateur produit (article IRB/RGPD) — aligné sur le positionnement « transcription privée/chiffrée » de HumanLogs.

## Stratégies prévues

- **Ouvrir le pillar `recherche-qualitative`** (productFit 0.9, 0 article dédié) : `analyse qualitative`, `codification entretien`, `analyse verbatim`, `logiciel analyse qualitative`.
- **Renforcer `confidentialite-recherche`** (productFit 0.95) au-delà de l'article IRB : `RGPD transcription`, `transcription confidentielle`, `hébergement données France recherche` — différenciateur produit fort.
- **Approfondir `transcription`** avec les seeds non encore ciblés : `transcription automatique`, `transcription audio en texte`, `outil transcription`.
- **Maillage interne** entre articles d'un même pillar et symétrie FR↔EN des clusters.

## Propositions pour la suite

Top candidats par pillar à fort `productFit`, **non encore publiés** (issus des seeds — les colonnes Vol/KD/Score seront renseignées dès que DataForSEO sera branché) :

| Keyword | Vol/mo | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|
| transcription automatique | — | — | — | transcription (1.0) | — |
| transcription confidentielle | — | — | — | confidentialite-recherche (0.95) | — |
| RGPD transcription | — | — | — | confidentialite-recherche (0.95) | — |
| analyse qualitative | — | — | — | recherche-qualitative (0.9) | — |
| codification entretien | — | — | — | recherche-qualitative (0.9) | — |
| transcription these | — | — | — | these-master (0.85) | — |

Pistes complémentaires :
- Prioriser à `productFit` égal les keywords à **intention produit directe** (`logiciel…`, `outil…`, `automatique`, `confidentielle`).
- Construire un **cluster `recherche-qualitative`** complet (tête + satellites) : c'est le plus gros pillar non couvert à fort productFit.
- Relancer une **recherche DataForSEO fraîche dès la config faite** pour départager ces candidats par volume/KD réels avant la prochaine vague.

## À faire par Romaric

- [ ] **Configurer DataForSEO** (débloque tout le scoring volume/KD/intent) — sans ça, on choisit les sujets à l'aveugle :
  1. Récupérer les identifiants DataForSEO (login/password).
  2. Ajouter le secret GitHub `DATAFORSEO_BASE64` (base64 de `login:password`) au repo.
  3. Relancer le workflow **SEO research** : l'étape d'expansion de keywords ne sera plus sautée et le `morning-report.md` listera des candidats scorés. Je les intégrerai au rapport au run suivant.
- [ ] **Connecter Google Search Console** (débloque impressions/clics/positions) :
  1. Créer/récupérer un **service account Google** (scope `webmasters.readonly`) et l'ajouter comme utilisateur en lecture sur la propriété GSC du domaine.
  2. Ajouter les secrets GitHub `GOOGLE_JSON` (clé JSON du service account) et `GSC_SITE_URL` (URL exacte de la propriété, ex. `https://humanlogs.app/` ou `sc-domain:humanlogs.app`).
  3. Relancer **SEO research** : l'étape GSC ne renverra plus `400` et les données de perf remonteront.
- [ ] _(Indicatif)_ Les positions GSC des 7 articles publiés ne seront significatives que vers **J+15–J+30** ; à revérifier mi-juillet.
- [ ] Valider l'**ordre de priorité** des prochains pillars (proposé : `recherche-qualitative` puis `confidentialite-recherche`).

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| 2026-06-17 | logiciel de transcription | — | Oui |
| 2026-06-15 | retranscrire audio | — | Oui |
| 2026-06-13 | transcription entretien | — | Oui |
| 2026-06-11 | ai transcription tools (comparatif) | — | Oui |
| 2026-06-10 | retranscrire entretien semi-directif | — | Oui |
| 2026-06-10 | conformité IRB / RGPD transcription | — | Oui |
| 2026-05-20 | transcrire des entretiens plus vite | — | Oui |
