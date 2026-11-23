"""Memoria cache entre o MIC-1 e a memoria principal.

Tres mapeamentos, todos com 8 linhas de 4 palavras:
    direto       cada bloco so pode ir para uma linha
    associativo  qualquer bloco vai para qualquer linha
    conjunto     4 conjuntos de 2 vias

Escrita com write-back (a memoria so e atualizada quando a linha suja sai da cache)
e substituicao LRU. Um acerto nao custa nada alem dos 2 ciclos normais do MIC-1;
uma falta custa PENALIDADE ciclos de espera, e mais PENALIDADE se precisar devolver
uma linha suja para a memoria.
"""

from dataclasses import dataclass, field

MAPEAMENTOS = ("direto", "associativo", "conjunto")
LINHAS = 8
BLOCO = 4
VIAS_POR_CONJUNTO = 2
PENALIDADE = 4


@dataclass(slots=True)
class Linha:
    valida: bool = False
    suja: bool = False
    tag: int = 0
    uso: int = 0  # instante do ultimo acesso, para o LRU
    dados: list[int] = field(default_factory=lambda: [0] * BLOCO)


class Cache:
    def __init__(self, memoria: list[int], mapeamento: str = "direto"):
        if mapeamento not in MAPEAMENTOS:
            raise ValueError(f"mapeamento desconhecido: {mapeamento}")
        self.memoria = memoria
        self.mapeamento = mapeamento
        self.vias = {"direto": 1, "associativo": LINHAS, "conjunto": VIAS_POR_CONJUNTO}[mapeamento]
        self.conjuntos = LINHAS // self.vias
        self.linhas = [Linha() for _ in range(LINHAS)]
        self.acertos = 0
        self.faltas = 0
        self.devolucoes = 0
        self.relogio = 0
        self.ultimo: dict | None = None

    def _separar(self, endereco: int) -> tuple[int, int, int]:
        bloco, deslocamento = divmod(endereco, BLOCO)
        tag, conjunto = divmod(bloco, self.conjuntos)
        return conjunto, tag, deslocamento

    def _devolver(self, indice: int, conjunto: int):
        linha = self.linhas[indice]
        inicio = (linha.tag * self.conjuntos + conjunto) * BLOCO
        self.memoria[inicio:inicio + BLOCO] = linha.dados
        linha.suja = False
        self.devolucoes += 1

    def acessar(self, endereco: int, escrever: int | None = None) -> tuple[int, int]:
        """Le (ou grava, se escrever nao for None) uma palavra. Devolve (valor, ciclos de espera)."""
        conjunto, tag, deslocamento = self._separar(endereco)
        primeira = conjunto * self.vias
        candidatas = range(primeira, primeira + self.vias)
        self.relogio += 1
        espera = 0

        indice = next((i for i in candidatas if self.linhas[i].valida and self.linhas[i].tag == tag), None)
        acerto = indice is not None
        if acerto:
            self.acertos += 1
        else:
            self.faltas += 1
            # primeiro uma linha vazia; se nao houver, a usada ha mais tempo
            indice = min(candidatas, key=lambda i: (self.linhas[i].valida, self.linhas[i].uso))
            linha = self.linhas[indice]
            if linha.valida and linha.suja:
                self._devolver(indice, conjunto)
                espera += PENALIDADE
            inicio = endereco - deslocamento
            linha.dados = self.memoria[inicio:inicio + BLOCO]
            linha.valida, linha.suja, linha.tag = True, False, tag
            espera += PENALIDADE

        linha = self.linhas[indice]
        linha.uso = self.relogio
        if escrever is not None:
            linha.dados[deslocamento] = escrever
            linha.suja = True
        self.ultimo = {"endereco": endereco, "linha": indice, "acerto": acerto, "espera": espera}
        return linha.dados[deslocamento], espera

    def esvaziar(self) -> list[dict]:
        """Devolve todas as linhas sujas para a memoria (fim do programa)."""
        gravadas = []
        for indice, linha in enumerate(self.linhas):
            if linha.valida and linha.suja:
                conjunto = indice // self.vias
                self._devolver(indice, conjunto)
                inicio = (linha.tag * self.conjuntos + conjunto) * BLOCO
                gravadas += [{"endereco": inicio + i, "valor": v} for i, v in enumerate(linha.dados)]
        return gravadas

    def estado(self) -> dict:
        acessos = self.acertos + self.faltas
        return {
            "mapeamento": self.mapeamento,
            "vias": self.vias,
            "bloco": BLOCO,
            "linhas": [
                {
                    "valida": linha.valida,
                    "suja": linha.suja,
                    "tag": linha.tag,
                    "inicio": (linha.tag * self.conjuntos + i // self.vias) * BLOCO if linha.valida else None,
                    "dados": list(linha.dados),
                }
                for i, linha in enumerate(self.linhas)
            ],
            "acertos": self.acertos,
            "faltas": self.faltas,
            "devolucoes": self.devolucoes,
            "taxa_acerto": round(self.acertos / acessos, 4) if acessos else 0,
            "ultimo": self.ultimo,
        }
