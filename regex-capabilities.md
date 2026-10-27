# Search pattern laboratory: capability matrix

This original local workbench is **partial**, not a RegexBuddy replacement or a claim of functional parity. The [official manual](https://www.regexbuddy.com/manual.html), [test workflow](https://www.regexbuddy.com/test.html), and [debugger description](https://www.regexbuddy.com/debug.html) were reviewed on 2026-10-27. No installed RegexBuddy version was verified. The full manual-topic inventory and independent evidence for every topic remain unfinished; this matrix is a scope statement, not that complete ledger.

## Runtime and safety

Open **Regex** next to a search field. Plain text remains the default. **Use for this search** enables the pattern; **Plain text** returns to literal searching. The panel belongs to its originating field. Patterns, flags, test subjects, snippets and history are independent per field. Escape closes the panel and returns focus. Collections are memory-only; nothing is sent to a server.

The actual browser's JavaScript `RegExp` implementation runs in a fresh module Web Worker, terminated after 350 ms of execution. A separate ready handshake allows up to 3 seconds for worker startup; no pattern is sent or executed before readiness. Startup failure is reported separately and never falls back to UI-thread execution. Exact engine version is not exposed by the standard browser API; no other engine is emulated. Missing worker support disables execution instead of running on the UI thread. Serve through HTTP or the desktop application; file URLs may prevent workers. `d g i m s u v y` flags are offered and checked by the running engine. Unsupported flags, mutually exclusive `u/v`, invalid syntax and unsupported constructs report real errors.

Inputs are bounded to 2,048 pattern, 16,384 sample and 256 replacement UTF-16 units. Search accepts up to 500 strings totaling 65,536 units. Results stop at 500 matches or a 65,536-unit serialized match budget. Match/capture display values truncate at 256 units and 100 captures; indices remain original UTF-16 offsets. Replacement preview stops at 65,536 units; split stops at 501 entries. Run timing measures worker computation only; it is not a controlled benchmark. Patterns can still be expensive: worker isolation and termination are the safety boundary, not a promise of linear complexity.

## Implemented and open scope

| Family | Working route | Remaining work |
| --- | --- | --- |
| Construction | Raw pattern; selection-aware literal escaping; common classes, anchors, captures, lookarounds, quantifiers and Unicode token insertion | Complete syntax-assistance inventory; advanced flavor-specific constructs |
| Replacement | Native JavaScript replacement template and live preview | Guided replacement construction and independent replacement analysis |
| Analysis | Lexical token annotations; real syntax validation | Full parser/tree, synchronized source selections, analysis exports |
| Engines | Actual host JavaScript engine; flags checked at runtime | Other flavors/versions, semantic comparison and conversion |
| Testing | Live bounded worker match/replace/split; numbered/named captures, optional indices; expected-match/no-match suites | Match highlighting/navigation, encoding/hex controls, persistent suites, line/page scopes |
| Debugging | Cancellation and hard worker timeout | Actual engine tracing/backtracking hooks unavailable in native browser RegExp |
| Performance | Measured worker elapsed time | Controlled benchmark comparisons and growth analysis |
| Code | JSON-escaped JavaScript constructor snippet; explicit pattern copy; pattern-and-flags JSON export | Import, editable templates, API-specific/language-specific generation |
| Collections | Up to 20 session snippets and 20 applied-pattern history entries per search | Persistent/importable collections, descriptions and validated parameters |
| File operations | No file mutation | File/folder GREP, scope preview, controlled replacement and verified backup/restore require a separate filesystem workflow |
| Integration | Owning search callback, local worker | Command-line and third-party automation integrations |
| Workspace | Adjacent inline panel, disclosure sections, native keyboard editing, Escape/focus return, narrow-layout CSS | Fully localized workbench, customizable docking/layout/preferences, complete help coverage |

Atomic groups, possessive quantifiers, recursion, balancing groups and conditional patterns are not JavaScript constructs. Unicode-set syntax and inline modifiers depend on the installed browser and are not silently translated. JavaScript strings use UTF-16; `u` or `v` changes Unicode matching semantics, not reported index units.

## Integration and verification

`attachRegexWorkbench(input, { getCandidates, onResults })` binds a field. `getCandidates` returns strings; `onResults` receives a `matches` boolean array in the same order. Existing integrations are updated rather than duplicated. A `regex-refresh` event refreshes the active scope. `regex-results` provides the latest successful result. Invalid or timed-out searches retain previous results and visibly report the error. The guide search has a built-in scope binding; shared settings provide their own callback. Other fields require an explicit binding or `data-search-target`; a missing binding is reported, never silently claimed as working.

Run `node --test regex-workbench.test.js`. The focused tests cover literal escaping, actual capture/replacement/split semantics, Unicode zero-width advancement, independent global/sticky search state, unsupported syntax, input/result limits, real worker success, cancellation, catastrophic-pattern timeout and recovery. Node worker tests verify execution isolation; they do not substitute for browser UI or Windows artifact verification. Full per-surface coverage, browser accessibility/localization proof and full manual-topic parity are still open.
