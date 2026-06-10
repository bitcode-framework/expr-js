// Parity fixture generator. Go is the source of truth.
// Emits JSON fixtures: each case is { expr, expected, type } evaluated by the
// upstream expr-lang/expr engine. The TS runner replays these and asserts that
// expr-js produces equivalent output.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"time"

	"github.com/expr-lang/expr"
)

type Fixture struct {
	Expr     string `json:"expr"`
	Expected any    `json:"expected"`
	Type     string `json:"type"`
	Error    bool   `json:"error"`
}

// encode wraps a Go value into a transport tagged with its kind so the TS
// runner can compare with bigint/float fidelity.
func tag(v any) any {
	switch x := v.(type) {
	case nil:
		return map[string]any{"k": "nil"}
	case bool:
		return map[string]any{"k": "bool", "v": x}
	case int:
		return map[string]any{"k": "int", "v": fmt.Sprintf("%d", x)}
	case int64:
		return map[string]any{"k": "int", "v": fmt.Sprintf("%d", x)}
	case float64:
		return map[string]any{"k": "float", "v": x}
	case time.Duration:
		// Tag durations by their int64 nanosecond value. The TS engine models
		// time.Duration as GoDuration{value: bigint(nanoseconds)}; the runner
		// normalizes that to {k:"duration", v:"<ns>"} for comparison. This
		// avoids depending on Go's String() formatting ("1h1m0s").
		return map[string]any{"k": "duration", "v": fmt.Sprintf("%d", int64(x))}
	case time.Time:
		return map[string]any{"k": "time", "v": x.UnixMilli()}
	case string:
		return map[string]any{"k": "string", "v": x}
	case []any:
		items := make([]any, len(x))
		for i, e := range x {
			items[i] = tag(e)
		}
		return map[string]any{"k": "array", "v": items}
	case []int:
		items := make([]any, len(x))
		for i, e := range x {
			items[i] = tag(e)
		}
		return map[string]any{"k": "array", "v": items}
	case []string:
		items := make([]any, len(x))
		for i, e := range x {
			items[i] = tag(e)
		}
		return map[string]any{"k": "array", "v": items}
	case map[string]any:
		m := make(map[string]any, len(x))
		for k, e := range x {
			m[k] = tag(e)
		}
		return map[string]any{"k": "map", "v": m}
	case map[any][]any:
		m := make(map[string]any, len(x))
		for k, e := range x {
			m[fmt.Sprintf("%v", k)] = tag(e)
		}
		return map[string]any{"k": "map", "v": m}
	default:
		rv := reflect.ValueOf(v)
		if rv.IsValid() {
			switch rv.Kind() {
			case reflect.Slice, reflect.Array:
				items := make([]any, rv.Len())
				for i := 0; i < rv.Len(); i++ {
					items[i] = tag(rv.Index(i).Interface())
				}
				return map[string]any{"k": "array", "v": items}
			case reflect.Map:
				m := make(map[string]any, rv.Len())
				for _, key := range rv.MapKeys() {
					m[fmt.Sprintf("%v", key.Interface())] = tag(rv.MapIndex(key).Interface())
				}
				return map[string]any{"k": "map", "v": m}
			case reflect.Struct:
				t := rv.Type()
				m := make(map[string]any)
				for i := 0; i < rv.NumField(); i++ {
					field := t.Field(i)
					if field.IsExported() {
						m[field.Name] = tag(rv.Field(i).Interface())
					}
				}
				return map[string]any{"k": "map", "v": m}
			}
		}
		return map[string]any{"k": "other", "v": fmt.Sprintf("%v", x)}
	}
}

func eval(exprStr string) Fixture {
	out, err := expr.Eval(exprStr, nil)
	if err != nil {
		return Fixture{Expr: exprStr, Error: true}
	}
	return Fixture{Expr: exprStr, Expected: tag(out)}
}

func write(name string, fixtures []Fixture) {
	dir := filepath.Join("fixtures")
	_ = os.MkdirAll(dir, 0o755)
	f, err := os.Create(filepath.Join(dir, name+".json"))
	if err != nil {
		panic(err)
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(fixtures); err != nil {
		panic(err)
	}
	fmt.Printf("wrote %s (%d cases)\n", name, len(fixtures))
}

func evalAll(exprs []string) []Fixture {
	out := make([]Fixture, 0, len(exprs))
	for _, e := range exprs {
		out = append(out, eval(e))
	}
	return out
}

func main() {
	write("basics", evalAll(basics))
	write("numeric", evalAll(numeric))
	write("builtins", evalAll(builtins))
	write("strings", evalAll(stringsCases))
	write("collections", evalAll(collections))
	write("predicates", evalAll(predicates))
	write("advanced", evalAll(advanced))
	genExprMock()
	genCheckerMock()
	genBuiltinMock()
}
