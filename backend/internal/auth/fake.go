package auth

import (
	"context"
	"fmt"
	"strings"
)

// Fake accepts tokens of the form "fake:<uid>:<phone>" without any network
// call. It backs tests and AUTH_MODE=fake (config refuses it outside dev).
type Fake struct{}

// Verify parses a fake token. The uid must be non-empty; the phone may be empty.
func (Fake) Verify(_ context.Context, token string) (Identity, error) {
	parts := strings.SplitN(token, ":", 3)
	if len(parts) != 3 || parts[0] != "fake" || parts[1] == "" {
		return Identity{}, fmt.Errorf("%w: malformed fake token", ErrInvalidToken)
	}
	return Identity{UID: parts[1], Phone: parts[2]}, nil
}
