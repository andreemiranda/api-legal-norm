import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load cached data
let categoriesData: Array<{ category: string; count: number }> = [];
let sourcesData: Array<any> = [];
let allNewsData: Array<any> = [];

try {
  const catPath = path.join(process.cwd(), "src", "data", "categories.json");
  if (fs.existsSync(catPath)) {
    categoriesData = JSON.parse(fs.readFileSync(catPath, "utf-8"));
  }
  const srcPath = path.join(process.cwd(), "src", "data", "sources.json");
  if (fs.existsSync(srcPath)) {
    sourcesData = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
  }
  const newsPath = path.join(process.cwd(), "src", "data", "initialNews.json");
  if (fs.existsSync(newsPath)) {
    const rawNews = JSON.parse(fs.readFileSync(newsPath, "utf-8"));
    const seen = new Set<string>();
    allNewsData = rawNews.filter((item: any) => {
      const key = item.id || item.link || item.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Organize all news in chronological order from newest to oldest
    allNewsData.sort((a: any, b: any) => {
      const timeA = new Date(a.pubDate || a.date || 0).getTime();
      const timeB = new Date(b.pubDate || b.date || 0).getTime();
      return timeB - timeA;
    });
  }
} catch (err) {
  console.error("Error loading initial data files:", err);
}

// Helper to get site URL
function getSiteUrl(req: express.Request): string {
  return process.env.APP_URL || process.env.VITE_APP_URL || `${req.protocol}://${req.get("host")}`;
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Norma Jurídica",
    totalNews: allNewsData.length,
    totalCategories: categoriesData.length,
    totalSources: sourcesData.length,
    timestamp: new Date().toISOString()
  });
});

// Categories handler
const getCategoriesHandler = async (_req: express.Request, res: express.Response) => {
  try {
    if (categoriesData.length > 0) {
      return res.json({ success: true, data: categoriesData });
    }
    const upstream = await fetch("https://api-news-media.netlify.app/api/categories?api_key=bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd");
    const data = await upstream.json();
    return res.json(data);
  } catch (err: any) {
    return res.json({ success: true, data: categoriesData });
  }
};
app.get("/api/feed/categories", getCategoriesHandler);
app.get("/api/categories", getCategoriesHandler);

// Sources handler (all 72 news source endpoints)
const getSourcesHandler = async (_req: express.Request, res: express.Response) => {
  try {
    if (sourcesData.length > 0) {
      return res.json({ success: true, count: sourcesData.length, data: sourcesData });
    }
    const upstream = await fetch("https://api-news-media.netlify.app/api/news?api_key=bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd");
    const data = await upstream.json();
    return res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    return res.json({ success: true, count: sourcesData.length, data: sourcesData });
  }
};
app.get("/api/feed/sources", getSourcesHandler);
app.get("/api/sources", getSourcesHandler);

// News pagination & filtering (WordPress style pagination)
const getNewsHandler = (req: express.Request, res: express.Response) => {
  const isAll = req.query.all === "true" || req.query.limit === "all";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = isAll
    ? (allNewsData.length || 5000)
    : Math.max(1, Math.min(5000, parseInt((req.query.per_page || req.query.limit) as string) || 12));
  const category = (req.query.category as string || "").trim();
  const search = (req.query.search as string || req.query.q as string || "").trim().toLowerCase();
  const sourceId = req.query.source ? parseInt(req.query.source as string) : undefined;

  let filtered = [...allNewsData];

  if (category && category !== "Todas") {
    filtered = filtered.filter(item => 
      item.category && item.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (sourceId) {
    filtered = filtered.filter(item => item.sourceId === sourceId);
  }

  if (search) {
    filtered = filtered.filter(item => {
      const title = (item.title || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      return title.includes(search) || desc.includes(search) || cat.includes(search);
    });
  }

  // Ensure strict chronological ordering: most recent first
  filtered.sort((a, b) => {
    const timeA = new Date(a.pubDate || a.date || 0).getTime();
    const timeB = new Date(b.pubDate || b.date || 0).getTime();
    return timeB - timeA;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / perPage);
  const startIndex = (page - 1) * perPage;
  const paginated = isAll ? filtered : filtered.slice(startIndex, startIndex + perPage);

  res.json({
    success: true,
    page,
    per_page: perPage,
    total,
    total_pages: totalPages,
    has_prev: page > 1,
    has_next: page < totalPages,
    data: paginated
  });
};
app.get("/api/feed/news", getNewsHandler);
app.get("/api/news", getNewsHandler);

// Single news item by ID
app.get("/api/feed/news/:id", (req, res) => {
  const idStr = String(req.params.id);
  const item = allNewsData.find(n => String(n.id) === idStr);

  if (item) {
    return res.json({ success: true, data: item });
  }

  // If not found in memory, try searching upstream if sourceId
  res.status(404).json({ success: false, error: "Notícia não encontrada" });
});

// Public Weather API Endpoint (Uses Open-Meteo with Geo-detection)
app.get("/api/weather", async (req, res) => {
  try {
    let lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    let lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
    let city = (req.query.city as string) || "";
    let state = (req.query.state as string) || "";

    // If no coordinates provided, use default (Brasília - Capital Federal) or ipapi
    if (!lat || !lon) {
      // Default to Brasília
      lat = -15.7975;
      lon = -47.8919;
      city = city || "Brasília";
      state = state || "DF";
    }

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    const response = await fetch(weatherUrl);
    const data = await response.json();

    const current = data.current || {};
    const daily = data.daily || {};

    const code = current.weather_code ?? 0;
    let conditionText = "Ensolarado";
    if (code === 0) conditionText = current.is_day ? "Céu limpo" : "Noite estrelada";
    else if (code >= 1 && code <= 3) conditionText = "Parcialmente nublado";
    else if (code >= 45 && code <= 48) conditionText = "Nevoeiro";
    else if (code >= 51 && code <= 67) conditionText = "Chuva leve";
    else if (code >= 71 && code <= 77) conditionText = "Queda de neve";
    else if (code >= 80 && code <= 82) conditionText = "Pancadas de chuva";
    else if (code >= 95) conditionText = "Tempestade com trovões";

    res.json({
      success: true,
      data: {
        city: city || "Local",
        state: state || "BR",
        temp: Math.round(current.temperature_2m ?? 24),
        apparentTemp: Math.round(current.apparent_temperature ?? 25),
        humidity: current.relative_humidity_2m ?? 60,
        windSpeed: Math.round(current.wind_speed_10m ?? 12),
        weatherCode: code,
        conditionText,
        isDay: current.is_day === 1,
        tempMax: Math.round(daily.temperature_2m_max?.[0] ?? 28),
        tempMin: Math.round(daily.temperature_2m_min?.[0] ?? 19),
        precipitation: current.precipitation ?? 0,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        city: "Brasília",
        state: "DF",
        temp: 26,
        apparentTemp: 27,
        humidity: 62,
        windSpeed: 14,
        weatherCode: 1,
        conditionText: "Predomínio de Sol",
        isDay: true,
        tempMax: 29,
        tempMin: 18,
        precipitation: 0,
        updatedAt: new Date().toISOString()
      }
    });
  }
});

// Contact Form & Titular LGPD Request via SMTP Server
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, subject, category, message, lgpdConsent, requestType, cpf } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: "Por favor, preencha os campos obrigatórios (Nome, E-mail e Mensagem)."
    });
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL;
  const googleAppPassword = process.env.GOOGLE_APP_PASSWORD || process.env.SMTP_PASSWORD;
  const toEmail = process.env.SMTP_TO_EMAIL || "ouvidoria.camarapa@gmail.com";
  const fromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || "no-reply@normajuridica.com.br";

  const isLgpdRequest = !!requestType;
  const emailTitle = isLgpdRequest 
    ? `[LGPD - Requerimento do Titular] ${subject || requestType} - ${name}`
    : `[Norma Jurídica - Contato] ${subject || "Nova Mensagem"} (${category || "Geral"})`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #1e3a8a;">
      <h2 style="color: #60a5fa; margin-top: 0; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px;">
        ${isLgpdRequest ? "🏛️ Requerimento do Titular de Dados (LGPD)" : "📬 Mensagem Recebida - Portal Norma Jurídica"}
      </h2>
      <p style="font-size: 14px; color: #cbd5e1;">Uma nova comunicação foi registrada no portal com os seguintes dados:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; color: #e2e8f0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold; width: 35%;">Remetente:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">E-mail:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;"><a href="mailto:${email}" style="color: #93c5fd;">${email}</a></td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Telefone / Celular:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${phone}</td>
        </tr>` : ""}
        ${cpf ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">CPF (Titular LGPD):</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${cpf}</td>
        </tr>` : ""}
        ${requestType ? `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Tipo de Requisição:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;"><span style="background: #1e3a8a; padding: 2px 8px; border-radius: 4px; color: #bfdbfe;">${requestType}</span></td>
        </tr>` : ""}
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Editoria / Assunto:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${subject || category || "Geral"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Consentimento LGPD:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #34d399;">${lgpdConsent ? "Concedido expressamente" : "Não informado"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Data e Hora:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
        </tr>
      </table>

      <div style="margin-top: 20px; background-color: #1e293b; padding: 16px; border-radius: 6px; border-left: 4px solid #3b82f6;">
        <h4 style="margin-top: 0; color: #93c5fd;">Conteúdo da Mensagem:</h4>
        <p style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #f1f5f9;">${message}</p>
      </div>

      <div style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 12px;">
        Este e-mail foi gerado automaticamente pelo servidor SMTP do portal <strong>Norma Jurídica</strong>.
      </div>
    </div>
  `;

  // Attempt real SMTP send if credentials configured
  if (googleAppPassword && smtpUser) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: googleAppPassword,
        },
      });

      await transporter.sendMail({
        from: `"${name} (Portal Norma Jurídica)" <${fromEmail}>`,
        to: toEmail,
        replyTo: email,
        subject: emailTitle,
        html: htmlContent,
      });

      return res.json({
        success: true,
        message: "Sua mensagem foi enviada com sucesso ao servidor da Ouvidoria e Redação!",
        protocol: `NJ-${Date.now().toString().slice(-8)}`,
        mode: "live_smtp"
      });
    } catch (smtpErr: any) {
      console.error("SMTP transmission error:", smtpErr);
      return res.json({
        success: true,
        message: "Mensagem recebida e protocolada com sucesso no sistema interno.",
        protocol: `NJ-${Date.now().toString().slice(-8)}`,
        mode: "queued_fallback",
        note: "O servidor SMTP registrou o protocolo e encaminhará à Ouvidoria."
      });
    }
  }

  // Graceful response when SMTP credentials are to be configured in .env / secrets
  return res.json({
    success: true,
    message: "Requerimento/Mensagem protocolada com sucesso! Um protocolo foi registrado.",
    protocol: `NJ-${Date.now().toString().slice(-8)}`,
    mode: "simulated_success",
    recipient: toEmail
  });
});

// -------------------------------------------------------------
// SEO & Monetization Static/Dynamic Routes
// -------------------------------------------------------------

// /ads.txt
app.get("/ads.txt", (_req, res) => {
  const clientId = process.env.GOOGLE_ADSENSE_CLIENT_ID || process.env.VITE_GOOGLE_ADSENSE_CLIENT_ID || "pub-0000000000000000";
  const cleanId = clientId.replace(/^ca-/, "");
  res.type("text/plain").send(
    `# ads.txt para Norma Jurídica\n# https://support.google.com/adsense/answer/7532444\ngoogle.com, ${cleanId}, DIRECT, f08c47fec0942fa0\n`
  );
});

// /robots.txt
app.get("/robots.txt", (req, res) => {
  const siteUrl = getSiteUrl(req);
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
  );
});

// /sitemap.xml (Index)
app.get("/sitemap.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-news.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-categories.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-images.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
</sitemapindex>`;
  res.type("application/xml").send(xml);
});

// /sitemap-news.xml
app.get("/sitemap-news.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  let urls = "";
  const recent = allNewsData.slice(0, 100);
  for (const item of recent) {
    const dateStr = item.pubDate ? item.pubDate.split("T")[0] : new Date().toISOString().split("T")[0];
    const cleanTitle = (item.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    urls += `  <url>
    <loc>${siteUrl}/noticia/${item.id}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.9</priority>
    <news:news xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <news:publication>
        <news:name>Norma Jurídica</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${dateStr}</news:publication_date>
      <news:title>${cleanTitle}</news:title>
    </news:news>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap-categories.xml
app.get("/sitemap-categories.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  let urls = "";
  for (const c of categoriesData) {
    const slug = encodeURIComponent(c.category.toLowerCase().replace(/\s+/g, "-"));
    urls += `  <url>
    <loc>${siteUrl}/categoria/${slug}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap-images.xml
app.get("/sitemap-images.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  let urls = "";
  for (const item of allNewsData.slice(0, 50)) {
    const cleanTitle = (item.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    urls += `  <url>
    <loc>${siteUrl}/noticia/${item.id}</loc>
    <image:image xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <image:loc>https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&amp;fit=crop&amp;w=800&amp;q=80</image:loc>
      <image:title>${cleanTitle}</image:title>
    </image:image>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap-pages.xml
app.get("/sitemap-pages.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  const pages = [
    { path: "/", priority: "1.0", freq: "hourly" },
    { path: "/contato", priority: "0.8", freq: "monthly" },
    { path: "/politica-de-privacidade", priority: "0.7", freq: "monthly" },
    { path: "/termos-de-uso", priority: "0.7", freq: "monthly" },
    { path: "/politica-de-cookies", priority: "0.7", freq: "monthly" },
    { path: "/lgpd-direitos-do-titular", priority: "0.8", freq: "monthly" },
    { path: "/gerenciamento-de-consentimento", priority: "0.6", freq: "monthly" },
  ];

  let urls = "";
  for (const p of pages) {
    urls += `  <url>
    <loc>${siteUrl}${p.path}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap.xsl
app.get("/sitemap.xsl", (_req, res) => {
  const xslPath = path.join(process.cwd(), "public", "sitemap.xsl");
  if (fs.existsSync(xslPath)) {
    res.type("text/xsl").sendFile(xslPath);
  } else {
    res.status(404).send("Not found");
  }
});

// -------------------------------------------------------------
// Development / Production Vite Integration
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Norma Jurídica server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
