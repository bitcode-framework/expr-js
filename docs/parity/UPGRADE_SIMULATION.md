# UPGRADE_SIMULATION.md

Date: 2026-06-10
Scope: real upstream simulation from `expr-lang/expr` v1.17.8 to the latest available upstream commit in this repository.

This simulation used the real `references/expr` git repository and did not invent a theoretical upgrade.

## Baseline

Command:

```powershell
cd references/expr
git rev-parse HEAD
git describe --tags --always
```

Observed baseline:

```text
21f4f0575591d7097e576edd7983daf23c1e4afe
v1.17.8
```

## Latest available upstream commit

Commands:

```powershell
cd references/expr
git fetch origin master:refs/remotes/origin/master
git rev-list --count v1.17.8..origin/master
git log --oneline -5 v1.17.8..origin/master
```

Observed output:

```text
7
2010a11 feat: allow field access on concrete types behind interface values (#952)
630bbf0 fix(vm): clear error when fetching field from string at runtime (#963)
3a46b19 fix(compiler): pop stale bool from stack in emitLoopBackwards (#954)
b90e77c docs: add Kargo's usage of expr (#944)
851b241 fix(vm): handle non-comparable groupBy keys (#940)
```

Simulation target:

```text
2010a1126f132431fcab47478928e4a0ea182443
v1.17.8-7-g2010a11
```

## Upstream files changed by the real upgrade

Command:

```powershell
cd references/expr
git diff --stat v1.17.8..origin/master
git diff --name-status v1.17.8..origin/master
```

Observed summary:

```text
13 files changed, 460 insertions(+), 23 deletions(-)
```

Changed files:

```text
M README.md
M builtin/builtin.go
M builtin/lib.go
M checker/checker.go
M compiler/compiler.go
M expr_test.go
M test/fuzz/fuzz_test.go
A test/issues/934/issue_test.go
A test/issues/951/issue_test.go
M vm/runtime/runtime.go
A vm/runtime/runtime_test.go
M vm/vm.go
M vm/vm_test.go
```

## Generator execution on upgraded source

Commands:

```powershell
cd references/expr
git checkout --detach origin/master
cd ../../packages/expr-js
npm run sync:go
```

Observed generator output against `origin/master`:

```text
{
  "funcTypes": {
    "count": 90,
    "sha": "1c5ca4c59f1f5a0de66d3044761d12a09852a14bdfb35ad467c59d89ebcb2dcb"
  },
  "valuers": {
    "count": 19,
    "sha": "6222911ab1264756b11c9499759e37efb969413dd1eac5d8326a3e7c625f2055"
  },
  "reflect": {
    "visible": 4,
    "std": 5,
    "named": 3
  },
  "builtins": {
    "count": 64,
    "sha": "1145c00d1d52095eb060b1b294b388a52bbde2765274da9d2d272b1c97e6afa4"
  },
  "time": {
    "count": 6
  }
}
```

## Files auto-updated by generator

A baseline copy of generated artifacts was captured from `v1.17.8`; a latest copy was captured after checking out `origin/master` and running `npm run sync:go`.

Compared generated artifacts:

```text
same    src\checker\func_types.generated.ts
same    src\patcher\value\valuer_methods.generated.ts
same    src\checker\nature\std_types.generated.ts
same    parity\metadata\visible_fields.generated.json
same    parity\metadata\named_types.generated.json
same    parity\metadata\builtins.generated.json
same    parity\fixtures\time_layout.generated.json
same    GENERATED_DIVERGENCES.md
```

Result: for this real upstream upgrade, no generated artifact content changed. The builtin source hash changed because `builtin/builtin.go` changed, but the generated builtin registry snapshot did not change because builtin names/order/predicate/fast flags were unchanged.

## Files still requiring manual port

The real post-v1.17.8 source changes are semantic/runtime/compiler/checker changes, not metadata table changes. They require manual TypeScript porting and tests.

| Upstream file | Change observed | Automation result | Manual port required |
|---|---|---|---|
| `builtin/builtin.go` | `date()` unknown timezone error text changed to `unknown time zone <name>` | No generated registry change | Yes: update TS builtin error behavior if not already matching. |
| `builtin/lib.go` | `get()` struct field lookup now checks `field.IsExported()` and uses `FieldByIndex` | No generated registry change | Yes: update runtime/builtin struct field adapter behavior. |
| `checker/checker.go` | non-any interface field access allowed; methods still rejected | No generated metadata change | Yes: checker semantics must be hand-ported into `src/checker/checker.ts` / descriptor behavior. |
| `compiler/compiler.go` | `emitLoopBackwards` adds `OpPop` around loop backward predicate | No generated metadata change | Yes: compiler bytecode emission must be hand-ported. |
| `vm/runtime/runtime.go` | string index fetch with string key now panics; struct fetch split into `findStructField`; embedded interface concrete field traversal added | No generated metadata change | Yes: runtime `Fetch` semantics must be hand-ported. |
| `vm/vm.go` | `groupBy` rejects non-comparable keys | No generated metadata change | Yes: VM `OpGroupBy` behavior must be hand-ported. |
| `expr_test.go`, `vm/vm_test.go`, `vm/runtime/runtime_test.go`, `test/issues/934`, `test/issues/951` | new/changed tests for above behavior | Fixture generators did not auto-port these tests | Yes: add/port corresponding TS parity tests. |

## Source diff evidence for manual areas

Observed source-level changes include:

```diff
builtin/builtin.go:
- return nil, err
+ return nil, fmt.Errorf("unknown time zone %s", timeZone)
```

```diff
checker/checker.go:
+ case reflect.Interface:
+   // For non-any interface types, we don't know the concrete type at compile time.
+   if name, ok := node.Property.(*ast.StringNode); ok && node.Method {
+     return v.error(node, "type %v has no method %v", base.String(), name.Value)
+   }
+   return Nature{}
```

```diff
compiler/compiler.go:
+ c.emit(OpPop)
...
+ c.emit(OpPop)
```

```diff
vm/runtime/runtime.go:
+ if _, ok := i.(string); ok {
+   panic(fmt.Sprintf("cannot fetch %v from %T", i, from))
+ }
...
+ if result, found := fetchFromEmbeddedInterfaces(v, fieldName); found {
+   return result
+ }
```

```diff
vm/vm.go:
+ if key != nil && !reflect.TypeOf(key).Comparable() {
+   panic(fmt.Sprintf("cannot use %T as a key for groupBy: type is not comparable", key))
+ }
```

## Final simulation verdict

For the actual available upgrade `v1.17.8 -> origin/master@2010a11`:

- The generator ran successfully on the upgraded source.
- The generator detected changed builtin source via source hash, but no generated registry data changed.
- No generated metadata artifact required an automatic content update for this specific upgrade.
- The upgrade still requires manual source porting for checker/compiler/runtime/builtin semantics and new upstream tests.

Therefore maintenance parity is **not FULLY_AUTOMATED**. The automation is useful and proven for metadata drift, but this real upgrade demonstrates that important upstream changes can be semantic and remain manual.
