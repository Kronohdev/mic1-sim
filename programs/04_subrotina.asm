; Programa 4 - Sub-rotina com CALL e RETN
; Calcula 6 x 7 com uma sub-rotina que multiplica por somas sucessivas.
; Os argumentos vao pela pilha e o resultado volta no AC.
;
; Esperado: res = 42, AC = 42, SP volta para 4096

        LODD x
        PUSH            ; argumento a
        LODD y
        PUSH            ; argumento b
        CALL mult
        INSP 2          ; tira os argumentos da pilha
        STOD res
        HALT

; mult(a, b) = a * b, com b >= 0
; na entrada: SP+0 = endereco de retorno, SP+1 = b, SP+2 = a
mult:   LOCO 0
        PUSH            ; acumulador local, agora b esta em SP+2 e a em SP+3
mlaco:  LODL 2
        JZER mfim
        SUBD um
        STOL 2          ; b--
        LODL 0
        ADDL 3
        STOL 0          ; acc += a
        JUMP mlaco
mfim:   POP             ; AC = acc
        RETN

x:      .word 6
y:      .word 7
res:    .word 0
um:     .word 1
