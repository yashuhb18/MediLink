import "./globals.css";
import MediBotChat from "@/components/MediBotChat";
import LiveCameraScanModal from "@/components/LiveCameraScanModal";

export const metadata = {
  title: "MediLink AI — Intelligent Medicine Redistribution Network",
  description: "A zero-stockout ecosystem for connected hospitals driven by predictive analytics, game-theory karma, and dual physical verification.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css"
        />
      </head>
      <body>
        {children}
        <MediBotChat />
        <LiveCameraScanModal />
      </body>
    </html>
  );
}
