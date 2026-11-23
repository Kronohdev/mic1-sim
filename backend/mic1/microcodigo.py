"""Microprograma do MIC-1 (Tanenbaum) e o montador de MAL usado para gerar a memoria de controle.

Formato da microinstrucao, do bit 31 ao bit 0:

    AMUX(1) COND(2) ALU(2) SH(2) MBR(1) MAR(1) RD(1) WR(1) ENC(1) C(4) B(4) A(4) ADDR(8)
"""

import re
from dataclasses import dataclass

NOMES_REGISTRADORES = [
    "pc", "ac", "sp", "ir", "tir", "0", "+1", "-1",
    "amask", "smask", "a", "b", "c", "d", "e", "f",
]

# (nome, bit menos significativo, largura)
CAMPOS = [
    ("amux", 31, 1), ("cond", 29, 2), ("alu", 27, 2), ("sh", 25, 2),
    ("mbr", 24, 1), ("mar", 23, 1), ("rd", 22, 1), ("wr", 21, 1), ("enc", 20, 1),
    ("c", 16, 4), ("b", 12, 4), ("a", 8, 4), ("addr", 0, 8),
]

# Os 79 passos do livro (Organizacao Estruturada de Computadores, fig. 4-16)
MICROPROGRAMA = """
mar:=pc; rd;
pc:=pc + 1; rd;
ir:=mbr; if n then goto 28;
tir:=lshift(ir + ir); if n then goto 19;
tir:=lshift(tir); if n then goto 11;
alu:=tir; if n then goto 9;
mar:=ir; rd;
rd;
ac:=mbr; goto 0;
mar:=ir; mbr:=ac; wr;
wr; goto 0;
alu:=tir; if n then goto 15;
mar:=ir; rd;
rd;
ac:=mbr + ac; goto 0;
mar:=ir; rd;
ac:=ac + 1; rd;
a:=inv(mbr);
ac:=ac + a; goto 0;
tir:=lshift(tir); if n then goto 25;
alu:=tir; if n then goto 23;
alu:=ac; if n then goto 0;
pc:=band(ir, amask); goto 0;
alu:=ac; if z then goto 22;
goto 0;
alu:=tir; if n then goto 27;
pc:=band(ir, amask); goto 0;
ac:=band(ir, amask); goto 0;
tir:=lshift(ir + ir); if n then goto 40;
tir:=lshift(tir); if n then goto 35;
alu:=tir; if n then goto 33;
a:=ir + sp;
mar:=a; rd; goto 7;
a:=ir + sp;
mar:=a; mbr:=ac; wr; goto 10;
alu:=tir; if n then goto 38;
a:=ir + sp;
mar:=a; rd; goto 13;
a:=ir + sp;
mar:=a; rd; goto 16;
tir:=lshift(tir); if n then goto 46;
alu:=tir; if n then goto 44;
alu:=ac; if n then goto 22;
goto 0;
alu:=ac; if z then goto 0;
pc:=band(ir, amask); goto 0;
tir:=lshift(tir); if n then goto 50;
sp:=sp + (-1);
mar:=sp; mbr:=pc; wr;
pc:=band(ir, amask); wr; goto 0;
tir:=lshift(tir); if n then goto 65;
tir:=lshift(tir); if n then goto 59;
alu:=tir; if n then goto 56;
mar:=ac; rd;
sp:=sp + (-1); rd;
mar:=sp; wr; goto 10;
mar:=sp; sp:=sp + 1; rd;
rd;
mar:=ac; wr; goto 10;
alu:=tir; if n then goto 62;
sp:=sp + (-1);
mar:=sp; mbr:=ac; wr; goto 10;
mar:=sp; sp:=sp + 1; rd;
rd;
ac:=mbr; goto 0;
tir:=lshift(tir); if n then goto 73;
alu:=tir; if n then goto 70;
mar:=sp; sp:=sp + 1; rd;
rd;
pc:=mbr; goto 0;
a:=ac;
ac:=sp;
sp:=a; goto 0;
alu:=tir; if n then goto 76;
a:=band(ir, smask);
sp:=sp + a; goto 0;
a:=band(ir, smask);
a:=inv(a);
a:=a + 1; goto 75;
"""


class ErroMicrocodigo(Exception):
    pass


@dataclass(frozen=True, slots=True)
class Microinstrucao:
    """Uma palavra da memoria de controle, com os campos ja separados."""

    palavra: int
    texto: str
    amux: int
    cond: int
    alu: int
    sh: int
    mbr: int
    mar: int
    rd: int
    wr: int
    enc: int
    c: int
    b: int
    a: int
    addr: int

    @classmethod
    def decodificar(cls, palavra: int, texto: str = "") -> "Microinstrucao":
        campos = {nome: (palavra >> lsb) & ((1 << largura) - 1) for nome, lsb, largura in CAMPOS}
        return cls(palavra, texto, **campos)

    def campos(self) -> dict[str, int]:
        return {nome: getattr(self, nome) for nome, _, _ in CAMPOS}


def codificar(campos: dict[str, int]) -> int:
    palavra = 0
    for nome, lsb, largura in CAMPOS:
        valor = campos.get(nome, 0)
        if valor >> largura:
            raise ErroMicrocodigo(f"campo {nome} nao cabe em {largura} bits: {valor}")
        palavra |= valor << lsb
    return palavra


def _operando(texto: str) -> str:
    texto = texto.strip().strip("()").strip()
    texto = "+1" if texto == "1" else texto
    if texto not in NOMES_REGISTRADORES and texto != "mbr":
        raise ErroMicrocodigo(f"operando desconhecido: {texto}")
    return texto


def _expressao(expr: str) -> tuple[int, int, list[str]]:
    """Devolve (deslocamento, operacao da ULA, operandos) de uma expressao MAL."""
    sh = 0
    if m := re.fullmatch(r"(lshift|rshift)\((.*)\)", expr.strip()):
        sh = 2 if m[1] == "lshift" else 1
        expr = m[2]
    expr = expr.strip()
    if m := re.fullmatch(r"band\((.*),(.*)\)", expr):
        return sh, 1, [_operando(m[1]), _operando(m[2])]
    if m := re.fullmatch(r"inv\((.*)\)", expr):
        return sh, 3, [_operando(m[1])]
    if "+" in expr:
        return sh, 0, [_operando(p) for p in expr.split("+", 1)]
    return sh, 2, [_operando(expr)]


def montar_linha(linha: str) -> int:
    campos = {"alu": 2}
    origem_mar = None
    expressao = None

    for comando in filter(None, (c.strip() for c in linha.split(";"))):
        if comando in ("rd", "wr"):
            campos[comando] = 1
        elif m := re.fullmatch(r"(?:if ([nz]) then )?goto (\d+)", comando):
            campos["cond"] = {"n": 1, "z": 2, None: 3}[m[1]]
            campos["addr"] = int(m[2])
        elif m := re.fullmatch(r"(\w+):=(.+)", comando):
            destino, valor = m[1], m[2]
            if destino == "mar":
                origem_mar = _operando(valor)
                campos["mar"] = 1
                continue
            if destino == "mbr":
                campos["mbr"] = 1
            elif destino != "alu":
                campos["enc"] = 1
                campos["c"] = NOMES_REGISTRADORES.index(_operando(destino))
            if expressao not in (None, valor):
                raise ErroMicrocodigo(f"duas expressoes diferentes na ULA: {linha}")
            expressao = valor
        else:
            raise ErroMicrocodigo(f"comando invalido: {comando}")

    usa_b = False
    if expressao is not None:
        campos["sh"], campos["alu"], operandos = _expressao(expressao)
        esq = operandos[0]
        if len(operandos) == 2:
            esq, dir_ = operandos
            # a soma e comutativa: o MBR so entra pelo AMUX, e o operando do MAR vai pelo B
            if campos["alu"] == 0 and (dir_ == "mbr" or (origem_mar == esq != dir_)):
                esq, dir_ = dir_, esq
            if dir_ == "mbr":
                raise ErroMicrocodigo(f"mbr so entra pelo AMUX: {linha}")
            campos["b"] = NOMES_REGISTRADORES.index(dir_)
            usa_b = True
        if esq == "mbr":
            campos["amux"] = 1
        else:
            campos["a"] = NOMES_REGISTRADORES.index(esq)

    if origem_mar is not None:
        b = NOMES_REGISTRADORES.index(origem_mar)
        if usa_b and campos["b"] != b:
            raise ErroMicrocodigo(f"barramento B disputado entre MAR e ULA: {linha}")
        campos["b"] = b

    return codificar(campos)


def montar_microprograma(fonte: str = MICROPROGRAMA) -> list[Microinstrucao]:
    linhas = [linha.strip() for linha in fonte.strip().splitlines() if linha.strip()]
    return [Microinstrucao.decodificar(montar_linha(linha), linha) for linha in linhas]


MEMORIA_DE_CONTROLE = montar_microprograma()
