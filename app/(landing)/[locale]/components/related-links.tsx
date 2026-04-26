import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RelatedLink {
  title: string;
  description: string;
  href: string;
}

interface RelatedLinksProps {
  title?: string;
  links: RelatedLink[];
  columns?: 2 | 3;
}

export const RelatedLinks = ({
  title = "Related Resources",
  links,
  columns = 2,
}: RelatedLinksProps) => {
  return (
    <section className="bg-gray-50 border-t py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-black mb-8">{title}</h2>
          <div
            className={`grid gap-6 ${columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
          >
            {links.map((link, index) => (
              <Link key={index} href={link.href}>
                <Card className="p-6 h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg text-black group-hover:text-blue-600 transition-colors">
                      {link.title}
                    </h3>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-sm text-gray-600">{link.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
