"use client";

/**
 * A `template` re-mounts on every navigation within the (app) segment (unlike a
 * `layout`, which persists). Wrapping the page content here gives every route a
 * subtle enter animation, so navigating between the home, a study, or the
 * transcription editor feels continuous rather than abrupt.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out motion-reduce:animate-none">
      {children}
    </div>
  );
}
