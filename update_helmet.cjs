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
      connectSrc: ["'self'", "ws:", "wss:", "https://*.firebaseio.com", "https://*.googleapis.com", "https://api-news-media.netlify.app", "https://pagead2.googlesyndication.com", "https://googleads.g.doubleclick.net", "https://www.google-analytics.com"],
      frameSrc: ["'self'", "https://googleads.g.doubleclick.net", "https://normajuridica.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameAncestors: ["*"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  xFrameOptions: false,
}));`
);

fs.writeFileSync('server.ts', code);
