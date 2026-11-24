import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SITE_URL, EMAIL, SOCIAL, FAQ } from "@/lib/site";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

const DESCRIPTION =
  "Sistema de gestão e ERP para adegas e depósitos de bebidas: caixa, estoque, combos e pedidos do iFood, Zé Delivery e WhatsApp num lugar só.";
const TITLE = "Addegas | Sistema e ERP para Adega e Depósito de Bebidas";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "sistema para adega",
    "ERP para adega",
    "PDV para adega",
    "programa para adega",
    "sistema para depósito de bebidas",
    "controle de estoque de bebidas",
    "software para adega",
    "sistema para distribuidora de bebidas",
  ],
  authors: [{ name: "Addegas" }],
  alternates: {
    canonical: "/",
    languages: { "pt-BR": "/" },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Addegas",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/assets/og-image.png",
        width: 1200,
        height: 630,
        alt: "Addegas — Sistema de gestão pra adega",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@sistemaaddegas",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/assets/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  icons: {
    icon: "/assets/favicon-64.png",
    apple: "/assets/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  other: { "geo.region": "BR", "geo.placename": "Brasil" },
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
};

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: "Addegas",
  alternateName: "Sistema Addegas",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/assets/app-icon.png`,
  email: EMAIL,
  slogan: "Gestão pra adega.",
  description: "Sistema de gestão e ERP para adegas e depósitos de bebidas no Brasil.",
  areaServed: { "@type": "Country", name: "Brasil" },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+55-11-98675-5103",
    contactType: "sales",
    areaServed: "BR",
    availableLanguage: "Portuguese",
  },
  sameAs: [SOCIAL.instagram, SOCIAL.youtube, SOCIAL.x],
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: "Addegas",
  inLanguage: "pt-BR",
  publisher: { "@id": `${SITE_URL}/#org` },
};

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: "Addegas",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "ERP e PDV para adegas",
  operatingSystem: "Web, Android, iOS",
  inLanguage: "pt-BR",
  url: `${SITE_URL}/`,
  image: `${SITE_URL}/assets/og-image.png`,
  description:
    "Sistema de gestão e ERP para adegas e depósitos de bebidas: PDV (caixa), controle de estoque de bebidas, combos, fechamento do dia, catálogo no WhatsApp e integração com iFood, Zé Delivery, 99Food e Keeta.",
  featureList: [
    "PDV / caixa rápido com Pix, cartão e dinheiro",
    "Controle de estoque de bebidas",
    "Cadastro e venda de combos",
    "Fechamento de caixa do dia",
    "Catálogo no WhatsApp com pedidos direto no sistema",
    "Integração com iFood, Zé Delivery, 99Food e Keeta",
    "Relatório de vendas por canal",
  ],
  audience: {
    "@type": "BusinessAudience",
    audienceType: "Adegas, depósitos de bebidas e distribuidoras de bebidas",
  },
  publisher: { "@id": `${SITE_URL}/#org` },
  offers: {
    "@type": "Offer",
    price: "149.90",
    priceCurrency: "BRL",
    description: "Plano único com 14 dias grátis. Semestral com 10% e anual com 20% de desconto.",
    url: `${SITE_URL}/#planos`,
  },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </body>
    </html>
  );
}
