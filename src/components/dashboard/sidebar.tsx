'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import * as Icons from 'lucide-react';
import { NAV } from './nav-config';
import { canAccessModule } from '@/lib/rbac';
import type { Role } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils';

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Cmp) return <Icons.Circle className={className} />;
  return <Cmp className={className} />;
}

export function Sidebar({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const groups = NAV.map((g) => ({
    ...g,
    links: g.links.filter((l) => !l.soon && canAccessModule(role, l.module)),
  })).filter((g) => g.links.length > 0);

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 pb-6">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mb-2 flex items-center gap-2.5 px-2 py-5"
      >
        <Image
          src="/assets/logo.png"
          alt="هافركامب"
          width={112}
          height={32}
          className="h-8 w-auto object-contain"
        />
      </Link>

      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)]">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    data-active={active}
                    className="nav-item"
                  >
                    <Icon name={link.icon} className={cn('size-[18px] shrink-0')} />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
