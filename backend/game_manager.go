package main

import (
	"math/rand"
	"sync"

	"github.com/google/uuid"
)

var cardDB = []Card{
	{ID: 1,  Name: "Hound",    BP: 1000, Cost: 0, Sprite: "card_1",  Abilities: nil},
	{ID: 2,  Name: "Fighter",  BP: 3000, Cost: 1, Sprite: "card_2",  Abilities: []Ability{{Trigger: 2, Ask: 0, Type: 2, Amount: 2000}}},
	{ID: 3,  Name: "Lancer",   BP: 5000, Cost: 2, Sprite: "card_3",  Abilities: []Ability{{Trigger: 2, Ask: 1, Type: 1, Amount: 1000}}},
	{ID: 4,  Name: "HellDog",  BP: 6000, Cost: 3, Sprite: "card_4",  Abilities: nil},
	{ID: 5,  Name: "Arty",     BP: 2000, Cost: 2, Sprite: "card_5",  Abilities: []Ability{{Trigger: 1, Ask: 0, Type: 11, Amount: 0}}},
	{ID: 6,  Name: "Valkyrie", BP: 3000, Cost: 3, Sprite: "card_6",  Abilities: []Ability{{Trigger: 2, Ask: 0, Type: 12, Amount: 0}}},
	{ID: 7,  Name: "Lilim",    BP: 4000, Cost: 4, Sprite: "card_7",  Abilities: []Ability{{Trigger: 1, Ask: 1, Type: 1, Amount: 4000}}},
	{ID: 8,  Name: "Belial",   BP: 7000, Cost: 7, Sprite: "card_8",  Abilities: []Ability{{Trigger: 1, Ask: 3, Type: 1, Amount: 3000}}},
	{ID: 9,  Name: "Sohei",    BP: 2000, Cost: 1, Sprite: "card_9",  Abilities: []Ability{{Trigger: 3, Ask: 0, Type: 2, Amount: 2000}}},
	{ID: 10, Name: "LionDog",  BP: 1000, Cost: 0, Sprite: "card_10", Abilities: nil},
	{ID: 11, Name: "Allie",    BP: 2000, Cost: 1, Sprite: "card_11", Abilities: []Ability{{Trigger: 1, Ask: 1, Type: 5, Amount: 0}}},
	{ID: 13, Name: "Caim",     BP: 5000, Cost: 3, Sprite: "card_13", Abilities: []Ability{{Trigger: 1, Ask: 0, Type: 7, Amount: 1}}},
	{ID: 14, Name: "Limaru",   BP: 6000, Cost: 3, Sprite: "card_14", Abilities: []Ability{{Trigger: 4, Ask: 0, Type: 8, Amount: 0}}},
	{ID: 15, Name: "Roin",     BP: 4000, Cost: 2, Sprite: "card_15", Abilities: []Ability{{Trigger: 3, Ask: 0, Type: 2, Amount: 2000}}},
	{ID: 16, Name: "Rairyu",   BP: 6000, Cost: 5, Sprite: "card_16", Abilities: []Ability{{Trigger: 1, Ask: 2, Type: 1, Amount: 7000}}},
}

type GameManager struct {
	mu    sync.Mutex
	rooms map[string]*GameRoom
	queue []*Player
}

func NewGameManager() *GameManager {
	return &GameManager{rooms: make(map[string]*GameRoom)}
}

func (m *GameManager) buildDeck() []Card {
	deck := make([]Card, 30)
	for i := range deck {
		deck[i] = cardDB[i%len(cardDB)]
	}
	rand.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })
	return deck
}

func (m *GameManager) deal(p *Player, n int) []Card {
	if n > len(p.Deck) {
		n = len(p.Deck)
	}
	dealt := make([]Card, n)
	copy(dealt, p.Deck[:n])
	p.Deck = p.Deck[n:]
	p.Hand = append(p.Hand, dealt...)
	return dealt
}

func (m *GameManager) AddToQueue(p *Player) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.queue = append(m.queue, p)
	if len(m.queue) < 2 {
		return
	}

	p1 := m.queue[0]
	p2 := m.queue[1]
	m.queue = m.queue[2:]

	p1.Deck = m.buildDeck()
	p2.Deck = m.buildDeck()

	room := &GameRoom{
		ID:      uuid.NewString()[:8],
		Players: [2]*Player{p1, p2},
		Turn:    1,
		HP:      [2]int{5, 5},
		State:   "playing",
	}
	m.rooms[room.ID] = room

	p1.MatchedCh <- room
	p2.MatchedCh <- room
}
