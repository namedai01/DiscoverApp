// Command seed upserts places from a JSON file into the locations table.
// It needs only DATABASE_URL (no Firebase settings) and migrates first, so it
// works on an empty database. Run from backend/: go run ./cmd/seed [-dry-run].
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/db"
	"github.com/namedai01/memopin/backend/internal/seed"
)

func main() {
	if err := run(); err != nil {
		slog.Error("seed failed", "err", err)
		os.Exit(1)
	}
}

func run() error {
	file := flag.String("file", "seed/locations.json", "seed JSON file, relative to the working directory (backend/)")
	dryRun := flag.Bool("dry-run", false, "apply inside a transaction, roll it back and print the counts")
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL is required")
	}

	f, err := os.Open(*file)
	if err != nil {
		return err
	}
	locs, err := seed.Load(f)
	f.Close()
	if err != nil {
		return fmt.Errorf("%s: %w", *file, err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// ParseConfig takes sslmode, pool_max_conns, etc. from DATABASE_URL.
	poolCfg, err := pgxpool.ParseConfig(dbURL)
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

	apply := seed.Apply
	if *dryRun {
		apply = seed.DryRun
	}
	inserted, updated, err := apply(ctx, pool, locs)
	if err != nil {
		return err
	}
	fmt.Printf("inserted=%d updated=%d", inserted, updated)
	if *dryRun {
		fmt.Print(" (dry run, rolled back)")
	}
	fmt.Println()
	return nil
}
