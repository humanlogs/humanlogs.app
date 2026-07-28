---
title: Import audio
description: Fichiers acceptés, écran de dépôt et déroulement du traitement.
order: 2
status: live
updated: 2026-07-27
---

L'écran de dépôt propose peu d'options, volontairement. Cette page détaille ce que vous pouvez envoyer, ce que change chaque réglage, et quoi faire quand un fichier échoue.

## Ce que vous pouvez déposer

**Audio** — MP3, WAV, M4A, FLAC, AAC, OGG, Opus, WMA, AIFF.

**Vidéo** — MP4, MOV, AVI, MKV, WebM, FLV, WMV, MPEG, 3GP. Seule la piste audio est extraite et envoyée ; la vidéo ne quitte pas votre ordinateur.

Les fichiers que votre navigateur sait compresser avant l'envoi sont acceptés jusqu'à **4 Go** ; ceux envoyés tels quels doivent rester sous **300 Mo**. En pratique, un entretien de deux heures enregistré au téléphone tient largement dans les deux.

## Ajouter des fichiers

Glissez vos fichiers ou cliquez pour les sélectionner. Vous pouvez en mettre plusieurs à la suite : chaque enregistrement devient un document.

Pour chacun, vous voyez le nom, la durée et la taille, et vous pouvez le renommer avant de lancer. Ce nom devient celui du document : `Entretien 04 — enseignante, école rurale` vaut mieux que `REC_0042.m4a` quand vous y reviendrez dans six mois.

Les vidéos sont traitées localement : votre navigateur extrait et compresse l'audio, et seul celui-ci est envoyé. Voir Fichiers pris en charge pour les formats et les limites.

## Langue

Choisissez la langue parlée dans l'enregistrement. C'est le réglage qui a le plus d'effet sur la qualité, et celui qu'il faut vérifier deux fois.

Une seule langue par document. Un entretien bilingue sera transcrit dans la langue choisie, les passages dans l'autre langue ressortant approximatifs : si les deux comptent pour votre analyse, transcrivez-le deux fois, en deux documents.

## Nombre de locuteurs

La détection des locuteurs — la *diarisation* — sépare qui dit quoi. Lui indiquer combien de personnes parlent la rend nettement plus fiable que la laisser deviner.

- **Un locuteur** pour un cours, une note dictée, un journal de terrain.
- **Un nombre précis** quand vous le connaissez : un entretien avec un participant, c'est deux.
- **Plus de dix** pour un focus group ou une réunion publique.

La détection n'est jamais parfaite sur les prises de parole simultanées. Vous pourrez renommer, réattribuer et fusionner les locuteurs ensuite — voir [Locuteurs](/docs/transcribe/navigation).

## Vocabulaire personnalisé

Une liste de mots attendus : noms et pseudonymes des participants, institutions, termes techniques, toponymes, sigles de votre discipline.

C'est le champ au meilleur rapport effort/résultat de l'écran. La reconnaissance vocale échoue de façon prévisible sur les noms propres rares, et une douzaine d'entrées ici évitent cent rechercher-remplacer plus tard. Si vous menez une série d'entretiens sur le même sujet, gardez votre liste dans une note et collez-la à chaque fois.

## Marquer les événements sonores

Signale dans la transcription ce qui n'est pas de la parole : rires, bruits de fond.

Utile quand le paralangage fait partie de votre analyse, parasite sinon. Si vous analysez ce qui a été dit plutôt que l'ambiance de la pièce, laissez l'option désactivée.

## Traitement UE ou US

L'option apparaît lorsque les deux fournisseurs sont configurés. Elle détermine où l'audio est envoyé pour la reconnaissance, et se cale sur la préférence de votre compte puis sur votre dernier choix.

Attention à la limite UE de **135 minutes par fichier** : les fichiers trop longs sont signalés avant le lancement, à vous de les découper ou de basculer sur le traitement américain. Voir [Où votre audio est traité](/docs/transcribe/advanced-options).

## Crédits

Avant de lancer, vous voyez la durée totale, les crédits estimés et votre solde. Un crédit correspond à une minute d'audio, arrondie à l'unité supérieure par fichier.

Si le solde est insuffisant, l'interface vous le dit avant l'envoi plutôt que d'échouer à mi-parcours. Voir [Crédits](/docs/privacy/credits).

## Lancement

Une fois lancé, les fichiers sont convertis si nécessaire puis envoyés, avec la progression affichée pour les deux étapes. Le traitement prend ensuite une dizaine de minutes par heure d'audio et vous pouvez fermer la page. Voir Pendant la transcription.

## Quand un fichier échoue

Un document en échec affiche la raison et reste dans votre liste. Rien n'est perdu, et **un échec ne consomme pas de crédits**.

- Le fichier se lit-il dans votre propre lecteur ? Un fichier illisible en local ne se transcrira pas.
- Est-il muet ? Une entrée coupée produit une transcription vide.
- Dépasse-t-il 135 minutes en traitement UE ? Découpez-le, ou basculez sur les États-Unis.
- Dépasse-t-il 300 Mo dans un format que le navigateur ne sait pas convertir ? Réexportez-le en MP3.

Redéposer le fichier règle la plupart des échecs passagers. Si le même fichier échoue deux fois, [écrivez-nous](/contact) avec le nom du document : nous pouvons regarder ce que le fournisseur a renvoyé.

## Importer plutôt que transcrire

Si vous disposez déjà d'une transcription, ne la repayez pas : basculez sur **Importer un document** depuis le même écran. Voir [Importer une transcription existante](/docs/transcribe/import-text).
