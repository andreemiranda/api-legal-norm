const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const upstream = await fetch\(\s*`https:\/\/api-news-media.netlify.app\/api\/images\/\$\{idStr\}\?api_key=\$\{process.env.NEWS_API_KEY\}&limit=15`\s*\);/,
  'const upstream = await fetch(\n      `https://api-news-media.netlify.app/api/images/${idStr}?api_key=${process.env.NEWS_API_KEY}&limit=15`,\n      { signal: AbortSignal.timeout(5000) }\n    );'
);

code = code.replace(
  /const upstreamRes = await fetch\(\s*`https:\/\/api-news-media.netlify.app\/api\/news\?api_key=\$\{process.env.NEWS_API_KEY\}&limit=30`\s*\);/,
  'const upstreamRes = await fetch(\n      `https://api-news-media.netlify.app/api/news?api_key=${process.env.NEWS_API_KEY}&limit=30`,\n      { signal: AbortSignal.timeout(5000) }\n    );'
);

code = code.replace(
  /const response = await fetch\(weatherUrl\);/,
  'const response = await fetch(weatherUrl, { signal: AbortSignal.timeout(5000) });'
);

fs.writeFileSync('server.ts', code);
