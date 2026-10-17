import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { NavLinks } from '@/components/NavLinks';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Panga', template: '%s · Panga' },
  description: 'Know what a client will cost before you say yes. A deal room for freelancers who sell websites at fixed prices.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0d0c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&display=swap" />
      </head>
      <body>
        <header className="topbar">
          <div className="shell topbar-inner">
            <Link href="/" className="wordmark" aria-label="Panga home">
              <Logo />
              <span className="tagline">Know what you’re agreeing to</span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="shell page">{children}</main>
        <footer className="shell footer">
          Panga runs on an open-source model on DigitalOcean. The practice client is pretend. Panga never messages your real client; you send
          everything yourself.
        </footer>
      </body>
    </html>
  );
}
