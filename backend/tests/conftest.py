from pathlib import Path

import pytest

from mic1.maquina import Mic1
from mic1.montador import montar

PROGRAMAS = Path(__file__).resolve().parents[2] / "programs"


def executar(fonte: str, limite: int = 200_000, cache: str | None = None) -> tuple[Mic1, dict]:
    programa = montar(fonte)
    maquina = Mic1(programa.palavras, programa.linhas, cache)
    for _ in range(limite):
        if maquina.parado:
            break
        maquina.passo_ciclo()
    assert maquina.parado, "o programa nao chegou no HALT"
    return maquina, programa.simbolos


@pytest.fixture
def rodar():
    return executar


@pytest.fixture
def programa():
    return lambda nome: (PROGRAMAS / nome).read_text(encoding="utf-8")
