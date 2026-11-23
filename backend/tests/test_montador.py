import pytest

from mic1.montador import ErrosDeMontagem, desmontar, montar


def test_codificacao():
    p = montar("LODD 5\nLOCO 4095\nPUSH\nINSP 3\nDESP 255\nHALT")
    assert p.palavras == [0x0005, 0x7FFF, 0xF400, 0xFC03, 0xFEFF, 0x6005]


def test_rotulos_e_variaveis_automaticas():
    p = montar("inicio: LODD x\nSTOD y\nJUMP inicio")
    assert p.simbolos["inicio"] == 0
    assert p.variaveis == ["x", "y"]
    assert p.simbolos["x"] == 3 and p.simbolos["y"] == 4
    assert len(p.palavras) == 5


def test_rotulo_colado_na_instrucao_e_comentarios():
    p = montar("START:LOCO 16 ; comentario\n# outro comentario\nEND:JUMP END")
    assert p.palavras == [0x7010, 0x6001]


def test_word_e_space():
    p = montar("HALT\nv: .word 1, -1, 0x10\nz: .space 3")
    assert p.palavras[1:] == [1, 0xFFFF, 0x10, 0, 0, 0]


def test_erros_com_linha():
    with pytest.raises(ErrosDeMontagem) as e:
        montar("LODD 1\nXPTO 2\nLOCO 5000\nJUMP nada\nPUSH 3\na: HALT\na: HALT")
    assert sorted(erro.linha for erro in e.value.erros) == [2, 3, 4, 5, 7]


def test_desmontar():
    for palavra in [0x0005, 0x7FFF, 0xF000, 0xF200, 0xF400, 0xF600, 0xF800, 0xFA00, 0xFC03, 0xFE10]:
        assert montar(desmontar(palavra)).palavras == [palavra]


def test_cavales_gera_o_mesmo_codigo():
    assert montar("ferra 5\nenfarda\ngalopa 0\nrelincha").palavras == \
        montar("LOCO 5\nPUSH\nCALL 0\nHALT").palavras
