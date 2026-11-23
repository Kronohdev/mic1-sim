import { useCallback, useEffect, useRef, useState } from 'react'
import type { Comando, ErroMontagem, Estado, Mapeamento, Programa, Resposta, Unidade } from './tipos'

export const REGIOES = [
  { id: 'programa', nome: 'Programa', inicio: 0 },
  { id: 'pilha', nome: 'Pilha', inicio: 4096 - 64 },
] as const
export const PALAVRAS_POR_REGIAO = 64

export type Aviso = { tipo: 'info' | 'fim' | 'erro'; texto: string }
export type Conexao = 'conectando' | 'conectado' | 'desconectado'

function urlDoServidor() {
  const protocolo = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocolo}://${location.host}/ws`
}

export function useSimulador() {
  const socket = useRef<WebSocket | null>(null)
  const fila = useRef<Comando[]>([])
  const estadoAtual = useRef<Estado | null>(null)

  const [conexao, setConexao] = useState<Conexao>('conectando')
  const [estado, setEstado] = useState<Estado | null>(null)
  const [anterior, setAnterior] = useState<Estado | null>(null)
  const [programa, setPrograma] = useState<Programa | null>(null)
  const [erros, setErros] = useState<ErroMontagem[]>([])
  const [executando, setExecutando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [memoria, setMemoria] = useState<Map<number, number>>(new Map())
  const [velocidade, setVelocidadeLocal] = useState(4)

  const enviar = useCallback((comando: Comando) => {
    const ws = socket.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(comando))
    else fila.current.push(comando)
  }, [])

  const pedirMemoria = useCallback(() => {
    REGIOES.forEach((r) => enviar({ cmd: 'memoria', inicio: r.inicio, quantidade: PALAVRAS_POR_REGIAO }))
  }, [enviar])

  const aplicarEstado = useCallback((novo: Estado) => {
    setAnterior(estadoAtual.current)
    estadoAtual.current = novo
    setEstado(novo)
    if (novo.memoria_escritas.length) {
      setMemoria((atual) => {
        const copia = new Map(atual)
        novo.memoria_escritas.forEach(({ endereco, valor }) => copia.set(endereco, valor))
        return copia
      })
    }
  }, [])

  const receber = useCallback((r: Resposta) => {
    switch (r.tipo) {
      case 'montado':
        if (!r.ok) {
          setErros(r.erros)
          setPrograma(null)
          return
        }
        setErros([])
        setPrograma(r.programa)
        estadoAtual.current = null
        setAnterior(null)
        aplicarEstado(r.estado)
        pedirMemoria()
        return
      case 'estado':
        aplicarEstado(r.estado)
        return
      case 'memoria':
        setMemoria((atual) => {
          const copia = new Map(atual)
          r.palavras.forEach((p, i) => copia.set(r.inicio + i, p))
          return copia
        })
        return
      case 'pausado': {
        setExecutando(false)
        pedirMemoria()
        const e = estadoAtual.current
        if (r.motivo === 'fim' && e) {
          setAviso({
            tipo: 'fim',
            texto: `Fim do programa: ${e.metricas.instrucoes} instruções em ${e.metricas.ciclos} ciclos.`,
          })
        }
        if (r.motivo === 'breakpoint' && e) {
          setAviso({ tipo: 'info', texto: `Parou no breakpoint do endereço ${e.registradores[0]}.` })
        }
        return
      }
      case 'erro':
        setAviso({ tipo: 'erro', texto: r.mensagem })
    }
  }, [aplicarEstado, pedirMemoria])

  useEffect(() => {
    let encerrado = false
    let tentativa: number | undefined

    const conectar = () => {
      setConexao('conectando')
      const ws = new WebSocket(urlDoServidor())
      socket.current = ws
      ws.onopen = () => {
        setConexao('conectado')
        fila.current.forEach((c) => ws.send(JSON.stringify(c)))
        fila.current = []
      }
      ws.onmessage = (ev) => receber(JSON.parse(ev.data))
      ws.onclose = () => {
        if (encerrado) return
        setConexao('desconectado')
        setExecutando(false)
        tentativa = window.setTimeout(conectar, 1500)
      }
    }
    conectar()
    return () => {
      encerrado = true
      window.clearTimeout(tentativa)
      socket.current?.close()
    }
  }, [receber])

  return {
    conexao, estado, anterior, programa, erros, executando, aviso, memoria, velocidade,
    montar: (fonte: string, cache: Mapeamento | null) => {
      setAviso(null)
      setExecutando(false)
      enviar({ cmd: 'montar', fonte, cache })
    },
    passo: (unidade: Unidade) => {
      setAviso(null)
      enviar({ cmd: 'passo', unidade })
    },
    executar: () => {
      setAviso(null)
      setExecutando(true)
      enviar({ cmd: 'executar', velocidade })
    },
    pausar: () => enviar({ cmd: 'pausar' }),
    reiniciar: () => {
      setAviso(null)
      setExecutando(false)
      estadoAtual.current = null
      setAnterior(null)
      enviar({ cmd: 'reiniciar' })
      pedirMemoria()
    },
    mudarVelocidade: (valor: number) => {
      setVelocidadeLocal(valor)
      enviar({ cmd: 'velocidade', valor })
    },
    definirBreakpoints: (enderecos: number[]) => enviar({ cmd: 'breakpoints', enderecos }),
    fecharAviso: () => setAviso(null),
  }
}

export type Simulador = ReturnType<typeof useSimulador>
