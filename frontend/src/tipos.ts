// Formato das mensagens trocadas com o backend (docs/protocolo.md)

export type CampoMir =
  | 'amux' | 'cond' | 'alu' | 'sh' | 'mbr' | 'mar' | 'rd' | 'wr' | 'enc'
  | 'c' | 'b' | 'a' | 'addr'

export type Componente =
  | 'mpc' | 'memoria_controle' | 'mir' | 'incrementador' | 'mmux'
  | 'logica_microssequenciamento' | 'decodificador_a' | 'decodificador_b' | 'decodificador_c'
  | 'registradores' | 'barramento_a' | 'barramento_b' | 'barramento_c'
  | 'latch_a' | 'latch_b' | 'amux' | 'ula' | 'deslocador' | 'mar' | 'mbr' | 'memoria' | 'cache'

export type Mapeamento = 'direto' | 'associativo' | 'conjunto'

export interface AcessoMemoria {
  tipo: 'leitura' | 'escrita'
  endereco: number
  fase: 1 | 2
  acerto?: boolean // so na fase 2, quando ha cache
}

export interface LinhaCache {
  valida: boolean
  suja: boolean
  tag: number
  inicio: number | null
  dados: number[]
}

export interface EstadoCache {
  mapeamento: Mapeamento
  vias: number
  bloco: number
  linhas: LinhaCache[]
  acertos: number
  faltas: number
  devolucoes: number
  taxa_acerto: number
  ultimo: { endereco: number; linha: number; acerto: boolean; espera: number } | null
}

export interface Estado {
  ciclo: number
  subciclo: 0 | 1 | 2 | 3 | 4
  parado: boolean
  esperando: boolean
  espera_restante: number
  registradores: number[]
  latch_a: number
  latch_b: number
  amux: number
  ula: number
  deslocador: number
  n: number
  z: number
  mar: number
  mbr: number
  mpc: number
  mir: { palavra: number; campos: Record<CampoMir, number>; texto: string }
  desviou: boolean
  memoria_acesso: AcessoMemoria | null
  memoria_escritas: { endereco: number; valor: number }[]
  instrucao: { endereco: number; palavra: number; texto: string; linha: number } | null
  ativos: Componente[]
  cache: EstadoCache | null
  metricas: {
    ciclos: number
    instrucoes: number
    leituras: number
    escritas: number
    ciclos_espera: number
    tempo_ms: number
  }
  breakpoints: number[]
}

export interface ErroMontagem {
  linha: number
  mensagem: string
}

export interface Programa {
  simbolos: Record<string, number>
  linhas: Record<string, number>
  variaveis: string[]
  tamanho: number
}

export type Unidade = 'subciclo' | 'ciclo' | 'instrucao'

export type Comando =
  | { cmd: 'montar'; fonte: string; cache: Mapeamento | null }
  | { cmd: 'passo'; unidade: Unidade }
  | { cmd: 'executar'; velocidade: number }
  | { cmd: 'pausar' }
  | { cmd: 'reiniciar' }
  | { cmd: 'breakpoints'; enderecos: number[] }
  | { cmd: 'velocidade'; valor: number }
  | { cmd: 'memoria'; inicio: number; quantidade: number }

export type Resposta =
  | { tipo: 'montado'; ok: true; erros: []; programa: Programa; estado: Estado }
  | { tipo: 'montado'; ok: false; erros: ErroMontagem[] }
  | { tipo: 'estado'; estado: Estado }
  | { tipo: 'memoria'; inicio: number; palavras: number[] }
  | { tipo: 'pausado'; motivo: 'usuario' | 'breakpoint' | 'fim' | 'erro' }
  | { tipo: 'erro'; mensagem: string }
