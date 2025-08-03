import type { SVGProps } from "react";

interface LogoProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

export function Logo({ className = "h-8 w-auto", ...props }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Main icon - speech bubble with sound waves */}
      <g>
        {/* Speech bubble */}
        <path
          d="M15 12c0-4.418 3.582-8 8-8h20c4.418 0 8 3.582 8 8v16c0 4.418-3.582 8-8 8H31l-6 6v-6h-2c-4.418 0-8-3.582-8-8V12z"
          fill="currentColor"
          className="text-primary"
        />

        {/* Sound waves inside bubble */}
        <g className="text-white">
          <path
            d="M26 16h12M26 20h8M26 24h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* External sound waves */}
        <g className="text-primary opacity-60">
          <path
            d="M55 16c2 2 2 6 0 8M59 12c4 4 4 12 0 16M63 8c6 6 6 18 0 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </g>

      {/* Text */}
      <g className="text-foreground">
        <text x="80" y="35" className="font-bold text-2xl" fill="currentColor">
          totext.app
        </text>
      </g>
    </svg>
  );
}

export function LogoIcon({ className = "h-8 w-8", ...props }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Speech bubble */}
      <path
        d="M15 12c0-4.418 3.582-8 8-8h20c4.418 0 8 3.582 8 8v16c0 4.418-3.582 8-8 8H31l-6 6v-6h-2c-4.418 0-8-3.582-8-8V12z"
        fill="currentColor"
        className="text-primary"
      />

      {/* Sound waves inside bubble */}
      <g className="text-white">
        <path
          d="M26 16h12M26 20h8M26 24h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* External sound waves */}
      <g className="text-primary opacity-60">
        <path
          d="M55 16c2 2 2 6 0 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
