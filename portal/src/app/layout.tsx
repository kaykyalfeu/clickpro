import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClickPro Portal",
  description: "Sistema de Licenciamento ClickPro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/akar-icons-fonts@1.1.2/dist/css/akar-icons.css"
        />
      </head>
      <body className="antialiased font-sans">
        <Providers>
          <ThemeToggle />
          {children}
        </Providers>
      </body>
    </html>
  );
}
