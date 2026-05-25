package main

import (
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/gin-gonic/gin"
)

func wsHandler(c *gin.Context) {
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "session ended")

	ctx := c.Request.Context()

	for {
		var msg map[string]interface{}
		err = wsjson.Read(ctx, conn, &msg)
		if err != nil {
			break
		}

		wsjson.Write(ctx, conn, map[string]string{
			"status":    "Healthy",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	}
}
