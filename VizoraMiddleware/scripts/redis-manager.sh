#!/bin/bash

function start_redis() {
    echo "Starting Redis container..."
    docker-compose up -d redis
    echo "Waiting for Redis to be ready..."
    sleep 5
    docker-compose exec redis redis-cli ping
}

function stop_redis() {
    echo "Stopping Redis container..."
    docker-compose down
}

function redis_status() {
    echo "Redis container status:"
    docker-compose ps redis
    echo "\nRedis health check:"
    docker-compose exec redis redis-cli ping
}

function redis_logs() {
    echo "Redis logs:"
    docker-compose logs --tail=100 redis
}

function redis_monitor() {
    echo "Monitoring Redis (Ctrl+C to exit):"
    docker-compose exec redis redis-cli monitor
}

case "$1" in
    "start")
        start_redis
        ;;
    "stop")
        stop_redis
        ;;
    "status")
        redis_status
        ;;
    "logs")
        redis_logs
        ;;
    "monitor")
        redis_monitor
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|monitor}"
        exit 1
        ;;
esac 