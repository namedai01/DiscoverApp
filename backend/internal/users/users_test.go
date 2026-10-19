package users_test

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/testutil"
)

func seedFollow(t *testing.T, pool *pgxpool.Pool, follower, target string) {
	t.Helper()
	if _, err := pool.Exec(t.Context(),
		"INSERT INTO follows (follower_id, target_id) VALUES ($1, $2)", follower, target); err != nil {
		t.Fatal(err)
	}
}

func listUsers(t *testing.T, h http.Handler, path string) []map[string]any {
	t.Helper()
	w := testutil.Do(t, h, "GET", path, "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET %s: status = %d, body = %s", path, w.Code, w.Body)
	}
	var resp struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode %s: %v", w.Body, err)
	}
	if resp.Items == nil {
		t.Fatalf("items must be a JSON array, got %s", w.Body)
	}
	return resp.Items
}

func userIDs(items []map[string]any) []string {
	out := make([]string, len(items))
	for i, it := range items {
		out[i], _ = it["id"].(string)
	}
	return out
}

func sameIDs(got []string, want ...string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func TestListUsers_SortedByFollowers(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "Cuong")
	testutil.SeedUser(t, pool, "u2", "Binh")
	testutil.SeedUser(t, pool, "u3", "An")
	testutil.SeedUser(t, pool, "u4", "Dung")
	testutil.SeedUser(t, pool, "u5", "Anh")
	seedFollow(t, pool, "u1", "u3")
	seedFollow(t, pool, "u2", "u3")
	seedFollow(t, pool, "u1", "u2")

	items := listUsers(t, h, "/v1/users")
	// u3 (2 followers), u2 (1), then the rest by name: Anh, Cuong, Dung.
	if got := userIDs(items); !sameIDs(got, "u3", "u2", "u5", "u1", "u4") {
		t.Fatalf("order = %v", got)
	}
	if items[0]["followerCount"] != float64(2) || items[1]["followerCount"] != float64(1) || items[2]["followerCount"] != float64(0) {
		t.Fatalf("followerCounts = %v %v %v", items[0]["followerCount"], items[1]["followerCount"], items[2]["followerCount"])
	}
	for _, it := range items {
		if _, present := it["isFollowing"]; present {
			t.Fatalf("isFollowing must be omitted in the list: %v", it)
		}
	}
}

func TestListUsers_TiesByNameCaseInsensitive(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "bao")
	testutil.SeedUser(t, pool, "u2", "An")
	testutil.SeedUser(t, pool, "u3", "Cam")
	if got := userIDs(listUsers(t, h, "/v1/users")); !sameIDs(got, "u2", "u1", "u3") {
		t.Fatalf("order = %v", got)
	}
}

func TestListUsers_SearchPrefix(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "Nguyen An")
	testutil.SeedUser(t, pool, "u2", "nguyen Binh")
	testutil.SeedUser(t, pool, "u3", "Tran Nguyen")
	testutil.SeedUser(t, pool, "u4", "100% Fan")
	testutil.SeedUser(t, pool, "u5", "100x Fan")
	testutil.SeedUser(t, pool, "u6", "a_b")
	testutil.SeedUser(t, pool, "u7", "axb")
	testutil.SeedUser(t, pool, "u8", `c\d`)
	testutil.SeedUser(t, pool, "u9", "cxd")

	tests := []struct {
		name, path string
		want       []string
	}{
		{"prefix, case-insensitive", "/v1/users?q=NGUYEN", []string{"u1", "u2"}},
		{"not a substring match", "/v1/users?q=binh", nil},
		{"percent is literal", "/v1/users?q=100%25", []string{"u4"}},
		{"underscore is literal", "/v1/users?q=a_", []string{"u6"}},
		{"backslash is literal", "/v1/users?q=c%5C", []string{"u8"}},
		{"blank q means no filter", "/v1/users?q=%20%20", []string{"u4", "u5", "u6", "u7", "u8", "u9", "u1", "u2", "u3"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := userIDs(listUsers(t, h, tt.path)); !sameIDs(got, tt.want...) {
				t.Fatalf("ids = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestListUsers_Paging(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "A")
	testutil.SeedUser(t, pool, "u2", "B")
	testutil.SeedUser(t, pool, "u3", "C")
	if got := userIDs(listUsers(t, h, "/v1/users?limit=1&offset=1")); !sameIDs(got, "u2") {
		t.Fatalf("ids = %v", got)
	}
	if w := testutil.Do(t, h, "GET", "/v1/users?limit=x", "", nil); w.Code != http.StatusBadRequest {
		t.Fatalf("bad limit: status = %d", w.Code)
	}
	if w := testutil.Do(t, h, "GET", "/v1/users?offset=100001", "", nil); w.Code != http.StatusBadRequest {
		t.Fatalf("huge offset: status = %d", w.Code)
	}
}

func TestListUsers_EmptyIsArray(t *testing.T) {
	h, _ := newHandler(t)
	if items := listUsers(t, h, "/v1/users"); len(items) != 0 {
		t.Fatalf("items = %v", items)
	}
}

func TestGetUser_RequiresAuth(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u2", "Binh")
	if w := testutil.Do(t, h, "GET", "/v1/users/u2", "", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", w.Code)
	}
	if w := testutil.DoToken(t, h, "GET", "/v1/users/u2", "garbage", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestGetUser_IsFollowingForCaller(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "An")
	testutil.SeedUser(t, pool, "u2", "Binh")
	testutil.SeedUser(t, pool, "u3", "Cam")
	seedFollow(t, pool, "u1", "u2")
	seedFollow(t, pool, "u3", "u2")

	w := testutil.Do(t, h, "GET", "/v1/users/u2", "u1", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
	got := decodeUser(t, w.Body.Bytes())
	if got["id"] != "u2" || got["displayName"] != "Binh" || got["followerCount"] != float64(2) || got["isFollowing"] != true {
		t.Fatalf("user = %v", got)
	}

	// A caller who does not follow u2 sees an explicit false, not a missing key.
	testutil.SeedUser(t, pool, "u4", "Dung")
	w = testutil.Do(t, h, "GET", "/v1/users/u2", "u4", nil)
	got = decodeUser(t, w.Body.Bytes())
	if v, present := got["isFollowing"]; !present || v != false {
		t.Fatalf("isFollowing = %v (present %v), want false", v, present)
	}
}

func TestGetUser_Unknown404(t *testing.T) {
	h, _ := newHandler(t)
	w := testutil.Do(t, h, "GET", "/v1/users/nobody", "u1", nil)
	if w.Code != http.StatusNotFound || !strings.Contains(w.Body.String(), `"code":"not_found"`) {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body)
	}
}

func TestDefaultPhotoAppliedAtRender(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "No Photo") // photo_url NULL
	testutil.SeedUser(t, pool, "u2", "Empty Photo")
	if _, err := pool.Exec(t.Context(), "UPDATE users SET photo_url = '' WHERE id = 'u2'"); err != nil {
		t.Fatal(err)
	}
	testutil.SeedUser(t, pool, "u3", "Own Photo")
	if _, err := pool.Exec(t.Context(), "UPDATE users SET photo_url = 'https://example.test/own.png' WHERE id = 'u3'"); err != nil {
		t.Fatal(err)
	}

	want := map[string]string{"u1": defaultPhoto, "u2": defaultPhoto, "u3": "https://example.test/own.png"}
	for _, it := range listUsers(t, h, "/v1/users") {
		if got := it["photoUrl"]; got != want[it["id"].(string)] {
			t.Errorf("list: %v photoUrl = %v, want %v", it["id"], got, want[it["id"].(string)])
		}
	}
	for uid, photo := range want {
		w := testutil.Do(t, h, "GET", "/v1/users/"+uid, "viewer", nil)
		if got := decodeUser(t, w.Body.Bytes())["photoUrl"]; got != photo {
			t.Errorf("get %s: photoUrl = %v, want %v", uid, got, photo)
		}
	}

	// GET /v1/me for a user whose stored photo is NULL.
	testutil.SeedUser(t, pool, "u4", "Me")
	w := testutil.Do(t, h, "GET", "/v1/me", "u4", nil)
	if got := decodeUser(t, w.Body.Bytes())["photoUrl"]; got != defaultPhoto {
		t.Errorf("me: photoUrl = %v, want %v", got, defaultPhoto)
	}
}

func TestListUsers_DecomposedQueryMatchesComposedName(t *testing.T) {
	h, pool := newHandler(t)
	testutil.SeedUser(t, pool, "u1", "H\u1ed3 Nam") // stored NFC
	got := listUsers(t, h, "/v1/users?q="+url.QueryEscape("Ho\u0302\u0300"))
	if !sameIDs(userIDs(got), "u1") {
		t.Fatalf("NFD query matched %v, want [u1]", userIDs(got))
	}
}
