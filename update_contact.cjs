const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const \{ name, email, phone, subject, category, message, lgpdConsent, requestType, cpf \} = req\.body;/,
  `const { lgpdConsent } = req.body;
  const name = String(req.body.name || "").slice(0, 100);
  const email = String(req.body.email || "").slice(0, 150);
  const phone = String(req.body.phone || "").slice(0, 30);
  const subject = String(req.body.subject || "").slice(0, 150);
  const category = String(req.body.category || "").slice(0, 100);
  const message = String(req.body.message || "").slice(0, 5000);
  const requestType = String(req.body.requestType || "").slice(0, 100);
  const cpf = String(req.body.cpf || "").slice(0, 20);`
);

fs.writeFileSync('server.ts', code);
