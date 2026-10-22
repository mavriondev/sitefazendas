import type { Db } from "./db";

// Migrações idempotentes (CREATE ... IF NOT EXISTS): rodam a cada start, nunca apagam dados.
export const MIGRACOES: string[] = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    whatsapp TEXT,
    papel TEXT NOT NULL DEFAULT 'comprador' CHECK (papel IN ('comprador','admin')),
    nivel_acesso TEXT NOT NULL DEFAULT 'aberto' CHECK (nivel_acesso IN ('aberto','desbloqueado','completo')),
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    aceite_lgpd_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_login_em TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS fazendas (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','revisao','publicada','vendida','arquivada')),
    destaque BOOLEAN NOT NULL DEFAULT FALSE,
    destaque_ordem INTEGER NOT NULL DEFAULT 0,
    -- PÚBLICO (só vai para a vitrine o que o admin revisou)
    descricao_publica TEXT,
    regiao_publica TEXT,
    culturas TEXT[] NOT NULL DEFAULT '{}',
    area_ha NUMERIC,
    area_exibicao TEXT NOT NULL DEFAULT 'exata' CHECK (area_exibicao IN ('exata','faixa')),
    preco_exibicao TEXT,
    mostrar_mapa BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_proprio TEXT,
    -- PRIVADO (nunca sai nas rotas /api/public)
    car_codigo TEXT,
    municipio TEXT,
    uf TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geojson JSONB,
    notas_internas TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    publicado_em TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fazendas_status ON fazendas (status, destaque DESC, destaque_ordem)`,
  `CREATE TABLE IF NOT EXISTS fazenda_atributos (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('confirmado','indicado','sem_dado')),
    achado TEXT NOT NULL CHECK (achado IN ('detectado','nao_detectado','indeterminado')),
    valor_json JSONB,
    fonte TEXT,
    observacao TEXT,
    confirmado_por TEXT,
    consultado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    publico BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (fazenda_id, chave)
  )`,
  `CREATE TABLE IF NOT EXISTS fazenda_fotos (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    arquivo TEXT NOT NULL,
    legenda TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    capa BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS slides (
    id SERIAL PRIMARY KEY,
    titulo TEXT,
    subtitulo TEXT,
    arquivo TEXT,
    link_tipo TEXT NOT NULL DEFAULT 'nenhum' CHECK (link_tipo IN ('nenhum','fazenda','url')),
    fazenda_id INTEGER REFERENCES fazendas(id) ON DELETE SET NULL,
    url TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  `CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor JSONB NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS contatos (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER REFERENCES fazendas(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    pesquisa_token TEXT,
    nome TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,
    mensagem TEXT,
    origem TEXT NOT NULL DEFAULT 'vitrine' CHECK (origem IN ('vitrine','pesquisa')),
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','atendido')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Registro de apresentação: prova de quando e a quem a terra foi apresentada (proteção da comissão).
  `CREATE TABLE IF NOT EXISTS apresentacoes (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER REFERENCES fazendas(id) ON DELETE SET NULL,
    pesquisa_token TEXT,
    comprador_nome TEXT NOT NULL,
    comprador_contato TEXT,
    canal TEXT,
    observacao TEXT,
    apresentado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
  )`,
  // Módulo B: token opaco ↔ código CAR real (o comprador nunca vê o código).
  `CREATE TABLE IF NOT EXISTS pesquisa_tokens (
    token TEXT PRIMARY KEY,
    cod_imovel TEXT NOT NULL,
    uf TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pesquisa_consultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    filtros JSONB,
    resultados INTEGER,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS parceiros (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    arquivo TEXT,
    url TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  // Origens de contato: vitrine (de uma fazenda), pesquisa (módulo B), contato (página Contato), anuncio (quer vender a fazenda).
  `ALTER TABLE contatos DROP CONSTRAINT IF EXISTS contatos_origem_check`,
  `ALTER TABLE contatos ADD CONSTRAINT contatos_origem_check CHECK (origem IN ('vitrine','pesquisa','contato','anuncio'))`,
  // Redefinição de senha sem e-mail: o admin gera um link de uso único (guardamos só o hash do token).
  `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_hash TEXT`,
  `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_expira TIMESTAMPTZ`,
  // Mapa de região aproximada (opcional): círculo grande com centro deslocado de forma fixa e aleatória.
  `ALTER TABLE fazendas ADD COLUMN IF NOT EXISTS mostrar_regiao BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE fazendas ADD COLUMN IF NOT EXISTS regiao_ang REAL NOT NULL DEFAULT random()`,
  `ALTER TABLE fazendas ADD COLUMN IF NOT EXISTS regiao_dist REAL NOT NULL DEFAULT random()`,
  `CREATE INDEX IF NOT EXISTS idx_pesquisa_consultas_usuario ON pesquisa_consultas (usuario_id, criado_em DESC)`,
  // Galeria de vídeos: adição independente, sem alterar anúncios ou fotos existentes.
  `CREATE TABLE IF NOT EXISTS fazenda_videos (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    youtube_id TEXT NOT NULL CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
    titulo TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
    ordem INTEGER NOT NULL DEFAULT 0,
    publico BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fazenda_videos_ordem ON fazenda_videos (fazenda_id, ordem, id)`,
  `CREATE TABLE IF NOT EXISTS site_midias (
    arquivo TEXT PRIMARY KEY CHECK (arquivo ~ '^[a-f0-9]{32}\\.(jpg|png)$'),
    publicado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS seo_midias (
    arquivo TEXT PRIMARY KEY CHECK (arquivo ~ '^[a-f0-9]{32}\\.(jpg|png)$'),
    publicado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

export async function migrar(db: Db): Promise<void> {
  for (const sql of MIGRACOES) await db.query(sql);
}
