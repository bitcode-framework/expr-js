# DRIFT_DETECTION_PROOF.md

Date: 2026-06-10
Scope: `packages/expr-js` generated maintenance metadata.

This is execution evidence, not a theoretical report.

## Artifacts intentionally corrupted

Temporary edits were made to three generated files:

| Artifact | Temporary corruption |
|---|---|
| `src/checker/func_types.generated.ts` | changed func type index `1` output from `time.Duration` to `__DRIFT_FUNC_TYPES__` |
| `src/patcher/value/valuer_methods.generated.ts` | changed first valuer method from `AsAny` to `AsDriftAny` |
| `parity/metadata/builtins.generated.json` | changed builtin name `all` to `__drift_all__` |

## CI drift verification failed as expected

Command:

```powershell
cd packages/expr-js
npm run parity:verify
```

Observed output:

```text
> @bitcode-framework/expr-js@1.17.8 parity:verify
> node scripts/verify-parity.mjs

{
  "funcTypes": { "count": 90, "sha": "1c5ca4c59f1f5a0de66d3044761d12a09852a14bdfb35ad467c59d89ebcb2dcb" },
  "valuers": { "count": 19, "sha": "6222911ab1264756b11c9499759e37efb969413dd1eac5d8326a3e7c625f2055" },
  "reflect": { "visible": 4, "std": 5, "named": 3 },
  "builtins": { "count": 64, "sha": "76478008fc17dd25dcdadc1a19ecf9f4043c9b471fbe9962f9a0139fdc087479" },
  "time": { "count": 6 }
}
Generated parity metadata drift detected:
- src/checker/func_types.generated.ts
- src/patcher/value/valuer_methods.generated.ts
- parity/metadata/builtins.generated.json
```

Result: `npm run parity:verify` exited non-zero and identified exactly the three corrupted generated artifacts.

## Regeneration restored metadata

Command:

```powershell
cd packages/expr-js
npm run sync:go
```

Observed output:

```text
{
  "funcTypes": { "count": 90, "sha": "1c5ca4c59f1f5a0de66d3044761d12a09852a14bdfb35ad467c59d89ebcb2dcb" },
  "valuers": { "count": 19, "sha": "6222911ab1264756b11c9499759e37efb969413dd1eac5d8326a3e7c625f2055" },
  "reflect": { "visible": 4, "std": 5, "named": 3 },
  "builtins": { "count": 64, "sha": "76478008fc17dd25dcdadc1a19ecf9f4043c9b471fbe9962f9a0139fdc087479" },
  "time": { "count": 6 }
}
```

## CI drift verification returned green

Command:

```powershell
cd packages/expr-js
npm run parity:verify
```

Observed output:

```text
parity:verify OK (8 generated artifacts stable)
```

## Conclusion

Drift detection is proven for generated maintenance metadata:

- manual/generated corruption was detected;
- the failing artifacts were named explicitly;
- regeneration restored source-derived metadata;
- verification returned green after regeneration.

This proves generated-artifact drift detection only. It does **not** prove full semantic automation for checker/runtime/compiler behavior.
