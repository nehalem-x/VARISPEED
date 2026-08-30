import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VARISPEED — Ouvir também é construir',
  description: 'Velocidade de áudio sem correção de pitch e uma biblioteca visual que cresce com a sua escuta.',
  openGraph: {
    title: 'VARISPEED — Ouvir também é construir',
    description: 'Velocidade de áudio sem correção de pitch e uma biblioteca visual que cresce com a sua escuta.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'VARISPEED — Ouvir também é construir',
    description: 'Velocidade de áudio sem correção de pitch e uma biblioteca visual que cresce com a sua escuta.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <script src="/graph-engine.js" defer data-varispeed-graph="true" />
      </head>
      <body>{children}</body>
    </html>
  );
}
