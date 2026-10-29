# Arquitetura e notas de projeto

[README](../README.md) · [Modelo de dados](database.md)

## Direção

Uma casa de leilões precisa tratar bem três coisas: disputa concorrente, dinheiro reservado e evidência do que aconteceu. A escolha é um monólito modular, com PostgreSQL como fonte do estado e interface editorial que dê prioridade à obra e ao lance.

```text
React / shadcn / Tailwind
       │ HTTP + Socket.IO
       ▼
NestJS: auth · catalog · lots · bids · wallets · settlement · audit
       ├── Prisma / PostgreSQL: estado, extrato e evidência
       ├── Cleveland Adapter: busca e normalização de obras
       └── Checkpoints em arquivos: testemunho adicional, quando configurado
```

## Escolhas e motivos

| Escolha | Motivo e aplicação |
| --- | --- |
| Monólito modular | Transações locais para lance, reserva e evidência, sem coordenação entre microserviços |
| Adapter | `ClevelandAdapter` implementa `ExternalItemProvider`; o domínio recebe um contrato normalizado, sem depender do JSON externo |
| Orquestração no serviço | `BidsService` coordena regras, bloqueios, carteira e auditoria; cumpre o papel de fachada do caso de uso |
| Observer | `AuctionEvents` publica notificações após commit; assinantes e gateway atualizam os clientes sem alterar o resultado da transação |
| Snapshot da obra | Lotes publicados podem ser consultados e disputados sem uma nova requisição ao museu |
| Componentes compartilhados | shadcn/ui concentra controles, feedback e estados de carregamento; tema e tipografia ficam no frontend ativo |

Os [transportes de catálogo](../backend/src/catalog/cleveland.transport.ts) selecionam HTTP real ou fixtures pelo ambiente. Ambos passam pelo mesmo Adapter. Uma falha real não é disfarçada de resposta mock. A busca mantém filtros de imagem e domínio público, além de texto, categoria e paginação.

## Caminho de um lance

1. Autenticar o licitante e validar a chave de idempotência.
2. Bloquear o lote e as carteiras envolvidas em ordem consistente dentro da transação.
3. Conferir novamente prazo, papel, líder, mínimo/incremento e saldo disponível.
4. Gravar lance, trocar reservas e aplicar anti-sniping: nos últimos dois minutos, o prazo passa a dois minutos após o lance aceito.
5. Gravar o snapshot de auditoria; confirmar a transação antes de emitir eventos.

Repetições válidas não criam novos débitos ou lances. O relógio do servidor determina a elegibilidade; a contagem na interface é informativa. O worker verifica abertura, fechamento e liquidação em ciclos de dez segundos. Compra, venda, captura da reserva e resultado são confirmados juntos.

## Sessão e atualização da interface

JWT de acesso fica em memória por quinze minutos. Um refresh token opaco em cookie HttpOnly permite restaurar a sessão; seu hash e a família de renovação são persistidos. A família expira em sete dias a partir do login. Rotação, detecção de reutilização e logout revogam sessões conforme o fluxo implementado.

Cada página consulta HTTP ao abrir. Eventos WebSocket invalidam consultas afetadas; reconexão recupera o estado pelo servidor. Consultas periódicas servem de fallback quando desconectado. Eventos não transportam um estado financeiro que substitua a leitura autorizada.

Auditoria é pública e usa pseudônimos por lote. Comprovantes e informações financeiras privadas exigem autorização. Login e depósito podem devolver o usuário à mesma sala em que tentou dar um lance.

## Por que a auditoria precisa de mais que um hash

Um hash encadeado detecta diferenças, mas, se toda a cadeia puder ser reescrita, sozinho não prova o histórico original. A implementação combina duas evidências:

- `BidAuditEntry`: SHA-256 de uma tupla canônica com lote, sequência, hash anterior, lance, pseudônimo, valor, moeda, instante de aceitação e prazo resultante.
- `BidAuditHistory`: triggers registram INSERT, UPDATE e DELETE de lances, snapshots e resultados, inclusive SQL direto, com identificador da transação e valores antes/depois. Escritas diretas nessa evidência e truncamentos protegidos são rejeitados.

A verificação compara os registros originais, o pareamento de transações, as linhas atuais e a cadeia. O navegador também recalcula os hashes recebidos. O resultado pode ser `intact`, `tampered` ou `not_verifiable`; ausência de evidência nunca equivale a integridade. Mudanças diretas por SQL exigem uma nova consulta de auditoria para aparecer na tela.

Quando `AUDIT_CHECKPOINT_DIR` está definido, arquivos privados acrescentam testemunhos fora do PostgreSQL. Falha nesse armazenamento impede novos lances com 503; escritas não confirmadas permanecem não verificáveis. No Compose, o diretório é `.local/audit-checkpoints/`.

**Limite de confiança:** triggers, escritor de snapshots e evidência precisam estar protegidos. O dono do banco ou um superusuário pode desativar essas proteções, reescrever evidências ou restaurar uma cópia antiga. A credencial proprietária usada no Render não representa isolamento contra seu próprio titular. Isso não é armazenamento WORM nem prova contra comprometimento administrativo completo.

## Ideias para uma próxima evolução

- Guardar cópias autorizadas das imagens para reduzir a dependência do CDN.
- Separar credenciais de runtime e administração; avaliar armazenamento externo imutável para testemunhos de auditoria.
- Adicionar broker/outbox caso seja necessário executar múltiplas instâncias com entrega durável de eventos.
- Manter ajustes visuais em componentes e tokens compartilhados, sem voltar a duplicar páginas ou estilos por protótipo.

Esses pontos são propostas, não funcionalidades concluídas. Capturas da vitrine, painel e sala estão no README.
