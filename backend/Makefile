.PHONY: dev test sqlc lint

# Start the local database, then run the API with backend/.env loaded.
dev:
	docker compose up -d db
	set -a; . ./.env; set +a; go run ./cmd/api

test:
	go test -count=1 -p 1 ./...

sqlc:
	sqlc generate

lint:
	go vet ./...
