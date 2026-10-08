import sanitizeHtml from "sanitize-html";
import { decode as decodeHtmlEntities } from "he";
import fs from "fs";
import path from "path";

// Cache em memória e arquivo para textos já limpos pela IA (evita chamadas repetidas e latência)
export const textCleanCache = new Map<string, string>();
const AI_CLEAN_CACHE_FILE = path.resolve(process.cwd(), "src/data/aiNewsCleanCache.json");

// Carrega cache de textos limpos se existir
try {
  if (fs.existsSync(AI_CLEAN_CACHE_FILE)) {
    const raw = fs.readFileSync(AI_CLEAN_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") textCleanCache.set(k, v);
      }
    }
  }
} catch {}

let saveTimeout: NodeJS.Timeout | null = null;
function persistCleanCacheDebounced() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of textCleanCache.entries()) {
        obj[k] = v;
      }
      const dir = path.dirname(AI_CLEAN_CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(AI_CLEAN_CACHE_FILE, JSON.stringify(obj), "utf-8");
    } catch {}
  }, 5000);
}

/**
 * Biblioteca e pipeline local de sanitização e limpeza de ruídos antes da IA:
 * - Decodifica entidades HTML com 'he' (&quot;, &#8220;, &nbsp;)
 * - Remove HTML sujo, iframes, scripts com sanitize-html
 * - Remove emojis e pictogramas Unicode
 * - Remove selos de verificação, chamadas de WhatsApp/Telegram, pedidos de likes/compartilhamento
 * - Remove linhas isoladas de poucas palavras/letras
 */
export function preLimparTextoRss(textoBruto: string): string {
  if (!textoBruto || typeof textoBruto !== "string") return "";

  // 1. Decodificação de entidades HTML completas usando a biblioteca 'he'
  let textoDecodificado = textoBruto;
  try {
    textoDecodificado = decodeHtmlEntities(textoBruto);
  } catch {}

  // 2. Sanitização com sanitize-html mantendo apenas parágrafos e quebras
  const textoSemHtml = sanitizeHtml(textoDecodificado, {
    allowedTags: ["p", "br"],
    allowedAttributes: {},
    textFilter: (text) => text,
  })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  // 3. Remove emojis e pictogramas Unicode (incluindo ✅, 🔥, 👉, 👍, 🚀, etc.)
  let texto = textoSemHtml.replace(
    /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}]/gu,
    ""
  );

  // 4. Remove marcas e selos de verificação
  texto = texto
    .replace(/\bNOT[ÍI]CIA\s+VERIFICADA\b/gi, "")
    .replace(/\[\s*VERIFICAD[OA]\s*\]/gi, "")
    .replace(/\(\s*VERIFICAD[OA]\s*\)/gi, "")
    .replace(/\bFATO\s+OU\s+FAKE\b/gi, "")
    .replace(/\bCHECAGEM\s+DE\s+FATOS\b/gi, "");

  // 5. Remove links, chamadas e pedidos de acesso a grupos/canais de WhatsApp
  texto = texto
    .replace(/(?:entre|acesse|participe|clique|veja|siga|inscreva-se)\s+(?:no\s+|em\s+|ao\s+|do\s+)?(?:nosso\s+)?(?:grupo|canal|comunidade)?\s*(?:do|no)?\s*whatsapp[^.!\n]{0,80}[.!]+/gi, "")
    .replace(/(?:link\s*:\s*)?:?\/\/[^\s]+/gi, "")
    .replace(/(?:https?:)?(?:\/\/)?(?:chat\.)?whatsapp\.com\S*/gi, "")
    .replace(/https?:\/\/wa\.me\S*/gi, "")
    .replace(/https?:\/\/t\.me\S*/gi, "")
    .replace(/https?:\/\/telegram\.me\S*/gi, "")
    .replace(/\bwhatsapp\.com\S*/gi, "")
    .replace(/\bLink\s*:\s*/gi, "")
    .replace(/(?:^|\s+)com\s+(?=[A-Z])/g, " ")
    .replace(/d[êe]\s+um\s+(?:joinha|like)[^.!\n]{0,25}[.!]*/gi, "")
    .replace(/\bdeixe\s+seu\s+like[^.!\n]{0,25}[.!]*/gi, "")
    .replace(/\be?\s*compartilhe\s*(?:com\s+amigos|esta\s+not[íi]cia|este\s+conte[ú]do)?[.!]*/gi, "")
    .replace(/para\s+n[ãa]o\s+perder\s+nada[.!]*/gi, "");

  // 6. Filtra linhas isoladas de poucas palavras/letras (frases de interferência)
  const paragrafos = texto
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => {
      if (!p) return false;
      // Frase com menos de 20 caracteres sem pontuação geralmente é ruído ou chamada isolada
      if (p.length < 20 && !/[.!?]$/.test(p)) return false;
      if (p.toLowerCase().includes("whatsapp") || p.toLowerCase().includes("telegram")) return false;
      return true;
    });

  return paragrafos.join("\n\n").trim();
}

/**
 * Corrige o texto de uma notícia de feed RSS/XML eliminando emojis, marcas de verificação,
 * links/pedidos de WhatsApp e mantendo apenas os parágrafos completos do conteúdo.
 *
 * Suporta variáveis de ambiente (secret): AI_API_KEY, AI_ENDPOINT, AI_MODEL.
 * Quando as variáveis não tiverem valor, utiliza a IA Pollinations gratuita (sem API key).
 *
 * @param {string} textoNoticia - O texto bruto extraído do feed RSS
 * @returns {Promise<string>} O texto limpo e corrigido
 */
export async function processarEConfigurarNoticia(textoNoticia: string): Promise<string> {
  if (!textoNoticia || typeof textoNoticia !== "string" || !textoNoticia.trim()) {
    return "";
  }

  // Chave de cache para evitar reprocessamento desnecessário
  const cacheKey = textoNoticia.slice(0, 150).replace(/\s+/g, " ").trim();
  if (textCleanCache.has(cacheKey)) {
    return textCleanCache.get(cacheKey)!;
  }

  // 0. Pré-limpeza local com biblioteca sanitize-html e regex determinística
  const textoPreLimpo = preLimparTextoRss(textoNoticia);
  if (!textoPreLimpo || textoPreLimpo.length < 30) {
    return textoPreLimpo || textoNoticia.trim();
  }

  // 1. Definição das variáveis de ambiente (substitua por process.env se estiver no Node.js)
  const API_KEY = typeof process !== "undefined" ? (process.env.AI_API_KEY || "") : "";
  const ENDPOINT = typeof process !== "undefined" ? (process.env.AI_ENDPOINT || "") : "";
  const MODELO = typeof process !== "undefined" ? (process.env.AI_MODEL || "") : "";

  // Instrução do sistema especializada em limpar o texto conforme as regras
  const systemPrompt = `Você é um revisor jornalístico profissional.
Seu único objetivo é limpar o texto da notícia oriunda de um feed RSS, seguindo estritamente estas regras:
1. Elimine completamente emojis, figurinhas e marcas de verificação (como [VERIFICADO], selos, etc.).
2. Remova chamadas, links ou pedidos de acesso a grupos de WhatsApp, canais ou contatos da fonte.
3. Ignore frases isoladas de pouco conteúdo ou poucas letras (frases de interferência).
4. Mantenha apenas os parágrafos completos e originais que contêm o conteúdo real da notícia.
5. Nunca adicione saudações, introduções, conclusões ou formatações como Markdown extras (não use ** ou #). Retorne apenas o texto jornalístico limpo.`;

  // 2. Verificação de Fluxo: Se houver Endpoint e Chave configurados, usa a API privada
  if (ENDPOINT && API_KEY) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODELO || "gpt-4o-mini", // Fallback caso o modelo não esteja preenchido
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: textoPreLimpo },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`Erro no Endpoint Privado: ${response.statusText}`);

      const data = await response.json();
      const textoLimpo = data.choices?.[0]?.message?.content || data.text || "";
      if (textoLimpo && typeof textoLimpo === "string" && textoLimpo.trim().length > 20) {
        const resultadoFinal = textoLimpo.trim();
        textCleanCache.set(cacheKey, resultadoFinal);
        persistCleanCacheDebounced();
        return resultadoFinal;
      }
    } catch (error) {
      console.warn("Falha no endpoint privado. Tentando redundância com Pollinations.AI...", error);
    }
  }

  // 3. Fallback: Uso da IA Pollinations gratuita (Sem API Key)
  const urlPollinations = "https://text.pollinations.ai/";
  const payloadPollinations = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: textoPreLimpo },
    ],
    model: "openai", // Utiliza o modelo padrão da comunidade do Pollinations
    jsonMode: false,
  };

  try {
    const response = await fetch(urlPollinations, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadPollinations),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Erro na API Pollinations: ${response.statusText}`);
    }

    const textoLimpo = await response.text();
    const resultado = textoLimpo.trim();
    if (resultado && resultado.length > 20) {
      textCleanCache.set(cacheKey, resultado);
      persistCleanCacheDebounced();
      return resultado;
    }
  } catch (error: any) {
    // Se a API externa estiver momentaneamente indisponível ou em timeout,
    // o texto pré-limpo sanitizado com sanitize-html garante 100% de confiabilidade imediata
    console.warn("Aviso na IA Pollinations (usando pré-limpeza determinística):", error?.message || error);
  }

  // Retorna texto pré-limpo com garantia de eliminação de emojis, selos e whatsapp
  textCleanCache.set(cacheKey, textoPreLimpo);
  persistCleanCacheDebounced();
  return textoPreLimpo;
}

/**
 * Identifica se a notícia pertence a uma fonte de feed RSS/XML
 * (por exemplo, fontes com type="rss", G1, ou URLs de feed).
 */
export function isRssFeedSource(itemOrSource: any): boolean {
  if (!itemOrSource) return false;
  if (itemOrSource.type === "rss" || itemOrSource.sourceType === "rss") return true;
  const site = String(itemOrSource.site || itemOrSource.originalSite || itemOrSource.sourceSite || "").toLowerCase();
  const url = String(itemOrSource.url || itemOrSource.link || "").toLowerCase();
  if (site.includes("g1.globo.com") || url.includes("g1.globo.com")) return true;
  if (url.includes("/rss") || url.includes(".xml") || url.includes("feed")) return true;
  return false;
}
