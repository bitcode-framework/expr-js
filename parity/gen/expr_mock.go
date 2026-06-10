// expr_mock.go — extracts the TestExpr code strings from upstream expr_test.go
// and evaluates each against the real mock.Env, capturing Go's result/error.
// Go is the source of truth. Output: parity/fixtures/expr_mock.json
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

type ExprFixture struct {
	Expr     string `json:"expr"`
	Expected any    `json:"expected"`
	Error    bool   `json:"error"`
	Bucket   string `json:"bucket"`
	Reason   string `json:"reason,omitempty"`
}

// buildMockEnv reproduces the env literal used in expr_test.go TestExpr.
func buildMockEnv() mock.Env {
	date := time.Date(2017, time.October, 23, 18, 30, 0, 0, time.UTC)
	oneDay, _ := time.ParseDuration("24h")
	timeNowPlusOneDay := date.Add(oneDay)
	return mock.Env{
		Bool:   true,
		Int:    0,
		One:    1,
		Two:    2,
		String: "string",
		Foo: mock.Foo{
			Value: "foo",
			Bar:   mock.Bar{Baz: "baz"},
		},
		ArrayOfInt: []int{1, 2, 3, 4, 5},
		ArrayOfFoo: []*mock.Foo{{Value: "foo"}, {Value: "bar"}, {Value: "baz"}},
		Variadic: func(head int, xs ...int) bool {
			sum := 0
			for _, x := range xs {
				sum += x
			}
			return head == sum
		},
		Time:        date,
		TimePlusDay: timeNowPlusOneDay,
		Duration:    oneDay,
	}
}

// extractTestExprCodes parses expr_test.go and pulls the backtick-quoted code
// field of each TestExpr table entry (the first field of each struct literal).
func extractTestExprCodes(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	src := string(data)
	start := strings.Index(src, "func TestExpr(t *testing.T)")
	end := strings.Index(src, "func TestExpr_error")
	if start < 0 || end < 0 || end < start {
		panic("could not locate TestExpr table")
	}
	block := src[start:end]
	// Match a struct entry opening "{" followed by a backtick code literal.
	re := regexp.MustCompile("(?s)\\{\\s*`([^`]*)`\\s*,")
	matches := re.FindAllStringSubmatch(block, -1)
	codes := make([]string, 0, len(matches))
	seen := map[string]bool{}
	for _, m := range matches {
		c := m[1]
		if seen[c] {
			continue
		}
		seen[c] = true
		codes = append(codes, c)
	}
	return codes
}

// classify decides the parity bucket for an expression using simple heuristics
// over Go-only features. NOT_APPLICABLE expressions are recorded but not
// expected to evaluate identically in the TS port.
func classify(e string) (string, string) {
	naPatterns := []struct{ pat, reason string }{
		{"IntPtr", "Go pointer type (**int / *int) has no JS analog"},
		{"FloatPtr", "Go pointer type has no JS analog"},
		{"BoolPtr", "Go pointer type has no JS analog"},
		{"StringPtr", "Go pointer type has no JS analog"},
		{"NilStruct", "Go typed-nil pointer struct has no JS analog"},
		{"NilFn", "Go typed-nil func has no JS analog"},
		{"Stringer", "fmt.Stringer interface dispatch (reflect) not modeled"},
		{"Abstract", "Go interface method set (reflect) not modeled"},
		{"Embed", "Go embedded struct/method promotion (reflect) not modeled"},
		{"FuncTyped", "typed-func dispatch (reflect) not modeled"},
		{"FuncNamed", "named func type (reflect) not modeled"},
		{"Uint64", "Go fixed-width unsigned type distinct from int"},
		{"Uint32", "Go fixed-width unsigned type distinct from int"},
		{"Int32", "Go fixed-width int type distinct from int"},
		{"Float32", "Go float32 distinct from float64"},
		{"FuncInt8", "Go fixed-width arg type"},
		{"FuncInt16", "Go fixed-width arg type"},
		{"FuncUint", "Go unsigned arg type"},
		{"Time", "Go time.Time env value: identity/formatting via reflect not modeled in JS mock env"},
		{"TimePlusDay", "Go time.Time env value not modeled in JS mock env"},
	}
	for _, p := range naPatterns {
		if strings.Contains(e, p.pat) {
			return "NOT_APPLICABLE", p.reason
		}
	}
	// Heuristic: any uppercase identifier reference => needs the mock env.
	if regexp.MustCompile(`[A-Z][A-Za-z0-9]+`).MatchString(e) {
		return "PASS_WITH_ADAPTER", ""
	}
	return "PASS", ""
}

func genExprMock() {
	env := buildMockEnv()
	codes := extractTestExprCodes("../../../references/expr/expr_test.go")
	out := make([]ExprFixture, 0, len(codes))
	for _, code := range codes {
		bucket, reason := classify(code)
		fx := ExprFixture{Expr: code, Bucket: bucket, Reason: reason}
		if bucket == "NOT_APPLICABLE" {
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
		// Post-eval reclassification: a result tagged "other" means Go rendered
		// it via fmt.Stringer / struct %v formatting (e.g. *Foo -> "Foo.String"),
		// which depends on reflect + the Stringer interface. The TS port returns
		// the underlying object, so this is a documented FORCED divergence ->
		// NOT_APPLICABLE.
		if m, ok := fx.Expected.(map[string]any); ok {
			if m["k"] == "other" {
				fx.Bucket = "NOT_APPLICABLE"
				fx.Reason = "Go fmt.Stringer/struct %v formatting (reflect) not modeled in JS"
				fx.Expected = nil
			}
		}
		out = append(out, fx)
	}
	dir := filepath.Join("fixtures")
	_ = os.MkdirAll(dir, 0o755)
	f, err := os.Create(filepath.Join(dir, "expr_mock.json"))
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
	println("expr_mock:", len(out), "total |", pass, "PASS |", adapter, "PASS_WITH_ADAPTER |", na, "NOT_APPLICABLE")
}
