import { getBaseTemplate, EmailTemplate } from "./email-templates-base";

type SupportedLanguage = "en" | "fr" | "es" | "de";

const translations = {
  welcome: {
    en: {
      subject: "Welcome to HumanLogs – Let's get you started!",
      title: "Welcome to HumanLogs!",
      preheader: "Get started with fast, confidential transcription",
      greeting: "Hi",
      intro: "We're thrilled to have you join us! 🎉",
      description:
        "HumanLogs is designed to make transcription fast, confidential, and effortless. Whether you're transcribing research interviews, meetings, or lectures, we've got you covered.",
      quickStart: "Quick Start Guide",
      step1:
        "<strong>Check out the tutorial</strong> – Learn the basics of our powerful editor in just a few minutes",
      step2:
        "<strong>Upload your first audio</strong> – Get your transcription in about 2 minutes with 98% accuracy",
      step3:
        "<strong>Edit with ease</strong> – Use our keyboard shortcuts and advanced editing features to refine your transcript",
      whatAwaits: "What's waiting for you:",
      feature1:
        "🔒 <strong>End-to-end encryption</strong> – Your data stays yours, forever",
      feature2:
        "⌨️ <strong>Advanced editing</strong> – 4x faster than traditional editors",
      feature3:
        "🌍 <strong>100+ languages</strong> – Transcribe in any language you need",
      feature4:
        "👥 <strong>Speaker diarization</strong> – Automatic speaker detection and labeling",
      feature5:
        "📁 <strong>Project organization</strong> – Keep your transcriptions organized",
      feature6:
        "📤 <strong>Flexible exports</strong> – PDF, Word, CSV, TXT, and more",
      feature7:
        "🤝 <strong>Collaboration</strong> – Share and work together on transcripts",
      button: "Get Started Now",
      feedback:
        "<strong>💡 We'd love to hear from you!</strong><br>Have a feature request or an idea to make HumanLogs better? Click the feedback button in the app – we read every message and many of our best features come from user suggestions.",
      closing: "Happy transcribing!",
      signature: "Best regards,<br>The HumanLogs Team",
    },
    fr: {
      subject: "Bienvenue sur HumanLogs – Commençons !",
      title: "Bienvenue sur HumanLogs !",
      preheader: "Démarrez avec une transcription rapide et confidentielle",
      greeting: "Bonjour",
      intro: "Nous sommes ravis de vous accueillir ! 🎉",
      description:
        "HumanLogs est conçu pour rendre la transcription rapide, confidentielle et sans effort. Que vous transcriviez des entretiens de recherche, des réunions ou des cours, nous avons ce qu'il vous faut.",
      quickStart: "Guide de démarrage rapide",
      step1:
        "<strong>Découvrez le tutoriel</strong> – Apprenez les bases de notre éditeur puissant en quelques minutes",
      step2:
        "<strong>Téléchargez votre premier audio</strong> – Obtenez votre transcription en environ 2 minutes avec 98% de précision",
      step3:
        "<strong>Éditez facilement</strong> – Utilisez nos raccourcis clavier et fonctionnalités avancées pour affiner votre transcription",
      whatAwaits: "Ce qui vous attend :",
      feature1:
        "🔒 <strong>Chiffrement de bout en bout</strong> – Vos données restent vôtres, pour toujours",
      feature2:
        "⌨️ <strong>Édition avancée</strong> – 4x plus rapide que les éditeurs traditionnels",
      feature3:
        "🌍 <strong>100+ langues</strong> – Transcrivez dans n'importe quelle langue",
      feature4:
        "👥 <strong>Diarisation des locuteurs</strong> – Détection et étiquetage automatiques des locuteurs",
      feature5:
        "📁 <strong>Organisation par projets</strong> – Gardez vos transcriptions organisées",
      feature6:
        "📤 <strong>Exports flexibles</strong> – PDF, Word, CSV, TXT et plus",
      feature7:
        "🤝 <strong>Collaboration</strong> – Partagez et travaillez ensemble sur les transcriptions",
      button: "Commencer maintenant",
      feedback:
        "<strong>💡 Nous aimerions vous entendre !</strong><br>Vous avez une demande de fonctionnalité ou une idée pour améliorer HumanLogs ? Cliquez sur le bouton feedback dans l'application – nous lisons chaque message et beaucoup de nos meilleures fonctionnalités viennent de suggestions d'utilisateurs.",
      closing: "Bonne transcription !",
      signature: "Cordialement,<br>L'équipe HumanLogs",
    },
    es: {
      subject: "¡Bienvenido a HumanLogs – Empecemos!",
      title: "¡Bienvenido a HumanLogs!",
      preheader: "Comienza con transcripción rápida y confidencial",
      greeting: "Hola",
      intro: "¡Estamos encantados de tenerte con nosotros! 🎉",
      description:
        "HumanLogs está diseñado para hacer la transcripción rápida, confidencial y sin esfuerzo. Ya sea que transcribas entrevistas de investigación, reuniones o conferencias, te tenemos cubierto.",
      quickStart: "Guía de inicio rápido",
      step1:
        "<strong>Prueba el tutorial</strong> – Aprende lo básico de nuestro potente editor en solo unos minutos",
      step2:
        "<strong>Sube tu primer audio</strong> – Obtén tu transcripción en aproximadamente 2 minutos con 98% de precisión",
      step3:
        "<strong>Edita con facilidad</strong> – Usa nuestros atajos de teclado y funciones avanzadas para refinar tu transcripción",
      whatAwaits: "Lo que te espera:",
      feature1:
        "🔒 <strong>Cifrado de extremo a extremo</strong> – Tus datos son tuyos, para siempre",
      feature2:
        "⌨️ <strong>Edición avanzada</strong> – 4x más rápido que los editores tradicionales",
      feature3:
        "🌍 <strong>100+ idiomas</strong> – Transcribe en cualquier idioma que necesites",
      feature4:
        "👥 <strong>Diarización de hablantes</strong> – Detección y etiquetado automático de hablantes",
      feature5:
        "📁 <strong>Organización por proyectos</strong> – Mantén tus transcripciones organizadas",
      feature6:
        "📤 <strong>Exportaciones flexibles</strong> – PDF, Word, CSV, TXT y más",
      feature7:
        "🤝 <strong>Colaboración</strong> – Comparte y trabaja juntos en las transcripciones",
      button: "Comenzar ahora",
      feedback:
        "<strong>💡 ¡Nos encantaría escucharte!</strong><br>¿Tienes una solicitud de función o una idea para mejorar HumanLogs? Haz clic en el botón de feedback en la aplicación – leemos cada mensaje y muchas de nuestras mejores funciones provienen de sugerencias de usuarios.",
      closing: "¡Feliz transcripción!",
      signature: "Saludos cordiales,<br>El equipo de HumanLogs",
    },
    de: {
      subject: "Willkommen bei HumanLogs – Legen wir los!",
      title: "Willkommen bei HumanLogs!",
      preheader: "Beginnen Sie mit schneller, vertraulicher Transkription",
      greeting: "Hallo",
      intro: "Wir freuen uns, Sie bei uns begrüßen zu dürfen! 🎉",
      description:
        "HumanLogs ist darauf ausgelegt, Transkription schnell, vertraulich und mühelos zu machen. Ob Sie Forschungsinterviews, Meetings oder Vorlesungen transkribieren – wir haben alles für Sie.",
      quickStart: "Schnellstart-Anleitung",
      step1:
        "<strong>Schauen Sie sich das Tutorial an</strong> – Lernen Sie die Grundlagen unseres leistungsstarken Editors in wenigen Minuten",
      step2:
        "<strong>Laden Sie Ihre erste Audiodatei hoch</strong> – Erhalten Sie Ihre Transkription in etwa 2 Minuten mit 98% Genauigkeit",
      step3:
        "<strong>Bearbeiten Sie mit Leichtigkeit</strong> – Nutzen Sie unsere Tastenkombinationen und erweiterten Bearbeitungsfunktionen",
      whatAwaits: "Was Sie erwartet:",
      feature1:
        "🔒 <strong>Ende-zu-Ende-Verschlüsselung</strong> – Ihre Daten bleiben für immer Ihre",
      feature2:
        "⌨️ <strong>Erweiterte Bearbeitung</strong> – 4x schneller als traditionelle Editoren",
      feature3:
        "🌍 <strong>100+ Sprachen</strong> – Transkribieren Sie in jeder benötigten Sprache",
      feature4:
        "👥 <strong>Sprechererkennung</strong> – Automatische Erkennung und Kennzeichnung von Sprechern",
      feature5:
        "📁 <strong>Projektorganisation</strong> – Halten Sie Ihre Transkriptionen organisiert",
      feature6:
        "📤 <strong>Flexible Exporte</strong> – PDF, Word, CSV, TXT und mehr",
      feature7:
        "🤝 <strong>Zusammenarbeit</strong> – Teilen und arbeiten Sie gemeinsam an Transkriptionen",
      button: "Jetzt starten",
      feedback:
        "<strong>💡 Wir würden gerne von Ihnen hören!</strong><br>Haben Sie einen Funktionswunsch oder eine Idee, um HumanLogs zu verbessern? Klicken Sie auf den Feedback-Button in der App – wir lesen jede Nachricht und viele unserer besten Funktionen stammen von Benutzervorschlägen.",
      closing: "Viel Erfolg beim Transkribieren!",
      signature: "Mit freundlichen Grüßen,<br>Das HumanLogs-Team",
    },
  },
  followUp: {
    en: {
      subject: "How's your transcription experience going?",
      title: "How's it going?",
      preheader: "Explore more of what HumanLogs can do for you",
      greeting: "How's it going,",
      intro:
        "We hope you're enjoying HumanLogs! It's been a week since you joined us, and we wanted to check in to see how things are going.",
      explorePrompt:
        "Have you had a chance to explore our features? Here's a quick reminder of what makes HumanLogs special:",
      privacy: "🔒 Privacy First",
      privacyDesc:
        "Your transcriptions are protected with bank-level end-to-end encryption. We can't access your data even if we wanted to – it's encrypted on your device before it ever reaches our servers.",
      editing: "⚡ Lightning Fast Editing",
      editingDesc:
        "Our editor is designed for speed. Use keyboard shortcuts to navigate between speakers, jump through timestamps, and edit transcripts 4x faster than traditional methods. Perfect for long interviews and research projects.",
      researchers: "🎯 Built for Researchers",
      researchersDesc:
        "Automatic speaker diarization, project organization, flexible exports (including formats for word analysis software), and collaboration features – everything you need for serious research work.",
      global: "🌍 Global & Accurate",
      globalDesc:
        "Support for 100+ languages with 98% accuracy. Whether you're transcribing English, French, Spanish, Mandarin, or any other language, we've got you covered.",
      button: "Continue Transcribing",
      help: "<strong>Need help or have questions?</strong><br>We're here to help! Tell us what you're looking for or what features would make your workflow easier. Use the feedback button in the app, and we'll get back to you quickly.",
      closing: "Looking forward to hearing from you!",
      signature: "Best regards,<br>The HumanLogs Team",
    },
    fr: {
      subject: "Comment se passe votre expérience de transcription ?",
      title: "Comment ça se passe ?",
      preheader: "Découvrez tout ce que HumanLogs peut faire pour vous",
      greeting: "Comment ça se passe,",
      intro:
        "Nous espérons que vous appréciez HumanLogs ! Cela fait une semaine que vous nous avez rejoints, et nous voulions voir comment les choses se passent.",
      explorePrompt:
        "Avez-vous eu l'occasion d'explorer nos fonctionnalités ? Voici un rappel rapide de ce qui rend HumanLogs spécial :",
      privacy: "🔒 La confidentialité d'abord",
      privacyDesc:
        "Vos transcriptions sont protégées par un chiffrement de bout en bout de niveau bancaire. Nous ne pouvons pas accéder à vos données même si nous le voulions – elles sont chiffrées sur votre appareil avant même d'atteindre nos serveurs.",
      editing: "⚡ Édition ultra-rapide",
      editingDesc:
        "Notre éditeur est conçu pour la vitesse. Utilisez les raccourcis clavier pour naviguer entre les locuteurs, sauter dans les horodatages et éditer les transcriptions 4x plus vite que les méthodes traditionnelles. Parfait pour les longs entretiens et projets de recherche.",
      researchers: "🎯 Conçu pour les chercheurs",
      researchersDesc:
        "Diarisation automatique des locuteurs, organisation par projets, exports flexibles (y compris des formats pour les logiciels d'analyse de texte) et fonctionnalités de collaboration – tout ce dont vous avez besoin pour un travail de recherche sérieux.",
      global: "🌍 Global et précis",
      globalDesc:
        "Support pour plus de 100 langues avec 98% de précision. Que vous transcriviez en anglais, français, espagnol, mandarin ou toute autre langue, nous avons ce qu'il vous faut.",
      button: "Continuer la transcription",
      help: "<strong>Besoin d'aide ou avez-vous des questions ?</strong><br>Nous sommes là pour vous aider ! Dites-nous ce que vous recherchez ou quelles fonctionnalités faciliteraient votre flux de travail. Utilisez le bouton feedback dans l'application et nous vous répondrons rapidement.",
      closing: "Au plaisir de vous entendre !",
      signature: "Cordialement,<br>L'équipe HumanLogs",
    },
    es: {
      subject: "¿Cómo va tu experiencia de transcripción?",
      title: "¿Cómo va todo?",
      preheader: "Explora más de lo que HumanLogs puede hacer por ti",
      greeting: "¿Cómo va todo,",
      intro:
        "¡Esperamos que estés disfrutando de HumanLogs! Ha pasado una semana desde que te uniste a nosotros, y queríamos ver cómo van las cosas.",
      explorePrompt:
        "¿Has tenido la oportunidad de explorar nuestras funciones? Aquí hay un recordatorio rápido de lo que hace especial a HumanLogs:",
      privacy: "🔒 Privacidad primero",
      privacyDesc:
        "Tus transcripciones están protegidas con cifrado de extremo a extremo de nivel bancario. No podemos acceder a tus datos aunque quisiéramos – se cifran en tu dispositivo antes de llegar a nuestros servidores.",
      editing: "⚡ Edición ultrarrápida",
      editingDesc:
        "Nuestro editor está diseñado para la velocidad. Usa atajos de teclado para navegar entre hablantes, saltar entre marcas de tiempo y editar transcripciones 4x más rápido que los métodos tradicionales. Perfecto para entrevistas largas y proyectos de investigación.",
      researchers: "🎯 Construido para investigadores",
      researchersDesc:
        "Diarización automática de hablantes, organización de proyectos, exportaciones flexibles (incluyendo formatos para software de análisis de texto) y funciones de colaboración – todo lo que necesitas para trabajo de investigación serio.",
      global: "🌍 Global y preciso",
      globalDesc:
        "Soporte para más de 100 idiomas con 98% de precisión. Ya sea que transcribas en inglés, francés, español, mandarín o cualquier otro idioma, te tenemos cubierto.",
      button: "Continuar transcribiendo",
      help: "<strong>¿Necesitas ayuda o tienes preguntas?</strong><br>¡Estamos aquí para ayudarte! Cuéntanos qué estás buscando o qué funciones harían tu flujo de trabajo más fácil. Usa el botón de feedback en la aplicación y te responderemos rápidamente.",
      closing: "¡Esperamos saber de ti!",
      signature: "Saludos cordiales,<br>El equipo de HumanLogs",
    },
    de: {
      subject: "Wie läuft Ihre Transkriptionserfahrung?",
      title: "Wie läuft es?",
      preheader: "Entdecken Sie mehr von dem, was HumanLogs für Sie tun kann",
      greeting: "Wie läuft es,",
      intro:
        "Wir hoffen, Sie genießen HumanLogs! Es ist eine Woche her, seit Sie zu uns gestoßen sind, und wir wollten nachfragen, wie es läuft.",
      explorePrompt:
        "Hatten Sie die Gelegenheit, unsere Funktionen zu erkunden? Hier ist eine kurze Erinnerung daran, was HumanLogs besonders macht:",
      privacy: "🔒 Datenschutz zuerst",
      privacyDesc:
        "Ihre Transkriptionen sind durch Ende-zu-Ende-Verschlüsselung auf Bankniveau geschützt. Wir können nicht auf Ihre Daten zugreifen, selbst wenn wir wollten – sie werden auf Ihrem Gerät verschlüsselt, bevor sie unsere Server erreichen.",
      editing: "⚡ Blitzschnelle Bearbeitung",
      editingDesc:
        "Unser Editor ist auf Geschwindigkeit ausgelegt. Nutzen Sie Tastenkombinationen, um zwischen Sprechern zu navigieren, durch Zeitstempel zu springen und Transkripte 4x schneller als mit herkömmlichen Methoden zu bearbeiten. Perfekt für lange Interviews und Forschungsprojekte.",
      researchers: "🎯 Für Forscher entwickelt",
      researchersDesc:
        "Automatische Sprechererkennung, Projektorganisation, flexible Exporte (einschließlich Formate für Textanalysesoftware) und Kollaborationsfunktionen – alles, was Sie für ernsthafte Forschungsarbeit benötigen.",
      global: "🌍 Global und genau",
      globalDesc:
        "Unterstützung für über 100 Sprachen mit 98% Genauigkeit. Ob Sie auf Englisch, Französisch, Spanisch, Mandarin oder in jeder anderen Sprache transkribieren, wir haben Sie abgedeckt.",
      button: "Weiter transkribieren",
      help: "<strong>Brauchen Sie Hilfe oder haben Sie Fragen?</strong><br>Wir sind für Sie da! Sagen Sie uns, wonach Sie suchen oder welche Funktionen Ihren Arbeitsablauf erleichtern würden. Nutzen Sie den Feedback-Button in der App und wir melden uns schnell bei Ihnen.",
      closing: "Wir freuen uns, von Ihnen zu hören!",
      signature: "Mit freundlichen Grüßen,<br>Das HumanLogs-Team",
    },
  },
  discount: {
    en: {
      subject:
        "🎁 30% off your HumanLogs subscription – exclusive offer inside",
      title: "30% Off Just for You!",
      preheader: "Exclusive discount code inside: 30LOGS",
      greeting: "Hi",
      intro:
        "We noticed you haven't used all of HumanLogs' capabilities yet, and we'd love to help you get the most out of our platform!",
      offer:
        "To show our appreciation for your interest, we're offering you an <strong>exclusive 30% discount</strong> on any plan:",
      codeTitle: "Your Exclusive Discount Code",
      code: "30LOGS",
      validity: "Valid for 30 days on any plan",
      whyUpgrade: "Why upgrade?",
      benefit1:
        "<strong>More transcription time</strong> – Get up to 20+ hours per month",
      benefit2:
        "<strong>Priority processing</strong> – Your transcriptions get processed first",
      benefit3:
        "<strong>Advanced features</strong> – Custom vocabulary, batch uploads, and more",
      benefit4:
        "<strong>Team collaboration</strong> – Share unlimited transcripts with your team",
      benefit5: "<strong>Priority support</strong> – Get help when you need it",
      button: "Claim Your Discount",
      help: "<strong>Not sure which plan is right for you?</strong><br>We're here to help! Tell us about your use case – whether it's for research, journalism, education, or business – and we'll help you find the perfect fit. Just hit reply or use the feedback button in the app.",
      closing:
        "We're excited to help you transform your transcription workflow!",
      signature: "Best regards,<br>The HumanLogs Team",
      ps: "P.S. This is the last email in our welcome series. If you'd like to stay updated with tips, feature announcements, and special offers, you can always reach out to us through the app!",
    },
    fr: {
      subject:
        "🎁 30% de réduction sur votre abonnement HumanLogs – offre exclusive",
      title: "30% de réduction rien que pour vous !",
      preheader: "Code de réduction exclusif : 30LOGS",
      greeting: "Bonjour",
      intro:
        "Nous avons remarqué que vous n'avez pas encore utilisé toutes les capacités de HumanLogs, et nous aimerions vous aider à tirer le meilleur parti de notre plateforme !",
      offer:
        "Pour montrer notre appréciation de votre intérêt, nous vous offrons une <strong>réduction exclusive de 30%</strong> sur n'importe quel forfait :",
      codeTitle: "Votre code de réduction exclusif",
      code: "30LOGS",
      validity: "Valable pendant 30 jours sur n'importe quel forfait",
      whyUpgrade: "Pourquoi passer à un forfait supérieur ?",
      benefit1:
        "<strong>Plus de temps de transcription</strong> – Jusqu'à 20+ heures par mois",
      benefit2:
        "<strong>Traitement prioritaire</strong> – Vos transcriptions sont traitées en premier",
      benefit3:
        "<strong>Fonctionnalités avancées</strong> – Vocabulaire personnalisé, téléchargements par lots et plus",
      benefit4:
        "<strong>Collaboration d'équipe</strong> – Partagez un nombre illimité de transcriptions avec votre équipe",
      benefit5:
        "<strong>Support prioritaire</strong> – Obtenez de l'aide quand vous en avez besoin",
      button: "Réclamez votre réduction",
      help: "<strong>Vous ne savez pas quel forfait vous convient ?</strong><br>Nous sommes là pour vous aider ! Parlez-nous de votre cas d'utilisation – que ce soit pour la recherche, le journalisme, l'éducation ou les affaires – et nous vous aiderons à trouver le forfait parfait. Répondez simplement ou utilisez le bouton feedback dans l'application.",
      closing:
        "Nous sommes ravis de vous aider à transformer votre flux de travail de transcription !",
      signature: "Cordialement,<br>L'équipe HumanLogs",
      ps: "P.S. C'est le dernier email de notre série de bienvenue. Si vous souhaitez rester informé des conseils, annonces de fonctionnalités et offres spéciales, vous pouvez toujours nous contacter via l'application !",
    },
    es: {
      subject:
        "🎁 30% de descuento en tu suscripción a HumanLogs – oferta exclusiva",
      title: "¡30% de descuento solo para ti!",
      preheader: "Código de descuento exclusivo: 30LOGS",
      greeting: "Hola",
      intro:
        "Notamos que aún no has usado todas las capacidades de HumanLogs, ¡y nos encantaría ayudarte a aprovechar al máximo nuestra plataforma!",
      offer:
        "Para mostrar nuestro agradecimiento por tu interés, te ofrecemos un <strong>descuento exclusivo del 30%</strong> en cualquier plan:",
      codeTitle: "Tu código de descuento exclusivo",
      code: "30LOGS",
      validity: "Válido por 30 días en cualquier plan",
      whyUpgrade: "¿Por qué mejorar?",
      benefit1:
        "<strong>Más tiempo de transcripción</strong> – Hasta 20+ horas por mes",
      benefit2:
        "<strong>Procesamiento prioritario</strong> – Tus transcripciones se procesan primero",
      benefit3:
        "<strong>Funciones avanzadas</strong> – Vocabulario personalizado, cargas por lotes y más",
      benefit4:
        "<strong>Colaboración en equipo</strong> – Comparte transcripciones ilimitadas con tu equipo",
      benefit5:
        "<strong>Soporte prioritario</strong> – Obtén ayuda cuando la necesites",
      button: "Reclama tu descuento",
      help: "<strong>¿No estás seguro de qué plan es el adecuado para ti?</strong><br>¡Estamos aquí para ayudarte! Cuéntanos sobre tu caso de uso – ya sea para investigación, periodismo, educación o negocios – y te ayudaremos a encontrar el plan perfecto. Solo responde o usa el botón de feedback en la aplicación.",
      closing:
        "¡Estamos emocionados de ayudarte a transformar tu flujo de trabajo de transcripción!",
      signature: "Saludos cordiales,<br>El equipo de HumanLogs",
      ps: "P.D. Este es el último correo de nuestra serie de bienvenida. Si deseas mantenerte actualizado con consejos, anuncios de funciones y ofertas especiales, ¡siempre puedes contactarnos a través de la aplicación!",
    },
    de: {
      subject:
        "🎁 30% Rabatt auf Ihr HumanLogs-Abonnement – exklusives Angebot",
      title: "30% Rabatt nur für Sie!",
      preheader: "Exklusiver Rabattcode: 30LOGS",
      greeting: "Hallo",
      intro:
        "Wir haben bemerkt, dass Sie noch nicht alle Möglichkeiten von HumanLogs genutzt haben, und wir würden Ihnen gerne helfen, das Beste aus unserer Plattform herauszuholen!",
      offer:
        "Um unsere Wertschätzung für Ihr Interesse zu zeigen, bieten wir Ihnen einen <strong>exklusiven Rabatt von 30%</strong> auf jeden Plan:",
      codeTitle: "Ihr exklusiver Rabattcode",
      code: "30LOGS",
      validity: "Gültig für 30 Tage auf jedem Plan",
      whyUpgrade: "Warum upgraden?",
      benefit1:
        "<strong>Mehr Transkriptionszeit</strong> – Bis zu 20+ Stunden pro Monat",
      benefit2:
        "<strong>Priorisierte Verarbeitung</strong> – Ihre Transkriptionen werden zuerst verarbeitet",
      benefit3:
        "<strong>Erweiterte Funktionen</strong> – Benutzerdefiniertes Vokabular, Batch-Uploads und mehr",
      benefit4:
        "<strong>Team-Zusammenarbeit</strong> – Teilen Sie unbegrenzt Transkripte mit Ihrem Team",
      benefit5:
        "<strong>Priority-Support</strong> – Erhalten Sie Hilfe, wenn Sie sie brauchen",
      button: "Rabatt einlösen",
      help: "<strong>Nicht sicher, welcher Plan der richtige für Sie ist?</strong><br>Wir sind für Sie da! Erzählen Sie uns von Ihrem Anwendungsfall – ob für Forschung, Journalismus, Bildung oder Geschäft – und wir helfen Ihnen, den perfekten Plan zu finden. Antworten Sie einfach oder nutzen Sie den Feedback-Button in der App.",
      closing:
        "Wir freuen uns darauf, Ihnen zu helfen, Ihren Transkriptions-Workflow zu transformieren!",
      signature: "Mit freundlichen Grüßen,<br>Das HumanLogs-Team",
      ps: "P.S. Dies ist die letzte E-Mail in unserer Willkommensserie. Wenn Sie über Tipps, Funktionsankündigungen und Sonderangebote informiert bleiben möchten, können Sie uns jederzeit über die App erreichen!",
    },
  },
};

/**
 * Create a welcome email template for new users
 */
export function getWelcomeMarketingEmailTemplate(data: {
  userName: string;
  loginUrl: string;
  language?: string;
}): EmailTemplate {
  const lang = (data.language || "en") as SupportedLanguage;
  const supportedLang: SupportedLanguage = ["en", "fr", "es", "de"].includes(
    lang,
  )
    ? lang
    : "en";
  const t = translations.welcome[supportedLang];

  const content = `
    <h2>${t.title}</h2>
    <p>${t.greeting} ${data.userName},</p>
    <p>${t.intro}</p>
    
    <p>${t.description}</p>
    
    <h3 style="margin-top: 30px; margin-bottom: 15px;">${t.quickStart}</h3>
    <ol style="line-height: 2;">
      <li>${t.step1}</li>
      <li>${t.step2}</li>
      <li>${t.step3}</li>
    </ol>
    
    <h3 style="margin-top: 30px; margin-bottom: 15px;">${t.whatAwaits}</h3>
    <ul style="line-height: 2;">
      <li>${t.feature1}</li>
      <li>${t.feature2}</li>
      <li>${t.feature3}</li>
      <li>${t.feature4}</li>
      <li>${t.feature5}</li>
      <li>${t.feature6}</li>
      <li>${t.feature7}</li>
    </ul>
    
    <p style="text-align: center; margin-top: 30px;">
      <a href="${data.loginUrl}" class="button">${t.button}</a>
    </p>
    
    <p style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #667eea; border-radius: 4px;">
      ${t.feedback}
    </p>
    
    <p>${t.closing}</p>
    <p>${t.signature}</p>
  `;

  const html = getBaseTemplate(content, {
    title: t.title,
    preheader: t.preheader,
  });

  const text = `
${t.title}

${t.greeting} ${data.userName},

${t.intro}

${t.description}

${t.quickStart}:
1. ${t.step1.replace(/<\/?strong>/g, "")}
2. ${t.step2.replace(/<\/?strong>/g, "")}
3. ${t.step3.replace(/<\/?strong>/g, "")}

${t.whatAwaits}
• ${t.feature1.replace(/<\/?strong>/g, "")}
• ${t.feature2.replace(/<\/?strong>/g, "")}
• ${t.feature3.replace(/<\/?strong>/g, "")}
• ${t.feature4.replace(/<\/?strong>/g, "")}
• ${t.feature5.replace(/<\/?strong>/g, "")}
• ${t.feature6.replace(/<\/?strong>/g, "")}
• ${t.feature7.replace(/<\/?strong>/g, "")}

${t.button}: ${data.loginUrl}

${t.feedback.replace(/<br>/g, "\n").replace(/<\/?strong>/g, "")}

${t.closing}
${t.signature.replace(/<br>/g, "\n")}
  `.trim();

  return {
    subject: t.subject,
    html,
    text,
  };
}

/**
 * Create a "How is it going?" follow-up email (sent 1 week after signup)
 */
export function getFollowUpEmailTemplate(data: {
  userName: string;
  loginUrl: string;
  language?: string;
}): EmailTemplate {
  const lang = (data.language || "en") as SupportedLanguage;
  const supportedLang: SupportedLanguage = ["en", "fr", "es", "de"].includes(
    lang,
  )
    ? lang
    : "en";
  const t = translations.followUp[supportedLang];

  const content = `
    <h2>${t.greeting} ${data.userName}?</h2>
    <p>${t.intro}</p>
    
    <p>${t.explorePrompt}</p>
    
    <h3 style="margin-top: 30px; margin-bottom: 15px;">${t.privacy}</h3>
    <p>${t.privacyDesc}</p>
    
    <h3 style="margin-top: 25px; margin-bottom: 15px;">${t.editing}</h3>
    <p>${t.editingDesc}</p>
    
    <h3 style="margin-top: 25px; margin-bottom: 15px;">${t.researchers}</h3>
    <p>${t.researchersDesc}</p>
    
    <h3 style="margin-top: 25px; margin-bottom: 15px;">${t.global}</h3>
    <p>${t.globalDesc}</p>
    
    <p style="text-align: center; margin-top: 30px;">
      <a href="${data.loginUrl}" class="button">${t.button}</a>
    </p>
    
    <p style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #667eea; border-radius: 4px;">
      ${t.help}
    </p>
    
    <p>${t.closing}</p>
    <p>${t.signature}</p>
  `;

  const html = getBaseTemplate(content, {
    title: t.title,
    preheader: t.preheader,
  });

  const text = `
${t.greeting} ${data.userName}?

${t.intro}

${t.explorePrompt}

${t.privacy}
${t.privacyDesc}

${t.editing}
${t.editingDesc}

${t.researchers}
${t.researchersDesc}

${t.global}
${t.globalDesc}

${t.button}: ${data.loginUrl}

${t.help.replace(/<br>/g, "\n").replace(/<\/?strong>/g, "")}

${t.closing}
${t.signature.replace(/<br>/g, "\n")}
  `.trim();

  return {
    subject: t.subject,
    html,
    text,
  };
}

/**
 * Create a "Still looking around?" email with discount (sent 2 weeks after signup, 3 weeks total)
 */
export function getDiscountEmailTemplate(data: {
  userName: string;
  loginUrl: string;
  language?: string;
}): EmailTemplate {
  const lang = (data.language || "en") as SupportedLanguage;
  const supportedLang: SupportedLanguage = ["en", "fr", "es", "de"].includes(lang) ? lang : "en";
  const t = translations.discount[supportedLang];

  const content = `
    <h2>${t.intro.split(',')[0]} 🎁</h2>
    <p>${t.greeting} ${data.userName},</p>
    
    <p>${t.intro}</p>
    
    <p>${t.offer}</p>
    
    <div style="text-align: center; margin: 30px 0; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
      <p style="color: white; font-size: 18px; margin: 0 0 10px 0; font-weight: 600;">${t.codeTitle}</p>
      <p style="color: white; font-size: 32px; font-weight: bold; letter-spacing: 3px; margin: 10px 0; font-family: monospace;">${t.code}</p>
      <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 10px 0 0 0;">${t.validity}</p>
    </div>
    
    <h3 style="margin-top: 30px; margin-bottom: 15px;">${t.whyUpgrade}</h3>
    <ul style="line-height: 2;">
      <li>${t.benefit1}</li>
      <li>${t.benefit2}</li>
      <li>${t.benefit3}</li>
      <li>${t.benefit4}</li>
      <li>${t.benefit5}</li>
    </ul>
    
    <p style="text-align: center; margin-top: 30px;">
      <a href="${data.loginUrl}" class="button">${t.button}</a>
    </p>
    
    <p style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #667eea; border-radius: 4px;">
      ${t.help}
    </p>
    
    <p>${t.closing}</p>
    <p>${t.signature}</p>
    
    <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
      ${t.ps}
    </p>
  `;

  const html = getBaseTemplate(content, {
    title: t.title,
    preheader: t.preheader,
  });

  const text = `
${t.intro.split(',')[0]}!

${t.greeting} ${data.userName},

${t.intro}

${t.offer.replace(/<\/?strong>/g, '')}

${t.codeTitle.toUpperCase()}: ${t.code}
(${t.validity})

${t.whyUpgrade}
• ${t.benefit1.replace(/<\/?strong>/g, '')}
• ${t.benefit2.replace(/<\/?strong>/g, '')}
• ${t.benefit3.replace(/<\/?strong>/g, '')}
• ${t.benefit4.replace(/<\/?strong>/g, '')}
• ${t.benefit5.replace(/<\/?strong>/g, '')}

${t.button}: ${data.loginUrl}

${t.help.replace(/<br>/g, '\n').replace(/<\/?strong>/g, '')}

${t.closing}

${t.signature.replace(/<br>/g, '\n')}

${t.ps}
  `.trim();

  return {
    subject: t.subject,
    html,
    text,
  };
}
