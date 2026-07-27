"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { AnimatedSectionTitle } from "../../components/animated-section-title";
import { DocumentLayout } from "../layout";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";

export default function Page() {
  const [language, setLanguage] = useState<"en" | "fr">("en");
  const contentRef = useRef<HTMLDivElement>(null);

  const exportToPDF = () => {
    if (!contentRef.current) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    const title =
      language === "en"
        ? "Information for Institutional Review Boards (IRB)"
        : "Informations pour les Comités d'Éthique de la Recherche (CER)";

    // Title
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    const titleLines = pdf.splitTextToSize(title, maxWidth);
    pdf.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 8 + 10;

    // Extract and format content
    const content = contentRef.current;
    const _elements = content.querySelectorAll(
      "h1, h2, h3, p, li, strong, em, a",
    );

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    // Simple text extraction
    const textContent = content.innerText;
    const lines = pdf.splitTextToSize(textContent, maxWidth);

    lines.forEach((line: string) => {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    const filename =
      language === "en"
        ? "HumanLogs_IRB_Information.pdf"
        : "HumanLogs_Informations_CER.pdf";

    pdf.save(filename);
  };

  return (
    <>
      <AnimatedSectionTitle className="text-black">
        {language === "en"
          ? "Information for Institutional Review Boards (IRB)"
          : "Informations pour les Comités d'Éthique de la Recherche (CER)"}
      </AnimatedSectionTitle>

      <DocumentLayout>
        <div className="flex flex-wrap gap-3 mb-6 items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={language === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("en")}
            >
              English
            </Button>
            <Button
              variant={language === "fr" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("fr")}
            >
              Français
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {language === "en" ? "Export to PDF" : "Exporter en PDF"}
          </Button>
        </div>

        <div ref={contentRef}>
          {language === "en" ? <EnglishContent /> : <FrenchContent />}
        </div>
      </DocumentLayout>
    </>
  );
}

function EnglishContent() {
  return (
    <>
      <h1>Information for Institutional Review Boards (IRB)</h1>
      <p>
        <strong>Last updated:</strong> April 27, 2026
      </p>

      <h2>Purpose of This Document</h2>
      <p>
        This document provides detailed information about HumanLogs&apos; data
        protection and security practices for researchers and institutions
        seeking IRB approval to use our transcription service in their research
        activities.
      </p>

      <h2>Service Overview</h2>
      <p>
        HumanLogs is an audio transcription service that provides end-to-end
        encrypted transcription capabilities. Our service is designed with
        privacy and security as core principles, making it suitable for
        sensitive research data including interviews, focus groups, and other
        qualitative research activities.
      </p>

      <h2>Data Processing Workflow</h2>

      <h3>SaaS Mode (Standard)</h3>
      <p>
        In our standard SaaS offering, data processing follows this workflow:
      </p>
      <ol>
        <li>
          <strong>Audio Upload:</strong> Audio files are securely transmitted to
          our servers via encrypted connection (TLS).
        </li>
        <li>
          <strong>Transcription Processing:</strong> Audio files are sent to our
          default transcription provider (Gladia) with:
          <ul>
            <li>
              <strong>European servers only:</strong> All processing occurs on
              EU-based servers ensuring European data residency
            </li>
            <li>
              <strong>No-training mode:</strong> Your data is never used to
              train AI models
            </li>
            <li>
              <strong>No-retention mode:</strong> Audio files are immediately
              deleted after transcription is complete
            </li>
          </ul>
          <p>
            Alternatively, ElevenLabs can be configured as a transcription
            provider with training disabled and immediate deletion (see{" "}
            <a
              href="https://elevenlabs.io/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              ElevenLabs Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://elevenlabs.io/warsaw-event-gdpr-notice"
              target="_blank"
              rel="noopener noreferrer"
            >
              GDPR Notice
            </a>
            ).
          </p>
        </li>
        <li>
          <strong>End-to-End Encryption:</strong> Once the transcript is
          obtained, it is immediately encrypted with your public key. After this
          point, all transcripts and audio files remain end-to-end encrypted.
        </li>
        <li>
          <strong>Storage:</strong> Encrypted data is stored on our servers
          located in the European Union. Only you can decrypt this data using
          your private key.
        </li>
      </ol>

      <h3>On-Premise / Enterprise License Mode</h3>
      <p>
        For enhanced security requirements, we offer On-Premise and Enterprise
        license options with additional protections:
      </p>
      <ul>
        <li>
          <strong>European Subprocessors Only:</strong> All subprocessors are
          located and operate exclusively within Europe
        </li>
        <li>
          <strong>Zero Retention Mode (ZRM):</strong> ElevenLabs processes
          transcriptions entirely in-memory with zero data retention - no data
          is ever persisted on subprocessor servers
        </li>
        <li>
          <strong>Data Residency Control:</strong> Choose specific server
          regions for data processing
        </li>
      </ul>
      <p>
        Contact us for more information about On-Premise and Enterprise options.
      </p>

      <h2>Data Classification: What Is Encrypted and How</h2>

      <h3>End-to-End Encrypted (E2E)</h3>
      <p>
        The following data is encrypted with your public key and can only be
        decrypted by you using your private key:
      </p>
      <ul>
        <li>
          <strong>Transcripts:</strong> All transcription content and text
        </li>
        <li>
          <strong>Audio files:</strong> Original audio recordings (after initial
          transcription processing)
        </li>
      </ul>
      <p>
        <em>
          HumanLogs cannot access, view, or decrypt this data. Only you have the
          decryption keys.
        </em>
      </p>

      <h3>Encrypted at Rest and in Transit</h3>
      <p>
        The following data is encrypted using industry-standard encryption but
        is not end-to-end encrypted:
      </p>
      <ul>
        <li>
          <strong>Account information:</strong> Email address, name, and
          authentication credentials
        </li>
        <li>
          <strong>Transcript metadata:</strong> File names, timestamps, project
          information (but not the content itself)
        </li>
      </ul>

      <h2>Collaboration and Key Sharing</h2>
      <p>
        HumanLogs supports secure collaboration between researchers through
        public key sharing:
      </p>
      <ul>
        <li>Users can share their public encryption keys with collaborators</li>
        <li>
          This allows multiple authorized researchers to access the same
          encrypted transcripts
        </li>
        <li>
          All collaborators must have the appropriate private keys to decrypt
          shared content
        </li>
        <li>
          Public key exchange happens through the HumanLogs platform, ensuring
          secure key distribution
        </li>
      </ul>

      <h2>Data Location and Infrastructure</h2>
      <p>
        <strong>
          All HumanLogs servers are located in the European Union.
        </strong>
      </p>
      <p>
        We use AWS (Amazon Web Services) European data centers for our
        infrastructure. Data is processed and stored exclusively within EU
        borders, ensuring compliance with European data protection standards.
      </p>

      <h2>GDPR Compliance and Data Subject Rights</h2>
      <p>
        HumanLogs is fully compliant with the General Data Protection Regulation
        (GDPR). Research participants and users have the following rights:
      </p>
      <ul>
        <li>
          <strong>Right to Access:</strong> Users can request copies of their
          personal data
        </li>
        <li>
          <strong>Right to Rectification:</strong> Users can correct inaccurate
          personal information
        </li>
        <li>
          <strong>Right to Erasure (Right to be Forgotten):</strong> Users can
          request deletion of their personal data
        </li>
        <li>
          <strong>Right to Data Portability:</strong> Users can export their
          data in a machine-readable format
        </li>
        <li>
          <strong>Right to Object:</strong> Users can object to certain types of
          data processing
        </li>
      </ul>
      <p>
        For comprehensive information about data protection and GDPR compliance,
        please refer to:
      </p>
      <ul>
        <li>
          <a href="https://humanlogs.app/fr/legal/privacy">Privacy Policy</a>
        </li>
        <li>
          <a href="https://humanlogs.app/fr/legal/gdpr">
            GDPR Compliance Information
          </a>
        </li>
      </ul>

      <h2>Data Retention and Deletion</h2>
      <p>
        <strong>Active Data:</strong> Encrypted transcripts and audio files are
        retained as long as your account is active, unless you explicitly delete
        them.
      </p>
      <p>
        <strong>Deletion Requests:</strong> When you delete data or request
        account deletion:
      </p>
      <ul>
        <li>
          Data is immediately removed from production systems and marked for
          permanent deletion
        </li>
        <li>
          Backup copies are purged according to our backup retention schedule
          (maximum 90 days)
        </li>
        <li>
          All subprocessor copies are immediately deleted (or never stored in
          On-Premise/Enterprise modes)
        </li>
      </ul>

      <h2>Subprocessors</h2>
      <p>
        HumanLogs uses carefully selected subprocessors to deliver our services.
        All subprocessors are bound by strict data protection agreements:
      </p>
      <ul>
        <li>
          <strong>Gladia (Default):</strong> Audio transcription processing
          (European servers only, no-training and no-retention mode)
        </li>
        <li>
          <strong>ElevenLabs (Alternative):</strong> Audio transcription
          processing (optional alternative provider, with training disabled and
          immediate deletion)
        </li>
        <li>
          <strong>AWS (Europe):</strong> Infrastructure and secure data storage
        </li>
        <li>
          <strong>
            <a
              href="https://auth0.com/docs/secure/data-privacy-and-compliance/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Auth0 Europe
            </a>
            :
          </strong>{" "}
          Authentication and identity management
        </li>
        <li>
          <strong>OVH (Europe):</strong> Email communications
        </li>
      </ul>
      <p>
        For a complete and current list of subprocessors, see our{" "}
        <Link href="/legal/subprocessors">Data Subprocessors page</Link>.
      </p>

      <h2>Security Measures</h2>
      <p>HumanLogs implements multiple layers of security:</p>
      <ul>
        <li>
          <strong>Encryption in Transit:</strong> All data transfers use TLS/SSL
          encryption
        </li>
        <li>
          <strong>Encryption at Rest:</strong> All stored data is encrypted
          using AES-256 encryption
        </li>
        <li>
          <strong>End-to-End Encryption:</strong> Sensitive content (transcripts
          and audio) is encrypted with user-controlled keys
        </li>
        <li>
          <strong>Access Controls:</strong> Role-based access control and
          multi-factor authentication
        </li>
        <li>
          <strong>Regular Security Audits:</strong> Ongoing security assessments
          and updates
        </li>
        <li>
          <strong>Zero-Knowledge Architecture:</strong> HumanLogs cannot access
          your encrypted content
        </li>
      </ul>

      <h2>Compliance Documentation</h2>
      <p>Additional documentation available for IRB review:</p>
      <ul>
        <li>
          <Link href="/legal/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/legal/terms">Terms of Service</Link>
        </li>
        <li>
          <Link href="/legal/dpa">Data Processing Agreement (DPA)</Link>
        </li>
        <li>
          <Link href="/legal/subprocessors">Data Subprocessors List</Link>
        </li>
      </ul>

      <h2>Contact Information</h2>
      <p>
        For additional information, questions, or to request specific
        documentation for your IRB submission:
      </p>
      <ul>
        <li>
          <strong>General inquiries:</strong>{" "}
          <Link href="/contact">Contact Form</Link>
        </li>
        <li>
          <strong>Privacy questions:</strong>{" "}
          <a href="mailto:hello@humanlogs.app">privacy@humanlogs.app</a>
        </li>
        <li>
          <strong>Enterprise inquiries:</strong>{" "}
          <a href="mailto:hello@humanlogs.app">enterprise@humanlogs.app</a>
        </li>
      </ul>

      <h2>Researcher Recommendations</h2>
      <p>
        For researchers using HumanLogs in IRB-approved studies, we recommend:
      </p>
      <ul>
        <li>
          Informing participants that transcriptions will be processed using a
          third-party service with end-to-end encryption
        </li>
        <li>
          Explaining that audio is temporarily processed by a subprocessor but
          immediately deleted
        </li>
        <li>
          Maintaining control of your private encryption keys and not sharing
          them beyond authorized research team members
        </li>
        <li>
          Using unique project identifiers rather than participant names in file
          names or metadata
        </li>
        <li>
          Considering On-Premise or Enterprise options for highly sensitive
          research requiring additional security guarantees
        </li>
      </ul>

      <hr className="my-6" />
      <p className="text-sm text-gray-600">
        <em>
          This document is provided to assist researchers in preparing IRB
          applications. It does not constitute legal advice. Researchers should
          consult with their institution&apos;s IRB and legal counsel to ensure
          compliance with applicable regulations.
        </em>
      </p>
    </>
  );
}

function FrenchContent() {
  return (
    <>
      <h1>Informations pour les Comités d&apos;Éthique de la Recherche (CER)</h1>
      <p>
        <strong>Dernière mise à jour :</strong> 27 avril 2026
      </p>

      <h2>Objectif de ce document</h2>
      <p>
        Ce document fournit des informations détaillées sur les pratiques de
        protection et de sécurité des données de HumanLogs pour les chercheurs
        et institutions souhaitant obtenir l&apos;approbation d&apos;un CER pour utiliser
        notre service de transcription dans leurs activités de recherche.
      </p>

      <h2>Aperçu du service</h2>
      <p>
        HumanLogs est un service de transcription audio qui fournit des
        capacités de transcription avec chiffrement de bout en bout. Notre
        service est conçu avec la confidentialité et la sécurité comme principes
        fondamentaux, ce qui le rend adapté aux données de recherche sensibles,
        y compris les entretiens, les groupes de discussion et d&apos;autres
        activités de recherche qualitative.
      </p>

      <h2>Flux de traitement des données</h2>

      <h3>Mode SaaS (Standard)</h3>
      <p>
        Dans notre offre SaaS standard, le traitement des données suit ce flux
        de travail :
      </p>
      <ol>
        <li>
          <strong>Téléchargement audio :</strong> Les fichiers audio sont
          transmis de manière sécurisée à nos serveurs via une connexion
          chiffrée (TLS).
        </li>
        <li>
          <strong>Traitement de la transcription :</strong> Les fichiers audio
          sont envoyés à notre fournisseur de transcription par défaut (Gladia)
          avec :
          <ul>
            <li>
              <strong>Serveurs européens uniquement :</strong> Tous les
              traitements sont effectués sur des serveurs basés dans l&apos;UE,
              garantissant la résidence des données en Europe
            </li>
            <li>
              <strong>Mode sans entraînement :</strong> Vos données ne sont
              jamais utilisées pour entraîner des modèles d&apos;IA
            </li>
            <li>
              <strong>Mode sans rétention :</strong> Les fichiers audio sont
              immédiatement supprimés après la transcription
            </li>
          </ul>
          <p>
            Alternativement, ElevenLabs peut être configuré comme fournisseur de
            transcription avec formation désactivée et suppression immédiate
            (voir{" "}
            <a
              href="https://elevenlabs.io/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Politique de confidentialité ElevenLabs
            </a>{" "}
            et{" "}
            <a
              href="https://elevenlabs.io/warsaw-event-gdpr-notice"
              target="_blank"
              rel="noopener noreferrer"
            >
              Notice RGPD
            </a>
            ).
          </p>
        </li>
        <li>
          <strong>Chiffrement de bout en bout :</strong> Une fois la
          transcription obtenue, elle est immédiatement chiffrée avec votre clé
          publique. Après ce point, toutes les transcriptions et fichiers audio
          restent chiffrés de bout en bout.
        </li>
        <li>
          <strong>Stockage :</strong> Les données chiffrées sont stockées sur
          nos serveurs situés dans l&apos;Union européenne. Seul vous pouvez
          déchiffrer ces données à l&apos;aide de votre clé privée.
        </li>
      </ol>

      <h3>Mode On-Premise / Licence Entreprise</h3>
      <p>
        Pour des exigences de sécurité renforcées, nous proposons des options de
        licence On-Premise et Entreprise avec des protections supplémentaires :
      </p>
      <ul>
        <li>
          <strong>Sous-traitants européens uniquement :</strong> Tous les
          sous-traitants sont situés et opèrent exclusivement en Europe
        </li>
        <li>
          <strong>Mode Zéro Rétention (ZRM) :</strong> ElevenLabs traite les
          transcriptions entièrement en mémoire avec zéro rétention de données -
          aucune donnée n&apos;est jamais persistée sur les serveurs du sous-traitant
        </li>
        <li>
          <strong>Contrôle de la résidence des données :</strong> Choisissez des
          régions de serveurs spécifiques pour le traitement des données
        </li>
      </ul>
      <p>
        Contactez-nous pour plus d&apos;informations sur les options On-Premise et
        Entreprise.
      </p>

      <h2>Classification des données : ce qui est chiffré et comment</h2>

      <h3>Chiffrement de bout en bout (E2E)</h3>
      <p>
        Les données suivantes sont chiffrées avec votre clé publique et ne
        peuvent être déchiffrées que par vous à l&apos;aide de votre clé privée :
      </p>
      <ul>
        <li>
          <strong>Transcriptions :</strong> Tout le contenu et texte de
          transcription
        </li>
        <li>
          <strong>Fichiers audio :</strong> Enregistrements audio originaux
          (après le traitement initial de transcription)
        </li>
      </ul>
      <p>
        <em>
          HumanLogs ne peut pas accéder, visualiser ou déchiffrer ces données.
          Seul vous possédez les clés de déchiffrement.
        </em>
      </p>

      <h3>Chiffré au repos et en transit</h3>
      <p>
        Les données suivantes sont chiffrées en utilisant un chiffrement
        standard de l&apos;industrie mais ne sont pas chiffrées de bout en bout :
      </p>
      <ul>
        <li>
          <strong>Informations de compte :</strong> Adresse e-mail, nom et
          identifiants d&apos;authentification
        </li>
        <li>
          <strong>Métadonnées de transcription :</strong> Noms de fichiers,
          horodatages, informations de projet (mais pas le contenu lui-même)
        </li>
      </ul>

      <h2>Collaboration et partage de clés</h2>
      <p>
        HumanLogs prend en charge la collaboration sécurisée entre chercheurs
        via le partage de clés publiques :
      </p>
      <ul>
        <li>
          Les utilisateurs peuvent partager leurs clés de chiffrement publiques
          avec des collaborateurs
        </li>
        <li>
          Cela permet à plusieurs chercheurs autorisés d&apos;accéder aux mêmes
          transcriptions chiffrées
        </li>
        <li>
          Tous les collaborateurs doivent disposer des clés privées appropriées
          pour déchiffrer le contenu partagé
        </li>
        <li>
          L&apos;échange de clés publiques se fait via la plateforme HumanLogs,
          garantissant une distribution sécurisée des clés
        </li>
      </ul>

      <h2>Localisation des données et infrastructure</h2>
      <p>
        <strong>
          Tous les serveurs HumanLogs sont situés dans l&apos;Union européenne.
        </strong>
      </p>
      <p>
        Nous utilisons les centres de données européens d&apos;AWS (Amazon Web
        Services) pour notre infrastructure. Les données sont traitées et
        stockées exclusivement dans les frontières de l&apos;UE, garantissant la
        conformité aux normes européennes de protection des données.
      </p>

      <h2>Conformité RGPD et droits des personnes concernées</h2>
      <p>
        HumanLogs est entièrement conforme au Règlement Général sur la
        Protection des Données (RGPD). Les participants à la recherche et les
        utilisateurs ont les droits suivants :
      </p>
      <ul>
        <li>
          <strong>Droit d&apos;accès :</strong> Les utilisateurs peuvent demander des
          copies de leurs données personnelles
        </li>
        <li>
          <strong>Droit de rectification :</strong> Les utilisateurs peuvent
          corriger les informations personnelles inexactes
        </li>
        <li>
          <strong>Droit à l&apos;effacement (droit à l&apos;oubli) :</strong> Les
          utilisateurs peuvent demander la suppression de leurs données
          personnelles
        </li>
        <li>
          <strong>Droit à la portabilité des données :</strong> Les utilisateurs
          peuvent exporter leurs données dans un format lisible par machine
        </li>
        <li>
          <strong>Droit d&apos;opposition :</strong> Les utilisateurs peuvent
          s&apos;opposer à certains types de traitement de données
        </li>
      </ul>
      <p>
        Pour des informations complètes sur la protection des données et la
        conformité RGPD, veuillez consulter :
      </p>
      <ul>
        <li>
          <a href="https://humanlogs.app/fr/legal/privacy">
            Politique de confidentialité
          </a>
        </li>
        <li>
          <a href="https://humanlogs.app/fr/legal/gdpr">
            Informations sur la conformité RGPD
          </a>
        </li>
      </ul>

      <h2>Conservation et suppression des données</h2>
      <p>
        <strong>Données actives :</strong> Les transcriptions chiffrées et les
        fichiers audio sont conservés tant que votre compte est actif, sauf si
        vous les supprimez explicitement.
      </p>
      <p>
        <strong>Demandes de suppression :</strong> Lorsque vous supprimez des
        données ou demandez la suppression de votre compte :
      </p>
      <ul>
        <li>
          Les données sont immédiatement supprimées des systèmes de production
          et marquées pour suppression permanente
        </li>
        <li>
          Les copies de sauvegarde sont purgées selon notre calendrier de
          conservation des sauvegardes (maximum 90 jours)
        </li>
        <li>
          Toutes les copies des sous-traitants sont immédiatement supprimées (ou
          jamais stockées en modes On-Premise/Entreprise)
        </li>
      </ul>

      <h2>Sous-traitants</h2>
      <p>
        HumanLogs utilise des sous-traitants soigneusement sélectionnés pour
        fournir nos services. Tous les sous-traitants sont liés par des accords
        stricts de protection des données :
      </p>
      <ul>
        <li>
          <strong>Gladia (Par défaut) :</strong> Traitement de transcription
          audio (serveurs européens uniquement, mode sans entraînement et sans
          rétention)
        </li>
        <li>
          <strong>ElevenLabs (Alternative) :</strong> Traitement de
          transcription audio (fournisseur alternatif optionnel, avec formation
          désactivée et suppression immédiate)
        </li>
        <li>
          <strong>AWS (Europe) :</strong> Infrastructure et stockage sécurisé
          des données
        </li>
        <li>
          <strong>
            <a
              href="https://auth0.com/docs/secure/data-privacy-and-compliance/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Auth0 Europe
            </a>
            :
          </strong>{" "}
          Authentification et gestion d&apos;identité
        </li>
        <li>
          <strong>OVH (Europe) :</strong> Communications par e-mail
        </li>
      </ul>
      <p>
        Pour une liste complète et actuelle des sous-traitants, consultez notre{" "}
        <Link href="/legal/subprocessors">page des sous-traitants de données</Link>.
      </p>

      <h2>Mesures de sécurité</h2>
      <p>HumanLogs met en œuvre plusieurs couches de sécurité :</p>
      <ul>
        <li>
          <strong>Chiffrement en transit :</strong> Tous les transferts de
          données utilisent le chiffrement TLS/SSL
        </li>
        <li>
          <strong>Chiffrement au repos :</strong> Toutes les données stockées
          sont chiffrées en utilisant le chiffrement AES-256
        </li>
        <li>
          <strong>Chiffrement de bout en bout :</strong> Le contenu sensible
          (transcriptions et audio) est chiffré avec des clés contrôlées par
          l&apos;utilisateur
        </li>
        <li>
          <strong>Contrôles d&apos;accès :</strong> Contrôle d&apos;accès basé sur les
          rôles et authentification multi-facteurs
        </li>
        <li>
          <strong>Audits de sécurité réguliers :</strong> Évaluations et mises à
          jour de sécurité continues
        </li>
        <li>
          <strong>Architecture zéro-connaissance :</strong> HumanLogs ne peut
          pas accéder à votre contenu chiffré
        </li>
      </ul>

      <h2>Documentation de conformité</h2>
      <p>Documentation supplémentaire disponible pour l&apos;examen par le CER :</p>
      <ul>
        <li>
          <Link href="/legal/privacy">Politique de confidentialité</Link>
        </li>
        <li>
          <Link href="/legal/terms">Conditions d&apos;utilisation</Link>
        </li>
        <li>
          <Link href="/legal/dpa">Accord de traitement des données (DPA)</Link>
        </li>
        <li>
          <Link href="/legal/subprocessors">Liste des sous-traitants de données</Link>
        </li>
      </ul>

      <h2>Informations de contact</h2>
      <p>
        Pour des informations supplémentaires, des questions ou pour demander
        une documentation spécifique pour votre soumission au CER :
      </p>
      <ul>
        <li>
          <strong>Demandes générales :</strong>{" "}
          <Link href="/contact">Formulaire de contact</Link>
        </li>
        <li>
          <strong>Questions de confidentialité :</strong>{" "}
          <a href="mailto:hello@humanlogs.app">privacy@humanlogs.app</a>
        </li>
        <li>
          <strong>Demandes Entreprise :</strong>{" "}
          <a href="mailto:hello@humanlogs.app">enterprise@humanlogs.app</a>
        </li>
      </ul>

      <h2>Recommandations pour les chercheurs</h2>
      <p>
        Pour les chercheurs utilisant HumanLogs dans des études approuvées par
        un CER, nous recommandons :
      </p>
      <ul>
        <li>
          Informer les participants que les transcriptions seront traitées en
          utilisant un service tiers avec chiffrement de bout en bout
        </li>
        <li>
          Expliquer que l&apos;audio est temporairement traité par un sous-traitant
          mais immédiatement supprimé
        </li>
        <li>
          Maintenir le contrôle de vos clés de chiffrement privées et ne pas les
          partager au-delà des membres autorisés de l&apos;équipe de recherche
        </li>
        <li>
          Utiliser des identifiants de projet uniques plutôt que les noms des
          participants dans les noms de fichiers ou les métadonnées
        </li>
        <li>
          Envisager les options On-Premise ou Entreprise pour les recherches
          hautement sensibles nécessitant des garanties de sécurité
          supplémentaires
        </li>
      </ul>

      <hr className="my-6" />
      <p className="text-sm text-gray-600">
        <em>
          Ce document est fourni pour aider les chercheurs à préparer leurs
          demandes auprès des CER. Il ne constitue pas un conseil juridique. Les
          chercheurs doivent consulter le CER de leur institution et leur
          conseiller juridique pour assurer la conformité aux réglementations
          applicables.
        </em>
      </p>
    </>
  );
}
