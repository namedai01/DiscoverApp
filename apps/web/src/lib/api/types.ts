export type Location = {
  id: string;
  venueName: string;
  venueLocation: string;
  description: string;
  imageUrl: string;
  lat: number;
  lng: number;
  storyCount: number;
};

export type User = {
  id: string;
  displayName: string;
  photoUrl: string;
  followerCount: number;
  isFollowing?: boolean;
};

export type UserWithFollow = User & { isFollowing: boolean };

export type Story = {
  id: string;
  title: string;
  type: string;
  description: string;
  imageUrl: string;
  createdAt: string;
  location: { id: string; venueName: string };
  owner: { id: string; displayName: string; photoUrl: string };
};

export type ListPage<T> = { items: T[] };
export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export type NewStory = {
  title: string;
  type: string;
  description: string;
  imageUrl: string;
  lat: number;
  lng: number;
};

export type MePatch = { displayName?: string; photoUrl?: string };
