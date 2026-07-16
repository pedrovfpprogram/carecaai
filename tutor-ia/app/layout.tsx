import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "CarecaAI",
  description: "Seu tutor de programação.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ea580c" />
        {/* Ligar o motor do aplicativo (Service Worker) */}
        {/* Ligar o motor do aplicativo (Service Worker) à maneira do Next.js */}
        <Script id="service-worker-registro" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('Service Worker a rodar liso no escopo: ', registration.scope);
                  },
                  function(err) {
                    console.log('O Service Worker engasgou: ', err);
                  }
                );
              });
            }
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}