package seed_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/seed"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

func sample() []seed.Location {
	return []seed.Location{
		{Key: "a", VenueName: "Alpha", VenueLocation: "Hà Nội", Description: "d1", ImageURL: "", Lat: 21.0288, Lng: 105.8525},
		{Key: "b", VenueName: "Beta", Lat: 16.0611, Lng: 108.2272},
		{Key: "c", VenueName: "Gamma", Lat: -33.5, Lng: -70.25},
	}
}

func count(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM locations`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestApply_Idempotent(t *testing.T) {
	ctx := context.Background()
	pool := testutil.NewPool(t)
	locs := sample()

	ins, upd, err := seed.Apply(ctx, pool, locs)
	if err != nil || ins != 3 || upd != 0 {
		t.Fatalf("first apply = (%d, %d, %v), want (3, 0, nil)", ins, upd, err)
	}
	ins, upd, err = seed.Apply(ctx, pool, locs)
	if err != nil || ins != 0 || upd != 3 {
		t.Fatalf("second apply = (%d, %d, %v), want (0, 3, nil)", ins, upd, err)
	}
	if n := count(t, pool); n != 3 {
		t.Fatalf("row count = %d, want 3", n)
	}

	var lat, lng float64
	err = pool.QueryRow(ctx, `SELECT ST_Y(geog::geometry), ST_X(geog::geometry) FROM locations WHERE seed_key = 'c'`).Scan(&lat, &lng)
	if err != nil || lat != -33.5 || lng != -70.25 {
		t.Fatalf("coords = (%v, %v, %v), want (-33.5, -70.25) as lat, lng", lat, lng, err)
	}
}

func TestApply_UpdatesChangedRow(t *testing.T) {
	ctx := context.Background()
	pool := testutil.NewPool(t)
	locs := sample()
	if _, _, err := seed.Apply(ctx, pool, locs); err != nil {
		t.Fatal(err)
	}
	var before uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM locations WHERE seed_key = 'b'`).Scan(&before); err != nil {
		t.Fatal(err)
	}

	locs[1].VenueName = "Beta Renamed"
	locs[1].Lat, locs[1].Lng = 10, 20
	if _, _, err := seed.Apply(ctx, pool, locs); err != nil {
		t.Fatal(err)
	}

	var after uuid.UUID
	var name string
	var lat, lng float64
	err := pool.QueryRow(ctx, `SELECT id, venue_name, ST_Y(geog::geometry), ST_X(geog::geometry) FROM locations WHERE seed_key = 'b'`).Scan(&after, &name, &lat, &lng)
	if err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Fatalf("uuid changed %s -> %s; stories would be orphaned", before, after)
	}
	if name != "Beta Renamed" || lat != 10 || lng != 20 {
		t.Fatalf("row = (%q, %v, %v), want updated values", name, lat, lng)
	}
}

func TestDryRun_RollsBack(t *testing.T) {
	ctx := context.Background()
	pool := testutil.NewPool(t)

	ins, upd, err := seed.DryRun(ctx, pool, sample())
	if err != nil || ins != 3 || upd != 0 {
		t.Fatalf("dry run = (%d, %d, %v), want (3, 0, nil)", ins, upd, err)
	}
	if n := count(t, pool); n != 0 {
		t.Fatalf("rows after dry run = %d, want 0", n)
	}
}

func TestApply_RollsBackOnError(t *testing.T) {
	ctx := context.Background()
	pool := testutil.NewPool(t)
	locs := sample()
	locs[2].VenueName = "bad\x00name" // Postgres rejects NUL in text, after rows 0 and 1 were written

	if _, _, err := seed.Apply(ctx, pool, locs); err == nil {
		t.Fatal("want error for NUL in text")
	}
	if n := count(t, pool); n != 0 {
		t.Fatalf("rows after failed apply = %d, want 0 (single transaction)", n)
	}
}

func TestLoad_Valid(t *testing.T) {
	in := `[{"key":"k","venueName":"V","venueLocation":"L","description":"D","imageUrl":"https://x/y.jpg","lat":0,"lng":-180}]`
	locs, err := seed.Load(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	want := seed.Location{Key: "k", VenueName: "V", VenueLocation: "L", Description: "D", ImageURL: "https://x/y.jpg", Lat: 0, Lng: -180}
	if len(locs) != 1 || locs[0] != want {
		t.Fatalf("locs = %+v, want [%+v]", locs, want)
	}
}

func TestLoad_RejectsBadRows(t *testing.T) {
	ok := `{"key":"ok","venueName":"Ok","lat":1,"lng":2}`
	cases := []struct {
		name, row, wantErr string
	}{
		{"missing key", `{"venueName":"V","lat":1,"lng":2}`, "row 1: key is required"},
		{"blank key", `{"key":"  ","venueName":"V","lat":1,"lng":2}`, "row 1: key is required"},
		{"key with surrounding whitespace", `{"key":" x ","venueName":"V","lat":1,"lng":2}`, "row 1: key must not have leading or trailing whitespace"},
		{"duplicate key", `{"key":"ok","venueName":"V","lat":1,"lng":2}`, `row 1: duplicate key "ok"`},
		{"lat 91", `{"key":"x","venueName":"V","lat":91,"lng":2}`, "row 1: lat out of range"},
		{"lat -91", `{"key":"x","venueName":"V","lat":-91,"lng":2}`, "row 1: lat out of range"},
		{"lng 181", `{"key":"x","venueName":"V","lat":1,"lng":181}`, "row 1: lng out of range"},
		{"empty venueName", `{"key":"x","venueName":"","lat":1,"lng":2}`, "row 1: venueName is required"},
		{"missing lat", `{"key":"x","venueName":"V","lng":2}`, "row 1: lat is required"},
		{"missing lng", `{"key":"x","venueName":"V","lat":1}`, "row 1: lng is required"},
		{"unknown field", `{"key":"x","venueName":"V","lat":1,"lng":2,"extra":true}`, "unknown field"},
		{"wrong type", `{"key":"x","venueName":"V","lat":"1","lng":2}`, "row 1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			locs, err := seed.Load(strings.NewReader("[" + ok + "," + tc.row + "]"))
			if err == nil {
				t.Fatalf("want error containing %q, got locs = %+v", tc.wantErr, locs)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %q, want it to contain %q", err, tc.wantErr)
			}
			if locs != nil {
				t.Fatalf("locs = %+v, want nil on error", locs)
			}
		})
	}
}

func TestLoad_RejectsMalformedDocument(t *testing.T) {
	for name, in := range map[string]string{
		"not an array":  `{"key":"a"}`,
		"empty input":   ``,
		"trailing data": `[] []`,
		"null row":      `[null]`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := seed.Load(strings.NewReader(in)); err == nil {
				t.Fatal("want error")
			}
		})
	}
}

func TestCommittedSeedFileLoads(t *testing.T) {
	f, err := os.Open("../../seed/locations.json")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	locs, err := seed.Load(f)
	if err != nil {
		t.Fatal(err)
	}
	if len(locs) != 3 {
		t.Fatalf("len = %d, want 3", len(locs))
	}
}
