FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN chmod +x entrypoint.sh

# NEXT_PUBLIC_* vars are inlined into the client bundle at `next build`
# time, not read at container runtime -- so the production build must
# happen here (image-build time, where Render's builder has far more than
# the 512MB free-tier runtime ceiling) rather than in entrypoint.sh, which
# was OOM-killing the free-tier instance on every cold start.
#
# Render's Blueprint spec has no dockerBuildArgs field (verified against
# render.com/docs/blueprint-spec) -- ARGs can't be passed in from
# render.yaml, so the production API URL is defaulted directly here
# instead. Local docker-compose dev is unaffected functionally: its
# entrypoint.sh still runs `npm run dev` at container start regardless of
# this build output, it just also pays for an unused production build on
# `docker compose build` (acceptable; correctness over local build speed
# under deadline).
ARG NEXT_PUBLIC_API_URL="https://cratesense-backend.onrender.com"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

EXPOSE 3000

# Defaults to `npm run dev` (local docker-compose, live-reload) unless
# Render's always-set RENDER=true env var is present, in which case it
# runs the production server against the build produced above. See
# entrypoint.sh.
CMD ["./entrypoint.sh"]
