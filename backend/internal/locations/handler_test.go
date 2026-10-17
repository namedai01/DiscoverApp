package locations_test

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/locations"
	"github.com/namedai01/memopin/backend/internal/server"
	"github.com/namedai01/memopin/backend/internal/testutil"
)

func TestMain(m *testing.M) { os.Exit(testutil.RunMain(m)) }

type listResp struct {
	Items []locations.LocationJSON `json:"items"`
}

func list(t *testing.T, h http.Handler, path string) []locations.LocationJSON {
	t.Helper()
	w := testutil.Do(t, h, "GET", path, "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET %s: status = %d, body = %s", path, w.Code, w.Body)
	}
	var resp listResp
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode %s: %v", w.Body, err)
	}
	if resp.Items == nil {
		t.Fatalf("items must be a JSON array, got %s", w.Body)
	}
	return resp.Items
}

func names(items []locations.LocationJSON) []string {
	out := make([]string, len(items))
	for i, it := range items {
		out[i] = it.VenueName
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestListLocations_SortedByName(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	testutil.SeedUser(t, pool, "u1", "An")
	hoGuom := testutil.SeedLocation(t, pool, "Hồ Gươm", 21.0285, 105.8542)
	testutil.SeedLocation(t, pool, "Bà Nà", 15.9977, 107.9886)
	testutil.SeedLocation(t, pool, "Cầu Rồng", 16.0614, 108.2272)
	testutil.SeedStory(t, pool, "u1", hoGuom, time.Now())
	testutil.SeedStory(t, pool, "u1", hoGuom, time.Now())

	items := list(t, h, "/v1/locations")
	if want := []string{"Bà Nà", "Cầu Rồng", "Hồ Gươm"}; !equal(names(items), want) {
		t.Fatalf("order = %v, want %v", names(items), want)
	}
	for _, it := range items {
		wantCount := int64(0)
		if it.VenueName == "Hồ Gươm" {
			wantCount = 2
			if it.ID != hoGuom.String() || it.Lat != 21.0285 || it.Lng != 105.8542 {
				t.Fatalf("Hồ Gươm = %+v, want id %s lat 21.0285 lng 105.8542", it, hoGuom)
			}
		}
		if it.StoryCount != wantCount {
			t.Fatalf("%s storyCount = %d, want %d", it.VenueName, it.StoryCount, wantCount)
		}
	}
}

func TestListLocations_EmptyIsArray(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	if items := list(t, h, "/v1/locations"); len(items) != 0 {
		t.Fatalf("items = %v", items)
	}
}

func TestListLocations_PrefixSearchCaseInsensitive(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	testutil.SeedLocation(t, pool, "Hồ Gươm", 21.0285, 105.8542)
	testutil.SeedLocation(t, pool, "Bà Nà", 15.9977, 107.9886)

	for _, path := range []string{"/v1/locations?q=h%E1%BB%93", "/v1/locations?q=H%E1%BB%92", "/v1/locations?q=%20h%E1%BB%93%20"} {
		if got := names(list(t, h, path)); !equal(got, []string{"Hồ Gươm"}) {
			t.Fatalf("%s = %v, want [Hồ Gươm]", path, got)
		}
	}
	// Prefix only: a word in the middle does not match.
	if got := list(t, h, "/v1/locations?q=g%C6%B0%C6%A1m"); len(got) != 0 {
		t.Fatalf("q=gươm = %v, want none", names(got))
	}
	// Blank q means no filter.
	for _, path := range []string{"/v1/locations?q=", "/v1/locations?q=%20%20"} {
		if got := list(t, h, path); len(got) != 2 {
			t.Fatalf("%s = %v, want both", path, names(got))
		}
	}
}

func TestListLocations_WildcardLiteral(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	testutil.SeedLocation(t, pool, "Hồ Gươm", 21.0285, 105.8542)
	for _, q := range []string{"%25", "_", "%5C"} {
		if got := list(t, h, "/v1/locations?q="+q); len(got) != 0 {
			t.Fatalf("q=%s = %v, want none", q, names(got))
		}
	}
	// A literal % at the start of a name is still found.
	testutil.SeedLocation(t, pool, "100% Cafe", 10, 106)
	if got := names(list(t, h, "/v1/locations?q=100%25")); !equal(got, []string{"100% Cafe"}) {
		t.Fatalf("q=100%% = %v", got)
	}
}

func TestListLocations_Paging(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	for _, n := range []string{"A", "B", "C"} {
		testutil.SeedLocation(t, pool, n, 10, 106)
	}
	if got := names(list(t, h, "/v1/locations?limit=2&offset=1")); !equal(got, []string{"B", "C"}) {
		t.Fatalf("page = %v", got)
	}
	if w := testutil.Do(t, h, "GET", "/v1/locations?limit=x", "", nil); w.Code != http.StatusBadRequest {
		t.Fatalf("bad limit status = %d", w.Code)
	}
}

func TestGetLocation(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	id := testutil.SeedLocation(t, pool, "Hồ Gươm", 21.0285, 105.8542)

	w := testutil.Do(t, h, "GET", "/v1/locations/"+id.String(), "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	var got locations.LocationJSON
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != id.String() || got.VenueName != "Hồ Gươm" || got.Lat != 21.0285 || got.Lng != 105.8542 || got.StoryCount != 0 {
		t.Fatalf("location = %+v", got)
	}
}

func TestGetLocation_NotFound(t *testing.T) {
	pool := testutil.NewPool(t)
	h := server.NewRouter(server.Deps{Pool: pool, Verifier: auth.Fake{}, Cfg: config.Config{}})
	for _, id := range []string{uuid.NewString(), "not-a-uuid"} {
		w := testutil.Do(t, h, "GET", "/v1/locations/"+id, "", nil)
		if w.Code != http.StatusNotFound {
			t.Fatalf("id %s: status = %d, body = %s", id, w.Code, w.Body)
		}
	}
}
