// builtin_mock.go — extracts {input} cases from upstream builtin/builtin_test.go
// TestBuiltin and evaluates each against the upstream engine with the builtin
// test env. Go is the source of truth. Output: parity/fixtures/builtin_mock.json
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/test/mock"
)

type BuiltinFixture struct {
	Expr     string `json:"expr"`
	Expected any    `json:"expected"`
	Error    bool   `json:"error"`
	Bucket   string `json:"bucket"`
	Reason   string `json:"reason,omitempty"`
	NowMS    int64  `json:"nowMs,omitempty"`
}

// buildBuiltinEnv reproduces the env used in builtin_test.go TestBuiltin.
func buildBuiltinEnv() map[string]any {
	arrayWithNil := []any{42}
	return map[string]any{
		"ArrayOfString":   []string{"foo", "bar", "baz"},
		"ArrayOfInt":       []int{1, 2, 3},
		"ArrayOfFloat":     []float64{1.5, 2.5, 3.5},
		"ArrayOfInt32":     []int32{1, 2, 3},
		"ArrayOfAny":       []any{1, "2", true},
		"ArrayOfFoo":       []mock.Foo{{Value: "a"}, {Value: "b"}, {Value: "c"}},
		"PtrArrayWithNil":  &arrayWithNil,
		"EmptyIntArray":    []int{},
		"EmptyFloatArray":  []float64{},
		"NestedIntArrays":  []any{[]int{1, 2}, []int{3, 4}},
		"NestedAnyArrays":  []any{[]any{1, 2}, []any{3, 4}},
		"MixedNestedArray": []any{1, []int{2, 3}, []float64{4.0, 5.0}},
		"NestedInt32Array": []any{[]int32{1, 2}, []int32{3, 4}},
	}
}

// extractInputCases parses TestBuiltin and pulls the first field (the input
// expression) of each {input, want} struct entry.
func extractBuiltinCases(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	src := string(data)
	start := strings.Index(src, "func TestBuiltin(")
	if start < 0 {
		panic("could not locate TestBuiltin")
	}
	rest := src[start:]
	end := strings.Index(rest, "for _, test := range tests")
	if end < 0 {
		end = len(rest)
	}
	block := rest[:end]
	re := regexp.MustCompile("(?m)^\\s*\\{\\s*`([^`]*)`\\s*,")
	matches := re.FindAllStringSubmatch(block, -1)
	out := make([]string, 0, len(matches))
	seen := map[string]bool{}
	for _, m := range matches {
		c := m[1]
		if seen[c] {
			continue
		}
		seen[c] = true
		out = append(out, c)
	}
	return out
}

func classifyBuiltin(e string) (string, string) {
	na := []struct{ pat, reason string }{}
	for _, p := range na {
		if p.reason != "" && strings.Contains(e, p.pat) {
			return "NOT_APPLICABLE", p.reason
		}
	}
	if regexp.MustCompile(`(ArrayOf|Empty|Nested|Mixed|Ptr)[A-Za-z0-9]*`).MatchString(e) {
		return "PASS_WITH_ADAPTER", ""
	}
	return "PASS", ""
}

func genBuiltinMock() {
	env := buildBuiltinEnv()
	codes := extractBuiltinCases("../../../references/expr/builtin/builtin_test.go")
	out := make([]BuiltinFixture, 0, len(codes))
	for _, code := range codes {
		bucket, reason := classifyBuiltin(code)
		fx := BuiltinFixture{Expr: code, Bucket: bucket, Reason: reason}
		if bucket == "NOT_APPLICABLE" {
			out = append(out, fx)
			continue
		}
		if strings.Contains(code, `now().Format`) {
			fixed := time.Date(2026, 6, 10, 15, 4, 0, 0, time.UTC)
			fx.Expected = tag(fixed.Format("2006-01-02T15:04Z"))
			fx.NowMS = fixed.UnixMilli()
			out = append(out, fx)
			continue
		}
		program, err := expr.Compile(code, expr.Env(env))
		if err != nil {
			fx.Error = true
			out = append(out, fx)
			continue
		}
		res, err := expr.Run(program, env)
		if err != nil {
			fx.Error = true
			out = append(out, fx)
			continue
		}
		fx.Expected = tag(res)
		if m, ok := fx.Expected.(map[string]any); ok && m["k"] == "other" {
			fx.Bucket = "NOT_APPLICABLE"
			fx.Reason = "Go fmt.Stringer/struct %v formatting (reflect) not modeled in JS"
			fx.Expected = nil
		}
		out = append(out, fx)
	}
	dir := filepath.Join("fixtures")
	_ = os.MkdirAll(dir, 0o755)
	f, err := os.Create(filepath.Join(dir, "builtin_mock.json"))
	if err != nil {
		panic(err)
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(out); err != nil {
		panic(err)
	}
	pass, adapter, na := 0, 0, 0
	for _, fx := range out {
		switch fx.Bucket {
		case "PASS":
			pass++
		case "PASS_WITH_ADAPTER":
			adapter++
		case "NOT_APPLICABLE":
			na++
		}
	}
	println("builtin_mock:", len(out), "total |", pass, "PASS |", adapter, "PASS_WITH_ADAPTER |", na, "NOT_APPLICABLE")
}
