import "./globals.css";

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
        {/* Diz ao celular que isso é um aplicativo */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ea580c" />
      </head>
      <body>{children}</body>
    </html>
  );
}