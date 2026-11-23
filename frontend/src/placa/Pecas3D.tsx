import { Billboard, Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { type Pacote, type Peca, PLACA, type Ponto, type Trilha } from './layout'
import { COR, fonteMono, fonteTitulo, TOPO, VIAS } from './visual'



export function Placa() {

  return (
    <group>
      <mesh position={[PLACA.x, 0, PLACA.z]} receiveShadow>
        <boxGeometry args={[PLACA.largura, TOPO * 2, PLACA.profundidade]} />
        <meshStandardMaterial color={COR.mascara} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[PLACA.x, -0.25, PLACA.z]}>
        <boxGeometry args={[PLACA.largura + 0.4, 0.2, PLACA.profundidade + 0.4]} />
        <meshStandardMaterial color={COR.borda} roughness={0.9} />
      </mesh>
      {VIAS.map(([x, z], i) => (
        <mesh key={i} position={[x, TOPO + 0.002, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.075, 12]} />
          <meshStandardMaterial color={COR.pino} metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <Serigrafia texto="MIC-1" x={-9.4} z={4.75} tamanho={0.9} fonte={fonteTitulo} />
      <Serigrafia texto="CAMINHO DE DADOS" x={-3.6} z={5.15} tamanho={0.32} />
      <Serigrafia texto="UNIDADE DE CONTROLE" x={7.6} z={5.15} tamanho={0.32} />
      <Serigrafia texto="BARRAMENTO C" x={-10.35} z={-4.35} tamanho={0.17} alinhar="right" />
      <Serigrafia texto="BARRAMENTO A" x={-10.35} z={-3.75} tamanho={0.17} alinhar="right" />
      <Serigrafia texto="BARRAMENTO B" x={-10.35} z={-3.15} tamanho={0.17} alinhar="right" />
    </group>
  )
}

function Serigrafia(props: {
  texto: string; x: number; z: number; tamanho: number; fonte?: string; alinhar?: 'left' | 'right' | 'center'
}) {
  return (
    <Text
      position={[props.x, TOPO + 0.005, props.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={props.tamanho}
      font={props.fonte ?? fonteMono}
      color={COR.serigrafiaFraca}
      anchorX={props.alinhar ?? 'center'}
      anchorY="middle"
      letterSpacing={0.08}
    >
      {props.texto}
    </Text>
  )
}

// ---------------------------------------------------------------- trilhas

// memo: com ~100 trilhas na placa, so as que mudaram de estado sao redesenhadas
export const TrilhaCobre = memo(function TrilhaCobre({ trilha, ativa }: { trilha: Trilha; ativa: boolean }) {
  const largura = trilha.grossa ? 0.13 : trilha.controle ? 0.04 : 0.07
  const segmentos = useMemo(() => {
    const lista: { x: number; z: number; comprimento: number; angulo: number }[] = []
    for (let i = 0; i < trilha.pontos.length - 1; i++) {
      const [x1, z1] = trilha.pontos[i]
      const [x2, z2] = trilha.pontos[i + 1]
      lista.push({
        x: (x1 + x2) / 2,
        z: (z1 + z2) / 2,
        comprimento: Math.hypot(x2 - x1, z2 - z1) + largura,
        angulo: Math.atan2(-(z2 - z1), x2 - x1),
      })
    }
    return lista
  }, [trilha, largura])

  const apagada = trilha.controle ? COR.controleApagado : COR.cobreApagado
  const acesa = trilha.controle ? COR.ouro : COR.cobre
  return (
    <group>
      {segmentos.map((s, i) => (
        <mesh key={i} position={[s.x, TOPO + (ativa ? 0.02 : 0.012), s.z]} rotation={[0, s.angulo, 0]}>
          <boxGeometry args={[s.comprimento, 0.02, largura]} />
          {ativa ? (
            <meshBasicMaterial color={acesa} toneMapped={false} />
          ) : (
            <meshStandardMaterial color={apagada} metalness={0.6} roughness={0.45} />
          )}
        </mesh>
      ))}
    </group>
  )
})

// ---------------------------------------------------------------- chips

function formaUla(largura: number, profundidade: number) {
  // o "V" classico da ULA visto de cima: entradas no fundo, saida na frente
  const l = largura / 2
  const p = profundidade / 2
  const s = new THREE.Shape()
  s.moveTo(-l, -p)
  s.lineTo(-0.18, -p)
  s.lineTo(0, -p + 0.28)
  s.lineTo(0.18, -p)
  s.lineTo(l, -p)
  s.lineTo(l * 0.62, p)
  s.lineTo(-l * 0.62, p)
  s.closePath()
  return s
}

function formaMux(largura: number, profundidade: number) {
  const l = largura / 2
  const p = profundidade / 2
  const s = new THREE.Shape()
  s.moveTo(-l, -p)
  s.lineTo(l, -p)
  s.lineTo(l * 0.7, p)
  s.lineTo(-l * 0.7, p)
  s.closePath()
  return s
}

export const Chip = memo(function Chip(props: {
  peca: Peca
  ativo: boolean
  valor?: string
  destaque?: boolean // valor acabou de mudar
  alerta?: boolean // falta na cache
}) {
  const { peca, ativo, valor, destaque, alerta } = props
  const altura = peca.altura ?? 0.22
  const y = TOPO + altura / 2

  const geometria = useMemo(() => {
    if (peca.forma !== 'ula' && peca.forma !== 'mux') return null
    const shape = peca.forma === 'ula'
      ? formaUla(peca.largura, peca.profundidade)
      : formaMux(peca.largura, peca.profundidade)
    const g = new THREE.ExtrudeGeometry(shape, { depth: altura, bevelEnabled: false })
    g.rotateX(Math.PI / 2)
    g.translate(0, altura / 2, 0)
    return g
  }, [peca, altura])

  const corpo = (
    <meshStandardMaterial
      color={COR.chip}
      roughness={0.45}
      metalness={0.15}
      emissive={alerta ? '#ff3b2f' : ativo ? '#ff7a1a' : '#000000'}
      emissiveIntensity={alerta ? 0.45 : ativo ? 0.18 : 0}
    />
  )
  const contorno = alerta ? COR.falha : ativo ? COR.cobre : '#2a3a36'

  return (
    <group position={[peca.x, 0, peca.z]}>
      {geometria ? (
        <mesh geometry={geometria} position={[0, y, 0]} castShadow>
          {corpo}
          <Edges color={contorno} threshold={15} />
        </mesh>
      ) : (
        <mesh position={[0, y, 0]} castShadow>
          <boxGeometry args={[peca.largura, altura, peca.profundidade]} />
          {corpo}
          <Edges color={contorno} />
        </mesh>
      )}
      {!peca.forma && peca.largura >= 1 && <Pinos peca={peca} />}
      <Text
        position={[0, TOPO + altura + 0.003, valor && peca.profundidade >= 0.6 ? -0.1 : 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={Math.min(0.24, peca.largura / 5.2)}
        font={fonteTitulo}
        color={COR.serigrafia}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
      >
        {peca.rotulo.toUpperCase()}
      </Text>
      {valor && (
        <Text
          position={[0, TOPO + altura + 0.003, peca.profundidade >= 0.6 ? 0.17 : peca.profundidade / 2 + 0.16]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.15}
          font={fonteMono}
          color={destaque || ativo ? '#ffd166' : COR.serigrafiaFraca}
          anchorX="center"
          anchorY="middle"
        >
          {valor}
        </Text>
      )}
    </group>
  )
})

function Pinos({ peca }: { peca: Peca }) {
  const quantidade = Math.max(2, Math.floor(peca.largura / 0.32))
  const passo = peca.largura / (quantidade + 1)
  return (
    <group>
      {Array.from({ length: quantidade }, (_, i) => {
        const x = -peca.largura / 2 + passo * (i + 1)
        return [-1, 1].map((lado) => (
          <mesh key={`${i}${lado}`} position={[x, TOPO + 0.03, lado * (peca.profundidade / 2 + 0.06)]}>
            <boxGeometry args={[0.07, 0.04, 0.14]} />
            <meshStandardMaterial color={COR.pino} metalness={0.85} roughness={0.3} />
          </mesh>
        ))
      })}
    </group>
  )
}

export function PenteMemoria(props: { peca: Peca; ativo: boolean; endereco?: number }) {
  const { peca, ativo, endereco } = props
  const altura = peca.altura ?? 0.9
  return (
    <group position={[peca.x, 0, peca.z]}>
      {/* encaixe */}
      <mesh position={[0, TOPO + 0.12, 0]}>
        <boxGeometry args={[0.45, 0.24, peca.profundidade + 0.3]} />
        <meshStandardMaterial color="#1d1f22" roughness={0.6} />
      </mesh>
      {/* placa do modulo em pe */}
      <mesh position={[0, TOPO + 0.24 + altura / 2, 0]}>
        <boxGeometry args={[0.08, altura, peca.profundidade]} />
        <meshStandardMaterial color="#14523f" roughness={0.6} />
      </mesh>
      {[-1.5, -0.5, 0.5, 1.5].map((dz) => (
        <mesh key={dz} position={[0.08, TOPO + 0.24 + altura / 2, dz * (peca.profundidade / 4.4)]}>
          <boxGeometry args={[0.06, altura * 0.55, peca.profundidade / 5]} />
          <meshStandardMaterial
            color={COR.chip}
            emissive={ativo ? '#ff7a1a' : '#000'}
            emissiveIntensity={ativo ? 0.5 : 0}
          />
          <Edges color={ativo ? COR.cobre : '#2a3a36'} />
        </mesh>
      ))}
      {/* contatos dourados */}
      <mesh position={[0, TOPO + 0.27, 0]}>
        <boxGeometry args={[0.1, 0.06, peca.profundidade - 0.2]} />
        <meshStandardMaterial color={COR.pino} metalness={0.9} roughness={0.25} />
      </mesh>
      <Billboard position={[0, TOPO + altura + 0.55, 0]}>
        <Text fontSize={0.22} font={fonteTitulo} color={COR.serigrafia} anchorX="center">
          MEMÓRIA
        </Text>
        <Text position={[0, -0.26, 0]} fontSize={0.13} font={fonteMono} color={ativo ? '#ffd166' : COR.serigrafiaFraca}
          anchorX="center">
          {endereco !== undefined ? `[${endereco}]` : '4096 × 16'}
        </Text>
      </Billboard>
    </group>
  )
}

// ---------------------------------------------------------------- pacotes de dados

function pontoNoCaminho(caminho: Ponto[], t: number): Ponto {
  const comprimentos = caminho.slice(1).map((p, i) => Math.hypot(p[0] - caminho[i][0], p[1] - caminho[i][1]))
  const total = comprimentos.reduce((a, b) => a + b, 0)
  let alvo = t * total
  for (let i = 0; i < comprimentos.length; i++) {
    if (alvo <= comprimentos[i] || i === comprimentos.length - 1) {
      const f = comprimentos[i] ? Math.min(1, alvo / comprimentos[i]) : 1
      return [
        caminho[i][0] + (caminho[i + 1][0] - caminho[i][0]) * f,
        caminho[i][1] + (caminho[i + 1][1] - caminho[i][1]) * f,
      ]
    }
    alvo -= comprimentos[i]
  }
  return caminho[caminho.length - 1]
}

export function PacoteDados({ pacote, duracao, inicio }: { pacote: Pacote; duracao: number; inicio: number }) {
  const grupo = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!grupo.current) return
    const t = Math.min(1, (clock.elapsedTime - inicio) / duracao)
    const suave = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const [x, z] = pontoNoCaminho(pacote.caminho, suave)
    grupo.current.position.set(x, TOPO + 0.18, z)
  })
  const [x0, z0] = pacote.caminho[0]
  return (
    <group ref={grupo} position={[x0, TOPO + 0.18, z0]}>
      <mesh>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial color={COR.ouro} toneMapped={false} />
      </mesh>
      <pointLight color="#ffb347" intensity={1.6} distance={2.2} />
      <Billboard position={[0, 0.38, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[0.12 * pacote.valor.length + 0.18, 0.3]} />
          <meshBasicMaterial color="#0b1512" transparent opacity={0.82} />
        </mesh>
        <Text fontSize={0.19} font={fonteMono} color="#ffd166" anchorX="center" anchorY="middle">
          {pacote.valor}
        </Text>
      </Billboard>
    </group>
  )
}
