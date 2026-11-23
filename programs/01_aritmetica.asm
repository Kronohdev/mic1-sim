; Programa 1 - Aritmetica simples
; Soma e subtrai dois numeros da memoria e guarda os resultados.
;
; Entrada:  a = 25, b = 17
; Esperado: soma = 42, dif = 8, AC = 8 no fim

        LODD a
        ADDD b
        STOD soma       ; soma = a + b
        LODD a
        SUBD b
        STOD dif        ; dif = a - b
        HALT

a:      .word 25
b:      .word 17
soma:   .word 0
dif:    .word 0
