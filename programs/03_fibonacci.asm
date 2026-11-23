; Programa 3 - Fibonacci
; Gera os 16 primeiros termos e guarda no vetor. A escrita no vetor usa
; PUSH + POPI (desempilha para o endereco que esta no AC).
;
; Esperado: vetor = 0 1 1 2 3 5 8 13 21 34 55 89 144 233 377 610
;           f0 = 987, f1 = 1597, cont = 0

        LOCO vetor
        STOD ptr        ; ptr aponta para o inicio do vetor
        LOCO 16
        STOD cont
laco:   LODD f0
        PUSH
        LODD ptr
        POPI            ; vetor[ptr] = f0
        LODD f0
        ADDD f1
        STOD prox
        LODD f1
        STOD f0
        LODD prox
        STOD f1         ; (f0, f1) = (f1, f0 + f1)
        LODD ptr
        ADDD um
        STOD ptr
        LODD cont
        SUBD um
        STOD cont
        JNZE laco
        HALT

f0:     .word 0
f1:     .word 1
prox:   .word 0
ptr:    .word 0
cont:   .word 0
um:     .word 1
vetor:  .space 16
