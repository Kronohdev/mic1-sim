; Programa 5 - Percorrer um vetor
; Soma os elementos e acha o maior. A leitura de vet[i] usa PSHI
; (empilha o conteudo do endereco que esta no AC) seguido de POP.
;
; Entrada:  vet = 5 -3 12 7 0 9 -8 4 (tam = 8)
; Esperado: soma = 26, max = 12

        LODD vet
        STOD max        ; max comeca com o primeiro elemento
        LOCO vet
        STOD ptr
        LODD tam
        STOD cont
laco:   LODD ptr
        PSHI
        POP             ; AC = vet[i]
        STOD atual
        ADDD soma
        STOD soma
        LODD atual
        SUBD max
        JNEG naomax     ; atual < max
        LODD atual
        STOD max
naomax: LODD ptr
        ADDD um
        STOD ptr
        LODD cont
        SUBD um
        STOD cont
        JNZE laco
        HALT

vet:    .word 5, -3, 12, 7, 0, 9, -8, 4
tam:    .word 8
ptr:    .word 0
cont:   .word 0
atual:  .word 0
soma:   .word 0
max:    .word 0
um:     .word 1
