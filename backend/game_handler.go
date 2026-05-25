package main

import (
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var gm = NewGameManager()

func gameWsHandler(c *gin.Context) {
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "session ended")

	ctx := c.Request.Context()
	player := &Player{
		ID:        uuid.NewString()[:8],
		Conn:      conn,
		MatchedCh: make(chan *GameRoom, 1),
	}

	// Wait for FIND_MATCH
	for {
		var raw map[string]any
		if err := wsjson.Read(ctx, conn, &raw); err != nil {
			return
		}
		if raw["type"] == "FIND_MATCH" {
			gm.AddToQueue(player)
			player.sendJSON(map[string]string{"type": "WAITING"})
			break
		}
	}

	// Block until matched
	var room *GameRoom
	select {
	case room = <-player.MatchedCh:
	case <-ctx.Done():
		return
	}

	// Determine player index
	idx := 0
	if room.Players[1] == player {
		idx = 1
	}
	opponent := room.Players[1-idx]

	player.sendJSON(MsgMatchFound{
		Type:         "MATCH_FOUND",
		RoomID:       room.ID,
		OpponentName: opponent.ID,
	})

	hand := gm.deal(player, 4)
	player.sendJSON(MsgGameStart{
		Type:          "GAME_START",
		Hand:          hand,
		DeckRemaining: len(player.Deck),
		IsFirst:       idx == 0,
		HP:            StartHP,
	})

	// Game action loop
	for {
		if room.State == "finished" {
			return
		}
		var raw map[string]any
		if err := wsjson.Read(ctx, conn, &raw); err != nil {
			return
		}

		switch raw["type"] {
		case "PUT_CARD":
			cardID := toInt(raw["card_id"])
			slot := toInt(raw["slot"])
			abilityTarget := -1
			if v, ok := raw["ability_target"]; ok && v != nil {
				abilityTarget = toInt(v)
			}
			room.mu.Lock()
			placeUnit(room, idx, cardID, slot, abilityTarget)
			room.mu.Unlock()

		case "ATTACK":
			attackerSlot := toInt(raw["attacker_slot"])
			defenderSlot := toInt(raw["defender_slot"])
			abilityTarget := -1
			if v, ok := raw["ability_target"]; ok && v != nil {
				abilityTarget = toInt(v)
			}
			room.mu.Lock()
			resolveAttack(room, idx, attackerSlot, defenderSlot, abilityTarget)
			room.mu.Unlock()

		case "TURN_END":
			room.mu.Lock()
			endTurn(room, idx)
			room.mu.Unlock()
		}
	}
}

func toInt(v any) int {
	if v == nil {
		return -1
	}
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	}
	return -1
}
