---
title: "Transcription confidentielle : RGPD et protection des données d'entretien"
date: "2026-08-13"
description: "Vos entretiens de recherche contiennent des données personnelles sensibles. Ce que dit le RGPD sur la transcription, les risques des outils mal configurés et une checklist avant de choisir un service."
locale: "fr"
author: "HumanLogs Team"
tags: ["confidentialite-recherche", "rgpd", "transcription"]
targetKeyword: "transcription confidentielle"
pillar: "confidentialite-recherche"
---

Un entretien de recherche contient presque toujours des données personnelles : la voix du participant, son nom, parfois son état de santé, ses opinions politiques ou religieuses, son parcours de vie. Dès que cet enregistrement quitte votre appareil pour être transcrit, ces données transitent par un tiers. C'est un maillon du protocole de recherche souvent traité à la légère, alors qu'il engage directement votre conformité RGPD et la promesse de confidentialité faite aux participants.

## Qu'est-ce qu'une transcription confidentielle ?

Une transcription confidentielle est une transcription dont le traitement - de l'upload de l'audio jusqu'à la suppression des données - respecte les principes de protection des données : accès limité aux seules personnes autorisées, pas de réutilisation du contenu à d'autres fins (comme l'entraînement d'un modèle d'IA), conservation limitée dans le temps, et hébergement dans un cadre juridique compatible avec le RGPD.

Ce n'est pas qu'une question technique. C'est une condition de validité de votre consentement éclairé : si vous avez promis l'anonymat à un participant, chaque prestataire qui manipule l'enregistrement doit être en mesure de tenir cette promesse.

## Le RGPD s'applique-t-il à vos entretiens de recherche ?

Oui, dès que l'enregistrement permet d'identifier une personne, directement (son nom) ou indirectement (sa voix, son poste, des détails biographiques). Deux points méritent une attention particulière :

- **Les catégories particulières de données** (article 9 du RGPD) - santé, opinions politiques, orientation sexuelle, appartenance syndicale - sont fréquentes en entretien qualitatif et bénéficient d'une protection renforcée. Leur traitement exige une base légale spécifique, généralement le consentement explicite ou l'intérêt public de la recherche scientifique selon le droit national.
- **Le sous-traitant RGPD.** Tout logiciel de transcription auquel vous confiez l'audio est un sous-traitant au sens de l'article 28. Vous devez pouvoir obtenir de sa part un accord de sous-traitance (DPA) précisant la finalité du traitement, la durée de conservation et les garanties de sécurité. L'absence de DPA disponible publiquement est un signal d'alerte.

La minimisation des données s'applique aussi : ne collectez et ne transcrivez que ce qui est nécessaire à votre question de recherche, et prévoyez dès le protocole comment les données seront anonymisées ou pseudonymisées après la phase de codage.

## Les risques d'une transcription mal sécurisée

- **L'audio sert à entraîner des modèles.** Certains services gratuits ou grand public réutilisent les fichiers soumis pour améliorer leurs modèles de reconnaissance vocale. C'est incompatible avec un engagement de confidentialité envers vos participants, même si la réutilisation est anonymisée côté prestataire.
- **Un hébergement hors Espace économique européen.** Un transfert de données personnelles vers un pays sans décision d'adéquation nécessite des garanties supplémentaires (clauses contractuelles types). Beaucoup d'équipes de recherche préfèrent simplement écarter les outils dont les serveurs sont hors UE.
- **Une conservation indéfinie de l'audio.** Si le fichier source reste stocké sans limite après la transcription, la surface d'exposition en cas de fuite de données s'accroît inutilement.
- **Un accès non contrôlé au sein de l'équipe.** Sur un projet collectif, tout le monde n'a pas besoin d'accéder à tous les entretiens. L'absence de gestion des droits par projet ou par rôle complique la conformité.

## Checklist RGPD avant de choisir un outil de transcription

Posez ces questions avant de transmettre le moindre fichier :

1. Où sont hébergés les serveurs (UE ou pays à décision d'adéquation) ?
2. L'audio est-il utilisé pour entraîner des modèles ? La réponse doit être non, explicitement.
3. Un accord de sous-traitance (DPA) est-il disponible et consultable ?
4. Quelle est la durée de conservation de l'audio après transcription ? Idéalement, une suppression automatique ou à la demande.
5. Les données sont-elles chiffrées en transit et au repos ?
6. Existe-t-il une option de chiffrement de bout en bout, garantissant que même le prestataire ne peut pas lire vos fichiers ?
7. Peut-on gérer les accès par utilisateur ou par projet, pour restreindre la visibilité aux membres autorisés ?
8. Peut-on exporter ou supprimer intégralement les données sur demande, pour répondre à un droit à l'effacement ?

Un outil qui répond clairement oui aux huit points peut être documenté sans réserve dans un protocole soumis à un comité d'éthique.

## Bonnes pratiques pour sécuriser vos transcriptions de recherche

Le choix de l'outil ne suffit pas : quelques habitudes complètent la protection des données une fois la transcription obtenue.

- **Pseudonymisez tôt.** Remplacez les noms par des identifiants (Participant A, P1...) dès la relecture, avant de partager le document avec des collaborateurs qui n'ont pas besoin de connaître l'identité réelle.
- **Supprimez l'audio source une fois la transcription validée**, si votre protocole ne requiert pas de le conserver comme preuve.
- **Documentez le traitement dans votre protocole de recherche** : outil utilisé, localisation des serveurs, durée de conservation. C'est ce qu'un comité d'éthique ou un DPO vous demandera de justifier.
- **Limitez le partage aux personnes strictement nécessaires**, et révoquez l'accès en fin de projet.

## HumanLogs : transcription pensée pour la conformité

[HumanLogs](https://humanlogs.app) traite les enregistrements sur des serveurs européens (Gladia), configurés en mode sans rétention et sans entraînement des modèles sur vos données. Un chiffrement de bout en bout optionnel garantit que l'audio et la transcription ne circulent jamais en clair hors de votre appareil : vous seul détenez la clé de déchiffrement.

La gestion des accès se fait par projet, pour que seuls les membres autorisés d'une équipe voient un entretien donné. HumanLogs est open source (AGPL v3) et auto-hébergeable via Docker, y compris sur l'infrastructure d'une université qui souhaiterait garder l'intégralité des données sur son propre réseau. Les données sont exportables et supprimables à tout moment.

Pour un premier entretien, un plan gratuit (100 minutes par mois, sans carte bancaire) permet de vérifier ces garanties avant d'engager tout un corpus de recherche. Si vous cherchez ensuite un panorama plus large des critères à évaluer (précision, diarisation, formats d'export), notre [guide sur le choix d'un logiciel de transcription](/fr/blog/logiciel-de-transcription) complète cette lecture, tout comme notre article dédié à la [localisation des données de recherche en France ou en UE](/fr/blog/hebergement-donnees-recherche-france).

La confidentialité d'une transcription ne se décrète pas après coup : elle se construit dès le choix de l'outil, avec des questions précises et des réponses vérifiables.
