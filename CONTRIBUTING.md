# Contributing to Nexus Explorer

Thank you for your interest in contributing to **Nexus Explorer**! We welcome contributions from developers, systems engineers, and security researchers.

---

## 1. Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 2. Development Setup

### Prerequisites
* **Rust**: 1.85+ with MSVC toolchain (`rustup default stable-x86_64-pc-windows-msvc`)
* **Node.js**: v20+ LTS
* **Windows**: Windows 10 or Windows 11 x64

### Setting Up Local Environment

```bash
# Clone the repository
git clone https://github.com/Destroyer-official/NexusExplorer.git
cd NexusExplorer

# Install Node dependencies
npm install

# Run frontend in browser mock development mode
npm run dev

# Run desktop Tauri application in development mode
npm run desktop:dev
```

---

## 3. Engineering Quality Gates

We enforce strict military-grade code quality standards across the workspace. Every pull request must satisfy all automated verification gates:

```bash
# 1. TypeScript Strict Typecheck (0 errors)
npm run typecheck

# 2. Frontend Vitest Suite (143 tests)
npm run test

# 3. Rust Clippy (0 warnings across workspace)
cargo clippy --workspace --all-targets -- -D warnings

# 4. Core Engine Unit Tests (134 tests)
cargo test -p nexus-core --lib

# 5. Standalone CLI Unit Tests (13 tests)
cargo test -p nexus-cli
```

---

## 4. Architectural Guidelines

* **Pure Rust Core (`crates/nexus-core`)**: Must remain decoupled from the presentation tier. Zero dependencies on Tauri or windowing crates.
* **Win32 & Storage Safety**: Low-level Win32 calls must validate handles and buffer boundaries. Never swallow errors that conceal disk failure or bad sectors.
* **Documentation Synchronization**: When adding or updating tools, update [`distinct tools & specialized subsystems.md`](distinct%20tools%20&%20specialized%20subsystems.md) and the appropriate files in [`docs/`](docs/).

---

## 5. Pull Request Workflow

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-enhancement
   ```
2. Make your changes adhering to existing code conventions.
3. Run the verification battery to ensure 100% test pass rate.
4. Commit your changes with a descriptive conventional commit message.
5. Push to your fork and submit a Pull Request against `main`.

