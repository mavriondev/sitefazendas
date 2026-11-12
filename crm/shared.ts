export const ETAPAS = ["novo", "em_atendimento", "visita_agendada", "proposta", "concluida", "nao_avancou"] as const;
export type Etapa = typeof ETAPAS[number];
export const ROTULOS: Record<Etapa, string> = { novo: "Novo", em_atendimento: "Em atendimento", visita_agendada: "Visita agendada", proposta: "Proposta", concluida: "Concluída", nao_avancou: "Não avançou" };
export interface User { id: number; nome: string; email: string; papel: "admin" | "membro"; bloqueado: boolean; versao: number }
export interface Farm {
  id: number; titulo: string; slug: string; status: string; regiao: string | null; area: string | null;
  descricao: string | null; dados: Record<string, unknown>; atributos: Array<Record<string, unknown>>;
  fotos: Array<{ arquivo: string; legenda: string | null }>; atualizado_em: string; disponivel: boolean;
}
export interface Contact {
  id: number; nome: string; telefone: string; email: string | null; origem: string;
  observacoes: string; responsavel_id: number; responsavel_nome: string; versao: number;
  fazenda_ids: number[]; criado_em: string;
}
export interface Deal {
  id: number; contato_id: number; fazenda_id: number; contato_nome: string; fazenda_titulo: string;
  etapa: Etapa; proximo_retorno: string | null; observacoes: string; versao: number; atualizado_em: string;
}
export interface Event { id: number; acao: string; autor_nome: string; criado_em: string; detalhes: Record<string, unknown> }
export interface Document {
  id: number; fazenda_id: number; nome: string; categoria: string; descricao: string;
  tamanho: number; criado_em: string; autor_nome: string;
}
export interface Access { fazenda_ids: number[]; contato_ids: number[] }
export interface SourceStatus { atualizado_em: string | null; erro: boolean; site_url: string }
