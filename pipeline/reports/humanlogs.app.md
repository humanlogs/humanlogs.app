_Dernière compilation : 2026-08-13 · 23 articles publiés · DataForSEO **stable** (cache réutilisé, expansion non nécessaire) · GSC **toujours cassé** (`deleted_client`, HTTP 401, inchangé, 8ᵉ run) · Reddit **toujours en 403** sur les 8 subreddits (inchangé, `REDDIT_CLIENT_ID`/`SECRET` toujours absents → fallback JSON public bloqué)._

## Résumé des chiffres et analyse

**Production de contenu**
- **23 articles publiés** entre le 2026-05-20 et le 2026-08-13 (10 en FR, 11 en EN, 1 en ES, 1 en DE).
- **1 nouvel article le 13/08.** Le run a de nouveau utilisé le cache `candidates.json`, pas d'expansion DataForSEO nécessaire.
- ⚠️ **Le pick automatique du run du 13/08 a été écarté pour cause de cannibalisation** : le pipeline a recommandé `logiciel pour retranscrire un enregistrement audio` (vol 10, KD 0, score 1.5, pillar `transcription`, intent transactionnel). Ce n'est pas un quasi-doublon exact (le check `targetKeyword` ne l'a donc pas filtré), mais l'intention de recherche recoupe très fortement deux articles déjà publiés sur le même pillar : `logiciel-de-transcription.md` (guide d'achat, critères de choix d'un logiciel de transcription) et `retranscrire-audio.md` (comparatif des méthodes pour retranscrire un audio). Les 6 autres candidats remontés ce run sur le pillar `transcription` sont eux aussi des quasi-doublons de pages déjà publiées (voir « Propositions pour la suite »), et aucun candidat n'existait sur un autre pillar (« No candidates found »). **Publié à la place** le premier article du pillar `confidentialite-recherche` en français : `transcription confidentielle` (RGPD, sous-traitance, checklist avant de choisir un outil), un gisement identifié comme prioritaire dans les 3 derniers rapports faute de scoring DataForSEO disponible pour ce pillar. Angle : ce que dit le RGPD sur la transcription d'entretiens (catégories particulières de données, sous-traitance article 28), les risques concrets d'un outil mal configuré, une checklist en 8 points, et des bonnes pratiques (pseudonymisation, suppression de l'audio) — distinct des sections confidentialité déjà présentes dans `logiciel-de-transcription.md` et `retranscrire-audio.md`, qui n'en font qu'un sous-point parmi d'autres critères. Lien ajouté depuis `logiciel-de-transcription.md` vers ce nouvel article.
- **GSC toujours cassé** : même erreur `deleted_client` (HTTP 401) — le client OAuth n'a toujours pas été recréé (voir « À faire », inchangé depuis le 13/07, 8ᵉ run consécutif en échec).
- **Reddit toujours en échec 403** sur les 8 subreddits (fallback JSON public bloqué, pas de `REDDIT_CLIENT_ID`/`SECRET`) — inchangé depuis le 21/07, voir « À faire ». **0 posts** remontés ce run (comme attendu vu le blocage), donc aucun insight Reddit disponible pour cet article — rédigé sans retour terrain, uniquement à partir des exigences RGPD documentées.
- Les articles publiés **avant** la bascule DataForSEO (7 premiers, jusqu'au 17 juin) restent sans données historiques — DataForSEO ne rescore pas rétroactivement, donc leurs colonnes Vol/KD/Score restent à `—` sauf pour `logiciel de transcription` retrouvé dans le cache actuel.

| Date | Keyword | Vol/mo | KD | Score | Pillar | Article |
|---|---|---|---|---|---|---|
| 2026-08-13 | transcription confidentielle | — (hors scoring DataForSEO ce run) | — | — | confidentialite-recherche | [transcription-confidentielle](/fr/blog/transcription-confidentielle) |
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
- `recherche-qualitative` (productFit 0.9) : **11 articles** — pillar le plus couvert (FR + EN + ES + DE sur l'angle « analyser des données qualitatives », un angle « exemple concret d'analyse », un angle « données de questionnaire », un angle « données d'entretien », un angle « comparatif logiciels » intent commercial, un angle « IA/ChatGPT dans l'analyse qualitative », et une page pilier FR « qu'est-ce que la recherche qualitative » centrée sur la démarche/collecte plutôt que l'analyse). Tête de cluster à haut volume (`analyse qualitative` : 2400/mo, score 216) déjà traitée. Non retouché ce run.
- `transcription` (productFit 1.0) : **8 articles** — toujours le pillar le plus rempli (`logiciel de transcription`, `transcription entretien`, `retranscrire audio`, comparatif outils IA, `transcribe audio to text free online`, `mp3 audio to text converter online free`, `transcription automatique`, `transcription vocale`). **Le pick automatique du 13/08 est tombé sur ce pillar mais a été écarté pour cannibalisation** — voir alerte ci-dessous. Considéré comme saturé sur les angles génériques « logiciel »/« méthode » à faible volume ; tout nouveau candidat de ce pillar doit désormais être vérifié contre `logiciel-de-transcription.md` et `retranscrire-audio.md`, pas seulement contre le `targetKeyword` exact.
- `confidentialite-recherche` (0.95) : **2 articles** (checklist IRB/RGPD en EN, et désormais `transcription confidentielle` en FR sur le RGPD et la sous-traitance) — pillar rouvert après 3 runs consécutifs de stagnation, toujours sans scoring DataForSEO propre (sélection manuelle sur les seeds).
- `these-master` (0.85) : **1 article** (entretien semi-directif doctorants) — voir alerte qualité des données ci-dessous.
- `productivite-recherche` (0.8) : **1 article** (transcrire plus vite).
- `entretien-terrain` (0.75) : **0 article.**

**Analyse**
- Le pillar `recherche-qualitative` reste à **11 articles**, non sollicité ce run (le pick automatique du 13/08 portait sur le pillar `transcription`). L'angle « analyser des données qualitatives » reste saturé ; prochains sous-thèmes envisageables inchangés (`codification entretien`, `analyse verbatim`).
- ⚠️ **Nouvelle forme de cannibalisation détectée, cette fois hors du pillar `recherche-qualitative` : le pillar `transcription` est en train de s'épuiser aussi.** Le pick automatique du 13/08 (`logiciel pour retranscrire un enregistrement audio`) n'était pas un quasi-doublon au sens du dédoublonnage exact (`targetKeyword` différent mot pour mot), mais recoupait la même intention de recherche que deux articles déjà publiés (`logiciel-de-transcription.md`, `retranscrire-audio.md`). Les 6 autres candidats remontés ce run sur ce pillar (`logiciel de transcription audio en texte`, `logiciel de transcription audio en texte gratuit`, `application transcription vocale`, `meilleur logiciel de transcription audio en texte`, `transcription d'un entretien`, `transcription automatique audio en texte`) sont tous des reformulations proches de pages existantes — le correctif de matching flou déjà réclamé pour `recherche-qualitative` (voir « À faire ») réduirait aussi ce risque ici, la logique de collision n'est pas spécifique à un seul pillar.
- Le pillar `transcription` reste à **8 articles** ; à considérer comme largement couvert sur les angles génériques (« logiciel », « méthode », « comparatif ») — tout nouveau pick sur ce pillar doit chercher un angle non couvert (ex. un cas d'usage spécifique, un format de fichier, un secteur) plutôt qu'une reformulation de « logiciel de transcription ».
- `confidentialite-recherche` (productFit 0.95, 2ᵉ plus haut après `transcription`) passe à **2 articles** avec la publication du 13/08 — premier article FR du pillar, ouvre un gisement resté à 1 seul article pendant 3 rapports consécutifs. `entretien-terrain` reste le seul pillar à 0 article : prochaine priorité manuelle logique.
- `entretien-terrain` reste à **0 article** malgré un productFit correct (0.75).
- ⚠️ **Alerte qualité des données — pillar `these-master`** (toujours ouverte, non revérifiée ce run car le pillar n'a pas été sollicité) : les candidats `which of these is not a transcription skill` et `transcription of these` restent des requêtes anglophones sur le mot « these » (démonstratif), sans rapport avec la « thèse » académique visée par le pillar. **Ne pas utiliser tels quels** — seed à corriger dans `pipeline/seeds/fr.json` avant d'ouvrir ce pillar.
- **DataForSEO stable** : cache `candidates.json` toujours frais (138 mots-clés non utilisés), aucune expansion nécessaire ce run, donc pas de nouveau coût engagé.
- **GSC toujours en échec** (8ᵉ run consécutif) : `"error": "deleted_client", "error_description": "The OAuth client was deleted."` (HTTP 401) — le client OAuth n'a toujours pas été recréé.
- **Reddit toujours en échec 403** sur les 8 subreddits — inchangé depuis le diagnostic du 21/07, voir « À faire ».

## Dernières stratégies

- **Vérification manuelle anti-cannibalisation avant publication** : confirmée nécessaire pour la sixième fois consécutive (21/07, 25/07, 01/08, 05/08, 09/08, 13/08), le check de dédoublonnage automatique (exact match sur `targetKeyword`) ne suffit toujours pas. Avant de rédiger, comparer le pick du pipeline aux `targetKeyword` **et** aux titres/PAA des articles existants du même pillar ; en cas de quasi-doublon, choisir un autre candidat de la même liste de scores avec un angle distinct plutôt que d'abandonner le run. En pratique, piocher directement dans la table « Propositions pour la suite » du rapport précédent accélère ce contournement — c'est ce qui a permis de sortir du cycle « how (do) analyse qualitative data » le 01/08, le 05/08, puis le 09/08 sur le pillar `recherche-qualitative`, et de sortir du pick « logiciel pour retranscrire un enregistrement audio » le 13/08 en publiant directement le pillar `confidentialite-recherche` déjà pré-identifié comme prioritaire dans les trois rapports précédents.
- **Le risque de cannibalisation ne se limite pas aux quasi-doublons de `targetKeyword`** : le pick du 13/08 avait un `targetKeyword` distinct au mot près mais recoupait la même intention de recherche que deux pages déjà publiées sur le même pillar. La vérification manuelle doit donc comparer l'**intention de recherche** (ce que la page répond), pas seulement la chaîne de caractères du mot-clé.
- **Différenciation d'angle systématique au sein du pillar `transcription`** : `transcription automatique` couvre la précision/méthodologie pour la recherche, `transcription entretien` le workflow d'entretien (verbatim, RGPD), `transcription vocale` la distinction dictée temps réel / transcription différée — trois angles distincts sur un même pillar pour limiter la cannibalisation.
- **Approche par pillars/clusters** toujours pilotée par `pipeline/seeds/fr.json` (6 pillars pondérés par `productFit`), avec des scores DataForSEO à nouveau fiables ce run.
- **Diversification linguistique** au-delà de FR/EN : premiers articles ES et DE sur le pillar `recherche-qualitative`, inchangé depuis la dernière compilation.

## Stratégies prévues

- **Poursuivre le pillar `confidentialite-recherche`** (productFit 0.95, 2 articles depuis le 13/08) : seeds restants `protection données recherche`, `confidentialité entretien recherche`, `données qualitatives RGPD`, `hébergement données France recherche` — toujours à sélectionner **manuellement** tant qu'il ne remonte pas naturellement dans les picks automatiques (aucune donnée DataForSEO scorée pour ce pillar à ce jour).
- **Ouvrir le pillar `entretien-terrain`** (productFit 0.75, 0 article) : `entretien qualitatif`, `guide entretien recherche`, `entretien focus groupe` — devient la priorité manuelle suivante, seul pillar encore à 0 article.
- **Marquer le pillar `transcription` comme à angle-mort sur les reformulations génériques** : ne plus piocher de candidat « logiciel de transcription... » ou « retranscrire... » sans vérifier explicitement contre `logiciel-de-transcription.md` et `retranscrire-audio.md`, même si le `targetKeyword` diffère du mot-clé exact déjà publié.
- **Ralentir fortement sur `recherche-qualitative`** côté angle « analyser des données » (8 variantes en comptant questionnaire, entretien, logiciels et IA — saturé) et pivoter vers des sous-thèmes distincts du même pillar (`codification entretien`, `analyse verbatim`) pour continuer à exploiter son productFit sans cannibaliser. La page pilier FR « recherche qualitative » (démarche/collecte) vient d'ouvrir un angle complémentaire à l'analyse — prochain sous-thème FR envisageable : `guide d'entretien qualitatif` ou `échantillonnage qualitatif`, plutôt qu'une nouvelle variante de comparatif ou d'analyse.
- **Corriger le seed `transcription these`** dans `pipeline/seeds/fr.json` avant de rouvrir le pillar `these-master` — les candidats actuels sont inutilisables (voir alerte qualité des données).
- **Fiabiliser le dédoublonnage** (`pipeline/select-topic.ts`) : ajouter un matching flou (normalisation + distance d'édition ou similarité de tokens) en plus du match exact sur `targetKeyword` — priorité maximale après une **sixième** collision consécutive (21/07, 25/07, 01/08, 05/08, 09/08, 13/08) sur la même paire de mots-clés quasi identiques ; les variantes restantes (« how do you/we/i analyse... ») garantissent une 7ᵉ collision si non corrigé avant le prochain run sur `recherche-qualitative`, et le pillar `transcription` montre désormais le même symptôme (13/08) sur une paire de mots-clés différente. Le correctif doit couvrir les deux pillars, pas un cas isolé.
- **Maillage interne** entre les 11 articles du cluster `recherche-qualitative` (EN/FR/ES/DE) et vers les articles `transcription` — le nouvel article « recherche qualitative » lie déjà vers `analyse-qualitative.md` ; envisager aussi un lien retour depuis `analyse-qualitative.md` et `comment-analyser-donnees-qualitatives.md` vers cette nouvelle page pilier (parcours définition → collecte → analyse).

## Propositions pour la suite

Top candidats **non encore publiés**, issus de `pipeline/out/morning-report.md` (run du 2026-08-13, cache DataForSEO stable — pool `recherche-qualitative` inchangé depuis le 01/08, pool `transcription` mis à jour ce run) :

| Keyword | Vol/mo | KD | Intent | Pillar | Score |
|---|---|---|---|---|---|
| how do we analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do you analyse qualitative data | 320 | 5 | informational | recherche-qualitative | 19.2 |
| how do i analyse qualitative data | 320 | 26 | informational | recherche-qualitative | 8 |
| ways to analyse qualitative data | 40 | 5 | informational | recherche-qualitative | 2.4 |
| which of these is not a transcription skill | 70 | 0 | informational | these-master | 5.95 |
| transcription of these | 40 | 0 | informational | these-master | 3.4 |
| transcription audio en texte | 140 | 60 | informational | transcription | 2 |
| meilleur logiciel de transcription audio en texte | 10 | 0 | commercial | transcription | 1.4 |
| logiciel pour retranscrire un enregistrement audio | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription audio en texte gratuit | 10 | 0 | transactional | transcription | 1.5 |
| logiciel de transcription audio en texte | 10 | 0 | transactional | transcription | 1.5 |
| application transcription vocale | 10 | 0 | transactional | transcription | 1.5 |
| transcription d'un entretien | 10 | 0 | informational | transcription | 1 |
| transcription automatique audio en texte | 10 | 0 | informational | transcription | 1 |

Note : cette table exclut désormais les mots-clés déjà publiés qui continuaient à remonter dans le pool brut (`data analysis in qualitative research example`, `how to analyse qualitative interview data`, `how to analyse qualitative survey data`, `best software to analyse qualitative data`, `transcribe audio to text free online`, `mp3 audio to text converter online free`, `logiciel de transcription`) — retirés manuellement ici, le dédoublonnage automatique ne les filtre toujours pas.

Pistes complémentaires :
- Les variantes « how do you/we/i analyse qualitative data » ci-dessus **cannibalisent fortement** `analyse-qualitative-data.md` (même intention de recherche) : à éviter en l'état, sauf angle très différencié.
- ⚠️ **Tout le reste du pool `transcription` ci-dessus (`logiciel pour retranscrire un enregistrement audio`, `logiciel de transcription audio en texte [gratuit]`, `application transcription vocale`, `meilleur logiciel de transcription audio en texte`, `transcription d'un entretien`, `transcription automatique audio en texte`) cannibalise `logiciel-de-transcription.md`, `retranscrire-audio.md`, `transcription-entretien.md` ou `transcription-automatique.md`** — même intention de recherche malgré un `targetKeyword` différent. Ne piocher dans ce pool qu'avec un angle explicitement différencié (cas d'usage précis, format de fichier, secteur) et une vérification manuelle contre le titre **et** le contenu de la page existante la plus proche, pas seulement le `targetKeyword`.
- `transcription audio en texte` (140/mo, KD 60) reste plus concurrentiel que les picks habituels (KD 0-22) et cannibalise probablement `transcription-automatique.md` (angle « automatique ») — à évaluer avant de le prioriser.
- ⚠️ Les candidats `which of these is not a transcription skill` et `transcription of these` (pillar `these-master`) restent inutilisables tels quels — voir alerte qualité des données ci-dessus, ne pas les piocher avant correction du seed.
- **`confidentialite-recherche` publié une première fois en FR le 13/08** (`transcription-confidentielle.md`) : seeds restants à explorer sans données DataForSEO — `protection données recherche`, `confidentialité entretien recherche`, `données qualitatives RGPD`, `hébergement données France recherche`.
- **`entretien-terrain` est désormais le seul pillar à 0 article** (productFit 0.75, sans candidat DataForSEO listé) : prochaine priorité manuelle logique — seeds `entretien qualitatif`, `guide entretien recherche`, `entretien focus groupe`.
- Le pillar `recherche-qualitative` a épuisé ses candidats FR à faible KD dans le pool actuel — la prochaine expansion DataForSEO devrait cibler de nouveaux seeds FR (`guide d'entretien qualitatif`, `échantillonnage qualitatif`, `codification qualitative`) plutôt que de nouvelles variantes de « analyser ».

## À faire par Romaric

- [x] ~~Configurer DataForSEO~~ — **fait** : le secret `DATAFORSEO_BASE64` est actif.
- [x] ~~Relever le plafond de coût quotidien DataForSEO~~ — **confirmé résolu** : le run du 25/07 a de nouveau utilisé le cache sans erreur de quota (pas d'expansion nécessaire, ≥20 mots-clés non utilisés). `transcription automatique` et `transcription vocale` (publiés sans données faute de quota à l'époque) restent à rescorer a posteriori si besoin, mais ce n'est plus bloquant.
- [ ] ⚠️ **Recréer le client OAuth Google Search Console** (toujours ouvert depuis le 13/07, confirmé en échec pour la 8ᵉ fois le 13/08) : le token renvoie `"error": "deleted_client", "error_description": "The OAuth client was deleted."` (HTTP 401) — le client OAuth associé au service account a été supprimé côté Google Cloud Console. Il faut regénérer des identifiants (nouveau service account ou nouveau client OAuth) et remplacer le secret `GOOGLE_JSON`.
  1. Créer/récupérer un **service account Google** (scope `webmasters.readonly`) et l'ajouter comme utilisateur en lecture sur la propriété GSC du domaine.
  2. Ajouter les secrets GitHub `GOOGLE_JSON` (clé JSON du service account) et `GSC_SITE_URL` (URL exacte de la propriété, ex. `https://humanlogs.app/` ou `sc-domain:humanlogs.app`).
  3. Relancer **SEO research** : l'étape GSC ne renverra plus d'erreur et les données de perf remonteront.
- [ ] ⚠️ **Vérifier les identifiants Reddit** (`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`) : toujours en **erreur 403** explicite sur les 8 subreddits au run du 13/08 (page HTML de blocage « log in to continue »), inchangé depuis le diagnostic du 21/07 — ce n'est donc probablement pas une absence de contenu mais un accès non authentifié bloqué par Reddit. Les secrets ne sont toujours pas renseignés (`[reddit] REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set` dans les logs) ; le pipeline retombe sur le endpoint JSON public, bloqué par Reddit. Il faut créer une app OAuth Reddit et ajouter les deux secrets GitHub.
- [x] ~~Valider l'ordre de priorité des prochains pillars (proposé : `confidentialite-recherche` puis `entretien-terrain`)~~ — **tranché le 13/08** : `confidentialite-recherche` ouvert en FR (`transcription-confidentielle.md`). `entretien-terrain` devient la prochaine priorité manuelle, seul pillar encore à 0 article.
- [x] ~~Trancher si un article comparatif logiciels QDA (NVivo/Atlas.ti/MAXQDA/Taguette, intent commercial) a sa place dans la ligne éditoriale~~ — **tranché le 01/08** : publié (`best-software-to-analyse-qualitative-data.md`). Positionnement retenu : HumanLogs n'est pas un logiciel QDA, l'article compare NVivo/ATLAS.ti/MAXQDA/Delve/Dovetail/Taguette factuellement et positionne le produit comme l'étape de transcription en amont (exports PDF/Word/CSV/TXT compatibles), sans dénigrer les outils comparés.
- [ ] Corriger le seed `transcription these` → `transcription de thèse doctorat` dans `pipeline/seeds/fr.json` (voir alerte qualité des données ci-dessus) avant de rouvrir le pillar `these-master`.
- [ ] ⚠️ **Fiabiliser le dédoublonnage du pipeline** (`pipeline/select-topic.ts`) — **priorité maximale, 6ᵉ occurrence, maintenant sur deux pillars distincts** : le run du 09/08 a recommandé pour la cinquième fois le même quasi-doublon sur `recherche-qualitative` (`how analyse qualitative data` vs `how to analyse qualitative data` déjà publié le 27/06), déjà signalé le 21/07, le 25/07, le 01/08 et le 05/08. Le run du 13/08 a recommandé un pick sur `transcription` (`logiciel pour retranscrire un enregistrement audio`) qui ne matchait aucun `targetKeyword` exact mais cannibalisait `logiciel-de-transcription.md`/`retranscrire-audio.md` en intention de recherche — le problème n'est donc plus limité à un seul pillar ni à des variantes lexicales évidentes. Ajouter une comparaison floue (normalisation, distance d'édition ou similarité de tokens) en plus du match exact sur `targetKeyword` reste nécessaire mais ne suffira pas seul pour le cas du 13/08 ; envisager aussi une comparaison contre les titres/headings des articles existants du même pillar, pas seulement leur `targetKeyword`.
- [x] ~~Trancher l'angle « IA/ChatGPT dans l'analyse qualitative » (question PAA récurrente jamais traitée)~~ — **tranché le 05/08** : publié (`using-ai-to-analyse-qualitative-data.md`). Positionnement retenu : ce que l'IA peut/ne peut pas remplacer dans le codage qualitatif, avec un focus confidentialité (ne pas coller de verbatims dans un chatbot grand public) relié au chiffrement de bout en bout de HumanLogs.
- [x] ~~Publier la page pilier FR « qu'est-ce que la recherche qualitative » (6 requêtes FR à faible volume identifiées comme socle commun)~~ — **tranché le 09/08** : publié (`recherche-qualitative.md`). Positionnement retenu : la recherche qualitative comme démarche (définition, collecte, comparaison avec le quantitatif, méthodes de terrain), distincte des articles existants centrés sur l'analyse d'un corpus déjà collecté, avec liens vers `analyse-qualitative.md`.
- [x] ~~Ouvrir le pillar `confidentialite-recherche` en français (RGPD, transcription confidentielle)~~ — **tranché le 13/08** : publié (`transcription-confidentielle.md`). Positionnement retenu : ce que dit le RGPD sur la transcription d'entretiens (catégories particulières de données, sous-traitance article 28), risques d'un outil mal configuré, checklist en 8 points, bonnes pratiques — distinct des mentions confidentialité déjà présentes en sous-section dans `logiciel-de-transcription.md` et `retranscrire-audio.md`, vers lesquels il renvoie (lien ajouté depuis `logiciel-de-transcription.md`).

## Historique des runs

| Date | Keyword sélectionné | Score | Publié ? |
|---|---|---|---|
| 2026-08-13 | transcription confidentielle (pick automatique écarté : "logiciel pour retranscrire un enregistrement audio" cannibalisait `logiciel-de-transcription.md`/`retranscrire-audio.md` malgré un targetKeyword distinct — pillar `confidentialite-recherche` ouvert en FR à la place, prioritaire depuis 3 rapports) | — (hors scoring DataForSEO) | Oui |
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
