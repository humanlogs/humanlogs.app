import { EmailTemplate, getBaseTemplate } from "./email-templates-base";

type EmailLocale = "en" | "fr" | "es" | "de";

/** Normalize a user language (e.g. "fr", "en-US") to a supported email locale. */
function normalizeEmailLocale(locale?: string): EmailLocale {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("de")) return "de";
  return "en";
}

/** Human label for the model region (EU = Gladia/Whisper, US = ElevenLabs). */
function modelRegionLabel(region: "eu" | "us", locale: EmailLocale): string {
  const labels = {
    eu: {
      en: "🇪🇺 EU model",
      fr: "🇪🇺 modèle UE",
      es: "🇪🇺 modelo UE",
      de: "🇪🇺 EU-Modell",
    },
    us: {
      en: "🇺🇸 US model",
      fr: "🇺🇸 modèle US",
      es: "🇺🇸 modelo EE. UU.",
      de: "🇺🇸 US-Modell",
    },
  };
  return labels[region][locale];
}

/** Escape a user-supplied string for safe embedding in HTML email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Create a referral invitation email template.
 * NOTE: inviterName is user-supplied and sent to third parties, so it is
 * HTML-escaped here and the caller strips control characters.
 */
export function getReferralInviteEmailTemplate(data: {
  inviterName: string;
  signupUrl: string;
}): EmailTemplate {
  const inviterName = escapeHtml(data.inviterName);
  const content = `
    <h2>${inviterName} invited you to HumanLogs</h2>
    <p>Hi,</p>
    <p><strong>${inviterName}</strong> is using HumanLogs to transcribe interviews and thinks you'd like it too.</p>
    <p>HumanLogs offers fast, confidential transcription for research interviews — with end-to-end encryption so your data never leaves your computer unencrypted.</p>
    <p style="text-align: center;"><a href="${data.signupUrl}" class="button">Create your free account</a></p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "You've been invited to HumanLogs",
    preheader: `${inviterName} invited you to HumanLogs`,
  });

  const text = `
${data.inviterName} invited you to HumanLogs

Hi,

${data.inviterName} is using HumanLogs to transcribe interviews and thinks you'd like it too.

HumanLogs offers fast, confidential transcription for research interviews — with end-to-end encryption so your data never leaves your computer unencrypted.

Create your free account: ${data.signupUrl}

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: `${data.inviterName} invited you to HumanLogs`,
    html,
    text,
  };
}

/**
 * Create a welcome email template
 */
export function getWelcomeEmailTemplate(data: {
  userName: string;
  loginUrl?: string;
}): EmailTemplate {
  const content = `
    <h2>Welcome to HumanLogs!</h2>
    <p>Hi ${data.userName},</p>
    <p>Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.</p>
    ${
      data.loginUrl
        ? `<p style="text-align: center;"><a href="${data.loginUrl}" class="button">Get Started</a></p>`
        : ""
    }
    <p>If you have any questions, feel free to reach out to our support team.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Welcome!",
    preheader: "Welcome to HumanLogs",
  });

  const text = `
Welcome to HumanLogs!

Hi ${data.userName},

Welcome aboard! We're excited to have you on our platform. You can now start transcribing your audio files with ease.

${data.loginUrl ? `Get started: ${data.loginUrl}` : ""}

If you have any questions, feel free to reach out to our support team.

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: "Welcome to HumanLogs!",
    html,
    text,
  };
}

/**
 * Create a password reset email template
 */
export function getPasswordResetEmailTemplate(data: {
  userName: string;
  resetUrl: string;
  expiresIn?: string;
}): EmailTemplate {
  const expiresIn = data.expiresIn || "1 hour";

  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi ${data.userName},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p style="text-align: center;">
      <a href="${data.resetUrl}" class="button">Reset Password</a>
    </p>
    <p>This link will expire in ${expiresIn}.</p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Reset Your Password",
    preheader: "Reset your password for HumanLogs",
  });

  const text = `
Reset Your Password

Hi ${data.userName},

We received a request to reset your password. Click the link below to create a new password:

${data.resetUrl}

This link will expire in ${expiresIn}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: "Reset Your Password",
    html,
    text,
  };
}

/**
 * Create a transcription completed email template.
 *
 * Intentionally minimal: it does not reveal the file name or any transcript
 * content — only the audio length and which model region processed it.
 */
export function getTranscriptionCompletedEmailTemplate(data: {
  transcriptionUrl: string;
  durationMinutes?: number;
  modelRegion: "eu" | "us";
  locale?: string;
}): EmailTemplate {
  const locale = normalizeEmailLocale(data.locale);
  const model = modelRegionLabel(data.modelRegion, locale);

  const strings = {
    en: {
      subject: "Your transcription is ready",
      title: "Transcription ready",
      ready: data.durationMinutes
        ? `Your ${data.durationMinutes}-minute file is ready.`
        : "Your file is ready.",
      model: `Model used: ${model}.`,
      button: "View transcription",
      feedbackErrors:
        "A quick heads-up: transcription quality can vary depending on the model used, and a few mistakes may remain. HumanLogs is still a young tool, and I'm improving it week after week.",
      feedbackInvite:
        "That's exactly why your feedback means so much to me. If something looks off, if you have an idea, a frustration, or simply a question, just reply to this email — I read and personally answer every single message.",
      signOff: "Looking forward to hearing from you,",
      signName: "Romaric — founder of HumanLogs",
    },
    fr: {
      subject: "Votre transcription est prête",
      title: "Transcription prête",
      ready: data.durationMinutes
        ? `Votre fichier de ${data.durationMinutes} minute${data.durationMinutes > 1 ? "s" : ""} est prêt.`
        : "Votre fichier est prêt.",
      model: `Modèle utilisé : ${model}.`,
      button: "Voir la transcription",
      feedbackErrors:
        "Une petite précision : la qualité de la transcription peut varier selon le modèle utilisé, et il peut rester quelques erreurs. HumanLogs est encore un outil jeune, que j'améliore semaine après semaine.",
      feedbackInvite:
        "C'est justement pour cela que votre avis compte énormément pour moi. Si quelque chose vous semble étrange, si vous avez une idée, une frustration, ou simplement une question, répondez directement à cet e-mail : je lis et je réponds personnellement à chaque message.",
      signOff: "Au plaisir d'échanger,",
      signName: "Romaric — fondateur de HumanLogs",
    },
    es: {
      subject: "Tu transcripción está lista",
      title: "Transcripción lista",
      ready: data.durationMinutes
        ? `Tu archivo de ${data.durationMinutes} minuto${data.durationMinutes > 1 ? "s" : ""} está listo.`
        : "Tu archivo está listo.",
      model: `Modelo utilizado: ${model}.`,
      button: "Ver transcripción",
      feedbackErrors:
        "Un apunte: la calidad de la transcripción puede variar según el modelo utilizado, y pueden quedar algunos errores. HumanLogs es todavía una herramienta joven, que mejoro semana tras semana.",
      feedbackInvite:
        "Precisamente por eso tu opinión significa muchísimo para mí. Si algo te parece raro, si tienes una idea, una frustración o simplemente una pregunta, responde directamente a este correo: leo y contesto personalmente cada mensaje.",
      signOff: "Un saludo y espero tu mensaje,",
      signName: "Romaric — fundador de HumanLogs",
    },
    de: {
      subject: "Ihre Transkription ist fertig",
      title: "Transkription fertig",
      ready: data.durationMinutes
        ? `Ihre Datei mit ${data.durationMinutes} Minute${data.durationMinutes > 1 ? "n" : ""} ist fertig.`
        : "Ihre Datei ist fertig.",
      model: `Verwendetes Modell: ${model}.`,
      button: "Transkription ansehen",
      feedbackErrors:
        "Ein kurzer Hinweis: Die Qualität der Transkription kann je nach verwendetem Modell variieren, und es können einige Fehler verbleiben. HumanLogs ist noch ein junges Tool, das ich Woche für Woche verbessere.",
      feedbackInvite:
        "Genau deshalb ist mir Ihre Meinung so wichtig. Wenn Ihnen etwas seltsam vorkommt, wenn Sie eine Idee, einen Kritikpunkt oder einfach eine Frage haben, antworten Sie direkt auf diese E-Mail – ich lese und beantworte jede Nachricht persönlich.",
      signOff: "Ich freue mich auf Ihre Nachricht,",
      signName: "Romaric — Gründer von HumanLogs",
    },
  }[locale];

  const content = `
    <h2>${strings.title}</h2>
    <p>${strings.ready}</p>
    <p>${strings.model}</p>
    <p style="text-align: center;">
      <a href="${data.transcriptionUrl}" class="button">${strings.button}</a>
    </p>
    <p>${strings.feedbackErrors}</p>
    <p>${strings.feedbackInvite}</p>
    <p>${strings.signOff}<br>${strings.signName}</p>
  `;

  const html = getBaseTemplate(content, {
    title: strings.subject,
    preheader: strings.ready,
  });

  const text = `${strings.title}

${strings.ready}
${strings.model}

${data.transcriptionUrl}

${strings.feedbackErrors}

${strings.feedbackInvite}

${strings.signOff}
${strings.signName}`.trim();

  return { subject: strings.subject, html, text };
}

/**
 * Create a transcription failed email template. Warm and reassuring, and
 * actively invites a reply since failures are exactly when feedback helps most.
 */
export function getTranscriptionFailedEmailTemplate(data: {
  transcriptionUrl: string;
  durationMinutes?: number;
  modelRegion: "eu" | "us";
  locale?: string;
}): EmailTemplate {
  const locale = normalizeEmailLocale(data.locale);
  const model = modelRegionLabel(data.modelRegion, locale);

  const strings = {
    en: {
      subject: "There was a problem with your transcription",
      title: "Transcription failed",
      body: "Something went wrong while processing your transcription. You can try again by uploading your file once more — sometimes it's just a hiccup.",
      model: `Model used: ${model}.`,
      button: "View details",
      feedbackInvite:
        "These things can happen depending on the model or the file, and HumanLogs is still a young tool I'm improving every week. If it keeps failing — or even if you're just unsure what went wrong — reply directly to this email. I read every message personally and I'll help you get it working.",
      signOff: "Sorry for the hiccup, and talk soon,",
      signName: "Romaric — founder of HumanLogs",
    },
    fr: {
      subject: "Un problème avec votre transcription",
      title: "Échec de la transcription",
      body: "Une erreur s'est produite lors du traitement de votre transcription. Vous pouvez réessayer en téléchargeant à nouveau votre fichier — il s'agit parfois d'un simple incident passager.",
      model: `Modèle utilisé : ${model}.`,
      button: "Voir les détails",
      feedbackInvite:
        "Cela peut arriver selon le modèle ou le fichier, et HumanLogs est encore un outil jeune que j'améliore chaque semaine. Si l'erreur persiste — ou même si vous n'êtes pas sûr de ce qui s'est passé — répondez directement à cet e-mail. Je lis chaque message personnellement et je vous aiderai à le faire fonctionner.",
      signOff: "Désolé pour la gêne, et à très vite,",
      signName: "Romaric — fondateur de HumanLogs",
    },
    es: {
      subject: "Hubo un problema con tu transcripción",
      title: "La transcripción falló",
      body: "Algo salió mal al procesar tu transcripción. Puedes volver a intentarlo subiendo el archivo de nuevo — a veces es solo un contratiempo puntual.",
      model: `Modelo utilizado: ${model}.`,
      button: "Ver detalles",
      feedbackInvite:
        "Esto puede ocurrir según el modelo o el archivo, y HumanLogs es todavía una herramienta joven que mejoro cada semana. Si el error persiste — o incluso si no estás seguro de qué pasó — responde directamente a este correo. Leo cada mensaje personalmente y te ayudaré a que funcione.",
      signOff: "Perdona las molestias, y hablamos pronto,",
      signName: "Romaric — fundador de HumanLogs",
    },
    de: {
      subject: "Es gab ein Problem mit Ihrer Transkription",
      title: "Transkription fehlgeschlagen",
      body: "Beim Verarbeiten Ihrer Transkription ist etwas schiefgelaufen. Sie können es erneut versuchen, indem Sie Ihre Datei noch einmal hochladen — manchmal ist es nur eine kurze Störung.",
      model: `Verwendetes Modell: ${model}.`,
      button: "Details ansehen",
      feedbackInvite:
        "So etwas kann je nach Modell oder Datei passieren, und HumanLogs ist noch ein junges Tool, das ich jede Woche verbessere. Wenn der Fehler weiterhin auftritt – oder wenn Sie einfach nicht sicher sind, was schiefgelaufen ist – antworten Sie direkt auf diese E-Mail. Ich lese jede Nachricht persönlich und helfe Ihnen, es zum Laufen zu bringen.",
      signOff: "Entschuldigen Sie die Unannehmlichkeiten, bis bald,",
      signName: "Romaric — Gründer von HumanLogs",
    },
  }[locale];

  const content = `
    <h2>${strings.title}</h2>
    <p>${strings.body}</p>
    <p>${strings.model}</p>
    <p style="text-align: center;">
      <a href="${data.transcriptionUrl}" class="button">${strings.button}</a>
    </p>
    <p>${strings.feedbackInvite}</p>
    <p>${strings.signOff}<br>${strings.signName}</p>
  `;

  const html = getBaseTemplate(content, {
    title: strings.subject,
    preheader: strings.body,
  });

  const text = `${strings.title}

${strings.body}
${strings.model}

${data.transcriptionUrl}

${strings.feedbackInvite}

${strings.signOff}
${strings.signName}`.trim();

  return { subject: strings.subject, html, text };
}

/**
 * Create a generic notification email template
 */
export function getNotificationEmailTemplate(data: {
  userName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): EmailTemplate {
  const content = `
    <h2>${data.title}</h2>
    <p>Hi ${data.userName},</p>
    <p>${data.message}</p>
    ${
      data.actionUrl && data.actionText
        ? `<p style="text-align: center;"><a href="${data.actionUrl}" class="button">${data.actionText}</a></p>`
        : ""
    }
    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: data.title,
    preheader: data.message,
  });

  const text = `
${data.title}

Hi ${data.userName},

${data.message}

${data.actionUrl && data.actionText ? `${data.actionText}: ${data.actionUrl}` : ""}

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: data.title,
    html,
    text,
  };
}

/**
 * Create an account deletion confirmation email template
 */
export function getAccountDeletionEmailTemplate(data: {
  userName: string;
  confirmationUrl: string;
  expiresIn?: string;
}): EmailTemplate {
  const expiresIn = data.expiresIn || "24 hours";

  const content = `
    <h2 style="color: #dc2626;">Account Deletion Request</h2>
    <p>Hi ${data.userName},</p>
    <p>We received a request to permanently delete your account and all associated data.</p>
    
    <p><strong>This action cannot be undone.</strong> Once confirmed, the following will be permanently deleted:</p>
    <ul style="color: #6b7280; line-height: 1.8;">
      <li>All your transcriptions</li>
      <li>All audio files</li>
      <li>Your account settings</li>
      <li>All project data</li>
      <li>Your encryption keys</li>
    </ul>

    <p>If you want to proceed with the deletion, click the button below:</p>
    <p style="text-align: center;">
      <a href="${data.confirmationUrl}" class="button" style="background: #dc2626;">
        Confirm Account Deletion
      </a>
    </p>

    <p style="color: #6b7280; font-size: 14px;">
      <strong>Note:</strong> This link will expire in ${expiresIn}. If you did not request this deletion, 
      you can safely ignore this email and your account will remain active.
    </p>

    <p>If you have any questions or concerns, please contact our support team.</p>

    <p>Best regards,<br>HumanLogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Account Deletion Request",
    preheader: "Confirm your account deletion request",
  });

  const text = `
Account Deletion Request

Hi ${data.userName},

We received a request to permanently delete your account and all associated data.

**This action cannot be undone.** Once confirmed, the following will be permanently deleted:

- All your transcriptions
- All audio files
- Your account settings
- All project data
- Your encryption keys

If you want to proceed with the deletion, click the link below:
${data.confirmationUrl}

Note: This link will expire in ${expiresIn}. If you did not request this deletion, 
you can safely ignore this email and your account will remain active.

If you have any questions or concerns, please contact our support team.

Best regards,
HumanLogs Team
  `.trim();

  return {
    subject: "Confirm Account Deletion",
    html,
    text,
  };
}

/**
 * Create a contact form email template (for admin notification)
 */
export function getContactEmailTemplate(data: {
  fullName: string;
  email: string;
  organization: string;
  useCase: string;
  message: string;
}): EmailTemplate {
  const useCaseLabels: Record<string, string> = {
    journalism: "Journalism",
    legal: "Legal",
    government: "Government",
    research: "Research",
  };

  const useCaseLabel = useCaseLabels[data.useCase] || data.useCase;

  const content = `
    <h2>New Contact Form Submission</h2>
    <p>You have received a new message from the contact form:</p>
    
    <div style="background-color: #f9fafb; border-left: 4px solid #000000; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 8px 0;"><strong>Name:</strong> ${data.fullName}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${data.email}" style="color: #000000;">${data.email}</a></p>
      <p style="margin: 8px 0;"><strong>Organization:</strong> ${data.organization}</p>
      <p style="margin: 8px 0;"><strong>Use Case:</strong> ${useCaseLabel}</p>
    </div>

    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
      <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.message}</p>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Reply directly to this email to respond to ${data.fullName}.
    </p>
  `;

  const html = getBaseTemplate(content, {
    title: "New Contact Form Submission",
    preheader: `New message from ${data.fullName}`,
    footerText: "This is an automated notification from your contact form.",
  });

  const text = `
New Contact Form Submission

You have received a new message from the contact form:

Name: ${data.fullName}
Email: ${data.email}
Organization: ${data.organization}
Use Case: ${useCaseLabel}

Message:
${data.message}

---
Reply directly to this email to respond to ${data.fullName}.
  `.trim();

  return {
    subject: `Contact Form: ${data.fullName} - ${useCaseLabel}`,
    html,
    text,
  };
}

/**
 * Create a contact confirmation email template (for user)
 */
export function getContactConfirmationTemplate(data: {
  fullName: string;
}): EmailTemplate {
  const content = `
    <h2>We've Received Your Message</h2>
    <p>Hi ${data.fullName},</p>
    <p>Thank you for contacting us! We've received your message and our team will review it shortly.</p>
    <p>We typically respond within 1-2 business days. In the meantime, feel free to explore our resources:</p>
    
    <ul style="color: #374151; line-height: 1.8; margin: 20px 0;">
      <li><a href="https://humanlogs.app" style="color: #000000; text-decoration: none;">Visit our website</a></li>
      <li><a href="https://github.com/humanlogs" style="color: #000000; text-decoration: none;">Check out our GitHub</a></li>
      <li><a href="https://humanlogs.app/pricing" style="color: #000000; text-decoration: none;">View pricing plans</a></li>
    </ul>

    <p>If you have any urgent questions, you can reply directly to this email.</p>
    
    <p>Best regards,<br>The Humanlogs Team</p>
  `;

  const html = getBaseTemplate(content, {
    title: "Message Received",
    preheader: "We've received your message and will be in touch soon",
    footerText:
      "You're receiving this email because you contacted us through our website.",
  });

  const text = `
We've Received Your Message

Hi ${data.fullName},

Thank you for contacting us! We've received your message and our team will review it shortly.

We typically respond within 1-2 business days. In the meantime, feel free to explore our resources:

- Visit our website: https://humanlogs.app
- Check out our GitHub: https://github.com/humanlogs
- View pricing plans: https://humanlogs.app/pricing

If you have any urgent questions, you can reply directly to this email.

Best regards,
The Humanlogs Team
  `.trim();

  return {
    subject: "Thank you for contacting Humanlogs",
    html,
    text,
  };
}
