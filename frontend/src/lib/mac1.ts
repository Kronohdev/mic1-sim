// Nomes das instrucoes MAC-1 e o dialeto cavales (docs/cavales.md)

export const MNEMONICOS = [
  'LODD', 'STOD', 'ADDD', 'SUBD', 'JPOS', 'JZER', 'JUMP', 'LOCO', 'LODL', 'STOL', 'ADDL',
  'SUBL', 'JNEG', 'JNZE', 'CALL', 'PSHI', 'POPI', 'PUSH', 'POP', 'RETN', 'SWAP', 'INSP', 'DESP', 'HALT',
]

export const CAVALES: Record<string, string> = {
  LODD: 'pasta', STOD: 'encocheira', ADDD: 'cruza', SUBD: 'apeia', JPOS: 'empina',
  JZER: 'empacou', JUMP: 'trota', LOCO: 'ferra', LODL: 'pasta_na_baia', STOL: 'encocheira_na_baia',
  ADDL: 'cruza_na_baia', SUBL: 'apeia_na_baia', JNEG: 'refuga', JNZE: 'segue_trote', CALL: 'galopa',
  PSHI: 'enfarda_do_pasto', POPI: 'desenfarda_no_pasto', PUSH: 'enfarda', POP: 'desenfarda',
  RETN: 'volta_pra_baia', SWAP: 'troca_de_sela', INSP: 'afrouxa_cilha', DESP: 'aperta_cilha',
  HALT: 'relincha',
}

export const PALAVRAS_CAVALES = new Set(Object.values(CAVALES))

export function emCavales(texto: string) {
  const [mnemonico, ...resto] = texto.split(' ')
  return [CAVALES[mnemonico] ?? mnemonico, ...resto].join(' ')
}

export const hex16 = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, '0')
export const comSinal = (v: number) => (v & 0x8000 ? v - 0x10000 : v)
