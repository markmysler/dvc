# Port proxy for challenge containers.
#
# Each challenge runs alone on an internal Docker network (no route to the
# internet, the host or the platform). This tiny socat container joins that
# network plus a normal bridge and publishes the challenge port, so players
# can reach the challenge but the challenge cannot reach anything else.
FROM alpine:3.20
RUN apk add --no-cache socat
USER 65534:65534
