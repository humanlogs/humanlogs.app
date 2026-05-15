"use client";

import Image from "next/image";
import { useTranslations } from "@/components/locale-provider";

export const LogoSection = () => {
  const t = useTranslations("logos");
  const logos = [
    {
      name: "Université Côte d'Azur",
      src: "/landing/logos/nice.jpg",
      width: 220,
      height: 60,
    },
    {
      name: "Université Paris Cité",
      src: "/landing/logos/paris-cite.jpg",
      width: 220,
      height: 80,
    },
    {
      name: "Université Paris Cergy",
      src: "/landing/logos/cergy.png",
      width: 220,
      height: 80,
    },
    {
      name: "Washington University",
      src: "/landing/logos/washington.png",
      width: 220,
      height: 80,
    },
    {
      name: "Université Paris 8",
      src: "/landing/logos/paris-8.png",
      width: 180,
      height: 60,
    },
    {
      name: "Université de Strasbourg",
      src: "/landing/logos/strasbourg.png",
      width: 200,
      height: 60,
    },
    {
      name: "Université de Toulouse",
      src: "/landing/logos/toulouse.png",
      width: 220,
      height: 70,
    },
  ];

  return (
    <section className="border-y border-gray-200 bg-gray-50 py-12">
      <div className="w-full">
        <p className="container mx-auto px-4 md:px-6 mb-8 text-center text-sm font-medium text-gray-500">
          {t("trustedBy")}
        </p>
        <div className="relative overflow-hidden">
          <div className="flex animate-logo-slide items-center gap-12 md:gap-16">
            {/* First set of logos */}
            {logos.map((logo, index) => (
              <div
                key={`${logo.name}-${index}`}
                className="flex flex-shrink-0 items-center justify-center opacity-60 grayscale transition-all duration-300 hover:opacity-80 hover:grayscale-0"
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={logo.width}
                  height={logo.height}
                  className="object-contain"
                />
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {logos.map((logo, index) => (
              <div
                key={`${logo.name}-duplicate-${index}`}
                className="flex flex-shrink-0 items-center justify-center opacity-60 grayscale transition-all duration-300 hover:opacity-80 hover:grayscale-0"
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={logo.width}
                  height={logo.height}
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
