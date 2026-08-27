FROM nginx:1.27.0-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy built frontend assets
COPY out /usr/share/nginx/html/vite
COPY storybook-static /usr/share/nginx/html/storybook

EXPOSE 80 81

CMD ["nginx", "-g", "daemon off;"]
