# Cavalês

Um dialeto do montador MAC-1 com nomes tirados do mundo dos cavalos. Cada palavra em cavalês
é trocada pelo mnemônico MAC-1 antes da montagem, então o código de máquina é exatamente o
mesmo. Dá para misturar os dois no mesmo arquivo. A extensão usada nos exemplos é `.cav`.

## Instruções

| Cavalês | MAC-1 | Por quê |
| --- | --- | --- |
| `pasta` | `LODD` | o cavalo vai buscar comida no pasto (memória) |
| `encocheira` | `STOD` | guarda na cocheira |
| `cruza` | `ADDD` | cruzamento junta duas linhagens |
| `apeia` | `SUBD` | apear é tirar o cavaleiro de cima |
| `empina` | `JPOS` | sobe quando o valor é positivo |
| `empacou` | `JZER` | cavalo empacado: desvia quando é zero |
| `trota` | `JUMP` | salto sem condição |
| `ferra` | `LOCO` | ferrar é pregar um valor fixo |
| `pasta_na_baia` | `LODL` | come na baia (na pilha) |
| `encocheira_na_baia` | `STOL` | |
| `cruza_na_baia` | `ADDL` | |
| `apeia_na_baia` | `SUBL` | |
| `refuga` | `JNEG` | o cavalo recua: desvia quando é negativo |
| `segue_trote` | `JNZE` | continua enquanto não é zero |
| `galopa` | `CALL` | salto longo que lembra o caminho de volta |
| `enfarda_do_pasto` | `PSHI` | empilha o feno de um endereço |
| `desenfarda_no_pasto` | `POPI` | desempilha num endereço |
| `enfarda` | `PUSH` | empilhar feno |
| `desenfarda` | `POP` | |
| `volta_pra_baia` | `RETN` | volta da sub-rotina |
| `troca_de_sela` | `SWAP` | troca AC e SP |
| `afrouxa_cilha` | `INSP` | a pilha encolhe |
| `aperta_cilha` | `DESP` | a pilha cresce |
| `relincha` | `HALT` | fim do programa |

## Diretivas

| Cavalês | MAC-1 |
| --- | --- |
| `.fardo` | `.word` |
| `.baias` | `.space` |

## Exemplo

[`programs/06_fibonacci.cav`](../programs/06_fibonacci.cav) é o Fibonacci do programa 3 escrito
em cavalês. O teste `test_06_cavales_igual_ao_03` confere que os dois geram as mesmas palavras.
