# Arquitetura

## Visão geral

```text
navegador (React + three.js)  <--- WebSocket, um estado por subciclo --->  servidor (Python)
  editor, placa 3D, paineis                                                 montador MAC-1
                                                                            maquina MIC-1
```

Cada aba aberta tem a sua própria máquina no servidor. O navegador só manda comandos
(montar, avançar, executar, pausar...) e desenha o estado que recebe de volta.

## Caminho de dados

| Componente | Onde | Detalhe |
| --- | --- | --- |
| 16 registradores de 16 bits | `Mic1.registradores` | PC, AC, SP, IR, TIR, 0, +1, -1, AMASK, SMASK, A a F |
| Latches A e B | `latch_a`, `latch_b` | carregados no subciclo 2 |
| AMUX | `_subciclo3` | escolhe latch A ou MBR |
| ULA | `ula()` | A+B, A AND B, A, NOT A; gera N (bit 15) e Z |
| Deslocador | `deslocador()` | nenhum, 1 bit à direita, 1 bit à esquerda |
| MAR | `mar` | 12 bits, recebe o latch B no subciclo 3 |
| MBR | `mbr` | 16 bits, recebe o deslocador ou a memória |
| Memória | `memoria` | 4096 palavras de 16 bits |

As constantes (0, +1, -1, AMASK = 0x0FFF, SMASK = 0x00FF) ficam nos registradores 5 a 9. Se
alguma microinstrução tentar gravar nelas, o simulador acusa erro.

## Unidade de controle

| Componente | Detalhe |
| --- | --- |
| Memória de controle | 79 palavras de 32 bits, geradas a partir do MAL em `microcodigo.py` |
| MPC | 8 bits, aponta a próxima microinstrução |
| MIR | guarda a microinstrução atual (carregado no subciclo 1) |
| Incrementador | MPC + 1 |
| Mmux | escolhe MPC + 1 ou o campo ADDR |
| Lógica de microssequenciamento | desvia quando COND = 3, ou COND = 1 e N = 1, ou COND = 2 e Z = 1 |
| Decodificadores A, B, C | transformam os campos de 4 bits em qual registrador lê ou grava |

## Subciclos

| | Subciclo 1 | Subciclo 2 | Subciclo 3 | Subciclo 4 |
| --- | --- | --- | --- | --- |
| Faz | MIR ← controle[MPC] | latch A ← reg[A], latch B ← reg[B] | AMUX, ULA, deslocador; MAR ← latch B se MAR = 1 | reg[C] ← deslocador se ENC; MBR ← deslocador se MBR; memória; MPC ← Mmux |
| Acende | MPC, memória de controle, MIR | decodificadores A e B, barramentos A e B, latches | AMUX, ULA, deslocador, MAR | barramento C, MBR, memória, Mmux, MPC |

## Memória em dois ciclos

O simulador guarda se o RD (ou WR) estava ligado no ciclo anterior:

- RD ligado e não estava antes: a leitura começa (fase 1)
- RD ligado e já estava antes: no fim do subciclo 4, MBR ← memória[MAR] (fase 2)
- RD desligado: zera o estado

A escrita funciona igual, gravando memória[MAR] ← MBR na fase 2.

## Cache

`mic1/cache.py`, ligada opcionalmente entre o MAR/MBR e a memória principal.

- 8 linhas de 4 palavras. O endereço se divide em tag, conjunto e deslocamento dentro do bloco.
- Direto: 8 conjuntos de 1 via. Totalmente associativo: 1 conjunto de 8 vias. Por conjunto:
  4 conjuntos de 2 vias.
- A cache é consultada na fase 2 do acesso (o segundo RD ou WR). Acerto: o dado sai da cache e
  não há custo extra. Falta: o bloco inteiro vem da memória e a máquina fica 4 ciclos parada.
  Se a linha escolhida estiver suja, ela volta para a memória antes, e isso custa mais 4.
- Write-back com alocação na escrita: uma escrita que falta também traz o bloco para a cache.
- LRU: cada linha guarda o instante do último acesso, e sai a mais antiga do conjunto. Linhas
  vazias são usadas primeiro.
- No fim do programa as linhas sujas são devolvidas, para a memória mostrar o resultado final.

Nos ciclos de espera nenhum subciclo do caminho de dados executa: o MPC, o MIR e os
registradores ficam como estão, e só os ciclos e a métrica `ciclos_espera` aumentam. Por isso,
com cache, `ciclos = ciclos sem cache + ciclos de espera`, e os testes conferem exatamente isso.

## Fim do programa

O MAC-1 não tem instrução de parada. A convenção usada pelas outras turmas é terminar o
programa com um `JUMP` para ele mesmo. O montador transforma `HALT` nisso, e a máquina para
quando a instrução recém-buscada (passo 2 do microprograma, `ir:=mbr`) é um `JUMP` para o
próprio endereço.

## Decisões de projeto

- **Microprograma em MAL, não em binário.** Fica legível e fácil de comparar com o livro. O
  montador de MAL escolhe qual operando vai por cada barramento; numa soma em que o MAR também
  precisa do barramento B (por exemplo `mar:=sp; sp:=sp + 1`), ele coloca o operando do MAR no
  B e o outro no A. Conferimos as 79 palavras com a tabela do SimuladorVinod: as únicas
  diferenças são A e B trocados em somas e ANDs, que dão o mesmo resultado.
- **Simulação separada da interface.** O núcleo não sabe nada de tela, e a interface não sabe
  nada de simulação. Isso evita o problema do SimuladorVinod, em que a thread da simulação
  escreve direto em variáveis da janela.
- **Um estado completo por subciclo.** É mais simples que mandar só o que mudou, e o tamanho
  (perto de 1 KB) não pesa. Em velocidade alta o servidor junta vários subciclos e manda no
  máximo 30 estados por segundo.
- **SP começa em 4096.** O primeiro `PUSH` decrementa antes de gravar, então usa o endereço 4095
  e nenhuma posição da memória fica perdida.

## Diferenças em relação à máquina real

- No hardware todos os componentes funcionam o tempo todo, e o controle só decide o que é
  gravado. No simulador cada componente só é calculado no subciclo em que é usado.
- Os subciclos são instantâneos: não existe atraso de propagação, só a ordem dos eventos.
- Sem cache, a memória responde sempre em exatamente dois ciclos. Com cache, a espera é um
  número fixo de ciclos por falta; numa máquina real ela depende do barramento e da memória.
- O `HALT` é uma convenção do montador, não uma instrução da máquina.
