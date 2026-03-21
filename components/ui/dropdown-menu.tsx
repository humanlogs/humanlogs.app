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
  const [position, setPosition] = React.useState({
    vertical: "top" as "top" | "bottom",
    horizontal: align,
    maxHeight: "none" as string,
  });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    if (isOpen && triggerRef.current && contentRef.current) {
      const updatePosition = () => {
        const triggerRect = triggerRef.current!.getBoundingClientRect();
        const contentRect = contentRef.current!.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        const spaceAbove = triggerRect.top;
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceLeft = triggerRect.left;
        const spaceRight = viewportWidth - triggerRect.right;

        const menuWidth = 240; // w-60 = 15rem = 240px
        const gap = 8; // mb-2 = 0.5rem = 8px

        // Determine vertical position
        let vertical: "top" | "bottom" = "top";
        let maxHeight = "none";

        if (spaceAbove >= contentRect.height + gap) {
          vertical = "top";
        } else if (spaceBelow >= contentRect.height + gap) {
          vertical = "bottom";
        } else {
          // Not enough space in either direction - choose the larger space
          if (spaceAbove > spaceBelow) {
            vertical = "top";
            maxHeight = `${spaceAbove - gap - 16}px`; // 16px extra padding
          } else {
            vertical = "bottom";
            maxHeight = `${spaceBelow - gap - 16}px`;
          }
        }

        // Determine horizontal position
        let horizontal: "start" | "end" = align;

        if (align === "start" && spaceRight < menuWidth) {
          // Not enough space on the right, align to end
          horizontal = "end";
        } else if (align === "end" && spaceLeft < menuWidth) {
          // Not enough space on the left, align to start
          horizontal = "start";
        }

        setPosition({ vertical, horizontal, maxHeight });
      };

      // Update position immediately
      updatePosition();

      // Update on scroll or resize
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, align]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={menuRef} className="relative">
        <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </div>
        {isOpen && (
          <div
            ref={contentRef}
            className={cn(
              "absolute w-60 rounded-md border bg-popover p-1 shadow-md z-50",
              position.vertical === "top"
                ? "bottom-full mb-2"
                : "top-full mt-2",
              position.horizontal === "end" ? "right-0" : "left-0",
              position.maxHeight !== "none" && "overflow-y-auto",
            )}
            style={
              position.maxHeight !== "none"
                ? { maxHeight: position.maxHeight }
                : undefined
            }
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
  const [position, setPosition] = React.useState({
    horizontal: "right" as "left" | "right",
    vertical: "top" as "top" | "bottom" | "center",
    maxHeight: "none" as string,
  });
  const subMenuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isSubOpen && triggerRef.current && contentRef.current) {
      const updatePosition = () => {
        const triggerRect = triggerRef.current!.getBoundingClientRect();
        const contentRect = contentRef.current!.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        const spaceRight = viewportWidth - triggerRect.right;
        const spaceLeft = triggerRect.left;
        const spaceAbove = triggerRect.top;
        const spaceBelow = viewportHeight - triggerRect.bottom;

        const menuWidth = 192; // w-48 = 12rem = 192px
        const overlap = 4; // -ml-1 = -0.25rem = -4px

        // Determine horizontal position (prefer right)
        let horizontal: "left" | "right" = "right";
        if (spaceRight >= menuWidth + overlap) {
          horizontal = "right";
        } else if (spaceLeft >= menuWidth + overlap) {
          horizontal = "left";
        } else if (spaceLeft > spaceRight) {
          horizontal = "left";
        }

        // Determine vertical position and max height
        let vertical: "top" | "bottom" | "center" = "top";
        let maxHeight = "none";

        const contentHeight = contentRect.height;
        const availableBelow = spaceBelow + triggerRect.height;

        if (availableBelow >= contentHeight) {
          // Enough space aligning to top
          vertical = "top";
        } else if (spaceAbove >= contentHeight) {
          // Align to bottom of trigger
          vertical = "bottom";
        } else {
          // Not enough space - use the larger space and limit height
          if (availableBelow > spaceAbove) {
            vertical = "top";
            maxHeight = `${availableBelow - 16}px`;
          } else {
            vertical = "bottom";
            maxHeight = `${spaceAbove - 16}px`;
          }
        }

        setPosition({ horizontal, vertical, maxHeight });
      };

      // Update position immediately
      updatePosition();

      // Update on scroll or resize
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isSubOpen]);

  return (
    <div
      className="relative"
      ref={subMenuRef}
      onMouseEnter={() => setIsSubOpen(true)}
      onMouseLeave={() => setIsSubOpen(false)}
    >
      <button
        ref={triggerRef}
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
          className={cn(
            "ml-auto transition-transform",
            position.horizontal === "left" && "rotate-180",
          )}
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
        <div
          ref={contentRef}
          className={cn(
            "absolute w-48 rounded-md border bg-popover p-1 shadow-md z-50",
            position.horizontal === "right"
              ? "left-full -ml-1"
              : "right-full -mr-1",
            position.vertical === "top" && "top-0",
            position.vertical === "bottom" && "bottom-0",
            position.maxHeight !== "none" && "overflow-y-auto",
          )}
          style={
            position.maxHeight !== "none"
              ? { maxHeight: position.maxHeight }
              : undefined
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
