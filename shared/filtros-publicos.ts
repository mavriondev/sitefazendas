// Contrato público: apenas classes fixas, nunca limites arbitrários ou localização privada.
export const REGIOES_BRASIL = [
  { id: "norte", nome: "Norte" }, { id: "nordeste", nome: "Nordeste" },
  { id: "centro-oeste", nome: "Centro-Oeste" }, { id: "sudeste", nome: "Sudeste" }, { id: "sul", nome: "Sul" },
] as const;
const GRUPOS: Record<string, string[][]> = {
  norte: [["AC","Acre"],["AP","Amapá"],["AM","Amazonas"],["PA","Pará"],["RO","Rondônia"],["RR","Roraima"],["TO","Tocantins"]],
  nordeste: [["AL","Alagoas"],["BA","Bahia"],["CE","Ceará"],["MA","Maranhão"],["PB","Paraíba"],["PE","Pernambuco"],["PI","Piauí"],["RN","Rio Grande do Norte"],["SE","Sergipe"]],
  "centro-oeste": [["DF","Distrito Federal"],["GO","Goiás"],["MT","Mato Grosso"],["MS","Mato Grosso do Sul"]],
  sudeste: [["ES","Espírito Santo"],["MG","Minas Gerais"],["RJ","Rio de Janeiro"],["SP","São Paulo"]],
  sul: [["PR","Paraná"],["RS","Rio Grande do Sul"],["SC","Santa Catarina"]],
};
export const ESTADOS_BRASIL = Object.entries(GRUPOS).flatMap(([regiao, estados]) => estados.map(([uf,nome]) => ({ uf,nome,regiao }))).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
export const estadoBrasileiro = (uf: unknown) => ESTADOS_BRASIL.find(e => e.uf === uf);
export interface FaixaPublica { id: string; rotulo: string }
export const FAIXAS_AREA: FaixaPublica[] = [
  {id:"0_100",rotulo:"Até 100 ha"},{id:"100_500",rotulo:"100 a 500 ha"},{id:"500_1000",rotulo:"500 a 1.000 ha"},
  {id:"1000_2500",rotulo:"1.000 a 2.500 ha"},{id:"2500_5000",rotulo:"2.500 a 5.000 ha"},
  {id:"5000_10000",rotulo:"5.000 a 10.000 ha"},{id:"10000_mais",rotulo:"Acima de 10.000 ha"},
];
export const classeArea = (n: number): string => FAIXAS_AREA[[100,500,1000,2500,5000,10000].filter(l => n >= l).length].id;
export const faixaValida = (id: string, tipo: "area"|"altitude"|"argila"): boolean => {
  if (tipo==="area") return FAIXAS_AREA.some(f=>f.id===id);
  const m=/^(\d+)_(\d+)$/.exec(id);
  if(!m) return false;
  const [lo,hi]=[Number(m[1]),Number(m[2])], passo=tipo==="altitude"?100:5;
  return lo%passo===0 && hi===lo+passo && lo>=0 && hi<=(tipo==="altitude"?10000:105);
};
export interface OpcoesFiltrosPublicos {
  regioes: string[]; culturas: string[];
  estados: typeof ESTADOS_BRASIL; regioes_brasil: Array<{id:string;nome:string}>;
  faixas: { area: FaixaPublica[]; altitude: FaixaPublica[]; argila: FaixaPublica[] };
}
