#!/bin/sh
# Chooses dev vs. production mode at container start. Defaults to dev
# (npm run dev, live-reload) so local docker-compose is unaffected --
# Render sets RENDER=true on every deploy (a real, documented Render env
# var), which switches to the production server. The production build
# itself already happened at `docker build` time (see Dockerfile) --
# running `npm run build` here on every cold start was OOM-killing the
# free-tier 512MB runtime instance.
set -e

if [ "$RENDER" = "true" ]; then
  exec npm run start
else
  exec npm run dev
fi
