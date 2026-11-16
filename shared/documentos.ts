// Documentos privados da fazenda (matrícula, CAR, mapas…). Sobem só pelo painel do site e
// NUNCA são exibidos no site público. O CRM interno os lê, apenas para baixar.
export const CATEGORIAS_DOCUMENTO = ["Matrícula", "Escritura", "CAR", "CCIR", "ITR", "Georreferenciamento", "Mapa", "Laudos", "Outros"] as const;
export const MAX_DOCUMENTO = 12 * 1024 * 1024;
export const NOME_ARQUIVO_DOCUMENTO = /^[a-f0-9]{48}\.(pdf|jpg|png)$/;
export interface DocumentoFazenda {
  id: number; fazenda_id: number; nome: string; categoria: string; descricao: string; tamanho: number; criado_em: string;
}
