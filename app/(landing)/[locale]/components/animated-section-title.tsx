"use client";

import { useEffect, useState, useRef } from "react";

interface AnimatedSectionTitleProps {
  children: string;
  className?: string;
  badge?: {
    icon?: React.ComponentType<{ className?: string }>;
    text: string;
    className?: string;
  };
  subtitle?: string;
}

export const AnimatedSectionTitle = ({
  children,
  className = "",
  badge,
  subtitle,
}: AnimatedSectionTitleProps) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
          }
        });
      },
      { threshold: 0.3 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [hasAnimated]);

  useEffect(() => {
    if (!hasAnimated) return;

    const words = children.split(" ");
    currentIndexRef.current = 0;

    const showNextWord = () => {
      if (currentIndexRef.current < words.length) {
        setActiveWordIndex(currentIndexRef.current);
        currentIndexRef.current++;
        const delay = 100 + Math.random() * 50; // Slight variation in timing
        timeoutRef.current = setTimeout(showNextWord, delay);
      } else {
        // After animation completes, set to -1 to show all words normally
        timeoutRef.current = setTimeout(() => {
          setActiveWordIndex(-1);
        }, 300);
      }
    };

    showNextWord();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [hasAnimated, children]);

  const words = children.split(" ");
  const isAnimating = activeWordIndex >= 0 && activeWordIndex < words.length;
  const hasCompleted = activeWordIndex === -1 && hasAnimated;

  const BadgeIcon = badge?.icon;

  return (
    <div ref={containerRef} className="text-center mb-16">
      {badge && (
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 ${
            badge.className || "bg-green-100"
          }`}
        >
          {BadgeIcon && <BadgeIcon className="h-4 w-4" />}
          <span className="text-sm font-medium">{badge.text}</span>
        </div>
      )}
      <h2
        className={`text-3xl font-bold tracking-tight md:text-4xl mb-4 ${className}`}
      >
        {words.map((word, index) => {
          const isActive = index === activeWordIndex;
          const isPast = hasCompleted || index < activeWordIndex;
          const isFuture = !hasAnimated || index > activeWordIndex;

          return (
            <span
              key={index}
              className={`
                inline-block transition-all duration-200 mx-1
                ${
                  isActive
                    ? "bg-[color-mix(in_oklab,_currentColor_20%,_transparent)] outline outline-2 outline-[color-mix(in_oklab,_currentColor_40%,_transparent)] outline-offset-2 rounded-md px-1"
                    : ""
                }
                ${isFuture ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}
                ${isPast && !isActive ? "opacity-100" : ""}
              `}
              style={{
                transitionDelay: isActive ? "0ms" : `${index * 20}ms`,
              }}
            >
              {word}
            </span>
          );
        })}
      </h2>
      {subtitle && (
        <p
          className={`text-lg text-gray-600 max-w-3xl mx-auto transition-all duration-500 ${
            hasAnimated
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
          style={{
            transitionDelay: `${words.length * 100}ms`,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
