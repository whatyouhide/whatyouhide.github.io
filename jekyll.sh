#!/bin/bash -e

docker run \
    -p 4000:4000 \
    --rm \
    --volume="$PWD:/srv/jekyll" \
    --platform linux/amd64 \
    -it \
    jekyll/jekyll:4.2.2 \
    jekyll "$1"
