---
title: "Hébergement des données de recherche en France"
date: "2026-08-25"
description: "Où doivent être hébergées les données de vos entretiens ? RGPD, hébergement en France ou en UE, auto-hébergement : ce qu'il faut vérifier avant de choisir un outil."
locale: "fr"
author: "HumanLogs Team"
tags: ["confidentialite-recherche", "rgpd", "hebergement-donnees"]
targetKeyword: "hébergement données France recherche"
pillar: "confidentialite-recherche"
---

Un comité d'éthique ou un directeur de thèse pose parfois une question très précise : où sont hébergées les données de vos entretiens ? La plupart des chercheurs savent répondre sur le chiffrement ou la conservation, beaucoup moins sur la localisation exacte des serveurs de leur outil de transcription. C'est pourtant un critère de plus en plus demandé, en particulier pour des données sensibles (santé, opinions, minorités) ou des projets financés par des organismes publics.

## Pourquoi la localisation des données de recherche est une vraie question RGPD

Le RGPD encadre les transferts de données personnelles hors de l'Espace économique européen (chapitre V du règlement). Dès qu'un enregistrement d'entretien transite par un serveur situé hors UE, ce transfert doit reposer sur une garantie juridique : une décision d'adéquation de la Commission européenne pour le pays concerné, ou à défaut des clauses contractuelles types signées avec le prestataire. Sans l'une de ces deux garanties, le transfert n'est pas conforme, même si le prestataire chiffre les données en transit.

Au-delà de la stricte obligation légale, de plus en plus d'institutions et de comités d'éthique demandent explicitement où se trouvent les serveurs, avant même de vérifier le détail des clauses contractuelles. Certains financeurs publics (ANR, établissements publics de recherche) intègrent cette question dans leur grille d'évaluation des plans de gestion de données. Pouvoir répondre "serveurs en France" ou "serveurs dans l'UE" sans avoir à consulter un DPO simplifie considérablement ces échanges.

## France, Union européenne ou hors UE : ce que ça change concrètement

Trois cas de figure, avec des implications différentes :

- **Hébergement en France.** Aucune obligation légale générale n'impose des serveurs français pour de la recherche qualitative classique (contrairement aux données de santé au sens strict, qui relèvent en France du référentiel HDS - Hébergeur de Données de Santé). En revanche, c'est souvent l'option la plus simple à justifier devant un comité local, et elle élimine d'office toute question de transfert international.
- **Hébergement dans l'UE/EEE.** Couvert directement par le RGPD, sans garantie supplémentaire à produire. C'est le niveau de protection suffisant pour l'immense majorité des projets de recherche en sciences humaines et sociales, et le compromis le plus courant entre simplicité de conformité et choix d'outils disponibles.
- **Hébergement hors UE.** Possible, mais qui ajoute une étape : vérifier l'existence d'une décision d'adéquation pour le pays du prestataire, ou obtenir les clauses contractuelles types signées. Beaucoup d'équipes de recherche choisissent simplement d'écarter ces outils pour éviter cette charge de vérification supplémentaire, plutôt que de la documenter projet par projet.

En pratique, l'hébergement en France n'est une exigence stricte que pour un sous-ensemble de projets (données de santé, conventions de financement spécifiques). Pour le reste, un hébergement UE répond à la question réglementaire ; l'hébergement français reste un choix de simplicité et parfois d'image, notamment pour des institutions qui préfèrent garder une réponse sans ambiguïté possible.

## Auto-hébergement : quand cela devient pertinent

Certaines universités et laboratoires disposent déjà d'une infrastructure serveur interne et préfèrent y héberger elles-mêmes leurs outils de recherche plutôt que de dépendre d'un prestataire externe, aussi bien localisé soit-il. L'auto-hébergement via une image Docker répond à ce besoin : les données ne quittent jamais le réseau de l'institution, ce qui répond du même coup à toute question de localisation, de sous-traitant RGPD ou de durée de conservation - puisqu'il n'y a plus de tiers dans la chaîne.

C'est une option pertinente pour :

- les projets manipulant des données de santé ou des catégories particulières de données au sens de l'article 9 du RGPD ;
- les institutions ayant déjà une politique IT stricte sur l'hébergement des données de recherche ;
- les équipes disposant d'un support IT capable de maintenir un service Docker dans la durée.

En contrepartie, l'auto-hébergement demande des ressources techniques que toutes les équipes n'ont pas. Pour un doctorant isolé ou une petite équipe sans support IT dédié, un service SaaS hébergé en UE avec des garanties claires reste souvent plus réaliste qu'une infrastructure à maintenir soi-même.

## Checklist avant de choisir l'hébergement d'un outil de recherche

Quelques questions à poser au prestataire, ou à vérifier vous-même dans sa documentation publique :

1. Où sont situés les serveurs qui traitent l'audio et stockent la transcription ?
2. Le prestataire de reconnaissance vocale sous-jacent (souvent un sous-traitant distinct de l'éditeur du logiciel) est-il lui aussi localisé en UE ?
3. Existe-t-il une option d'auto-hébergement, pour les projets qui l'exigent ?
4. En cas de transfert hors UE à un moment de la chaîne, quelles garanties (décision d'adéquation, clauses contractuelles types) sont documentées ?
5. Le chiffrement de bout en bout est-il disponible ? S'il l'est, le serveur ne voit jamais les données en clair, ce qui réduit fortement l'enjeu de sa localisation exacte.
6. Les données sont-elles exportables et supprimables à tout moment, quel que soit l'endroit où elles sont hébergées ?

Le sixième point mérite d'être creusé : la question de l'hébergement devient secondaire quand le chiffrement garantit que même le prestataire ne peut pas lire le contenu. C'est un raccourci utile quand la localisation exacte d'un sous-traitant est difficile à obtenir.

## HumanLogs : hébergement européen et auto-hébergement possible

[HumanLogs](https://humanlogs.app) traite les enregistrements sur des serveurs européens (via Gladia, configuré en mode sans rétention ni entraînement de modèle sur vos données), ce qui couvre directement l'exigence RGPD sans transfert hors UE à documenter. Pour les projets qui exigent un hébergement entièrement maîtrisé - données de santé, politique IT stricte d'une institution - HumanLogs est open source (AGPL v3) et auto-hébergeable via Docker sur l'infrastructure de l'université ou du laboratoire, serveurs compris.

Un chiffrement de bout en bout optionnel complète ce dispositif : l'audio et la transcription ne circulent jamais en clair hors de votre appareil, et vous seul détenez la clé de déchiffrement. Les données restent exportables et supprimables à tout moment, quelle que soit la formule choisie. Notre [guide sur la transcription confidentielle](/fr/blog/transcription-confidentielle) détaille les autres points RGPD à vérifier au-delà de la seule localisation des serveurs, et le plan gratuit (100 minutes par mois, sans carte bancaire) permet de tester ces garanties avant d'engager un corpus de recherche complet.

La localisation des données ne se résume pas à une case à cocher : c'est une question à documenter dès le protocole de recherche, avec une réponse vérifiable plutôt qu'une simple affirmation du prestataire.
