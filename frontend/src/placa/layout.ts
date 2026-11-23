// Posicoes dos componentes na placa e caminhos das trilhas.
// Plano da placa: x para a direita, z para a frente (na direcao de quem olha), y para cima.
// Os caminhos sao listas de pontos [x, z].

import type { Componente, Estado } from '../tipos'

export type Ponto = [number, number]

export interface Peca {
  id: Componente | `reg${number}`
  rotulo: string
  x: number
  z: number
  largura: number
  profundidade: number
  altura?: number
  forma?: 'chip' | 'mux' | 'ula' | 'pente'
}

export const NOMES_REGISTRADORES = [
  'PC', 'AC', 'SP', 'IR', 'TIR', '0', '+1', '-1',
  'AMASK', 'SMASK', 'A', 'B', 'C', 'D', 'E', 'F',
]

// banco de registradores: uma fileira no fundo da placa
const REG_Z = -5.3
const regX = (i: number) => -9.6 + i * 0.8
const BUS = { c: -4.35, a: -3.75, b: -3.15 }
const BUS_X: [number, number] = [-10, 3.2]

export const REGISTRADORES: Peca[] = NOMES_REGISTRADORES.map((nome, i) => ({
  id: `reg${i}`, rotulo: nome, x: regX(i), z: REG_Z, largura: 0.64, profundidade: 0.9, altura: 0.2,
}))

export const PECAS: Peca[] = [
  { id: 'latch_a', rotulo: 'Latch A', x: -2.6, z: -1.7, largura: 1.1, profundidade: 0.7 },
  { id: 'latch_b', rotulo: 'Latch B', x: 1.2, z: -1.7, largura: 1.1, profundidade: 0.7 },
  { id: 'amux', rotulo: 'AMUX', x: -2.6, z: 0.3, largura: 1.2, profundidade: 0.6, forma: 'mux' },
  { id: 'mar', rotulo: 'MAR', x: -6.2, z: -1.7, largura: 1.3, profundidade: 0.7 },
  { id: 'mbr', rotulo: 'MBR', x: -6.2, z: 0.3, largura: 1.3, profundidade: 0.7 },
  { id: 'ula', rotulo: 'ULA', x: -0.7, z: 2.1, largura: 3.0, profundidade: 1.1, forma: 'ula' },
  { id: 'deslocador', rotulo: 'Deslocador', x: -0.7, z: 3.7, largura: 3.0, profundidade: 0.7 },
  { id: 'cache', rotulo: 'Cache', x: -8.0, z: -0.7, largura: 0.9, profundidade: 2.7 },
  { id: 'memoria', rotulo: 'Memória 4096 × 16', x: -9.6, z: -0.5, largura: 1.0, profundidade: 4.4,
    altura: 0.9, forma: 'pente' },
  { id: 'memoria_controle', rotulo: 'Memória de controle', x: 8.0, z: -3.6, largura: 3.4,
    profundidade: 2.0, altura: 0.3 },
  { id: 'mpc', rotulo: 'MPC', x: 5.0, z: -3.6, largura: 1.1, profundidade: 0.6 },
  { id: 'mir', rotulo: 'MIR', x: 8.6, z: -0.9, largura: 4.6, profundidade: 0.7 },
  { id: 'mmux', rotulo: 'Mmux', x: 5.0, z: 1.6, largura: 1.0, profundidade: 0.6, forma: 'mux' },
  { id: 'incrementador', rotulo: '+1', x: 5.0, z: 3.1, largura: 1.0, profundidade: 0.6 },
  { id: 'logica_microssequenciamento', rotulo: 'Lógica N Z', x: 8.6, z: 1.6, largura: 1.6,
    profundidade: 0.7 },
  { id: 'decodificador_a', rotulo: 'Dec A', x: 4.6, z: -5.6, largura: 0.9, profundidade: 0.5 },
  { id: 'decodificador_b', rotulo: 'Dec B', x: 5.8, z: -5.6, largura: 0.9, profundidade: 0.5 },
  { id: 'decodificador_c', rotulo: 'Dec C', x: 7.0, z: -5.6, largura: 0.9, profundidade: 0.5 },
]

export const PLACA = { x: 0.15, z: -0.5, largura: 23.6, profundidade: 12.6 }

export function centro(id: string): Ponto {
  const p = [...PECAS, ...REGISTRADORES].find((peca) => peca.id === id)
  return p ? [p.x, p.z] : [0, 0]
}

// ---------------------------------------------------------------- trilhas

export interface Trilha {
  id: string
  pontos: Ponto[]
  grossa?: boolean
  controle?: boolean // linhas de controle, mais finas e tracejadas
}

const frenteReg = REG_Z + 0.45

export const TRILHAS: Trilha[] = [
  { id: 'busA', pontos: [[BUS_X[0], BUS.a], [BUS_X[1], BUS.a]], grossa: true },
  { id: 'busB', pontos: [[BUS_X[0], BUS.b], [BUS_X[1], BUS.b]], grossa: true },
  { id: 'busC', pontos: [[BUS_X[0], BUS.c], [3.6, BUS.c]], grossa: true },
  { id: 'dropA', pontos: [[-2.6, BUS.a], [-2.6, -2.05]], grossa: true },
  { id: 'dropB', pontos: [[1.2, BUS.b], [1.2, -2.05]], grossa: true },
  ...NOMES_REGISTRADORES.flatMap((_, i) => [
    { id: `stubC${i}`, pontos: [[regX(i) - 0.18, frenteReg], [regX(i) - 0.18, BUS.c]] as Ponto[] },
    { id: `stubA${i}`, pontos: [[regX(i), frenteReg], [regX(i), BUS.a]] as Ponto[] },
    { id: `stubB${i}`, pontos: [[regX(i) + 0.18, frenteReg], [regX(i) + 0.18, BUS.b]] as Ponto[] },
  ]),
  { id: 'latchA-amux', pontos: [[-2.6, -1.35], [-2.6, 0]] },
  { id: 'mbr-amux', pontos: [[-5.55, 0.3], [-3.2, 0.3]] },
  { id: 'amux-ula', pontos: [[-2.6, 0.6], [-2.6, 1.0], [-1.6, 1.0], [-1.6, 1.55]] },
  { id: 'latchB-ula', pontos: [[1.2, -1.35], [1.2, 1.0], [0.2, 1.0], [0.2, 1.55]] },
  { id: 'latchB-mar', pontos: [[1.2, -1.35], [1.2, -0.7], [-6.2, -0.7], [-6.2, -1.35]] },
  { id: 'ula-desl', pontos: [[-0.7, 2.65], [-0.7, 3.35]] },
  { id: 'desl-c', pontos: [[0.8, 3.7], [3.6, 3.7], [3.6, BUS.c]], grossa: true },
  { id: 'desl-mbr', pontos: [[-2.2, 3.7], [-7.2, 3.7], [-7.2, 0.3], [-6.85, 0.3]] },
  { id: 'mar-cache', pontos: [[-6.85, -1.7], [-7.55, -1.7]] },
  { id: 'cache-mem', pontos: [[-8.45, -1.7], [-9.1, -1.7]] },
  { id: 'mem-cache', pontos: [[-9.1, 0.3], [-8.45, 0.3]] },
  { id: 'cache-mbr', pontos: [[-7.55, 0.3], [-6.85, 0.3]] },
  { id: 'mpc-cs', pontos: [[5.55, -3.6], [6.3, -3.6]] },
  { id: 'cs-mir', pontos: [[8.0, -2.6], [8.0, -1.25]] },
  { id: 'mir-logica', pontos: [[8.6, -0.55], [8.6, 1.25]], controle: true },
  { id: 'mir-mmux', pontos: [[6.6, -0.55], [6.6, 1.1], [5.3, 1.1], [5.3, 1.3]], controle: true },
  { id: 'logica-mmux', pontos: [[7.8, 1.6], [5.5, 1.6]], controle: true },
  { id: 'mmux-mpc', pontos: [[4.8, 1.3], [4.8, -3.3]] },
  { id: 'mpc-inc', pontos: [[4.45, -3.6], [4.1, -3.6], [4.1, 3.1], [4.5, 3.1]] },
  { id: 'inc-mmux', pontos: [[5.0, 2.8], [5.0, 1.9]] },
  { id: 'ula-logica', pontos: [[0.8, 2.4], [8.6, 2.4], [8.6, 1.95]], controle: true },
  { id: 'mir-dec', pontos: [[10.9, -0.9], [11.3, -0.9], [11.3, -6.2], [7.0, -6.2], [7.0, -5.85]],
    controle: true },
  { id: 'dec-reg', pontos: [[4.15, -5.6], [3.4, -5.6], [3.4, -6.0], [-10, -6.0]], controle: true },
]

// ---------------------------------------------------------------- atividade

/** Ciclos de espera que faltam, contando o atual (o contador so desce no subciclo 4). */
export const ciclosDeEspera = (e: Estado) => e.espera_restante + (e.subciclo === 4 ? 1 : 0)

/** O dado precisa ir ate a memoria principal? Sem cache sempre; com cache so na falta. */
const passaPelaMemoria = (e: Estado) => !e.cache || e.memoria_acesso?.acerto === false

export function trilhasAtivas(e: Estado | null): Set<string> {
  const ativas = new Set<string>()
  if (!e || e.subciclo === 0) return ativas
  // falta na cache: so o bloco vindo da memoria se mexe, o resto da maquina espera
  if (e.esperando) return ativas.add('cache-mem').add('mem-cache')
  const f = e.mir.campos
  switch (e.subciclo) {
    case 1:
      ativas.add('mpc-cs').add('cs-mir')
      break
    case 2:
      ativas.add('busA').add('busB').add('dropA').add('dropB').add(`stubA${f.a}`).add(`stubB${f.b}`)
      ativas.add('mir-dec').add('dec-reg')
      break
    case 3:
      ativas.add('amux-ula').add(f.amux ? 'mbr-amux' : 'latchA-amux').add('latchB-ula').add('ula-desl')
      if (f.cond === 1 || f.cond === 2) ativas.add('ula-logica')
      if (f.mar) ativas.add('latchB-mar')
      break
    case 4:
      if (f.enc) ativas.add('desl-c').add('busC').add(`stubC${f.c}`).add('mir-dec').add('dec-reg')
      if (f.mbr) ativas.add('desl-mbr')
      if (e.memoria_acesso) {
        ativas.add('mar-cache')
        if (passaPelaMemoria(e)) ativas.add('cache-mem')
        if (e.memoria_acesso.fase === 2) {
          ativas.add('cache-mbr')
          if (passaPelaMemoria(e)) ativas.add('mem-cache')
        }
      }
      ativas.add('mir-logica').add('logica-mmux').add('mmux-mpc')
      if (e.desviou) ativas.add('mir-mmux')
      else ativas.add('mpc-inc').add('inc-mmux')
      break
  }
  return ativas
}

/** Registradores lidos (subciclo 2) ou gravados (subciclo 4) neste subciclo. */
export function registradoresAtivos(e: Estado | null): Set<number> {
  const r = new Set<number>()
  if (!e) return r
  const f = e.mir.campos
  if (e.subciclo === 2) r.add(f.a).add(f.b)
  if (e.subciclo === 4 && f.enc) r.add(f.c)
  return r
}

// ---------------------------------------------------------------- pacotes de dados

export interface Pacote {
  id: string
  caminho: Ponto[]
  valor: string
}

const hex = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, '0')

const juntar = (...partes: Ponto[][]) => partes.flat()

const regParaBus = (i: number, bus: 'a' | 'b', x: number): Ponto[] => {
  const dx = bus === 'a' ? 0 : 0.18
  return [[regX(i) + dx, frenteReg], [regX(i) + dx, BUS[bus]], [x, BUS[bus]]]
}

const CAMINHOS = new Map(TRILHAS.map((t) => [t.id, t.pontos]))
const caminho = (id: string) => CAMINHOS.get(id)!

export function pacotesDoSubciclo(e: Estado | null): Pacote[] {
  if (!e || e.subciclo === 0) return []
  if (e.esperando) {
    return [{ id: 'bloco', caminho: caminho('mem-cache'), valor: `bloco ${ciclosDeEspera(e)}` }]
  }
  const f = e.mir.campos
  const lista: Pacote[] = []
  switch (e.subciclo) {
    case 1:
      lista.push({ id: 'mpc', caminho: juntar(caminho('mpc-cs'), [[8.0, -3.6]], caminho('cs-mir')),
        valor: `µ${e.mpc}` })
      break
    case 2:
      lista.push({ id: 'a', caminho: juntar(regParaBus(f.a, 'a', -2.6), [[-2.6, -2.05]]), valor: hex(e.latch_a) })
      lista.push({ id: 'b', caminho: juntar(regParaBus(f.b, 'b', 1.2), [[1.2, -2.05]]), valor: hex(e.latch_b) })
      break
    case 3:
      lista.push({
        id: 'amux',
        caminho: juntar(caminho(f.amux ? 'mbr-amux' : 'latchA-amux'), caminho('amux-ula')),
        valor: hex(e.amux),
      })
      lista.push({ id: 'b', caminho: caminho('latchB-ula'), valor: hex(e.latch_b) })
      lista.push({ id: 'ula', caminho: caminho('ula-desl'), valor: hex(e.ula) })
      if (f.mar) lista.push({ id: 'mar', caminho: caminho('latchB-mar'), valor: hex(e.mar) })
      break
    case 4:
      if (f.enc) {
        lista.push({
          id: 'c',
          caminho: juntar(caminho('desl-c'), [[regX(f.c) - 0.18, BUS.c], [regX(f.c) - 0.18, frenteReg]]),
          valor: hex(e.deslocador),
        })
      }
      if (f.mbr) lista.push({ id: 'mbr', caminho: caminho('desl-mbr'), valor: hex(e.deslocador) })
      if (e.memoria_acesso?.fase === 2) {
        const leitura = e.memoria_acesso.tipo === 'leitura'
        // com write-back a escrita para na cache; a leitura so vai ate a memoria na falta
        const ateMemoria = leitura ? passaPelaMemoria(e) : !e.cache
        const dado = ateMemoria
          ? juntar(caminho('mem-cache'), [[-8.0, 0.3]], caminho('cache-mbr'))
          : caminho('cache-mbr')
        lista.push({ id: 'mem', caminho: leitura ? dado : [...dado].reverse(), valor: hex(e.mbr) })
      }
      lista.push({
        id: 'mpc',
        caminho: e.desviou
          ? juntar(caminho('mir-mmux'), caminho('mmux-mpc'))
          : juntar(caminho('inc-mmux'), caminho('mmux-mpc')),
        valor: `µ${e.mpc}`,
      })
      break
  }
  return lista
}

/** Ponto medio dos componentes ativos, usado pela camera que acompanha a execucao. */
export function focoDoSubciclo(e: Estado | null): Ponto {
  if (!e || e.subciclo === 0) return [0, -0.5]
  const focos: Record<number, Ponto> = { 1: [7.0, -2.6], 2: [-3.0, -3.4], 3: [-1.8, 1.6], 4: [-1.0, 0.5] }
  if (e.esperando || (e.subciclo === 4 && e.memoria_acesso)) return [-7.4, -0.5]
  return focos[e.subciclo]
}
