"""Os programas de programs/ chegam aos resultados escritos no cabecalho de cada um."""

from mic1.montador import montar


def valor(maquina, simbolos, nome, i=0):
    v = maquina.memoria[simbolos[nome] + i]
    return v - 0x10000 if v & 0x8000 else v


def test_01_aritmetica(rodar, programa):
    m, s = rodar(programa("01_aritmetica.asm"))
    assert (valor(m, s, "soma"), valor(m, s, "dif"), m.registradores[1]) == (42, 8, 8)


def test_02_laco(rodar, programa):
    m, s = rodar(programa("02_laco_soma.asm"))
    assert (valor(m, s, "soma"), valor(m, s, "i")) == (55, 11)


def test_03_fibonacci(rodar, programa):
    m, s = rodar(programa("03_fibonacci.asm"))
    assert [valor(m, s, "vetor", i) for i in range(16)] == [
        0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]
    assert (valor(m, s, "f0"), valor(m, s, "f1"), valor(m, s, "cont")) == (987, 1597, 0)


def test_04_subrotina(rodar, programa):
    m, s = rodar(programa("04_subrotina.asm"))
    assert valor(m, s, "res") == 42
    assert m.registradores[1] == 42
    assert m.registradores[2] == 4096


def test_05_vetor(rodar, programa):
    m, s = rodar(programa("05_vetor.asm"))
    assert (valor(m, s, "soma"), valor(m, s, "max")) == (26, 12)


def test_06_cavales_igual_ao_03(programa):
    assert montar(programa("06_fibonacci.cav")).palavras == \
        montar(programa("03_fibonacci.asm")).palavras
