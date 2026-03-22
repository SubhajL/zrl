import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

const notoSansThai = Noto_Sans_Thai({
  variable: '--font-noto-thai',
  subsets: ['thai'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ZRL — Zero-Reject Export Lane',
  description:
    'Audit-grade evidence platform for Thai fresh fruit export compliance',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
