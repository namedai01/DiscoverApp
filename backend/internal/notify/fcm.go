package notify

import (
	"context"
	"log/slog"

	"firebase.google.com/go/v4/messaging"
	"github.com/google/uuid"

	"github.com/namedai01/memopin/backend/internal/db/store"
)

const (
	// maxMulticast is FCM's limit of tokens per multicast call.
	maxMulticast = 500
	pushTitle    = "Memopin"
)

// Sender is the part of *messaging.Client that FCM uses.
type Sender interface {
	SendEachForMulticast(ctx context.Context, msg *messaging.MulticastMessage) (*messaging.BatchResponse, error)
}

// FCM pushes "new story" notifications to the poster's followers through
// Firebase Cloud Messaging and prunes device tokens FCM reports as gone.
type FCM struct {
	q   *store.Queries
	s   Sender
	log *slog.Logger
	// isUnregistered classifies a per-token send error; a seam for tests,
	// since the SDK's error type cannot be built outside the SDK.
	isUnregistered func(error) bool
}

// NewFCM returns an FCM notifier. A nil log uses slog.Default().
func NewFCM(q *store.Queries, s Sender, log *slog.Logger) *FCM {
	if log == nil {
		log = slog.Default()
	}
	return &FCM{q: q, s: s, log: log, isUnregistered: messaging.IsUnregistered}
}

// StoryCreated implements Notifier. Failures are logged, never returned.
func (f *FCM) StoryCreated(ctx context.Context, storyID uuid.UUID) {
	info, err := f.q.StoryNotifyInfo(ctx, storyID)
	if err != nil {
		f.log.Error("notify: load story", "story_id", storyID, "err", err)
		return
	}
	tokens, err := f.q.FollowerTokens(ctx, info.OwnerID)
	if err != nil {
		f.log.Error("notify: load follower tokens", "story_id", storyID, "err", err)
		return
	}
	if len(tokens) == 0 {
		return
	}

	notification := &messaging.Notification{
		Title: pushTitle,
		Body:  info.OwnerDisplayName + " has just posted a new story.",
	}
	data := map[string]string{
		"type":       "new_story",
		"storyId":    info.StoryID.String(),
		"locationId": info.LocationID.String(),
	}
	for start := 0; start < len(tokens); start += maxMulticast {
		chunk := tokens[start:min(start+maxMulticast, len(tokens))]
		f.sendChunk(ctx, storyID, chunk, &messaging.MulticastMessage{
			Tokens: chunk, Notification: notification, Data: data,
		})
	}
}

// sendChunk sends one multicast and deletes the tokens FCM says are
// unregistered. A failed call is logged and leaves every token in place.
func (f *FCM) sendChunk(ctx context.Context, storyID uuid.UUID, chunk []string, msg *messaging.MulticastMessage) {
	resp, err := f.s.SendEachForMulticast(ctx, msg)
	if err != nil {
		f.log.Error("notify: fcm send", "story_id", storyID, "tokens", len(chunk), "err", err)
		return
	}
	var dead []string
	for i, r := range resp.Responses {
		if r == nil || r.Success || i >= len(chunk) {
			continue
		}
		if f.isUnregistered(r.Error) {
			dead = append(dead, chunk[i])
			continue
		}
		f.log.Warn("notify: fcm token failed", "story_id", storyID, "token", short(chunk[i]), "err", r.Error)
	}
	if len(dead) == 0 {
		return
	}
	if err := f.q.DeleteTokens(ctx, dead); err != nil {
		f.log.Error("notify: prune tokens", "count", len(dead), "err", err)
		return
	}
	f.log.Info("notify: pruned unregistered tokens", "count", len(dead))
}

// short shortens a device token for logs: never more than 8 characters of it.
func short(token string) string {
	if r := []rune(token); len(r) > 8 {
		return string(r[:8]) + "…"
	}
	return token
}
