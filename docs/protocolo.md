# Protocolo entre o navegador e o servidor

Tudo passa por um WebSocket em `/ws`, com mensagens JSON. Os tipos equivalentes em TypeScript
estão em [`frontend/src/tipos.ts`](../frontend/src/tipos.ts).

## Do navegador para o servidor

| `cmd` | Campos | Efeito |
| --- | --- | --- |
| `montar` | `fonte`, `cache` (`null`, `direto`, `associativo` ou `conjunto`) | monta o programa e cria uma máquina nova |
| `passo` | `unidade`: `subciclo`, `ciclo` ou `instrucao` | avança e devolve o estado |
| `executar` | `velocidade` (subciclos por segundo, 0 = máximo) | roda até pausar, terminar ou bater num breakpoint |
| `pausar` | | para a execução contínua |
| `reiniciar` | | volta ao estado logo depois da montagem |
| `breakpoints` | `enderecos` | lista de endereços MAC-1; vale também antes de montar |
| `velocidade` | `valor` | muda a velocidade sem parar |
| `memoria` | `inicio`, `quantidade` | pede um trecho da memória |

## Do servidor para o navegador

| `tipo` | Campos |
| --- | --- |
| `montado` | `ok`, `erros` (`linha`, `mensagem`), `programa`, `estado` |
| `estado` | `estado` |
| `memoria` | `inicio`, `palavras` |
| `pausado` | `motivo`: `usuario`, `breakpoint`, `fim` ou `erro` |
| `erro` | `mensagem` |

## Estado

```json
{
  "ciclo": 2,
  "subciclo": 4,
  "parado": false,
  "esperando": false,
  "espera_restante": 0,
  "registradores": [1, 0, 4096, 0, 0, 0, 1, 65535, 4095, 255, 0, 0, 0, 0, 0, 0],
  "latch_a": 0, "latch_b": 1, "amux": 0, "ula": 1, "deslocador": 1,
  "n": 0, "z": 0, "mar": 0, "mbr": 28701, "mpc": 2,
  "mir": {
    "palavra": 5267456, "texto": "pc:=pc + 1; rd;",
    "campos": {"amux": 0, "cond": 0, "alu": 0, "sh": 0, "mbr": 0, "mar": 0, "rd": 1,
               "wr": 0, "enc": 1, "c": 0, "b": 6, "a": 0, "addr": 0}
  },
  "desviou": false,
  "memoria_acesso": {"tipo": "leitura", "endereco": 0, "fase": 2},
  "memoria_escritas": [],
  "instrucao": null,
  "ativos": ["mir", "deslocador", "logica_microssequenciamento", "mmux", "mpc",
             "barramento_c", "decodificador_c", "registradores", "mar", "memoria", "mbr", "incrementador"],
  "cache": null,
  "metricas": {"ciclos": 2, "instrucoes": 0, "leituras": 1, "escritas": 0, "ciclos_espera": 0,
               "tempo_ms": 0.12},
  "breakpoints": []
}
```

- `subciclo` é o último executado (0 antes de começar).
- `mpc` já aponta a próxima microinstrução depois do subciclo 4.
- `memoria_escritas` traz as palavras gravadas desde o último estado enviado, para o navegador
  atualizar a tabela de memória sem pedir tudo de novo.
- `instrucao` é a instrução MAC-1 que está no IR (endereço, palavra, texto e linha do fonte).
- `esperando` é verdadeiro nos ciclos de espera por uma falta na cache, e `espera_restante`
  diz quantos faltam.
- `cache` é `null` sem cache. Com cache traz o mapeamento, as 8 linhas (`valida`, `suja`,
  `tag`, `inicio`, `dados`), `acertos`, `faltas`, `devolucoes`, `taxa_acerto` e o `ultimo`
  acesso (`endereco`, `linha`, `acerto`, `espera`). Na fase 2 de um acesso com cache,
  `memoria_acesso` ganha o campo `acerto`.
