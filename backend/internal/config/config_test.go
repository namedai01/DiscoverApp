package config

import "testing"

// setenv clears every variable Load reads, then applies the given ones.
func setenv(t *testing.T, kv map[string]string) {
	t.Helper()
	for _, k := range []string{
		"APP_ENV", "DATABASE_URL", "PORT", "FIREBASE_PROJECT_ID", "STORAGE_BUCKET",
		"DEFAULT_USER_PHOTO_URL", "CORS_ORIGINS", "AUTH_MODE",
	} {
		t.Setenv(k, "")
	}
	for k, v := range kv {
		t.Setenv(k, v)
	}
}

func TestLoad_FakeAuthOnlyInDev(t *testing.T) {
	setenv(t, map[string]string{
		"DATABASE_URL": "postgres://x",
		"APP_ENV":      "prod",
		"AUTH_MODE":    "fake",
	})
	if _, err := Load(); err == nil {
		t.Fatal("expected error for AUTH_MODE=fake with APP_ENV=prod")
	}

	setenv(t, map[string]string{
		"DATABASE_URL": "postgres://x",
		"APP_ENV":      "dev",
		"AUTH_MODE":    "fake",
	})
	cfg, err := Load()
	if err != nil {
		t.Fatalf("fake auth in dev should load: %v", err)
	}
	if cfg.AuthMode != "fake" {
		t.Fatalf("AuthMode = %q, want fake", cfg.AuthMode)
	}
}

func TestLoad_DefaultsAndLists(t *testing.T) {
	setenv(t, map[string]string{
		"DATABASE_URL":        "postgres://x",
		"CORS_ORIGINS":        "http://a.test, http://b.test ,",
		"FIREBASE_PROJECT_ID": "proj",
		"STORAGE_BUCKET":      "proj.firebasestorage.app",
	})
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "8080" || cfg.Env != "dev" || cfg.AuthMode != "firebase" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if len(cfg.CORSOrigins) != 2 || cfg.CORSOrigins[0] != "http://a.test" || cfg.CORSOrigins[1] != "http://b.test" {
		t.Fatalf("CORSOrigins = %q", cfg.CORSOrigins)
	}
}

func TestLoad_RejectsBadValues(t *testing.T) {
	cases := map[string]map[string]string{
		"missing database url": {},
		"bad env":              {"DATABASE_URL": "postgres://x", "APP_ENV": "staging"},
		"bad auth mode":        {"DATABASE_URL": "postgres://x", "AUTH_MODE": "magic"},
		"prod without cors": {
			"DATABASE_URL": "postgres://x", "APP_ENV": "prod", "AUTH_MODE": "firebase",
			"FIREBASE_PROJECT_ID": "p", "STORAGE_BUCKET": "b",
		},
		"firebase without project id": {"DATABASE_URL": "postgres://x", "AUTH_MODE": "firebase", "STORAGE_BUCKET": "b"},
		"firebase without bucket":     {"DATABASE_URL": "postgres://x", "AUTH_MODE": "firebase", "FIREBASE_PROJECT_ID": "p"},
		"port not a number":           {"DATABASE_URL": "postgres://x", "AUTH_MODE": "fake", "PORT": "http"},
		"port zero":                   {"DATABASE_URL": "postgres://x", "AUTH_MODE": "fake", "PORT": "0"},
		"port too large":              {"DATABASE_URL": "postgres://x", "AUTH_MODE": "fake", "PORT": "65536"},
	}
	for name, env := range cases {
		t.Run(name, func(t *testing.T) {
			setenv(t, env)
			if _, err := Load(); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestLoad_AcceptsValidProd(t *testing.T) {
	setenv(t, map[string]string{
		"DATABASE_URL": "postgres://x", "APP_ENV": "prod", "AUTH_MODE": "firebase",
		"FIREBASE_PROJECT_ID": "p", "STORAGE_BUCKET": "p.firebasestorage.app",
		"CORS_ORIGINS": "https://app.test", "PORT": "65535",
	})
	if _, err := Load(); err != nil {
		t.Fatalf("valid prod config rejected: %v", err)
	}
}
