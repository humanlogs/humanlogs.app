_Dernière compilation : 2026-07-21 · 18 articles publiés · DataForSEO **rétabli** (candidats avec vraies métriques ce run) · GSC **toujours cassé** (`deleted_client`, inchangé) · Reddit **échec confirmé en 403** (pas juste 0 résultat — voir alerte)._

## Résumé des chiffres et analyse

**Production de contenu**
- **18 articles publiés** entre le 2026-05-20 et le 2026-07-21 (8 en FR, 8 en EN, 1 en ES, 1 en DE).
- **1 nouvel article le 21/07**, run DataForSEO à nouveau fonctionnel (plafond de coût relevé entre-temps, cf. « À faire » précédent).
- ⚠️ **Le pick automatique du run du 21/07 a été écarté** : le pipeline recommandait `how analyse qualitative data` (score 24, pillar `recherche-qualitative`), mais c'est un quasi-doublon de 4 articles déjà publiés (`analyse-qualitative-data` — « analyse qualitative data », `comment-analyser-donnees-qualitatives` — « how **to** analyse qualitative data », `analyse-qualitative`, `data-analysis-in-qualitative-research-example`). Le check de dédoublonnage ne fait qu'une comparaison exacte sur `targetKeyword`, donc une variante à un mot près (« how analyse » vs « how to analyse ») passe au travers. **Publié à la place** : `how to analyse qualitative survey data` (vol 20, KD 4, score 1.29), un angle réellement distinct (réponses ouvertes de questionnaire vs entretien) dans le même pillar, sans recouvrement avec les articles existants.
- **GSC toujours cassé** : même erreur `deleted_client` — le client OAuth n'a toujours pas été recréé (voir « À faire », inchangé depuis le 13/07).
- ⚠️ **Reddit — cause racine identifiée** : les runs précédents remontaient « 0 posts trouvés » ; ce run montre que l'appel échoue en réalité avec une **erreur 403** sur `old.reddit.com/r/<subreddit>/search` (réponse HTML de blocage, pas du JSON), pas une absence réelle de résultats. Confirme l'hypothèse d'un accès non authentifié bloqué par Reddit plutôt qu'un manque de contenu — voir « À faire ».
- Les articles publiés **avant** la bascule DataForSEO (7 premiers, jusqu'au 17 juin) restent sans données historiques — DataForSEO ne rescore pas rétroactivement, donc leurs colonnes Vol/KD/Score restent à `—` sauf pour `logiciel de transcription` retrouvé dans le cache actuel.

| Date | Keyword | Vol/mo | KD | Score | Pillar | Article |
|---|---|---|---|---|---|---|
| 2026-07-21 | how to analyse qualitative survey data | 20 | 4 | 1.29 | recherche-qualitative | [how-to-analyse-qualitative-survey-data](/en/blog/how-to-analyse-qualitative-survey-data) |
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
- `recherche-qualitative` (productFit 0.9) : **7 articles** — pillar le plus couvert (FR + EN + ES + DE sur l'angle « analyser des données qualitatives », un angle « exemple concret d'analyse », et désormais un angle « données de questionnaire » distinct des entretiens). Tête de cluster à haut volume (`analyse qualitative` : 2400/mo, score 216) déjà traitée.
- `transcription` (productFit 1.0) : **8 articles** — toujours le pillar le plus rempli (`logiciel de transcription`, `transcription entretien`, `retranscrire audio`, comparatif outils IA, `transcribe audio to text free online`, `mp3 audio to text converter online free`, `transcription automatique`, et désormais `transcription vocale` sur l'angle « dictée en temps réel vs transcription différée de fichiers audio »). **Deux picks de suite (13/07, 17/07) sont tombés sur ce même pillar par fallback faute de données DataForSEO** — voir alerte ci-dessous.
- `confidentialite-recherche` (0.95) : **1 article** (checklist IRB/RGPD) — **toujours sous-exploité malgré le productFit le plus élevé après `transcription`, et non rouvert depuis 2 runs consécutifs faute de scoring DataForSEO fonctionnel.**
- `these-master` (0.85) : **1 article** (entretien semi-directif doctorants) — voir alerte qualité des données ci-dessous.
- `productivite-recherche` (0.8) : **1 article** (transcrire plus vite).
- `entretien-terrain` (0.75) : **0 article.**

**Analyse**
- Le pillar `recherche-qualitative` passe à **7 articles** ; il montre des signes de **saturation sur l'angle « analyser des données qualitatives »** (5 variantes EN/FR/ES/DE + un angle « exemple » + un nouvel angle « questionnaire »). Les prochains articles du pillar devraient explorer des sous-thèmes distincts (`codification entretien`, `analyse verbatim`, `logiciel analyse qualitative`) plutôt que de nouvelles variantes de la même requête pour éviter la cannibalisation.
- ⚠️ **Angle mort du dédoublonnage confirmé ce run** : le pick automatique du 21/07 était `how analyse qualitative data`, quasi-doublon de 4 articles déjà publiés (`analyse-qualitative-data`, `comment-analyser-donnees-qualitatives` — ciblé sur « how **to** analyse qualitative data » —, `analyse-qualitative`, `data-analysis-in-qualitative-research-example`). Le check de dédoublonnage compare `targetKeyword` au caractère près, donc une variante à un mot près passe au travers. Écarté manuellement au profit de `how to analyse qualitative survey data` (même liste de candidats, angle réellement distinct). **À corriger côté ingénierie du pipeline** (`pipeline/select-topic.ts`, matching flou plutôt qu'exact) — hors périmètre de ce run, voir « À faire ».
- Le pillar `transcription` reste à **8 articles**, stable depuis le run du 17/07 (non retouché ce run).
- `confidentialite-recherche` (productFit 0.95, 2ᵉ plus haut après `transcription`) reste à **1 seul article** : toujours le gisement le plus clair, à sélectionner manuellement lors d'un prochain run (voir « À faire »).
- `entretien-terrain` reste à **0 article** malgré un productFit correct (0.75).
- ⚠️ **Alerte qualité des données — pillar `these-master`** (toujours ouverte) : les candidats `which of these is not a transcription skill` (score 5.95) et `transcription of these` (score 3.4) réapparaissent ce run avec un score notable, mais restent des requêtes anglophones sur le mot « these » (démonstratif), sans rapport avec la « thèse » académique visée par le pillar. **Ne pas utiliser tels quels** — seed à corriger dans `pipeline/seeds/fr.json` avant d'ouvrir ce pillar.
- **DataForSEO rétabli ce run** : candidats avec vraies métriques (volume/KD/score), après les deux runs en échec du 13/07 et 17/07 — le plafond de coût quotidien a probablement été relevé entre-temps (à confirmer).
- **GSC toujours en échec** (3ᵉ run consécutif) : `"error": "deleted_client", "error_description": "The OAuth client was deleted."` — le client OAuth n'a toujours pas été recréé.
- ⚠️ **Reddit — cause racine précisée** : ce run montre que l'appel `old.reddit.com/r/<subreddit>/search` échoue en **403** (réponse HTML de blocage), pas juste « 0 résultat » comme le laissaient penser les runs précédents (03/07, 13/07, 17/07). Confirme un accès bloqué (probable mode non authentifié) plutôt qu'une absence réelle de contenu pertinent — voir « À faire ».

## Dernières stratégies

- **Vérification manuelle anti-cannibalisation avant publication** : ce run a montré que le check de dédoublonnage automatique (exact match sur `targetKeyword`) ne suffit pas. Avant de rédiger, comparer le pick du pipeline aux `targetKeyword` **et** aux titres des articles existants du même pillar ; en cas de quasi-doublon, choisir un autre candidat de la même liste de scores avec un angle distinct plutôt que d'abandonner le run.
- **Différenciation d'angle systématique au sein du pillar `transcription`** : `transcription automatique` couvre la précision/méthodologie pour la recherche, `transcription entretien` le workflow d'entretien (verbatim, RGPD), `transcription vocale` la distinction dictée temps réel / transcription différée — trois angles distincts sur un même pillar pour limiter la cannibalisation.
- **Approche par pillars/clusters** toujours pilotée par `pipeline/seeds/fr.json` (6 pillars pondérés par `productFit`), avec des scores DataForSEO à nouveau fiables ce run.
- **Diversification linguistique** au-delà de FR/EN : premiers articles ES et DE sur le pillar `recherche-qualitative`, inchangé depuis la dernière compilation.

## Stratégies prévues

- **Ouvrir le pillar `confidentialite-recherche`** (productFit 0.95, 1 seul article) : `RGPD transcription`, `transcription confidentielle`, `protection données recherche` — toujours le gisement prioritaire, maintenant que DataForSEO fonctionne à nouveau il devrait remonter naturellement s'il est passé en seed prioritaire, sinon sélectionner **manuellement**.
- **Ouvrir le pillar `entretien-terrain`** (productFit 0.75, 0 article) : `entretien qualitatif`, `guide entretien recherche`, `entretien focus groupe`.
- **Ralentir sur `recherche-qualitative`** côté angle « analyser des données » (déjà 6 variantes en comptant l'angle questionnaire) et pivoter vers des sous-thèmes distincts du même pillar (`codification entretien`, `analyse verbatim`, `logiciel analyse qualitative`) pour continuer à exploiter son productFit sans cannibaliser.
- **Corriger le seed `transcription these`** dans `pipeline/seeds/fr.json` avant de rouvrir le pillar `these-master` — les candidats actuels sont inutilisables (voir alerte qualité des données).
- **Fiabiliser le dédoublonnage** (`pipeline/select-topic.ts`) : ajouter un matching flou (normalisation + distance d'édition ou similarité de tokens) en plus du match exact sur `targetKeyword`, pour éviter qu'un candidat comme `how analyse qualitative data` ne repasse au travers du filtre face à `how to analyse qualitative data` déjà publié.
- **Maillage interne** entre les 7 articles du cluster `recherche-qualitative` (EN/FR/ES/DE) et vers les articles `transcription`.

## Propositions pour la suite

Top candidats **non encore publiés**, issus de `pipeline/out/morning-report.md` (run du 2026-07-21) :

| Keyword | Vol/mo | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|
| how do we analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do you analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do i analyse qualitative data | 320 | 26 | informational | recherche-qualitative | 8 |
| how to analyse qualitative interview data | 50 | 6 | informational | recherche-qualitative | 2.81 |
| ways to analyse qualitative data | 40 | 5 | informational | recherche-qualitative | 2.4 |
| how to analyse qualitative data from an interview | 50 | 20 | informational | recherche-qualitative | 1.5 |
| best software to analyse qualitative data | 10 | 0 | commercial | recherche-qualitative | 1.26 |
| software used to analyse qualitative data | 10 | 0 | commercial | recherche-qualitative | 1.26 |
| how to analyse qualitative data from interviews | 50 | 30 | informational | recherche-qualitative | 1.13 |
| recherche qualitative | 10 | 0 | informational | recherche-qualitative | 0.9 |
| méthodes de recherche qualitative | 10 | 0 | informational | recherche-qualitative | 0.9 |
| recherche qualitative définition | 10 | 0 | informational | recherche-qualitative | 0.9 |
| exemple de recherche qualitative | 10 | 0 | informational | recherche-qualitative | 0.9 |
| introduction à la recherche qualitative | 10 | 0 | informational | recherche-qualitative | 0.9 |
| transcription audio en texte | 140 | 60 | informational | transcription | 2 |
| logiciel pour retranscrire un enregistrement audio | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription audio en texte gratuit | 10 | 0 | transactional | transcription | 1.5 |

Pistes complémentaires :
- Les variantes « how do you/we/i analyse qualitative data » ci-dessus **cannibalisent fortement** `analyse-qualitative-data.md` (même intention de recherche) : à éviter en l'état, sauf angle très différencié. Idem pour `how to analyse qualitative data from an interview` / `from interviews`, très proches de `how to analyse qualitative interview data` déjà envisagé et de `data-analysis-in-qualitative-research-example.md`.
- `how to analyse qualitative interview data` (50/mo, KD 6) reste le meilleur candidat interview-spécifique non publié, à condition de le différencier clairement de `data-analysis-in-qualitative-research-example.md` (angle « exemple travaillé » vs angle « méthode »).
- `best software to analyse qualitative data` / `software used to analyse qualitative data` (intent **commercial**, pillar recherche-qualitative) sont un bon candidat pour un article comparatif logiciels (NVivo, Atlas.ti, MAXQDA, Taguette…) qui n'existe pas encore dans le cluster.
- Les 5 requêtes FR à faible volume (`recherche qualitative`, `méthodes de recherche qualitative`, `recherche qualitative définition`, `exemple de recherche qualitative`, `introduction à la recherche qualitative`) forment un bon socle pour une **page pilier FR « qu'est-ce que la recherche qualitative »**, plus large que les articles actuels centrés sur l'analyse — à regrouper en un seul article plutôt que 5 variantes séparées vu le volume très faible de chacune.
- `transcription audio en texte` (140/mo, KD 60) est plus concurrentiel que les picks habituels (KD 0-22) — à évaluer avant de le prioriser.
- Prioriser le pillar `confidentialite-recherche` même sans candidat DataForSEO listé ici : les seeds (`RGPD transcription`, `transcription confidentielle`) n'ont pas encore été passés dans une expansion récente pour ce pillar spécifiquement.

## À faire par Romaric

- [x] ~~Configurer DataForSEO~~ — **fait** : le secret `DATAFORSEO_BASE64` est actif.
- [x] ~~Relever le plafond de coût quotidien DataForSEO~~ — **semble résolu** : le run du 21/07 a produit des candidats avec de vraies métriques (volume/KD/PAA/SERP) pour la première fois depuis le 03/07. À confirmer sur le prochain run, et si confirmé, envisager de rescorer a posteriori `transcription automatique` et `transcription vocale` (publiés sans données faute de quota à l'époque).
- [ ] ⚠️ **Recréer le client OAuth Google Search Console** (toujours ouvert depuis le 13/07, confirmé en échec pour la 3ᵉ fois le 21/07) : le token renvoie `"error": "deleted_client", "error_description": "The OAuth client was deleted."` — le client OAuth associé au service account a été supprimé côté Google Cloud Console. Il faut regénérer des identifiants (nouveau service account ou nouveau client OAuth) et remplacer le secret `GOOGLE_JSON`.
  1. Créer/récupérer un **service account Google** (scope `webmasters.readonly`) et l'ajouter comme utilisateur en lecture sur la propriété GSC du domaine.
  2. Ajouter les secrets GitHub `GOOGLE_JSON` (clé JSON du service account) et `GSC_SITE_URL` (URL exacte de la propriété, ex. `https://humanlogs.app/` ou `sc-domain:humanlogs.app`).
  3. Relancer **SEO research** : l'étape GSC ne renverra plus d'erreur et les données de perf remonteront.
- [ ] ⚠️ **Vérifier les identifiants Reddit** (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`) : le run du 21/07 montre une **erreur 403** explicite sur `old.reddit.com/r/<subreddit>/search` (page HTML de blocage), pas juste « 0 résultat » — ce n'est donc probablement pas une absence de contenu mais un accès non authentifié bloqué par Reddit. Vérifier que les secrets sont bien renseignés et valides côté Reddit (app OAuth) ; si le pipeline n'utilise volontairement pas l'auth OAuth pour ces recherches, envisager de l'ajouter.
- [ ] Valider l'**ordre de priorité** des prochains pillars (proposé : `confidentialite-recherche` puis `entretien-terrain`) — envisager de sélectionner ces mots-clés manuellement pour le prochain run si le pipeline continue de proposer des variantes `recherche-qualitative`/`transcription`.
- [ ] Trancher si un article **comparatif logiciels QDA** (NVivo/Atlas.ti/MAXQDA/Taguette, intent commercial) a sa place dans la ligne éditoriale — HumanLogs n'est pas un logiciel QDA mais alimente ces outils en transcripts.
- [ ] Corriger le seed `transcription these` → `transcription de thèse doctorat` dans `pipeline/seeds/fr.json` (voir alerte qualité des données ci-dessus) avant de rouvrir le pillar `these-master`.
- [ ] **Fiabiliser le dédoublonnage du pipeline** (`pipeline/select-topic.ts`) : le run du 21/07 a recommandé un quasi-doublon (`how analyse qualitative data` vs `how to analyse qualitative data` déjà publié) qui a échappé au check exact — ajouter une comparaison floue (normalisation, distance d'édition ou tokens communs) en plus du match exact.

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| 2026-07-21 | how to analyse qualitative survey data (pick automatique écarté : quasi-doublon "how analyse qualitative data") | 1.29 | Oui |
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
