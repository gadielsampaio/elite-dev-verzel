# Plataforma de Leilões — Desafio Técnico Elite Dev | Verzel

Aplicação de leilões com catálogo de obras obtido de uma API externa, lances em tempo real, carteira virtual e histórico auditável. O projeto prioriza **consistência dos dados, rastreabilidade e simplicidade de manutenção**, evitando complexidade desnecessária.

## Tecnologias

- **NestJS + TypeScript:** estrutura modular, injeção de dependências e recursos nativos para validação e organização da API.
- **PostgreSQL + Prisma:** persistência relacional, tipagem e transações para operações críticas.
- **WebSocket:** atualização de eventos e lances em tempo real.
- **Docker Compose:** ambiente local reproduzível para os serviços.
- **Testes unitários:** validação isolada das regras de negócio.

## Decisões de arquitetura

Foi adotada uma arquitetura modular, com responsabilidades bem definidas. O objetivo foi usar padrões onde eles resolvem problemas concretos, sem adicionar abstrações apenas por formalidade.

| Padrão | Aplicação | Benefício |
| --- | --- | --- |
| **Facade** | Orquestração dos fluxos de negócio, como lances e encerramento de leilões | Centraliza operações que envolvem múltiplos serviços e simplifica seu consumo |
| **Adapter** | Integração com o catálogo de obras externo | Isola o formato da API terceira e permite substituir o provedor sem alterar a regra de negócio |
| **Observer** | Publicação de eventos de leilão para clientes conectados via WebSocket | Desacopla ações de negócio da entrega de atualizações em tempo real |

### Histórico auditável

O histórico auditável foi um dos principais desafios do projeto, especialmente pela necessidade de registrar operações de **criação, atualização e exclusão**. Após avaliar alternativas, optei por uma **tabela de auditoria no PostgreSQL alimentada por triggers**.

Essa abordagem registra as operações diretamente no banco de dados, inclusive exclusões, sem depender de chamadas explícitas dos serviços da aplicação. A solução concentra a responsabilidade da auditoria em um só lugar e reduz o risco de algum fluxo deixar de registrar uma alteração.

A auditoria permite rastrear as operações cobertas pelas triggers, mas não constitui, por si só, um mecanismo à prova de adulterações por usuários com acesso privilegiado ao banco.

## Desafios e aprendizados

- **API externa:** a integração inicialmente prevista com a API do Art Institute of Chicago apresentou bloqueios relacionados ao Cloudflare. Durante a investigação, foram encontrados relatos públicos do problema no GitHub. O uso do Adapter facilitou a substituição da fonte de dados e a normalização dos campos consumidos pela aplicação.
- **Auditoria:** como era um requisito com o qual eu não havia trabalhado diretamente, estudei diferentes abordagens e adotei uma tabela de auditoria com triggers no PostgreSQL. Isso permitiu registrar alterações e exclusões diretamente na camada de persistência, com menos acoplamento à aplicação.
- **WebSocket:** tive a oportunidade de aplicar comunicação em tempo real em um fluxo de leilões, aprofundando meu conhecimento sobre eventos e atualização dos clientes.
- **NestJS:** optei por explorar o framework por seus recursos nativos, organização e padrões amplamente utilizados na indústria. Isso reduziu o código de infraestrutura e manteve o foco nas regras de negócio.
- **Testes:** priorizei a testabilidade dos serviços e a cobertura das regras críticas com testes unitários.

## Execução local

**Pré-requisitos:** Docker e Docker Compose. Execute na raiz do repositório:

```bash
cp .env.example .env
# Configure POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB e JWT_SECRET no .env.
# Para gerar um JWT_SECRET: openssl rand -hex 32
docker compose up -d --build
docker compose exec api npx prisma migrate deploy --config prisma7.config.ts
docker compose exec api npx prisma generate --config prisma7.config.ts
```

Frontend: <http://127.0.0.1:5175> · API: <http://localhost:3000>

**Testes unitários:** `docker compose exec api npm test`.
Para parar sem remover os dados: `docker compose stop`.
