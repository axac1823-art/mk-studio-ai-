export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-w-0 w-full flex-1">{children}</div>;
}
