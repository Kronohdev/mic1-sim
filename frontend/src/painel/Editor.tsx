import { type ReactNode, useRef } from 'react'
import { MNEMONICOS, PALAVRAS_CAVALES } from '../lib/mac1'
import type { ErroMontagem } from '../tipos'

interface Props {
  fonte: string
  aoMudar: (fonte: string) => void
  linhaAtual: number | null
  erros: ErroMontagem[]
  linhasComBreakpoint: Set<number>
  linhasExecutaveis: Set<number>
  aoAlternarBreakpoint: (linha: number) => void
}

const INSTRUCAO = new Set(MNEMONICOS)

function colorir(linha: string): ReactNode[] {
  const saida: ReactNode[] = []
  const corte = linha.search(/[;#]/)
  const codigo = corte >= 0 ? linha.slice(0, corte) : linha
  const comentario = corte >= 0 ? linha.slice(corte) : ''
  codigo.split(/(\s+|,)/).forEach((pedaco, i) => {
    if (!pedaco) return
    let classe = ''
    if (/^[A-Za-z_]\w*:/.test(pedaco)) classe = 'tok-rotulo'
    else if (pedaco.startsWith('.')) classe = 'tok-diretiva'
    else if (INSTRUCAO.has(pedaco.toUpperCase())) classe = 'tok-op'
    else if (PALAVRAS_CAVALES.has(pedaco.toLowerCase())) classe = 'tok-op tok-cavalo'
    else if (/^-?(0x[0-9a-f]+|\d+)$/i.test(pedaco)) classe = 'tok-num'
    saida.push(classe ? <span key={i} className={classe}>{pedaco}</span> : pedaco)
  })
  if (comentario) saida.push(<span key="c" className="tok-comentario">{comentario}</span>)
  return saida
}

export function Editor(props: Props) {
  const { fonte, aoMudar, linhaAtual, erros, linhasComBreakpoint, linhasExecutaveis, aoAlternarBreakpoint } = props
  const margem = useRef<HTMLDivElement>(null)
  const fundo = useRef<HTMLPreElement>(null)
  const linhas = fonte.split('\n')
  const errosPorLinha = new Map(erros.map((e) => [e.linha, e.mensagem]))

  const sincronizar = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget
    if (margem.current) margem.current.scrollTop = scrollTop
    if (fundo.current) {
      fundo.current.scrollTop = scrollTop
      fundo.current.scrollLeft = scrollLeft
    }
  }

  return (
    <div className="editor">
      <div className="editor-margem" ref={margem}>
        {linhas.map((_, i) => {
          const n = i + 1
          const classes = [
            'margem-linha',
            linhasComBreakpoint.has(n) ? 'tem-break' : '',
            errosPorLinha.has(n) ? 'tem-erro' : '',
            linhaAtual === n ? 'atual' : '',
          ].join(' ')
          return linhasExecutaveis.has(n) ? (
            <button key={n} className={classes} onClick={() => aoAlternarBreakpoint(n)}
              aria-pressed={linhasComBreakpoint.has(n)}
              aria-label={`Linha ${n}: ${linhasComBreakpoint.has(n) ? 'tirar' : 'colocar'} breakpoint`}>
              {n}
            </button>
          ) : (
            <span key={n} className={classes} title={errosPorLinha.get(n)}>{n}</span>
          )
        })}
      </div>
      <div className="editor-codigo">
        <pre className="editor-fundo" ref={fundo} aria-hidden="true">
          {linhas.map((linha, i) => {
            const n = i + 1
            const classes = ['linha', linhaAtual === n ? 'atual' : '', errosPorLinha.has(n) ? 'tem-erro' : ''].join(' ')
            return <div key={i} className={classes}>{colorir(linha)}{'\n'}</div>
          })}
        </pre>
        <textarea
          className="editor-texto"
          value={fonte}
          onChange={(e) => aoMudar(e.target.value)}
          onScroll={sincronizar}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          aria-label="Código MAC-1"
        />
      </div>
    </div>
  )
}
