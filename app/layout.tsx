import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorker } from "@/components/sw-register";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "LavaYa",
  description: "Recolección de ropa en moto. La lavandería pesa lo que llegó y tú ves el precio.",
  applicationName: "LavaYa",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LavaYa",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E8F6E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className={`${outfit.variable} ${fraunces.variable} antialiased`}>
        {children}
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorker />
      </body>
    </html>
  );
}
