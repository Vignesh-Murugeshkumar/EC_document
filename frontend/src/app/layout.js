"use client";

import { LanguageProvider } from "./i18n";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>EC Analysis & Verification Application</title>
        <meta name="description" content="AI-Powered Encumbrance Certificate (EC) Verification Engine for Property Title Verification and Anomaly Detection in India." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
