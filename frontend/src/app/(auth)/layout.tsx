export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
      {children}
    </div>
  );
}
