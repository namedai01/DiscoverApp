package logx

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestNew_CloudLoggingShape(t *testing.T) {
	var buf bytes.Buffer
	l := New(&buf)
	l.Info("hello", "request_id", "abc")
	l.Warn("careful")
	l.Error("bad")

	var got []map[string]any
	dec := json.NewDecoder(&buf)
	for dec.More() {
		var m map[string]any
		if err := dec.Decode(&m); err != nil {
			t.Fatal(err)
		}
		got = append(got, m)
	}
	if len(got) != 3 {
		t.Fatalf("lines = %d, want 3", len(got))
	}
	for i, want := range []struct{ sev, msg string }{{"INFO", "hello"}, {"WARNING", "careful"}, {"ERROR", "bad"}} {
		m := got[i]
		if m["severity"] != want.sev || m["message"] != want.msg {
			t.Errorf("line %d = %v, want severity %s message %s", i, m, want.sev, want.msg)
		}
		if _, ok := m["level"]; ok {
			t.Errorf("line %d still has level key: %v", i, m)
		}
		if _, ok := m["msg"]; ok {
			t.Errorf("line %d still has msg key: %v", i, m)
		}
	}
	if got[0]["request_id"] != "abc" {
		t.Errorf("attrs lost: %v", got[0])
	}
}
