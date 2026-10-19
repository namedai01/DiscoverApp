package httpx

import (
	"strings"

	"golang.org/x/text/unicode/norm"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// LikePrefix turns user search text into a case-insensitive prefix pattern for
// `lower(col) LIKE $n ESCAPE '\'`: it normalizes q to NFC (stored text is NFC,
// but a keyboard or client may send decomposed Vietnamese), lowercases it, escapes the LIKE
// metacharacters \ % _ so they match literally, and appends %.
func LikePrefix(q string) string {
	return likeEscaper.Replace(strings.ToLower(norm.NFC.String(q))) + "%"
}
