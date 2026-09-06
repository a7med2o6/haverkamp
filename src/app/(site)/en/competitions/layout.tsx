import type { ReactNode } from 'react';

/**
 * Layout for English competitions routes.
 * Ensures /css/competitions.css stylesheet is loaded once for all English competition pages.
 */
export default function EnCompetitionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/competitions.css" />
      {children}
    </>
  );
}
