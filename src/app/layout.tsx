import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { BackToApp } from "@/components/BackToApp";


export const metadata: Metadata = {
  title: "Health Here",
  description: "Find doctors, specialists, hospitals and clinics near you that take your insurance — plus one-tap emergency help.",
  appleWebApp: { capable: true, title: "Health Here", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c6e47b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} antialiased`}>
        <AppProvider>
          {children}
          <BackToApp />
        </AppProvider>
      </body>
    </html>
  );
}
