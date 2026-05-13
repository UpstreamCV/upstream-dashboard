export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-dvh grid place-items-center px-6 py-16">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
