const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.use\(helmet\(\{[\s\S]*?\}\)\);/m,
  `app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://pagead2.googlesyndication.com", "https://www.googletagmanager.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "https://api-news-media.netlify.app", "https://pagead2.googlesyndication.com", "https://googleads.g.doubleclick.net", "https://www.google-analytics.com"],
      frameSrc: ["'self'", "https://googleads.g.doubleclick.net", "https://normajuridica.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));`
);

code = code.replace(
  /app\.use\(cors\(\{[\s\S]*?\}\)\);/m,
  `app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = (process.env.CORS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_DOMAIN || process.env.DOMAIN || "https://normajuridica.com").split(",");
    if (process.env.NODE_ENV !== "production" || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));`
);

fs.writeFileSync('server.ts', code);
