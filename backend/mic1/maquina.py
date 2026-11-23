"""Caminho de dados e unidade de controle do MIC-1, simulados subciclo a subciclo.

Cada ciclo de clock tem 4 subciclos:
  1. carrega o MIR com a microinstrucao apontada pelo MPC
  2. carrega os latches A e B com os registradores escolhidos
  3. AMUX, ULA e deslocador calculam; o MAR pode ser carregado com o latch B
  4. o barramento C grava no registrador destino, o MBR pode ser carregado,
     a memoria avanca e o MPC recebe o proximo endereco

Leitura e escrita levam 2 ciclos: RD (ou WR) precisa ficar ligado em duas
microinstrucoes seguidas, e o dado so fica pronto no fim da segunda. Com cache,
uma falta acrescenta ciclos de espera em que o caminho de dados fica parado.
"""

import time

from .cache import Cache
from .microcodigo import MEMORIA_DE_CONTROLE, NOMES_REGISTRADORES

TAMANHO_MEMORIA = 4096
MASCARA = 0xFFFF
SP_INICIAL = 4096  # o primeiro PUSH grava na posicao 4095
PC, AC, SP, IR = 0, 1, 2, 3
OPCODE_JUMP = 0x6
CONSTANTES = range(5, 10)  # 0, +1, -1, AMASK, SMASK

ATIVOS_1 = ("mpc", "memoria_controle", "mir")
ATIVOS_2 = ("mir", "decodificador_a", "decodificador_b", "registradores",
            "barramento_a", "barramento_b", "latch_a", "latch_b")
ATIVOS_ESPERA = ("cache", "memoria")


class ErroSimulacao(Exception):
    pass


def ula(operacao: int, a: int, b: int) -> int:
    if operacao == 0:
        return (a + b) & MASCARA
    if operacao == 1:
        return a & b
    if operacao == 2:
        return a
    return ~a & MASCARA


def deslocador(sh: int, valor: int) -> int:
    if sh == 1:
        return valor >> 1
    if sh == 2:
        return (valor << 1) & MASCARA
    return valor


class Mic1:
    def __init__(self, programa=(), linhas=None, cache: str | None = None):
        self.programa = list(programa)
        self.linhas = linhas or {}
        self.mapeamento = cache
        self.breakpoints: set[int] = set()
        self.reiniciar()

    def reiniciar(self):
        self.memoria = [0] * TAMANHO_MEMORIA
        self.memoria[:len(self.programa)] = [p & MASCARA for p in self.programa]
        self.cache = Cache(self.memoria, self.mapeamento) if self.mapeamento else None

        self.registradores = [0] * 16
        self.registradores[SP] = SP_INICIAL
        self.registradores[5:10] = [0, 1, MASCARA, 0x0FFF, 0x00FF]

        self.mar = self.mbr = 0
        self.latch_a = self.latch_b = 0
        self.saida_amux = self.saida_ula = self.saida_deslocador = 0
        self.n, self.z = 0, 1

        self.mpc = 0
        self.mir = MEMORIA_DE_CONTROLE[0]
        self.desviou = False
        self.subciclo = 0          # ultimo subciclo executado (0 = nenhum)
        self.lendo = self.escrevendo = False  # RD/WR ligado no ciclo anterior
        self.espera = 0            # ciclos de espera que faltam (falta na cache)
        self.parado = False

        self.ciclos = self.instrucoes = self.leituras = self.escritas = self.ciclos_espera = 0
        self.tempo = 0.0
        self.endereco_buscado = 0       # endereco da instrucao que esta vindo da memoria
        self.endereco_instrucao = None  # endereco da instrucao que esta no IR
        self.acesso = None
        self.escritas_pendentes: list[dict] = []  # o servidor recolhe com coletar_escritas()
        self.ativos: tuple[str, ...] = ()

    # ------------------------------------------------------------------ execucao

    @property
    def inicio_de_instrucao(self) -> bool:
        return self.subciclo in (0, 4) and self.mpc == 0 and not self.espera

    def passo_subciclo(self):
        if self.parado:
            return
        inicio = time.perf_counter()
        self.acesso = None
        self.subciclo = self.subciclo % 4 + 1
        if self.espera:
            self._esperando()
        else:
            (self._subciclo1, self._subciclo2, self._subciclo3, self._subciclo4)[self.subciclo - 1]()
        self.tempo += time.perf_counter() - inicio

    def passo_ciclo(self):
        self.passo_subciclo()
        while self.subciclo != 4 and not self.parado:
            self.passo_subciclo()

    def passo_instrucao(self):
        self.passo_ciclo()
        while (self.mpc != 0 or self.espera) and not self.parado:
            self.passo_ciclo()

    def _esperando(self):
        # o caminho de dados fica parado enquanto o bloco vem da memoria
        self.ativos = ATIVOS_ESPERA
        if self.subciclo == 4:
            self.espera -= 1
            self.ciclos += 1
            self.ciclos_espera += 1

    def _subciclo1(self):
        self.mir = MEMORIA_DE_CONTROLE[self.mpc]
        self.desviou = False
        self.ativos = ATIVOS_1

    def _subciclo2(self):
        self.latch_a = self.registradores[self.mir.a]
        self.latch_b = self.registradores[self.mir.b]
        self.ativos = ATIVOS_2

    def _subciclo3(self):
        mir = self.mir
        self.saida_amux = self.mbr if mir.amux else self.latch_a
        self.saida_ula = ula(mir.alu, self.saida_amux, self.latch_b)
        self.n = self.saida_ula >> 15
        self.z = int(self.saida_ula == 0)
        self.saida_deslocador = deslocador(mir.sh, self.saida_ula)
        ativos = ["mir", "amux", "ula", "deslocador", "mbr" if mir.amux else "latch_a", "latch_b"]
        if mir.mar:
            self.mar = self.latch_b & 0x0FFF
            ativos.append("mar")
        if self.mpc == 0:  # passo 0, mar:=pc: comeca a busca da proxima instrucao
            self.endereco_buscado = self.mar
        self.ativos = tuple(ativos)

    def _subciclo4(self):
        mir = self.mir
        ativos = ["mir", "deslocador", "logica_microssequenciamento", "mmux", "mpc"]

        if mir.enc:
            if mir.c in CONSTANTES:
                raise ErroSimulacao(f"microinstrucao {self.mpc} tenta gravar na constante "
                                    f"{NOMES_REGISTRADORES[mir.c]}")
            self.registradores[mir.c] = self.saida_deslocador
            ativos += ("barramento_c", "decodificador_c", "registradores")
        if mir.mbr:
            self.mbr = self.saida_deslocador
            ativos.append("mbr")
        if mir.rd or mir.wr:
            ativos += self._memoria(mir.rd, mir.wr)
        else:
            self.lendo = self.escrevendo = False

        self.desviou = bool(mir.cond == 3 or (mir.cond == 1 and self.n) or (mir.cond == 2 and self.z))
        atual = self.mpc
        self.mpc = mir.addr if self.desviou else (self.mpc + 1) & 0xFF
        if not self.desviou:
            ativos.append("incrementador")
        self.ciclos += 1
        self.ativos = tuple(ativos)

        if atual == 2:  # passo 2, ir:=mbr: a instrucao buscada chegou no IR
            self.endereco_instrucao = self.endereco_buscado
            self.instrucoes += 1
            if self.registradores[IR] == (OPCODE_JUMP << 12) | self.endereco_instrucao:
                self._terminar()  # JUMP para ela mesma: e o HALT do montador

    def _memoria(self, rd: int, wr: int) -> list[str]:
        if rd and wr:
            raise ErroSimulacao(f"RD e WR ligados juntos na microinstrucao {self.mpc}")
        leitura = bool(rd)
        segunda_fase = self.lendo if leitura else self.escrevendo
        self.lendo, self.escrevendo = leitura and not segunda_fase, not leitura and not segunda_fase
        self.acesso = {"tipo": "leitura" if leitura else "escrita", "endereco": self.mar,
                       "fase": 2 if segunda_fase else 1}
        ativos = ["mar", "memoria"] + ([] if leitura else ["mbr"])
        if not segunda_fase:
            return ativos

        valor = None if leitura else self.mbr
        if self.cache:
            lido, self.espera = self.cache.acessar(self.mar, valor)
            self.acesso["acerto"] = self.espera == 0
            ativos.append("cache")
        elif leitura:
            lido = self.memoria[self.mar]
        else:
            self.memoria[self.mar] = self.mbr

        if leitura:
            self.mbr = lido
            self.leituras += 1
            ativos.append("mbr")
        else:
            self.escritas += 1
            if not self.cache:
                self.escritas_pendentes.append({"endereco": self.mar, "valor": self.mbr})
        return ativos

    def _terminar(self):
        self.parado = True
        if self.cache:
            # write-back: o que ficou so na cache volta para a memoria
            self.escritas_pendentes += self.cache.esvaziar()

    # ------------------------------------------------------------------ estado

    def coletar_escritas(self) -> list[dict]:
        """Palavras gravadas na memoria principal desde a ultima chamada."""
        escritas, self.escritas_pendentes = self.escritas_pendentes, []
        return escritas

    def estado(self, desmontar=None) -> dict:
        instrucao = None
        if self.endereco_instrucao is not None and self.instrucoes:
            palavra = self.registradores[IR]
            instrucao = {
                "endereco": self.endereco_instrucao,
                "palavra": palavra,
                "texto": desmontar(palavra) if desmontar else "",
                "linha": self.linhas.get(self.endereco_instrucao, 0),
            }
        return {
            "ciclo": self.ciclos,
            "subciclo": self.subciclo,
            "parado": self.parado,
            "esperando": self.ativos is ATIVOS_ESPERA,
            "espera_restante": self.espera,
            "registradores": list(self.registradores),
            "latch_a": self.latch_a,
            "latch_b": self.latch_b,
            "amux": self.saida_amux,
            "ula": self.saida_ula,
            "deslocador": self.saida_deslocador,
            "n": self.n,
            "z": self.z,
            "mar": self.mar,
            "mbr": self.mbr,
            "mpc": self.mpc,
            "mir": {"palavra": self.mir.palavra, "campos": self.mir.campos(), "texto": self.mir.texto},
            "desviou": self.desviou,
            "memoria_acesso": self.acesso,
            "instrucao": instrucao,
            "ativos": list(self.ativos) if self.subciclo else [],
            "cache": self.cache.estado() if self.cache else None,
            "metricas": {
                "ciclos": self.ciclos,
                "instrucoes": self.instrucoes,
                "leituras": self.leituras,
                "escritas": self.escritas,
                "ciclos_espera": self.ciclos_espera,
                "tempo_ms": round(self.tempo * 1000, 3),
            },
            "breakpoints": sorted(self.breakpoints),
        }
