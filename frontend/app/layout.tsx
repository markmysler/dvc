import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Damn Vulnerable Containers",
  description: "Practice real vulnerability exploitation on isolated, disposable containers with auto-generated flags",
  keywords: ["security", "training", "hacking", "pentesting", "vulnerability", "containers", "dvc"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}
      >
        <QueryProvider>
          <div className="min-h-screen flex flex-col">
            <header className="border-b">
              <div className="container mx-auto px-4 py-4">
                <nav className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h1 className="text-xl font-semibold">Damn Vulnerable Containers</h1>
                    <span className="text-sm text-muted-foreground">v3.0</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <a
                      href="/import"
                      className="px-4 py-2 bg-black text-white hover:bg-gray-800 font-medium transition-colors rounded-md text-sm dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      Import Challenge
                    </a>
                    <span className="text-sm text-muted-foreground">
                      API: {process.env.HOST || 'localhost'}:5000
                    </span>
                  </div>
                </nav>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t py-4">
              <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                Damn Vulnerable Containers - Local Deployment
              </div>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}