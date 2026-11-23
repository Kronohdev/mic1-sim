import * as THREE from 'three'
import fonteMono from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url'
import fonteTitulo from '@fontsource/big-shoulders-display/files/big-shoulders-display-latin-800-normal.woff?url'
import { PLACA } from './layout'

export { fonteMono, fonteTitulo }

export const COR = {
  mascara: '#0c3a31',
  borda: '#082a23',
  cobreApagado: '#2c6a55',
  controleApagado: '#235748',
  cobre: new THREE.Color('#ff9a3c').multiplyScalar(2.6),
  ouro: new THREE.Color('#ffd166').multiplyScalar(2.2),
  falha: new THREE.Color('#ff4b3a').multiplyScalar(2.4),
  serigrafia: '#e8e6dc',
  serigrafiaFraca: '#8fb3a8',
  chip: '#15181b',
  pino: '#c9a24a',
}

export const TOPO = 0.15 // altura da superficie da placa

// furos decorativos da placa, em posicoes fixas (gerador simples com semente)
function gerarVias(quantidade: number): [number, number][] {
  let semente = 7
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647
    return semente / 2147483647
  }
  return Array.from({ length: quantidade }, () => [
    PLACA.x + (aleatorio() - 0.5) * (PLACA.largura - 0.8),
    PLACA.z + (aleatorio() - 0.5) * (PLACA.profundidade - 0.8),
  ])
}

export const VIAS = gerarVias(140)
