import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from './painel/Editor'
import { FaixaMicro, Memoria, Registradores } from './painel/Paineis'
import { Placa3D, type Vista } from './placa/Placa3D'
import { EXEMPLOS } from './programas'
import type { Mapeamento } from './tipos'
import { useSimulador } from './useSimulador'

// subciclos por segundo; 0 = o mais rapido possivel
const VELOCIDADES = [0.5, 1, 2, 4, 8, 16, 40, 120, 400, 0]
const nomeVelocidade = (v: number) => (v === 0 ? 'máx.' : `${v}/s`)

const VISTAS: { id: Vista; nome: string }[] = [
  { id: 'geral', nome: 'Placa inteira' },
  { id: 'dados', nome: 'Caminho de dados' },
  { id: 'controle', nome: 'Controle' },
  { id: 'memoria', nome: 'Memória' },
  { id: 'acompanhar', nome: 'Acompanhar' },
]

const INICIAL = EXEMPLOS.findIndex((e) => e.arquivo === '03_fibonacci.asm')
const MAPEAMENTOS: Mapeamento[] = ['direto', 'associativo', 'conjunto']
const parametro = (nome: string) => new URLSearchParams(location.search).get(nome)

export default function App() {
  const sim = useSimulador()
  const [exemplo, setExemplo] = useState(INICIAL)
  const [fonte, setFonte] = useState(EXEMPLOS[INICIAL].fonte)
  const [fonteMontada, setFonteMontada] = useState<string | null>(null)
  const [cavalo, setCavalo] = useState(false)
  const [vista, setVista] = useState<Vista>(() => VISTAS.find((x) => x.id === parametro('vista'))?.id ?? 'geral')
  const [cache, setCache] = useState<Mapeamento | null>(
    () => MAPEAMENTOS.find((m) => m === parametro('cache')) ?? null,
  )
  const [apresentacao, setApresentacao] = useState(false)
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set())

  const { estado, programa, erros } = sim
  const alterado = fonteMontada !== fonte
  const pronto = programa !== null && !alterado && sim.conexao === 'conectado'
  const parado = estado?.parado ?? false

  const linhaParaEndereco = useMemo(() => {
    const mapa = new Map<number, number>()
    Object.entries(programa?.linhas ?? {}).forEach(([end, linha]) => mapa.set(linha, Number(end)))
    return mapa
  }, [programa])

  const montar = useCallback((texto: string, mapeamento = cache) => {
    sim.montar(texto, mapeamento)
    setFonteMontada(texto)
    setBreakpoints(new Set())
    sim.definirBreakpoints([])
  }, [sim, cache])

  const trocarCache = (mapeamento: Mapeamento | null) => {
    setCache(mapeamento)
    montar(fonte, mapeamento)
  }

  const montouInicial = useRef(false)
  useEffect(() => {
    if (montouInicial.current || sim.conexao !== 'conectado') return
    montouInicial.current = true
    montar(EXEMPLOS[INICIAL].fonte)
    // ?subciclos=N ja avanca N subciclos (bom para gravar o video a partir de um ponto certo)
    const subciclos = Number(parametro('subciclos') ?? 0)
    for (let i = 0; i < subciclos; i++) sim.passo('subciclo')
  }, [sim, montar])

  const trocarExemplo = (i: number) => {
    setExemplo(i)
    setFonte(EXEMPLOS[i].fonte)
    if (EXEMPLOS[i].cavalo) setCavalo(true)
    montar(EXEMPLOS[i].fonte)
  }

  const alternarBreakpoint = (linha: number) => {
    const novo = new Set(breakpoints)
    if (novo.has(linha)) novo.delete(linha)
    else novo.add(linha)
    setBreakpoints(novo)
    sim.definirBreakpoints([...novo].map((l) => linhaParaEndereco.get(l)).filter((e) => e !== undefined))
  }

  // atalhos: Ctrl+Enter monta, F8 executa/pausa, F9 subciclo, F10 ciclo, Shift+F10 instrucao, F11 tela de apresentacao
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const livre = pronto && !sim.executando && !parado
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        montar(fonte)
      } else if (e.key === 'F8' && pronto) {
        e.preventDefault()
        if (sim.executando) sim.pausar()
        else if (!parado) sim.executar()
      } else if (e.key === 'F9' && livre) {
        e.preventDefault()
        sim.passo('subciclo')
      } else if (e.key === 'F10' && livre) {
        e.preventDefault()
        sim.passo(e.shiftKey ? 'instrucao' : 'ciclo')
      } else if (e.key === 'F11') {
        e.preventDefault()
        setApresentacao((a) => !a)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [fonte, montar, parado, pronto, sim])

  const linhaAtual = !alterado && estado?.instrucao ? estado.instrucao.linha : null
  const m = estado?.metricas
  const indiceVelocidade = Math.max(0, VELOCIDADES.indexOf(sim.velocidade))

  return (
    <div className={`app${apresentacao ? ' apresentacao' : ''}`}>
      <header className="topo">
        <h1 className="marca">MIC-1 <span>Sim</span></h1>

        <div className="controles" role="toolbar" aria-label="Execução">
          {sim.executando ? (
            <button className="btn btn-principal" onClick={sim.pausar} title="Pausar (F8)">❚❚ Pausar</button>
          ) : (
            <button className="btn btn-principal" onClick={sim.executar} disabled={!pronto || parado}
              title="Executar (F8)">▶ Executar</button>
          )}
          <button className="btn" onClick={() => sim.passo('subciclo')}
            disabled={!pronto || sim.executando || parado} title="Avança um subciclo (F9)">+1 subciclo</button>
          <button className="btn" onClick={() => sim.passo('ciclo')}
            disabled={!pronto || sim.executando || parado} title="Avança uma microinstrução (F10)">+1 ciclo</button>
          <button className="btn" onClick={() => sim.passo('instrucao')}
            disabled={!pronto || sim.executando || parado} title="Avança uma instrução MAC-1 (Shift+F10)">
            +1 instrução
          </button>
          <button className="btn btn-leve" onClick={sim.reiniciar} disabled={!pronto}>Reiniciar</button>
          <label className="velocidade">
            <span>Velocidade</span>
            <input type="range" min={0} max={VELOCIDADES.length - 1} value={indiceVelocidade}
              onChange={(e) => sim.mudarVelocidade(VELOCIDADES[Number(e.target.value)])}
              aria-valuetext={nomeVelocidade(sim.velocidade)} />
            <output>{nomeVelocidade(sim.velocidade)}</output>
          </label>
        </div>

        <dl className="metricas">
          <div><dt>Ciclos</dt><dd>{m?.ciclos ?? 0}</dd></div>
          <div><dt>Instruções</dt><dd>{m?.instrucoes ?? 0}</dd></div>
          <div><dt>CPI</dt><dd>{m?.instrucoes ? (m.ciclos / m.instrucoes).toFixed(2) : '-'}</dd></div>
          <div><dt>Leituras</dt><dd>{m?.leituras ?? 0}</dd></div>
          <div><dt>Escritas</dt><dd>{m?.escritas ?? 0}</dd></div>
          {estado?.cache && (
            <div><dt>Acertos</dt><dd>{(estado.cache.taxa_acerto * 100).toFixed(1)}%</dd></div>
          )}
          <div><dt>Tempo</dt><dd>{m ? `${m.tempo_ms.toFixed(1)} ms` : '-'}</dd></div>
        </dl>

        <span className={`conexao ${sim.conexao}`}
          title={sim.conexao === 'conectado' ? 'Conectado ao simulador' : 'Tentando conectar em python -m mic1'}>
          {sim.conexao === 'conectado' ? 'conectado' : sim.conexao === 'conectando' ? 'conectando…' : 'sem servidor'}
        </span>
      </header>

      {sim.aviso && (
        <div className={`aviso ${sim.aviso.tipo}`} role="status">
          <span>{sim.aviso.tipo === 'fim' && cavalo ? '🐴 Relinchou! ' : ''}{sim.aviso.texto}</span>
          <button className="btn btn-leve" onClick={sim.fecharAviso} aria-label="Fechar">✕</button>
        </div>
      )}

      <main className="area">
        <section className="painel codigo" aria-label="Código">
          <header className="painel-topo">
            <select value={exemplo} onChange={(e) => trocarExemplo(Number(e.target.value))} aria-label="Exemplo">
              {EXEMPLOS.map((ex, i) => <option key={ex.arquivo} value={i}>{ex.titulo}</option>)}
            </select>
            <button className={`btn${alterado ? ' btn-principal' : ''}`} onClick={() => montar(fonte)}
              disabled={sim.conexao !== 'conectado'} title="Montar e carregar na memória (Ctrl+Enter)">
              {alterado ? 'Montar alterações' : 'Montar'}
            </button>
          </header>
          <Editor
            fonte={fonte}
            aoMudar={setFonte}
            linhaAtual={linhaAtual}
            erros={alterado ? [] : erros}
            linhasComBreakpoint={breakpoints}
            linhasExecutaveis={alterado ? new Set() : new Set(linhaParaEndereco.keys())}
            aoAlternarBreakpoint={alternarBreakpoint}
          />
          {!alterado && erros.length > 0 && (
            <ul className="erros">
              {erros.map((e) => <li key={`${e.linha}${e.mensagem}`}><b>linha {e.linha}</b> {e.mensagem}</li>)}
            </ul>
          )}
          <footer className="painel-rodape">
            <label className="chave">
              <input type="checkbox" checked={cavalo} onChange={(e) => setCavalo(e.target.checked)} />
              <span className="trilho" aria-hidden="true"><span /></span>
              Modo cavalo
            </label>
            <span className="dica">clique no número da linha para marcar breakpoint</span>
          </footer>
        </section>

        <section className="palco" aria-label="Placa do MIC-1 em 3D">
          <Placa3D
            estado={estado}
            anterior={sim.anterior}
            vista={vista}
            velocidade={sim.velocidade}
            executando={sim.executando}
            aoMexerNaCamera={() => setVista('geral')}
          />
          <nav className="vistas" aria-label="Câmera">
            {VISTAS.map((v) => (
              <button key={v.id} className={vista === v.id ? 'selecionada' : ''} onClick={() => setVista(v.id)}>
                {v.nome}
              </button>
            ))}
            <button onClick={() => setApresentacao((a) => !a)} title="Esconde os painéis (F11)">
              {apresentacao ? 'Mostrar painéis' : 'Tela cheia'}
            </button>
          </nav>
          {sim.conexao !== 'conectado' && (
            <div className="sem-servidor">
              <p>Aguardando o simulador.</p>
              <code>python -m mic1</code>
            </div>
          )}
          <FaixaMicro estado={estado} cavalo={cavalo} />
        </section>

        <div className="coluna-direita">
          <Registradores estado={estado} anterior={sim.anterior} />
          <Memoria estado={estado} memoria={sim.memoria} programa={programa}
            cache={cache} aoTrocarCache={trocarCache} />
        </div>
      </main>
    </div>
  )
}
