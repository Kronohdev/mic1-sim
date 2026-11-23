import { useState } from 'react'
import { comSinal, emCavales, hex16 } from '../lib/mac1'
import { ciclosDeEspera, NOMES_REGISTRADORES } from '../placa/layout'
import type { Estado, Mapeamento, Programa } from '../tipos'
import { PALAVRAS_POR_REGIAO, REGIOES } from '../useSimulador'

export function Registradores({ estado, anterior }: { estado: Estado | null; anterior: Estado | null }) {
  const regs = estado?.registradores ?? new Array(16).fill(0)
  const extras: [string, number | undefined][] = [
    ['MAR', estado?.mar], ['MBR', estado?.mbr], ['MPC', estado?.mpc],
  ]
  return (
    <section className="painel registradores" aria-label="Registradores">
      <header className="painel-topo"><h2>Registradores</h2></header>
      <table className="tabela-regs">
        <tbody>
          {regs.map((valor, i) => {
            const mudou = anterior !== null && anterior.registradores[i] !== valor
            const constante = i >= 5 && i <= 9
            return (
              <tr key={i} className={mudou ? 'mudou' : constante ? 'constante' : ''}>
                <td className="reg-num">{i}</td>
                <td className="reg-nome">{NOMES_REGISTRADORES[i]}</td>
                <td className="mono">{hex16(valor)}</td>
                <td className="mono num">{comSinal(valor)}</td>
              </tr>
            )
          })}
          {extras.map(([nome, valor]) => (
            <tr key={nome} className="extra">
              <td />
              <td className="reg-nome">{nome}</td>
              <td className="mono">{valor === undefined ? '' : nome === 'MPC' ? valor : hex16(valor)}</td>
              <td className="mono num">{valor === undefined || nome === 'MPC' ? '' : comSinal(valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

type Aba = (typeof REGIOES)[number]['id'] | 'cache'

const OPCOES_CACHE: { valor: Mapeamento | null; nome: string }[] = [
  { valor: null, nome: 'Sem cache' },
  { valor: 'direto', nome: 'Mapeamento direto' },
  { valor: 'associativo', nome: 'Totalmente associativa' },
  { valor: 'conjunto', nome: 'Associativa por conjunto (2 vias)' },
]

export function Memoria({ estado, memoria, programa, cache, aoTrocarCache }: {
  estado: Estado | null
  memoria: Map<number, number>
  programa: Programa | null
  cache: Mapeamento | null
  aoTrocarCache: (m: Mapeamento | null) => void
}) {
  const [aba, setAba] = useState<Aba>('programa')
  const abas = [...REGIOES, { id: 'cache' as const, nome: 'Cache' }]

  return (
    <section className="painel memoria" aria-label="Memória">
      <header className="painel-topo">
        <h2>Memória</h2>
        <div className="abas" role="tablist">
          {abas.map((r) => (
            <button key={r.id} role="tab" aria-selected={r.id === aba}
              className={r.id === aba ? 'selecionada' : ''} onClick={() => setAba(r.id)}>
              {r.nome}
            </button>
          ))}
        </div>
      </header>
      {aba === 'cache'
        ? <PainelCache estado={estado} cache={cache} aoTrocarCache={aoTrocarCache} />
        : <ListaMemoria estado={estado} memoria={memoria} programa={programa}
            inicio={REGIOES.find((r) => r.id === aba)!.inicio} doPrograma={aba === 'programa'} />}
    </section>
  )
}

function ListaMemoria({ estado, memoria, programa, inicio, doPrograma }: {
  estado: Estado | null; memoria: Map<number, number>; programa: Programa | null
  inicio: number; doPrograma: boolean
}) {
  const acesso = estado?.memoria_acesso
  const rotulos = new Map(Object.entries(programa?.simbolos ?? {}).map(([nome, end]) => [end, nome] as const))
  const sp = estado?.registradores[2]
  return (
    <div className="lista-memoria">
      {Array.from({ length: PALAVRAS_POR_REGIAO }, (_, i) => {
        const endereco = inicio + i
        const valor = memoria.get(endereco) ?? 0
        const classes = [
          'celula',
          acesso?.endereco === endereco ? `acesso-${acesso.tipo}` : '',
          doPrograma && estado?.instrucao?.endereco === endereco ? 'instrucao' : '',
          sp === endereco ? 'topo-pilha' : '',
          valor === 0 ? 'zero' : '',
        ].join(' ')
        return (
          <div key={endereco} className={classes}>
            <span className="end">{endereco}</span>
            <span className="rot">{rotulos.get(endereco) ?? (sp === endereco ? '← SP' : '')}</span>
            <span className="mono">{hex16(valor)}</span>
            <span className="mono num">{comSinal(valor)}</span>
          </div>
        )
      })}
    </div>
  )
}

function PainelCache({ estado, cache, aoTrocarCache }: {
  estado: Estado | null; cache: Mapeamento | null; aoTrocarCache: (m: Mapeamento | null) => void
}) {
  const c = estado?.cache
  const ultimo = c?.ultimo
  return (
    <div className="painel-cache">
      <select value={cache ?? ''} aria-label="Tipo de cache"
        onChange={(e) => aoTrocarCache((e.target.value || null) as Mapeamento | null)}>
        {OPCOES_CACHE.map((o) => <option key={o.nome} value={o.valor ?? ''}>{o.nome}</option>)}
      </select>
      {!c ? (
        <p className="dica-cache">
          Sem cache, toda leitura e escrita vai direto para a memória principal. Escolha um
          mapeamento para ver acertos, faltas e os ciclos de espera.
        </p>
      ) : (
        <>
          <dl className="numeros-cache">
            <div><dt>acertos</dt><dd>{c.acertos}</dd></div>
            <div><dt>faltas</dt><dd>{c.faltas}</dd></div>
            <div><dt>taxa</dt><dd>{(c.taxa_acerto * 100).toFixed(1)}%</dd></div>
            <div><dt>espera</dt><dd>{estado?.metricas.ciclos_espera ?? 0}</dd></div>
          </dl>
          <table className="tabela-cache">
            <thead>
              <tr><th>linha</th><th>V</th><th>S</th><th>tag</th><th>bloco</th><th>dados</th></tr>
            </thead>
            <tbody>
              {c.linhas.map((linha, i) => {
                const classe = ultimo?.linha === i ? (ultimo.acerto ? 'acerto' : 'falta') : ''
                return (
                  <tr key={i} className={`${classe}${linha.valida ? '' : ' vazia'}`}>
                    <td className="mono">{c.vias > 1 && c.vias < c.linhas.length ? `${Math.floor(i / c.vias)}.${i % c.vias}` : i}</td>
                    <td>{linha.valida ? 1 : 0}</td>
                    <td>{linha.suja ? 1 : 0}</td>
                    <td className="mono">{linha.valida ? linha.tag : '-'}</td>
                    <td className="mono">{linha.inicio ?? '-'}</td>
                    <td className="mono">{linha.valida ? linha.dados.map(hex16).join(' ') : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="dica-cache">
            {c.linhas.length} linhas de {c.bloco} palavras · write-back · substituição LRU ·
            falta custa 4 ciclos
          </p>
        </>
      )}
    </div>
  )
}

const SUBCICLOS = [
  { n: 1, nome: 'Carrega o MIR', detalhe: 'MIR ← memória de controle[MPC]' },
  { n: 2, nome: 'Lê registradores', detalhe: 'latches A e B ← barramentos A e B' },
  { n: 3, nome: 'ULA e deslocador', detalhe: 'AMUX, ULA, deslocador; MAR ← latch B' },
  { n: 4, nome: 'Grava resultado', detalhe: 'barramento C, MBR, memória, MPC' },
]

export function FaixaMicro({ estado, cavalo }: { estado: Estado | null; cavalo: boolean }) {
  const instrucao = estado?.instrucao
  return (
    <div className="faixa-micro">
      <ol className="subciclos" aria-label="Subciclo">
        {SUBCICLOS.map((s) => (
          <li key={s.n} className={estado?.subciclo === s.n ? 'atual' : ''}
            aria-current={estado?.subciclo === s.n ? 'step' : undefined}>
            <b>{s.n}</b>
            <span>{s.nome}<small>{s.detalhe}</small></span>
          </li>
        ))}
      </ol>
      <div className="micro-info">
        <div>
          <span className="rotulo">Microinstrução {estado ? estado.subciclo === 4 ? '' : `#${estado.mpc}` : ''}</span>
          <code className="mal">
            {estado?.esperando
              ? `falta na cache: esperando (${ciclosDeEspera(estado)})`
              : estado?.subciclo ? estado.mir.texto : '-'}
          </code>
        </div>
        <div>
          <span className="rotulo">Instrução MAC-1</span>
          <code className="mac1">
            {instrucao ? `${instrucao.endereco}: ${cavalo ? emCavales(instrucao.texto) : instrucao.texto}` : '-'}
          </code>
        </div>
      </div>
    </div>
  )
}
