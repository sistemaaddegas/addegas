// Lucro no Copo — dados mockados (somente front-end, sem persistência)
// imagem: coloque a URL da foto real do produto (null mostra o placeholder)
export default {
  categorias: [
    { k: 'destilado', label: 'Destilado', unidade: 'ml', passo: 5, min: 10, max: 150, padrao: 50, noCopo: true, obrigatorio: true },
    { k: 'energetico', label: 'Energético', unidade: 'ml', passo: 50, min: 0, max: 400, padrao: 200, noCopo: true },
    { k: 'gelo', label: 'Gelo de coco', unidade: 'un', passo: 1, min: 0, max: 3, padrao: 1 },
    { k: 'refrigerante', label: 'Refrigerante', unidade: 'ml', passo: 50, min: 0, max: 300, padrao: 100, noCopo: true },
    { k: 'cerveja', label: 'Cerveja', unidade: 'un', passo: 1, min: 0, max: 6, padrao: 1 },
  ],
  produtos: {
    destilado: [
      { id: 'jack', nome: "Jack Daniel's", sub: 'Whisky · 1 L', volumeMl: 1000, custo: 120, estoque: 720, cor: '#B8651B', imagem: null },
      { id: 'absolut', nome: 'Absolut', sub: 'Vodka · 1 L', volumeMl: 1000, custo: 90, estoque: 430, cor: 'rgba(225,236,244,.55)', imagem: null },
      { id: 'tanqueray', nome: 'Tanqueray', sub: 'Gin · 750 ml', volumeMl: 750, custo: 105, estoque: 415, cor: 'rgba(200,235,215,.5)', imagem: null },
      { id: 'ballantines', nome: "Ballantine's", sub: 'Whisky · 1 L', volumeMl: 1000, custo: 85, estoque: 880, cor: '#C98A2E', imagem: null },
      { id: 'smirnoff', nome: 'Smirnoff', sub: 'Vodka · 998 ml', volumeMl: 998, custo: 49.9, estoque: 610, cor: 'rgba(230,238,245,.5)', imagem: null },
    ],
    energetico: [
      { id: 'redbull', nome: 'Red Bull', sub: 'Lata 250 ml', volumeMl: 250, custo: 8.0, estoque: 1400, cor: '#E9C94A', imagem: null },
      { id: 'monster', nome: 'Monster', sub: 'Lata 473 ml', volumeMl: 473, custo: 9.5, estoque: 946, cor: '#A6D64E', imagem: null },
      { id: 'baly', nome: 'Baly', sub: 'Garrafa 2 L', volumeMl: 2000, custo: 9.9, estoque: 4000, cor: '#F0B84A', imagem: null },
    ],
    gelo: [
      { id: 'coco', nome: 'Gelo de coco', sub: 'Coco', custo: 1.2, estoque: 16, imagem: null },
      { id: 'maracuja', nome: 'Gelo de maracujá', sub: 'Maracujá', custo: 1.3, estoque: 10, imagem: null },
      { id: 'melancia', nome: 'Gelo de melancia', sub: 'Melancia', custo: 1.3, estoque: 8, imagem: null },
    ],
    refrigerante: [
      { id: 'coca', nome: 'Coca-Cola', sub: 'Garrafa 2 L', volumeMl: 2000, custo: 8.6, estoque: 6000, cor: '#3B1A0E', imagem: null },
      { id: 'guarana', nome: 'Guaraná Antarctica', sub: 'Garrafa 2 L', volumeMl: 2000, custo: 7.2, estoque: 4000, cor: '#7A3A12', imagem: null },
      { id: 'tonica', nome: 'Tônica Schweppes', sub: 'Lata 350 ml', volumeMl: 350, custo: 3.5, estoque: 1400, cor: 'rgba(235,240,230,.55)', imagem: null },
    ],
    cerveja: [
      { id: 'heineken', nome: 'Heineken Long Neck', sub: '330 ml', custo: 5.4, estoque: 96, imagem: null },
      { id: 'skol', nome: 'Skol lata', sub: '350 ml', custo: 2.8, estoque: 140, imagem: null },
    ],
  },
  insumos: { copo: { nome: 'Copo', custoUnitario: 0.5, estoque: 30 } },
  receitas: [
    { id: 1, nome: 'Combo Jack Energy', cor: '#FBC009', ink: '#0A0A0B', precoVenda: 35, itens: { destilado: ['jack', 50], energetico: ['redbull', 200], gelo: ['coco', 1] } },
    { id: 2, nome: 'Combo Vodka Energy', cor: '#00B8FF', ink: '#0A0A0B', precoVenda: 28, itens: { destilado: ['absolut', 60], energetico: ['redbull', 200], gelo: ['coco', 1] } },
    { id: 3, nome: 'Combo Gin Tônica', cor: '#1ED760', ink: '#0A0A0B', precoVenda: 32, itens: { destilado: ['tanqueray', 50], refrigerante: ['tonica', 200], gelo: ['maracuja', 1] } },
    { id: 4, nome: 'Whisky + Coca + Long Neck', cor: '#FF2D55', ink: '#FFFFFF', precoVenda: 39, itens: { destilado: ['ballantines', 50], refrigerante: ['coca', 200], gelo: ['coco', 1], cerveja: ['heineken', 1] } },
  ],
};
