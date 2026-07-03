FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN go build -o /out/carvis-nas-server ./apps/server

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/carvis-nas-server /app/carvis-nas-server
COPY apps/client /app/apps/client
COPY config /app/config
EXPOSE 8765
CMD ["/app/carvis-nas-server"]
