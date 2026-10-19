// Package testutil provides shared helpers for integration tests.
package testutil

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/namedai01/memopin/backend/internal/db"
)

const pgImage = "postgis/postgis:16-3.4"

var (
	once      sync.Once
	pool      *pgxpool.Pool
	container *postgres.PostgresContainer
	startErr  error
)

// NewPool returns a pool on a PostGIS container shared by every test in the
// calling package (started and migrated on first use, stopped by RunMain).
// Every call empties all app tables so each test starts clean. Needs Docker.
func NewPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	once.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
		defer cancel()

		container, startErr = postgres.Run(ctx, pgImage,
			postgres.WithDatabase("memopin"),
			postgres.WithUsername("memopin"),
			postgres.WithPassword("memopin"),
			postgres.BasicWaitStrategies(),
		)
		if startErr != nil {
			return
		}
		var dsn string
		if dsn, startErr = container.ConnectionString(ctx, "sslmode=disable"); startErr != nil {
			return
		}
		if pool, startErr = pgxpool.New(ctx, dsn); startErr != nil {
			return
		}
		startErr = db.Migrate(ctx, pool)
	})
	if startErr != nil {
		t.Fatalf("start postgres container (is Docker running?): %v", startErr)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := pool.Exec(ctx, "TRUNCATE users, locations, stories, follows, devices RESTART IDENTITY CASCADE"); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
	return pool
}

// RunMain runs the package's tests, then tears the shared container down.
// It also silences the default slog logger so test output stays clean; tests
// that assert on logs install their own logger. Use it from TestMain:
// os.Exit(testutil.RunMain(m)).
func RunMain(m *testing.M) int {
	slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
	code := m.Run()
	if pool != nil {
		pool.Close()
	}
	if container != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		_ = container.Terminate(ctx)
	}
	return code
}
