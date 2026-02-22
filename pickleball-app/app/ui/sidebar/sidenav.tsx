'use client'; // This stays at the top

import Link from 'next/link';
import NavLinks from '@/app/ui/sidebar/nav-links'; // Ensure this path is correct
import { PowerIcon } from '@heroicons/react/24/outline';
import { handleSignOut } from '@/app/lib/actions';

export default function SideNav() {

  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2 bg-slate-50 border-r">
      
      <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
        <NavLinks />
        <div className="hidden h-auto grow rounded-md bg-slate-50 md:block"></div>
        
        <form className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-slate-50 p-3 text-sm font-medium hover:bg-red-50 hover:text-red-600 md:flex-none md:justify-start md:p-2 md:px-3 transition" action={handleSignOut}>
          <button>
            <div className="hidden md:block">Sign Out</div>
          </button>
        </form>
      </div>
    </div>
  );
}