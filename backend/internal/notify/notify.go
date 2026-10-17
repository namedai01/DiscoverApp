// Package notify delivers push notifications about new activity.
package notify

import (
	"context"

	"github.com/google/uuid"
)

// Notifier is told about events worth a push notification. Implementations
// must not panic and should log their own failures. Callers invoke them
// synchronously, with a short deadline, and ignore any outcome.
type Notifier interface {
	StoryCreated(ctx context.Context, storyID uuid.UUID)
}

// Noop is a Notifier that does nothing.
type Noop struct{}

// StoryCreated implements Notifier.
func (Noop) StoryCreated(context.Context, uuid.UUID) {}
