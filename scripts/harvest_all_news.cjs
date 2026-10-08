const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://news-sources-api.vercel.app';
const API_KEY = 'bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd';

function fetchJson(urlPath) {
  return new Promise((resolve) => {
    const fullUrl = `${API_BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}api_key=${API_KEY}`;
    const req = https.get(fullUrl, { timeout: 12000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function run() {
  console.log('[Harvest] Iniciando coleta de todas as matérias da API...');
  
  // 1. Carrega notícias existentes em newsCache.json para preservar
  const cachePath = path.join(process.cwd(), 'src', 'data', 'newsCache.json');
  let existingItems = [];
  try {
    if (fs.existsSync(cachePath)) {
      existingItems = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`[Harvest] Cache existente possui ${existingItems.length} matérias.`);
    }
  } catch (err) {
    console.warn('[Harvest] Não foi possível ler cache existente:', err.message);
  }

  const itemsMap = new Map();
  // Adiciona itens existentes ao Map
  for (const item of existingItems) {
    if (!item) continue;
    const key = String(item.id || item.slug || item.link || item.title);
    itemsMap.set(key, item);
  }

  // 2. Busca lista de fontes ativas
  const sources = await fetchJson('/api/news');
  if (!Array.isArray(sources) || sources.length === 0) {
    console.error('[Harvest] Falha ao obter lista de fontes.');
    process.exit(1);
  }
  console.log(`[Harvest] Total de fontes catalogadas: ${sources.length}`);

  // 3. Processa cada fonte com paginação
  const concurrency = 6;
  let newArticlesFound = 0;

  for (let i = 0; i < sources.length; i += concurrency) {
    const chunk = sources.slice(i, i + concurrency);
    
    await Promise.all(
      chunk.map(async (source) => {
        let page = 1;
        let sourceArticles = 0;
        const maxPages = 20; // até 20 páginas de 100 = 2000 por fonte

        while (page <= maxPages) {
          const pageData = await fetchJson(`/api/news/${source.id}?page=${page}&limit=100`);
          if (!Array.isArray(pageData) || pageData.length === 0) {
            break;
          }

          for (const raw of pageData) {
            const key = String(raw.id || raw.slug || raw.link || raw.title);
            const enriched = {
              ...raw,
              sourceId: source.id,
              sourceSite: source.originalSite || source.site || 'Norma Jurídica',
              category: source.category || raw.category || 'Notícias Gerais',
            };
            if (!itemsMap.has(key)) {
              newArticlesFound++;
            }
            itemsMap.set(key, enriched);
          }

          sourceArticles += pageData.length;
          if (pageData.length < 100) {
            break; // Última página
          }
          page++;
        }

        console.log(`[Harvest] Fonte ${source.id} (${source.category} - ${source.site}): ${sourceArticles} artigos coletados.`);
      })
    );
  }

  const allArticles = Array.from(itemsMap.values());
  console.log(`[Harvest] Total acumulado de notícias após sincronização completa: ${allArticles.length} (Novas encontradas: ${newArticlesFound})`);

  // Ordena por data decrescente (mais recentes no topo)
  allArticles.sort((a, b) => {
    const timeA = new Date(a.date || a.pubDate || a.isoDate || 0).getTime();
    const timeB = new Date(b.date || b.pubDate || b.isoDate || 0).getTime();
    return timeB - timeA;
  });

  // Salva no cache do src e do dist
  fs.writeFileSync(cachePath, JSON.stringify(allArticles), 'utf8');
  console.log(`[Harvest] Salvo com sucesso em ${cachePath} (${(fs.statSync(cachePath).size / 1024 / 1024).toFixed(2)} MB)`);

  const distCachePath = path.join(process.cwd(), 'dist', 'data', 'newsCache.json');
  try {
    const distDir = path.dirname(distCachePath);
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(distCachePath, JSON.stringify(allArticles), 'utf8');
    console.log(`[Harvest] Salvo com sucesso em ${distCachePath}`);
  } catch {}

  console.log('[Harvest] Concluído com sucesso!');
}

run().catch((err) => {
  console.error('[Harvest] Erro fatal:', err);
  process.exit(1);
});
