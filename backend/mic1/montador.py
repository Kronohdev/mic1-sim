"""Montador MAC-1 de duas passadas.

Sintaxe:
    rotulo: INSTRUCAO operando   ; comentario
    var:    .word 10              ; um ou mais valores separados por virgula
    vetor:  .space 16             ; reserva 16 palavras zeradas
    HALT                          ; vira JUMP para o proprio endereco

Nomes usados em LODD/STOD/ADDD/SUBD que nao foram declarados viram variaveis
automaticas, alocadas logo depois da ultima palavra do programa.
Tambem aceita o dialeto cavales (docs/cavales.md).
"""

import re
from dataclasses import dataclass, field

# instrucoes com operando de 12 bits: opcode nos 4 bits de cima
COM_ENDERECO = {
    "LODD": 0x0, "STOD": 0x1, "ADDD": 0x2, "SUBD": 0x3, "JPOS": 0x4, "JZER": 0x5,
    "JUMP": 0x6, "LOCO": 0x7, "LODL": 0x8, "STOL": 0x9, "ADDL": 0xA, "SUBL": 0xB,
    "JNEG": 0xC, "JNZE": 0xD, "CALL": 0xE,
}
SEM_OPERANDO = {
    "PSHI": 0xF000, "POPI": 0xF200, "PUSH": 0xF400, "POP": 0xF600,
    "RETN": 0xF800, "SWAP": 0xFA00,
}
COM_OPERANDO_8 = {"INSP": 0xFC00, "DESP": 0xFE00}

# nomes nao declarados nessas instrucoes viram variaveis
ACESSO_DIRETO = {"LODD", "STOD", "ADDD", "SUBD"}

CAVALES = {
    "pasta": "LODD", "encocheira": "STOD", "cruza": "ADDD", "apeia": "SUBD",
    "empina": "JPOS", "empacou": "JZER", "trota": "JUMP", "ferra": "LOCO",
    "pasta_na_baia": "LODL", "encocheira_na_baia": "STOL", "cruza_na_baia": "ADDL",
    "apeia_na_baia": "SUBL", "refuga": "JNEG", "segue_trote": "JNZE", "galopa": "CALL",
    "enfarda_do_pasto": "PSHI", "desenfarda_no_pasto": "POPI", "enfarda": "PUSH",
    "desenfarda": "POP", "volta_pra_baia": "RETN", "troca_de_sela": "SWAP",
    "afrouxa_cilha": "INSP", "aperta_cilha": "DESP", "relincha": "HALT",
    ".fardo": ".word", ".baias": ".space",
}


class ErroMontagem(Exception):
    pass


@dataclass
class Erro:
    linha: int
    mensagem: str


class ErrosDeMontagem(Exception):
    def __init__(self, erros: list[Erro]):
        super().__init__(f"{len(erros)} erro(s) de montagem")
        self.erros = erros


@dataclass
class Programa:
    palavras: list[int]
    simbolos: dict[str, int]
    linhas: dict[int, int]          # endereco -> linha do fonte
    variaveis: list[str] = field(default_factory=list)


@dataclass
class _Linha:
    numero: int
    rotulos: list[str]
    mnemonico: str | None
    operandos: list[str]


def _numero(texto: str) -> int | None:
    texto = texto.strip()
    if re.fullmatch(r"-?(0x[0-9a-fA-F]+|0b[01]+|\d+)", texto):
        return int(texto, 0)
    return None


def _quebrar(texto: str, numero: int) -> _Linha:
    texto = re.split(r"[;#]", texto, maxsplit=1)[0].strip()
    rotulos = []
    while m := re.match(r"([A-Za-z_]\w*)\s*:", texto):
        rotulos.append(m.group(1))
        texto = texto[m.end():].strip()
    if not texto:
        return _Linha(numero, rotulos, None, [])
    partes = texto.split(None, 1)
    mnemonico = CAVALES.get(partes[0].lower(), partes[0])
    mnemonico = mnemonico.lower() if mnemonico.startswith(".") else mnemonico.upper()
    operandos = [o.strip() for o in partes[1].split(",")] if len(partes) > 1 else []
    return _Linha(numero, rotulos, mnemonico, operandos)


def _tamanho(linha: _Linha) -> int:
    if linha.mnemonico is None:
        return 0
    if linha.mnemonico == ".word":
        return max(1, len(linha.operandos))
    if linha.mnemonico == ".space":
        n = _numero(linha.operandos[0]) if linha.operandos else None
        if n is None or n < 1:
            raise ErroMontagem(".space precisa de uma quantidade positiva")
        return n
    return 1


def _conferir_operandos(operandos: list[str], quantidade: int, mnemonico: str):
    if len(operandos) == quantidade:
        return
    if quantidade == 0:
        raise ErroMontagem(f"{mnemonico} nao tem operando")
    raise ErroMontagem(f"{mnemonico} precisa de {quantidade} operando")


def _codificar(mnemonico: str, operandos: list[str], endereco: int, resolver) -> int:
    if mnemonico == "HALT":
        _conferir_operandos(operandos, 0, mnemonico)
        return (COM_ENDERECO["JUMP"] << 12) | endereco
    if mnemonico in COM_ENDERECO:
        _conferir_operandos(operandos, 1, mnemonico)
        return (COM_ENDERECO[mnemonico] << 12) | resolver(operandos[0], mnemonico, 12)
    if mnemonico in SEM_OPERANDO:
        _conferir_operandos(operandos, 0, mnemonico)
        return SEM_OPERANDO[mnemonico]
    if mnemonico in COM_OPERANDO_8:
        _conferir_operandos(operandos, 1, mnemonico)
        return COM_OPERANDO_8[mnemonico] | resolver(operandos[0], mnemonico, 8)
    raise ErroMontagem(f"instrucao desconhecida '{mnemonico}'")


def montar(fonte: str) -> Programa:
    linhas = [_quebrar(texto, i + 1) for i, texto in enumerate(fonte.splitlines())]
    erros: list[Erro] = []
    simbolos: dict[str, int] = {}
    onde: dict[str, int] = {}

    # primeira passada: enderecos dos rotulos
    endereco = 0
    for linha in linhas:
        try:
            for rotulo in linha.rotulos:
                if rotulo in simbolos:
                    raise ErroMontagem(f"rotulo '{rotulo}' repetido (ja definido na linha {onde[rotulo]})")
                simbolos[rotulo] = endereco
                onde[rotulo] = linha.numero
            endereco += _tamanho(linha)
        except ErroMontagem as e:
            erros.append(Erro(linha.numero, str(e)))

    fim_do_programa = endereco
    variaveis: list[str] = []

    def resolver(nome: str, mnemonico: str, bits: int) -> int:
        valor = _numero(nome)
        if valor is None:
            if not re.fullmatch(r"[A-Za-z_]\w*", nome):
                raise ErroMontagem(f"operando invalido '{nome}'")
            if nome not in simbolos:
                if mnemonico not in ACESSO_DIRETO:
                    raise ErroMontagem(f"rotulo '{nome}' nao existe")
                simbolos[nome] = fim_do_programa + len(variaveis)
                variaveis.append(nome)
            valor = simbolos[nome]
        if not 0 <= valor < (1 << bits):
            raise ErroMontagem(f"{mnemonico} aceita de 0 a {(1 << bits) - 1}, recebeu {valor}")
        return valor

    # segunda passada: codificacao
    palavras: list[int] = []
    mapa_linhas: dict[int, int] = {}
    for linha in linhas:
        m = linha.mnemonico
        if m is None:
            continue
        try:
            ops = linha.operandos
            if m == ".word":
                for op in ops or ["0"]:
                    valor = _numero(op)
                    if valor is None:
                        valor = resolver(op, ".word", 12)
                    if not -32768 <= valor <= 65535:
                        raise ErroMontagem(f"valor {valor} nao cabe em 16 bits")
                    palavras.append(valor & 0xFFFF)
                continue
            if m == ".space":
                palavras.extend([0] * _tamanho(linha))
                continue

            mapa_linhas[len(palavras)] = linha.numero
            palavras.append(_codificar(m, ops, len(palavras), resolver))
        except ErroMontagem as e:
            erros.append(Erro(linha.numero, str(e)))
            palavras.append(0)

    palavras.extend([0] * len(variaveis))
    if len(palavras) > 4096:
        erros.append(Erro(0, f"o programa ocupa {len(palavras)} palavras e a memoria tem 4096"))
    if erros:
        raise ErrosDeMontagem(erros)
    return Programa(palavras, simbolos, mapa_linhas, variaveis)


_NOME_DO_OPCODE = {opcode: nome for nome, opcode in COM_ENDERECO.items()}
_NOME_DO_CODIGO = {codigo: nome for nome, codigo in (SEM_OPERANDO | COM_OPERANDO_8).items()}


def desmontar(palavra: int) -> str:
    opcode = palavra >> 12
    if opcode != 0xF:
        return f"{_NOME_DO_OPCODE[opcode]} {palavra & 0x0FFF}"
    nome = _NOME_DO_CODIGO.get(palavra & 0xFE00, "?")  # o bit 8 nao faz parte do codigo
    return f"{nome} {palavra & 0xFF}" if nome in COM_OPERANDO_8 else nome
