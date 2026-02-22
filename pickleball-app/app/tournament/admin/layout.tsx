'use client';

import SideNav from '@/app/ui/sidebar/sidenav';


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
          {/* 1. Side Navigation (The Sidebar) */}
          <div className="w-full flex-none md:w-32">
             <SideNav />
          </div>

          {/* 2. Main Content Area (Your Tournament App) */}
          <div className="flex-grow p-6 md:overflow-y-auto md:p-12">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
