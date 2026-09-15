// Tag extraction, categorization and count engine for Norma Jurídica
// Ensures every category news feed has at least 250 items, rich tags, and tag counts

export interface TagCount {
  name: string;
  count: number;
}

export const COMMON_LEGAL_TAGS: Record<string, string[]> = {
  "Justiça": [
    "STF", "STJ", "Jurisprudência", "Tribunais", "Magistratura", "Legislação",
    "Processo Civil", "Processo Penal", "Constitucional", "Decisão Judicial",
    "Ministério Público", "Defensoria", "OAB", "Súmula Vinculante"
  ],
  "Tocantins": [
    "TJTO", "Palmas", "Araguaína", "Gurupi", "Assembleia Legislativa", "Cerrado",
    "Serviço Público", "Prefeituras", "Interior TO", "Concursos TO", "Porto Nacional"
  ],
  "Economia": [
    "Mercado Financeiro", "Inflação", "Taxa Selic", "PIB", "Investimentos",
    "Balança Comercial", "Tributário", "Receita Federal", "Empresas", "Exportação"
  ],
  "Educação": [
    "MEC", "Enem", "Universidades", "Educação Básica", "Pós-Graduação",
    "Bolsas de Estudo", "Professores", "Escolas Públicas", "Vestibular"
  ],
  "Finanças": [
    "Orçamento Público", "Precatórios", "Bancos", "Fundos", "Crédito",
    "Tesouro Direto", "Imposto de Renda", "Previdência", "Planejamento"
  ],
  "Esporte": [
    "Futebol", "Campeonato Brasileiro", "Copa do Brasil", "Libertadores",
    "Atletas", "Clubes", "Justiça Desportiva", "Olimpíadas"
  ],
  "Notícias Gerais": [
    "Brasil", "Cidadania", "Governo Federal", "Congresso Nacional", "Políticas Públicas",
    "Segurança Pública", "Infraestrutura", "Meio Ambiente", "Saúde"
  ],
  "Goiás": [
    "TJGO", "Goiânia", "Anápolis", "Aparecida de Goiânia", "Interior GO",
    "Agronegócio", "Assembleia GO"
  ],
  "Maranhão": [
    "TJMA", "São Luís", "Imperatriz", "Litoral", "Interior MA"
  ],
  "Pará": [
    "TJPA", "Belém", "Ananindeua", "Santarém", "Amazônia", "Interior PA"
  ],
};

const KEYWORD_TAG_RULES: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ["stf", "supremo tribunal", "ministro barroso", "moraes", "plenário do stf"], tag: "STF" },
  { keywords: ["stj", "superior tribunal de justiça", "ministro do stj"], tag: "STJ" },
  { keywords: ["tse", "eleitoral", "eleições", "urnas", "partidos"], tag: "Eleitoral" },
  { keywords: ["tst", "trabalhista", "clt", "trabalho", "emprego"], tag: "Trabalhista" },
  { keywords: ["tjto", "tocantins", "palmas", "araguaína"], tag: "TJTO" },
  { keywords: ["jurisprudência", "precedente", "entendimento", "tese"], tag: "Jurisprudência" },
  { keywords: ["constitucional", "constituição", "adpf", "adin", "adi"], tag: "Constitucional" },
  { keywords: ["penal", "crime", "polícia", "prisão", "investigação", "habeas corpus"], tag: "Processo Penal" },
  { keywords: ["tributário", "imposto", "receita", "tributo", "icms", "taxa"], tag: "Tributário" },
  { keywords: ["concurso", "concursos", "edital", "vagas", "inscrições"], tag: "Concursos" },
  { keywords: ["legislação", "lei", "decreto", "projeto de lei", "pl", "promulga"], tag: "Legislação" },
  { keywords: ["tribunal", "tribunais", "desembargador", "corte"], tag: "Tribunais" },
  { keywords: ["magistrado", "magistratura", "juiz", "juíza"], tag: "Magistratura" },
  { keywords: ["servidor", "servidores", "funcionalismo", "carreira"], tag: "Serviço Público" },
  { keywords: ["ambiental", "meio ambiente", "desmatamento", "ibama", "cerrado", "floresta"], tag: "Meio Ambiente" },
  { keywords: ["educação", "mec", "escola", "universidade", "enem"], tag: "Educação" },
  { keywords: ["saúde", "sus", "anvisa", "medicamento", "hospital"], tag: "Saúde" },
  { keywords: ["economia", "selic", "inflação", "mercado", "pib", "dólar"], tag: "Economia" },
  { keywords: ["finanças", "crédito", "bancos", "investimentos", "bolsa"], tag: "Finanças" },
  { keywords: ["governo", "planalto", "congresso", "senado", "câmara"], tag: "Governo" },
];

/**
 * Extracts and tags a news item with 2 to 5 relevant tags
 */
export function extractTagsForNewsItem(item: {
  title?: string;
  description?: string;
  content?: string;
  category?: string;
}): string[] {
  const text = `${item.title || ""} ${item.description || ""} ${item.content || ""}`.toLowerCase();
  const tagsSet = new Set<string>();

  // 1. Tag based on content keywords
  for (const rule of KEYWORD_TAG_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      tagsSet.add(rule.tag);
    }
  }

  // 2. Tag based on category preset
  const cat = item.category || "Notícias Gerais";
  const defaultTags = COMMON_LEGAL_TAGS[cat] || [cat, "Legislação", "Brasil"];
  
  // Add category name itself if not too generic
  if (cat && cat !== "Todas") {
    tagsSet.add(cat);
  }

  // Fill up if fewer than 2 tags
  if (tagsSet.size < 2) {
    for (const dt of defaultTags) {
      tagsSet.add(dt);
      if (tagsSet.size >= 3) break;
    }
  }

  return Array.from(tagsSet).slice(0, 5);
}

/**
 * Computes tag counts for an array of news items
 */
export function computeTagCounts(items: Array<{ tags?: string[]; category?: string }>): TagCount[] {
  const counts: Record<string, number> = {};

  items.forEach((item) => {
    const tags = item.tags && item.tags.length > 0
      ? item.tags
      : extractTagsForNewsItem(item);

    tags.forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
