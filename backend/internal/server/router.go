// Package server builds the HTTP router and its dependencies.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/namedai01/memopin/backend/internal/auth"
	"github.com/namedai01/memopin/backend/internal/config"
	"github.com/namedai01/memopin/backend/internal/db/store"
	"github.com/namedai01/memopin/backend/internal/devices"
	"github.com/namedai01/memopin/backend/internal/follows"
	"github.com/namedai01/memopin/backend/internal/httpx"
	"github.com/namedai01/memopin/backend/internal/locations"
	"github.com/namedai01/memopin/backend/internal/notify"
	"github.com/namedai01/memopin/backend/internal/stories"
	"github.com/namedai01/memopin/backend/internal/users"
)

// Deps are the collaborators handlers need. Later tasks add fields.
type Deps struct {
	Pool     *pgxpool.Pool
	Cfg      config.Config
	Verifier auth.Verifier
	// Notifier receives story events; nil means no notifications.
	Notifier notify.Notifier
}

// NewRouter wires middleware and routes.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(requestLogger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: d.Cfg.CORSOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:         300,
	}))
	r.Use(middleware.Timeout(15 * time.Second))

	r.Get("/healthz", healthz(d.Pool))

	q := store.New(d.Pool)
	usersH := &users.Handler{Q: q, Bucket: d.Cfg.StorageBucket, DefaultPhotoURL: d.Cfg.DefaultUserPhotoURL}
	locationsH := &locations.Handler{Q: q}
	notifier := d.Notifier
	if notifier == nil {
		notifier = notify.Noop{}
	}
	storiesH := &stories.Handler{
		Q: q, Bucket: d.Cfg.StorageBucket, DefaultPhotoURL: d.Cfg.DefaultUserPhotoURL, Notifier: notifier,
	}
	followsH := &follows.Handler{Q: q, DefaultPhotoURL: d.Cfg.DefaultUserPhotoURL}
	devicesH := &devices.Handler{Q: q, DefaultPhotoURL: d.Cfg.DefaultUserPhotoURL}

	r.Route("/v1", func(r chi.Router) {
		r.Get("/locations", locationsH.List)
		r.Get("/locations/{id}", locationsH.Get)
		r.Get("/locations/{id}/stories", storiesH.ListByLocation)
		r.Get("/users", usersH.List)
		r.Group(func(r chi.Router) {
			r.Use(auth.Required(d.Verifier))
			r.Get("/me", usersH.GetMe)
			r.Patch("/me", usersH.PatchMe)
			r.Get("/users/{id}", usersH.Get)
			r.Get("/users/{id}/stories", storiesH.ListByOwner)
			r.Post("/stories", storiesH.Create)
			r.Put("/users/{id}/follow", followsH.Follow)
			r.Delete("/users/{id}/follow", followsH.Unfollow)
			r.Post("/me/devices", devicesH.Register)
			r.Delete("/me/devices/{token}", devicesH.Unregister)
		})
	})
	return r
}

// healthz reports 200 when a fresh Ping succeeds and 503 otherwise.
func healthz(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			slog.Warn("healthz: db ping failed", "err", err)
			httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db_unavailable"})
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// requestLogger logs one structured line per request.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		status := ww.Status()
		if status == 0 {
			status = http.StatusOK
		}
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", status,
			"bytes", ww.BytesWritten(),
			"duration", time.Since(start),
			"request_id", middleware.GetReqID(r.Context()),
		)
	})
}
