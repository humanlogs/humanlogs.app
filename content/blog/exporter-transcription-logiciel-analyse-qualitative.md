---
title: "Exporter ses transcriptions vers NVivo, ATLAS.ti ou Taguette"
date: "2026-09-09"
description: "Comment préparer et exporter vos transcriptions d'entretiens vers un logiciel d'analyse qualitative (NVivo, ATLAS.ti, Taguette) : formats attendus, codage par locuteur et erreurs à éviter."
locale: "fr"
author: "HumanLogs Team"
tags: ["productivite-recherche", "export", "logiciels-analyse"]
targetKeyword: "exporter transcription vers logiciel d'analyse qualitative"
pillar: "productivite-recherche"
---

La transcription est terminée, relue, validée. Reste une étape que beaucoup de chercheurs sous-estiment : faire entrer ce texte dans le logiciel d'analyse qualitative sans tout reformater à la main. Un fichier mal préparé se traduit par des heures perdues à corriger des labels de locuteurs incohérents, à recréer une mise en page, ou à découvrir a posteriori qu'un format ne permet pas le codage par intervenant que vous comptiez faire. Ce guide détaille ce qu'attend chaque outil et comment exporter une transcription vers un logiciel d'analyse qualitative sans repartir de zéro.

## Pourquoi le format d'export change tout pour le codage

Un logiciel d'analyse qualitative ne se contente pas d'afficher du texte : il structure le document pour permettre certaines opérations. Trois éléments déterminent ce qui sera possible une fois le fichier importé :

- **La reconnaissance des locuteurs.** Certains outils peuvent détecter automatiquement qui parle à chaque tour de parole si le document respecte une convention de mise en forme précise, ce qui permet ensuite de filtrer ou coder par intervenant sans repasser sur tout le texte.
- **La conservation de la structure.** Un export mal formaté (texte collé sans retours à la ligne, styles perdus lors d'une conversion) oblige à recréer manuellement les repères visuels qui séparent les tours de parole.
- **La compatibilité du format lui-même.** Tous les outils n'acceptent pas les mêmes formats, et tous ne les traitent pas de la même façon : un PDF conserve la mise en page mais complique l'extraction de texte propre, quand un DOCX ou un RTF reste éditable et structuré.

Vérifier ces trois points avant d'exporter tout un corpus évite de devoir reprendre cinquante entretiens un par un après une première tentative infructueuse.

## Exporter vers NVivo

NVivo importe le texte brut, le RTF, le DOCX ou le PDF. Pour tirer parti du codage automatique par locuteur, une fonctionnalité qui repère les tours de parole et permet ensuite de coder ou filtrer par intervenant, la transcription doit suivre une convention de mise en forme cohérente d'un bout à l'autre du document (par exemple un nom de locuteur suivi de deux-points, toujours positionné et stylé de la même façon). La marche à suivre exacte varie selon la version de NVivo : consultez la documentation officielle de votre version avant l'import si vous comptez utiliser cette fonction, plutôt que de vous fier à un souvenir d'une version précédente.

Deux points à vérifier avant d'importer un corpus entier dans NVivo :

- **La cohérence des labels sur tout le corpus.** Si un entretien utilise "Intervieweur" et un autre "Chercheur", NVivo les traite comme deux catégories distinctes lors du classement par cas.
- **Le classement par cas (case classification).** Si votre analyse croise les thèmes codés avec des attributs de participants (âge, profession, groupe), préparez ces métadonnées dans un tableau séparé avant l'import plutôt que de les ajouter après coup entretien par entretien.

## Exporter vers ATLAS.ti

ATLAS.ti accepte le DOCX, le RTF, le TXT et le PDF, avec une gestion native des groupes de documents pour organiser un corpus par étude, par vague de collecte ou par type de participant. Le repérage des locuteurs y est moins automatisé que dans NVivo : il repose surtout sur une mise en forme lisible (label de locuteur en début de ligne, ponctuation cohérente) que vous ou vos collaborateurs codez ensuite manuellement au fil de la lecture, plutôt que sur une détection automatique à l'import.

Pour un corpus volumineux, structurer les documents en groupes dès l'import (par exemple un groupe par phase de terrain) simplifie ensuite les requêtes croisées, bien plus qu'un renommage a posteriori une fois les premiers codes déjà posés.

## Exporter vers Taguette

Taguette, outil open source et gratuit, accepte le texte brut, le DOCX, l'ODT et le PDF. Il ne propose pas de codage automatique par locuteur ni de classement par cas : le principe est de surligner un passage et de lui associer un ou plusieurs tags, ce qui suffit largement pour un projet étudiant, une étude pilote, ou un budget serré. La préparation en amont compte donc surtout pour la lisibilité du document (labels de locuteurs visibles et cohérents) plutôt que pour une fonctionnalité d'import spécifique.

## Erreurs fréquentes à l'export d'un corpus

- **Mélanger les conventions de labels d'un entretien à l'autre.** "Intervieweur / Participant" sur un fichier, "Q / R" sur un autre : chaque logiciel d'analyse qualitative traitera ces variantes comme des catégories différentes, ce qui fausse tout filtrage par rôle.
- **Exporter en PDF quand un DOCX suffirait.** Le PDF garantit une mise en page fixe, utile pour une relecture par un comité, mais complique l'extraction de texte propre et empêche toute correction ultérieure dans l'outil d'analyse.
- **Perdre les horodatages en cours de route.** Si votre protocole de codage s'appuie sur des repères temporels (par exemple pour recouper un passage codé avec l'enregistrement audio), vérifiez qu'ils survivent à l'export plutôt que de les découvrir absents une fois l'import terminé.
- **Exporter tout le corpus avant de tester sur un seul fichier.** Un problème de mise en forme découvert après l'import de cinquante entretiens coûte bien plus cher à corriger qu'un test sur un seul fichier avant de généraliser.

## Une checklist avant d'exporter tout un corpus

1. Convention de labels de locuteurs identique sur tous les entretiens du corpus
2. Format choisi en fonction du logiciel cible (DOCX/RTF pour un codage automatique par locuteur, PDF seulement si aucune modification n'est prévue)
3. Test sur un seul entretien avant d'exporter l'ensemble du corpus
4. Horodatages conservés si le protocole de codage en a besoin
5. Métadonnées de classement (âge, groupe, vague de collecte) préparées séparément si l'analyse doit les croiser avec les codes

## Exporter ses transcriptions avec HumanLogs

[HumanLogs](https://humanlogs.app) exporte chaque transcription en PDF, Word, CSV ou TXT, avec les labels de locuteurs conservés et cohérents d'un entretien à l'autre une fois votre convention de nommage établie - la diarisation automatique identifie les intervenants dès l'ouverture du fichier, sans reformatage manuel avant l'export. Le format DOCX conserve la structure des tours de parole nécessaire au codage automatique par locuteur dans NVivo, quand le CSV convient mieux à une réutilisation quantitative des métadonnées (durée, nombre de tours de parole).

Pour un corpus à plusieurs entretiens, organiser chaque étude en projet dédié permet de préparer l'export de tout un lot en une fois, une fois les conventions de nommage et de labels appliquées de façon homogène - notre [guide sur l'organisation d'un projet de recherche qualitative](/fr/blog/organiser-projet-recherche-qualitative) détaille cette structuration en amont.

Un plan gratuit (100 minutes par mois, sans carte bancaire) permet de tester l'export sur les premiers entretiens d'un corpus avant de généraliser la méthode à l'ensemble de l'étude.
