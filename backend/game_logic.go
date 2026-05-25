package main

const StartHP = 5

// placeUnit places a card from hand onto the field and triggers enter abilities.
// abilityTarget is the opponent slot index for targeting abilities (-1 = none).
func placeUnit(room *GameRoom, playerIdx int, cardID int, slot int, abilityTarget int) {
	p := room.Players[playerIdx]

	var cardIdx = -1
	for i, c := range p.Hand {
		if c.ID == cardID {
			cardIdx = i
			break
		}
	}
	if cardIdx < 0 || slot < 0 || slot >= 3 || room.Fields[playerIdx][slot] != nil {
		return
	}

	card := p.Hand[cardIdx]
	p.Hand = append(p.Hand[:cardIdx], p.Hand[cardIdx+1:]...)

	// Speed Move (type 11) grants action right immediately
	hasSpeedMove := false
	for _, ab := range card.Abilities {
		if ab.Type == 11 {
			hasSpeedMove = true
			break
		}
	}

	unit := &FieldUnit{Card: card, HasAction: hasSpeedMove}
	room.Fields[playerIdx][slot] = unit

	broadcastBoth(room, MsgCardPlaced{
		Type:      "CARD_PLACED",
		Slot:      slot,
		Card:      card,
		HasAction: hasSpeedMove,
		PlayerIdx: playerIdx,
	})

	applyEnterAbilities(room, playerIdx, slot, abilityTarget)
	syncField(room)
}

// applyEnterAbilities fires all trigger=1 abilities for the unit at playerIdx/slot.
func applyEnterAbilities(room *GameRoom, playerIdx int, slot int, abilityTarget int) {
	unit := room.Fields[playerIdx][slot]
	if unit == nil {
		return
	}
	opponentIdx := 1 - playerIdx

	for _, ab := range unit.Abilities {
		if ab.Trigger != 1 {
			continue
		}
		switch ab.Type {
		case 1: // damage
			switch ab.Ask {
			case 3: // all enemy units
				for s := 0; s < 3; s++ {
					applyDamageToUnit(room, opponentIdx, s, ab.Amount, unit.ID)
				}
			case 1: // choose one
				if abilityTarget >= 0 && abilityTarget < 3 {
					applyDamageToUnit(room, opponentIdx, abilityTarget, ab.Amount, unit.ID)
				}
			case 2: // only acted-up (no action right)
				if abilityTarget >= 0 && abilityTarget < 3 {
					t := room.Fields[opponentIdx][abilityTarget]
					if t != nil && !t.HasAction {
						applyDamageToUnit(room, opponentIdx, abilityTarget, ab.Amount, unit.ID)
					}
				}
			}
		case 5: // stun: remove action right
			if ab.Ask == 1 && abilityTarget >= 0 && abilityTarget < 3 {
				t := room.Fields[opponentIdx][abilityTarget]
				if t != nil {
					t.HasAction = false
					broadcastBoth(room, MsgAbilityEffect{
						Type: "ABILITY_EFFECT", CardID: unit.ID,
						AbilityType: 5, TargetSlot: abilityTarget, TargetIdx: opponentIdx,
					})
				}
			}
		case 7: // draw
			drawCard(room, playerIdx)
		// 11 = speed move, handled in placeUnit
		}
	}
}

// resolveAttack resolves a unit attacking an opponent slot (defenderSlot=-1 for direct).
// abilityTarget is for on-attack targeting abilities (e.g. Lancer's 1000 dmg).
func resolveAttack(room *GameRoom, attackerIdx int, attackerSlot int, defenderSlot int, abilityTarget int) {
	attacker := room.Fields[attackerIdx][attackerSlot]
	if attacker == nil || !attacker.HasAction {
		return
	}
	defenderIdx := 1 - attackerIdx
	attacker.HasAction = false

	// Check unblockable
	unblockable := attacker.hasAbility(2, 12)

	// On-attack BP pump
	for _, ab := range attacker.Abilities {
		if ab.Trigger == 2 && ab.Type == 2 {
			attacker.BPMod += ab.Amount
			broadcastBoth(room, MsgAbilityEffect{
				Type: "ABILITY_EFFECT", CardID: attacker.ID,
				AbilityType: 2, TargetSlot: attackerSlot, TargetIdx: attackerIdx, Amount: ab.Amount,
			})
		}
	}

	// On-attack damage to chosen target (Lancer)
	for _, ab := range attacker.Abilities {
		if ab.Trigger == 2 && ab.Type == 1 && ab.Ask == 1 {
			if abilityTarget >= 0 && abilityTarget < 3 {
				applyDamageToUnit(room, defenderIdx, abilityTarget, ab.Amount, attacker.ID)
			}
		}
	}

	defender := room.Fields[defenderIdx][defenderSlot]

	// Direct attack: unblockable OR empty target slot
	if unblockable || defender == nil {
		room.HP[defenderIdx]--
		broadcastBoth(room, MsgBattleResult{
			Type:         "BATTLE_RESULT",
			AttackerIdx:  attackerIdx,
			AttackerSlot: attackerSlot,
			DefenderSlot: defenderSlot,
			DirectDmg:    true,
			DefenderIdx:  defenderIdx,
		})
		broadcastBoth(room, MsgHPChange{Type: "HP_CHANGE", PlayerIdx: defenderIdx, HP: room.HP[defenderIdx]})
		checkWin(room)
		syncField(room)
		return
	}

	// On-block BP pump for defender (Sohei, Roin)
	for _, ab := range defender.Abilities {
		if ab.Trigger == 3 && ab.Type == 2 {
			defender.BPMod += ab.Amount
			broadcastBoth(room, MsgAbilityEffect{
				Type: "ABILITY_EFFECT", CardID: defender.ID,
				AbilityType: 2, TargetSlot: defenderSlot, TargetIdx: defenderIdx, Amount: ab.Amount,
			})
		}
	}

	atkBP := attacker.EffectiveBP()
	defBP := defender.EffectiveBP()
	attackerDied := atkBP <= defBP
	defenderDied := defBP <= atkBP

	if attackerDied {
		room.Fields[attackerIdx][attackerSlot] = nil
	}
	if defenderDied {
		room.Fields[defenderIdx][defenderSlot] = nil
	}

	broadcastBoth(room, MsgBattleResult{
		Type:         "BATTLE_RESULT",
		AttackerIdx:  attackerIdx,
		AttackerSlot: attackerSlot,
		DefenderSlot: defenderSlot,
		AttackerDied: attackerDied,
		DefenderDied: defenderDied,
		DefenderIdx:  defenderIdx,
	})
	syncField(room)
}

// endTurn fires end-of-turn abilities, advances the turn, restores action rights,
// draws for the next player, and broadcasts TURN_CHANGE.
func endTurn(room *GameRoom, playerIdx int) {
	// Limaru (trigger=4, type=8): restore own action right at end of turn
	for s := 0; s < 3; s++ {
		u := room.Fields[playerIdx][s]
		if u == nil {
			continue
		}
		if u.hasAbility(4, 8) {
			u.HasAction = true
			broadcastBoth(room, MsgAbilityEffect{
				Type: "ABILITY_EFFECT", CardID: u.ID,
				AbilityType: 8, TargetSlot: s, TargetIdx: playerIdx,
			})
		}
		// Reset BP mods at end of turn
		u.BPMod = 0
	}

	room.Turn++
	nextIdx := 1 - playerIdx
	cp := room.Turn

	// Restore action rights for next player's existing field units
	for s := 0; s < 3; s++ {
		if u := room.Fields[nextIdx][s]; u != nil {
			u.HasAction = true
			u.BPMod = 0
		}
	}

	// Draw 1 card for next player (skip very first turn draw)
	drawCard(room, nextIdx)

	room.Players[0].sendJSON(MsgTurnChange{Type: "TURN_CHANGE", Turn: room.Turn, YourTurn: nextIdx == 0, CP: cp})
	room.Players[1].sendJSON(MsgTurnChange{Type: "TURN_CHANGE", Turn: room.Turn, YourTurn: nextIdx == 1, CP: cp})
	syncField(room)
}

// ─── Helpers ──────────────────────────────────────────────────────

func applyDamageToUnit(room *GameRoom, playerIdx int, slot int, amount int, sourceCardID int) {
	unit := room.Fields[playerIdx][slot]
	if unit == nil {
		return
	}
	broadcastBoth(room, MsgAbilityEffect{
		Type: "ABILITY_EFFECT", CardID: sourceCardID,
		AbilityType: 1, TargetSlot: slot, TargetIdx: playerIdx, Amount: amount,
	})
	if amount >= unit.EffectiveBP() {
		room.Fields[playerIdx][slot] = nil
		broadcastBoth(room, MsgUnitDestroyed{Type: "UNIT_DESTROYED", Slot: slot, PlayerIdx: playerIdx})
	}
}

func drawCard(room *GameRoom, playerIdx int) {
	p := room.Players[playerIdx]
	if len(p.Deck) == 0 {
		return
	}
	drawn := p.Deck[0]
	p.Deck = p.Deck[1:]
	p.Hand = append(p.Hand, drawn)
	p.sendJSON(MsgDrawCard{Type: "DRAW_CARD", Card: drawn})
}

func checkWin(room *GameRoom) {
	for i, hp := range room.HP {
		if hp <= 0 {
			room.State = "finished"
			broadcastBoth(room, MsgGameOver{Type: "GAME_OVER", WinnerIdx: 1 - i})
			return
		}
	}
}

func syncField(room *GameRoom) {
	broadcastBoth(room, MsgFieldState{Type: "FIELD_STATE", Fields: room.Fields})
}
