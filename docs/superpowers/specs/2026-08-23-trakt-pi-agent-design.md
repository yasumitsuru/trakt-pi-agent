# Trakt Pi Agent — Design Specification

> **Phase:** Planning (Phase 0)
> **Date:** 2026-08-23
> **Status:** Approved — awaiting implementation

---

## English

### 1. Project Overview

**Trakt Pi Agent** is an unofficial, read-only [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/modelcontextprotocol) server for [Trakt.tv](https://trakt.tv). It provides standardized tools for querying Trakt account data (history, progress, watchlist, calendar, search) with local SQLite caching and automatic Movies/Series/Anime categorization.

This project is designed to work with any MCP-compatible client:

- Pi Agent
- Codex
- Claude
- Other MCP clients

### 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| Runtime | Node.js |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Transport | `stdio` |
| Database | SQLite |
| CLI Dependency | `trakt-cli` (from [omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)) |

### 3. Architecture

```
MCP Client
Pi / Codex / Claude / etc.
          |
          v
    trakt-pi-agent
          |
   +------+-----------+
   |                  |
SQLite Cache       Sync Engine
   |                  |
   |          +-------+-------+
   |          |               |
   |      TraktCLI        Trakt API
   |          |         read-only only
   |          |               |
   +----------+---------------+
```

#### 3.1 MCP Layer

Exposes standardized MCP tools. No client-specific logic.

#### 3.2 TraktCLI Adapter

Executes and interprets `trakt-cli` commands. Locates via PATH.

#### 3.3 Trakt API Adapter

Uses only read-only API endpoints not adequately exposed by the CLI.
Important case: `/sync/last_activities`

#### 3.4 SQLite Cache

Stores normalized data locally in a single SQLite database.

#### 3.5 Sync Engine

Controls:

- First (initial) synchronization
- Incremental synchronization
- TTL (default: 5 minutes; configurable in v1)
- Resource state tracking
- Cache fallback

#### 3.6 Classification

Classifies content as:

- `movie`
- `series`
- `anime`

### 4. Movies / Series / Anime Classification

Two separate concepts must be preserved:

```
trakt_type:
  movie
  show
```

```
category:
  movie
  series
  anime
```

Rules:

| trakt_type | genre includes anime | category |
|------------|---------------------|----------|
| movie      | yes                 | anime    |
| movie      | no                  | movie    |
| show       | yes                 | anime    |
| show       | no                  | series   |

In v1, classification uses **Trakt metadata only**. No AniList, TMDB, or external APIs.

### 5. Cache

Single SQLite database.

#### 5.1 Data Directories

| Platform | Directory |
|----------|-----------|
| Windows | `%LOCALAPPDATA%\trakt-pi-agent\` |
| Linux | `~/.local/share/trakt-pi-agent/` |
| macOS | `~/Library/Application Support/trakt-pi-agent/` |

#### 5.2 Local Files

```
trakt-cache.db
config.json
logs/
```

No sensitive data in these files.

### 6. Data Model

#### 6.1 Media

```
media
- trakt_id (PK)
- trakt_type
- category
- title
- year
- genres
- metadata_updated_at
- cached_at
```

#### 6.2 History

```
history
- id (PK)
- media_id (FK → media)
- season
- episode
- watched_at
- trakt_history_id
```

#### 6.3 Progress

```
progress
- media_id (PK, FK → media)
- aired
- watched
- remaining
- percent
- next_episode
```

#### 6.4 Watchlist

```
watchlist
- media_id (PK, FK → media)
- listed_at
```

#### 6.5 Sync State

```
sync_state
- resource (PK)
- last_activity
- last_sync
- status
```

#### 6.6 Search Cache

```
search_cache
- query_hash (PK)
- query
- response
- expires_at
```

Versioned migrations from v1 onward.

### 7. Synchronization

#### 7.1 Default TTL

The default synchronization check TTL is 5 minutes and MUST be user-configurable in v1.

#### 7.2 First Synchronization

Not automatic on MCP startup. Lazy / on-demand.

```
first tool requiring data
        |
cache not initialized
        |
full initial sync
        |
SQLite
```

#### 7.3 Subsequent Synchronizations

Incremental sync using `/sync/last_activities`.

```
query
   |
cache < 5 min?
 |          |
yes        no
 |          |
SQLite     last_activities
              |
          changed?
          |     |
         no    yes
          |     |
       cache   sync only
               changed resources
```

Not relying exclusively on `watched_at` because:

- Old items may be added later
- Items may be removed
- Retroactive changes must be detected

#### 7.4 Offline Behavior

If cache exists and Trakt is unavailable:

- Respond from local cache
- Indicate data may be stale

```json
{
  "source": "cache",
  "stale": true,
  "last_sync": "...",
  "items": []
}
```

If no initial cache and Trakt is unavailable:

- Return clear error

### 8. MCP Tools (Planned for v1)

| Tool | Description |
|------|-------------|
| `trakt_history` | Query watch history |
| `trakt_progress` | Query media progress |
| `trakt_watchlist` | Query watchlist |
| `trakt_calendar` | Query calendar events |
| `trakt_search` | Search Trakt content |
| `trakt_sync` | Trigger synchronization |
| `trakt_sync_status` | Check sync status |
| `trakt_cache_stats` | View cache statistics |

#### 8.1 Filters

Where applicable:

```
category:
  all
  movie
  series
  anime
```

Example:

```
trakt_history(
  category = "anime",
  limit = 50
)
```

No separate tools per category (e.g., `trakt_anime_history`). Use filters.

#### 8.2 Response Limits

To protect LLM context windows:

```
default limit = 50
maximum limit = 250
```

No tool dumps thousands of records by default.

### 9. Security and Authentication

TraktCLI stores authentication in `~/.trakt.yaml`.

The MCP server may **read locally** this file to reuse authentication for read-only operations not directly exposed by the CLI.

#### Mandatory Rules

- Never copy tokens to SQLite
- Never version-control `.trakt.yaml`
- Never put access token in logs
- Never put refresh token in logs
- Never put client ID in logs
- Never put client secret in logs
- Never return these credentials via MCP tools
- Never send credentials to external services other than Trakt

#### v1 Read-Only Guarantee

No tools for:

- Adding history
- Removing history
- Adding watchlist
- Removing watchlist
- Ratings
- Check-in
- Scrobble
- Any remote mutation

`trakt_sync` may only modify the local SQLite cache.

### 10. Planned Project Structure

```
src/
├── mcp/
│   ├── server.ts
│   └── tools/
├── trakt/
│   ├── cli.ts
│   ├── api.ts
│   ├── auth.ts
│   └── types.ts
├── sync/
│   ├── initial-sync.ts
│   ├── incremental-sync.ts
│   └── last-activities.ts
├── cache/
│   ├── database.ts
│   ├── migrations.ts
│   └── repositories/
├── classification/
│   └── media-category.ts
├── config/
│   ├── paths.ts
│   └── config.ts
└── index.ts
```

Not all files need to be created empty. Scaffold as needed.

### 11. Testing Plan

#### 11.1 Unit Tests

- Movies / Series / Anime classification
- TTL logic
- Cache rules
- Cross-platform paths
- TraktCLI parsing
- MCP filters

#### 11.2 Integration Tests

- SQLite
- Migrations
- Initial sync
- Incremental sync
- Stale-cache behavior

#### 11.3 Contract Tests

- MCP tool schemas
- Structured responses

#### 11.4 Smoke Tests

- stdio server starts
- MCP tools/list works

Automated tests must **not** use the developer's real Trakt account. Use fixtures/mocks.

Live testing must be explicitly opt-in:

```
npm run test:live
```

### 12. CI (Planned)

GitHub Actions to test:

- Windows
- Linux
- macOS

And run:

```
lint
typecheck
test
build
```

### 13. TraktCLI Dependency

External dependency:

- **Repository:** [omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)
- **Executable:** `trakt-cli` / `trakt-cli.exe`

The MCP server must:

1. Locate `trakt-cli` via PATH
2. Allow configured explicit path (v1)
3. Validate existence before dependent operations

#### Repository Rules

- Do NOT copy TraktCLI code
- Do NOT redistribute its executable in v1
- Do NOT embed credentials in code
- Require user to have TraktCLI pre-installed and authenticated

### 14. Credits

This project depends on and acknowledges:

- **[omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)** — TraktCLI tool for authentication and Trakt.tv interaction. Thank you, Omar and all contributors.
- **[angristan/trakt-cli](https://github.com/angristan/trakt-cli)** — the upstream project that inspired this work.

No official affiliation is implied.

### 15. Disclaimer

> Trakt and Trakt.tv are trademarks of their respective owner. This project is unofficial and is not affiliated with, endorsed by, or sponsored by Trakt, Inc.

### 16. License

MIT License.

### 17. Error Handling Strategy

#### 17.1 Cache Available + Trakt Unavailable

Respond using local SQLite with stale indicator:

```json
{
  "source": "cache",
  "stale": true,
  "last_sync": "...",
  "items": []
}
```

#### 17.2 No Cache + Trakt Unavailable

Return a clear error indicating that no data is available and the Trakt service is unreachable.

#### 17.3 Authentication Error

Do not expose tokens. Return a sanitized error indicating that TraktCLI authentication needs to be renewed or revalidated.

#### 17.4 Invalid TraktCLI Data

Do not silently write partially interpreted data to SQLite. Fail the synchronization operation for that resource with a sanitized error.

---

## Português (PT-BR)

### 1. Visão Geral do Projeto

**Trakt Pi Agent** é um servidor MCP (Model Context Protocol) não oficial e somente leitura para [Trakt.tv](https://trakt.tv). Fornece ferramentas padronizadas para consultar dados da conta Trakt (histórico, progresso, watchlist, calendário, pesquisa) com cache SQLite local e categorização automática de Filmes/Séries/Animes.

Projetado para funcionar com qualquer cliente compatível com MCP:

- Pi Agent
- Codex
- Claude
- Outros clientes MCP

### 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Linguagem | TypeScript |
| Runtime | Node.js |
| SDK MCP | `@modelcontextprotocol/sdk` |
| Transporte | `stdio` |
| Banco de dados | SQLite |
| Dependência CLI | `trakt-cli` (de [omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)) |

### 3. Arquitetura

```
Cliente MCP
Pi / Codex / Claude / etc.
          |
          v
    trakt-pi-agent
          |
   +------+-----------+
   |                  |
Cache SQLite      Motor de Sincronização
   |                  |
   |          +-------+-------+
   |          |               |
   |      TraktCLI       API Trakt
   |          |         (somente leitura)
   +----------+---------------+
```

#### 3.1 Camada MCP

Expõe ferramentas MCP padronizadas. Sem lógica específica de cliente.

#### 3.2 Adaptador TraktCLI

Executa e interpreta comandos `trakt-cli`. Localiza via PATH.

#### 3.3 Adaptador API Trakt

Utiliza apenas endpoints somente leitura não adequadamente expostos pelo CLI.
Caso importante: `/sync/last_activities`

#### 3.4 Cache SQLite

Armazena dados normalizados localmente em um único banco SQLite.

#### 3.5 Motor de Sincronização

Controla:

- Primeira (inicial) sincronização
- Sincronização incremental
- TTL (padrão: 5 minutos; configurável na v1)
- Rastreamento de estado dos recursos
- Fallback para cache

#### 3.6 Classificação

Classifica conteúdo como:

- `movie`
- `series`
- `anime`

### 4. Classificação Filmes / Séries / Animes

Dois conceitos separados devem ser preservados:

```
trakt_type:
  movie
  show
```

```
category:
  movie
  series
  anime
```

Regras:

| trakt_type | gênero inclui anime | category |
|------------|---------------------|----------|
| movie      | sim                 | anime    |
| movie      | não                 | movie    |
| show       | sim                 | anime    |
| show       | não                 | series   |

Na v1, classificação usa **apenas metadados do Trakt**. Sem AniList, TMDB ou APIs externas.

### 5. Cache

Único banco SQLite.

#### 5.1 Diretórios de Dados

| Plataforma | Diretório |
|------------|-----------|
| Windows | `%LOCALAPPDATA%\trakt-pi-agent\` |
| Linux | `~/.local/share/trakt-pi-agent/` |
| macOS | `~/Library/Application Support/trakt-pi-agent/` |

#### 5.2 Arquivos Locais

```
trakt-cache.db
config.json
logs/
```

Sem dados sensíveis nesses arquivos.

### 6. Modelo de Dados

#### 6.1 Media

```
media
- trakt_id (PK)
- trakt_type
- category
- title
- year
- genres
- metadata_updated_at
- cached_at
```

#### 6.2 History

```
history
- id (PK)
- media_id (FK → media)
- season
- episode
- watched_at
- trakt_history_id
```

#### 6.3 Progress

```
progress
- media_id (PK, FK → media)
- aired
- watched
- remaining
- percent
- next_episode
```

#### 6.4 Watchlist

```
watchlist
- media_id (PK, FK → media)
- listed_at
```

#### 6.5 Sync State

```
sync_state
- resource (PK)
- last_activity
- last_sync
- status
```

#### 6.6 Search Cache

```
search_cache
- query_hash (PK)
- query
- response
- expires_at
```

Migrations versionadas da v1 em diante.

### 7. Sincronização

#### 7.1 TTL Padrão

O TTL padrão de verificação de sincronização é de 5 minutos e DEVE ser configurável pelo usuário na v1.

#### 7.2 Primeira Sincronização

Não automática no startup do MCP. Lazy / on-demand.

```
primeira ferramenta que precisa de dados
        |
cache não inicializado
        |
sincronização inicial completa
        |
SQLite
```

#### 7.3 Sincronizações Subsequentes

Sincronização incremental usando `/sync/last_activities`.

```
consulta
   |
cache < 5 min?
 |          |
sim        não
 |          |
SQLite     last_activities
              |
          mudou?
          |     |
         não   sim
          |     |
       cache   sincroniza apenas
               recursos alterados
```

Não confiar exclusivamente em `watched_at` porque:

- Itens antigos podem ser adicionados posteriormente
- Itens podem ser removidos
- Mudanças retroativas precisam ser detectadas

#### 7.4 Comportamento Offline

Se cache existe e Trakt indisponível:

- Responder do cache local
- Indicar que dados podem estar desatualizados

```json
{
  "source": "cache",
  "stale": true,
  "last_sync": "...",
  "items": []
}
```

Se não há cache inicial e Trakt indisponível:

- Retornar erro claro

### 8. Ferramentas MCP (Planejadas para v1)

| Ferramenta | Descrição |
|------------|-----------|
| `trakt_history` | Consultar histórico |
| `trakt_progress` | Consultar progresso |
| `trakt_watchlist` | Consultar watchlist |
| `trakt_calendar` | Consultar calendário |
| `trakt_search` | Pesquisar conteúdo Trakt |
| `trakt_sync` | Acionar sincronização |
| `trakt_sync_status` | Verificar status sync |
| `trakt_cache_stats` | Ver estatísticas do cache |

#### 8.1 Filtros

Onde aplicável:

```
category:
  all
  movie
  series
  anime
```

Exemplo:

```
trakt_history(
  category = "anime",
  limit = 50
)
```

Sem ferramentas separadas por categoria (ex.: `trakt_anime_history`). Usar filtros.

#### 8.2 Limites de Resposta

Para proteger janelas de contexto dos LLMs:

```
default limit = 50
maximum limit = 250
```

Nenhuma ferramenta deve despejar milhares de registros por padrão.

### 9. Segurança e Autenticação

TraktCLI armazena autenticação em `~/.trakt.yaml`.

O servidor MCP poderá **ler localmente** este arquivo para reutilizar autenticação em operações somente leitura não expostas diretamente pelo CLI.

#### Regras Obrigatórias

- Nunca copiar tokens para SQLite
- Nunca versionar `.trakt.yaml`
- Nunca colocar access token em logs
- Nunca colocar refresh token em logs
- Nunca colocar client ID em logs
- Nunca colocar client secret em logs
- Nunca retornar essas credenciais via ferramentas MCP
- Nunca enviar credenciais para serviços externos que não sejam o próprio Trakt

#### Garantia Somente Leitura da v1

Sem ferramentas para:

- Adicionar histórico
- Remover histórico
- Adicionar watchlist
- Remover watchlist
- Ratings
- Check-in
- Scrobble
- Qualquer mutação remota

`trakt_sync` pode modificar apenas o cache SQLite local.

### 10. Estrutura Planejada do Projeto

```
src/
├── mcp/
│   ├── server.ts
│   └── tools/
├── trakt/
│   ├── cli.ts
│   ├── api.ts
│   ├── auth.ts
│   └── types.ts
├── sync/
│   ├── initial-sync.ts
│   ├── incremental-sync.ts
│   └── last-activities.ts
├── cache/
│   ├── database.ts
│   ├── migrations.ts
│   └── repositories/
├── classification/
│   └── media-category.ts
├── config/
│   ├── paths.ts
│   └── config.ts
└── index.ts
```

Nem todos os arquivos precisam ser criados vazios. Scaffold conforme necessário.

### 11. Plano de Testes

#### 11.1 Testes Unitários

- Classificação Filmes / Séries / Animes
- Lógica de TTL
- Regras de cache
- Caminhos multiplataforma
- Parsing de TraktCLI
- Filtros MCP

#### 11.2 Testes de Integração

- SQLite
- Migrations
- Sincronização inicial
- Sincronização incremental
- Comportamento de cache stale

#### 11.3 Testes de Contrato

- Schemas de ferramentas MCP
- Respostas estruturadas

#### 11.4 Testes Smoke

- Servidor stdio inicia
- MCP tools/list funciona

Testes automatizados **não devem** usar a conta real de Trakt do desenvolvedor. Usar fixtures/mocks.

Teste live deve ser explicitamente opt-in:

```
npm run test:live
```

### 12. CI (Planejado)

GitHub Actions para testar:

- Windows
- Linux
- macOS

E executar:

```
lint
typecheck
test
build
```

### 13. Dependência TraktCLI

Dependência externa:

- **Repositório:** [omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)
- **Executável:** `trakt-cli` / `trakt-cli.exe`

O servidor MCP deve:

1. Localizar `trakt-cli` via PATH
2. Permitir caminho explícito configurado (v1)
3. Validar existência antes de operações dependentes

#### Regras do Repositório

- NÃO copiar código TraktCLI
- NÃO redistribuir seu executável na v1
- NÃO embutir credenciais no código
- Exigir que o usuário tenha TraktCLI pré-instalado e autenticado

### 14. Créditos

Este projeto depende e reconhece:

- **[omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)** — ferramenta TraktCLI para autenticação e interação com Trakt.tv. Obrigado, Omar e todos os contribuidores.
- **[angristan/trakt-cli](https://github.com/angristan/trakt-cli)** — o projeto upstream que inspirou este trabalho.

Nenhuma afiliação oficial é implícita.

### 15. Aviso

> Trakt e Trakt.tv são marcas de seus respectivos proprietários. Este é um projeto não oficial e não possui afiliação, endosso ou patrocínio da Trakt, Inc.

### 16. Licença

Licença MIT.

### 17. Estratégia de Tratamento de Erros

#### 17.1 Cache Disponível + Trakt Indisponível

Responder usando SQLite local com indicador stale:

```json
{
  "source": "cache",
  "stale": true,
  "last_sync": "...",
  "items": []
}
```

#### 17.2 Sem Cache + Trakt Indisponível

Retornar erro claro indicando que não há dados disponíveis e o serviço Trakt é inacessível.

#### 17.3 Erro de Autenticação

Não expor tokens. Retornar erro sanitizado indicando que a autenticação TraktCLI precisa ser renovada ou revalidada.

#### 17.4 Dados Inválidos do TraktCLI

Não gravar dados parcialmente interpretados silenciosamente no SQLite. Falhar a operação de sincronização daquele recurso com erro sanitizado.

---

*Document created: 2026-08-23*
*Approved by: project author*
*Next phase: Implementation (Phase 1)*
