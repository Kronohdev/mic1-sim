"""Servidor: um WebSocket por aba aberta, cada um com a sua propria maquina.

Mensagens do navegador (campo "cmd"):
    montar {fonte, cache} | passo {unidade} | executar {velocidade} | pausar | reiniciar
    breakpoints {enderecos} | velocidade {valor} | memoria {inicio, quantidade}

Respostas (campo "tipo"):
    montado | estado | memoria | pausado {motivo} | erro {mensagem}

A velocidade e em subciclos por segundo; 0 roda o mais rapido possivel.
"""

import asyncio
import contextlib
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from .cache import MAPEAMENTOS
from .maquina import TAMANHO_MEMORIA, ErroSimulacao, Mic1
from .montador import ErrosDeMontagem, desmontar, montar

QUADROS_POR_SEGUNDO = 30
LOTE_MAXIMO = 20_000

app = FastAPI(title="MIC-1 Sim")


class Sessao:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.maquina: Mic1 | None = None
        self.velocidade = 4.0
        self.tarefa: asyncio.Task | None = None
        self.pular_breakpoint: int | None = None
        self.breakpoints: set[int] = set()  # valem tambem para a proxima montagem

    async def enviar(self, tipo: str, **dados):
        await self.ws.send_json({"tipo": tipo, **dados})

    def estado(self) -> dict:
        estado = self.maquina.estado(desmontar)
        estado["memoria_escritas"] = self.maquina.coletar_escritas()
        return estado

    async def tratar(self, msg: dict):
        cmd = msg.get("cmd")
        if cmd == "montar":
            await self.montar(msg.get("fonte", ""), msg.get("cache"))
        elif cmd == "velocidade":
            self.velocidade = float(msg.get("valor", 4))
        elif cmd == "breakpoints":
            self.breakpoints = {int(e) for e in msg.get("enderecos", [])}
            if self.maquina:
                self.maquina.breakpoints = self.breakpoints
        elif self.maquina is None:
            await self.enviar("erro", mensagem="Monte um programa antes de executar.")
        elif cmd == "memoria":
            inicio = max(0, int(msg.get("inicio", 0)))
            fim = min(inicio + int(msg.get("quantidade", 64)), TAMANHO_MEMORIA)
            await self.enviar("memoria", inicio=inicio, palavras=self.maquina.memoria[inicio:fim])
        elif cmd == "passo":
            await self.passo(msg.get("unidade", "subciclo"))
        elif cmd == "executar":
            self.velocidade = float(msg.get("velocidade", self.velocidade))
            await self.parar()
            self.tarefa = asyncio.create_task(self.executar())
        elif cmd == "pausar":
            if await self.parar():
                await self.enviar("estado", estado=self.estado())
                await self.enviar("pausado", motivo="usuario")
        elif cmd == "reiniciar":
            await self.parar()
            self.maquina.reiniciar()
            self.pular_breakpoint = None
            await self.enviar("estado", estado=self.estado())
        else:
            await self.enviar("erro", mensagem=f"comando desconhecido: {cmd}")

    async def montar(self, fonte: str, cache: str | None):
        await self.parar()
        if cache not in (None, *MAPEAMENTOS):
            await self.enviar("erro", mensagem=f"mapeamento de cache desconhecido: {cache}")
            return
        try:
            programa = montar(fonte)
        except ErrosDeMontagem as e:
            erros = [{"linha": x.linha, "mensagem": x.mensagem} for x in e.erros]
            await self.enviar("montado", ok=False, erros=erros)
            return
        self.maquina = Mic1(programa.palavras, programa.linhas, cache)
        self.maquina.breakpoints = self.breakpoints
        await self.enviar(
            "montado",
            ok=True,
            erros=[],
            programa={
                "simbolos": programa.simbolos,
                "linhas": {str(k): v for k, v in programa.linhas.items()},
                "variaveis": programa.variaveis,
                "tamanho": len(programa.palavras),
            },
            estado=self.estado(),
        )

    async def passo(self, unidade: str):
        await self.parar()
        m = self.maquina
        passo = {"subciclo": m.passo_subciclo, "ciclo": m.passo_ciclo, "instrucao": m.passo_instrucao}
        if unidade not in passo:
            await self.enviar("erro", mensagem=f"unidade desconhecida: {unidade}")
            return
        try:
            passo[unidade]()
        except ErroSimulacao as e:
            await self.enviar("erro", mensagem=str(e))
        await self.enviar("estado", estado=self.estado())
        if m.parado:
            await self.enviar("pausado", motivo="fim")

    # ------------------------------------------------------------ execucao continua

    async def parar(self) -> bool:
        if self.tarefa is None or self.tarefa.done():
            return False
        self.tarefa.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self.tarefa
        self.tarefa = None
        return True

    def _no_breakpoint(self) -> bool:
        m = self.maquina
        if not m.inicio_de_instrucao:
            return False
        pc = m.registradores[0]
        if pc not in m.breakpoints:
            self.pular_breakpoint = None
            return False
        if self.pular_breakpoint == pc:
            return False  # acabou de parar aqui: deixa seguir
        self.pular_breakpoint = pc
        return True

    def _ritmo(self) -> tuple[int, float]:
        """Quantos subciclos rodar por vez e quanto esperar entre um lote e outro."""
        if self.velocidade <= 0:
            return LOTE_MAXIMO, 0.0
        if self.velocidade <= QUADROS_POR_SEGUNDO:
            return 1, 1 / self.velocidade
        return round(self.velocidade / QUADROS_POR_SEGUNDO), 1 / QUADROS_POR_SEGUNDO

    async def executar(self):
        m = self.maquina
        try:
            while True:
                lote, pausa = self._ritmo()
                motivo = None
                for _ in range(lote):
                    if self._no_breakpoint():
                        motivo = "breakpoint"
                        break
                    m.passo_subciclo()
                    if m.parado:
                        motivo = "fim"
                        break
                await self.enviar("estado", estado=self.estado())
                if motivo:
                    await self.enviar("pausado", motivo=motivo)
                    return
                await asyncio.sleep(pausa)
        except ErroSimulacao as e:
            await self.enviar("erro", mensagem=str(e))
            await self.enviar("pausado", motivo="erro")


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    sessao = Sessao(ws)
    try:
        while True:
            await sessao.tratar(await ws.receive_json())
    except WebSocketDisconnect:
        pass
    finally:
        await sessao.parar()


# frontend compilado (npm run build), para rodar tudo com um comando so
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
