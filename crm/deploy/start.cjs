// Template futuro; não executa a instalação e não lê o runtime do site.
const fs = require("node:fs");
Object.assign(process.env, JSON.parse(fs.readFileSync("/etc/gramogol-crm/runtime.json", "utf8")));
import("/opt/gramogol-crm/dist-crm/server.js").catch(() => {
  console.error("[CRM] Falha ao iniciar. Confira a configuração privada.");
  process.exitCode = 1;
});
