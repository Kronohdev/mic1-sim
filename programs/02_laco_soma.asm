; Programa 2 - Laco com desvio condicional
; Soma os numeros de 1 a N.
;
; Entrada:  n = 10
; Esperado: soma = 55, i = 11

        LOCO 0
        STOD soma
        LOCO 1
        STOD i
laco:   LODD n
        SUBD i          ; AC = n - i
        JNEG fim        ; passou de n, acabou
        LODD soma
        ADDD i
        STOD soma       ; soma += i
        LODD i
        ADDD um
        STOD i          ; i++
        JUMP laco
fim:    HALT

n:      .word 10
um:     .word 1
soma:   .word 0
i:      .word 0
