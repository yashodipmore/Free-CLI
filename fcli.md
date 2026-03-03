# Free-CLI — Enterprise-Grade AI Terminal Agent
### Complete Development Blueprint · Built on Groq LPU × Next.js × Node.js

> **Vision:** A fully open-source, blazing-fast AI CLI agent powered by Groq's LPU inference — installable via a single `npx` command, working like Claude Code and Gemini CLI, but free, faster, and yours.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Why This Will Shock Everyone](#2-why-this-will-shock-everyone)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Core Modules & Design](#6-core-modules--design)
7. [Feature Set](#7-feature-set)
8. [API & Integrations](#8-api--integrations)
9. [Environment Variables & Secrets](#9-environment-variables--secrets)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [MCP Protocol Design](#11-mcp-protocol-design)
12. [ReAct Agent Loop](#12-react-agent-loop)
13. [CLI Commands Reference](#13-cli-commands-reference)
14. [NPM Distribution Strategy](#14-npm-distribution-strategy)
15. [Configuration System](#15-configuration-system)
16. [Security Architecture](#16-security-architecture)
17. [Testing Strategy](#17-testing-strategy)
18. [Development Phases & Milestones](#18-development-phases--milestones)
19. [Performance Benchmarks](#19-performance-benchmarks)
20. [Contribution & GSOC Showcase Notes](#20-contribution--gsoc-showcase-notes)

---

## 1. Project Overview

**Name:** `free-cli` (or brand it as `fcli` — short, punchy, developer-friendly)

**Tagline:** *"Your terminal. Your AI. Groq fast."*

**What it is:** A terminal-native, agentic AI assistant that runs on Groq's LPU infrastructure. It can read your codebase, execute shell commands, write and edit files, browse the web (via MCP), and reason across complex multi-step tasks — all at 300+ tokens/second, for free.

**One-line install:**
```
npx free-cli@latest
```

After this single command runs in any terminal on the planet, `fcli` is permanently available as a global CLI command. That's the "shock moment."

**What makes it different from Gemini CLI & Claude Code:**

| Feature | Claude Code | Gemini CLI | **Free-CLI (fcli)** |
|---|---|---|---|
| Cost | Paid (Anthropic) | Free (limited) | **100% Free (Groq)** |
| Speed | Fast | Fast | **Fastest (LPU, 300+ t/s)** |
| Open Source | No | Yes | **Yes** |
| Self-hostable | No | No | **Yes** |
| Offline mode | No | No | **Yes (local Ollama fallback)** |
| Model choice | Claude only | Gemini only | **Multi-model** |
| Next.js powered | No | No | **Yes (web dashboard)** |

---

## 2. Why This Will Shock Everyone

When a GSOC reviewer runs:

```bash
npx free-cli@latest
```

Here is what happens in sequence on their laptop:

- Their terminal transforms into a full-screen interactive AI agent with a rich TUI (Terminal UI)
- They get prompted to enter their free Groq API key (takes 30 seconds to get one)
- Instantly, `fcli` command is available globally — no install, no setup, no Docker
- The AI can see their filesystem, run code, answer questions, and chain multi-step tasks
- A live web dashboard opens at `localhost:3001` (Next.js) showing conversation history, token usage, and tool call traces — something neither Gemini CLI nor Claude Code has

This is the "shocked" moment. No one else has a free, open-source AI CLI with a Next.js web companion dashboard.

---

## 3. Technology Stack

### Core Runtime
- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5.x (strict mode, full type safety)
- **Package Manager:** pnpm (monorepo-optimized, fast)
- **Monorepo Tool:** Turborepo (parallel builds, caching)

### CLI Layer
- **CLI Framework:** Commander.js v12 (command parsing, subcommands, help generation)
- **Terminal UI:** Ink v5 (React-based TUI — same as used in major enterprise CLIs)
- **Interactive Prompts:** @inquirer/prompts (modern, async-first Inquirer)
- **Styling:** Chalk v5 + Gradient-string (colors, gradients in terminal)
- **Spinners & Progress:** Ora v8 (elegant loading states)
- **Markdown Rendering:** Marked + cli-highlight (render AI responses as formatted terminal markdown)
- **Diff Viewer:** diff2html-cli (show file diffs inline in terminal)
- **Fuzzy Search:** fzf.js (fuzzy file/command search)
- **Box Drawing:** Boxen (beautiful terminal boxes for output)

### AI / Intelligence Layer
- **Primary LLM Provider:** Groq SDK (`groq-sdk`) — free, fastest inference
- **Fallback Provider:** Ollama (local models, offline mode)
- **Secondary Fallback:** OpenRouter (access to 50+ free models)
- **Agentic Loop:** Custom ReAct (Reason + Act) implementation
- **Tool Calling:** Groq's native function calling API
- **Context Management:** Custom sliding-window context with smart summarization

### Web Dashboard (Next.js)
- **Framework:** Next.js 15 (App Router)
- **UI Library:** shadcn/ui + Tailwind CSS v4
- **Real-time:** Socket.io (live streaming from CLI to dashboard)
- **Charts:** Recharts (token usage, latency graphs)
- **Code Display:** Shiki (syntax highlighting)
- **State Management:** Zustand

### Storage & Config
- **Local Config:** Configstore v6 (cross-platform config at `~/.free-cli/config.json`)
- **Session History:** SQLite via `better-sqlite3` (fast, zero-config, file-based)
- **Vector Memory (optional):** `@xenova/transformers` local embeddings + `vectra` (local vector store, no API needed)
- **File Watching:** Chokidar v4

### DevOps & Distribution
- **Testing:** Vitest (unit) + Playwright (E2E web) + custom CLI test harness
- **Linting:** ESLint v9 + Prettier
- **Type Checking:** `tsc --noEmit` as CI gate
- **Bundling CLI:** `tsup` (fast TypeScript bundler)
- **Bundling Web:** Next.js built-in
- **CI/CD:** GitHub Actions
- **Publishing:** npm (public, free)
- **Versioning:** Changesets

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S TERMINAL                          │
│                                                                 │
│   $ fcli "refactor my auth module"                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CLI ENTRY LAYER                        │  │
│  │   Commander.js → Argument Parser → Command Router         │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   AGENT CORE ENGINE                       │  │
│  │                                                           │  │
│  │   ┌─────────────┐    ┌──────────────┐   ┌────────────┐  │  │
│  │   │  PLANNER    │───▶│  TOOL ROUTER │──▶│  EXECUTOR  │  │  │
│  │   │ (ReAct Loop)│    │ (MCP + Built-│   │(Sandboxed) │  │  │
│  │   └─────────────┘    │  in Tools)   │   └────────────┘  │  │
│  │          ▲           └──────────────┘         │         │  │
│  │          │                                     │         │  │
│  │   ┌──────┴──────────────────────────────────── ▼──────┐  │  │
│  │   │              CONTEXT MANAGER                      │  │  │
│  │   │  (Conversation + File Context + Memory Window)    │  │  │
│  │   └────────────────────────────────────────────────────┘  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   GROQ LLM LAYER                          │  │
│  │   groq-sdk → Streaming Chat → Tool Call Parsing           │  │
│  │   Model: llama-3.3-70b-versatile (primary)               │  │
│  │   Fallback: llama-3.1-8b-instant (fast/cheap)            │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   OUTPUT RENDERER                         │  │
│  │   Ink TUI → Markdown Renderer → Diff Viewer → Streaming  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  IPC / Socket.io
┌───────────────────────────▼─────────────────────────────────────┐
│              NEXT.JS WEB DASHBOARD (localhost:3001)              │
│  Live Conversation │ Tool Call Traces │ Token Usage │ History    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Monorepo Structure

```
free-cli/
├── packages/
│   ├── cli/                        # Core CLI package (published as 'free-cli')
│   │   ├── src/
│   │   │   ├── bin/
│   │   │   │   └── fcli.ts           # Entry point — #!/usr/bin/env node
│   │   │   ├── commands/
│   │   │   │   ├── chat.ts         # Interactive chat mode
│   │   │   │   ├── run.ts          # One-shot headless mode
│   │   │   │   ├── config.ts       # Config management
│   │   │   │   ├── mcp.ts          # MCP server management
│   │   │   │   ├── memory.ts       # Memory/context management
│   │   │   │   ├── history.ts      # Conversation history
│   │   │   │   └── doctor.ts       # Environment diagnostics
│   │   │   ├── agent/
│   │   │   │   ├── core.ts         # Main ReAct agent loop
│   │   │   │   ├── planner.ts      # Task decomposition
│   │   │   │   ├── context.ts      # Context window manager
│   │   │   │   ├── memory.ts       # Long-term memory (vector)
│   │   │   │   └── hooks.ts        # Lifecycle hooks system
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts     # Tool registration + discovery
│   │   │   │   ├── executor.ts     # Safe tool execution
│   │   │   │   ├── builtin/
│   │   │   │   │   ├── filesystem.ts    # Read/write/list files
│   │   │   │   │   ├── shell.ts         # Execute shell commands
│   │   │   │   │   ├── search.ts        # Web search (Tavily free)
│   │   │   │   │   ├── browser.ts       # Web fetch/scrape
│   │   │   │   │   ├── git.ts           # Git operations
│   │   │   │   │   ├── code-runner.ts   # Execute code snippets
│   │   │   │   │   └── diff.ts          # File diff and patch
│   │   │   │   └── mcp/
│   │   │   │       ├── client.ts        # MCP client implementation
│   │   │   │       ├── discovery.ts     # Auto-discover MCP servers
│   │   │   │       └── transport.ts     # Stdio/SSE/HTTP transport
│   │   │   ├── llm/
│   │   │   │   ├── groq.ts         # Groq provider
│   │   │   │   ├── ollama.ts       # Ollama fallback
│   │   │   │   ├── openrouter.ts   # OpenRouter fallback
│   │   │   │   ├── streaming.ts    # Stream handler + SSE
│   │   │   │   └── router.ts       # Model router (auto-select)
│   │   │   ├── ui/
│   │   │   │   ├── app.tsx         # Main Ink TUI root component
│   │   │   │   ├── components/
│   │   │   │   │   ├── ChatView.tsx
│   │   │   │   │   ├── ToolCallView.tsx
│   │   │   │   │   ├── StreamingText.tsx
│   │   │   │   │   ├── DiffView.tsx
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   └── StatusBar.tsx
│   │   │   │   └── renderer.ts     # Markdown-to-terminal renderer
│   │   │   ├── storage/
│   │   │   │   ├── config.ts       # Configstore wrapper
│   │   │   │   ├── sessions.ts     # SQLite session store
│   │   │   │   └── vectors.ts      # Local vector memory
│   │   │   ├── ipc/
│   │   │   │   └── bridge.ts       # Socket.io bridge to dashboard
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       ├── errors.ts
│   │   │       ├── sandbox.ts      # Command sandboxing
│   │   │       └── permissions.ts  # User permission prompts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── dashboard/                  # Next.js web companion
│   │   ├── app/
│   │   │   ├── page.tsx            # Main dashboard
│   │   │   ├── history/page.tsx    # Session history
│   │   │   ├── settings/page.tsx   # Settings UI
│   │   │   └── api/
│   │   │       └── socket/route.ts # Socket.io API route
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   │
│   ├── core/                       # Shared types, utils (internal)
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── agent.ts
│   │   │   │   ├── tools.ts
│   │   │   │   ├── llm.ts
│   │   │   │   └── config.ts
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── mcp-server/                 # Bundled MCP servers
│       ├── filesystem-server.ts
│       ├── git-server.ts
│       └── package.json
│
├── scripts/
│   ├── postinstall.ts              # Run after npx install
│   ├── setup-wizard.ts             # First-run setup wizard
│   └── release.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   └── MCP_GUIDE.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── publish.yml
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 6. Core Modules & Design

### 6.1 CLI Entry Point (`bin/fcli.ts`)

This is the file that runs when anyone types `fcli` or `npx free-cli`. It must be lightning fast to start (< 100ms cold start). Responsibilities are: parse argv, detect if first run, launch correct command, and initialize the agent engine.

The shebang line `#!/usr/bin/env node` combined with the `bin` field in `package.json` is what makes `fcli` work as a global terminal command.

### 6.2 Agent Core (`agent/core.ts`)

This is the brain of the entire CLI. It implements the ReAct (Reason + Act) loop — the same pattern used by Gemini CLI and Claude Code. The loop runs as follows:

**Observe → Think → Plan → Act → Observe (repeat)**

The agent receives the user's prompt, injects current context (open files, cwd, git status, system info), asks Groq to reason and decide which tools to call, executes those tools safely, feeds results back to Groq, and repeats until the task is complete or max iterations are hit.

Key design decisions:
- Max iterations: configurable (default 20)
- Timeout per tool: configurable (default 30s)
- Human-in-the-loop gates: before destructive operations (delete, git push, etc.)
- Parallel tool calls: supported when Groq returns multiple function calls

### 6.3 Tool Registry (`tools/registry.ts`)

All tools (built-in and MCP) are registered here with a unified schema. Every tool has: a name, description, JSON schema for parameters, an execute function, safety level (read-only / safe-write / destructive), and timeout.

The registry supports dynamic hot-loading of MCP server tools. When a user configures a new MCP server in `~/.free-cli/settings.json`, the CLI discovers and registers its tools automatically on next startup.

### 6.4 Context Manager (`agent/context.ts`)

Managing the context window intelligently is what separates enterprise tools from toy projects. The context manager:

- Maintains a rolling window of the conversation
- Automatically injects relevant file contents when file paths are mentioned
- Summarizes older context when approaching token limits
- Maintains a "pinned context" for things like FREE-CLI.md (project-level instructions, same pattern as Gemini CLI's GEMINI.md)
- Tracks which files have been modified in the current session

### 6.5 Streaming Renderer (`llm/streaming.ts` + `ui/components/StreamingText.tsx`)

Groq streams at 300+ tokens/second. The renderer must keep up. It uses a buffer-and-flush architecture — tokens arrive via SSE stream, get buffered in 50ms chunks, and are rendered through the Ink TUI with markdown parsing happening incrementally. Tool call JSON blocks are detected mid-stream and rendered as interactive cards.

### 6.6 Permission System (`utils/permissions.ts`)

Before any destructive operation (shell command execution, file modification, git operations), the user is shown what will happen and asked to approve. There are three approval modes: `auto` (approve all, yolo mode), `ask` (default, prompt per destructive action), and `strict` (prompt for everything including reads).

---

## 7. Feature Set

### Tier 1 — Core (MVP, Phase 1)
- Interactive REPL chat mode with streaming responses
- One-shot headless mode (`fcli run "do this task"`)
- File read/write/edit with diff preview
- Shell command execution with permission gates
- Session persistence (resume previous conversations)
- First-run setup wizard (API key, preferences)
- Rich terminal UI (colors, spinners, markdown rendering)
- Global install via `npx free-cli@latest`

### Tier 2 — Agent Features (Phase 2)
- Full ReAct agentic loop with multi-step task completion
- Codebase understanding (`fcli "explain this repo"`)
- Multi-file editing with atomic apply
- Git integration (status, diff, commit, PR descriptions)
- Web search grounding (Tavily API — free tier)
- FREE-CLI.md project context file support
- Slash commands (`/clear`, `/model`, `/history`, `/tools`, `/mcp`)
- `@file` and `@url` context reference syntax

### Tier 3 — Enterprise Features (Phase 3)
- MCP server support (full protocol implementation)
- Plugin system (custom tools as npm packages)
- Lifecycle hooks (pre/post tool execution, session start/end)
- Local vector memory (remember across sessions without API)
- Multi-model routing (auto-switch between Groq models based on task)
- Offline mode with Ollama fallback
- Next.js web dashboard with real-time session monitoring
- Team config sharing (`.free-cli/` in project root)
- Telemetry opt-in (anonymous usage stats)
- Auto-update system

### Tier 4 — Differentiators (Phase 4)
- `fcli doctor` — diagnoses environment issues automatically
- `fcli checkpoint` — save and restore agent state mid-task
- `fcli replay` — replay any past session step-by-step
- Headless/CI mode for GitHub Actions workflows
- Voice input via Groq Whisper API (free)
- Image analysis via Groq vision models
- Shell completion scripts (bash/zsh/fish)

---

## 8. API & Integrations

### 8.1 Groq API

- **Base URL:** `https://api.groq.com/openai/v1`
- **SDK:** `groq-sdk` (official, OpenAI-compatible)
- **Auth:** Bearer token via `GROQ_API_KEY`
- **Primary Model:** `llama-3.3-70b-versatile` — best reasoning, 128k context
- **Fast Model:** `llama-3.1-8b-instant` — for simple tasks, lower latency
- **Vision Model:** `meta-llama/llama-4-scout-17b-16e-instruct` — for image tasks
- **Speech Model:** `whisper-large-v3` — for voice input
- **Free Tier Limits:** 14,400 requests/day, 6,000 tokens/min (llama-3.3-70b)
- **Function Calling:** Fully supported on all major models
- **Streaming:** Server-sent events (SSE), fully supported
- **Batch API:** Available for history summarization background tasks

### 8.2 Tavily Search API (Web Search Tool)

- **Purpose:** Give the AI real-time web search capability
- **Free Tier:** 1,000 searches/month — sufficient for CLI use
- **Auth:** `TAVILY_API_KEY`
- **Usage:** Powers the `search` built-in tool in the agent

### 8.3 MCP Protocol

- **Version:** MCP 2025-03-26 (latest spec)
- **Transports supported:** Stdio (local processes), SSE (remote servers), Streamable HTTP
- **Discovery:** Via `~/.free-cli/settings.json` → `mcpServers` key
- **Compatible with:** Any existing Gemini CLI or Claude Code MCP server

### 8.4 Ollama (Local Fallback)

- **Purpose:** Offline mode and privacy-first usage
- **Detection:** Auto-detect if `http://localhost:11434` is running
- **Models:** Any locally pulled model (`llama3.2`, `qwen2.5-coder`, etc.)
- **Auth:** None required

### 8.5 OpenRouter (Multi-model Fallback)

- **Purpose:** Access 50+ models including free-tier ones
- **Free Models Available:** `meta-llama/llama-3.1-8b-instruct:free`, `google/gemma-3-27b-it:free`
- **Auth:** `OPENROUTER_API_KEY`

---

## 9. Environment Variables & Secrets

### Required

| Variable | Description | Where to Get |
|---|---|---|
| `GROQ_API_KEY` | Primary AI inference key | console.groq.com → API Keys → Free account |

### Optional (enable extra features)

| Variable | Description | Where to Get | Free? |
|---|---|---|---|
| `TAVILY_API_KEY` | Web search tool | tavily.com → Free tier | Yes — 1000/month |
| `OPENROUTER_API_KEY` | Multi-model fallback | openrouter.ai → Free account | Yes — free models |
| `OLLAMA_BASE_URL` | Local Ollama server | Default: `http://localhost:11434` | Yes — fully local |

### Internal / Auto-generated (never exposed)

| Variable | Description | Storage |
|---|---|---|
| `GX_SESSION_ID` | Current session UUID | In-memory only |
| `GX_CONFIG_DIR` | Config directory path | `~/.free-cli/` |
| `GX_DATA_DIR` | Data directory path | `~/.free-cli/data/` |

### Config File (`~/.free-cli/config.json`) — NOT environment variables, managed by Configstore

```
groqApiKey          → encrypted at rest using OS keychain (keytar)
defaultModel        → llama-3.3-70b-versatile
approvalMode        → ask | auto | strict
theme               → dark | light | system
dashboardEnabled    → true | false
dashboardPort       → 3001
mcpServers          → array of MCP server configs
maxIterations       → 20
contextWindowTokens → 100000
telemetry           → true | false
```

### API Key Security

API keys entered during setup are stored using `keytar` — the OS-native credential manager (Keychain on macOS, Credential Manager on Windows, libsecret on Linux). They are **never** written to `.env` files or committed to git. The setup wizard explicitly warns users about this.

---

## 10. Data Flow Diagrams

### 10.1 Startup Flow

```
npx free-cli@latest
        │
        ▼
  First run? ──Yes──▶ Setup Wizard ──▶ API Key Entry ──▶ Keychain Storage
        │                                                        │
       No                                                        │
        │◀───────────────────────────────────────────────────────┘
        ▼
  Load Config (Configstore + Keychain)
        │
        ▼
  Initialize Agent Engine
  (Tool Registry + Context Manager + LLM Router)
        │
        ▼
  Start Ink TUI
        │
        ▼
  Launch Dashboard (if enabled) ──▶ Socket.io server starts
        │
        ▼
  Render Welcome Screen + Command Prompt
```

### 10.2 Message Processing Flow

```
User types prompt
        │
        ▼
  Context Injector
  (+ cwd, git status, open files, FREE-CLI.md, conversation history)
        │
        ▼
  Groq API Call (streaming)
  model: llama-3.3-70b-versatile
  tools: [all registered tools as function schemas]
        │
        ├──▶ Text response ──▶ Markdown Renderer ──▶ Terminal output
        │                                         ──▶ Socket.io → Dashboard
        │
        └──▶ Tool call detected
                    │
                    ▼
              Permission Check
              (destructive? → prompt user)
                    │
                    ▼
              Tool Executor (sandboxed)
                    │
                    ▼
              Tool Result injected back into context
                    │
                    ▼
              Next Groq API Call (continue ReAct loop)
                    │
                    ▼ (repeat until final answer or max_iterations)
              Final response rendered
```

### 10.3 MCP Tool Discovery Flow

```
~/.free-cli/settings.json
    mcpServers: [{name, command, args}]
        │
        ▼
  MCP Client spawns server process (stdio transport)
        │
        ▼
  tools/list request → server returns tool schemas
        │
        ▼
  Tool Registry registers MCP tools with unified schema
        │
        ▼
  Groq API receives MCP tools as additional function definitions
        │
        ▼
  Groq calls MCP tool → MCP Client forwards to server → result returned
```

---

## 11. MCP Protocol Design

The MCP (Model Context Protocol) implementation is the enterprise-defining feature. It makes `free-cli` compatible with the entire ecosystem of MCP servers already built for Claude Code and Gemini CLI.

### Settings File (`~/.free-cli/settings.json`)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "transport": "stdio"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your_token"
      },
      "transport": "stdio"
    },
    "custom-remote": {
      "url": "https://my-mcp-server.com/sse",
      "transport": "sse"
    }
  },
  "mcp": {
    "timeout": 30000,
    "maxRetries": 3
  }
}
```

### Transport Implementations

Three transports are implemented, matching the full MCP spec:

**Stdio Transport** — spawns a child process and communicates via stdin/stdout using JSON-RPC 2.0. This is the most common for local MCP servers.

**SSE Transport** — connects to a remote server via Server-Sent Events. Used for cloud-hosted MCP servers.

**Streamable HTTP Transport** — newer MCP transport using HTTP streaming for bidirectional communication.

### Built-in MCP Servers (bundled)

`free-cli` ships with these MCP servers pre-bundled (no separate install needed):

- `@free-cli/mcp-filesystem` — enhanced file operations
- `@free-cli/mcp-git` — comprehensive git operations
- `@free-cli/mcp-shell` — safe shell execution with sandboxing
- `@free-cli/mcp-web` — web fetch and search

---

## 12. ReAct Agent Loop

The ReAct (Reasoning + Acting) loop is the core intelligence engine. This is what enables `free-cli` to complete complex, multi-step tasks autonomously.

```
┌─────────────────────────────────────────────┐
│              REACT AGENT LOOP                │
│                                             │
│  iteration = 0                              │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  THINK: Send messages to Groq        │  │
│  │  - System prompt with tool schemas   │  │
│  │  - Conversation history              │  │
│  │  - Current context                   │  │
│  └────────────────┬─────────────────────┘  │
│                   │                         │
│        ┌──────────▼──────────┐              │
│        │  Response Type?     │              │
│        └──┬─────────────┬────┘              │
│           │             │                   │
│     Text only      Tool calls               │
│           │             │                   │
│           ▼             ▼                   │
│       Render       ACT: Execute             │
│       output       each tool                │
│           │             │                   │
│           │      Inject tool results        │
│           │      back to messages           │
│           │             │                   │
│           │        iteration++              │
│           │             │                   │
│           │      max_iterations?            │
│           │        Yes ─▶ Stop              │
│           │        No ──▶ THINK again       │
│           │                                 │
│           ▼                                 │
│        DONE                                 │
└─────────────────────────────────────────────┘
```

### System Prompt Strategy

The system prompt injected before every Groq call contains: current date/time, working directory, git repository status (branch, dirty files), OS and Node version, list of available tools with descriptions, user's FREE-CLI.md content (if present), and session context summary. This gives the model everything it needs to reason accurately about the user's environment.

### Hooks System (Lifecycle Events)

Inspired by Gemini CLI hooks (v0.26.0) and Claude Code hooks, `free-cli` supports hooks at these lifecycle points:

- `onSessionStart` — fires when a new session begins
- `beforePrompt` — fires before the user prompt is sent to the model
- `beforeToolCall` — fires before any tool is executed (with tool name + args)
- `afterToolCall` — fires after a tool returns (with result)
- `afterResponse` — fires after the model completes a full response turn
- `onSessionEnd` — fires when the session ends or `/exit` is called

Hooks are shell scripts or Node.js scripts configured in `settings.json`. They can be used for logging, security scanning, context injection, or CI/CD automation.

---

## 13. CLI Commands Reference

### Primary Commands

```
fcli                          → Start interactive chat mode (REPL)
fcli "your prompt here"       → One-shot mode, auto-exit after response
fcli run "task"               → Agentic mode, full ReAct loop
fcli --help                   → Show help
fcli --version                → Show version
```

### Subcommands

```
fcli config                   → Open config wizard
fcli config set <key> <val>   → Set a config value
fcli config get <key>         → Get a config value
fcli config reset             → Reset to defaults

fcli history                  → List recent sessions
fcli history show <id>        → Show full session
fcli history clear            → Clear all history

fcli mcp list                 → List configured MCP servers
fcli mcp add <name> <cmd>     → Add an MCP server
fcli mcp remove <name>        → Remove an MCP server
fcli mcp test <name>          → Test MCP server connection

fcli model list               → List available Groq models
fcli model set <model-id>     → Change active model
fcli model benchmark          → Run speed benchmark on all models

fcli memory show              → Show current long-term memory
fcli memory clear             → Clear vector memory

fcli doctor                   → Diagnose environment (API key, tools, etc.)
fcli update                   → Update to latest version

fcli dashboard                → Open web dashboard in browser
```

### Slash Commands (inside REPL)

```
/clear              → Clear current conversation context
/reset              → Start fresh session
/model <id>         → Switch model mid-conversation
/tools              → List all available tools
/mcp                → Show MCP server status
/history            → Show message history
/checkpoint         → Save current state
/restore <n>        → Restore to checkpoint N
/yolo               → Enable auto-approve mode
/strict             → Enable strict approval mode
/exit               → End session
```

### Context Reference Syntax

```
@filename.ts        → Inject file contents into context
@./src/utils/       → Inject entire directory tree
@https://url.com    → Fetch URL and inject content
#tag                → Reference a memory tag
```

---

## 14. NPM Distribution Strategy

This is the magic that makes the "shock moment" happen. When someone runs `npx free-cli@latest`, here is exactly what happens:

npx downloads the package, runs the `postinstall` script which globally installs `fcli` as a command using `npm install -g free-cli`, and from that moment onwards, `fcli` is permanently available in their terminal without any further commands.

### `package.json` Key Fields

The `bin` field maps ``fcli`` to `"./dist/bin/fcli.js"`. The `files` field includes only the compiled dist and necessary assets. The `engines` field specifies Node 18 or higher. The `preferGlobal` field is set to true.

### Versioning Strategy

- Semantic versioning (SemVer): `MAJOR.MINOR.PATCH`
- Managed via Changesets (monorepo-safe)
- Pre-release tags: `free-cli@beta`, `free-cli@next`
- GitHub Releases auto-created by CI on every version bump

### GitHub Actions CI/CD Pipeline

On every push to `main`: TypeScript type check, lint, unit tests, and build verification run in parallel via Turborepo.

On every version tag (`v*`): The above plus publish to npm, create GitHub Release with changelog, and notify via GitHub Discussions.

---

## 15. Configuration System

### Config Hierarchy (highest to lowest priority)

1. CLI flags (e.g., `fcli --model llama-3.1-8b-instant "prompt"`)
2. Environment variables (e.g., `GROQ_API_KEY`)
3. Project-level config (`./.free-cli/config.json` in current directory)
4. User-level config (`~/.free-cli/config.json`)
5. Built-in defaults

### FREE-CLI.md — Project Context File

Like Gemini CLI's `GEMINI.md` and Claude Code's `CLAUDE.md`, users can create a `FREE-CLI.md` in their project root. This file is automatically injected into every conversation when `fcli` is run in that directory. It can contain: project description, coding conventions, architecture decisions, frequently used commands, and anything the AI should always know about the project.

### Global Config Location

| OS | Path |
|---|---|
| Linux/macOS | `~/.free-cli/config.json` |
| Windows | `%APPDATA%\free-cli\config.json` |

### Session Data Location

| OS | Path |
|---|---|
| Linux/macOS | `~/.free-cli/data/sessions.db` (SQLite) |
| Windows | `%APPDATA%\free-cli\data\sessions.db` |

---

## 16. Security Architecture

Enterprise security is non-negotiable. These are the pillars:

### API Key Management

Keys are stored in the OS native credential manager via `keytar` library. On macOS this is Keychain, on Windows it is Credential Manager, on Linux it is libsecret/gnome-keyring. Keys are **never** in `.env` files, never logged, and never transmitted anywhere except directly to Groq's API.

### Tool Execution Sandboxing

Shell commands are executed with these restrictions by default: no network access unless explicitly allowed, working directory locked to current project, timeout enforced (30s default), and process tree killed on timeout. The user can configure relaxed sandboxing but must explicitly opt in.

### Permission Gates

Any tool with `safetyLevel: "destructive"` triggers a permission prompt showing exactly what will happen. Destructive operations include: deleting files, overwriting files without diff review, executing git push, network requests to non-localhost URLs, and spawning background processes.

### Input Sanitization

All user input and tool results are sanitized before being injected into the LLM context to prevent prompt injection attacks from malicious file contents or web pages.

### Audit Log

Every tool call, with full args and results, is logged to `~/.free-cli/data/audit.log` (rotated daily, kept 30 days). Users can inspect this log at any time with `fcli history`.

### MCP Server Trust Model

MCP servers are treated as untrusted by default. Users must explicitly add them to `settings.json`. A warning is shown whenever a new MCP server makes tool calls. The `--sandbox` flag runs MCP servers inside Docker if available.

---

## 17. Testing Strategy

### Unit Tests (Vitest)

Every module in `packages/cli/src/` has a corresponding test file. Critical paths with high coverage requirement (>90%): agent core ReAct loop, tool registry and executor, context manager token counting, streaming parser, config read/write, and permission gate logic.

### Integration Tests

Integration tests cover full end-to-end flows: setup wizard flow, single-shot mode, multi-turn conversation, tool execution (filesystem, shell), MCP server connection, and session persistence/resume.

### CLI E2E Tests

A custom test harness spawns real `fcli` processes and asserts on terminal output. Tests cover: cold start time (must be < 500ms), first-run wizard, all major commands, and error handling paths.

### Web Dashboard Tests (Playwright)

E2E tests for the Next.js dashboard: session list loads, live stream updates show correctly, settings page saves config, and token usage charts render.

### CI Test Matrix

Tests run on: Ubuntu 22.04, macOS 14 (Apple Silicon), Windows Server 2022 — all with Node.js 18, 20, and 22.

---

## 18. Development Phases & Milestones

### Phase 0 — Foundation (Week 1-2)
- Monorepo setup (pnpm + Turborepo)
- TypeScript config, ESLint, Prettier
- CI/CD pipeline (GitHub Actions)
- Core types package (`packages/core`)
- Commander.js entry point wired up
- Groq SDK integrated, basic streaming working
- `fcli` installable via `npx free-cli@latest`

**Milestone:** `npx free-cli@latest` works, streams a response from Groq

### Phase 1 — MVP CLI (Week 3-5)
- Ink TUI with basic chat interface
- Markdown rendering in terminal
- Setup wizard (first-run API key entry)
- Session storage (SQLite)
- Basic slash commands (`/clear`, `/exit`, `/model`)
- One-shot headless mode
- Rich terminal output (colors, spinners, boxes)

**Milestone:** Fully usable interactive chat CLI, installable in one command

### Phase 2 — Agent Core (Week 6-9)
- ReAct agent loop
- Built-in tools: filesystem, shell, web search, git
- Permission system
- Context manager with FREE-CLI.md support
- `@file` and `@url` syntax
- Hooks system
- `fcli doctor` command
- Checkpoint/restore

**Milestone:** Can complete multi-step coding tasks like "refactor this file" or "find and fix the bug in my auth module"

### Phase 3 — MCP + Enterprise (Week 10-13)
- Full MCP protocol implementation (stdio + SSE + HTTP)
- Plugin system
- Local vector memory
- Ollama offline fallback
- OpenRouter multi-model fallback
- Advanced slash commands
- Shell completion scripts
- `fcli replay` command

**Milestone:** Compatible with all existing Gemini CLI and Claude Code MCP servers

### Phase 4 — Dashboard + Polish (Week 14-16)
- Next.js dashboard (`packages/dashboard`)
- Socket.io live streaming
- Session history UI
- Token usage charts
- Settings UI
- Telemetry opt-in
- Auto-update system
- Full documentation site
- npm publish + GitHub Release

**Milestone:** `npx free-cli@latest` → full shock experience with live dashboard

---

## 19. Performance Benchmarks

### Target Performance Metrics

| Metric | Target | How Achieved |
|---|---|---|
| Cold start time | < 300ms | Lazy imports, minimal top-level code, tsup bundling |
| Time to first token | < 400ms | Groq LPU advantage (300+ t/s), no warm-up latency |
| Token throughput | 300+ t/s | Groq's LPU is 10x faster than GPU inference |
| Tool execution latency | < 50ms (filesystem) | Native Node.js fs, no subprocess overhead |
| Memory usage (idle) | < 50MB RSS | Careful import management, no webpack bloat |
| Memory usage (active) | < 150MB RSS | SQLite over in-memory, streaming over buffering |

### Why Groq is the Right Choice for a CLI

In a CLI, latency is everything. Users staring at a blinking cursor have zero patience. Groq's LPU delivers tokens at 300+ tokens/second compared to ~30-50 tokens/second on typical GPU-based providers. This means a 500-token response appears nearly instantly rather than taking 10+ seconds to stream. For an interactive terminal tool, this difference transforms the experience from "waiting for AI" to "thinking with AI."

---

## 20. Contribution & GSOC Showcase Notes

### Why This Repo Will Get Attention

This project is designed to be immediately impressive to anyone who has used Gemini CLI or Claude Code. The combination of:

- Zero-cost (Groq free tier covers heavy daily use)
- One-command install (`npx free-cli@latest`)
- Faster inference than both Claude Code and Gemini CLI (Groq LPU)
- MCP compatibility (works with the entire existing ecosystem)
- Next.js web dashboard (no competitor has this)
- Full open-source with enterprise-grade architecture

...creates a project that demonstrates real engineering depth, not just "I wrapped an API."

### Talking Points for GSOC Application / Review

When presenting this project, emphasize: the architectural decisions (why Turborepo, why Ink over blessed, why Groq over OpenAI), the MCP protocol implementation (shows understanding of industry standards), the ReAct loop implementation (shows understanding of agentic AI systems), and the security architecture (shows maturity beyond hobby projects).

### Differentiator from Your Gemini CLI Contribution

Your GSOC contribution to Gemini CLI shows you understand how these tools work from the inside. Building your own from scratch shows you can architect them independently. The combination proves both depth of understanding and ability to execute — exactly what GSOC reviewers want to see in a candidate who will be trusted with real engineering work.

### README Positioning

The README should open with the one-liner install, immediately show the terminal demo GIF, then compare against Gemini CLI and Claude Code in a table that highlights the free + faster + open-source advantages. The first 10 seconds of a reviewer's experience with your README determines whether they keep reading.

---

## Appendix A — Groq Free Tier Limits Reference

| Model | Requests/Min | Requests/Day | Tokens/Min | Context Window |
|---|---|---|---|---|
| llama-3.3-70b-versatile | 30 | 14,400 | 6,000 | 128k |
| llama-3.1-8b-instant | 30 | 14,400 | 20,000 | 128k |
| llama-3.2-11b-vision | 30 | 7,000 | 7,000 | 128k |
| whisper-large-v3 | 20 | 2,000 | — | — |

All of the above are on the free tier — no credit card required.

---

## Appendix B — Key NPM Packages Summary

| Package | Version | Purpose |
|---|---|---|
| `groq-sdk` | latest | Groq API client |
| `commander` | v12 | CLI argument parsing |
| `ink` | v5 | React-based TUI |
| `@inquirer/prompts` | latest | Interactive terminal prompts |
| `chalk` | v5 | Termin# Free-CLI — Enterprise-Grade AI Terminal Agent
### Complete Development Blueprint · Built on Groq LPU × Next.js × Node.js

> **Vision:** A fully open-source, blazing-fast AI CLI agent powered by Groq's LPU inference — installable via a single `npx` command, working like Claude Code and Gemini CLI, but free, faster, and yours.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Why This Will Shock Everyone](#2-why-this-will-shock-everyone)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Core Modules & Design](#6-core-modules--design)
7. [Feature Set](#7-feature-set)
8. [API & Integrations](#8-api--integrations)
9. [Environment Variables & Secrets](#9-environment-variables--secrets)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [MCP Protocol Design](#11-mcp-protocol-design)
12. [ReAct Agent Loop](#12-react-agent-loop)
13. [CLI Commands Reference](#13-cli-commands-reference)
14. [NPM Distribution Strategy](#14-npm-distribution-strategy)
15. [Configuration System](#15-configuration-system)
16. [Security Architecture](#16-security-architecture)
17. [Testing Strategy](#17-testing-strategy)
18. [Development Phases & Milestones](#18-development-phases--milestones)
19. [Performance Benchmarks](#19-performance-benchmarks)
20. [Contribution & GSOC Showcase Notes](#20-contribution--gsoc-showcase-notes)

---

## 1. Project Overview

**Name:** `free-cli` (or brand it as `fcli` — short, punchy, developer-friendly)

**Tagline:** *"Your terminal. Your AI. Groq fast."*

**What it is:** A terminal-native, agentic AI assistant that runs on Groq's LPU infrastructure. It can read your codebase, execute shell commands, write and edit files, browse the web (via MCP), and reason across complex multi-step tasks — all at 300+ tokens/second, for free.

**One-line install:**
```
npx free-cli@latest
```

After this single command runs in any terminal on the planet, `fcli` is permanently available as a global CLI command. That's the "shock moment."

**What makes it different from Gemini CLI & Claude Code:**

| Feature | Claude Code | Gemini CLI | **Free-CLI (fcli)** |
|---|---|---|---|
| Cost | Paid (Anthropic) | Free (limited) | **100% Free (Groq)** |
| Speed | Fast | Fast | **Fastest (LPU, 300+ t/s)** |
| Open Source | No | Yes | **Yes** |
| Self-hostable | No | No | **Yes** |
| Offline mode | No | No | **Yes (local Ollama fallback)** |
| Model choice | Claude only | Gemini only | **Multi-model** |
| Next.js powered | No | No | **Yes (web dashboard)** |

---

## 2. Why This Will Shock Everyone

When a GSOC reviewer runs:

```bash
npx free-cli@latest
```

Here is what happens in sequence on their laptop:

- Their terminal transforms into a full-screen interactive AI agent with a rich TUI (Terminal UI)
- They get prompted to enter their free Groq API key (takes 30 seconds to get one)
- Instantly, `fcli` command is available globally — no install, no setup, no Docker
- The AI can see their filesystem, run code, answer questions, and chain multi-step tasks
- A live web dashboard opens at `localhost:3001` (Next.js) showing conversation history, token usage, and tool call traces — something neither Gemini CLI nor Claude Code has

This is the "shocked" moment. No one else has a free, open-source AI CLI with a Next.js web companion dashboard.

---

## 3. Technology Stack

### Core Runtime
- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5.x (strict mode, full type safety)
- **Package Manager:** pnpm (monorepo-optimized, fast)
- **Monorepo Tool:** Turborepo (parallel builds, caching)

### CLI Layer
- **CLI Framework:** Commander.js v12 (command parsing, subcommands, help generation)
- **Terminal UI:** Ink v5 (React-based TUI — same as used in major enterprise CLIs)
- **Interactive Prompts:** @inquirer/prompts (modern, async-first Inquirer)
- **Styling:** Chalk v5 + Gradient-string (colors, gradients in terminal)
- **Spinners & Progress:** Ora v8 (elegant loading states)
- **Markdown Rendering:** Marked + cli-highlight (render AI responses as formatted terminal markdown)
- **Diff Viewer:** diff2html-cli (show file diffs inline in terminal)
- **Fuzzy Search:** fzf.js (fuzzy file/command search)
- **Box Drawing:** Boxen (beautiful terminal boxes for output)

### AI / Intelligence Layer
- **Primary LLM Provider:** Groq SDK (`groq-sdk`) — free, fastest inference
- **Fallback Provider:** Ollama (local models, offline mode)
- **Secondary Fallback:** OpenRouter (access to 50+ free models)
- **Agentic Loop:** Custom ReAct (Reason + Act) implementation
- **Tool Calling:** Groq's native function calling API
- **Context Management:** Custom sliding-window context with smart summarization

### Web Dashboard (Next.js)
- **Framework:** Next.js 15 (App Router)
- **UI Library:** shadcn/ui + Tailwind CSS v4
- **Real-time:** Socket.io (live streaming from CLI to dashboard)
- **Charts:** Recharts (token usage, latency graphs)
- **Code Display:** Shiki (syntax highlighting)
- **State Management:** Zustand

### Storage & Config
- **Local Config:** Configstore v6 (cross-platform config at `~/.free-cli/config.json`)
- **Session History:** SQLite via `better-sqlite3` (fast, zero-config, file-based)
- **Vector Memory (optional):** `@xenova/transformers` local embeddings + `vectra` (local vector store, no API needed)
- **File Watching:** Chokidar v4

### DevOps & Distribution
- **Testing:** Vitest (unit) + Playwright (E2E web) + custom CLI test harness
- **Linting:** ESLint v9 + Prettier
- **Type Checking:** `tsc --noEmit` as CI gate
- **Bundling CLI:** `tsup` (fast TypeScript bundler)
- **Bundling Web:** Next.js built-in
- **CI/CD:** GitHub Actions
- **Publishing:** npm (public, free)
- **Versioning:** Changesets

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S TERMINAL                          │
│                                                                 │
│   $ fcli "refactor my auth module"                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CLI ENTRY LAYER                        │  │
│  │   Commander.js → Argument Parser → Command Router         │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   AGENT CORE ENGINE                       │  │
│  │                                                           │  │
│  │   ┌─────────────┐    ┌──────────────┐   ┌────────────┐  │  │
│  │   │  PLANNER    │───▶│  TOOL ROUTER │──▶│  EXECUTOR  │  │  │
│  │   │ (ReAct Loop)│    │ (MCP + Built-│   │(Sandboxed) │  │  │
│  │   └─────────────┘    │  in Tools)   │   └────────────┘  │  │
│  │          ▲           └──────────────┘         │         │  │
│  │          │                                     │         │  │
│  │   ┌──────┴──────────────────────────────────── ▼──────┐  │  │
│  │   │              CONTEXT MANAGER                      │  │  │
│  │   │  (Conversation + File Context + Memory Window)    │  │  │
│  │   └────────────────────────────────────────────────────┘  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   GROQ LLM LAYER                          │  │
│  │   groq-sdk → Streaming Chat → Tool Call Parsing           │  │
│  │   Model: llama-3.3-70b-versatile (primary)               │  │
│  │   Fallback: llama-3.1-8b-instant (fast/cheap)            │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   OUTPUT RENDERER                         │  │
│  │   Ink TUI → Markdown Renderer → Diff Viewer → Streaming  │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  IPC / Socket.io
┌───────────────────────────▼─────────────────────────────────────┐
│              NEXT.JS WEB DASHBOARD (localhost:3001)              │
│  Live Conversation │ Tool Call Traces │ Token Usage │ History    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Monorepo Structure

```
free-cli/
├── packages/
│   ├── cli/                        # Core CLI package (published as 'free-cli')
│   │   ├── src/
│   │   │   ├── bin/
│   │   │   │   └── fcli.ts           # Entry point — #!/usr/bin/env node
│   │   │   ├── commands/
│   │   │   │   ├── chat.ts         # Interactive chat mode
│   │   │   │   ├── run.ts          # One-shot headless mode
│   │   │   │   ├── config.ts       # Config management
│   │   │   │   ├── mcp.ts          # MCP server management
│   │   │   │   ├── memory.ts       # Memory/context management
│   │   │   │   ├── history.ts      # Conversation history
│   │   │   │   └── doctor.ts       # Environment diagnostics
│   │   │   ├── agent/
│   │   │   │   ├── core.ts         # Main ReAct agent loop
│   │   │   │   ├── planner.ts      # Task decomposition
│   │   │   │   ├── context.ts      # Context window manager
│   │   │   │   ├── memory.ts       # Long-term memory (vector)
│   │   │   │   └── hooks.ts        # Lifecycle hooks system
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts     # Tool registration + discovery
│   │   │   │   ├── executor.ts     # Safe tool execution
│   │   │   │   ├── builtin/
│   │   │   │   │   ├── filesystem.ts    # Read/write/list files
│   │   │   │   │   ├── shell.ts         # Execute shell commands
│   │   │   │   │   ├── search.ts        # Web search (Tavily free)
│   │   │   │   │   ├── browser.ts       # Web fetch/scrape
│   │   │   │   │   ├── git.ts           # Git operations
│   │   │   │   │   ├── code-runner.ts   # Execute code snippets
│   │   │   │   │   └── diff.ts          # File diff and patch
│   │   │   │   └── mcp/
│   │   │   │       ├── client.ts        # MCP client implementation
│   │   │   │       ├── discovery.ts     # Auto-discover MCP servers
│   │   │   │       └── transport.ts     # Stdio/SSE/HTTP transport
│   │   │   ├── llm/
│   │   │   │   ├── groq.ts         # Groq provider
│   │   │   │   ├── ollama.ts       # Ollama fallback
│   │   │   │   ├── openrouter.ts   # OpenRouter fallback
│   │   │   │   ├── streaming.ts    # Stream handler + SSE
│   │   │   │   └── router.ts       # Model router (auto-select)
│   │   │   ├── ui/
│   │   │   │   ├── app.tsx         # Main Ink TUI root component
│   │   │   │   ├── components/
│   │   │   │   │   ├── ChatView.tsx
│   │   │   │   │   ├── ToolCallView.tsx
│   │   │   │   │   ├── StreamingText.tsx
│   │   │   │   │   ├── DiffView.tsx
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   └── StatusBar.tsx
│   │   │   │   └── renderer.ts     # Markdown-to-terminal renderer
│   │   │   ├── storage/
│   │   │   │   ├── config.ts       # Configstore wrapper
│   │   │   │   ├── sessions.ts     # SQLite session store
│   │   │   │   └── vectors.ts      # Local vector memory
│   │   │   ├── ipc/
│   │   │   │   └── bridge.ts       # Socket.io bridge to dashboard
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       ├── errors.ts
│   │   │       ├── sandbox.ts      # Command sandboxing
│   │   │       └── permissions.ts  # User permission prompts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── dashboard/                  # Next.js web companion
│   │   ├── app/
│   │   │   ├── page.tsx            # Main dashboard
│   │   │   ├── history/page.tsx    # Session history
│   │   │   ├── settings/page.tsx   # Settings UI
│   │   │   └── api/
│   │   │       └── socket/route.ts # Socket.io API route
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   │
│   ├── core/                       # Shared types, utils (internal)
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── agent.ts
│   │   │   │   ├── tools.ts
│   │   │   │   ├── llm.ts
│   │   │   │   └── config.ts
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── mcp-server/                 # Bundled MCP servers
│       ├── filesystem-server.ts
│       ├── git-server.ts
│       └── package.json
│
├── scripts/
│   ├── postinstall.ts              # Run after npx install
│   ├── setup-wizard.ts             # First-run setup wizard
│   └── release.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   └── MCP_GUIDE.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── publish.yml
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 6. Core Modules & Design

### 6.1 CLI Entry Point (`bin/fcli.ts`)

This is the file that runs when anyone types `fcli` or `npx free-cli`. It must be lightning fast to start (< 100ms cold start). Responsibilities are: parse argv, detect if first run, launch correct command, and initialize the agent engine.

The shebang line `#!/usr/bin/env node` combined with the `bin` field in `package.json` is what makes `fcli` work as a global terminal command.

### 6.2 Agent Core (`agent/core.ts`)

This is the brain of the entire CLI. It implements the ReAct (Reason + Act) loop — the same pattern used by Gemini CLI and Claude Code. The loop runs as follows:

**Observe → Think → Plan → Act → Observe (repeat)**

The agent receives the user's prompt, injects current context (open files, cwd, git status, system info), asks Groq to reason and decide which tools to call, executes those tools safely, feeds results back to Groq, and repeats until the task is complete or max iterations are hit.

Key design decisions:
- Max iterations: configurable (default 20)
- Timeout per tool: configurable (default 30s)
- Human-in-the-loop gates: before destructive operations (delete, git push, etc.)
- Parallel tool calls: supported when Groq returns multiple function calls

### 6.3 Tool Registry (`tools/registry.ts`)

All tools (built-in and MCP) are registered here with a unified schema. Every tool has: a name, description, JSON schema for parameters, an execute function, safety level (read-only / safe-write / destructive), and timeout.

The registry supports dynamic hot-loading of MCP server tools. When a user configures a new MCP server in `~/.free-cli/settings.json`, the CLI discovers and registers its tools automatically on next startup.

### 6.4 Context Manager (`agent/context.ts`)

Managing the context window intelligently is what separates enterprise tools from toy projects. The context manager:

- Maintains a rolling window of the conversation
- Automatically injects relevant file contents when file paths are mentioned
- Summarizes older context when approaching token limits
- Maintains a "pinned context" for things like FREE-CLI.md (project-level instructions, same pattern as Gemini CLI's GEMINI.md)
- Tracks which files have been modified in the current session

### 6.5 Streaming Renderer (`llm/streaming.ts` + `ui/components/StreamingText.tsx`)

Groq streams at 300+ tokens/second. The renderer must keep up. It uses a buffer-and-flush architecture — tokens arrive via SSE stream, get buffered in 50ms chunks, and are rendered through the Ink TUI with markdown parsing happening incrementally. Tool call JSON blocks are detected mid-stream and rendered as interactive cards.

### 6.6 Permission System (`utils/permissions.ts`)

Before any destructive operation (shell command execution, file modification, git operations), the user is shown what will happen and asked to approve. There are three approval modes: `auto` (approve all, yolo mode), `ask` (default, prompt per destructive action), and `strict` (prompt for everything including reads).

---

## 7. Feature Set

### Tier 1 — Core (MVP, Phase 1)
- Interactive REPL chat mode with streaming responses
- One-shot headless mode (`fcli run "do this task"`)
- File read/write/edit with diff preview
- Shell command execution with permission gates
- Session persistence (resume previous conversations)
- First-run setup wizard (API key, preferences)
- Rich terminal UI (colors, spinners, markdown rendering)
- Global install via `npx free-cli@latest`

### Tier 2 — Agent Features (Phase 2)
- Full ReAct agentic loop with multi-step task completion
- Codebase understanding (`fcli "explain this repo"`)
- Multi-file editing with atomic apply
- Git integration (status, diff, commit, PR descriptions)
- Web search grounding (Tavily API — free tier)
- FREE-CLI.md project context file support
- Slash commands (`/clear`, `/model`, `/history`, `/tools`, `/mcp`)
- `@file` and `@url` context reference syntax

### Tier 3 — Enterprise Features (Phase 3)
- MCP server support (full protocol implementation)
- Plugin system (custom tools as npm packages)
- Lifecycle hooks (pre/post tool execution, session start/end)
- Local vector memory (remember across sessions without API)
- Multi-model routing (auto-switch between Groq models based on task)
- Offline mode with Ollama fallback
- Next.js web dashboard with real-time session monitoring
- Team config sharing (`.free-cli/` in project root)
- Telemetry opt-in (anonymous usage stats)
- Auto-update system

### Tier 4 — Differentiators (Phase 4)
- `fcli doctor` — diagnoses environment issues automatically
- `fcli checkpoint` — save and restore agent state mid-task
- `fcli replay` — replay any past session step-by-step
- Headless/CI mode for GitHub Actions workflows
- Voice input via Groq Whisper API (free)
- Image analysis via Groq vision models
- Shell completion scripts (bash/zsh/fish)

---

## 8. API & Integrations

### 8.1 Groq API

- **Base URL:** `https://api.groq.com/openai/v1`
- **SDK:** `groq-sdk` (official, OpenAI-compatible)
- **Auth:** Bearer token via `GROQ_API_KEY`
- **Primary Model:** `llama-3.3-70b-versatile` — best reasoning, 128k context
- **Fast Model:** `llama-3.1-8b-instant` — for simple tasks, lower latency
- **Vision Model:** `meta-llama/llama-4-scout-17b-16e-instruct` — for image tasks
- **Speech Model:** `whisper-large-v3` — for voice input
- **Free Tier Limits:** 14,400 requests/day, 6,000 tokens/min (llama-3.3-70b)
- **Function Calling:** Fully supported on all major models
- **Streaming:** Server-sent events (SSE), fully supported
- **Batch API:** Available for history summarization background tasks

### 8.2 Tavily Search API (Web Search Tool)

- **Purpose:** Give the AI real-time web search capability
- **Free Tier:** 1,000 searches/month — sufficient for CLI use
- **Auth:** `TAVILY_API_KEY`
- **Usage:** Powers the `search` built-in tool in the agent

### 8.3 MCP Protocol

- **Version:** MCP 2025-03-26 (latest spec)
- **Transports supported:** Stdio (local processes), SSE (remote servers), Streamable HTTP
- **Discovery:** Via `~/.free-cli/settings.json` → `mcpServers` key
- **Compatible with:** Any existing Gemini CLI or Claude Code MCP server

### 8.4 Ollama (Local Fallback)

- **Purpose:** Offline mode and privacy-first usage
- **Detection:** Auto-detect if `http://localhost:11434` is running
- **Models:** Any locally pulled model (`llama3.2`, `qwen2.5-coder`, etc.)
- **Auth:** None required

### 8.5 OpenRouter (Multi-model Fallback)

- **Purpose:** Access 50+ models including free-tier ones
- **Free Models Available:** `meta-llama/llama-3.1-8b-instruct:free`, `google/gemma-3-27b-it:free`
- **Auth:** `OPENROUTER_API_KEY`

---

## 9. Environment Variables & Secrets

### Required

| Variable | Description | Where to Get |
|---|---|---|
| `GROQ_API_KEY` | Primary AI inference key | console.groq.com → API Keys → Free account |

### Optional (enable extra features)

| Variable | Description | Where to Get | Free? |
|---|---|---|---|
| `TAVILY_API_KEY` | Web search tool | tavily.com → Free tier | Yes — 1000/month |
| `OPENROUTER_API_KEY` | Multi-model fallback | openrouter.ai → Free account | Yes — free models |
| `OLLAMA_BASE_URL` | Local Ollama server | Default: `http://localhost:11434` | Yes — fully local |

### Internal / Auto-generated (never exposed)

| Variable | Description | Storage |
|---|---|---|
| `GX_SESSION_ID` | Current session UUID | In-memory only |
| `GX_CONFIG_DIR` | Config directory path | `~/.free-cli/` |
| `GX_DATA_DIR` | Data directory path | `~/.free-cli/data/` |

### Config File (`~/.free-cli/config.json`) — NOT environment variables, managed by Configstore

```
groqApiKey          → encrypted at rest using OS keychain (keytar)
defaultModel        → llama-3.3-70b-versatile
approvalMode        → ask | auto | strict
theme               → dark | light | system
dashboardEnabled    → true | false
dashboardPort       → 3001
mcpServers          → array of MCP server configs
maxIterations       → 20
contextWindowTokens → 100000
telemetry           → true | false
```

### API Key Security

API keys entered during setup are stored using `keytar` — the OS-native credential manager (Keychain on macOS, Credential Manager on Windows, libsecret on Linux). They are **never** written to `.env` files or committed to git. The setup wizard explicitly warns users about this.

---

## 10. Data Flow Diagrams

### 10.1 Startup Flow

```
npx free-cli@latest
        │
        ▼
  First run? ──Yes──▶ Setup Wizard ──▶ API Key Entry ──▶ Keychain Storage
        │                                                        │
       No                                                        │
        │◀───────────────────────────────────────────────────────┘
        ▼
  Load Config (Configstore + Keychain)
        │
        ▼
  Initialize Agent Engine
  (Tool Registry + Context Manager + LLM Router)
        │
        ▼
  Start Ink TUI
        │
        ▼
  Launch Dashboard (if enabled) ──▶ Socket.io server starts
        │
        ▼
  Render Welcome Screen + Command Prompt
```

### 10.2 Message Processing Flow

```
User types prompt
        │
        ▼
  Context Injector
  (+ cwd, git status, open files, FREE-CLI.md, conversation history)
        │
        ▼
  Groq API Call (streaming)
  model: llama-3.3-70b-versatile
  tools: [all registered tools as function schemas]
        │
        ├──▶ Text response ──▶ Markdown Renderer ──▶ Terminal output
        │                                         ──▶ Socket.io → Dashboard
        │
        └──▶ Tool call detected
                    │
                    ▼
              Permission Check
              (destructive? → prompt user)
                    │
                    ▼
              Tool Executor (sandboxed)
                    │
                    ▼
              Tool Result injected back into context
                    │
                    ▼
              Next Groq API Call (continue ReAct loop)
                    │
                    ▼ (repeat until final answer or max_iterations)
              Final response rendered
```

### 10.3 MCP Tool Discovery Flow

```
~/.free-cli/settings.json
    mcpServers: [{name, command, args}]
        │
        ▼
  MCP Client spawns server process (stdio transport)
        │
        ▼
  tools/list request → server returns tool schemas
        │
        ▼
  Tool Registry registers MCP tools with unified schema
        │
        ▼
  Groq API receives MCP tools as additional function definitions
        │
        ▼
  Groq calls MCP tool → MCP Client forwards to server → result returned
```

---

## 11. MCP Protocol Design

The MCP (Model Context Protocol) implementation is the enterprise-defining feature. It makes `free-cli` compatible with the entire ecosystem of MCP servers already built for Claude Code and Gemini CLI.

### Settings File (`~/.free-cli/settings.json`)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "transport": "stdio"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your_token"
      },
      "transport": "stdio"
    },
    "custom-remote": {
      "url": "https://my-mcp-server.com/sse",
      "transport": "sse"
    }
  },
  "mcp": {
    "timeout": 30000,
    "maxRetries": 3
  }
}
```

### Transport Implementations

Three transports are implemented, matching the full MCP spec:

**Stdio Transport** — spawns a child process and communicates via stdin/stdout using JSON-RPC 2.0. This is the most common for local MCP servers.

**SSE Transport** — connects to a remote server via Server-Sent Events. Used for cloud-hosted MCP servers.

**Streamable HTTP Transport** — newer MCP transport using HTTP streaming for bidirectional communication.

### Built-in MCP Servers (bundled)

`free-cli` ships with these MCP servers pre-bundled (no separate install needed):

- `@free-cli/mcp-filesystem` — enhanced file operations
- `@free-cli/mcp-git` — comprehensive git operations
- `@free-cli/mcp-shell` — safe shell execution with sandboxing
- `@free-cli/mcp-web` — web fetch and search

---

## 12. ReAct Agent Loop

The ReAct (Reasoning + Acting) loop is the core intelligence engine. This is what enables `free-cli` to complete complex, multi-step tasks autonomously.

```
┌─────────────────────────────────────────────┐
│              REACT AGENT LOOP                │
│                                             │
│  iteration = 0                              │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  THINK: Send messages to Groq        │  │
│  │  - System prompt with tool schemas   │  │
│  │  - Conversation history              │  │
│  │  - Current context                   │  │
│  └────────────────┬─────────────────────┘  │
│                   │                         │
│        ┌──────────▼──────────┐              │
│        │  Response Type?     │              │
│        └──┬─────────────┬────┘              │
│           │             │                   │
│     Text only      Tool calls               │
│           │             │                   │
│           ▼             ▼                   │
│       Render       ACT: Execute             │
│       output       each tool                │
│           │             │                   │
│           │      Inject tool results        │
│           │      back to messages           │
│           │             │                   │
│           │        iteration++              │
│           │             │                   │
│           │      max_iterations?            │
│           │        Yes ─▶ Stop              │
│           │        No ──▶ THINK again       │
│           │                                 │
│           ▼                                 │
│        DONE                                 │
└─────────────────────────────────────────────┘
```

### System Prompt Strategy

The system prompt injected before every Groq call contains: current date/time, working directory, git repository status (branch, dirty files), OS and Node version, list of available tools with descriptions, user's FREE-CLI.md content (if present), and session context summary. This gives the model everything it needs to reason accurately about the user's environment.

### Hooks System (Lifecycle Events)

Inspired by Gemini CLI hooks (v0.26.0) and Claude Code hooks, `free-cli` supports hooks at these lifecycle points:

- `onSessionStart` — fires when a new session begins
- `beforePrompt` — fires before the user prompt is sent to the model
- `beforeToolCall` — fires before any tool is executed (with tool name + args)
- `afterToolCall` — fires after a tool returns (with result)
- `afterResponse` — fires after the model completes a full response turn
- `onSessionEnd` — fires when the session ends or `/exit` is called

Hooks are shell scripts or Node.js scripts configured in `settings.json`. They can be used for logging, security scanning, context injection, or CI/CD automation.

---

## 13. CLI Commands Reference

### Primary Commands

```
fcli                          → Start interactive chat mode (REPL)
fcli "your prompt here"       → One-shot mode, auto-exit after response
fcli run "task"               → Agentic mode, full ReAct loop
fcli --help                   → Show help
fcli --version                → Show version
```

### Subcommands

```
fcli config                   → Open config wizard
fcli config set <key> <val>   → Set a config value
fcli config get <key>         → Get a config value
fcli config reset             → Reset to defaults

fcli history                  → List recent sessions
fcli history show <id>        → Show full session
fcli history clear            → Clear all history

fcli mcp list                 → List configured MCP servers
fcli mcp add <name> <cmd>     → Add an MCP server
fcli mcp remove <name>        → Remove an MCP server
fcli mcp test <name>          → Test MCP server connection

fcli model list               → List available Groq models
fcli model set <model-id>     → Change active model
fcli model benchmark          → Run speed benchmark on all models

fcli memory show              → Show current long-term memory
fcli memory clear             → Clear vector memory

fcli doctor                   → Diagnose environment (API key, tools, etc.)
fcli update                   → Update to latest version

fcli dashboard                → Open web dashboard in browser
```

### Slash Commands (inside REPL)

```
/clear              → Clear current conversation context
/reset              → Start fresh session
/model <id>         → Switch model mid-conversation
/tools              → List all available tools
/mcp                → Show MCP server status
/history            → Show message history
/checkpoint         → Save current state
/restore <n>        → Restore to checkpoint N
/yolo               → Enable auto-approve mode
/strict             → Enable strict approval mode
/exit               → End session
```

### Context Reference Syntax

```
@filename.ts        → Inject file contents into context
@./src/utils/       → Inject entire directory tree
@https://url.com    → Fetch URL and inject content
#tag                → Reference a memory tag
```

---

## 14. NPM Distribution Strategy

This is the magic that makes the "shock moment" happen. When someone runs `npx free-cli@latest`, here is exactly what happens:

npx downloads the package, runs the `postinstall` script which globally installs `fcli` as a command using `npm install -g free-cli`, and from that moment onwards, `fcli` is permanently available in their terminal without any further commands.

### `package.json` Key Fields

The `bin` field maps ``fcli`` to `"./dist/bin/fcli.js"`. The `files` field includes only the compiled dist and necessary assets. The `engines` field specifies Node 18 or higher. The `preferGlobal` field is set to true.

### Versioning Strategy

- Semantic versioning (SemVer): `MAJOR.MINOR.PATCH`
- Managed via Changesets (monorepo-safe)
- Pre-release tags: `free-cli@beta`, `free-cli@next`
- GitHub Releases auto-created by CI on every version bump

### GitHub Actions CI/CD Pipeline

On every push to `main`: TypeScript type check, lint, unit tests, and build verification run in parallel via Turborepo.

On every version tag (`v*`): The above plus publish to npm, create GitHub Release with changelog, and notify via GitHub Discussions.

---

## 15. Configuration System

### Config Hierarchy (highest to lowest priority)

1. CLI flags (e.g., `fcli --model llama-3.1-8b-instant "prompt"`)
2. Environment variables (e.g., `GROQ_API_KEY`)
3. Project-level config (`./.free-cli/config.json` in current directory)
4. User-level config (`~/.free-cli/config.json`)
5. Built-in defaults

### FREE-CLI.md — Project Context File

Like Gemini CLI's `GEMINI.md` and Claude Code's `CLAUDE.md`, users can create a `FREE-CLI.md` in their project root. This file is automatically injected into every conversation when `fcli` is run in that directory. It can contain: project description, coding conventions, architecture decisions, frequently used commands, and anything the AI should always know about the project.

### Global Config Location

| OS | Path |
|---|---|
| Linux/macOS | `~/.free-cli/config.json` |
| Windows | `%APPDATA%\free-cli\config.json` |

### Session Data Location

| OS | Path |
|---|---|
| Linux/macOS | `~/.free-cli/data/sessions.db` (SQLite) |
| Windows | `%APPDATA%\free-cli\data\sessions.db` |

---

## 16. Security Architecture

Enterprise security is non-negotiable. These are the pillars:

### API Key Management

Keys are stored in the OS native credential manager via `keytar` library. On macOS this is Keychain, on Windows it is Credential Manager, on Linux it is libsecret/gnome-keyring. Keys are **never** in `.env` files, never logged, and never transmitted anywhere except directly to Groq's API.

### Tool Execution Sandboxing

Shell commands are executed with these restrictions by default: no network access unless explicitly allowed, working directory locked to current project, timeout enforced (30s default), and process tree killed on timeout. The user can configure relaxed sandboxing but must explicitly opt in.

### Permission Gates

Any tool with `safetyLevel: "destructive"` triggers a permission prompt showing exactly what will happen. Destructive operations include: deleting files, overwriting files without diff review, executing git push, network requests to non-localhost URLs, and spawning background processes.

### Input Sanitization

All user input and tool results are sanitized before being injected into the LLM context to prevent prompt injection attacks from malicious file contents or web pages.

### Audit Log

Every tool call, with full args and results, is logged to `~/.free-cli/data/audit.log` (rotated daily, kept 30 days). Users can inspect this log at any time with `fcli history`.

### MCP Server Trust Model

MCP servers are treated as untrusted by default. Users must explicitly add them to `settings.json`. A warning is shown whenever a new MCP server makes tool calls. The `--sandbox` flag runs MCP servers inside Docker if available.

---

## 17. Testing Strategy

### Unit Tests (Vitest)

Every module in `packages/cli/src/` has a corresponding test file. Critical paths with high coverage requirement (>90%): agent core ReAct loop, tool registry and executor, context manager token counting, streaming parser, config read/write, and permission gate logic.

### Integration Tests

Integration tests cover full end-to-end flows: setup wizard flow, single-shot mode, multi-turn conversation, tool execution (filesystem, shell), MCP server connection, and session persistence/resume.

### CLI E2E Tests

A custom test harness spawns real `fcli` processes and asserts on terminal output. Tests cover: cold start time (must be < 500ms), first-run wizard, all major commands, and error handling paths.

### Web Dashboard Tests (Playwright)

E2E tests for the Next.js dashboard: session list loads, live stream updates show correctly, settings page saves config, and token usage charts render.

### CI Test Matrix

Tests run on: Ubuntu 22.04, macOS 14 (Apple Silicon), Windows Server 2022 — all with Node.js 18, 20, and 22.

---

## 18. Development Phases & Milestones

### Phase 0 — Foundation (Week 1-2)
- Monorepo setup (pnpm + Turborepo)
- TypeScript config, ESLint, Prettier
- CI/CD pipeline (GitHub Actions)
- Core types package (`packages/core`)
- Commander.js entry point wired up
- Groq SDK integrated, basic streaming working
- `fcli` installable via `npx free-cli@latest`

**Milestone:** `npx free-cli@latest` works, streams a response from Groq

### Phase 1 — MVP CLI (Week 3-5)
- Ink TUI with basic chat interface
- Markdown rendering in terminal
- Setup wizard (first-run API key entry)
- Session storage (SQLite)
- Basic slash commands (`/clear`, `/exit`, `/model`)
- One-shot headless mode
- Rich terminal output (colors, spinners, boxes)

**Milestone:** Fully usable interactive chat CLI, installable in one command

### Phase 2 — Agent Core (Week 6-9)
- ReAct agent loop
- Built-in tools: filesystem, shell, web search, git
- Permission system
- Context manager with FREE-CLI.md support
- `@file` and `@url` syntax
- Hooks system
- `fcli doctor` command
- Checkpoint/restore

**Milestone:** Can complete multi-step coding tasks like "refactor this file" or "find and fix the bug in my auth module"

### Phase 3 — MCP + Enterprise (Week 10-13)
- Full MCP protocol implementation (stdio + SSE + HTTP)
- Plugin system
- Local vector memory
- Ollama offline fallback
- OpenRouter multi-model fallback
- Advanced slash commands
- Shell completion scripts
- `fcli replay` command

**Milestone:** Compatible with all existing Gemini CLI and Claude Code MCP servers

### Phase 4 — Dashboard + Polish (Week 14-16)
- Next.js dashboard (`packages/dashboard`)
- Socket.io live streaming
- Session history UI
- Token usage charts
- Settings UI
- Telemetry opt-in
- Auto-update system
- Full documentation site
- npm publish + GitHub Release

**Milestone:** `npx free-cli@latest` → full shock experience with live dashboard

---

## 19. Performance Benchmarks

### Target Performance Metrics

| Metric | Target | How Achieved |
|---|---|---|
| Cold start time | < 300ms | Lazy imports, minimal top-level code, tsup bundling |
| Time to first token | < 400ms | Groq LPU advantage (300+ t/s), no warm-up latency |
| Token throughput | 300+ t/s | Groq's LPU is 10x faster than GPU inference |
| Tool execution latency | < 50ms (filesystem) | Native Node.js fs, no subprocess overhead |
| Memory usage (idle) | < 50MB RSS | Careful import management, no webpack bloat |
| Memory usage (active) | < 150MB RSS | SQLite over in-memory, streaming over buffering |

### Why Groq is the Right Choice for a CLI

In a CLI, latency is everything. Users staring at a blinking cursor have zero patience. Groq's LPU delivers tokens at 300+ tokens/second compared to ~30-50 tokens/second on typical GPU-based providers. This means a 500-token response appears nearly instantly rather than taking 10+ seconds to stream. For an interactive terminal tool, this difference transforms the experience from "waiting for AI" to "thinking with AI."

---

## 20. Contribution & GSOC Showcase Notes

### Why This Repo Will Get Attention

This project is designed to be immediately impressive to anyone who has used Gemini CLI or Claude Code. The combination of:

- Zero-cost (Groq free tier covers heavy daily use)
- One-command install (`npx free-cli@latest`)
- Faster inference than both Claude Code and Gemini CLI (Groq LPU)
- MCP compatibility (works with the entire existing ecosystem)
- Next.js web dashboard (no competitor has this)
- Full open-source with enterprise-grade architecture

...creates a project that demonstrates real engineering depth, not just "I wrapped an API."

### Talking Points for GSOC Application / Review

When presenting this project, emphasize: the architectural decisions (why Turborepo, why Ink over blessed, why Groq over OpenAI), the MCP protocol implementation (shows understanding of industry standards), the ReAct loop implementation (shows understanding of agentic AI systems), and the security architecture (shows maturity beyond hobby projects).

### Differentiator from Your Gemini CLI Contribution

Your GSOC contribution to Gemini CLI shows you understand how these tools work from the inside. Building your own from scratch shows you can architect them independently. The combination proves both depth of understanding and ability to execute — exactly what GSOC reviewers want to see in a candidate who will be trusted with real engineering work.

### README Positioning

The README should open with the one-liner install, immediately show the terminal demo GIF, then compare against Gemini CLI and Claude Code in a table that highlights the free + faster + open-source advantages. The first 10 seconds of a reviewer's experience with your README determines whether they keep reading.

---

## Appendix A — Groq Free Tier Limits Reference

| Model | Requests/Min | Requests/Day | Tokens/Min | Context Window |
|---|---|---|---|---|
| llama-3.3-70b-versatile | 30 | 14,400 | 6,000 | 128k |
| llama-3.1-8b-instant | 30 | 14,400 | 20,000 | 128k |
| llama-3.2-11b-vision | 30 | 7,000 | 7,000 | 128k |
| whisper-large-v3 | 20 | 2,000 | — | — |

All of the above are on the free tier — no credit card required.

---

## Appendix B — Key NPM Packages Summary

| Package | Version | Purpose |
|---|---|---|
| `groq-sdk` | latest | Groq API client |
| `commander` | v12 | CLI argument parsing |
| `ink` | v5 | React-based TUI |
| `@inquirer/prompts` | latest | Interactive terminal prompts |
| `chalk` | v5 | Terminal colors |
| `ora` | v8 | Spinners and loading states |
| `configstore` | v6 | Persistent user config |
| `better-sqlite3` | latest | Session storage |
| `keytar` | latest | OS keychain for API keys |
| `socket.io` | latest | CLI ↔ Dashboard bridge |
| `chokidar` | v4 | File watching |
| `marked` | latest | Markdown parsing |
| `cli-highlight` | latest | Syntax highlighting in terminal |
| `execa` | latest | Child process execution |
| `@modelcontextprotocol/sdk` | latest | MCP protocol client |
| `@xenova/transformers` | latest | Local embeddings for memory |
| `vectra` | latest | Local vector store |
| `keytar` | latest | OS-native secret storage |
| `tsup` | latest | TypeScript bundler for CLI |
| `turbo` | latest | Monorepo build orchestration |
| `vitest` | latest | Unit testing |
| `changesets` | latest | Version management |

---

*Document prepared for enterprise-level open source development. All APIs listed are free-tier accessible. Zero paid services required.*

*Stack: Node.js 20 · TypeScript 5 · Next.js 15 · Groq LPU · pnpm · Turborepo*al colors |
| `ora` | v8 | Spinners and loading states |
| `configstore` | v6 | Persistent user config |
| `better-sqlite3` | latest | Session storage |
| `keytar` | latest | OS keychain for API keys |
| `socket.io` | latest | CLI ↔ Dashboard bridge |
| `chokidar` | v4 | File watching |
| `marked` | latest | Markdown parsing |
| `cli-highlight` | latest | Syntax highlighting in terminal |
| `execa` | latest | Child process execution |
| `@modelcontextprotocol/sdk` | latest | MCP protocol client |
| `@xenova/transformers` | latest | Local embeddings for memory |
| `vectra` | latest | Local vector store |
| `keytar` | latest | OS-native secret storage |
| `tsup` | latest | TypeScript bundler for CLI |
| `turbo` | latest | Monorepo build orchestration |
| `vitest` | latest | Unit testing |
| `changesets` | latest | Version management |

---

*Document prepared for enterprise-level open source development. All APIs listed are free-tier accessible. Zero paid services required.*

*Stack: Node.js 20 · TypeScript 5 · Next.js 15 · Groq LPU · pnpm · Turborepo*