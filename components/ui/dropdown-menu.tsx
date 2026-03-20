"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DropdownContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const DropdownContext = React.createContext<DropdownContextType | null>(null);

type DropdownMenuProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
};

export function DropdownMenu({
  trigger,
  children,
  align = "start",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={menuRef} className="relative">
        <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
        {isOpen && (
          <div
            className={cn(
              "absolute bottom-full mb-2 w-48 rounded-md border bg-popover p-1 shadow-md z-50",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

type DropdownMenuItemProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  preventClose?: boolean;
};

export function DropdownMenuItem({
  children,
  onClick,
  className,
  preventClose = false,
}: DropdownMenuItemProps) {
  const context = React.useContext(DropdownContext);

  const handleClick = () => {
    onClick?.();
    if (!preventClose) {
      context?.setIsOpen(false);
    }
  };

  return (
    <button
      className={cn(
        "flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        className,
      )}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

type DropdownMenuSubProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
};

export function DropdownMenuSub({ trigger, children }: DropdownMenuSubProps) {
  const [isSubOpen, setIsSubOpen] = React.useState(false);
  const subMenuRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative"
      ref={subMenuRef}
      onMouseEnter={() => setIsSubOpen(true)}
      onMouseLeave={() => setIsSubOpen(false)}
    >
      <button
        className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        type="button"
      >
        {trigger}
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="ml-auto"
        >
          <path
            d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isSubOpen && (
        <div className="absolute left-full top-0 ml-1 w-48 rounded-md border bg-popover p-1 shadow-md z-50">
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
