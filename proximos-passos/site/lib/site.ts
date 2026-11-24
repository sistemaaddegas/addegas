export const SITE_URL = "https://www.addegas.com.br";
export const WHATSAPP_NUMBER = "5511986755103";
export const WA_BASE = `https://wa.me/${WHATSAPP_NUMBER}`;
export const EMAIL = "sistema.addegas@gmail.com";

export const SOCIAL = {
  instagram: "https://www.instagram.com/sistema.addegas/",
  youtube: "https://www.youtube.com/@addegas",
  x: "https://x.com/sistemaaddegas",
};

// Sistema (cadastro e login). Enquanto app.addegas.com.br não aponta, fica no endereço da Vercel.
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://addegas-app.vercel.app").replace(/\/$/, "");

// Plano único (D54), os mesmos valores de platform.plan_prices e platform.addon_prices.
// O código do ciclo vai no link do cadastro (?ciclo=) e chega marcado na tela de Assinatura.
export type Ciclo = "monthly" | "semiannual" | "annual";
export const PLANOS: { ciclo: Ciclo; nome: string; desconto: number; porMes: string; total: string; periodo: string; loja: string }[] = [
  { ciclo: "monthly", nome: "Mensal", desconto: 0, porMes: "149,90", total: "R$ 149,90", periodo: "por mês", loja: "R$ 49,90 por mês" },
  { ciclo: "semiannual", nome: "Semestral", desconto: 10, porMes: "134,91", total: "R$ 809,46", periodo: "a cada 6 meses", loja: "R$ 269,46 a cada 6 meses" },
  { ciclo: "annual", nome: "Anual", desconto: 20, porMes: "119,92", total: "R$ 1.439,04", periodo: "por ano", loja: "R$ 479,04 por ano" },
];
export const TESTE_DIAS = 14;

// Link do cadastro com o ciclo escolhido e a origem (UTMs da visita, ou "site" se vier direto).
export function cadastroLink(ciclo: Ciclo, search = ""): string {
  const q = new URLSearchParams({ ciclo });
  const visita = new URLSearchParams(search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = visita.get(k);
    if (v) q.set(k, v.slice(0, 80));
  }
  if (!q.has("utm_source")) q.set("utm_source", "site");
  return `${APP_URL}/cadastro?${q.toString()}`;
}

export function waLink(text: string): string {
  return `${WA_BASE}?text=${encodeURIComponent(text)}`;
}

// Mensagem padrão usada nos CTAs "Chamar no WhatsApp"
export const WA_DEFAULT = waLink(
  "Olá! Vim pelo site e quero saber mais sobre a Addegas."
);

// Fonte única de verdade para o FAQ (UI + JSON-LD FAQPage)
export const FAQ: { q: string; a: string }[] = [
  {
    q: "O que é a Addegas?",
    a: "A Addegas é um sistema de gestão (ERP) feito para adegas, depósitos de bebidas e pequenos comércios do setor em todo o Brasil. Ela junta caixa (PDV), controle de estoque, combos, pedidos de aplicativos e fechamento do dia num lugar só.",
  },
  {
    q: "A Addegas é um ERP para adega?",
    a: "Sim. A Addegas é um ERP para adega pensado para a rotina do balcão: vendas rápidas no PDV, estoque de bebidas atualizado a cada venda, cadastro de combos, pedidos do iFood, Zé Delivery, 99Food, Keeta e WhatsApp, e relatórios de fechamento.",
  },
  {
    q: "Pra quem é o sistema?",
    a: "Para adegas, depósitos de bebidas, distribuidoras de bairro e comércios de bebida da periferia e das regiões urbanas — do pequeno balcão à adega com delivery.",
  },
  {
    q: "Quais integrações a Addegas vai ter?",
    a: "A Addegas está sendo desenvolvida com integração aos principais apps de comida e bebida do Brasil — iFood, Zé Delivery, 99Food e Keeta — além de catálogo no WhatsApp. Os pedidos caem direto no sistema e o estoque baixa sozinho.",
  },
  {
    q: "Dá pra receber pedidos pelo WhatsApp?",
    a: "Sim. Você monta o catálogo da adega uma vez, compartilha no WhatsApp e o pedido do cliente entra direto na Addegas, pronto para separar — sem anotar no papel.",
  },
  {
    q: "A Addegas controla estoque de bebidas?",
    a: "Sim. Cada venda no balcão, em combo ou por aplicativo baixa o estoque automaticamente, e o sistema mostra o que está acabando e o que está parado na prateleira.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. A Addegas abre no navegador do celular, do tablet ou do computador e dá pra instalar como app na tela inicial. O caixa continua vendendo mesmo se a internet cair e lança tudo quando ela volta.",
  },
  {
    q: "Quanto custa a Addegas?",
    a: "Um plano só, com tudo dentro: R$ 149,90 por mês. No semestral sai R$ 134,91 por mês (10% de desconto) e no anual, R$ 119,92 por mês (20% de desconto). Cada loja a mais custa R$ 49,90 por mês, com o mesmo desconto do ciclo.",
  },
  {
    q: "Tem teste grátis?",
    a: "Tem. Os primeiros 14 dias são grátis e não pedem cartão. Você cadastra a adega, usa o sistema de verdade e escolhe como pagar quando quiser, dentro ou no fim do teste.",
  },
];
