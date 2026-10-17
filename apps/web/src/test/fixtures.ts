import type { CursorPage, Location, Story, User } from "@/lib/api/types";

export function aLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "loc-1",
    venueName: "West Lake",
    venueLocation: "Tay Ho, Hanoi",
    description: "A big freshwater lake.",
    imageUrl: "https://images.example.com/west-lake.jpg",
    lat: 21.05,
    lng: 105.82,
    storyCount: 0,
    ...overrides,
  };
}

export function aUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    displayName: "Linh",
    photoUrl: "https://images.example.com/linh.jpg",
    followerCount: 0,
    ...overrides,
  };
}

export function aStory(overrides: Partial<Story> = {}): Story {
  return {
    id: "story-1",
    title: "Sunrise run",
    type: "Running",
    description: "Early morning loop.",
    imageUrl: "https://images.example.com/story-1.jpg",
    createdAt: "2026-10-01T06:30:00Z",
    location: { id: "loc-1", venueName: "West Lake" },
    owner: {
      id: "user-1",
      displayName: "Linh",
      photoUrl: "https://images.example.com/linh.jpg",
    },
    ...overrides,
  };
}

export function cursorPage<T>(
  items: T[],
  nextCursor: string | null = null,
): CursorPage<T> {
  return { items, nextCursor };
}
