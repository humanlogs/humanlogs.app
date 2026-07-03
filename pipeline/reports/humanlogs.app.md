_Dernière compilation : 2026-07-03 · 15 articles publiés · DataForSEO **configuré et actif** (candidats scorés dans `pipeline/data/candidates.json`) · GSC **toujours non connecté** → pas de données de performance (impressions/clics/positions)._

## Résumé des chiffres et analyse

**Production de contenu**
- **15 articles publiés** entre le 2026-05-20 et le 2026-07-03 (6 en FR, 7 en EN, 1 en ES, 1 en DE).
- Cadence stable depuis la dernière compilation : **8 nouveaux articles entre le 17 juin et le 3 juillet** (~1 tous les 2 jours).
- **DataForSEO est maintenant actif** (`DATAFORSEO_BASE64` configuré) : les runs récents renvoient des volumes/KD/scores réels, l'expansion de keywords tourne (`pipeline/data/candidates.json`, 140 candidats en cache) et n'est plus à l'aveugle. Les articles publiés **avant** cette bascule (7 premiers, jusqu'au 17 juin) restent sans données historiques — DataForSEO ne rescore pas rétroactivement, donc leurs colonnes Vol/KD/Score restent à `—` sauf pour `logiciel de transcription` retrouvé dans le cache actuel.

| Date | Keyword | Vol/mo | KD | Score | Pillar | Article |
|---|---|---|---|---|---|---|
| 2026-05-20 | transcrire des entretiens plus vite | — | — | — | productivite-recherche | [how-to-transcribe-research-interviews-faster](/en/blog/how-to-transcribe-research-interviews-faster) |
| 2026-06-10 | conformité IRB / RGPD transcription | — | — | — | confidentialite-recherche | [irb-compliant-transcription-checklist-qualitative-research](/en/blog/irb-compliant-transcription-checklist-qualitative-research) |
| 2026-06-10 | retranscrire entretien semi-directif | — | — | — | these-master | [retranscrire-entretien-semi-directif-guide-doctorants](/fr/blog/retranscrire-entretien-semi-directif-guide-doctorants) |
| 2026-06-11 | ai transcription tools (comparatif) | — | — | — | transcription | [ai-transcription-tools-research-compared](/en/blog/ai-transcription-tools-research-compared) |
| 2026-06-13 | transcription entretien | — | — | — | transcription | [transcription-entretien](/fr/blog/transcription-entretien) |
| 2026-06-15 | retranscrire audio | — | — | — | transcription | [retranscrire-audio](/fr/blog/retranscrire-audio) |
| 2026-06-17 | analyse qualitative | 2400 | 0 | 216 | recherche-qualitative | [analyse-qualitative](/fr/blog/analyse-qualitative) |
| 2026-06-17 | logiciel de transcription | 10 | 0 | 1.5 | transcription | [logiciel-de-transcription](/fr/blog/logiciel-de-transcription) |
| 2026-06-19 | analyse qualitative data | 1000 | 6 | 56.25 | recherche-qualitative | [analyse-qualitative-data](/en/blog/analyse-qualitative-data) |
| 2026-06-21 | transcribe audio to text free online | 1900 | 35 | 42.22 | transcription | [transcribe-audio-to-text-free-online](/en/blog/transcribe-audio-to-text-free-online) |
| 2026-06-23 | cómo analizar datos cualitativos | — | — | — | recherche-qualitative | [como-analizar-datos-cualitativos](/es/blog/como-analizar-datos-cualitativos) |
| 2026-06-25 | qualitative Daten analysieren | — | — | — | recherche-qualitative | [qualitative-daten-analysieren](/de/blog/qualitative-daten-analysieren) |
| 2026-06-27 | how to analyse qualitative data | 320 | 0 | 28.8 | recherche-qualitative | [comment-analyser-donnees-qualitatives](/fr/blog/comment-analyser-donnees-qualitatives) |
| 2026-07-01 | mp3 audio to text converter online free | 260 | 22 | 8.13 | transcription | [mp3-audio-to-text-converter-online-free](/en/blog/mp3-audio-to-text-converter-online-free) |
| 2026-07-03 | data analysis in qualitative research example | 140 | 14 | 5.25 | recherche-qualitative | [data-analysis-in-qualitative-research-example](/en/blog/data-analysis-in-qualitative-research-example) |

**Couverture par pillar** (6 pillars définis dans `pipeline/seeds/fr.json`)
- `recherche-qualitative` (productFit 0.9) : **6 articles** — devenu le pillar le plus couvert depuis la dernière compilation (FR + EN + ES + DE sur l'angle « analyser des données qualitatives », plus un nouvel angle « exemple concret d'analyse » le 03/07). Tête de cluster à haut volume (`analyse qualitative` : 2400/mo, score 216) déjà traitée.
- `transcription` (productFit 1.0) : **6 articles** — toujours bien couvert (`logiciel de transcription`, `transcription entretien`, `retranscrire audio`, comparatif outils IA, `transcribe audio to text free online`, `mp3 audio to text converter online free`).
- `confidentialite-recherche` (0.95) : **1 article** (checklist IRB/RGPD) — **toujours sous-exploité malgré le productFit le plus élevé après `transcription`.**
- `these-master` (0.85) : **1 article** (entretien semi-directif doctorants) — voir alerte qualité des données ci-dessous.
- `productivite-recherche` (0.8) : **1 article** (transcrire plus vite).
- `entretien-terrain` (0.75) : **0 article.**

**Analyse**
- Le pillar `recherche-qualitative` est passé de **0 article dédié à 6** en deux semaines et demie : c'est le plus gros mouvement depuis la dernière compilation, cohérent avec la recommandation « Stratégies prévues » du rapport précédent. Il commence toutefois à montrer des signes de **saturation sur l'angle « analyser des données qualitatives »** (5 variantes EN/FR/ES/DE + un angle « exemple »). Les prochains articles du pillar devraient explorer des sous-thèmes distincts (`codification entretien`, `analyse verbatim`, `logiciel analyse qualitative`) plutôt que de nouvelles variantes de la même requête pour éviter la cannibalisation.
- `confidentialite-recherche` (productFit 0.95, 2ᵉ plus haut après `transcription`) reste à **1 seul article** : c'est le gisement le plus clair pour la prochaine vague.
- `entretien-terrain` reste à **0 article** malgré un productFit correct (0.75).
- ⚠️ **Alerte qualité des données — pillar `these-master`** : le run du 2026-07-03 a scoré des candidats pour ce pillar (`which of these is not a transcription skill`, `these phonetic transcription`, `these ipa transcription`…) qui sont en réalité des requêtes anglophones sur le mot « these » (démonstratif) et la transcription phonétique IPA, sans rapport avec la « thèse » (mémoire académique) visée par le pillar. Le seed `transcription these` semble mal interprété par l'expansion DataForSEO côté anglophone. **Ne pas utiliser ces candidats tels quels** — à corriger dans `pipeline/seeds/fr.json` (seed plus explicite, ex. `transcription de thèse doctorat`) avant la prochaine expansion.
- **DataForSEO actif** depuis un run antérieur au 25/06 (cache `candidates.json` généré le 2026-06-25, 140 candidats). Les scores ci-dessus pour les articles publiés après cette date sont donc fiables ; ceux d'avant restent non rétro-scorés.
- **Reddit insights à 0** sur le run du 03/07 (« 0 posts trouvés sur 8 subreddits ») — à surveiller sur les prochains runs : si ça persiste, vérifier si `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` sont bien configurés (sans eux, le pipeline tombe en mode public très rate-limité et peut manquer des résultats).
- **GSC toujours non connecté** : aucune section GSC dans les derniers `morning-report.md`, donc toujours aucune donnée d'impressions/clics/positions.

## Dernières stratégies

- **Ouverture réussie du pillar `recherche-qualitative`** : 6 articles en 2,5 semaines, multilingue (FR/EN/ES/DE), couvrant la tête de cluster à fort volume (`analyse qualitative`, 2400/mo) et ses variantes directes.
- **Approche par pillars/clusters** toujours pilotée par `pipeline/seeds/fr.json` (6 pillars pondérés par `productFit`), maintenant avec des scores DataForSEO réels pour prioriser.
- **Diversification linguistique** au-delà de FR/EN : premiers articles ES et DE sur le pillar `recherche-qualitative`.
- **Différenciation d'angle sur un même pillar saturé** : le dernier article (03/07) choisit délibérément un exemple concret plutôt qu'une énième variante de « comment analyser » pour éviter la cannibalisation avec `analyse-qualitative-data.md`.

## Stratégies prévues

- **Ouvrir le pillar `confidentialite-recherche`** (productFit 0.95, 1 seul article) : `RGPD transcription`, `transcription confidentielle`, `protection données recherche` — c'est maintenant le gisement prioritaire.
- **Ouvrir le pillar `entretien-terrain`** (productFit 0.75, 0 article) : `entretien qualitatif`, `guide entretien recherche`, `entretien focus groupe`.
- **Ralentir sur `recherche-qualitative`** côté angle « analyser des données » (déjà 5 variantes) et pivoter vers des sous-thèmes distincts du même pillar (`codification entretien`, `analyse verbatim`, `logiciel analyse qualitative`) pour continuer à exploiter son productFit sans cannibaliser.
- **Corriger le seed `transcription these`** dans `pipeline/seeds/fr.json` avant de rouvrir le pillar `these-master` — les candidats actuels sont inutilisables (voir alerte qualité des données).
- **Maillage interne** entre les 6 articles du cluster `recherche-qualitative` (EN/FR/ES/DE) et vers les articles `transcription`.

## Propositions pour la suite

Top candidats **non encore publiés**, issus de `pipeline/out/morning-report.md` (run du 2026-07-03) :

| Keyword | Vol/mo | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|
| how do you analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do we analyse qualitative data | 320 | 9 | informational | recherche-qualitative | 15.16 |
| how do i analyse qualitative data | 320 | 26 | informational | recherche-qualitative | 8 |
| how to analyse qualitative interview data | 50 | 6 | informational | recherche-qualitative | 2.81 |
| ways to analyse qualitative data | 40 | 5 | informational | recherche-qualitative | 2.4 |
| best software to analyse qualitative data | 10 | 0 | commercial | recherche-qualitative | 1.26 |
| software used to analyse qualitative data | 10 | 0 | commercial | recherche-qualitative | 1.26 |
| transcription audio en texte | 140 | 60 | informational | transcription | 2 |
| logiciel pour retranscrire un enregistrement audio | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription audio en texte gratuit | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription video en texte | 10 | 0 | transactional | transcription | 1.5 |

Pistes complémentaires :
- Les variantes « how do you/we/i analyse qualitative data » ci-dessus **cannibalisent fortement** `analyse-qualitative-data.md` (même intention de recherche) : à éviter en l'état, sauf angle très différencié.
- `best software to analyse qualitative data` / `software used to analyse qualitative data` (intent **commercial**, pillar recherche-qualitative) sont un bon candidat pour un article comparatif logiciels (NVivo, Atlas.ti, MAXQDA, Taguette…) qui n'existe pas encore dans le cluster.
- `transcription audio en texte` (140/mo, KD 60) est plus concurrentiel que les picks habituels (KD 0-22) — à évaluer avant de le prioriser.
- Prioriser le pillar `confidentialite-recherche` même sans candidat DataForSEO listé ici : les seeds (`RGPD transcription`, `transcription confidentielle`) n'ont pas encore été passés dans une expansion récente pour ce pillar spécifiquement.

## À faire par Romaric

- [x] ~~Configurer DataForSEO~~ — **fait** : le secret `DATAFORSEO_BASE64` est actif, les runs récents renvoient volumes/KD/scores réels.
- [ ] **Connecter Google Search Console** (débloque impressions/clics/positions) — toujours pas fait :
  1. Créer/récupérer un **service account Google** (scope `webmasters.readonly`) et l'ajouter comme utilisateur en lecture sur la propriété GSC du domaine.
  2. Ajouter les secrets GitHub `GOOGLE_JSON` (clé JSON du service account) et `GSC_SITE_URL` (URL exacte de la propriété, ex. `https://humanlogs.app/` ou `sc-domain:humanlogs.app`).
  3. Relancer **SEO research** : l'étape GSC ne renverra plus d'erreur et les données de perf remonteront.
- [ ] **Vérifier les identifiants Reddit** (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`) : le run du 03/07 a renvoyé 0 posts sur 8 subreddits, ce qui peut être normal (aucun match) ou un signe que le pipeline tourne en mode public non authentifié.
- [ ] Valider l'**ordre de priorité** des prochains pillars (proposé : `confidentialite-recherche` puis `entretien-terrain`, en ralentissant sur `recherche-qualitative`).
- [ ] Trancher si un article **comparatif logiciels QDA** (NVivo/Atlas.ti/MAXQDA/Taguette, intent commercial) a sa place dans la ligne éditoriale — HumanLogs n'est pas un logiciel QDA mais alimente ces outils en transcripts.
- [ ] Corriger le seed `transcription these` → `transcription de thèse doctorat` dans `pipeline/seeds/fr.json` (voir alerte qualité des données ci-dessus) avant de rouvrir le pillar `these-master`.

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| 2026-07-03 | data analysis in qualitative research example | 5.25 | Oui |
| 2026-07-01 | mp3 audio to text converter online free | 8.13 | Oui |
| 2026-06-27 | how to analyse qualitative data | 28.8 | Oui |
| 2026-06-25 | qualitative Daten analysieren | — | Oui |
| 2026-06-23 | cómo analizar datos cualitativos | — | Oui |
| 2026-06-21 | transcribe audio to text free online | 42.22 | Oui |
| 2026-06-19 | analyse qualitative data | 56.25 | Oui |
| 2026-06-17 | analyse qualitative | 216 | Oui |
| 2026-06-17 | logiciel de transcription | 1.5 | Oui |
| 2026-06-15 | retranscrire audio | — | Oui |
| 2026-06-13 | transcription entretien | — | Oui |
| 2026-06-11 | ai transcription tools (comparatif) | — | Oui |
| 2026-06-10 | retranscrire entretien semi-directif | — | Oui |
| 2026-06-10 | conformité IRB / RGPD transcription | — | Oui |
| 2026-05-20 | transcrire des entretiens plus vite | — | Oui |
