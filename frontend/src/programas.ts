import aritmetica from '../../programs/01_aritmetica.asm?raw'
import laco from '../../programs/02_laco_soma.asm?raw'
import fibonacci from '../../programs/03_fibonacci.asm?raw'
import subrotina from '../../programs/04_subrotina.asm?raw'
import vetor from '../../programs/05_vetor.asm?raw'
import fibonacciCavales from '../../programs/06_fibonacci.cav?raw'

export interface Exemplo {
  arquivo: string
  titulo: string
  fonte: string
  cavalo?: boolean
}

export const EXEMPLOS: Exemplo[] = [
  { arquivo: '01_aritmetica.asm', titulo: 'Aritmética simples', fonte: aritmetica },
  { arquivo: '02_laco_soma.asm', titulo: 'Soma de 1 a N', fonte: laco },
  { arquivo: '03_fibonacci.asm', titulo: 'Fibonacci', fonte: fibonacci },
  { arquivo: '04_subrotina.asm', titulo: 'Sub-rotina (6 × 7)', fonte: subrotina },
  { arquivo: '05_vetor.asm', titulo: 'Soma e máximo de um vetor', fonte: vetor },
  { arquivo: '06_fibonacci.cav', titulo: 'Fibonacci em cavalês', fonte: fibonacciCavales, cavalo: true },
]
