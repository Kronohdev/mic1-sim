"""Uma verificacao por instrucao MAC-1, rodando o microprograma inteiro."""

import pytest


def com_sinal(v):
    return v - 0x10000 if v & 0x8000 else v


def mem(maquina, simbolos, nome):
    return com_sinal(maquina.memoria[simbolos[nome]])


def ac(maquina):
    return com_sinal(maquina.registradores[1])


def test_lodd_stod(rodar):
    m, s = rodar("LODD x\nSTOD y\nHALT\nx: .word 1234\ny: .word 0")
    assert mem(m, s, "y") == 1234


def test_addd_subd(rodar):
    m, _ = rodar("LODD x\nADDD y\nSUBD z\nHALT\nx: .word 10\ny: .word 5\nz: .word 20")
    assert ac(m) == -5


def test_loco(rodar):
    m, _ = rodar("LOCO 4095\nHALT")
    assert ac(m) == 4095


@pytest.mark.parametrize(
    "instrucao, valor, desvia",
    [
        ("JPOS", 0, True), ("JPOS", 5, True), ("JPOS", -1, False),
        ("JZER", 0, True), ("JZER", 3, False),
        ("JNEG", -2, True), ("JNEG", 0, False),
        ("JNZE", 7, True), ("JNZE", 0, False),
    ],
)
def test_desvios_condicionais(rodar, instrucao, valor, desvia):
    fonte = f"""
        LODD v
        {instrucao} sim
        LOCO 1
        HALT
    sim: LOCO 2
        HALT
    v:  .word {valor}
    """
    m, _ = rodar(fonte)
    assert ac(m) == (2 if desvia else 1)


def test_jump(rodar):
    m, _ = rodar("JUMP la\nLOCO 1\nHALT\nla: LOCO 9\nHALT")
    assert ac(m) == 9


def test_push_pop(rodar):
    m, s = rodar("LOCO 11\nPUSH\nLOCO 22\nPUSH\nPOP\nSTOD a\nPOP\nHALT\na: .word 0")
    assert mem(m, s, "a") == 22
    assert ac(m) == 11
    assert m.registradores[2] == 4096


def test_lodl_stol_addl_subl(rodar):
    fonte = """
        LOCO 30
        PUSH            ; SP+1
        LOCO 12
        PUSH            ; SP+0
        LODL 1          ; 30
        ADDL 0          ; 42
        STOD soma
        SUBL 0          ; 30
        STOL 0          ; topo vira 30
        LODL 0
        HALT
    soma: .word 0
    """
    m, s = rodar(fonte)
    assert mem(m, s, "soma") == 42
    assert ac(m) == 30
    assert m.memoria[4094] == 30


def test_call_retn(rodar):
    m, _ = rodar("CALL f\nSTOD r\nHALT\nf: LOCO 77\nRETN\nr: .word 0")
    assert ac(m) == 77
    assert m.registradores[2] == 4096


def test_pshi_popi(rodar):
    fonte = """
        LOCO origem
        PSHI            ; empilha M[origem]
        LOCO destino
        POPI            ; M[destino] = topo
        HALT
    origem:  .word 321
    destino: .word 0
    """
    m, s = rodar(fonte)
    assert mem(m, s, "destino") == 321
    assert m.registradores[2] == 4096


def test_swap(rodar):
    m, _ = rodar("LOCO 100\nSWAP\nHALT")
    assert ac(m) == 4096
    assert m.registradores[2] == 100


def test_insp_desp(rodar):
    m, _ = rodar("DESP 10\nINSP 3\nHALT")
    assert m.registradores[2] == 4096 - 7


def test_halt_para_a_maquina(rodar):
    m, _ = rodar("LOCO 1\nHALT")
    assert m.instrucoes == 2
    ciclos = m.ciclos
    m.passo_ciclo()
    assert m.ciclos == ciclos


def test_subciclos_e_leitura_em_dois_ciclos():
    from mic1.maquina import Mic1
    from mic1.montador import montar

    m = Mic1(montar("LOCO 7\nHALT").palavras)
    m.passo_subciclo()
    assert m.subciclo == 1 and m.mir.texto.startswith("mar:=pc")
    m.passo_ciclo()  # termina o ciclo 0: leitura comecou
    assert m.acesso == {"tipo": "leitura", "endereco": 0, "fase": 1}
    m.passo_ciclo()  # ciclo 1: segundo rd, MBR recebe a instrucao
    assert m.acesso["fase"] == 2 and m.mbr == 0x7007


def test_endereco_da_instrucao_acompanha_o_ir(programa):
    from mic1.maquina import Mic1
    from mic1.montador import montar

    m = Mic1(montar(programa("03_fibonacci.asm")).palavras)
    while not m.parado:
        m.passo_subciclo()
        if m.endereco_instrucao is not None:
            assert m.memoria[m.endereco_instrucao] == m.registradores[3]
