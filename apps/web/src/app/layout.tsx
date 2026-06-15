import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM PRO AI",
  description: "CRM multi tenant con IA para equipos comerciales."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
