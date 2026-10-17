package stories_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/namedai01/memopin/backend/internal/stories"
)

func TestCursor_RoundTrip(t *testing.T) {
	at := time.Date(2026, 10, 17, 8, 30, 15, 123456000, time.UTC)
	id := uuid.New()
	gotAt, gotID, err := stories.DecodeCursor(stories.EncodeCursor(at, id))
	if err != nil {
		t.Fatal(err)
	}
	if !gotAt.Equal(at) || gotID != id {
		t.Fatalf("round trip = %v %v, want %v %v", gotAt, gotID, at, id)
	}
}

func TestDecodeCursor_Garbage(t *testing.T) {
	for _, s := range []string{
		"", "not base64 !!", "bm8tcGlwZQ", // "no-pipe"
		"MjAyNi0xMC0xN1QwODozMDoxNVp8bm90LWEtdXVpZA",                      // valid time, bad uuid
		"bm90LWEtdGltZXw1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA", // bad time, valid uuid
	} {
		if _, _, err := stories.DecodeCursor(s); err == nil {
			t.Errorf("DecodeCursor(%q) = nil error, want error", s)
		}
	}
}
