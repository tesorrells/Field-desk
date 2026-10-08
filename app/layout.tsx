import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Field Desk",
  description: "A local intelligence workspace for mapping your area and building area studies.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"(function(){var t;try{t=localStorage.getItem('manor-theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')})()"}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
