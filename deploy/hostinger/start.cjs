// Configuração privada fica fora do código e não aparece nos argumentos do processo.
const fs = require("node:fs");
Object.assign(
  process.env,
  JSON.parse(fs.readFileSync("/etc/gramogol/runtime.json", "utf8")),
);
import("/opt/gramogol/dist/server.js").catch(() => {
  console.error("[gramogol] Não foi possível iniciar o aplicativo.");
  process.exitCode = 1;
});
