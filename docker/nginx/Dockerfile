FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy Vizora reverse proxy configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for ACME challenge (Let's Encrypt cert renewal)
RUN mkdir -p /var/www/certbot

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
