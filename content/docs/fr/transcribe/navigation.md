---
title: Navigation
description: Corriger une transcription avec l'audio : lecture, locuteurs, recherche et historique.
order: 4
status: live
updated: 2026-07-28
related: transcribe/keyboard-shortcuts, organize/comments, transcribe/export
---

Une transcription automatique est un brouillon. L'éditeur existe pour rendre la correction de ce brouillon rapide, ce qui est un problème différent de l'écriture de texte, et c'est pourquoi il ne ressemble pas à un traitement de texte.

## Les deux moitiés

**Le lecteur audio** : en haut : forme d'onde, contrôles de lecture, vitesse. La forme d'onde est cliquable, cliquez n'importe où pour vous y placer.

**La transcription** : en dessous : le texte, les locuteurs dans une colonne à gauche, les commentaires dans un rail à droite.

Les deux ne font qu'un. Le segment en cours de lecture est surligné au fil de l'audio, et cliquer sur un mot place l'audio exactement à cet instant. C'est ce lien unique qui rend la correction rapide : vous ne cherchez jamais le passage que vous venez d'entendre.

## Corriger le texte

Cliquez dans le texte et tapez. C'est un éditeur de texte enrichi classique : **⌘B** gras, **⌘I** italique, **⌘U** souligné, **⌘⇧X** barré, pratique pour marquer par convention les passages incertains.

L'enregistrement est automatique et continu. L'indicateur à côté du nom du document affiche *Enregistrement…* puis *Enregistré*, et vous prévient quand vous êtes hors ligne. Il n'y a pas de bouton d'enregistrement, donc rien à oublier.

## Écouter en tapant

La barre d'espace insère des espaces quand vous tapez : la lecture passe donc sur **Alt/Ctrl + Espace** pendant l'édition. Hors du texte, **Espace** ou **Tab** lit et met en pause.

La vitesse se maintient, elle ne se règle pas : gardez **Alt** enfoncé pour 0,5×, **Ctrl** pour 2×, **Alt + Ctrl** pour 4×. En pratique, vous tenez Ctrl sur les passages déjà vérifiés et Alt sur ceux qui sont marmonnés, sans jamais ouvrir de menu.

## Locuteurs

Chaque segment porte un locuteur, affiché dans la colonne de gauche. Cliquez sur un nom pour le renommer dans tout le document ; changez le locuteur d'un segment mal attribué.

## Rechercher et remplacer

La barre de recherche parcourt le document, avec les options **respecter la casse**, **mot entier** et **ignorer les accents**, et remplace les occurrences une à une ou toutes d'un coup. La recherche sans accents répond à un cas très fréquent : une transcription plus rigoureuse sur les accents que votre frappe.

## Historique des versions

Chaque document conserve l'historique de ses versions, avec le nombre de mots ajoutés, supprimés et modifiés dans chacune. Ouvrez **Historique des versions** dans les actions du document pour le parcourir, et restaurez une version antérieure si nécessaire, l'état courant est lui-même conservé comme version, donc une restauration se défait.

L'historique porte sur le document, pas sur les personnes. Si plusieurs personnes travaillent en même temps, une restauration s'applique à tout le monde : prévenez dans un commentaire d'abord.

## Tout le reste

Les commentaires vivent dans le rail de droite, voir [Commentaires](/docs/organize/comments). Les pauses s'affichent dans le texte à partir d'un seuil que vous fixez : voir [Options avancées](/docs/transcribe/advanced-options).

Si le document est partagé, les curseurs des autres apparaissent là où ils travaillent et leurs modifications arrivent au fil de leur frappe, voir [Collaboration](/docs/organize/collaboration).

Exports, partage, raccourcis clavier, renommage, affectation à une étude et suppression se trouvent dans le menu d'actions du document, à côté de son nom.
