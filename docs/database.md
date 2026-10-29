# Modelo de dados

[README](../README.md) · [Arquitetura](architecture.md) · [Schema Prisma](../backend/prisma/schema.prisma)

## Ideia central

Separar o item do museu, a disputa e a movimentação financeira. A obra é uma fotografia dos dados externos no momento da publicação; o lote define as regras; o extrato registra o dinheiro. Liderar um leilão reserva saldo, mas ainda não representa uma compra.

## Entidades

| Modelo | Responsabilidade |
| --- | --- |
| `User` | Nome, e-mail único, senha bcrypt, papel e estado ativo |
| `RefreshSession` | Hash do refresh token, família, validade, consumo e revogação; nunca guarda o token bruto |
| `Wallet` | Uma carteira por usuário, com moeda; não possui coluna de saldo |
| `WalletTransaction` | Extrato de depósitos, compras e vendas; chave de idempotência e vínculo opcional com resultado |
| `WalletHold` | Reserva associada a um lance: ativa, liberada ou capturada |
| `Lot` | Proprietário, título, datas, moeda, lance inicial, incremento e situação |
| `Item` | Obra do lote, metadados, estimativa, snapshot do provedor e imagens web/print |
| `Bid` | Licitante, lote, valor, idempotência e elegibilidade; ser superado não desativa o lance |
| `AuctionResult` | Vencedor, vendedor, lance vencedor e datas de encerramento/liquidação |
| `AuditEvent` | Estrutura genérica de eventos com antes/depois; não é a prova de integridade dos lances |
| `BidAuditEntry` | Snapshot aceito com sequência, hash anterior, hash atual, pseudônimo, valor e prazo |
| `BidAuditHistory` | Evidência suplementar gerenciada por triggers, com operação, transação e linhas antes/depois |

Um usuário pode possuir lotes e participar de vários outros. Um lote tem itens e lances; a publicação atual seleciona **uma obra**. Cada lance pode ter uma reserva. Um resultado vincula lote, proprietário e lance vencedor; seu pagamento gera duas movimentações ligadas pelo mesmo `transferId`.

## Saldos e liquidação

```text
saldo total        = créditos − débitos do extrato
saldo comprometido = soma das reservas ativas
saldo disponível   = saldo total − saldo comprometido
```

Ao aceitar um lance, a transação libera a reserva do líder anterior e cria a nova. Ao liquidar, grava compra e venda, captura a reserva e confirma o vencedor. Lotes sem lances encerram sem criar um resultado com vencedor fictício.

Os valores monetários usam `Decimal(19,2)`; datas usam `timestamptz`. A API transporta dinheiro como string decimal para evitar arredondamentos de ponto flutuante.

## Restrições importantes

- E-mail, carteira por usuário, reserva por lance e resultado por lote são únicos.
- Lances e movimentações têm chaves únicas de idempotência; a API valida a repetição do mesmo pedido.
- Chaves compostas do resultado garantem que o proprietário pertença ao lote e que o lance corresponda ao lote e ao vencedor.
- `(auctionResultId, type)` limita as movimentações por tipo para um resultado; `(lotId, articArtworkId)` impede duplicar a referência de obra no mesmo lote.
- O schema preserva a maioria das relações com `Restrict`. Sessões são removidas com o usuário; snapshots de lance, com o lote. A evidência de triggers não tem FK com exclusão em cascata.
- Permissões, saldo suficiente, incremento e janela de tempo são regras dos serviços, não garantias derivadas apenas das FKs.

## Estados

| Enum | Valores |
| --- | --- |
| `UserRole` | `admin`, `bidder`, `auctioneer` |
| `LotStatus` | `draft`, `scheduled`, `open`, `closed`, `cancelled` |
| `WalletHoldStatus` | `active`, `released`, `captured` |
| `WalletTransactionType` | `deposit`, `withdrawal`, `auction_purchase`, `auction_sale`, `refund` |

Ter um valor no enum não significa ter uma operação pública: saques e reembolsos não têm fluxo implementado. O cadastro público não cria administradores.

## Metadados e evolução

`Item.imageUrl` guarda o JPEG web; `printImageUrl`, o JPEG de maior resolução para o navegador. A sala mostra web primeiro e troca após decodificar print; se falhar, mantém web. TIFF não é persistido. O snapshot inclui identificação do provedor e data de consulta.

Os nomes `articArtworkId` e `articImageId` são legados do schema; o catálogo atual é Cleveland. Renomeá-los exige migration compatível, não mudança no significado dos IDs.

As [migrations](../backend/prisma/migrations/) registram a evolução SQL, inclusive triggers e restrições que não aparecem integralmente no Prisma. Use `migrate deploy` para aplicá-las. O [seed](../backend/prisma/seed.ts) lê JSONs por entidade dentro de uma transação, sem apagar registros existentes. Comandos e contas estão no README.
