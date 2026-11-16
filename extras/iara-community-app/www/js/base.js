/* Dados fixos do app IARA: estações de rio, cidades, telefones, canais e cursos.
   Os números do rio e do fogo não ficam aqui: o app busca na ANA e no INPE toda vez que abre. */

window.IARA = window.IARA || {};

/* Estações da ANA. A altura do rio chega ao vivo da telemetria da ANA quando o app abre
   (telemetriaws1.ana.gov.br, medição a cada 15 minutos). Aqui ficam só as marcas fixas de cada estação:
   seca = cota que o rio passa em 95% do tempo (abaixo dela a ANA marca estiagem).
   cheia = cota de inundação do SGB, quando existe. */
IARA.ESTACOES = [
  { id: "manaus", cod: "14990000", nome: "Manaus", rio: "Rio Negro", lat: -3.14, lon: -60.03, seca: 1738, cheia: 2750, severa: 2900 },
  { id: "manacapuru", cod: "14100000", nome: "Manacapuru", rio: "Rio Solimões", lat: -3.31, lon: -60.62, seca: 789, cheia: 1820, severa: 1960 },
  { id: "itacoatiara", cod: "16030000", nome: "Itacoatiara", rio: "Rio Amazonas", lat: -3.14, lon: -58.44, seca: 377, cheia: 1400, severa: 1420 },
  { id: "obidos", cod: "17050001", nome: "Óbidos", rio: "Rio Amazonas", lat: -1.91, lon: -55.52, seca: 111, cheia: null, severa: null },
  { id: "santarem", cod: "17900000", nome: "Santarém", rio: "Rio Tapajós", lat: -2.42, lon: -54.71, seca: 111, cheia: null, severa: null },
  { id: "itaituba", cod: "17730000", nome: "Itaituba", rio: "Rio Tapajós", lat: -4.28, lon: -55.98, seca: 215, cheia: null, severa: null },
  { id: "altamira", cod: "18850000", nome: "Altamira", rio: "Rio Xingu", lat: -3.20, lon: -52.21, seca: 246, cheia: 950, severa: null },
  { id: "tabatinga", cod: "10100000", nome: "Tabatinga", rio: "Rio Solimões", lat: -4.25, lon: -69.94, seca: 141, cheia: null, severa: null },
  { id: "portovelho", cod: "15400000", nome: "Porto Velho", rio: "Rio Madeira", lat: -8.76, lon: -63.90, seca: 228, cheia: 1700, severa: null },
  { id: "riobranco", cod: "13600002", nome: "Rio Branco", rio: "Rio Acre", lat: -9.97, lon: -67.81, seca: 146, cheia: 1400, severa: null },
  { id: "cruzeiro", cod: "12500000", nome: "Cruzeiro do Sul", rio: "Rio Juruá", lat: -7.63, lon: -72.67, seca: 315, cheia: null, severa: null },
  { id: "boavista", cod: "14620000", nome: "Boa Vista", rio: "Rio Branco", lat: 2.82, lon: -60.67, seca: -3, cheia: 800, severa: 850 }
];

/* Cidades ribeirinhas para escolher sem GPS (centro da cidade, precisão de alguns km). */
IARA.CIDADES = [
  ["Manaus", "AM", -3.12, -60.02], ["Manacapuru", "AM", -3.30, -60.62], ["Iranduba", "AM", -3.28, -60.19],
  ["Careiro da Várzea", "AM", -3.20, -59.83], ["Autazes", "AM", -3.58, -59.13], ["Itacoatiara", "AM", -3.14, -58.44],
  ["Parintins", "AM", -2.63, -56.74], ["Maués", "AM", -3.38, -57.72], ["Nova Olinda do Norte", "AM", -3.89, -59.09],
  ["Borba", "AM", -4.39, -59.59], ["Novo Airão", "AM", -2.62, -60.94], ["Barcelos", "AM", -0.97, -62.92],
  ["Santa Isabel do Rio Negro", "AM", -0.41, -65.02], ["São Gabriel da Cachoeira", "AM", -0.13, -67.09],
  ["Codajás", "AM", -3.84, -62.06], ["Anori", "AM", -3.75, -61.64], ["Beruri", "AM", -3.90, -61.37],
  ["Coari", "AM", -4.09, -63.14], ["Tefé", "AM", -3.35, -64.71], ["Fonte Boa", "AM", -2.51, -66.09],
  ["Jutaí", "AM", -2.75, -66.77], ["Carauari", "AM", -4.88, -66.90], ["Eirunepé", "AM", -6.66, -69.87],
  ["São Paulo de Olivença", "AM", -3.38, -68.87], ["Benjamin Constant", "AM", -4.38, -70.03], ["Tabatinga", "AM", -4.25, -69.94],
  ["Manicoré", "AM", -5.81, -61.30], ["Humaitá", "AM", -7.51, -63.02], ["Lábrea", "AM", -7.26, -64.80],
  ["Boca do Acre", "AM", -8.75, -67.40], ["Santarém", "PA", -2.44, -54.71], ["Óbidos", "PA", -1.90, -55.52],
  ["Oriximiná", "PA", -1.77, -55.87], ["Alenquer", "PA", -1.94, -54.74], ["Monte Alegre", "PA", -2.00, -54.07],
  ["Juruti", "PA", -2.15, -56.09], ["Itaituba", "PA", -4.28, -55.98], ["Altamira", "PA", -3.20, -52.21],
  ["Breves", "PA", -1.68, -50.48], ["Cametá", "PA", -2.24, -49.50], ["Abaetetuba", "PA", -1.72, -48.88],
  ["Belém", "PA", -1.46, -48.50], ["Macapá", "AP", 0.03, -51.07], ["Porto Velho", "RO", -8.76, -63.90],
  ["Guajará-Mirim", "RO", -10.78, -65.34], ["Rio Branco", "AC", -9.97, -67.81], ["Sena Madureira", "AC", -9.07, -68.66],
  ["Tarauacá", "AC", -8.16, -70.77], ["Cruzeiro do Sul", "AC", -7.63, -72.67], ["Boa Vista", "RR", 2.82, -60.67]
];

/* Telefones de emergência (ligação gratuita). */
IARA.TELEFONES = [
  { num: "193", nome: "Bombeiros", quando: "Fogo perto de casa, da roça ou da mata. Pessoa presa ou afogada." },
  { num: "199", nome: "Defesa Civil", quando: "Casa alagada, desbarrancamento, comunidade isolada pela seca." },
  { num: "192", nome: "SAMU", quando: "Problema de saúde grave, falta de ar com fumaça." },
  { num: "190", nome: "Polícia Militar", quando: "Ameaça, invasão ou violência acontecendo agora." },
  { num: "100", nome: "Disque Direitos Humanos", quando: "Violação de direitos de indígenas, ribeirinhos, crianças e idosos. Pode ser anônimo." },
  { num: "180", nome: "Central de Atendimento à Mulher", quando: "Violência contra a mulher." },
  { num: "08000618080", rot: "0800 061 8080", nome: "Central de Atendimento do Ibama", quando: "Desmatamento, queimada ilegal, pesca e caça ilegal. Segunda a sexta, 7h às 19h." }
];

/* Assistente de denúncia: o que está acontecendo leva aos canais certos. */
IARA.SITUACOES = [
  { id: "fogo", titulo: "Fogo agora", icone: "fire", resumo: "Incêndio perto de casa, roça ou mata",
    passos: ["Saia de perto do fogo e da fumaça, contra o vento.", "Ligue para os Bombeiros (193).", "Se a comunidade precisar sair ou ficar sem água, ligue também para a Defesa Civil (199)."],
    canais: ["tel:193", "tel:199"] },
  { id: "desmate", titulo: "Desmatamento ou queimada ilegal", icone: "tree", resumo: "Derrubada, fogo para abrir pasto, madeira saindo",
    passos: ["Anote o lugar, o dia e a hora, e tire foto de longe se for seguro.", "Faça a denúncia no Ibama, pela internet ou pelo telefone.", "A denúncia pode ser anônima."],
    canais: ["ibama-online", "tel:08000618080"] },
  { id: "garimpo", titulo: "Garimpo ou balsa no rio", icone: "shovel", resumo: "Draga, balsa, água barrenta de repente",
    passos: ["Não se aproxime das balsas.", "Denuncie no Ibama e no Ministério Público Federal.", "Em terra indígena, avise também a Funai."],
    canais: ["ibama-online", "mpf", "funai"] },
  { id: "pesca", titulo: "Pesca ou caça ilegal", icone: "fish", resumo: "Arrastão, pesca no defeso, caça de bicho protegido",
    passos: ["Anote o barco, o lugar e a hora.", "Denuncie no Ibama.", "Dentro de RESEX ou RDS federal, o ICMBio também recebe pelo Fala.BR."],
    canais: ["ibama-online", "tel:08000618080", "falabr"] },
  { id: "invasao", titulo: "Invasão de terra indígena ou de reserva", icone: "warning", resumo: "Gente de fora ocupando, abrindo ramal ou ameaçando",
    passos: ["Se houver ameaça agora, ligue 190.", "Avise a Funai e o Ministério Público Federal.", "Guarde nomes, fotos e datas em lugar seguro."],
    canais: ["tel:190", "funai", "funai-emergencia", "mpf"] },
  { id: "direitos", titulo: "Violência ou ameaça a pessoas", icone: "hand", resumo: "Ameaça a liderança, trabalho escravo, violência",
    passos: ["Em perigo agora, ligue 190.", "Denuncie no Disque 100. Funciona todos os dias e pode ser anônimo.", "Violência contra mulher: Ligue 180."],
    canais: ["tel:190", "tel:100", "tel:180"] },
  { id: "oleo", titulo: "Óleo ou produto químico na água", icone: "drop", resumo: "Mancha na água, vazamento, peixe morto",
    passos: ["Não use essa água para beber nem cozinhar.", "Comunique o acidente ao Ibama por e-mail, com fotos e o lugar.", "Avise a Defesa Civil (199) se a comunidade ficar sem água."],
    canais: ["ibama-acidente", "tel:199"] },
  { id: "servico", titulo: "Problema com órgão público", icone: "buildings", resumo: "Atendimento negado, benefício travado, obra parada",
    passos: ["Registre uma reclamação ou denúncia no Fala.BR.", "Guarde o número do protocolo para acompanhar."],
    canais: ["falabr"] }
];

/* Canais online. ok = página aberta e conferida em 14/11/2026. */
IARA.CANAIS = {
  "ibama-online": { nome: "Denúncia ambiental ao Ibama", url: "https://www.gov.br/pt-br/servicos/apresentar-denuncia-ambiental", desc: "Pela internet, pelo telefone 0800 061 8080 ou numa unidade do Ibama." },
  "ibama-acidente": { nome: "Comunicar acidente ambiental (Ibama)", url: "https://www.gov.br/pt-br/servicos/comunicar-acidente-ambiental", desc: "Vazamento de óleo, produto químico, rompimento de barragem.", email: "emergenciasambientais.sede@ibama.gov.br" },
  "falabr": { nome: "Fala.BR", url: "https://falabr.cgu.gov.br/", desc: "Denúncia, reclamação ou pedido a qualquer órgão federal. Gera protocolo." },
  "mpf": { nome: "Ministério Público Federal", url: "https://www.mpf.mp.br/servicos/denuncias", desc: "Crimes em terra indígena, garimpo, danos a comunidades tradicionais." },
  "funai": { nome: "Ouvidoria da Funai", url: "https://www.gov.br/funai/pt-br/canais-de-atendimento/ouvidoria", desc: "Denúncias e pedidos sobre povos e terras indígenas." },
  "funai-emergencia": { nome: "Apoio da Funai em emergência", url: "https://www.gov.br/pt-br/servicos/solicitar-apoio-aos-povos-indigenas-em-situacoes-emergenciais", desc: "Pedido de apoio a povos indígenas em cheia, seca, fogo ou conflito." },
  "disque100": { nome: "Disque 100", url: "https://www.gov.br/mdh/pt-br/acesso-a-informacao/disque-100", desc: "Direitos humanos. Ligação gratuita, todos os dias." }
};

/* Informação oficial para acompanhar rio e fogo. */
IARA.FONTES = [
  { nome: "Boletim diário do Rio Amazonas (ANA)", url: "https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas", desc: "Cota de Manaus, Itacoatiara, Óbidos e outras estações, todo dia útil." },
  { nome: "Alerta de cheia do Serviço Geológico do Brasil", url: "https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php", desc: "Boletim semanal e previsão do pico da cheia." },
  { nome: "HidroWeb (ANA)", url: "http://www.snirh.gov.br/hidroweb/apresentacao", desc: "Série histórica de cada estação." },
  { nome: "Programa Queimadas (INPE)", url: "https://terrabrasilis.dpi.inpe.br/queimadas/", desc: "Focos de calor do dia e mapas de risco de fogo." }
];

/* Cursos, direitos e benefícios. */
IARA.APRENDER = [
  { id: "cursos", grupo: "Cursos gratuitos", itens: [
    { nome: "Escola Virtual de Governo", url: "https://www.escolavirtual.gov.br/catalogo", desc: "Cursos a distância com certificado. Procure por povos indígenas, meio ambiente e defesa civil." },
    { nome: "Cursos de proteção e defesa civil", url: "https://www.gov.br/pt-br/servicos/participar-de-cursos-em-protecao-e-defesa-civil", desc: "Como preparar a comunidade para cheia, seca e incêndio." },
    { nome: "Direitos fundamentais e a pauta indígena (Enap)", url: "https://repositorio.enap.gov.br/handle/1/6820", desc: "Material do curso da Enap sobre direitos dos povos indígenas." },
    { nome: "Embrapa e-Campo", url: "https://www.embrapa.br/e-campo", desc: "Roça, mandioca, açaí, horta e criação de peixe." },
    { nome: "Senar a distância", url: "https://ead.senar.org.br/", desc: "Piscicultura, manejo e produção rural." }
  ]},
  { id: "funai", grupo: "Funai e povos indígenas", itens: [
    { nome: "Apoio da Funai em situação de emergência", url: "https://www.gov.br/pt-br/servicos/solicitar-apoio-aos-povos-indigenas-em-situacoes-emergenciais", desc: "Como pedir ajuda em cheia, seca, fogo ou conflito." },
    { nome: "Educação comunitária e línguas indígenas", url: "https://www.gov.br/pt-br/servicos/solicitar-apoio-processos-educativos-comunitarios-revitalizacao-linguas-indigenas", desc: "Apoio da Funai a projetos de ensino e de revitalização de línguas." },
    { nome: "Acompanhamento da educação escolar indígena", url: "https://www.gov.br/pt-br/servicos/solicitar-o-acompanhamento-das-politicas-de-educacao-escolar-indigena", desc: "Pedido de acompanhamento da escola indígena pela Funai." }
  ]},
  { id: "beneficios", grupo: "Benefícios", itens: [
    { nome: "Seguro-defeso do pescador artesanal", url: "https://www.gov.br/pt-br/servicos/solicitar-seguro-defeso-pescador-artesanal", desc: "Um salário mínimo por mês durante o defeso, para quem vive da pesca." },
    { nome: "Bolsa Verde", url: "https://www.caixa.gov.br/programas-sociais/bolsa-verde/Paginas/default.aspx", desc: "Pagamento a famílias de RESEX, RDS e assentamentos que conservam a floresta." }
  ]}
];

/* Guias. */
IARA.GUIAS = [
  { id: "cheia", titulo: "Antes e durante a cheia", icone: "waves", blocos: [
    ["Quando o rio começar a subir", ["Cadastre seu CEP no alerta da Defesa Civil: mande um SMS para 40199 com o CEP.", "Suba marombas e jiraus para guardar móveis, sementes e ração acima da água.", "Guarde documentos e remédios em saco plástico fechado, no lugar mais alto da casa."]],
    ["Água de beber", ["Água de enchente traz esgoto e lixo. Ferva por 1 minuto ou use 2 gotas de hipoclorito por litro e espere 30 minutos.", "Lave as mãos antes de comer e depois de mexer na lama."]],
    ["Saúde", ["Leptospirose vem da urina de rato na água. Use bota ou saco plástico nos pés.", "Febre, dor no corpo e na batata da perna depois de andar na água: procure o posto de saúde.", "Cuidado com cobra, jacaré e arraia perto da casa."]],
    ["Se precisar sair", ["Desligue a energia antes de a água chegar às tomadas.", "Leve documentos, remédios, água e celular carregado.", "Ligue 199 para pedir abrigo ou transporte."]]
  ]},
  { id: "seca", titulo: "Seca e vazante forte", icone: "sun", blocos: [
    ["Água", ["Poço raso e lago fechado podem ficar com água ruim. Ferva ou trate com hipoclorito antes de beber.", "Guarde água limpa em vasilha tampada; destampada vira criadouro de mosquito."]],
    ["Isolamento", ["Com o rio baixo, barco grande não chega. Combine com a comunidade quem busca remédio e rancho.", "Comunidade isolada sem água ou comida: ligue para a Defesa Civil (199)."]],
    ["Peixe e lago", ["Peixe morrendo no lago é sinal de água quente e sem oxigênio. Não coma peixe já morto.", "Boto e peixe-boi presos em poça: avise o Ibama ou o ICMBio."]],
    ["Fogo", ["Na seca o fogo de roça escapa fácil. Faça aceiro, queime cedo, sem vento, e nunca deixe o fogo sozinho.", "Em muitos estados a queima fica proibida na seca. Confira na prefeitura."]]
  ]},
  { id: "fumaca", titulo: "Fumaça e saúde", icone: "cloud", blocos: [
    ["Quando o céu fica cinza", ["Fique dentro de casa, com portas e janelas fechadas nas horas de mais fumaça.", "Pano molhado na boca ajuda pouco. Máscara PFF2 protege mais.", "Beba bastante água."]],
    ["Quem precisa de mais cuidado", ["Crianças pequenas, idosos, grávidas e quem tem asma ou problema de coração.", "Falta de ar, chiado ou dor no peito: procure o posto ou ligue 192."]]
  ]},
  { id: "fogo", titulo: "Fogo perto da comunidade", icone: "fire", blocos: [
    ["Se o fogo se aproximar", ["Ligue 193 e avise os vizinhos.", "Saia na direção contrária ao vento, por caminho já limpo ou pelo rio.", "Não tente apagar fogo grande sozinho."]],
    ["Para proteger a casa", ["Mantenha limpo um aceiro de pelo menos 3 metros em volta da casa.", "Lixo, palha e lenha longe das paredes."]],
    ["Brigada na comunidade", ["O Prevfogo, do Ibama, forma brigadas com moradores de terras indígenas e comunidades tradicionais. Pergunte na unidade do Ibama ou à Funai da sua região."]]
  ]}
];
