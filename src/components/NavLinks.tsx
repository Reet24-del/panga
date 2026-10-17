'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" aria-current={path === '/' || path.startsWith('/deal') ? 'page' : undefined}>
        Deal files
      </Link>
      <Link href="/settings" aria-current={path === '/settings' ? 'page' : undefined}>
        Memory &amp; library
      </Link>
    </nav>
  );
}
