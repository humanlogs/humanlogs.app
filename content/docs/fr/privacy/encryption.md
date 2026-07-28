---
title: Chiffrement et récupération des accès
description: Ce que protège le chiffrement de bout en bout, comment les clés sont gérées, et comment récupérer l'accès.
order: 1
status: live
updated: 2026-07-27
---

Le chiffrement de bout en bout signifie que votre audio et vos transcriptions sont chiffrés dans votre navigateur, avant que quoi que ce soit ne nous soit envoyé, et ne peuvent être déchiffrés que par vous et les personnes avec qui vous partagez. Nous stockons du chiffré et ne détenons aucune clé qui l'ouvre.

C'est optionnel, et désactivé tant que vous ne l'activez pas. Cette page explique ce qu'il fait, pour que vous puissiez décider — et pour que vous puissiez répondre à un comité d'éthique qui pose la question.

## Le principe, en clair

Chaque document reçoit sa propre clé **AES-GCM** aléatoire, générée dans votre navigateur. Cette clé chiffre le contenu : la transcription et le fichier audio.

La clé de contenu est ensuite **emballée séparément pour chaque personne autorisée**, avec sa clé publique **RSA**. Le document porte donc une petite entrée de clé chiffrée par personne ayant accès, à côté d'un seul exemplaire du contenu chiffré.

Deux conséquences en découlent, et ce sont les raisons de cette conception :

- **Le partage est instantané.** Ajouter quelqu'un emballe la clé de contenu pour lui ; la transcription elle-même n'est pas rechiffrée. Partager un entretien de trois heures prend le même temps que partager une note d'une page.
- **La révocation est exacte.** Retirer quelqu'un supprime son entrée de clé. Il ne reste rien dans le document que sa clé privée puisse ouvrir.

## Où vit votre clé

Quand vous activez le chiffrement, votre navigateur génère une paire de clés :

- La **clé publique** est stockée sur votre compte. Les autres en ont besoin pour vous partager des documents chiffrés.
- La **clé privée** ne quitte jamais votre appareil. Elle est conservée dans la base locale de votre navigateur, elle-même chiffrée au repos avec un secret propre à l'appareil.

Vous recevez également un **fichier de certificat** à télécharger et à conserver. C'est ce qui vous permet d'ajouter un second appareil, et de récupérer votre accès après avoir effacé les données de votre navigateur. Rangez-le où vous rangeriez un mot de passe — car c'en est un. Voir Appareils et récupération de clé.

## Ce que nous voyons et ce que nous ne voyons pas

Avec le chiffrement activé, nous détenons : le chiffré de vos transcriptions et de votre audio, les entrées de clés emballées, et les métadonnées qui font fonctionner le service — qui possède un document, avec qui il est partagé, sa durée, sa date de création.

Nous ne pouvons ni lire la transcription ni écouter l'audio. Aucune demande de support, aucune décision de justice et aucune compromission de nos serveurs n'y change quoi que ce soit, parce que la clé n'est pas à nous.

La collaboration en temps réel fonctionne sur les documents chiffrés, et ce n'est pas une exception : notre serveur relaie les messages entre collaborateurs sans les inspecter. Ce qu'il transmet est du chiffré.

## Ce que le chiffrement ne protège pas

Être précis ici compte plus qu'être rassurant :

- **L'étape de transcription.** La reconnaissance vocale a lieu chez un fournisseur, qui a besoin de l'audio en clair pour le transcrire. Il est déchiffré pour cette étape, sous une politique de non-conservation, puis rechiffré avant stockage. Si cette étape est inacceptable pour votre matériau, la réponse est un serveur Whisper local sur votre propre infrastructure — voir [Auto-hébergement](/docs/self-hosting/installation-guide).
- **Les métadonnées.** Les noms de documents, les participants et les durées ne sont pas chiffrés. Ne mettez pas le vrai nom d'un participant dans un titre de document.
- **Les personnes avec qui vous partagez.** Elles peuvent lire, exporter et copier ce à quoi vous leur avez donné accès. Le chiffrement n'est pas une laisse.
- **Votre propre appareil.** Un ordinateur compromis qui porte votre clé, c'est une transcription compromise.

## Le prix à payer

Il y en a exactement un, et il est réel : **si vous perdez votre clé et votre certificat, votre contenu est irrécupérable.** Ni par le support, ni par nous. C'est cette même propriété qui rend la garantie sérieuse.

Téléchargez le certificat au moment où vous activez le chiffrement, et rangez-le là où vous le retrouverez encore après la thèse.

## Activer le chiffrement

Voir Activer le chiffrement.
