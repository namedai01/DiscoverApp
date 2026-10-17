// Package auth verifies Firebase ID tokens and guards routes with them.
package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/namedai01/memopin/backend/internal/httpx"
)

// Identity is the caller as proven by a verified token.
type Identity struct {
	UID   string
	Phone string // empty when the token carries no phone_number claim
}

// ErrInvalidToken is returned (possibly wrapped) by a Verifier when the token
// itself is rejected: malformed, forged, wrong audience or expired. Any other
// Verify error means the verifier could not decide (for example Firebase's key
// endpoint is unreachable) and is answered with 503, not 401.
var ErrInvalidToken = errors.New("auth: invalid token")

// Verifier turns a bearer token into an Identity or an error. Rejections of
// the token itself must wrap ErrInvalidToken.
type Verifier interface {
	Verify(ctx context.Context, idToken string) (Identity, error)
}

type ctxKey struct{}

// FromContext returns the identity stored by Required or Optional.
func FromContext(ctx context.Context) (Identity, bool) {
	id, ok := ctx.Value(ctxKey{}).(Identity)
	return id, ok
}

// Required rejects requests without a valid bearer token with 401.
func Required(v Verifier) func(http.Handler) http.Handler {
	return middleware(v, true)
}

// Optional lets requests without an Authorization header through anonymously.
// A header that is present but invalid is still a 401: a bad or expired token
// never degrades into an anonymous request.
func Optional(v Verifier) func(http.Handler) http.Handler {
	return middleware(v, false)
}

// errVerifierUnavailable is the 503 for a verifier failure that is not a token rejection.
var errVerifierUnavailable = &httpx.APIError{
	Status:  http.StatusServiceUnavailable,
	Code:    "internal",
	Message: "authentication temporarily unavailable",
}

func middleware(v Verifier, required bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				if required {
					httpx.Error(w, httpx.Unauthorized("missing bearer token"))
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			token, ok := bearerToken(header)
			if !ok {
				httpx.Error(w, httpx.Unauthorized("malformed Authorization header"))
				return
			}
			id, err := v.Verify(r.Context(), token)
			if err != nil {
				slog.Warn("auth: token verification failed",
					"err", err,
					"invalid_token", errors.Is(err, ErrInvalidToken),
					"request_id", chimw.GetReqID(r.Context()))
				if errors.Is(err, ErrInvalidToken) {
					httpx.Error(w, httpx.Unauthorized("invalid or expired token"))
				} else {
					httpx.Error(w, errVerifierUnavailable)
				}
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
		})
	}
}

// bearerToken extracts the token from "Bearer <token>" (scheme is case-insensitive).
func bearerToken(header string) (string, bool) {
	scheme, token, found := strings.Cut(header, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}
