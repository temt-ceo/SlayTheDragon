package users

import (
	"encoding/json"
	"fmt"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/gin-gonic/gin"
)

func (u *Users) HandlePartyWS(c *gin.Context) {
    userID := c.Query("user_id") // This should be the Clean ID from Svelte
    if userID == "" { return }

    conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{
        OriginPatterns: []string{"lab.blsqui.net", "wallet.blsqui.net", "localhost:5173"},
    })
    if err != nil { return }
    defer conn.Close(websocket.StatusNormalClosure, "session ended")

    ctx := c.Request.Context()

    // 1. Initial Subscription: Only listen to personal updates (Invites)
    pubsub := u.Redis.Subscribe(ctx, "party:updates:"+userID)
    defer pubsub.Close()

    // We use a channel to tell the main loop to subscribe to a new Room
    roomChangeChan := make(chan string, 1)

    // 2. READ LOOP (Frontend -> Redis)
    go func() {
        for {
            var msg struct {
                Type    string `json:"type"`
                Target  string `json:"target"`
                RoomID  string `json:"roomId"`
                Content string `json:"content"`
                From    string `json:"from"`
            }

            if err := wsjson.Read(ctx, conn, &msg); err != nil {
                return 
            }

            msg.From = userID // Security: Overwrite sender with authenticated ID

            if msg.Type == "ROOM_INVITE" {
                payload, _ := json.Marshal(msg)
                u.Redis.Publish(ctx, "party:updates:"+msg.Target, payload)
                // When we invite, we are basically "joining" that room too
                roomChangeChan <- "room:" + msg.RoomID
            }

            if msg.Type == "CHAT_MESSAGE" {
                payload, _ := json.Marshal(msg)
                u.Redis.Publish(ctx, "room:"+msg.RoomID, payload)
            }
            
            // Allow manual room join signal from Svelte
            if msg.Type == "JOIN_ROOM" {
                roomChangeChan <- "room:" + msg.RoomID
            }
        }
    }()

    // WRITE LOOP (Redis -> Frontend)
    for {
        // This is the standard way to handle multiple sources in Go
        select {
        case msg := <-pubsub.Channel():
            if msg == nil { continue }
            // Send whatever comes from Redis directly to Svelte
            conn.Write(ctx, websocket.MessageText, []byte(msg.Payload))

        case newRoom := <-roomChangeChan:
            // When we add a room, we just tell the existing pubsub to listen to more
            err := pubsub.Subscribe(ctx, newRoom)
            if err != nil {
                fmt.Printf("Error subscribing to %s: %v\n", newRoom, err)
            } else {
                fmt.Printf("📡 Subscribed to: %s\n", newRoom)
            }
        case <-ctx.Done():
            return
        }
    }
}