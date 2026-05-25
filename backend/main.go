package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	db  *pgxpool.Pool
	rdb *redis.Client
)

func main() {
	// Database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		pool, err := pgxpool.New(context.Background(), dbURL)
		if err != nil {
			log.Printf("DB connect failed: %v", err)
		} else {
			db = pool
			log.Println("PostgreSQL connected")
		}
	}

	// Redis
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	rdb = redis.NewClient(&redis.Options{Addr: redisAddr})

	r := gin.Default()

	// WebSocket
	r.GET("/ws", wsHandler)
	r.GET("/ws/game", gameWsHandler)

	// Game API
	game := r.Group("/game")
	{
		game.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
	}

	r.Run(":8080")
}
