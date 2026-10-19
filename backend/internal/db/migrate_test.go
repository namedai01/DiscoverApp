package db_test

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

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

	m, err := db.NewMigrator(pool)
	if err != nil {
		t.Fatalf("new migrator: %v", err)
	}
	defer m.Close()
	if _, err := m.DownTo(ctx, 0); err != nil {
		t.Fatalf("down to 0: %v", err)
	}

	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("second up: %v", err)
	}

	if _, err := pool.Exec(ctx, `INSERT INTO users (id, display_name) VALUES ('u1', 'U One')`); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO follows (follower_id, target_id) VALUES ('u1', 'u1')`)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
		t.Fatalf("self-follow: want check violation 23514, got %v", err)
	}
}

// Several instances may start at once; the session lock must serialize them.
func TestMigrate_Concurrent(t *testing.T) {
	ctx := context.Background()
	pool := testutil.NewPool(t)

	m, err := db.NewMigrator(pool)
	if err != nil {
		t.Fatalf("new migrator: %v", err)
	}
	defer m.Close()
	if _, err := m.DownTo(ctx, 0); err != nil {
		t.Fatalf("down to 0: %v", err)
	}

	// Each Migrate call stands in for one instance with its own pool.
	const n = 5
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := range errs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs[i] = migrateOnOwnPool(ctx, pool)
		}()
	}
	wg.Wait()
	for i, err := range errs {
		if err != nil {
			t.Errorf("Migrate #%d: %v", i, err)
		}
	}

	var tables int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM information_schema.tables WHERE table_name IN ('users','locations','stories','follows','devices')`).Scan(&tables); err != nil {
		t.Fatal(err)
	}
	if tables != 5 {
		t.Fatalf("tables after concurrent migrate = %d, want 5", tables)
	}
}

func migrateOnOwnPool(ctx context.Context, like *pgxpool.Pool) error {
	cfg := like.Config()
	cfg.MaxConns = 2
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return err
	}
	defer p.Close()
	return db.Migrate(ctx, p)
}
