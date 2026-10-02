# Public landing site: the Next.js static export (landing/out, built by CI with
# `npm run build -w landing` first) served by nginx. Build context is the repo root.
FROM nginx:stable-alpine
COPY landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY landing/out /usr/share/nginx/html
EXPOSE 80
