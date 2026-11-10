# Research and skills

Retrieved 8 November 2026. Primary upstream sources only for architecture decisions. Recommendations in DESIGN.md are design judgments; upstream documentation does not validate this unbuilt application.

## Skills acquired

| Skill | Source | Use and scope |
|---|---|---|
| frontend-design | [Anthropic source](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Installed at `~/.codex/skills/frontend-design`; read and applied deliberate tokens, layout comparison, restraint and critique. Desktop task overrides webpage hero/mobile-marketing guidance. |
| playwright | [OpenAI source](https://github.com/openai/skills/tree/main/skills/.curated/playwright) | Installed at `~/.codex/skills/playwright`; visual inspection of design preview. Does not certify native app behavior. |

Used installed system skill-installer to discover and install these. Also inspected security-best-practices as a candidate; did not install it because its stated activation is a specific security request and its supported language set does not cover Rust. Used Tauri's own security documentation for host-boundary design. Did not install broad anonymous skill bundles.

Upstream main heads observed immediately after installation: anthropics/skills `2c5958ecac7cee2b583967a2c4981d0f4a75c579`; openai/skills `49f948faa9258a0c61caceaf225e179651397431`. Installer fetched main; these are observed reference heads, not independently proven archive commit identities. Exact installed SKILL.md SHA-256 hashes are in `skill-hashes.txt`.

## Sources

- **S1** [RFC 8259 JSON](https://www.rfc-editor.org/rfc/rfc8259.txt): value shapes, syntax, interoperable-number and duplicate-name considerations. Basis for explicit handling rather than silent coercion.
- **S2** [RFC 6901 JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901.txt): standard path escaping and lookup semantics.
- **S3** [Tauri process model](https://v2.tauri.app/concept/process-model/): Rust core, OS webviews. [Capabilities](https://v2.tauri.app/security/capabilities/): control frontend access to native operations. Reason to evaluate a narrow native host; no benchmark inference.
- **S4** [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model): Chromium-derived process model and Node main process. Basis for fallback comparison.
- **S5** [Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser): scanner, offset tree, error reporting and text edit APIs. Precision preservation requires our raw-token adapter; not provided as an application guarantee by the library.
- **S6** [react-data-grid upstream](https://github.com/adazzle/react-data-grid): read README from upstream main; documents row/column virtualization, typed editing, keyboard and clipboard hooks. Current README's compatibility requirements must be matched to a pinned release during implementation. Repository redirects/ownership may change; lock resolved package provenance then.
- **S7** [AG Grid Community / Enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/): core vs commercial feature boundary. Do not assume all spreadsheet selection/clipboard features are free.
- **S8** [WAI-ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/): focus management and keyboard semantics. Requires testing beyond adding ARIA roles.
- **S9** [Tauri WebDriver testing](https://v2.tauri.app/develop/tests/webdriver/): current embedded WebdriverIO route supports macOS as well as Windows/Linux; direct external tauri-driver has a macOS limitation. This distinction must survive implementation planning.
- **S10** [Tauri distribution](https://v2.tauri.app/distribute/): OS packaging and signing routes.
- **S11** [CodeMirror upstream](https://github.com/codemirror/dev): source-editor candidate. Documentation site returned HTTP 403 to the research tool; integration behavior remains unverified.

No production dependency versions have been selected. No claim is made about application performance, AUTOSAR conformance, licensing of a future complete dependency tree, or successful Windows/macOS installation.
