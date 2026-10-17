// Package config loads process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

// Config holds every setting the API reads. Later features only read fields.
type Config struct {
	Env                 string // "dev" | "prod"
	Port                string
	DatabaseURL         string
	FirebaseProjectID   string
	StorageBucket       string
	DefaultUserPhotoURL string
	CORSOrigins         []string
	AuthMode            string // "firebase" | "fake"
}

// Load reads the environment and validates it.
func Load() (Config, error) {
	cfg := Config{
		Env:                 getenv("APP_ENV", "dev"),
		Port:                getenv("PORT", "8080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		FirebaseProjectID:   os.Getenv("FIREBASE_PROJECT_ID"),
		StorageBucket:       os.Getenv("STORAGE_BUCKET"),
		DefaultUserPhotoURL: os.Getenv("DEFAULT_USER_PHOTO_URL"),
		CORSOrigins:         splitList(os.Getenv("CORS_ORIGINS")),
		AuthMode:            getenv("AUTH_MODE", "firebase"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("config: DATABASE_URL is required")
	}
	if cfg.Env != "dev" && cfg.Env != "prod" {
		return Config{}, fmt.Errorf("config: APP_ENV must be dev or prod, got %q", cfg.Env)
	}
	if cfg.AuthMode != "firebase" && cfg.AuthMode != "fake" {
		return Config{}, fmt.Errorf("config: AUTH_MODE must be firebase or fake, got %q", cfg.AuthMode)
	}
	if cfg.AuthMode == "fake" && cfg.Env != "dev" {
		return Config{}, errors.New("config: AUTH_MODE=fake is only allowed when APP_ENV=dev")
	}
	return cfg, nil
}

// getenv returns the variable's value, or def when it is unset or empty.
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// splitList splits a comma-separated list, trimming blanks and dropping empties.
func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
