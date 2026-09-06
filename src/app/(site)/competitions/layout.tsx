import type { ReactNode } from 'react';

/**
 * Layout for Arabic competitions routes.
 * Ensures /css/competitions.css stylesheet is loaded once for all competition pages.
 */
export default function CompetitionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/competitions.css" />
      {children}
    </>
  );
}
