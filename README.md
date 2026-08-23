# Trakt Pi Agent

> **Unofficial read-only Trakt.tv MCP server with SQLite caching and Movies/Series/Anime categorization.**
> **Servidor MCP não oficial e somente leitura para Trakt.tv, com cache SQLite e categorização Filmes/Séries/Animes.**

---

## English

**Status:** 📋 Planning

Trakt Pi Agent is an unofficial, read-only [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/modelcontextprotocol) server for [Trakt.tv](https://trakt.tv). It provides standardized tools for querying Trakt account data (history, progress, watchlist, calendar, search) with local SQLite caching and automatic Movies/Series/Anime categorization.

### Scope (v1)

- MCP tools for read-only Trakt data access
- SQLite-based local caching with incremental sync
- Movies / Series / Anime classification
- Multi-platform support (Windows, Linux, macOS)
- Compatible with MCP clients: Pi Agent, Codex, Claude, and others

### Architecture

```
MCP Client (Pi / Codex / Claude / …)
          |
    trakt-pi-agent
          |
   +------+-----------+
   |                  |
SQLite Cache       Sync Engine
   |                  |
   |          +-------+-------+
   |          |               |
   |      TraktCLI        Trakt API
   |          |         (read-only)
   +----------+---------------+
```

### TraktCLI Dependency

This project depends on **[omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)** for authentication and Trakt.tv interaction. Users must have `trakt-cli` installed and authenticated before use.

> ⚠️ This project does **not** bundle, copy, or redistribute TraktCLI.

### Security

- **Read-only only.** No tools for adding/removing history, watchlist, ratings, check-ins, scrobbling, or any remote mutation.
- Credentials from `~/.trakt.yaml` are read locally only; never logged, never cached, never returned via MCP.
- Offline mode returns stale cache with a `stale: true` indicator.

### Credits

This project is built on top of:

- **[omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)** — the TraktCLI tool used for authentication and Trakt.tv interaction. Thank you, Omar and contributors.
- **[angristan/trakt-cli](https://github.com/angristan/trakt-cli)** — the upstream project that inspired this work.

### License

MIT License — see [LICENSE](./LICENSE)

### Disclaimer

> Trakt and Trakt.tv are trademarks of their respective owner. This project is unofficial and is not affiliated with, endorsed by, or sponsored by Trakt, Inc.

---

## Português (PT-BR)

**Status:** 📋 Em planejamento

Trakt Pi Agent é um servidor MCP (Model Context Protocol) não oficial e somente leitura para [Trakt.tv](https://trakt.tv). Fornece ferramentas padronizadas para consultar dados da conta Trakt (histórico, progresso, watchlist, calendário, pesquisa) com cache SQLite local e categorização automática de Filmes/Séries/Animes.

### Escopo (v1)

- Ferramentas MCP para acesso somente leitura aos dados de Trakt
- Cache local baseado em SQLite com sincronização incremental
- Classificação Filmes / Séries / Animes
- Suporte multiplataforma (Windows, Linux, macOS)
- Compatível com clientes MCP: Pi Agent, Codex, Claude e outros

### Arquitetura

```
Cliente MCP (Pi / Codex / Claude / …)
          |
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

### Dependência: TraktCLI

Este projeto depende de **[omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)** para autenticação e interação com Trakt.tv. O usuário deve ter `trakt-cli` instalado e autenticado antes de usar.

> ⚠️ Este projeto **não** empaceta, copia ou redistribui o TraktCLI.

### Segurança

- **Apenas leitura.** Nenhuma ferramenta para adicionar/remover histórico, watchlist, ratings, check-ins, scrobble ou qualquer mutação remota.
- Credenciais de `~/.trakt.yaml` são lidas localmente; nunca logueadas, nunca em cache, nunca retornadas via MCP.
- Modo offline retorna cache desatualizado com indicador `stale: true`.

### Créditos

Este projeto é construído com base em:

- **[omarshahine/trakt-plugin](https://github.com/omarshahine/trakt-plugin)** — a ferramenta TraktCLI usada para autenticação e interação com Trakt.tv. Obrigado, Omar e contribuidores.
- **[angristan/trakt-cli](https://github.com/angristan/trakt-cli)** — o projeto upstream que inspirou este trabalho.

### Licença

Licença MIT — veja [LICENSE](./LICENSE)

### Aviso

> Trakt e Trakt.tv são marcas de seus respectivos proprietários. Este é um projeto não oficial e não possui afiliação, endosso ou patrocínio da Trakt, Inc.

---

## Specification

Full architecture and design specification: [docs/superpowers/specs/2026-08-23-trakt-pi-agent-design.md](./docs/superpowers/specs/2026-08-23-trakt-pi-agent-design.md)
