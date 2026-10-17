package auth

import (
	"context"
	"fmt"

	firebase "firebase.google.com/go/v4"
	fbauth "firebase.google.com/go/v4/auth"
)

type firebaseVerifier struct {
	client *fbauth.Client
}

// NewFirebase returns a Verifier backed by the Firebase Admin SDK. Tokens are
// checked with VerifyIDToken (signature, expiry, audience, issuer); the
// revocation-check variant is not used because it costs a network call per
// request.
func NewFirebase(ctx context.Context, app *firebase.App) (Verifier, error) {
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("auth: firebase auth client: %w", err)
	}
	return &firebaseVerifier{client: client}, nil
}

func (f *firebaseVerifier) Verify(ctx context.Context, idToken string) (Identity, error) {
	tok, err := f.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return Identity{}, err
	}
	phone, _ := tok.Claims["phone_number"].(string)
	return Identity{UID: tok.UID, Phone: phone}, nil
}
