import pytest

from mic1.cache import BLOCO, LINHAS, MAPEAMENTOS, PENALIDADE, Cache
from mic1.maquina import Mic1
from mic1.montador import montar


def nova(mapeamento):
    memoria = list(range(4096))
    return Cache(memoria, mapeamento), memoria


def test_localidade_dentro_do_bloco():
    cache, _ = nova("direto")
    esperas = [cache.acessar(e)[1] for e in range(BLOCO)]
    assert esperas == [PENALIDADE, 0, 0, 0]
    assert (cache.acertos, cache.faltas) == (3, 1)


def test_conflito_no_direto_e_nao_no_associativo():
    distancia = LINHAS * BLOCO  # mesmo indice de linha no mapeamento direto
    for mapeamento, faltas in [("direto", 4), ("associativo", 2)]:
        cache, _ = nova(mapeamento)
        for endereco in (0, distancia, 0, distancia):
            cache.acessar(endereco)
        assert cache.faltas == faltas, mapeamento


def test_lru_no_associativo_por_conjunto():
    cache, _ = nova("conjunto")
    passo = cache.conjuntos * BLOCO  # tres blocos que caem no mesmo conjunto de 2 vias
    for endereco in (0, passo, 0, 2 * passo):  # o bloco de "passo" e o menos usado e sai
        cache.acessar(endereco)
    assert cache.acessar(0)[1] == 0
    assert cache.acessar(passo)[1] == PENALIDADE


def test_leitura_devolve_o_valor_da_memoria():
    for mapeamento in MAPEAMENTOS:
        cache, _ = nova(mapeamento)
        assert [cache.acessar(e)[0] for e in (5, 300, 4095, 5)] == [5, 300, 4095, 5]


def test_write_back_so_grava_na_memoria_quando_a_linha_sai():
    cache, memoria = nova("direto")
    cache.acessar(0, escrever=999)
    assert memoria[0] == 0
    valor, espera = cache.acessar(LINHAS * BLOCO)  # expulsa a linha suja
    assert memoria[0] == 999
    assert espera == 2 * PENALIDADE
    assert cache.devolucoes == 1


def test_esvaziar_devolve_as_linhas_sujas():
    cache, memoria = nova("associativo")
    cache.acessar(10, escrever=7)
    gravadas = cache.esvaziar()
    assert memoria[10] == 7
    assert {"endereco": 10, "valor": 7} in gravadas


def test_falta_para_o_caminho_de_dados():
    m = Mic1(montar("LOCO 3\nHALT").palavras, cache="direto")
    m.passo_ciclo()
    m.passo_ciclo()  # segundo rd: a busca da instrucao da falta na cache
    assert m.espera == PENALIDADE and m.mbr == 0x7003
    mpc, registradores = m.mpc, list(m.registradores)
    for _ in range(PENALIDADE):
        m.passo_ciclo()
        assert m.estado()["esperando"]
    assert (m.mpc, m.registradores) == (mpc, registradores)
    assert m.ciclos_espera == PENALIDADE


@pytest.mark.parametrize("mapeamento", MAPEAMENTOS)
def test_programas_dao_o_mesmo_resultado_com_cache(rodar, programa, mapeamento):
    for nome in ["01_aritmetica.asm", "02_laco_soma.asm", "03_fibonacci.asm",
                 "04_subrotina.asm", "05_vetor.asm"]:
        fonte = programa(nome)
        sem, _ = rodar(fonte)
        com, _ = rodar(fonte, cache=mapeamento)
        assert com.memoria == sem.memoria, nome
        assert com.registradores == sem.registradores, nome
        assert com.ciclos == sem.ciclos + com.ciclos_espera, nome
        assert com.cache.acertos > com.cache.faltas, nome
