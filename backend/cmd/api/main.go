// Command api runs the Memopin HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	firebase "firebase.google.com/go/v4"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/db"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/logx"
	"github.com/namedai01/memopin/backend/internal/notify"
	"github.com/namedai01/memopin/backend/internal/server"
)

func main() {
	slog.SetDefault(logx.New(os.Stdout))
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// ParseConfig takes sslmode, pool_max_conns, etc. from DATABASE_URL.
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}

	verifier, notifier, err := newFirebase(ctx, cfg, store.New(pool))
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              net.JoinHostPort("", cfg.Port),
		Handler:           server.NewRouter(server.Deps{Pool: pool, Cfg: cfg, Verifier: verifier, Notifier: notifier}),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr, "env", cfg.Env)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}

	// Cloud Run SIGKILLs the instance 10 s after SIGTERM.
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// newFirebase picks the token verifier and the push notifier. Fake mode (dev
// only, enforced by config) needs no Google credentials and sends no pushes;
// firebase mode builds both from one app using Application Default
// Credentials.
func newFirebase(ctx context.Context, cfg config.Config, q *store.Queries) (auth.Verifier, notify.Notifier, error) {
	if cfg.AuthMode == "fake" {
		slog.Warn("AUTH_MODE=fake: accepting unauthenticated fake tokens, push disabled")
		return auth.Fake{}, notify.Noop{}, nil
	}
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.FirebaseProjectID})
	if err != nil {
		return nil, nil, fmt.Errorf("firebase app: %w", err)
	}
	verifier, err := auth.NewFirebase(ctx, app)
	if err != nil {
		return nil, nil, err
	}
	msg, err := app.Messaging(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("firebase messaging: %w", err)
	}
	return verifier, notify.NewFCM(q, msg, slog.Default()), nil
}
