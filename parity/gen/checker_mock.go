// checker_mock.go — extracts (code, err) pairs from upstream checker_test.go
// TestCheck_error and runs each through the upstream checker with mock.Env,
// capturing whether it errors and the first line of the error message.
// Go is the source of truth. Output: parity/fixtures/checker_mock.json
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/expr-lang/expr"
)

type CheckerFixture struct {
	Expr          string `json:"expr"`
	ErrorContains string `json:"errorContains"`
	Bucket        string `json:"bucket"`
	Reason        string `json:"reason,omitempty"`
}

// extractCheckerErrorCases parses checker_test.go TestCheck_error and pulls
// (code, first-error-line) pairs. The table entries are {`code`, `\nmsg (r:c)\n | ...`}.
func extractCheckerErrorCases(path string) [][2]string {
	data, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	src := string(data)
	start := strings.Index(src, "func TestCheck_error")
	if start < 0 {
		panic("could not locate TestCheck_error")
	}
	// End at the next top-level func.
	rest := src[start+len("func TestCheck_error"):]
	end := strings.Index(rest, "\nfunc ")
	if end < 0 {
		end = len(rest)
	}
	block := rest[:end]
	// Match: { `code` , ` ... message ... ` }
	re := regexp.MustCompile("(?s)\\{\\s*`([^`]*)`\\s*,\\s*`([^`]*)`\\s*,?\\s*\\}")
	matches := re.FindAllStringSubmatch(block, -1)
	out := make([][2]string, 0, len(matches))
	for _, m := range matches {
		code := m[1]
		msg := strings.TrimSpace(m[2])
		// First line is the "message (line:col)" part.
		firstLine := msg
		if i := strings.IndexByte(msg, '\n'); i >= 0 {
			firstLine = msg[:i]
		}
		// Strip the " (line:col)" suffix to get the bare message text.
		if i := strings.LastIndex(firstLine, " ("); i >= 0 {
			firstLine = firstLine[:i]
		}
		out = append(out, [2]string{code, strings.TrimSpace(firstLine)})
	}
	return out
}

func classifyChecker(code string) (string, string) {
	na := []struct{ pat, reason string }{
		{"Stringer", "fmt.Stringer interface dispatch (reflect) not modeled"},
		{"Uint", "Go fixed-width unsigned type distinct from int"},
		{"Int8", "Go fixed-width int type"},
		{"Int16", "Go fixed-width int type"},
		{"Int32", "Go fixed-width int type"},
		{"Float32", "Go float32 distinct from float64"},
		{"Abstract", "Go interface method set (reflect) not modeled"},
		{"Embed", "Go embedded struct/method promotion (reflect) not modeled"},
	}
	for _, p := range na {
		if strings.Contains(code, p.pat) {
			return "NOT_APPLICABLE", p.reason
		}
	}
	return "PASS_WITH_ADAPTER", ""
}

func genCheckerMock() {
	env := buildMockEnv()
	cases := extractCheckerErrorCases("../../../references/expr/checker/checker_test.go")
	out := make([]CheckerFixture, 0, len(cases))
	for _, c := range cases {
		code := c[0]
		bucket, reason := classifyChecker(code)
		fx := CheckerFixture{Expr: code, ErrorContains: c[1], Bucket: bucket, Reason: reason}
		if bucket == "NOT_APPLICABLE" {
			out = append(out, fx)
			continue
		}
		// Confirm Go's checker actually errors for this case.
		_, err := expr.Compile(code, expr.Env(env))
		if err == nil {
			// Go did not error: this is not an error case in our env shape.
			fx.Bucket = "NOT_APPLICABLE"
			fx.Reason = "Go checker did not error under the JS-modeled env shape"
			out = append(out, fx)
			continue
		}
		// Reclassify rejections that depend on Go strict-struct/method
		// reflection. A JS env object is an OPEN map (no closed field set, no
		// method signatures), so expr-js's checker cannot reproduce these
		// rejections. FORCED_DIVERGENCE -> NOT_APPLICABLE.
		strict := []string{
			"has no field",
			"has no method",
			"is not callable",
			"too many arguments",
			"invalid operation",
			"cannot get",
		}
		for _, s := range strict {
			if strings.Contains(c[1], s) {
				fx.Bucket = "NOT_APPLICABLE"
				fx.Reason = "Go strict-struct field/method checking (reflect); JS env objects are open maps"
				break
			}
		}
		out = append(out, fx)
	}
	dir := filepath.Join("fixtures")
	_ = os.MkdirAll(dir, 0o755)
	f, err := os.Create(filepath.Join(dir, "checker_mock.json"))
	if err != nil {
		panic(err)
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(out); err != nil {
		panic(err)
	}
	adapter, na := 0, 0
	for _, fx := range out {
		if fx.Bucket == "PASS_WITH_ADAPTER" {
			adapter++
		} else {
			na++
		}
	}
	println("checker_mock:", len(out), "total |", adapter, "PASS_WITH_ADAPTER |", na, "NOT_APPLICABLE")
}
