_Dernière compilation : 2026-08-09 · 22 articles publiés · DataForSEO **stable** (cache réutilisé, expansion non nécessaire) · GSC **toujours cassé** (`deleted_client`, inchangé, 7ᵉ run) · Reddit **toujours en 403** sur les 8 subreddits (inchangé, `REDDIT_CLIENT_ID`/`SECRET` toujours absents → fallback JSON public bloqué)._

## Résumé des chiffres et analyse

**Production de contenu**
- **22 articles publiés** entre le 2026-05-20 et le 2026-08-09 (9 en FR, 11 en EN, 1 en ES, 1 en DE).
- **1 nouvel article le 09/08.** Le run a de nouveau utilisé le cache `candidates.json`, pas d'expansion DataForSEO nécessaire.
- ⚠️ **Le pick automatique du run du 09/08 a de nouveau été écarté — 5ᵉ collision consécutive sur la même paire de mots-clés** (après le 21/07, le 25/07, le 01/08 et le 05/08) : le pipeline a recommandé pour la cinquième fois `how analyse qualitative data` (score 24, pillar `recherche-qualitative`). Les 4 questions PAA du run sont désormais **toutes** couvertes ailleurs sur le blog (méthodes → `analyse-qualitative-data.md`, ChatGPT → `using-ai-to-analyse-qualitative-data.md`, démarche → `analyse-qualitative.md`, exemples → `data-analysis-in-qualitative-research-example.md`) : ce pick n'offrait plus aucun angle inédit, contrairement aux runs précédents. **Publié à la place** la page pilier FR déjà identifiée dans les Propositions du rapport précédent : `recherche qualitative` (vol 10, KD 0, score 0.9, pillar `recherche-qualitative`), qui regroupe en un seul article les 6 requêtes FR à faible volume du cluster (`recherche qualitative`, `recherche qualitative et quantitative`, `méthodes de recherche qualitative`, `recherche qualitative définition`, `exemple de recherche qualitative`, `introduction à la recherche qualitative`). Angle : définition de la recherche qualitative (au sens démarche/collecte, pas analyse), différence avec le quantitatif, méthodes de collecte (entretien, focus group, observation, analyse documentaire), exemples par discipline — complémentaire de `analyse-qualitative.md` (méthodes d'analyse) et `comment-analyser-donnees-qualitatives.md` (démarche d'analyse), vers lesquels il renvoie.
- **GSC toujours cassé** : même erreur `deleted_client` (HTTP 401) — le client OAuth n'a toujours pas été recréé (voir « À faire », inchangé depuis le 13/07, 7ᵉ run consécutif en échec).
- **Reddit toujours en échec 403** sur les 8 subreddits (fallback JSON public bloqué, pas de `REDDIT_CLIENT_ID`/`SECRET`) — inchangé depuis le 21/07, voir « À faire ». **0 posts** remontés ce run (comme attendu vu le blocage).
- Les articles publiés **avant** la bascule DataForSEO (7 premiers, jusqu'au 17 juin) restent sans données historiques — DataForSEO ne rescore pas rétroactivement, donc leurs colonnes Vol/KD/Score restent à `—` sauf pour `logiciel de transcription` retrouvé dans le cache actuel.

| Date | Keyword | Vol/mo | KD | Score | Pillar | Article |
|---|---|---|---|---|---|---|
| 2026-08-09 | recherche qualitative | 10 | 0 | 0.9 | recherche-qualitative | [recherche-qualitative](/fr/blog/recherche-qualitative) |
| 2026-08-05 | using ai to analyse qualitative data | 10 | 0 | 0.9 | recherche-qualitative | [using-ai-to-analyse-qualitative-data](/en/blog/using-ai-to-analyse-qualitative-data) |
| 2026-08-01 | best software to analyse qualitative data | 10 | 0 | 1.26 | recherche-qualitative | [best-software-to-analyse-qualitative-data](/en/blog/best-software-to-analyse-qualitative-data) |
| 2026-07-25 | how to analyse qualitative interview data | 50 | 6 | 2.81 | recherche-qualitative | [how-to-analyse-qualitative-interview-data](/en/blog/how-to-analyse-qualitative-interview-data) |
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
- `recherche-qualitative` (productFit 0.9) : **11 articles** — pillar le plus couvert (FR + EN + ES + DE sur l'angle « analyser des données qualitatives », un angle « exemple concret d'analyse », un angle « données de questionnaire », un angle « données d'entretien », un angle « comparatif logiciels » intent commercial, un angle « IA/ChatGPT dans l'analyse qualitative », et désormais une page pilier FR « qu'est-ce que la recherche qualitative » centrée sur la démarche/collecte plutôt que l'analyse). Tête de cluster à haut volume (`analyse qualitative` : 2400/mo, score 216) déjà traitée.
- `transcription` (productFit 1.0) : **8 articles** — toujours le pillar le plus rempli (`logiciel de transcription`, `transcription entretien`, `retranscrire audio`, comparatif outils IA, `transcribe audio to text free online`, `mp3 audio to text converter online free`, `transcription automatique`, et désormais `transcription vocale` sur l'angle « dictée en temps réel vs transcription différée de fichiers audio »). **Deux picks de suite (13/07, 17/07) sont tombés sur ce même pillar par fallback faute de données DataForSEO** — voir alerte ci-dessous.
- `confidentialite-recherche` (0.95) : **1 article** (checklist IRB/RGPD) — **toujours sous-exploité malgré le productFit le plus élevé après `transcription`, et non rouvert depuis 2 runs consécutifs faute de scoring DataForSEO fonctionnel.**
- `these-master` (0.85) : **1 article** (entretien semi-directif doctorants) — voir alerte qualité des données ci-dessous.
- `productivite-recherche` (0.8) : **1 article** (transcrire plus vite).
- `entretien-terrain` (0.75) : **0 article.**

**Analyse**
- Le pillar `recherche-qualitative` passe à **11 articles** ; l'angle « analyser des données qualitatives » (5 variantes EN/FR/ES/DE + « exemple » + « questionnaire » + « entretien » + « logiciels » + « IA/ChatGPT ») est désormais saturé au sens strict, mais le nouvel article FR **ouvre un angle structurellement différent** : la recherche qualitative comme démarche (définition, collecte, méthodes de terrain), pas l'analyse d'un corpus déjà collecté. Le pillar a maintenant une vraie page d'entrée haut-de-funnel qui manquait. Les prochains articles devraient viser des sous-thèmes encore distincts (`codification entretien`, `analyse verbatim`) plutôt que de nouvelles variantes de « comment analyser ».
- ⚠️ **Angle mort du dédoublonnage reproduit une cinquième fois** : le pick automatique du 09/08 était de nouveau `how analyse qualitative data`, le même quasi-doublon identifié le 21/07, le 25/07, le 01/08 et le 05/08. Le correctif d'ingénierie proposé (`pipeline/select-topic.ts`, matching flou) n'a toujours pas été appliqué, donc le check exact sur `targetKeyword` laisse toujours passer cette variante à un mot près. Cette fois, contrairement aux 4 runs précédents, **les 4 PAA du run étaient toutes déjà couvertes** — il ne s'agissait plus de repérer une question PAA non traitée mais de piocher un candidat entièrement différent dans les Propositions du rapport précédent (la page pilier FR « recherche qualitative », déjà identifiée comme meilleur prochain pick). **Le contournement manuel a maintenant produit 5 articles de rattrapage d'affilée** sur ce seul pillar ; les variantes EN restantes (« how do you/we/i analyse ») cannibalisent toutes fortement l'existant et le stock d'angles FR/EN différenciés est en passe de s'épuiser — le correctif de dédoublonnage est désormais **bloquant** pour la suite du cluster, pas seulement une gêne récurrente.
- Le pillar `transcription` reste à **8 articles**, stable depuis le run du 17/07 (non retouché ce run).
- `confidentialite-recherche` (productFit 0.95, 2ᵉ plus haut après `transcription`) reste à **1 seul article** : toujours le gisement le plus clair, à sélectionner manuellement lors d'un prochain run (voir « À faire »).
- `entretien-terrain` reste à **0 article** malgré un productFit correct (0.75).
- ⚠️ **Alerte qualité des données — pillar `these-master`** (toujours ouverte, non revérifiée ce run car le pillar n'a pas été sollicité) : les candidats `which of these is not a transcription skill` et `transcription of these` restent des requêtes anglophones sur le mot « these » (démonstratif), sans rapport avec la « thèse » académique visée par le pillar. **Ne pas utiliser tels quels** — seed à corriger dans `pipeline/seeds/fr.json` avant d'ouvrir ce pillar.
- **DataForSEO stable** : cache `candidates.json` toujours frais (138 mots-clés non utilisés), aucune expansion nécessaire ce run, donc pas de nouveau coût engagé.
- **GSC toujours en échec** (6ᵉ run consécutif) : `"error": "deleted_client", "error_description": "The OAuth client was deleted."` (HTTP 401) — le client OAuth n'a toujours pas été recréé.
- **Reddit toujours en échec 403** sur les 8 subreddits — inchangé depuis le diagnostic du 21/07, voir « À faire ».

## Dernières stratégies

- **Vérification manuelle anti-cannibalisation avant publication** : confirmée nécessaire pour la cinquième fois consécutive (21/07, 25/07, 01/08, 05/08, 09/08), le check de dédoublonnage automatique (exact match sur `targetKeyword`) ne suffit toujours pas. Avant de rédiger, comparer le pick du pipeline aux `targetKeyword` **et** aux titres/PAA des articles existants du même pillar ; en cas de quasi-doublon, choisir un autre candidat de la même liste de scores avec un angle distinct plutôt que d'abandonner le run. En pratique, piocher directement dans la table « Propositions pour la suite » du rapport précédent accélère ce contournement — c'est ce qui a permis de sortir du cycle « how (do) analyse qualitative data » le 01/08 (comparatif logiciels, intent commercial), le 05/08 (question PAA ChatGPT jamais traitée), puis le 09/08 en publiant directement la page pilier FR « recherche qualitative » déjà pré-identifiée dans les Propositions, une fois les 4 PAA du run confirmées toutes déjà couvertes ailleurs.
- **Différenciation d'angle systématique au sein du pillar `transcription`** : `transcription automatique` couvre la précision/méthodologie pour la recherche, `transcription entretien` le workflow d'entretien (verbatim, RGPD), `transcription vocale` la distinction dictée temps réel / transcription différée — trois angles distincts sur un même pillar pour limiter la cannibalisation.
- **Approche par pillars/clusters** toujours pilotée par `pipeline/seeds/fr.json` (6 pillars pondérés par `productFit`), avec des scores DataForSEO à nouveau fiables ce run.
- **Diversification linguistique** au-delà de FR/EN : premiers articles ES et DE sur le pillar `recherche-qualitative`, inchangé depuis la dernière compilation.

## Stratégies prévues

- **Ouvrir le pillar `confidentialite-recherche`** (productFit 0.95, 1 seul article) : `RGPD transcription`, `transcription confidentielle`, `protection données recherche` — toujours le gisement prioritaire, à sélectionner **manuellement** tant qu'il ne remonte pas naturellement dans les picks automatiques.
- **Ouvrir le pillar `entretien-terrain`** (productFit 0.75, 0 article) : `entretien qualitatif`, `guide entretien recherche`, `entretien focus groupe`.
- **Ralentir fortement sur `recherche-qualitative`** côté angle « analyser des données » (8 variantes en comptant questionnaire, entretien, logiciels et IA — saturé) et pivoter vers des sous-thèmes distincts du même pillar (`codification entretien`, `analyse verbatim`) pour continuer à exploiter son productFit sans cannibaliser. La page pilier FR « recherche qualitative » (démarche/collecte) vient d'ouvrir un angle complémentaire à l'analyse — prochain sous-thème FR envisageable : `guide d'entretien qualitatif` ou `échantillonnage qualitatif`, plutôt qu'une nouvelle variante de comparatif ou d'analyse.
- **Corriger le seed `transcription these`** dans `pipeline/seeds/fr.json` avant de rouvrir le pillar `these-master` — les candidats actuels sont inutilisables (voir alerte qualité des données).
- **Fiabiliser le dédoublonnage** (`pipeline/select-topic.ts`) : ajouter un matching flou (normalisation + distance d'édition ou similarité de tokens) en plus du match exact sur `targetKeyword` — priorité maximale après une **cinquième** collision consécutive (21/07, 25/07, 01/08, 05/08, 09/08) sur la même paire de mots-clés quasi identiques ; les variantes restantes (« how do you/we/i analyse... ») garantissent une 6ᵉ collision si non corrigé avant le prochain run, et le pillar `recherche-qualitative` n'a presque plus d'angle de secours différencié à proposer manuellement.
- **Maillage interne** entre les 11 articles du cluster `recherche-qualitative` (EN/FR/ES/DE) et vers les articles `transcription` — le nouvel article « recherche qualitative » lie déjà vers `analyse-qualitative.md` ; envisager aussi un lien retour depuis `analyse-qualitative.md` et `comment-analyser-donnees-qualitatives.md` vers cette nouvelle page pilier (parcours définition → collecte → analyse).

## Propositions pour la suite

Top candidats **non encore publiés**, issus de `pipeline/out/morning-report.md` (run du 2026-08-09, données inchangées depuis le 01/08 — cache DataForSEO stable) :

| Keyword | Vol/mo | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|
| how do we analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do you analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do i analyse qualitative data | 320 | 26 | informational | recherche-qualitative | 8 |
| data analysis in qualitative research example | 110 | 10 | informational | recherche-qualitative | 4.95 |
| ways to analyse qualitative data | 40 | 5 | informational | recherche-qualitative | 2.4 |
| how to analyse qualitative data from interviews | 50 | 20 | informational | recherche-qualitative | 1.5 |
| how to analyse qualitative interview data | 50 | 20 | informational | recherche-qualitative | 1.5 |
| how to analyse qualitative data from an interview | 50 | 20 | informational | recherche-qualitative | 1.5 |
| how to analyse qualitative survey data | 20 | 4 | informational | recherche-qualitative | 1.29 |
| best/software used to analyse qualitative data | 10 | 0 | commercial | recherche-qualitative | 1.26 |
| transcribe audio to text free online | 1900 | 53 | informational | transcription | 30.16 |
| mp3 audio to text converter online free | 260 | 28 | informational | transcription | 6.84 |
| which of these is not a transcription skill | 70 | 0 | informational | these-master | 5.95 |
| transcription of these | 40 | 0 | informational | these-master | 3.4 |
| transcribe audio to text free online google | 170 | 53 | informational | transcription | 2.7 |
| transcription audio en texte | 140 | 60 | informational | transcription | 2 |
| logiciel pour retranscrire un enregistrement audio | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription audio en texte gratuit | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription audio en texte | 10 | 0 | transactional | transcription | 1.5 |

Note : cette table remonte plusieurs mots-clés **déjà publiés** avec un score recalculé (`data analysis in qualitative research example`, `how to analyse qualitative interview data`, `how to analyse qualitative survey data`, `best software to analyse qualitative data`, `transcribe audio to text free online`, `mp3 audio to text converter online free`, `logiciel de transcription` — le dédoublonnage exact les laisse remonter car DataForSEO les rescore sans que le pipeline filtre par ces variantes). **Ne pas les republier** — comptés ici uniquement pour mémoire, retirer manuellement avant de piocher.

Pistes complémentaires :
- Les variantes « how do you/we/i analyse qualitative data » ci-dessus **cannibalisent fortement** `analyse-qualitative-data.md` (même intention de recherche) : à éviter en l'état, sauf angle très différencié.
- `recherche qualitative` et les 5 requêtes FR apparentées (`recherche qualitative et quantitative`, `méthodes de recherche qualitative`, `recherche qualitative définition`, `exemple de recherche qualitative`, `introduction à la recherche qualitative`) ont été **publiées le 09/08** en un seul article pilier (voir table de production) — retirées de cette liste.
- `transcribe audio to text free online` et ses variantes sont **déjà publiées** (`transcribe-audio-to-text-free-online.md`, `mp3-audio-to-text-converter-online-free.md`) malgré leur score élevé dans la table — confirmer que le dédoublonnage les a bien reconnues avant tout nouveau pick sur ce pillar.
- `transcription audio en texte` (140/mo, KD 60) est plus concurrentiel que les picks habituels (KD 0-22) — à évaluer avant de le prioriser. Distinct de `transcription-vocale.md` (dictée temps réel vs différée) : l'angle « audio en texte » resterait à couvrir si le KD est jugé acceptable.
- ⚠️ Les candidats `which of these is not a transcription skill` et `transcription of these` (pillar `these-master`) restent inutilisables tels quels — voir alerte qualité des données ci-dessus, ne pas les piocher avant correction du seed.
- Prioriser le pillar `confidentialite-recherche` même sans candidat DataForSEO listé ici : les seeds (`RGPD transcription`, `transcription confidentielle`) n'ont pas encore été passés dans une expansion récente pour ce pillar spécifiquement.
- Le pillar `recherche-qualitative` a maintenant épuisé ses candidats FR à faible KD dans le pool actuel — la prochaine expansion DataForSEO devrait cibler de nouveaux seeds FR (`guide d'entretien qualitatif`, `échantillonnage qualitatif`, `codification qualitative`) plutôt que de nouvelles variantes de « analyser ».

## À faire par Romaric

- [x] ~~Configurer DataForSEO~~ — **fait** : le secret `DATAFORSEO_BASE64` est actif.
- [x] ~~Relever le plafond de coût quotidien DataForSEO~~ — **confirmé résolu** : le run du 25/07 a de nouveau utilisé le cache sans erreur de quota (pas d'expansion nécessaire, ≥20 mots-clés non utilisés). `transcription automatique` et `transcription vocale` (publiés sans données faute de quota à l'époque) restent à rescorer a posteriori si besoin, mais ce n'est plus bloquant.
- [ ] ⚠️ **Recréer le client OAuth Google Search Console** (toujours ouvert depuis le 13/07, confirmé en échec pour la 7ᵉ fois le 09/08) : le token renvoie `"error": "deleted_client", "error_description": "The OAuth client was deleted."` (HTTP 401) — le client OAuth associé au service account a été supprimé côté Google Cloud Console. Il faut regénérer des identifiants (nouveau service account ou nouveau client OAuth) et remplacer le secret `GOOGLE_JSON`.
  1. Créer/récupérer un **service account Google** (scope `webmasters.readonly`) et l'ajouter comme utilisateur en lecture sur la propriété GSC du domaine.
  2. Ajouter les secrets GitHub `GOOGLE_JSON` (clé JSON du service account) et `GSC_SITE_URL` (URL exacte de la propriété, ex. `https://humanlogs.app/` ou `sc-domain:humanlogs.app`).
  3. Relancer **SEO research** : l'étape GSC ne renverra plus d'erreur et les données de perf remonteront.
- [ ] ⚠️ **Vérifier les identifiants Reddit** (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`) : toujours en **erreur 403** explicite sur les 8 subreddits au run du 09/08 (page HTML de blocage « log in to continue »), inchangé depuis le diagnostic du 21/07 — ce n'est donc probablement pas une absence de contenu mais un accès non authentifié bloqué par Reddit. Les secrets ne sont toujours pas renseignés (`[reddit] REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set` dans les logs) ; le pipeline retombe sur le endpoint JSON public, bloqué par Reddit. Il faut créer une app OAuth Reddit et ajouter les deux secrets GitHub.
- [ ] Valider l'**ordre de priorité** des prochains pillars (proposé : `confidentialite-recherche` puis `entretien-terrain`) — envisager de sélectionner ces mots-clés manuellement pour le prochain run si le pipeline continue de proposer des variantes `recherche-qualitative`/`transcription`.
- [x] ~~Trancher si un article comparatif logiciels QDA (NVivo/Atlas.ti/MAXQDA/Taguette, intent commercial) a sa place dans la ligne éditoriale~~ — **tranché le 01/08** : publié (`best-software-to-analyse-qualitative-data.md`). Positionnement retenu : HumanLogs n'est pas un logiciel QDA, l'article compare NVivo/ATLAS.ti/MAXQDA/Delve/Dovetail/Taguette factuellement et positionne le produit comme l'étape de transcription en amont (exports PDF/Word/CSV/TXT compatibles), sans dénigrer les outils comparés.
- [ ] Corriger le seed `transcription these` → `transcription de thèse doctorat` dans `pipeline/seeds/fr.json` (voir alerte qualité des données ci-dessus) avant de rouvrir le pillar `these-master`.
- [ ] ⚠️ **Fiabiliser le dédoublonnage du pipeline** (`pipeline/select-topic.ts`) — **priorité maximale, 5ᵉ occurrence** : le run du 09/08 a recommandé pour la cinquième fois le même quasi-doublon (`how analyse qualitative data` vs `how to analyse qualitative data` déjà publié le 27/06), déjà signalé le 21/07, le 25/07, le 01/08 et le 05/08, jamais corrigé depuis. Cinq collisions consécutives sur la même paire de mots-clés confirment que ce n'est plus un cas isolé mais un défaut structurel ; les variantes restantes (« how do you/we/i analyse ») rendent une 6ᵉ collision quasi certaine au prochain run, et le contournement manuel commence à manquer d'angles de secours différenciés sur ce pillar. Ajouter une comparaison floue (normalisation, distance d'édition ou tokens communs) en plus du match exact sur `targetKeyword`.
- [x] ~~Trancher l'angle « IA/ChatGPT dans l'analyse qualitative » (question PAA récurrente jamais traitée)~~ — **tranché le 05/08** : publié (`using-ai-to-analyse-qualitative-data.md`). Positionnement retenu : ce que l'IA peut/ne peut pas remplacer dans le codage qualitatif, avec un focus confidentialité (ne pas coller de verbatims dans un chatbot grand public) relié au chiffrement de bout en bout de HumanLogs.
- [x] ~~Publier la page pilier FR « qu'est-ce que la recherche qualitative » (6 requêtes FR à faible volume identifiées comme socle commun)~~ — **tranché le 09/08** : publié (`recherche-qualitative.md`). Positionnement retenu : la recherche qualitative comme démarche (définition, collecte, comparaison avec le quantitatif, méthodes de terrain), distincte des articles existants centrés sur l'analyse d'un corpus déjà collecté, avec liens vers `analyse-qualitative.md`.

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| 2026-08-09 | recherche qualitative (pick automatique écarté : quasi-doublon "how analyse qualitative data", 5ᵉ collision consécutive après le 21/07, le 25/07, le 01/08 et le 05/08 — cette fois les 4 PAA du run étaient toutes déjà couvertes, page pilier FR publiée à la place) | 0.9 | Oui |
| 2026-08-05 | using ai to analyse qualitative data (pick automatique écarté : quasi-doublon "how analyse qualitative data", 4ᵉ collision consécutive après le 21/07, le 25/07 et le 01/08) | 0.9 | Oui |
| 2026-08-01 | best software to analyse qualitative data (pick automatique écarté : quasi-doublon "how analyse qualitative data", 3ᵉ collision consécutive après le 21/07 et le 25/07) | 1.26 | Oui |
| 2026-07-25 | how to analyse qualitative interview data (pick automatique écarté : quasi-doublon "how analyse qualitative data", même collision que le 21/07) | 2.81 | Oui |
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
