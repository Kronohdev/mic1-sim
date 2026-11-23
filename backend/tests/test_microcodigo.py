import pytest

from mic1.microcodigo import (
    MEMORIA_DE_CONTROLE,
    ErroMicrocodigo,
    Microinstrucao,
    codificar,
    montar_linha,
)


def campos(linha):
    return Microinstrucao.decodificar(montar_linha(linha), linha).campos()


def test_memoria_de_controle_tem_79_microinstrucoes():
    assert len(MEMORIA_DE_CONTROLE) == 79


def test_busca_da_instrucao():
    c = campos("mar:=pc; rd;")
    assert (c["mar"], c["rd"], c["b"], c["enc"]) == (1, 1, 0, 0)


def test_desvio_condicional_e_deslocamento():
    c = campos("tir:=lshift(ir + ir); if n then goto 19;")
    assert (c["cond"], c["addr"], c["sh"], c["alu"]) == (1, 19, 2, 0)
    assert (c["a"], c["b"], c["enc"], c["c"]) == (3, 3, 1, 4)


def test_mbr_entra_pelo_amux():
    c = campos("ac:=mbr + ac; goto 0;")
    assert (c["amux"], c["b"], c["c"], c["cond"]) == (1, 1, 1, 3)


def test_soma_comutativa_libera_o_barramento_b_para_o_mar():
    c = campos("mar:=sp; sp:=sp + 1; rd;")
    assert c["b"] == 2  # SP vai pelo B para o MAR
    assert c["a"] == 6  # +1 vai pelo A


def test_constantes():
    assert campos("sp:=sp + (-1);")["b"] == 7
    assert campos("a:=band(ir, smask);")["b"] == 9


def test_erros():
    with pytest.raises(ErroMicrocodigo):
        montar_linha("ac:=xyz;")
    with pytest.raises(ErroMicrocodigo):
        montar_linha("mar:=pc; ac:=ac + sp;")
    with pytest.raises(ErroMicrocodigo):
        codificar({"c": 16})
