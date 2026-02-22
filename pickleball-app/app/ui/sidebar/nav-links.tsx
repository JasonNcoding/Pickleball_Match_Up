'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';


const links = [
  { name: 'Home', href: '/tournament/admin'},
  { name: 'Set Up', href: '/tournament/admin/setup'},
  { name: 'Dashboard', href: '/tournament/admin/dashboard'},
];

const displayLink = { name: 'Display', href: '/tournament/display'}

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {

        return (
            <Link
            key={link.name}
            href={link.href}
            className={clsx(
              'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-slate-50 p-3 text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 md:flex-none md:justify-start md:p-2 md:px-3 transition ',
              {
                'bg-indigo-50 text-indigo-600': pathname === link.href,
              },
            )}
          >
            <p className="hidden md:block ">{link.name}</p>
          </Link>
        );
      })}
      <Link
            key={displayLink.name}
            href={displayLink.href}
            target="_blank" rel="noopener noreferrer"
            className={clsx(
              'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-slate-50 p-3 text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 md:flex-none md:justify-start md:p-2 md:px-3 transition ',
              {
                'bg-indigo-50 text-indigo-600': pathname === displayLink.href,
              },
            )}
          >
            <p className="hidden md:block ">{displayLink.name}</p>
          </Link>
    </>
  );
}