const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.post\("\/api\/monitoring\/sync", authLimiter, async \(_req: express\.Request, res: express\.Response\) => \{/,
  `app.post("/api/monitoring/sync", authLimiter, async (req: express.Request, res: express.Response) => {
  const serverAdminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const authHeader = req.headers.authorization;
  if (!serverAdminPassword || authHeader !== \`Bearer \${serverAdminPassword}\`) {
    return res.status(401).json({ success: false, error: "Não autorizado" });
  }`
);

fs.writeFileSync('server.ts', code);
