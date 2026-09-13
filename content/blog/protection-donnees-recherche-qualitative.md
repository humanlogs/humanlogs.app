---
title: "Protection des données de recherche : base légale, droits, durée"
date: "2026-09-13"
description: "RGPD et entretiens de recherche : quelle base légale utiliser, quels droits gardent les participants, et combien de temps conserver l'audio et la transcription."
locale: "fr"
author: "HumanLogs Team"
tags: ["confidentialite-recherche", "rgpd", "recherche-qualitative"]
targetKeyword: "protection données recherche"
pillar: "confidentialite-recherche"
---

Vous savez que le RGPD s'applique à vos entretiens de recherche. Mais trois questions reviennent presque à chaque protocole : sur quelle base légale traiter ces données si le consentement seul semble fragile, quels droits un participant garde-t-il une fois l'entretien enregistré, et pendant combien de temps avez-vous le droit de conserver l'audio, la transcription et les données anonymisées. Ce sont ces trois points-là, souvent traités par approximation, que couvre cet article.

## Le consentement n'est pas toujours la bonne base légale

Le réflexe est de faire signer un formulaire de consentement et de considérer le sujet clos. Mais le RGPD prévoit une autre base légale, souvent plus adaptée à la recherche : l'**article 89**, qui encadre le traitement de données à des fins de recherche scientifique.

La différence compte concrètement. Un consentement au sens RGPD doit pouvoir être retiré à tout moment, et son retrait doit normalement entraîner l'arrêt du traitement, voire la suppression des données déjà collectées. Or une étude longitudinale ou une thèse qui s'appuie sur un corpus d'entretiens ne peut pas se permettre de perdre une partie de ses données trois ans après la collecte parce qu'un participant a changé d'avis. Dans ce cas, s'appuyer sur l'intérêt public de la recherche scientifique (article 89, combiné le plus souvent à l'article 6.1.e ou 6.1.f du RGPD) plutôt que sur le seul consentement offre une base plus stable, à condition de prévoir des garanties : minimisation des données, pseudonymisation dès que possible, et information claire du participant même en l'absence de consentement révocable.

Ce choix se documente dans le protocole de recherche, généralement validé par un comité d'éthique ou une IRB. Il ne dispense pas d'informer le participant ; il change simplement ce que ce dernier peut exiger ensuite (voir la section suivante).

## Ce que les participants peuvent réellement exiger après l'entretien

Un participant à une étude qualitative garde des droits sur ses données, mais leur portée dépend de la base légale retenue.

**Si vous vous appuyez sur le consentement** : le participant peut le retirer à tout moment, et vous devez alors cesser le traitement et supprimer les données qui ne sont pas déjà anonymisées ou publiées dans un résultat agrégé.

**Si vous vous appuyez sur l'intérêt de la recherche scientifique (article 89)** : le RGPD autorise à limiter certains droits - notamment le droit à l'effacement et le droit d'opposition - lorsque leur exercice rendrait impossible ou compromettrait sérieusement la réalisation des objectifs de la recherche. Cette limitation doit être proportionnée et documentée ; elle ne dispense pas de répondre aux demandes d'accès et de rectification, qui restent quasiment toujours applicables.

Dans les deux cas, un participant peut demander à voir sa transcription, à corriger une erreur de retranscription qui le concerne, ou à savoir qui a eu accès à l'enregistrement. Le formulaire de consentement doit indiquer clairement quels droits s'appliquent et comment les exercer - un point que nous détaillons aussi dans notre [article sur l'anonymisation des entretiens](/fr/blog/confidentialite-entretien-recherche).

## Combien de temps conserver l'audio, la transcription et les données anonymisées

Le RGPD n'impose pas une durée fixe : il impose une durée **proportionnée à la finalité**, documentée à l'avance. En pratique, trois strates de données appellent des règles différentes.

| Type de donnée | Durée typique | Justification |
| --- | --- | --- |
| Audio brut (voix identifiable) | Jusqu'à la fin de la vérification de la transcription, puis suppression ou archivage sécurisé si besoin méthodologique documenté | Contient l'identifiant le plus sensible : la voix |
| Transcription non anonymisée | Durée du projet de recherche, généralement 3 à 5 ans pour une thèse | Nécessaire à l'analyse et à la publication |
| Données anonymisées (verbatims sans identifiant) | Conservation longue possible, y compris au-delà du projet | L'anonymisation véritable sort la donnée du champ du RGPD |

Le point de friction habituel : beaucoup d'équipes conservent l'audio brut par prudence "au cas où", bien après la fin de la vérification. C'est le scénario le plus risqué en cas de contrôle ou de fuite, puisque c'est la donnée la plus identifiante. La bonne pratique est de fixer la durée de conservation de l'audio brut dans le protocole, de la justifier (par exemple : nécessité de recontrôler un passage ambigu de la transcription), et de programmer sa suppression plutôt que de la reporter indéfiniment.

## Checklist avant de lancer la collecte

- La base légale (consentement ou article 89) est choisie et documentée dans le protocole, pas seulement mentionnée dans le formulaire.
- Le formulaire de consentement précise les droits qui s'appliquent réellement compte tenu de cette base légale.
- Une durée de conservation distincte est fixée pour l'audio brut, la transcription et la version anonymisée.
- Une procédure existe pour répondre à une demande d'accès ou de rectification d'un participant, même si le droit à l'effacement est limité.
- La suppression de l'audio brut est programmée, pas laissée à la discrétion de chaque chercheur.

## HumanLogs : des durées de conservation que vous contrôlez

Ces règles ne servent à rien si l'outil de transcription ne permet pas de les appliquer. Avec HumanLogs, vous gardez la main sur vos audios et transcriptions à chaque étape : le **chiffrement de bout en bout** optionnel signifie que ni l'audio ni le texte ne sont lisibles côté serveur, la suppression d'un fichier ou d'un projet est immédiate et définitive, et l'hébergement européen sans réutilisation des données (mode Gladia, sans conservation ni entraînement de modèle) évite d'ajouter un intermédiaire supplémentaire à documenter dans votre protocole. Le code étant open source et auto-hébergeable, une université peut aussi choisir de garder l'intégralité du traitement sur sa propre infrastructure.
