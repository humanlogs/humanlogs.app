export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="my-12 md:my-24">{children}</div>;
}

export const DocumentLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="p-8 max-w-4xl lg:border lg:rounded-lg mx-auto document">
      {children}
    </div>
  );
};
