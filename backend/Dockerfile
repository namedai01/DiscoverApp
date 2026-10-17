# syntax=docker/dockerfile:1

FROM golang:1.24 AS build
ENV GOTOOLCHAIN=local CGO_ENABLED=0
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

FROM gcr.io/distroless/static-debian12:nonroot
# Migrations are embedded in the binaries. The seed file is copied so the seed
# command can run in the image: docker run --entrypoint /app/bin/seed <image>
WORKDIR /app
COPY --from=build /out/api /out/seed /app/bin/
COPY seed/locations.json /app/seed/locations.json
EXPOSE 8080
ENTRYPOINT ["/app/bin/api"]
