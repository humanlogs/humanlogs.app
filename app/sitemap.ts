import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only use locale prefixes (no empty string since / redirects to /en)
  const localesPrefixes = ["/en", "/fr", "/es", "/de"];
  let localizedRoutes = [];

  for (const prefix of localesPrefixes) {
    const baseUrl =
      (process.env.NEXT_PUBLIC_APP_URL || "https://humanlogs.app") + prefix;

    // Static routes with priorities
    const routes: MetadataRoute.Sitemap = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/pricing`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.9,
      },
      {
        url: `${baseUrl}/contact`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/alternatives`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/tools`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/use-cases`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/resources`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      },
    ];

    // Alternative pages
    const alternatives = [
      "goodtapeio",
      "otterai",
      "speakr",
      "transcribecom",
      "vookai",
    ];
    alternatives.forEach((alt) => {
      routes.push({
        url: `${baseUrl}/alternatives/${alt}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    });

    // Use case pages
    const useCases = ["education", "journalism", "podcasting", "research"];
    useCases.forEach((useCase) => {
      routes.push({
        url: `${baseUrl}/use-cases/${useCase}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    });

    // Tool conversion pages
    const toolConversions = [
      "video-to-audio",
      "audio-compression",
      "mp3-to-wav",
      "wav-to-mp3",
      "m4a-to-mp3",
      "flac-to-mp3",
      "ogg-to-mp3",
      "aac-to-mp3",
    ];
    toolConversions.forEach((tool) => {
      routes.push({
        url: `${baseUrl}/tools/${tool}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    });

    // SRT tester tool
    routes.push({
      url: `${baseUrl}/tools/srt-tester`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    });

    // Legal pages
    const legalPages = ["terms", "privacy", "cookies", "dpa", "subprocessors"];
    legalPages.forEach((page) => {
      routes.push({
        url: `${baseUrl}/legal/${page}`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.3,
      });
    });

    localizedRoutes.push(...routes);
  }

  return localizedRoutes;
}
