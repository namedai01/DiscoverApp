// Package logx builds the JSON slog logger Cloud Logging understands.
package logx

import (
	"io"
	"log/slog"
)

// New returns a logger that writes one JSON object per line to w. The level
// key is renamed to "severity" and WARN becomes WARNING, and "msg" becomes
// "message", which is what Cloud Logging reads.
func New(w io.Writer) *slog.Logger {
	return slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{ReplaceAttr: replaceAttr}))
}

func replaceAttr(groups []string, a slog.Attr) slog.Attr {
	if len(groups) > 0 {
		return a
	}
	switch a.Key {
	case slog.LevelKey:
		sev := a.Value.String()
		if lvl, ok := a.Value.Any().(slog.Level); ok && lvl == slog.LevelWarn {
			sev = "WARNING"
		}
		return slog.String("severity", sev)
	case slog.MessageKey:
		return slog.String("message", a.Value.String())
	}
	return a
}
