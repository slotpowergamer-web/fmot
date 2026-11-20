import {
  GalleryItem,
  HierarchyNode,
  OperationRecord,
  PortalConfig,
  PortalSlot,
  RoleSpecialty,
} from '../types/portal';

export const OFFICIAL_EMBLEM_URL =
  '/assets/aistudio/Emblema_FMOT__Caveira_T_tica_El_trica_6156ccbc.png';

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  heroHeadline: 'UMA CORPORAÇÃO. UM PROPÓSITO. UMA IDENTIDADE.',
  heroSubtext:
    'A 1.F.M.O.T é uma equipe de elite que se diferencia de todas as demais corporações do BRP pela disciplina, organização, capacitação contínua e operações diárias e semanais.',
  aboutIntro:
    'A 1.F.M.O.T é uma equipe de elite que se diferencia de todas as demais corporações do BRP.\n\nSomos uma corporação com identidade própria, comprometida com a excelência operacional, disciplina, organização e capacitação contínua de nossos integrantes.',
  aboutOperationsText:
    'Realizamos operações diariamente e semanalmente, buscando constantemente o aprimoramento individual e coletivo de nosso efetivo.\n\nNossa atuação é marcada pela dedicação, preparação e busca constante pela evolução.',
  aboutDifferentiator:
    'Nosso diferencial é fazer o que nenhuma outra corporação faz no BRP.',
  aboutIdentityText:
    'Cada símbolo, patente e procedimento dentro da 1.F.M.O.T reflete uma cultura inegociável de disciplina, organização e preparo contínuo. Não seguimos padrões comuns — estabelecemos nossa própria referência operacional.',
  aboutValues: [
    {
      id: 'val_excelencia',
      title: 'Excelência Operacional',
      description: 'Compromisso constante com execução precisa e aprimoramento técnico do efetivo.',
    },
    {
      id: 'val_disciplina',
      title: 'Disciplina e Ordem',
      description: 'Respeito rigoroso à hierarquia, às diretrizes do comando e à conduta institucional.',
    },
    {
      id: 'val_organizacao',
      title: 'Organização Estrutural',
      description: 'Cadeia de comando clara, funções definidas e coordenação contínua entre equipes.',
    },
    {
      id: 'val_capacitacao',
      title: 'Capacitação Contínua',
      description: 'Evolução individual e coletiva sustentada por operações diárias e semanais.',
    },
  ],
};

export const DEFAULT_PORTAL_SLOTS: PortalSlot[] = [
  {
    id: 'logo_official',
    page: 'identidade',
    label: 'Logo Oficial da 1.F.M.O.T',
    title: 'Emblema Oficial 1.F.M.O.T',
    description:
      'Identidade oficial exibida na navegação, na abertura do portal e no rodapé, preservando transparência e proporções originais.',
    placeholderLabel: 'EMBLEMA OFICIAL',
    imageUrl: OFFICIAL_EMBLEM_URL,
    isCover: true,
  },
  {
    id: 'home_hero',
    page: 'inicio',
    label: 'Início — Fotografia Institucional Panorâmica',
    title: 'Abertura Institucional 1.F.M.O.T',
    description: 'Espaço reservado para fotografia panorâmica oficial da corporação na página inicial.',
    placeholderLabel: 'FOTOGRAFIA INSTITUCIONAL PANORÂMICA',
    imageUrl: '',
    isCover: true,
  },
  {
    id: 'home_banner',
    page: 'inicio',
    label: 'Início — Registro em Destaque / Fundo',
    title: 'Presença Operacional no BRP',
    description: 'Espaço destinado a banner ou fotografia institucional de destaque na página inicial.',
    placeholderLabel: 'REGISTRO DA CORPORAÇÃO',
    imageUrl: '',
    isCover: false,
  },
  {
    id: 'about_team_panoramic',
    page: 'quem_somos',
    label: 'Quem Somos — Fotografia Panorâmica da Equipe',
    title: 'Efetivo Oficial 1.F.M.O.T',
    description: 'Espaço panorâmico destinado à fotografia oficial da equipe 1.F.M.O.T.',
    placeholderLabel: 'FOTOGRAFIA PANORÂMICA DA EQUIPE',
    imageUrl: '',
    isCover: true,
  },
  {
    id: 'about_daily_ops',
    page: 'quem_somos',
    label: 'Quem Somos — Registro de Operações Diárias',
    title: 'Operações Diárias',
    description: 'Espaço reservado para fotografia real das operações diárias da corporação.',
    placeholderLabel: 'REGISTRO DE OPERAÇÕES DIÁRIAS',
    imageUrl: '',
    isCover: false,
  },
  {
    id: 'about_weekly_ops',
    page: 'quem_somos',
    label: 'Quem Somos — Registro de Operações Semanais',
    title: 'Operações Semanais e Capacitação',
    description: 'Espaço reservado para fotografia real das operações semanais e treinamentos.',
    placeholderLabel: 'REGISTRO DE OPERAÇÕES SEMANAIS',
    imageUrl: '',
    isCover: false,
  },
];

export const DEFAULT_HIERARCHY_NODES: HierarchyNode[] = [
  {
    id: 'rank_coronel',
    rankTitle: 'CORONEL',
    memberName: '',
    positionCode: '01',
    tier: 1,
    parentId: '',
    responsibility:
      'Responsável pelo COMANDO GERAL de toda a corporação, liderança estratégica, coordenação de operações e tomada de decisões de alto nível.',
    insigniaUrl: '',
    photoUrl: '',
    order: 1,
    isDemo: false,
  },
  {
    id: 'rank_capitao',
    rankTitle: 'CAPITÃO',
    memberName: '',
    positionCode: '02',
    tier: 2,
    parentId: 'rank_coronel',
    responsibility:
      'Responsável pelo Comando Geral de equipes e operações especiais, incluindo negociações, engenharia, paraquedismo, invasões, fiscalizações, investigação, orientação, capacitação, desenvolvimento operacional e da ordem.',
    insigniaUrl: '',
    photoUrl: '',
    order: 2,
    isDemo: false,
  },
  {
    id: 'rank_sargento',
    rankTitle: 'SARGENTO',
    memberName: '',
    positionCode: '03',
    tier: 3,
    parentId: 'rank_capitao',
    responsibility:
      'Responsável pelo Comando Geral de equipes e operações básicas, atuando na fiscalização, orientação, capacitação e desenvolvimento contínuo do efetivo e da ordem.',
    insigniaUrl: '',
    photoUrl: '',
    order: 3,
    isDemo: false,
  },
  {
    id: 'rank_cabo',
    rankTitle: 'CABO',
    memberName: '',
    positionCode: '04',
    tier: 4,
    parentId: 'rank_sargento',
    responsibility:
      'Responsável pelo comando de 08 unidades Stives, realizando fiscalização, orientação, capacitação, desenvolvimento direto da tropa e da ordem.',
    insigniaUrl: '',
    photoUrl: '',
    order: 4,
    isDemo: false,
  },
  {
    id: 'rank_soldado',
    rankTitle: 'SOLDADO',
    memberName: '',
    positionCode: '05',
    tier: 5,
    parentId: 'rank_cabo',
    responsibility:
      'Responsável por executar suas funções com excelência, foco em capacitação contínua e desenvolvimento operacional.',
    insigniaUrl: '',
    photoUrl: '',
    order: 5,
    isDemo: false,
  },
  {
    id: 'rank_recruta',
    rankTitle: 'RECRUTA',
    memberName: '',
    positionCode: '06',
    tier: 6,
    parentId: 'rank_soldado',
    responsibility:
      'Aplicação de medidas punitivas quando necessário, visando sua capacitação e evolução dentro da corporação.',
    insigniaUrl: '',
    photoUrl: '',
    order: 6,
    isDemo: false,
  },
];

export const DEFAULT_ROLES: RoleSpecialty[] = [
  {
    id: 'func_comando_geral',
    name: 'Comando Geral e Liderança Estratégica',
    category: 'Comando',
    iconName: 'Shield',
    imageUrl: '',
    description:
      'Direção superior da 1.F.M.O.T, coordenação estratégica de operações e decisões de alto nível que orientam toda a corporação.',
    responsibilities: [
      'Comando Geral de toda a corporação',
      'Liderança estratégica e coordenação de operações',
      'Tomada de decisões de alto nível',
    ],
    requirements: ['Atribuição vinculada ao alto comando da 1.F.M.O.T'],
    order: 1,
    isDemo: false,
  },
  {
    id: 'func_operacoes_especiais',
    name: 'Operações Especiais',
    category: 'Especialidades',
    iconName: 'Crosshair',
    imageUrl: '',
    description:
      'Condução de frentes especializadas de alta complexidade dentro do BRP, integrando múltiplas capacidades táticas e técnicas.',
    responsibilities: [
      'Negociações em cenários críticos',
      'Engenharia operacional',
      'Paraquedismo e inserção tática',
      'Invasões coordenadas',
    ],
    requirements: ['Coordenação sob Comando Geral de equipes e operações especiais'],
    order: 2,
    isDemo: false,
  },
  {
    id: 'func_fiscalizacao_investigacao',
    name: 'Fiscalização, Investigação e Ordem',
    category: 'Ordem e Inteligência',
    iconName: 'Radar',
    imageUrl: '',
    description:
      'Acompanhamento rigoroso da conduta operacional, condução de investigações e preservação contínua da ordem interna.',
    responsibilities: [
      'Fiscalizações operacionais e disciplinares',
      'Investigação e apuração técnica',
      'Manutenção e desenvolvimento da ordem',
    ],
    requirements: ['Alinhamento estrito à doutrina e hierarquia da 1.F.M.O.T'],
    order: 3,
    isDemo: false,
  },
  {
    id: 'func_orientacao_capacitacao',
    name: 'Orientação e Capacitação Contínua',
    category: 'Desenvolvimento',
    iconName: 'BookOpen',
    imageUrl: '',
    description:
      'Formação permanente do efetivo, acompanhamento da evolução de cada patente e elevação constante do padrão operacional.',
    responsibilities: [
      'Orientação direta de equipes e recrutas',
      'Capacitação técnica e operacional contínua',
      'Desenvolvimento individual e coletivo do efetivo',
    ],
    requirements: ['Comprometimento contínuo com o preparo da tropa'],
    order: 4,
    isDemo: false,
  },
  {
    id: 'func_unidades_stives',
    name: 'Comando de Unidades Stives e Operações Básicas',
    category: 'Tropa',
    iconName: 'Compass',
    imageUrl: '',
    description:
      'Liderança direta das operações básicas e condução de 08 unidades Stives com foco em disciplina, execução e desenvolvimento da tropa.',
    responsibilities: [
      'Comando de equipes em operações básicas',
      'Comando direto de 08 unidades Stives',
      'Fiscalização, orientação e desenvolvimento direto da tropa',
    ],
    requirements: ['Execução disciplinada dentro da cadeia hierárquica'],
    order: 5,
    isDemo: false,
  },
];

export const DEFAULT_OPERATIONS: OperationRecord[] = [
  {
    id: 'op_slot_01',
    title: 'Operações Diárias da 1.F.M.O.T',
    category: 'Operação Diária',
    date: '',
    summary:
      'Espaço reservado para publicação dos registros oficiais de operações diárias realizadas pela corporação no BRP.',
    details:
      'Nenhuma fotografia ou relatório fictício foi inserido neste espaço. Utilize o Painel Administrativo para adicionar fotografias reais, datas oficiais e a descrição autorizada das operações diárias conduzidas pela 1.F.M.O.T.',
    results: '',
    coverImageUrl: '',
    galleryUrls: [],
    featured: true,
    isDemo: true,
    order: 1,
  },
  {
    id: 'op_slot_02',
    title: 'Operações Semanais e Capacitação do Efetivo',
    category: 'Operação Semanal',
    date: '',
    summary:
      'Espaço reservado para documentar operações semanais, exercícios de aprimoramento coletivo e ações especiais da equipe.',
    details:
      'Utilize o Painel Administrativo para substituir este espaço reservado pelos registros fotográficos e informações reais das operações semanais da 1.F.M.O.T.',
    results: '',
    coverImageUrl: '',
    galleryUrls: [],
    featured: true,
    isDemo: true,
    order: 2,
  },
  {
    id: 'op_slot_03',
    title: 'Ações Especiais — Engenharia, Paraquedismo e Invasões',
    category: 'Operações Especiais',
    date: '',
    summary:
      'Espaço preparado para apresentar fotografias e relatos oficiais das atuações especiais que diferenciam a 1.F.M.O.T no BRP.',
    details:
      'Adicione registros oficiais, fotografias panorâmicas e relatórios autorizados diretamente pelo Painel Administrativo sem necessidade de editar o código.',
    results: '',
    coverImageUrl: '',
    galleryUrls: [],
    featured: true,
    isDemo: true,
    order: 3,
  },
];

export const DEFAULT_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'gal_slot_01',
    title: 'Fotografia Panorâmica da Corporação',
    description: 'Espaço reservado — adicione sua fotografia oficial pelo Painel Administrativo.',
    category: 'Institucional',
    date: '',
    imageUrl: '',
    isCover: true,
    order: 1,
    isDemo: true,
  },
  {
    id: 'gal_slot_02',
    title: 'Registro de Operação Diária',
    description: 'Espaço reservado para fotografia real da 1.F.M.O.T em atuação.',
    category: 'Operações',
    date: '',
    imageUrl: '',
    isCover: false,
    order: 2,
    isDemo: true,
  },
  {
    id: 'gal_slot_03',
    title: 'Registro de Capacitação e Treinamento',
    description: 'Espaço reservado para fotografia de capacitação individual e coletiva.',
    category: 'Capacitação',
    date: '',
    imageUrl: '',
    isCover: false,
    order: 3,
    isDemo: true,
  },
  {
    id: 'gal_slot_04',
    title: 'Efetivo e Formatura 1.F.M.O.T',
    description: 'Espaço reservado para registro oficial do efetivo da corporação.',
    category: 'Equipe',
    date: '',
    imageUrl: '',
    isCover: false,
    order: 4,
    isDemo: true,
  },
];
