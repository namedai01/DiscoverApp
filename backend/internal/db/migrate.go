// Package db applies the embedded schema migrations.
package db

import (
	"context"
	"embed"
	"fmt"
	"io/fs"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

//go:embed migrations/*.sql
var migrations embed.FS

// NewMigrator returns a goose provider over the embedded migrations. It holds
// a Postgres session advisory lock while migrating, so several instances
// starting at once (Cloud Run) apply the schema one after another. The lock
// takes one connection and the migration another, so the pool needs at least
// two. Close the provider when done; that does not close the pool.
func NewMigrator(pool *pgxpool.Pool) (*goose.Provider, error) {
	fsys, err := fs.Sub(migrations, "migrations")
	if err != nil {
		return nil, fmt.Errorf("migrations fs: %w", err)
	}
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return nil, fmt.Errorf("migration locker: %w", err)
	}
	p, err := goose.NewProvider(goose.DialectPostgres, stdlib.OpenDBFromPool(pool), fsys, goose.WithSessionLocker(locker))
	if err != nil {
		return nil, fmt.Errorf("goose provider: %w", err)
	}
	return p, nil
}

// Migrate brings the database up to the latest schema. It needs a session
// connection (a direct Postgres endpoint, not a transaction pooler).
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	p, err := NewMigrator(pool)
	if err != nil {
		return err
	}
	defer p.Close()
	if _, err := p.Up(ctx); err != nil {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}
