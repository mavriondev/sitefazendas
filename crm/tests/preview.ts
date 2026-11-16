import path from "node:path";
import { fixture } from "./fixture";
// Ambiente sintético isolado: nunca lê DATABASE_URL, senha ou runtime da produção.
const f = await fixture(path.resolve("dist-crm/public"));
await new Promise<void>(resolve => f.server.close(() => resolve()));
const server = f.app.listen(Number(process.env.PORT || 3100), "0.0.0.0", () => { process.stdout.write("Prévia do CRM pronta com dados sintéticos.\n"); });
process.on("SIGTERM", () => server.close(() => { f.close().finally(() => process.exit(0)); }));
