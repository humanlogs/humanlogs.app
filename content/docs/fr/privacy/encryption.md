---
title: Chiffrement et récupération des accès
description: Ce que protège le chiffrement de bout en bout, comment les clés sont gérées, et comment récupérer l'accès sur un autre appareil.
order: 1
status: live
updated: 2026-07-28
related: organize/collaboration, privacy/legal
---

Le chiffrement de bout en bout signifie que votre audio et vos transcriptions sont chiffrés dans votre navigateur, avant que quoi que ce soit ne nous soit envoyé, et ne peuvent être déchiffrés que par vous et les personnes avec qui vous partagez. Nous stockons du chiffré et ne détenons aucune clé qui l'ouvre.

C'est optionnel, et désactivé tant que vous ne l'activez pas. Cette page explique ce qu'il fait, pour que vous puissiez décider, et pour répondre à un comité d'éthique qui pose la question.

## Activer le chiffrement

Depuis **Compte → Sécurité**, ou pendant l'inscription.

Votre navigateur génère une paire de clés. La **clé publique** est stockée sur votre compte, car les autres en ont besoin pour vous partager des documents chiffrés. La **clé privée** ne quitte jamais votre appareil : elle vit dans la base locale de votre navigateur, elle-même chiffrée au repos avec un secret propre à l'appareil.

On vous propose ensuite un **fichier de certificat** contenant votre clé. **Téléchargez-le et rangez-le en lieu sûr**, gestionnaire de mots de passe, disque institutionnel, clé USB chiffrée. C'est ce qui vous permet de revenir depuis un autre appareil, et de récupérer après avoir effacé les données de votre navigateur. Nous ne pouvons pas le recréer pour vous.

## Le principe, en clair

Chaque document reçoit sa propre clé **AES-GCM** aléatoire, générée dans votre navigateur, qui chiffre le contenu : la transcription et le fichier audio.

Cette clé de contenu est ensuite **emballée séparément pour chaque personne autorisée**, avec sa clé publique **RSA**. Un document porte donc une petite entrée de clé chiffrée par personne ayant accès, à côté d'un seul exemplaire du contenu chiffré.

Deux conséquences en découlent, et ce sont les raisons de cette conception :

- **Le partage est instantané.** Ajouter quelqu'un emballe la clé de contenu pour lui ; la transcription elle-même n'est pas rechiffrée. Partager un entretien de trois heures prend le temps de partager une note d'une page.
- **La révocation est exacte.** Retirer quelqu'un supprime son entrée de clé. Il ne reste rien dans le document que sa clé privée puisse ouvrir.

## Ce que ça change au quotidien

Très peu. Les documents s'ouvrent, se lisent et s'exportent comme d'habitude, les exports sont produits dans votre navigateur à partir du document déchiffré, donc le texte en clair ne nous revient jamais.

Deux différences méritent d'être connues :

- Le partage suppose que l'autre personne ait aussi activé le chiffrement, sans quoi il n'existe aucune clé pour lui chiffrer le contenu. Le partage est alors refusé avec un message explicite. Voir [Collaboration](/docs/organize/collaboration).
- Un appareil sans votre clé affiche les documents chiffrés comme verrouillés jusqu'à l'import du certificat.

## Travailler depuis un second appareil

Connectez-vous sur le nouvel appareil et importez votre fichier de certificat quand il vous est demandé. Ce navigateur peut alors lire vos documents chiffrés.

Le réglage **faire confiance à cet appareil** décide si la clé survit à la déconnexion :

- **De confiance** : la clé reste dans ce navigateur, chiffrée au repos, pour ne pas la réimporter à chaque session. Adapté à votre ordinateur personnel.
- **Pas de confiance** : la clé est effacée à la déconnexion. Adapté à une machine partagée ou publique.

Vous pouvez changer ce réglage, ou retirer la clé de l'appareil courant, à tout moment depuis **Compte → Sécurité**.

## Récupérer l'accès

**Un document apparaît verrouillé** : ce navigateur n'a pas la clé. Importez votre certificat, ou ouvrez le document depuis un appareil qui l'a déjà.

**Vous avez perdu le certificat mais un appareil fonctionne encore** : téléchargez-en une nouvelle copie depuis **Compte → Sécurité** sur cet appareil, et rangez-la correctement cette fois.

**Le document indique que le certificat ne correspond pas** : il a été chiffré avec une autre clé : un ancien certificat à vous, d'avant une réinitialisation, ou celui de quelqu'un d'autre. Seul l'import du certificat d'origine ouvre le document ; s'il a disparu, il ne reste que la suppression.

**Vous avez perdu le certificat et tous vos appareils** : le contenu chiffré est irrécupérable, ni par vous ni par nous. Récupérez ce que vous pouvez des exports déjà produits, et retranscrivez depuis les enregistrements d'origine s'ils existent encore.

Ce dernier cas est le seul vrai prix du chiffrement, et c'est la propriété même qui rend la garantie sérieuse.

## Ce que nous voyons et ce que nous ne voyons pas

Nous détenons le chiffré de vos transcriptions et de votre audio, les entrées de clés emballées, et les métadonnées qui font fonctionner le service : qui possède un document, avec qui il est partagé, sa durée, sa date de création.

Nous ne pouvons ni lire la transcription ni écouter l'audio. Aucune demande de support, aucune décision de justice et aucune compromission de nos serveurs n'y change quoi que ce soit, parce que la clé n'est pas à nous.

La collaboration en temps réel n'est pas une exception : notre serveur relaie les messages entre collaborateurs sans les inspecter, et ce qu'il transmet est du chiffré.

## Ce que le chiffrement ne protège pas

Être précis ici compte plus qu'être rassurant :

- **L'étape de transcription.** La reconnaissance vocale a lieu chez un fournisseur, qui a besoin de l'audio en clair. Il est déchiffré pour cette étape, sous une politique de non-conservation, puis rechiffré avant stockage. Si c'est inacceptable pour votre matériau, faites tourner un serveur Whisper local sur votre infrastructure, voir le [guide d'installation](/docs/self-hosting/installation-guide).
- **Les métadonnées.** Noms de documents, participants et durées ne sont pas chiffrés. Ne mettez pas le vrai nom d'un participant dans un titre de document.
- **Les personnes avec qui vous partagez.** Elles peuvent lire, exporter et copier ce à quoi vous leur avez donné accès. Le chiffrement n'est pas une laisse.
- **Votre propre appareil.** Un ordinateur compromis qui porte votre clé, c'est une transcription compromise.

## Désactiver le chiffrement

Le chiffrement se désactive depuis le même écran. Faites-le délibérément : c'est une décision qui porte sur du matériau dont vous avez peut-être promis aux participants qu'il resterait confidentiel.
