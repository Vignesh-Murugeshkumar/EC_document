"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { LanguageProvider } from "./i18n";
import "./globals.css";

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/";

  return (
    <html lang="en">
      <head>
        <title>EC Analysis & Verification Application</title>
        <meta name="description" content="AI-Powered Encumbrance Certificate (EC) Verification Engine for Property Title Verification and Anomaly Detection in India." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Rajdhani:wght@600;700&family=JetBrains+Mono:wght@500&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LanguageProvider>
          <div className="min-h-screen flex flex-col">
            {/* Page Content */}
            <div className="flex-grow flex flex-col">
              {children}
            </div>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
