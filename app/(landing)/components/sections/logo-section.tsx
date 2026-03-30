import Image from "next/image";

export const LogoSection = () => {
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
      <div className="container mx-auto px-4 md:px-6">
        <p className="mb-8 text-center text-sm font-medium text-gray-500">
          TRUSTED BY RESEARCHERS AT
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center justify-center opacity-60 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300"
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
    </section>
  );
};
