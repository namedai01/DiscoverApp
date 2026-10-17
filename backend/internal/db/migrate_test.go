package db_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/namedai01/memopin/backend/internal/db"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

func TestMigrate_UpDownUp(t *testing.T) {
	ctx := context.Background()
	pool := testutil.NewPool(t)

	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("first up: %v", err)
	}

	// Migrate has configured goose's dialect and embedded FS.
	sqlDB := stdlib.OpenDBFromPool(pool)
	defer sqlDB.Close()
	if err := goose.ResetContext(ctx, sqlDB, "migrations"); err != nil {
		t.Fatalf("reset (down): %v", err)
	}

	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("second up: %v", err)
	}

	if _, err := pool.Exec(ctx, `INSERT INTO users (id, display_name) VALUES ('u1', 'U One')`); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	_, err := pool.Exec(ctx, `INSERT INTO follows (follower_id, target_id) VALUES ('u1', 'u1')`)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
		t.Fatalf("self-follow: want check violation 23514, got %v", err)
	}
}
