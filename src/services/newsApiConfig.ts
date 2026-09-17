// News and Media API Endpoints Configuration
// Generated dynamically from environment variables and catalog mapping

export interface NewsApiSourceEndpoint {
  index: number;
  id: number;
  endpoint: string;
  category: string;
  originalSite: string;
}

export interface NewsApiMediaEndpoint {
  index: number;
  id: number;
  endpoint: string;
  site: string;
}

function getEnv(key: string, fallback: string = ""): string {
  try {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key] as string;
    }
    if (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch {}
  return fallback;
}

export const NEWS_API_CONFIG = {
  baseUrl: getEnv("NEWS_API_BASE_URL", "https://api-news-media.netlify.app"),
  apiKey: getEnv("NEWS_API_KEY", "bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd"),
  endpoints: {
    listAllSources: getEnv("NEWS_API_ENDPOINT_LIST_ALL_SOURCES", "/api/news"),
    categoryByName: getEnv("NEWS_API_ENDPOINT_CATEGORY_BY_NAME", "/api/news/category/{category}"),
    listAllImages: getEnv("NEWS_API_ENDPOINT_LIST_ALL_IMAGES", "/api/images"),
    categories: getEnv("NEWS_API_ENDPOINT_CATEGORIES", "/api/categories"),
    types: getEnv("NEWS_API_ENDPOINT_TYPES", "/api/types"),
    stats: getEnv("NEWS_API_ENDPOINT_STATS", "/api/stats"),
    openApiSpec: getEnv("NEWS_API_ENDPOINT_OPENAPI_SPEC", "/api/openapi.json"),
  },
  limits: {
    // ~1.9GB total storage across dual instances
    storageLimitBytes: parseInt(getEnv("LIMIT_STORAGE_BYTES", "1932735283"), 10),
    // ~20GB total bandwidth across dual instances
    trafficLimitBytes: parseInt(getEnv("LIMIT_TRAFFIC_BYTES", "21474836480"), 10),
    // Per-instance storage limit (~950MB)
    perInstanceStorageBytes: 950 * 1024 * 1024,
    // Per-instance traffic limit (~9.8GB)
    perInstanceTrafficBytes: Math.floor(9.8 * 1024 * 1024 * 1024),
  },
};

// 72 Registered Source Endpoints
export const NEWS_SOURCE_ENDPOINTS: NewsApiSourceEndpoint[] = [
  { index: 1, id: 383841537673882, endpoint: "/api/news/383841537673882", category: "Tocantins", originalSite: "clebertoledo.com.br" },
  { index: 2, id: 893766336492326, endpoint: "/api/news/893766336492326", category: "Educação", originalSite: "infoeducacao.com.br" },
  { index: 3, id: 119282349536522, endpoint: "/api/news/119282349536522", category: "Justiça", originalSite: "nacaojuridica.com.br" },
  { index: 4, id: 138781293968447, endpoint: "/api/news/138781293968447", category: "Tocantins", originalSite: "atitudeto.com.br" },
  { index: 5, id: 912241216478934, endpoint: "/api/news/912241216478934", category: "Tocantins", originalSite: "pmwnoticias.com.br" },
  { index: 6, id: 119319283249741, endpoint: "/api/news/119319283249741", category: "Notícias Gerais", originalSite: "admin.cnnbrasil.com.br" },
  { index: 7, id: 673832516549963, endpoint: "/api/news/673832516549963", category: "Tocantins", originalSite: "gazetadocerrado.com.br" },
  { index: 8, id: 859131619791157, endpoint: "/api/news/859131619791157", category: "Economia", originalSite: "minhaseconomias.com.br" },
  { index: 9, id: 331649958919499, endpoint: "/api/news/331649958919499", category: "Esporte", originalSite: "gazetaesportiva.com" },
  { index: 10, id: 263228425877841, endpoint: "/api/news/263228425877841", category: "Notícias Gerais", originalSite: "vocesa.abril.com.br" },
  { index: 11, id: 914761953262293, endpoint: "/api/news/914761953262293", category: "Finanças", originalSite: "classic.exame.com" },
  { index: 12, id: 484292183833791, endpoint: "/api/news/484292183833791", category: "Palmeiras", originalSite: "palmeiras.com.br" },
  { index: 13, id: 699842191757118, endpoint: "/api/news/699842191757118", category: "Goiás", originalSite: "opiniaogoias.com.br" },
  { index: 14, id: 431642583394448, endpoint: "/api/news/431642583394448", category: "Goiás", originalSite: "portalnoticiasgoias.com.br" },
  { index: 15, id: 232452491983424, endpoint: "/api/news/232452491983424", category: "Goiás", originalSite: "diariodegoias.com.br" },
  { index: 16, id: 382992878388555, endpoint: "/api/news/382992878388555", category: "Justiça", originalSite: "conjur.com.br" },
  { index: 17, id: 912895989897239, endpoint: "/api/news/912895989897239", category: "Justiça", originalSite: "meusitejuridico.editorajuspodivm.com.br" },
  { index: 18, id: 552434895747434, endpoint: "/api/news/552434895747434", category: "Justiça", originalSite: "inw.org.br" },
  { index: 19, id: 363855955883429, endpoint: "/api/news/363855955883429", category: "Santa Catarina", originalSite: "santacatarinaempauta.com.br" },
  { index: 20, id: 214239935451987, endpoint: "/api/news/214239935451987", category: "Tocantins", originalSite: "vozdobico.com.br" },
  { index: 21, id: 134352574919451, endpoint: "/api/news/134352574919451", category: "Tocantins", originalSite: "portaldobico.com.br" },
  { index: 22, id: 332328244549349, endpoint: "/api/news/332328244549349", category: "Tocantins", originalSite: "folhadobico.com.br" },
  { index: 23, id: 663841226123673, endpoint: "/api/news/663841226123673", category: "Tocantins", originalSite: "bico24horas.com.br" },
  { index: 24, id: 239261469443631, endpoint: "/api/news/239261469443631", category: "Tocantins", originalSite: "guaraiense.com.br" },
  { index: 25, id: 172626478241883, endpoint: "/api/news/172626478241883", category: "Tocantins", originalSite: "jornalobico.com.br" },
  { index: 26, id: 151892189935957, endpoint: "/api/news/151892189935957", category: "Esporte", originalSite: "ludopedio.org.br" },
  { index: 27, id: 432221191486213, endpoint: "/api/news/432221191486213", category: "Notícias Gerais", originalSite: "folhadestra.com" },
  { index: 28, id: 427785761975213, endpoint: "/api/news/427785761975213", category: "Notícias Gerais", originalSite: "g1.globo.com" },
  { index: 29, id: 892535683444992, endpoint: "/api/news/892535683444992", category: "Santa Catarina", originalSite: "g1.globo.com" },
  { index: 30, id: 974849684945474, endpoint: "/api/news/974849684945474", category: "Tocantins", originalSite: "g1.globo.com" },
  { index: 31, id: 324454919423913, endpoint: "/api/news/324454919423913", category: "Sergipe", originalSite: "g1.globo.com" },
  { index: 32, id: 691371344441814, endpoint: "/api/news/691371344441814", category: "Vale do Paraíba e região", originalSite: "g1.globo.com" },
  { index: 33, id: 897446178272719, endpoint: "/api/news/897446178272719", category: "São Carlos e Araraquara", originalSite: "g1.globo.com" },
  { index: 34, id: 933194249393993, endpoint: "/api/news/933194249393993", category: "Santos e Região", originalSite: "g1.globo.com" },
  { index: 35, id: 831839339459297, endpoint: "/api/news/831839339459297", category: "Ribeirão Preto e Franca", originalSite: "g1.globo.com" },
  { index: 36, id: 419124828553144, endpoint: "/api/news/419124828553144", category: "Mogi das Cruzes e Suzano", originalSite: "g1.globo.com" },
  { index: 37, id: 723191424424467, endpoint: "/api/news/723191424424467", category: "Campinas e região", originalSite: "g1.globo.com" },
  { index: 38, id: 342584813447811, endpoint: "/api/news/342584813447811", category: "Bauru e Marília", originalSite: "g1.globo.com" },
  { index: 39, id: 254882472956384, endpoint: "/api/news/254882472956384", category: "Roraima", originalSite: "g1.globo.com" },
  { index: 40, id: 245424281243145, endpoint: "/api/news/245424281243145", category: "Rondônia", originalSite: "g1.globo.com" },
  { index: 41, id: 766781992469928, endpoint: "/api/news/766781992469928", category: "Rio Grande do Sul", originalSite: "g1.globo.com" },
  { index: 42, id: 244133125413414, endpoint: "/api/news/244133125413414", category: "Rio Grande do Norte", originalSite: "g1.globo.com" },
  { index: 43, id: 161349844169333, endpoint: "/api/news/161349844169333", category: "Sul e Costa Verde Fluminense", originalSite: "g1.globo.com" },
  { index: 44, id: 831941689473231, endpoint: "/api/news/831941689473231", category: "Norte Fluminense", originalSite: "g1.globo.com" },
  { index: 45, id: 444363186445964, endpoint: "/api/news/444363186445964", category: "Região dos Lagos Fluminense", originalSite: "g1.globo.com" },
  { index: 46, id: 818829263524227, endpoint: "/api/news/818829263524227", category: "Região Serrana Fluminense", originalSite: "g1.globo.com" },
  { index: 47, id: 217484393242793, endpoint: "/api/news/217484393242793", category: "Petrolina e Região", originalSite: "g1.globo.com" },
  { index: 48, id: 784182842449454, endpoint: "/api/news/784182842449454", category: "Caruaru e Região", originalSite: "g1.globo.com" },
  { index: 49, id: 645274655999426, endpoint: "/api/news/645274655999426", category: "Norte e Noroeste do Paraná", originalSite: "g1.globo.com" },
  { index: 50, id: 451463938442293, endpoint: "/api/news/451463938442293", category: "Oeste e Sudoeste do Paraná", originalSite: "g1.globo.com" },
  { index: 51, id: 113941349457784, endpoint: "/api/news/113941349457784", category: "Campos Gerais e Sul do Paraná", originalSite: "g1.globo.com" },
  { index: 52, id: 499199511484742, endpoint: "/api/news/499199511484742", category: "Paraná", originalSite: "g1.globo.com" },
  { index: 53, id: 774995463939238, endpoint: "/api/news/774995463939238", category: "Paraíba", originalSite: "g1.globo.com" },
  { index: 54, id: 832514384744418, endpoint: "/api/news/832514384744418", category: "Pará", originalSite: "g1.globo.com" },
  { index: 55, id: 291958422149444, endpoint: "/api/news/291958422149444", category: "Zona da Mata Mineira", originalSite: "g1.globo.com" },
  { index: 56, id: 138925214465973, endpoint: "/api/news/138925214465973", category: "Vales de Minas Gerais", originalSite: "g1.globo.com" },
  { index: 57, id: 669176851683213, endpoint: "/api/news/669176851683213", category: "Sul de Minas", originalSite: "g1.globo.com" },
  { index: 58, id: 932144873293832, endpoint: "/api/news/932144873293832", category: "Grande Minas", originalSite: "g1.globo.com" },
  { index: 59, id: 338554224496117, endpoint: "/api/news/338554224496117", category: "Centro-Oeste de Minas", originalSite: "g1.globo.com" },
  { index: 60, id: 164134119431948, endpoint: "/api/news/164134119431948", category: "Maranhão", originalSite: "g1.globo.com" },
  { index: 61, id: 399912785456532, endpoint: "/api/news/399912785456532", category: "Amazonas", originalSite: "g1.globo.com" },
  { index: 62, id: 446149137873394, endpoint: "/api/news/446149137873394", category: "Amapá", originalSite: "g1.globo.com" },
  { index: 63, id: 597174398438273, endpoint: "/api/news/597174398438273", category: "Alagoas", originalSite: "g1.globo.com" },
  { index: 64, id: 142414733688861, endpoint: "/api/news/142414733688861", category: "Acre", originalSite: "g1.globo.com" },
  { index: 65, id: 494339475812222, endpoint: "/api/news/494339475812222", category: "Turismo e Viagem", originalSite: "g1.globo.com" },
  { index: 66, id: 158311376392135, endpoint: "/api/news/158311376392135", category: "Tecnologia e Games", originalSite: "g1.globo.com" },
  { index: 67, id: 429447432493472, endpoint: "/api/news/429447432493472", category: "Pop & Arte", originalSite: "g1.globo.com" },
  { index: 68, id: 477372321386414, endpoint: "/api/news/477372321386414", category: "Mundo", originalSite: "g1.globo.com" },
  { index: 69, id: 174666593891425, endpoint: "/api/news/174666593891425", category: "Loterias", originalSite: "g1.globo.com" },
  { index: 70, id: 863534413172943, endpoint: "/api/news/863534413172943", category: "Educação", originalSite: "g1.globo.com" },
  { index: 71, id: 411718493791472, endpoint: "/api/news/411718493791472", category: "Economia", originalSite: "g1.globo.com" },
  { index: 72, id: 123961798934467, endpoint: "/api/news/123961798934467", category: "Autoesporte", originalSite: "g1.globo.com" },
];

// 27 Registered Media Endpoints (Synchronized with News Source IDs)
export const NEWS_MEDIA_ENDPOINTS: NewsApiMediaEndpoint[] = [
  { index: 1, id: 383841537673882, endpoint: "/api/images/383841537673882", site: "https://api-news-media.netlify.app/api/images/383841537673882" },
  { index: 2, id: 893766336492326, endpoint: "/api/images/893766336492326", site: "https://api-news-media.netlify.app/api/images/893766336492326" },
  { index: 3, id: 119282349536522, endpoint: "/api/images/119282349536522", site: "https://api-news-media.netlify.app/api/images/119282349536522" },
  { index: 4, id: 138781293968447, endpoint: "/api/images/138781293968447", site: "https://api-news-media.netlify.app/api/images/138781293968447" },
  { index: 5, id: 912241216478934, endpoint: "/api/images/912241216478934", site: "https://api-news-media.netlify.app/api/images/912241216478934" },
  { index: 6, id: 119319283249741, endpoint: "/api/images/119319283249741", site: "https://api-news-media.netlify.app/api/images/119319283249741" },
  { index: 7, id: 673832516549963, endpoint: "/api/images/673832516549963", site: "https://api-news-media.netlify.app/api/images/673832516549963" },
  { index: 8, id: 859131619791157, endpoint: "/api/images/859131619791157", site: "https://api-news-media.netlify.app/api/images/859131619791157" },
  { index: 9, id: 331649958919499, endpoint: "/api/images/331649958919499", site: "https://api-news-media.netlify.app/api/images/331649958919499" },
  { index: 10, id: 263228425877841, endpoint: "/api/images/263228425877841", site: "https://api-news-media.netlify.app/api/images/263228425877841" },
  { index: 11, id: 914761953262293, endpoint: "/api/images/914761953262293", site: "https://api-news-media.netlify.app/api/images/914761953262293" },
  { index: 12, id: 484292183833791, endpoint: "/api/images/484292183833791", site: "https://api-news-media.netlify.app/api/images/484292183833791" },
  { index: 13, id: 699842191757118, endpoint: "/api/images/699842191757118", site: "https://api-news-media.netlify.app/api/images/699842191757118" },
  { index: 14, id: 431642583394448, endpoint: "/api/images/431642583394448", site: "https://api-news-media.netlify.app/api/images/431642583394448" },
  { index: 15, id: 232452491983424, endpoint: "/api/images/232452491983424", site: "https://api-news-media.netlify.app/api/images/232452491983424" },
  { index: 16, id: 382992878388555, endpoint: "/api/images/382992878388555", site: "https://api-news-media.netlify.app/api/images/382992878388555" },
  { index: 17, id: 912895989897239, endpoint: "/api/images/912895989897239", site: "https://api-news-media.netlify.app/api/images/912895989897239" },
  { index: 18, id: 552434895747434, endpoint: "/api/images/552434895747434", site: "https://api-news-media.netlify.app/api/images/552434895747434" },
  { index: 19, id: 363855955883429, endpoint: "/api/images/363855955883429", site: "https://api-news-media.netlify.app/api/images/363855955883429" },
  { index: 20, id: 214239935451987, endpoint: "/api/images/214239935451987", site: "https://api-news-media.netlify.app/api/images/214239935451987" },
  { index: 21, id: 134352574919451, endpoint: "/api/images/134352574919451", site: "https://api-news-media.netlify.app/api/images/134352574919451" },
  { index: 22, id: 332328244549349, endpoint: "/api/images/332328244549349", site: "https://api-news-media.netlify.app/api/images/332328244549349" },
  { index: 23, id: 663841226123673, endpoint: "/api/images/663841226123673", site: "https://api-news-media.netlify.app/api/images/663841226123673" },
  { index: 24, id: 239261469443631, endpoint: "/api/images/239261469443631", site: "https://api-news-media.netlify.app/api/images/239261469443631" },
  { index: 25, id: 172626478241883, endpoint: "/api/images/172626478241883", site: "https://api-news-media.netlify.app/api/images/172626478241883" },
  { index: 26, id: 151892189935957, endpoint: "/api/images/151892189935957", site: "https://api-news-media.netlify.app/api/images/151892189935957" },
  { index: 27, id: 432221191486213, endpoint: "/api/images/432221191486213", site: "https://api-news-media.netlify.app/api/images/432221191486213" },
];

export function buildUpstreamUrl(path: string, params?: Record<string, string | number>): string {
  const base = NEWS_API_CONFIG.baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  if (NEWS_API_CONFIG.apiKey) {
    url.searchParams.set("api_key", NEWS_API_CONFIG.apiKey);
  }
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return url.toString();
}
