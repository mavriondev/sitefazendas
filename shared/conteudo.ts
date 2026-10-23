export type TipoCampoConteudo = "texto" | "paragrafo" | "imagem" | "link";
export interface CampoConteudo { chave: string; rotulo: string; tipo: TipoCampoConteudo; padrao: string; limite: number }
export interface SecaoConteudo { id: string; titulo: string; campos: CampoConteudo[] }
export interface PaginaRegistro { id: string; titulo: string; rota: string; nota?: string; organizar?: boolean; secoes: SecaoConteudo[] }
export interface PaginaConteudo { valores: Record<string, string>; ordem: string[]; ocultas: string[] }
export interface ConteudoSite { revisao: number; paginas: Record<string, PaginaConteudo> }
const t = (chave: string, rotulo: string, padrao: string): CampoConteudo => ({ chave, rotulo, padrao, tipo: "texto", limite: 250 });
const p = (chave: string, rotulo: string, padrao: string): CampoConteudo => ({ chave, rotulo, padrao, tipo: "paragrafo", limite: 8000 });
const l = (chave: string, rotulo: string, padrao: string): CampoConteudo => ({ chave, rotulo, padrao, tipo: "link", limite: 1000 });
const i = (chave: string, rotulo: string, arquivo: string): CampoConteudo => ({ chave, rotulo, padrao: `/images/gramogol/${arquivo}`, tipo: "imagem", limite: 200 });
const s = (id: string, titulo: string, campos: CampoConteudo[]): SecaoConteudo => ({ id, titulo, campos });
const topo = (rotulo: string, titulo: string, texto = "") => s("topo", "Cabeçalho da página", [
  t("rotulo", "Chamada curta", rotulo), t("titulo", "Título", titulo), p("texto", "Apresentação", texto), i("imagem", "Imagem de fundo", "grao-mogol-serra.jpg"),
]);
const passos = (dados: string[][]) => dados.flatMap(([titulo, texto], n) => [t(`titulo${n + 1}`, `Etapa ${n + 1} — título`, titulo), p(`texto${n + 1}`, `Etapa ${n + 1} — texto`, texto)]);

/** Conteúdo editorial apenas: nunca HTML, scripts, permissões ou mensagens de segurança. */
export const PAGINAS_CONTEUDO: PaginaRegistro[] = [
  { id: "global", titulo: "Marca, menu e rodapé", rota: "/", nota: "Nome, contatos, CRECI e aviso de intermediação continuam em Configurações. A ordem abaixo organiza os links do menu e os blocos do rodapé separadamente.", secoes: [
    s("marca", "Identidade e botões gerais", [i("logo", "Logo do cabeçalho", "logo-gramogol-claro.png"), i("logo_rodape", "Logo do rodapé", "logo-gramogol-claro.png"), i("fundo_rodape", "Fundo do rodapé", "grao-mogol-serra.jpg"), t("botao", "Botão do cabeçalho", "Ver fazendas"), l("destino", "Destino do botão", "/fazendas"), t("whatsapp", "Botão de WhatsApp", "Falar no WhatsApp"), p("mensagem_whatsapp", "Mensagem inicial do WhatsApp", "Olá! Vim pelo site e gostaria de conversar sobre fazendas."), t("credito_imagens", "Legenda das imagens", "")]),
    ...[["inicio", "Início", "/"], ["sobre", "Sobre", "/sobre"], ["parceiros", "Parceiros", "/parceiros"], ["venda", "Venda sua fazenda", "/venda-sua-fazenda"], ["contato", "Contato", "/contato"]].map(([id, nome, url]) => s(`menu_${id}`, `Menu — ${nome}`, [t("texto", "Texto do link", nome), l("link", "Destino", url)])),
    s("rodape_marca", "Rodapé — identificação", []),
    s("rodape_links", "Rodapé — navegação", [t("titulo", "Título da coluna", "Explore"), t("catalogo", "Texto do catálogo", "Fazendas disponíveis"), t("privacidade", "Texto da política", "Política de privacidade")]),
    s("rodape_contatos", "Rodapé — contatos", [t("titulo", "Título da coluna", "Conversa direta")]),
    s("rodape_creditos", "Rodapé — direitos e créditos", [t("texto", "Complemento dos direitos autorais", "Intermediação de imóveis rurais")]),
  ] },
  { id: "home", titulo: "Página inicial", rota: "/", nota: "Títulos, subtítulos e imagens de cada slide são gerenciados em Slides da home. O texto Sobre e os títulos alternativos sem slides ficam em Configurações.", secoes: [
    s("hero", "Apresentação / slider", [t("rotulo", "Chamada acima do título", "Fazendas à venda"), i("imagem", "Imagem quando não há slide", "cerrado-soja-aerea.jpg"), t("botao", "Botão principal sem destino do slide", "Explorar fazendas"), l("link", "Destino principal", "/fazendas"), t("botao_slide", "Botão de um slide com link", "Conhecer propriedade"), t("botao_externo", "Botão de link externo", "Saiba mais"), t("botao_sobre", "Botão secundário", "Conheça a Gramogol"), l("link_sobre", "Destino secundário", "/sobre"), t("selo1", "Selo 1", "Terra produtiva e bem cuidada"), t("selo2", "Selo 2", "Negociação com discrição"), t("selo3", "Selo 3", "Atendimento próximo e direto"), t("legenda", "Legenda sem foto de slide", "")]),
    s("busca", "Busca de fazendas", [
      t("estado", "Estado", "Estado"), t("macrorregiao", "Macrorregião", "Macrorregião"),
      t("area", "Faixa de área", "Área"), t("qualquer", "Sem faixa", "Qualquer"),
      t("regiao", "Campo região", "Região"), t("cultura", "Campo cultura", "Cultura"), t("todas", "Opção sem filtro", "Todas"),
      t("area_min", "Campo área mínima", "Área mínima (ha)"), t("area_max", "Campo área máxima", "Área máxima (ha)"),
      t("sem_minimo", "Área mínima não informada", "Sem mínimo"), t("sem_maximo", "Área máxima não informada", "Sem máximo"), t("botao", "Botão de busca", "Buscar fazendas"),
    ]),
    s("destaques", "Fazendas em destaque", [t("rotulo", "Chamada", "Portfólio rural"), t("titulo", "Título", "Fazendas em destaque"), t("botao", "Texto do link", "Ver catálogo"), l("link", "Destino", "/fazendas"), t("vazio_titulo", "Título quando não há destaques", "Nenhuma fazenda em destaque no momento"), p("vazio_texto", "Texto quando não há destaques", "Consulte o catálogo para ver as propriedades disponíveis.")]),
    s("sobre", "Apresentação da empresa", [t("rotulo", "Chamada", "Intermediação próxima"), i("imagem", "Imagem principal", "sede-fazenda.jpg"), i("imagem_menor", "Imagem menor", "represa.jpg"), t("beneficio1", "Benefício 1", "Sigilo respeitado"), t("beneficio2", "Benefício 2", "Dados com origem"), t("beneficio3", "Benefício 3", "Vocação da terra"), t("beneficio4", "Benefício 4", "Região aproximada"), t("botao", "Botão", "Como trabalhamos"), l("link", "Destino", "/sobre")]),
    s("etapas", "Etapas de atendimento", [t("rotulo", "Chamada", "Atendimento direto"), t("titulo", "Título", "Compra séria começa com conversa direta."), ...passos([
      ["Navegue com discrição", "Consulte as propriedades e as informações liberadas para o público, sem expor sua identidade."],
      ["Peça os detalhes", "Uma propriedade chamou sua atenção? Converse com o corretor sobre os dados complementares."],
      ["Conheça com segurança", "O corretor acompanha a conversa, a visita e os próximos passos da negociação."],
    ])]),
    s("cotacoes", "Cotações do agro", [t("rotulo", "Chamada", "Mercado agropecuário"), t("titulo", "Título", "Cotações para acompanhar o mercado."), p("texto", "Apresentação", "Dólar de referência e preços agrícolas, com identificação da fonte, da praça e da data.")]),
    s("noticias", "Notícias do agro", [t("rotulo", "Chamada", "Informação para o campo"), t("titulo", "Título", "O agro em pauta."), p("texto", "Apresentação", "Acompanhe notícias de fontes identificadas e leia os conteúdos disponíveis aqui na Gramogol.")]),
    s("venda", "Convite aos proprietários", [t("rotulo", "Chamada", "Venda sua fazenda"), t("titulo", "Título", "A propriedade certa merece a conversa certa."), p("texto", "Texto", "Quer apresentar uma fazenda ao mercado? Fale com a equipe para entender a intermediação e quais informações podem ser divulgadas."), t("botao", "Botão", "Conversar sobre venda"), l("link", "Destino", "/venda-sua-fazenda"), i("imagem", "Imagem principal", "silos-armazem.jpg"), i("imagem_menor", "Imagem menor", "lavoura-milho.jpg")]),
    s("parceiros", "Rede de parceiros", [t("rotulo", "Chamada", "Rede de parceiros"), t("titulo", "Título", "Conhecimento que soma à negociação."), t("botao", "Botão", "Ver parceiros"), l("link", "Destino", "/parceiros")]),
    s("convite", "Convite final", [t("rotulo", "Chamada", "Gramogol Fazendas"), t("titulo", "Título", "Terra, propósito e uma negociação bem conduzida."), p("texto", "Texto", "Atendimento pessoal para comprar ou vender sua propriedade rural, com discrição do primeiro contato ao fechamento."), t("botao", "Botão WhatsApp", "Falar com o corretor"), t("botao_alternativo", "Botão sem WhatsApp", "Falar com a equipe"), l("link_alternativo", "Destino sem WhatsApp", "/contato"), i("imagem", "Imagem de fundo", "grao-mogol-serra.jpg")]),
  ] },
  { id: "sobre", titulo: "Sobre", rota: "/sobre", nota: "O título e o texto principal da empresa são editados em Configurações.", secoes: [
    { ...topo("Quem somos", "Sobre nós"), campos: topo("Quem somos", "Sobre nós").campos.filter(c => c.chave !== "titulo") },
    s("apresentacao", "Texto da empresa", []),
    s("principios", "Princípios", passos([
      ["Dados claros", "Cada informação mostra se foi confirmada com vendedor, documento ou visita, ou se vem de bases públicas e modelos."],
      ["Sigilo do proprietário", "Localização exata, CAR e limites do imóvel só são informados em atendimento direto."],
      ["Atendimento direto", "Visitas, documentos e negociação são conduzidos por um corretor, do primeiro contato ao fechamento."],
    ])),
    s("acoes", "Botões", [t("catalogo", "Botão de compra", "Ver fazendas"), l("link_catalogo", "Destino de compra", "/fazendas"), t("venda", "Botão de venda", "Quero vender minha fazenda"), l("link_venda", "Destino de venda", "/venda-sua-fazenda"), t("whatsapp", "Botão WhatsApp", "Falar no WhatsApp")]),
  ] },
  { id: "parceiros", titulo: "Parceiros", rota: "/parceiros", nota: "Cadastre nomes, logos, links e ordem dos parceiros em Parceiros.", secoes: [
    topo("Quem trabalha conosco", "Parceiros", "Empresas e instituições que fazem parte da nossa rede."),
    s("lista", "Lista de parceiros", [t("vazio_titulo", "Título sem parceiros", "Em breve"), p("vazio_texto", "Texto sem parceiros", "Nossos parceiros serão apresentados aqui.")]),
  ] },
  { id: "contato", titulo: "Contato", rota: "/contato", nota: "Telefones, endereço, e-mail e horários são editados em Configurações.", secoes: [
    topo("Fale conosco", "Contato", "Tire dúvidas, peça informações sobre uma fazenda ou fale com o corretor."),
    s("formulario", "Formulário de contato", []),
    s("atendimento", "Canais de atendimento", [t("titulo", "Título", "Atendimento"), t("whatsapp", "Botão WhatsApp", "Chamar no WhatsApp"), t("email", "Rótulo e-mail", "E-mail"), t("endereco", "Rótulo endereço", "Endereço"), t("horario", "Rótulo horário", "Horário")]),
  ] },
  { id: "venda", titulo: "Venda sua fazenda", rota: "/venda-sua-fazenda", secoes: [
    topo("Para proprietários", "Venda sua fazenda", "Cadastre sua propriedade com ou sem o código do CAR. Nós completamos os dados com você e cuidamos da divulgação com sigilo."),
    s("formulario", "Formulário do proprietário", []),
    s("etapas", "Como funciona", [t("titulo", "Título", "Como funciona"), ...[ "Você envia os dados básicos da fazenda.", "Conferimos as informações com você e enriquecemos com dados de bases públicas.", "Divulgamos sem expor a localização exata nem o CAR.", "Apresentamos a compradores interessados, com registro de cada apresentação." ].map((texto, n) => p(`texto${n + 1}`, `Etapa ${n + 1}`, texto))]),
  ] },
  { id: "catalogo", titulo: "Catálogo de fazendas", rota: "/fazendas", secoes: [
    topo("Catálogo", "Fazendas à venda", "Filtre por região, cultura, tamanho, altitude, argila e infraestrutura."),
    s("catalogo", "Filtros e resultados", [
      t("estado", "Estado", "Estado"), t("macrorregiao", "Macrorregião", "Macrorregião"),
      t("ou_regiao", "Orientação de localização", "ou escolha uma macrorregião (substitui o estado)"),
      t("mais_filtros", "Abrir busca avançada", "Mais filtros"),
      ...Object.entries({ regiao:"Região",cultura:"Cultura",area_min:"Área mín.",area_max:"Área máx.",altitude_min:"Altitude mín.",altitude_max:"Altitude máx.",argila_min:"Argila mín.",argila_max:"Argila máx.",com_agua:"Com água",com_energia:"Com energia" }).map(([chave,padrao])=>t(chave,`Filtro — ${padrao}`,padrao)),
      t("filtros", "Título dos filtros", "Filtros"), t("todas", "Opção sem filtro", "Todas"), t("infraestrutura", "Grupo infraestrutura", "Infraestrutura"),
      t("aplicar", "Botão aplicar", "Aplicar filtros"), t("limpar", "Botão limpar", "Limpar filtros"), t("ordem", "Campo ordenação", "Ordenar por"),
      t("recentes", "Ordenação por data", "Mais recentes"), t("maior", "Ordenação maior área", "Maior área"), t("menor", "Ordenação menor área", "Menor área"),
      t("vazio_titulo", "Título sem resultados", "Nenhuma fazenda com esses filtros"), p("vazio_texto", "Texto sem resultados", "Tente ampliar os critérios ou limpar os filtros."),
      t("grupo_area", "Grupo área", "Área (ha)"), t("grupo_altitude", "Grupo altitude", "Altitude (m)"), t("grupo_argila", "Grupo argila", "Argila no solo (%)"),
      t("minima", "Campo mínimo", "Mínima"), t("maxima", "Campo máximo", "Máxima"), t("destaques", "Ordenação inicial", "Destaques primeiro"),
      p("orientacao", "Orientação dos filtros", "Altitude e argila são filtradas pelas faixas mostradas nos anúncios. Só entram os dados que o corretor liberou para o público."),
    ]),
  ] },
  { id: "fazenda", titulo: "Página de uma fazenda", rota: "/fazendas", nota: "O conteúdo específico de cada imóvel, fotos e vídeos continua no cadastro de Fazendas. A ordem abaixo organiza os grandes blocos desta página.", secoes: [
    s("topo", "Banner do imóvel", [i("imagem", "Imagem de fundo", "grao-mogol-serra.jpg"), t("inicio", "Link inicial", "Início"), t("catalogo", "Link do catálogo", "Fazendas")]),
    s("imovel", "Dados, fotos e atendimento do imóvel", [t("destaque", "Selo de destaque", "Seleção do corretor"), t("rotulo", "Selo comum", "Propriedade rural"), t("compartilhar", "Botão compartilhar", "Compartilhar"), t("voltar", "Botão de retorno", "Todas as fazendas"), t("sobre", "Título da descrição", "Sobre a propriedade"), t("valor", "Rótulo do preço", "Valor anunciado"), t("consulta", "Preço não divulgado", "Sob consulta"), t("botao", "Botão de atendimento", "Falar com o corretor"), t("sem_whatsapp", "Botão alternativo", "Canais de atendimento"), t("compartilhar_titulo", "Título de compartilhamento", "Compartilhar propriedade"), t("copiar", "Botão copiar", "Copiar link")]),
    s("similares", "Fazendas semelhantes", [t("rotulo", "Chamada", "Mais propriedades"), t("titulo", "Título de semelhantes", "Fazendas semelhantes"), t("titulo_alternativo", "Título de outras fazendas", "Outras fazendas disponíveis"), t("botao", "Link do catálogo", "Ver catálogo"), l("link", "Destino", "/fazendas")]),
  ] },
  { id: "noticias", titulo: "Notícias do agro", rota: "/noticias", organizar: false, secoes: [
    s("topo", "Apresentação", [t("rotulo", "Chamada", "Campo e mercado"), t("titulo", "Título", "Notícias do agro"), p("texto", "Apresentação", "Matérias de fontes identificadas, com crédito e link para o original. Cada item indica se o texto é integral ou resumo.")]),
  ] },
  { id: "formularios", titulo: "Textos dos formulários", rota: "/contato", organizar: false, nota: "Os campos obrigatórios, limites e validações de segurança não podem ser removidos ou reordenados pelo editor.", secoes: [
    s("rotulos", "Rótulos e botões", [t("nome", "Campo nome", "Nome"), t("whatsapp", "Campo WhatsApp", "WhatsApp (com DDD)"), t("email", "Campo e-mail", "E-mail (opcional)"), t("mensagem", "Campo mensagem", "Mensagem"), t("fazenda", "Título dos dados da fazenda", "Sobre a fazenda"), t("regiao", "Campo região", "Município / região"), t("area", "Campo área", "Área aproximada"), t("area_exemplo", "Exemplo de área", "ex.: 1.200 ha"), t("culturas", "Campo culturas", "Culturas / atividade"), t("car", "Campo CAR", "Código do CAR (se tiver)"), t("enviar_contato", "Botão contato", "Enviar mensagem"), t("enviar_venda", "Botão de venda", "Enviar minha fazenda")]),
    s("orientacoes", "Orientações", [p("car_opcional", "Orientação sobre CAR", "Pode enviar sem o CAR: cadastramos a fazenda do mesmo jeito e completamos os dados com você."), p("privacidade", "Orientação sobre dados pessoais", "Seus dados serão usados para responder à sua solicitação. Não envie senhas ou documentos pessoais."), t("link_privacidade", "Link da política", "Consulte a política de privacidade.")]),
    s("confirmacoes", "Confirmações de envio", [p("contato", "Confirmação de contato", "Mensagem enviada. Retornaremos em breve pelo WhatsApp."), p("venda", "Confirmação de venda", "Recebemos os dados da sua fazenda. Entraremos em contato pelo WhatsApp.")]),
  ] },
  { id: "privacidade", titulo: "Política de privacidade", rota: "/privacidade", nota: "Revise os textos com assessoria jurídica antes da publicação. Ocultar conteúdo não substitui as obrigações da LGPD.", secoes: [
    s("topo", "Título e aviso", [t("titulo", "Título", "Política de privacidade"), p("aviso", "Aviso editorial (deixe vazio para remover)", "Texto provisório: deve ser revisado por um advogado antes da publicação.")]),
    s("dados", "Dados coletados", [t("titulo", "Título", "Dados que coletamos"), p("texto", "Texto", "Nome, e-mail, WhatsApp e as mensagens que você enviar, quando você cria conta ou pede contato. Também registramos o histórico de pesquisas feitas na conta, para controle de uso.")]),
    s("finalidade", "Finalidade", [t("titulo", "Título", "Para que usamos"), p("texto", "Texto", "Para responder ao seu contato, liberar o acesso à pesquisa de terras e apresentar imóveis compatíveis com o seu interesse. Não vendemos seus dados.")]),
    s("direitos", "Direitos LGPD", [t("titulo", "Título", "Seus direitos (LGPD)"), p("texto", "Texto", "Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, pelo contato informado no site.")]),
    s("imoveis", "Dados dos imóveis", [t("titulo", "Título", "Imóveis"), p("texto", "Texto", "Não exibimos localização exata, código do CAR ou limites dos imóveis. Esses dados são fornecidos somente em atendimento, quando cabível.")]),
  ] },
];

// Os rótulos editoriais do imóvel são globais; os valores vêm do cadastro.
PAGINAS_CONTEUDO.find(p => p.id === "fazenda")!.secoes.find(s => s.id === "imovel")!.campos.push(
  t("area", "Rótulo área", "Área"), t("regiao", "Rótulo região", "Região"), t("vocacao", "Rótulo vocação", "Vocação"), t("agua", "Rótulo água", "Água"),
  t("caracteristicas", "Título dos atributos", "Características da terra"), t("videos", "Título dos vídeos", "Galeria de vídeos"),
  p("aviso_videos", "Aviso do YouTube", "Ao reproduzir, você carrega conteúdo externo do YouTube. Nenhum player é carregado antes do seu clique."),
);

export function conteudoPadrao(): ConteudoSite {
  return { revisao: 0, paginas: Object.fromEntries(PAGINAS_CONTEUDO.map(pagina => [pagina.id, {
    valores: Object.fromEntries(pagina.secoes.flatMap(secao => secao.campos.map(campo => [`${secao.id}.${campo.chave}`, campo.padrao]))),
    ordem: pagina.secoes.map(secao => secao.id), ocultas: [],
  }])) };
}

/** Defaults novos entram automaticamente sem apagar edições já publicadas. */
export function completarConteudo(entrada?: Partial<ConteudoSite> | null): ConteudoSite {
  const padrao = conteudoPadrao();
  padrao.revisao = entrada?.revisao ?? 0;
  for (const pagina of PAGINAS_CONTEUDO) {
    const salvo = entrada?.paginas?.[pagina.id];
    if (!salvo) continue;
    const base = padrao.paginas[pagina.id];
    for (const chave of Object.keys(base.valores)) if (typeof salvo.valores?.[chave] === "string") base.valores[chave] = salvo.valores[chave];
    const ids = new Set(base.ordem);
    const ordem = [...new Set((salvo.ordem ?? []).filter(id => ids.has(id)))];
    for (const novo of base.ordem.filter(id => !ordem.includes(id))) {
      const anterior = base.ordem.slice(0, base.ordem.indexOf(novo)).reverse().find(id => ordem.includes(id));
      ordem.splice(anterior ? ordem.indexOf(anterior) + 1 : 0, 0, novo);
    }
    base.ordem = ordem;
    base.ocultas = [...new Set((salvo.ocultas ?? []).filter(id => ids.has(id)))];
  }
  return padrao;
}
