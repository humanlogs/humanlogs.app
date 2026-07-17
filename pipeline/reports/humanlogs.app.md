_Dernière compilation : 2026-07-17 · 17 articles publiés · DataForSEO **échec pour le 2ᵉ run consécutif (13/07 et 17/07)** (fallback sur seed sans données) · GSC **client OAuth toujours supprimé** → toujours pas de données de performance (impressions/clics/positions)._

## Résumé des chiffres et analyse

**Production de contenu**
- **17 articles publiés** entre le 2026-05-20 et le 2026-07-17 (8 en FR, 7 en EN, 1 en ES, 1 en DE).
- Cadence stable depuis la dernière compilation : **1 nouvel article entre le 13 et le 17 juillet**.
- ⚠️ **Incident run du 17/07** : comme le 13/07, l'expansion DataForSEO n'a produit aucun candidat (0 volume/KD/PAA/SERP) et les insights Reddit sont revenus vides (0 posts sur 8 subreddits). Le pipeline est retombé sur le fallback seed `transcription vocale` (pillar `transcription`, productFit 1.0, non couvert, non cannibalisant avec les 7 articles existants du pillar). L'article a été rédigé sur cette base, avec un angle volontairement différencié (dictée en temps réel vs transcription différée de fichiers audio) pour ne pas recouper `transcription automatique` ni `transcription entretien`, mais **sans validation par la donnée** — à retraiter avec de vraies métriques dès que le quota DataForSEO est relevé.
- **GSC toujours cassé** : même erreur `deleted_client` qu'au run du 13/07 — le client OAuth n'a pas encore été recréé (voir « À faire », inchangé).
- Les articles publiés **avant** la bascule DataForSEO (7 premiers, jusqu'au 17 juin) restent sans données historiques — DataForSEO ne rescore pas rétroactivement, donc leurs colonnes Vol/KD/Score restent à `—` sauf pour `logiciel de transcription` retrouvé dans le cache actuel.

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
| 2026-07-13 | transcription automatique | — (quota DataForSEO dépassé) | — | — | transcription | [transcription-automatique](/fr/blog/transcription-automatique) |
| 2026-07-17 | transcription vocale | — (quota DataForSEO dépassé) | — | — | transcription | [transcription-vocale](/fr/blog/transcription-vocale) |

**Couverture par pillar** (6 pillars définis dans `pipeline/seeds/fr.json`)
- `recherche-qualitative` (productFit 0.9) : **6 articles** — pillar le plus couvert (FR + EN + ES + DE sur l'angle « analyser des données qualitatives », plus un angle « exemple concret d'analyse »). Tête de cluster à haut volume (`analyse qualitative` : 2400/mo, score 216) déjà traitée. Inchangé depuis la dernière compilation.
- `transcription` (productFit 1.0) : **8 articles** — toujours le pillar le plus rempli (`logiciel de transcription`, `transcription entretien`, `retranscrire audio`, comparatif outils IA, `transcribe audio to text free online`, `mp3 audio to text converter online free`, `transcription automatique`, et désormais `transcription vocale` sur l'angle « dictée en temps réel vs transcription différée de fichiers audio »). **Deux picks de suite (13/07, 17/07) sont tombés sur ce même pillar par fallback faute de données DataForSEO** — voir alerte ci-dessous.
- `confidentialite-recherche` (0.95) : **1 article** (checklist IRB/RGPD) — **toujours sous-exploité malgré le productFit le plus élevé après `transcription`, et non rouvert depuis 2 runs consécutifs faute de scoring DataForSEO fonctionnel.**
- `these-master` (0.85) : **1 article** (entretien semi-directif doctorants) — voir alerte qualité des données ci-dessous.
- `productivite-recherche` (0.8) : **1 article** (transcrire plus vite).
- `entretien-terrain` (0.75) : **0 article.**

**Analyse**
- Le pillar `recherche-qualitative` est resté stable à **6 articles** ; il montre des signes de **saturation sur l'angle « analyser des données qualitatives »** (5 variantes EN/FR/ES/DE + un angle « exemple »). Les prochains articles du pillar devraient explorer des sous-thèmes distincts (`codification entretien`, `analyse verbatim`, `logiciel analyse qualitative`) plutôt que de nouvelles variantes de la même requête pour éviter la cannibalisation.
- ⚠️ **Le pillar `transcription` continue de se remplir par défaut** (2 articles sur les 2 derniers runs, tous deux sans données chiffrées) alors que le rapport précédent recommandait d'ouvrir `confidentialite-recherche` ou `entretien-terrain` en priorité. Cause structurelle : sans expansion DataForSEO fonctionnelle, le pipeline retombe sur les seeds du pillar `productFit` le plus élevé (`transcription`, 1.0) plutôt que sur les pillars sous-exploités. **Tant que le quota DataForSEO n'est pas relevé, ce biais va continuer à saturer `transcription` au détriment de `confidentialite-recherche` et `entretien-terrain`.**
- `confidentialite-recherche` (productFit 0.95, 2ᵉ plus haut après `transcription`) reste à **1 seul article** depuis 2 runs : c'est toujours le gisement le plus clair, mais il ne sera atteint par le pipeline automatique qu'une fois le quota DataForSEO relevé (voir « À faire »).
- `entretien-terrain` reste à **0 article** malgré un productFit correct (0.75).
- ⚠️ **Alerte qualité des données — pillar `these-master`** : le run du 2026-07-03 a scoré des candidats pour ce pillar (`which of these is not a transcription skill`, `these phonetic transcription`, `these ipa transcription`…) qui sont en réalité des requêtes anglophones sur le mot « these » (démonstratif) et la transcription phonétique IPA, sans rapport avec la « thèse » (mémoire académique) visée par le pillar. Le seed `transcription these` semble mal interprété par l'expansion DataForSEO côté anglophone. **Ne pas utiliser ces candidats tels quels** — à corriger dans `pipeline/seeds/fr.json` (seed plus explicite, ex. `transcription de thèse doctorat`) avant la prochaine expansion.
- **DataForSEO en échec pour le 2ᵉ run consécutif** (13/07 et 17/07) : 0 candidat sur les 42 seeds à chaque fois. Les scores pour les articles publiés entre le 25/06 et le 03/07 restent fiables (cache `candidates.json` du 25/06, 140 candidats) ; les deux derniers articles (`transcription automatique`, `transcription vocale`) n'ont aucune donnée derrière — voir « À faire ».
- **GSC en échec** sur les runs du 13/07 et du 17/07 : `"error": "deleted_client"` — le client OAuth a été supprimé côté Google Cloud, toujours pas recréé.
- **Reddit insights à 0** sur les runs du 03/07, 13/07 et 17/07 (« 0 posts trouvés sur 8 subreddits ») — persiste sur trois runs consécutifs, ce qui renforce l'hypothèse d'un mode public non authentifié plutôt qu'une absence réelle de résultats : vérifier `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`.

## Dernières stratégies

- **Deux runs de suite (13/07, 17/07) en mode dégradé** : faute de données DataForSEO, le pipeline choisit un seed non couvert du pillar au productFit le plus élevé (`transcription`, 1.0) plutôt que d'ouvrir un pillar sous-exploité. Les deux articles (`transcription automatique`, `transcription vocale`) ont été rédigés malgré l'absence de métriques, en vérifiant manuellement qu'ils ne cannibalisent pas les articles `transcription` existants et en choisissant un angle distinct pour chacun.
- **Différenciation d'angle systématique au sein du pillar `transcription`** : `transcription automatique` couvre la précision/méthodologie pour la recherche, `transcription entretien` le workflow d'entretien (verbatim, RGPD), `transcription vocale` la distinction dictée temps réel / transcription différée — trois angles distincts sur un même pillar pour limiter la cannibalisation malgré la sélection automatique dégradée.
- **Approche par pillars/clusters** toujours pilotée par `pipeline/seeds/fr.json` (6 pillars pondérés par `productFit`), mais actuellement sans scores DataForSEO réels pour arbitrer (voir alerte ci-dessus).
- **Diversification linguistique** au-delà de FR/EN : premiers articles ES et DE sur le pillar `recherche-qualitative`, inchangé depuis la dernière compilation.

## Stratégies prévues

- **Ouvrir le pillar `confidentialite-recherche`** (productFit 0.95, 1 seul article) : `RGPD transcription`, `transcription confidentielle`, `protection données recherche` — toujours le gisement prioritaire, mais probablement à sélectionner **manuellement** (hors pipeline automatique) tant que DataForSEO reste en échec, sinon le fallback continuera de retomber sur `transcription`.
- **Ouvrir le pillar `entretien-terrain`** (productFit 0.75, 0 article) : `entretien qualitatif`, `guide entretien recherche`, `entretien focus groupe`.
- **Ralentir sur le pillar `transcription`** une fois le quota DataForSEO relevé : il vient de passer à 8 articles en 2 runs de fallback consécutifs, avant même que les pillars sous-exploités (`confidentialite-recherche`, `entretien-terrain`) n'aient été rouverts.
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

- [x] ~~Configurer DataForSEO~~ — **fait** : le secret `DATAFORSEO_BASE64` est actif.
- [ ] ⚠️ **Relever le plafond de coût quotidien DataForSEO** (toujours ouvert depuis le 13/07, confirmé en échec à nouveau le 17/07) : le compte a un plafond de **$2/jour** dans le panneau DataForSEO (`app.dataforseo.com/api-settings`). Deux runs de suite ont perdu toute l'expansion de mots-clés (0 candidat sur 42 seeds), et les deux derniers articles publiés (`transcription automatique`, `transcription vocale`) n'ont **aucune donnée de volume/KD/PAA/SERP** derrière — augmenter le plafond pour retrouver des picks fiables et débloquer les pillars sous-exploités.
- [ ] ⚠️ **Recréer le client OAuth Google Search Console** (toujours ouvert depuis le 13/07, confirmé en échec à nouveau le 17/07) : le token renvoie `"error": "deleted_client", "error_description": "The OAuth client was deleted."` — le client OAuth associé au service account a été supprimé côté Google Cloud Console. Il faut regénérer des identifiants (nouveau service account ou nouveau client OAuth) et remplacer le secret `GOOGLE_JSON`.
  1. Créer/récupérer un **service account Google** (scope `webmasters.readonly`) et l'ajouter comme utilisateur en lecture sur la propriété GSC du domaine.
  2. Ajouter les secrets GitHub `GOOGLE_JSON` (clé JSON du service account) et `GSC_SITE_URL` (URL exacte de la propriété, ex. `https://humanlogs.app/` ou `sc-domain:humanlogs.app`).
  3. Relancer **SEO research** : l'étape GSC ne renverra plus d'erreur et les données de perf remonteront.
- [ ] **Vérifier les identifiants Reddit** (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`) : 0 posts trouvés sur 3 runs consécutifs (03/07, 13/07, 17/07), ce qui peut être normal (aucun match) ou un signe que le pipeline tourne en mode public non authentifié.
- [ ] Valider l'**ordre de priorité** des prochains pillars (proposé : `confidentialite-recherche` puis `entretien-terrain`) — **et envisager de sélectionner ces mots-clés manuellement pour le prochain article** plutôt que de laisser le pipeline automatique retomber sur `transcription` par défaut tant que DataForSEO est en échec.
- [ ] Trancher si un article **comparatif logiciels QDA** (NVivo/Atlas.ti/MAXQDA/Taguette, intent commercial) a sa place dans la ligne éditoriale — HumanLogs n'est pas un logiciel QDA mais alimente ces outils en transcripts.
- [ ] Corriger le seed `transcription these` → `transcription de thèse doctorat` dans `pipeline/seeds/fr.json` (voir alerte qualité des données ci-dessus) avant de rouvrir le pillar `these-master`.
- [ ] Une fois le quota DataForSEO relevé, envisager de **rescorer `transcription automatique` et `transcription vocale`** a posteriori pour confirmer que ces picks étaient pertinents (probable vu productFit 1.0 et volume de recherche généralement élevé sur ces termes, mais non vérifié faute de données sur ces deux runs).

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| 2026-07-17 | transcription vocale | — (run en échec : quota DataForSEO dépassé, fallback seed) | Oui |
| 2026-07-13 | transcription automatique | — (run en échec : quota DataForSEO dépassé, fallback seed) | Oui |
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
