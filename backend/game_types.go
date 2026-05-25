package main

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/coder/websocket"
)

// ─── Domain ───────────────────────────────────────────────────────

type Ability struct {
	Trigger int `json:"trigger"` // 1=enter 2=attack 3=block 4=turnEnd
	Ask     int `json:"ask"`     // 0=none 1=chooseOne 2=actedUp 3=all
	Type    int `json:"type"`    // 1=damage 2=bpPump 5=stun 7=draw 8=restoreAction 11=speedMove 12=unblockable
	Amount  int `json:"amount"`
}

type Card struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	BP        int       `json:"bp"`
	Cost      int       `json:"cost"`
	Sprite    string    `json:"sprite"`
	Abilities []Ability `json:"abilities"`
}

type FieldUnit struct {
	Card
	HasAction bool `json:"has_action"`
	BPMod     int  `json:"bp_mod"`
}

func (u *FieldUnit) EffectiveBP() int { return u.BP + u.BPMod }

func (u *FieldUnit) hasAbility(trigger, typ int) bool {
	for _, ab := range u.Abilities {
		if ab.Trigger == trigger && ab.Type == typ {
			return true
		}
	}
	return false
}

// ─── Player ───────────────────────────────────────────────────────

type Player struct {
	ID        string
	Conn      *websocket.Conn
	writeMu   sync.Mutex
	Deck      []Card
	Hand      []Card
	MatchedCh chan *GameRoom
}

func (p *Player) sendJSON(v any) {
	b, _ := json.Marshal(v)
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	p.Conn.Write(context.Background(), websocket.MessageText, b)
}

// ─── Room ─────────────────────────────────────────────────────────

type GameRoom struct {
	ID      string
	Players [2]*Player
	Turn    int
	HP      [2]int
	Fields  [2][3]*FieldUnit
	mu      sync.Mutex
	State   string // "playing" | "finished"
}

func broadcastBoth(room *GameRoom, v any) {
	room.Players[0].sendJSON(v)
	room.Players[1].sendJSON(v)
}

// ─── Messages ─────────────────────────────────────────────────────

type MsgMatchFound struct {
	Type         string `json:"type"`
	RoomID       string `json:"room_id"`
	OpponentName string `json:"opponent_name"`
}

type MsgGameStart struct {
	Type          string `json:"type"`
	Hand          []Card `json:"hand"`
	DeckRemaining int    `json:"deck_remaining"`
	IsFirst       bool   `json:"is_first"`
	HP            int    `json:"hp"`
}

type MsgCardPlaced struct {
	Type      string `json:"type"`
	Slot      int    `json:"slot"`
	Card      Card   `json:"card"`
	HasAction bool   `json:"has_action"`
	PlayerIdx int    `json:"player_idx"`
}

type MsgBattleResult struct {
	Type         string `json:"type"`
	AttackerIdx  int    `json:"attacker_idx"`
	AttackerSlot int    `json:"attacker_slot"`
	DefenderSlot int    `json:"defender_slot"` // -1 = direct attack
	AttackerDied bool   `json:"attacker_died"`
	DefenderDied bool   `json:"defender_died"`
	DirectDmg    bool   `json:"direct_dmg"`
	DefenderIdx  int    `json:"defender_idx"`
}

type MsgAbilityEffect struct {
	Type        string `json:"type"`
	CardID      int    `json:"card_id"`
	AbilityType int    `json:"ability_type"`
	TargetSlot  int    `json:"target_slot"`
	TargetIdx   int    `json:"target_idx"`
	Amount      int    `json:"amount"`
}

type MsgUnitDestroyed struct {
	Type      string `json:"type"`
	Slot      int    `json:"slot"`
	PlayerIdx int    `json:"player_idx"`
}

type MsgHPChange struct {
	Type      string `json:"type"`
	PlayerIdx int    `json:"player_idx"`
	HP        int    `json:"hp"`
}

type MsgGameOver struct {
	Type      string `json:"type"`
	WinnerIdx int    `json:"winner_idx"`
}

type MsgDrawCard struct {
	Type string `json:"type"`
	Card Card   `json:"card"`
}

type MsgTurnChange struct {
	Type     string `json:"type"`
	Turn     int    `json:"turn"`
	YourTurn bool   `json:"your_turn"`
	CP       int    `json:"cp"`
}

type MsgFieldState struct {
	Type   string             `json:"type"`
	Fields [2][3]*FieldUnit   `json:"fields"`
}

type MsgNeedTarget struct {
	Type        string `json:"type"`
	AbilityType int    `json:"ability_type"`
	Ask         int    `json:"ask"`
}
