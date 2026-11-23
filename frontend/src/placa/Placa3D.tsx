import { OrbitControls, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CampoMir, Estado } from '../tipos'
import {
  ciclosDeEspera, focoDoSubciclo, PECAS, pacotesDoSubciclo, registradoresAtivos, REGISTRADORES, TRILHAS,
  trilhasAtivas,
} from './layout'
import { Chip, PacoteDados, PenteMemoria, Placa, TrilhaCobre } from './Pecas3D'
import { COR, fonteMono } from './visual'

export type Vista = 'geral' | 'dados' | 'controle' | 'memoria' | 'acompanhar'

const VISTAS: Record<Exclude<Vista, 'acompanhar'>, { posicao: [number, number, number]; alvo: [number, number, number] }> = {
  geral: { posicao: [0.3, 19.5, 14.5], alvo: [0.3, 0, -0.2] },
  dados: { posicao: [-3.5, 8.5, 8.2], alvo: [-3.2, 0, -0.9] },
  controle: { posicao: [8.4, 8, 6.5], alvo: [7.4, 0, -1.6] },
  memoria: { posicao: [-12.8, 7.6, 6.8], alvo: [-7.4, 0, -0.6] },
}

const hex = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, '0')

interface Props {
  estado: Estado | null
  anterior: Estado | null
  vista: Vista
  velocidade: number
  executando: boolean
  aoMexerNaCamera: () => void
}

export function Placa3D(props: Props) {
  return (
    <Canvas
      className="placa3d"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ position: VISTAS.geral.posicao, fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#06120f']} />
      <fog attach="fog" args={['#06120f', 26, 48]} />
      <Cena {...props} />
    </Canvas>
  )
}

function Cena({ estado, anterior, vista, velocidade, executando, aoMexerNaCamera }: Props) {
  const ativas = useMemo(() => trilhasAtivas(estado), [estado])
  const regsAtivos = useMemo(() => registradoresAtivos(estado), [estado])
  const componentes = useMemo(() => new Set<string>(estado?.ativos ?? []), [estado])
  const acesso = estado?.memoria_acesso

  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#cfe9e1', '#0a1f1a', 0.45]} />
      <directionalLight position={[6, 14, 8]} intensity={1.4} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14}
        shadow-camera-top={10} shadow-camera-bottom={-10} />

      <Placa />
      {TRILHAS.map((t) => <TrilhaCobre key={t.id} trilha={t} ativa={ativas.has(t.id)} />)}

      {REGISTRADORES.map((peca, i) => (
        <Chip
          key={peca.id}
          peca={peca}
          ativo={regsAtivos.has(i)}
          valor={estado ? hex(estado.registradores[i]) : undefined}
          destaque={!!anterior && anterior.registradores[i] !== estado?.registradores[i]}
        />
      ))}

      {PECAS.map((peca) => {
        if (peca.id === 'memoria') {
          return <PenteMemoria key={peca.id} peca={peca} ativo={componentes.has('memoria')}
            endereco={acesso?.endereco} />
        }
        if (peca.id === 'mir') return <Mir key="mir" estado={estado} ativo={componentes.has('mir')} />
        return (
          <Chip key={peca.id} peca={peca} ativo={componentes.has(peca.id)} valor={valorDaPeca(peca.id, estado)}
            alerta={peca.id === 'cache' && faltaNaCache(estado)} />
        )
      })}

      <Pacotes estado={estado} velocidade={velocidade} executando={executando} />
      <Camera vista={vista} estado={estado} aoMexer={aoMexerNaCamera} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <Vignette darkness={0.6} offset={0.25} />
      </EffectComposer>
    </>
  )
}

const faltaNaCache = (e: Estado | null) => !!e && (e.esperando || e.memoria_acesso?.acerto === false)

function valorCache(e: Estado): string {
  if (!e.cache) return 'desligada'
  if (e.esperando) return `falta: espera ${ciclosDeEspera(e)}`
  if (e.memoria_acesso?.acerto !== undefined) return e.memoria_acesso.acerto ? 'acerto' : 'falta'
  return `${e.cache.mapeamento} ${Math.round(e.cache.taxa_acerto * 100)}%`
}

function valorDaPeca(id: string, e: Estado | null): string | undefined {
  if (!e) return undefined
  switch (id) {
    case 'latch_a': return hex(e.latch_a)
    case 'latch_b': return hex(e.latch_b)
    case 'amux': return e.mir.campos.amux ? 'MBR' : 'latch A'
    case 'ula': return `${['A+B', 'A AND B', 'A', 'NOT A'][e.mir.campos.alu]} = ${hex(e.ula)}  N=${e.n} Z=${e.z}`
    case 'deslocador': return `${['sem desloc.', 'direita', 'esquerda', '?'][e.mir.campos.sh]} = ${hex(e.deslocador)}`
    case 'mar': return e.mar.toString()
    case 'mbr': return hex(e.mbr)
    case 'mpc': return e.mpc.toString()
    case 'mmux': return e.desviou ? 'ADDR' : 'MPC+1'
    case 'logica_microssequenciamento': return ['nunca', 'se N', 'se Z', 'sempre'][e.mir.campos.cond]
    case 'memoria_controle': return `79 × 32 bits`
    case 'decodificador_a': return e.mir.campos.a.toString()
    case 'decodificador_b': return e.mir.campos.b.toString()
    case 'decodificador_c': return e.mir.campos.enc ? e.mir.campos.c.toString() : '-'
    case 'cache': return valorCache(e)
    default: return undefined
  }
}

// ---------------------------------------------------------------- MIR com os campos

const CAMPOS_MIR: { campo: CampoMir; nome: string; bits: number }[] = [
  { campo: 'amux', nome: 'AMUX', bits: 1 }, { campo: 'cond', nome: 'COND', bits: 2 },
  { campo: 'alu', nome: 'ALU', bits: 2 }, { campo: 'sh', nome: 'SH', bits: 2 },
  { campo: 'mbr', nome: 'MBR', bits: 1 }, { campo: 'mar', nome: 'MAR', bits: 1 },
  { campo: 'rd', nome: 'RD', bits: 1 }, { campo: 'wr', nome: 'WR', bits: 1 },
  { campo: 'enc', nome: 'ENC', bits: 1 }, { campo: 'c', nome: 'C', bits: 4 },
  { campo: 'b', nome: 'B', bits: 4 }, { campo: 'a', nome: 'A', bits: 4 },
  { campo: 'addr', nome: 'ADDR', bits: 8 },
]

// posicao de cada campo dentro do MIR, em bits a partir da esquerda
const INICIO_CAMPO = CAMPOS_MIR.map((_, i) => CAMPOS_MIR.slice(0, i).reduce((soma, c) => soma + c.bits, 0))

function Mir({ estado, ativo }: { estado: Estado | null; ativo: boolean }) {
  const peca = PECAS.find((p) => p.id === 'mir')!
  const total = 32
  return (
    <group>
      <Chip peca={{ ...peca, rotulo: '' }} ativo={ativo} />
      {CAMPOS_MIR.map(({ campo, nome, bits }, i) => {
        const largura = (peca.largura - 0.2) * (bits / total)
        const x = peca.x - peca.largura / 2 + 0.1 + (INICIO_CAMPO[i] + bits / 2) * ((peca.largura - 0.2) / total)
        const valor = estado?.mir.campos[campo] ?? 0
        const ligado = ativo && valor !== 0
        return (
          <group key={campo} position={[x, 0, peca.z]}>
            <mesh position={[0, 0.39, 0.02]}>
              <boxGeometry args={[largura - 0.03, 0.03, 0.42]} />
              {ligado
                ? <meshBasicMaterial color={COR.ouro} toneMapped={false} />
                : <meshStandardMaterial color="#1f2a27" />}
            </mesh>
            <Text position={[0, 0.41, -0.28]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.085}
              font={fonteMono} color={COR.serigrafiaFraca} anchorX="center">
              {nome}
            </Text>
            <Text position={[0, 0.415, 0.03]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.12}
              font={fonteMono} color={ligado ? '#0b1512' : COR.serigrafia} anchorX="center" anchorY="middle">
              {valor.toString()}
            </Text>
          </group>
        )
      })}
      <Text position={[peca.x, 0.4, peca.z + 0.55]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.17}
        font={fonteMono} color={ativo ? '#ffd166' : COR.serigrafiaFraca} anchorX="center">
        {estado ? estado.mir.texto : 'MIR'}
      </Text>
    </group>
  )
}

// ---------------------------------------------------------------- pacotes

function Pacotes({ estado, velocidade, executando }: { estado: Estado | null; velocidade: number; executando: boolean }) {
  const { clock } = useThree()

  const ativos = useMemo(() => {
    // em velocidade alta os pacotes nao dariam tempo de aparecer: so as trilhas acendem
    const rapido = executando && (velocidade === 0 || velocidade > 24)
    if (!estado || rapido) return undefined
    return {
      chave: `${estado.ciclo}-${estado.subciclo}`,
      pacotes: pacotesDoSubciclo(estado),
      inicio: clock.elapsedTime,
      duracao: executando ? Math.min(0.85, 0.9 / velocidade) : 0.85,
    }
  }, [estado, velocidade, executando, clock])

  if (!ativos) return null
  return (
    <group>
      {ativos.pacotes.map((p) => (
        <PacoteDados key={`${ativos.chave}-${p.id}`} pacote={p} inicio={ativos.inicio} duracao={ativos.duracao} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- camera

function Camera({ vista, estado, aoMexer }: { vista: Vista; estado: Estado | null; aoMexer: () => void }) {
  const controles = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const animando = useRef(true)
  const alvo = useRef(new THREE.Vector3(...VISTAS.geral.alvo))
  const posicao = useRef(new THREE.Vector3(...VISTAS.geral.posicao))

  useEffect(() => {
    animando.current = true
    if (vista !== 'acompanhar') {
      alvo.current.set(...VISTAS[vista].alvo)
      posicao.current.set(...VISTAS[vista].posicao)
    }
  }, [vista])

  useFrame(({ clock }, dt) => {
    const c = controles.current
    if (!c) return
    if (vista === 'acompanhar') {
      const [x, z] = focoDoSubciclo(estado)
      alvo.current.set(x, 0, z)
      const angulo = Math.sin(clock.elapsedTime * 0.12) * 0.5
      posicao.current.set(x + Math.sin(angulo) * 7.5, 6.8, z + Math.cos(angulo) * 7.5)
      animando.current = true
    }
    if (!animando.current) return
    const k = 1 - Math.exp(-dt * (vista === 'acompanhar' ? 1.6 : 3))
    c.target.lerp(alvo.current, k)
    camera.position.lerp(posicao.current, k)
    c.update()
    if (vista !== 'acompanhar' && camera.position.distanceTo(posicao.current) < 0.02) animando.current = false
  })

  return (
    <OrbitControls
      ref={controles}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={3}
      maxDistance={34}
      onStart={() => {
        animando.current = false
        if (vista === 'acompanhar') aoMexer()
      }}
    />
  )
}

