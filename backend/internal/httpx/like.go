package httpx

import "strings"

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// LikePrefix turns user search text into a case-insensitive prefix pattern for
// `lower(col) LIKE $n ESCAPE '\'`: it lowercases q, escapes the LIKE
// metacharacters \ % _ so they match literally, and appends %.
func LikePrefix(q string) string {
	return likeEscaper.Replace(strings.ToLower(q)) + "%"
}
