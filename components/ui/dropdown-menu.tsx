"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  position?: "auto" | "top" | "bottom";
};

export function DropdownMenu({
  trigger,
  children,
  align = "start",
  position: initialPosition = "auto",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isPositioned, setIsPositioned] = React.useState(false);
  const [position, setPosition] = React.useState({
    vertical:
      initialPosition !== "auto"
        ? initialPosition
        : ("top" as "top" | "bottom"),
    horizontal: align,
    maxHeight: "none" as string,
    top: 0,
    left: 0,
  });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setIsPositioned(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsideTrigger =
        triggerRef.current && !triggerRef.current.contains(target);
      const clickedOutsideContent =
        contentRef.current && !contentRef.current.contains(target);

      // Check if clicked inside any dropdown menu (including submenus)
      const clickedInDropdown = (target as Element).closest(
        "[data-dropdown-menu]",
      );

      if (
        clickedOutsideTrigger &&
        clickedOutsideContent &&
        !clickedInDropdown
      ) {
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
        let top = 0;

        if (initialPosition === "auto") {
          // Auto positioning based on available space
          if (spaceAbove >= contentRect.height + gap) {
            vertical = "top";
            top = triggerRect.top - contentRect.height - gap;
          } else if (spaceBelow >= contentRect.height + gap) {
            vertical = "bottom";
            top = triggerRect.bottom + gap;
          } else {
            // Not enough space in either direction - choose the larger space
            if (spaceAbove > spaceBelow) {
              vertical = "top";
              maxHeight = `${spaceAbove - gap - 16}px`; // 16px extra padding
              top = gap;
            } else {
              vertical = "bottom";
              maxHeight = `${spaceBelow - gap - 16}px`;
              top = triggerRect.bottom + gap;
            }
          }
        } else {
          // Use the specified position
          vertical = initialPosition;
          if (initialPosition === "top") {
            if (spaceAbove >= contentRect.height + gap) {
              top = triggerRect.top - contentRect.height - gap;
            } else {
              // Not enough space, constrain height
              maxHeight = `${spaceAbove - gap - 16}px`;
              top = gap;
            }
          } else {
            // bottom
            if (spaceBelow >= contentRect.height + gap) {
              top = triggerRect.bottom + gap;
            } else {
              // Not enough space, constrain height
              maxHeight = `${spaceBelow - gap - 16}px`;
              top = triggerRect.bottom + gap;
            }
          }
        }

        // Determine horizontal position
        let horizontal: "start" | "end" = align;
        let left = 0;

        if (align === "start" && spaceRight < menuWidth) {
          // Not enough space on the right, align to end
          horizontal = "end";
          left = triggerRect.right - menuWidth;
        } else if (align === "end" && spaceLeft < menuWidth) {
          // Not enough space on the left, align to start
          horizontal = "start";
          left = triggerRect.left;
        } else {
          left =
            align === "start"
              ? triggerRect.left
              : triggerRect.right - menuWidth;
        }

        setPosition({ vertical, horizontal, maxHeight, top, left });
        setIsPositioned(true);
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
        {isMounted &&
          isOpen &&
          createPortal(
            <div
              ref={contentRef}
              data-dropdown-menu
              className={cn(
                "fixed w-60 rounded-md border bg-popover p-1 shadow-md z-50 transition-opacity duration-75",
                position.maxHeight !== "none" && "overflow-y-auto",
                !isPositioned && "opacity-0",
              )}
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                maxHeight:
                  position.maxHeight !== "none"
                    ? position.maxHeight
                    : undefined,
              }}
            >
              {children}
            </div>,
            document.body,
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
  const [isMounted, setIsMounted] = React.useState(false);
  const [isPositioned, setIsPositioned] = React.useState(false);
  const [position, setPosition] = React.useState({
    horizontal: "right" as "left" | "right",
    vertical: "top" as "top" | "bottom" | "center",
    maxHeight: "none" as string,
    top: 0,
    left: 0,
  });
  const subMenuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isSubOpen) {
      setIsPositioned(false);
    }
  }, [isSubOpen]);

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const tryClose = React.useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setIsSubOpen(false);
    }, 10);
  }, [clearCloseTimeout]);

  const handleTriggerEnter = React.useCallback(() => {
    clearCloseTimeout();
    setIsSubOpen(true);
  }, [clearCloseTimeout]);

  const handleTriggerLeave = React.useCallback(() => {
    tryClose();
  }, [tryClose]);

  const handleContentEnter = React.useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleContentLeave = React.useCallback(() => {
    tryClose();
  }, [tryClose]);

  React.useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

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

        const menuWidth = 240; // w-60  = 15rem = 240px
        const overlap = 8; // Increase overlap for smoother navigation

        // Determine horizontal position (prefer right)
        let horizontal: "left" | "right" = "right";
        let left = 0;

        if (spaceRight >= menuWidth + overlap) {
          horizontal = "right";
          left = triggerRect.right - overlap;
        } else if (spaceLeft >= menuWidth + overlap) {
          horizontal = "left";
          left = triggerRect.left - menuWidth + overlap;
        } else if (spaceLeft > spaceRight) {
          horizontal = "left";
          left = triggerRect.left - menuWidth + overlap;
        } else {
          horizontal = "right";
          left = triggerRect.right - overlap;
        }

        // Determine vertical position and max height
        let vertical: "top" | "bottom" | "center" = "top";
        let maxHeight = "none";
        let top = 0;

        const contentHeight = contentRect.height;
        const availableBelow = spaceBelow + triggerRect.height;

        if (availableBelow >= contentHeight) {
          // Enough space aligning to top
          vertical = "top";
          top = triggerRect.top;
        } else if (spaceAbove >= contentHeight) {
          // Align to bottom of trigger
          vertical = "bottom";
          top = triggerRect.bottom - contentHeight;
        } else {
          // Not enough space - use the larger space and limit height
          if (availableBelow > spaceAbove) {
            vertical = "top";
            maxHeight = `${availableBelow - 16}px`;
            top = triggerRect.top;
          } else {
            vertical = "bottom";
            maxHeight = `${spaceAbove - 16}px`;
            top = triggerRect.bottom - parseInt(maxHeight);
          }
        }

        setPosition({ horizontal, vertical, maxHeight, top, left });
        setIsPositioned(true);
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
    <div className="relative" ref={subMenuRef}>
      <button
        ref={triggerRef}
        className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        type="button"
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
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
      {isMounted &&
        isSubOpen &&
        createPortal(
          <div
            className="fixed z-50"
            style={{
              top: `${position.top - 10}px`,
              left: `${position.left - 10}px`,
              padding: "10px",
            }}
            onMouseEnter={handleContentEnter}
            onMouseLeave={handleContentLeave}
          >
            <div
              ref={contentRef}
              data-dropdown-menu
              className={cn(
                "w-60 rounded-md border bg-popover p-1 shadow-md transition-opacity duration-75",
                position.maxHeight !== "none" && "overflow-y-auto",
                !isPositioned && "opacity-0",
              )}
              style={{
                maxHeight:
                  position.maxHeight !== "none"
                    ? position.maxHeight
                    : undefined,
              }}
            >
              {children}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
