// Package httpx holds the JSON, error and pagination helpers shared by handlers.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
)

const maxBodyBytes = 1 << 20 // 1 MiB

const (
	defaultLimit = 20
	maxLimit     = 100
	maxOffset    = 100000
)

// APIError is an error that maps to a specific HTTP status and error code.
type APIError struct {
	Status  int
	Code    string
	Message string
}

func (e *APIError) Error() string { return e.Code + ": " + e.Message }

func BadRequest(msg string) *APIError {
	return &APIError{http.StatusBadRequest, "bad_request", msg}
}
func Unauthorized(msg string) *APIError {
	return &APIError{http.StatusUnauthorized, "unauthorized", msg}
}
func Forbidden(msg string) *APIError { return &APIError{http.StatusForbidden, "forbidden", msg} }
func NotFound(msg string) *APIError  { return &APIError{http.StatusNotFound, "not_found", msg} }
func Conflict(msg string) *APIError  { return &APIError{http.StatusConflict, "conflict", msg} }
func Unprocessable(msg string) *APIError {
	return &APIError{http.StatusUnprocessableEntity, "unprocessable", msg}
}

// JSON writes v as a JSON response with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("httpx: encode response", "err", err)
	}
}

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error writes err as the standard error body. An APIError keeps its status
// and message; anything else becomes a 500 "internal" with the cause logged
// and hidden from the client.
func Error(w http.ResponseWriter, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		slog.Error("internal error", "err", err)
		apiErr = &APIError{http.StatusInternalServerError, "internal", "internal server error"}
	}
	JSON(w, apiErr.Status, errorBody{errorDetail{apiErr.Code, apiErr.Message}})
}

// Decode reads a single JSON value from the request body into v. Unknown
// fields, trailing data and bodies over 1 MiB are rejected as 400s.
func Decode(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return BadRequest("request body too large")
		}
		return BadRequest("invalid JSON body: " + err.Error())
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return BadRequest("request body must contain a single JSON value")
	}
	return nil
}

// Limit parses limit from the query string: it defaults to 20, is clamped to
// 1..100, and a non-integer value is a 400.
func Limit(r *http.Request) (int, error) {
	s := r.URL.Query().Get("limit")
	if s == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.Atoi(s)
	if err != nil {
		return 0, BadRequest("limit must be an integer")
	}
	return min(max(limit, 1), maxLimit), nil
}

// Page parses limit (see Limit) and offset from the query string. offset
// defaults to 0; non-integer values, a negative offset and an offset above
// 100000 are 400s.
func Page(r *http.Request) (limit, offset int, err error) {
	if limit, err = Limit(r); err != nil {
		return 0, 0, err
	}
	if s := r.URL.Query().Get("offset"); s != "" {
		offset, err = strconv.Atoi(s)
		if err != nil || offset < 0 || offset > maxOffset {
			return 0, 0, BadRequest("offset must be an integer from 0 to 100000")
		}
	}
	return limit, offset, nil
}
