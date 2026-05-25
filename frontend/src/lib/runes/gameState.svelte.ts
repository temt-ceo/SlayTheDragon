export interface Ability {
    trigger: number  // 1=enter 2=attack 3=block 4=turnEnd
    ask:     number  // 0=none 1=chooseOne 2=actedUp 3=all
    type:    number  // 1=damage 2=bpPump 5=stun 7=draw 8=restore 11=speed 12=unblock
    amount:  number
}

export interface Card {
    id: number; name: string; bp: number; cost: number
    sprite: string; abilities: Ability[] | null
}

export interface FieldUnit extends Card {
    hasAction: boolean
    bpMod: number
}

type GameStatus = 'idle' | 'searching' | 'matched' | 'playing' | 'won' | 'lost'

const FIELD_SIZE = 3

class GameState {
    // ─── Connection / lobby ───────────────────────────
    status: GameStatus         = $state('idle')
    roomId: string             = $state('')
    opponentName: string       = $state('')

    // ─── My identity ──────────────────────────────────
    myIdx: number              = $state(-1)      // 0 or 1
    isFirst: boolean           = $state(false)
    isMyTurn: boolean          = $state(false)

    // ─── Turn / resources ─────────────────────────────
    turn: number               = $state(1)
    cp: number                 = $state(0)       // total CP this turn
    cpUsed: number             = $state(0)       // spent CP
    deckRemaining: number      = $state(0)

    // ─── HP ───────────────────────────────────────────
    myHP: number               = $state(5)
    opponentHP: number         = $state(5)

    // ─── Cards ────────────────────────────────────────
    hand: Card[]                        = $state([])
    myField: (FieldUnit | null)[]       = $state(Array(FIELD_SIZE).fill(null))
    opponentField: (FieldUnit | null)[] = $state(Array(FIELD_SIZE).fill(null))

    // ─── Interaction ──────────────────────────────────
    selectedCardIdx: number | null = $state(null)
    pendingPlacement: { cardId: number; fieldSlot: number } | null = $state(null)
    attackerSlot: number | null = $state(null)
    pendingAttack: { attackerSlot: number; defenderSlot: number } | null = $state(null)

    // ─── Attack animation cue ─────────────────────────
    myAttackingSlot: number  = $state(-1)
    oppAttackingSlot: number = $state(-1)

    // ─── Notification text ────────────────────────────
    notification: string = $state('')

    // ─── Derived ──────────────────────────────────────
    cpRemaining: number = $derived(this.cp - this.cpUsed)

    modeLabel: string = $derived.by(() => {
        if (this.pendingAttack) {
            const u = this.myField[this.pendingAttack.attackerSlot]
            return `Choose ability target for ${u?.name ?? 'unit'}`
        }
        if (this.attackerSlot !== null) {
            const u = this.myField[this.attackerSlot]
            return `${u?.name ?? 'Unit'} attacking — choose enemy slot (empty = direct)`
        }
        if (this.pendingPlacement !== null) {
            const card = this.hand.find(c => c.id === this.pendingPlacement!.cardId)
            const ab = card?.abilities?.find(a => a.trigger === 1 && a.ask >= 1)
            const abName = ab ? abilityTypeName(ab.type) : 'ability'
            return `Choose target for ${abName}`
        }
        if (this.selectedCardIdx !== null) {
            return `${this.hand[this.selectedCardIdx]?.name} — choose a field slot`
        }
        if (this.isMyTurn) return 'Your turn — play a card or attack'
        return 'Opponent\'s turn'
    })

    private socket: WebSocket | null = null

    // ─── Connection ───────────────────────────────────

    connect(): void {
        if (this.socket) return
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
        this.socket = new WebSocket(`${proto}://${window.location.host}/ws/game`)
        this.socket.onmessage = (e) => this.handleMessage(JSON.parse(e.data))
        this.socket.onclose   = () => { this.socket = null }
    }

    // ─── Lobby ────────────────────────────────────────

    findMatch(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.status = 'searching'
        this.send({ type: 'FIND_MATCH' })
    }

    // ─── Placement ────────────────────────────────────

    selectCard(idx: number): void {
        if (!this.isMyTurn || this.attackerSlot !== null || this.pendingAttack !== null) return
        this.selectedCardIdx = this.selectedCardIdx === idx ? null : idx
    }

    placeCard(slot: number): void {
        if (!this.isMyTurn || this.selectedCardIdx === null) return
        if (this.myField[slot] !== null) return
        const card = this.hand[this.selectedCardIdx]
        if (card.cost > this.cpRemaining) {
            this.notify('Not enough CP!')
            return
        }
        if (this.cardNeedsTarget(card)) {
            this.pendingPlacement = { cardId: card.id, fieldSlot: slot }
            this.selectedCardIdx = null
            return
        }
        this.cpUsed += card.cost
        this.send({ type: 'PUT_CARD', card_id: card.id, slot })
        this.selectedCardIdx = null
    }

    placeWithAbilityTarget(targetSlot: number): void {
        if (!this.pendingPlacement) return
        const card = this.hand.find(c => c.id === this.pendingPlacement!.cardId)
        if (!card) { this.pendingPlacement = null; return }
        this.cpUsed += card.cost
        this.send({ type: 'PUT_CARD', card_id: card.id, slot: this.pendingPlacement.fieldSlot, ability_target: targetSlot })
        this.pendingPlacement = null
    }

    cancelPendingPlacement(): void {
        this.pendingPlacement = null
        this.selectedCardIdx = null
    }

    // ─── Attack ───────────────────────────────────────

    selectAttacker(slot: number): void {
        if (!this.isMyTurn || this.selectedCardIdx !== null || this.pendingPlacement !== null) return
        const unit = this.myField[slot]
        if (!unit || !unit.hasAction) return
        this.attackerSlot = this.attackerSlot === slot ? null : slot
    }

    attack(defenderSlot: number): void {
        if (this.attackerSlot === null) return
        const attacker = this.myField[this.attackerSlot]
        if (!attacker) return
        const onAttackTargeting = attacker.abilities?.find(ab => ab.trigger === 2 && ab.ask === 1)
        if (onAttackTargeting && this.opponentField[defenderSlot]) {
            this.pendingAttack = { attackerSlot: this.attackerSlot, defenderSlot }
            this.attackerSlot = null
            return
        }
        this.send({ type: 'ATTACK', attacker_slot: this.attackerSlot, defender_slot: defenderSlot })
        this.attackerSlot = null
    }

    attackWithAbilityTarget(abilityTarget: number): void {
        if (!this.pendingAttack) return
        this.send({
            type: 'ATTACK',
            attacker_slot: this.pendingAttack.attackerSlot,
            defender_slot: this.pendingAttack.defenderSlot,
            ability_target: abilityTarget,
        })
        this.pendingAttack = null
    }

    cancelAttack(): void {
        this.attackerSlot = null
        this.pendingAttack = null
    }

    endTurn(): void {
        if (!this.isMyTurn) return
        this.isMyTurn = false
        this.selectedCardIdx = null
        this.attackerSlot = null
        this.pendingPlacement = null
        this.pendingAttack = null
        this.send({ type: 'TURN_END' })
    }

    // ─── Message handling ─────────────────────────────

    private handleMessage(msg: any): void {
        switch (msg.type) {
            case 'WAITING':
                this.status = 'searching'
                break

            case 'MATCH_FOUND':
                this.status = 'matched'
                this.roomId = msg.room_id
                this.opponentName = msg.opponent_name
                break

            case 'GAME_START':
                this.status      = 'playing'
                this.hand        = msg.hand
                this.deckRemaining = msg.deck_remaining
                this.isFirst     = msg.is_first
                this.isMyTurn    = msg.is_first
                this.myIdx       = msg.is_first ? 0 : 1
                this.myHP        = msg.hp
                this.opponentHP  = msg.hp
                this.cp          = 1
                this.cpUsed      = 0
                this.myField     = Array(FIELD_SIZE).fill(null)
                this.opponentField = Array(FIELD_SIZE).fill(null)
                break

            case 'CARD_PLACED':
                if (msg.player_idx === this.myIdx) {
                    this.hand = removeFirst(this.hand, (c) => c.id === msg.card.id)
                }
                break

            case 'FIELD_STATE':
                this.myField       = msg.fields[this.myIdx].map((u: any) => u ? { ...u } : null)
                this.opponentField = msg.fields[1 - this.myIdx].map((u: any) => u ? { ...u } : null)
                break

            case 'BATTLE_RESULT':
                if (msg.attacker_idx === this.myIdx) {
                    this.myAttackingSlot = msg.attacker_slot
                    setTimeout(() => { this.myAttackingSlot = -1 }, 1300)
                } else {
                    this.oppAttackingSlot = msg.attacker_slot
                    setTimeout(() => { this.oppAttackingSlot = -1 }, 1300)
                }
                if (msg.direct_dmg) {
                    this.notify(msg.attacker_idx === this.myIdx ? '⚡ Direct hit!' : '⚡ You were hit!')
                }
                break

            case 'ABILITY_EFFECT':
                this.notifyAbility(msg)
                break

            case 'HP_CHANGE':
                if (msg.player_idx === this.myIdx) this.myHP = msg.hp
                else this.opponentHP = msg.hp
                break

            case 'GAME_OVER':
                this.status = msg.winner_idx === this.myIdx ? 'won' : 'lost'
                break

            case 'DRAW_CARD':
                this.hand = [...this.hand, msg.card]
                this.deckRemaining = Math.max(0, this.deckRemaining - 1)
                this.notify(`Drew: ${msg.card.name}`)
                break

            case 'TURN_CHANGE':
                this.turn      = msg.turn
                this.isMyTurn  = msg.your_turn
                this.cp        = msg.cp
                this.cpUsed    = 0
                this.selectedCardIdx  = null
                this.attackerSlot     = null
                this.pendingPlacement = null
                this.pendingAttack    = null
                break
        }
    }

    // ─── Helpers ──────────────────────────────────────

    cardNeedsTarget(card: Card): boolean {
        return card.abilities?.some(ab => ab.trigger === 1 && ab.ask >= 1) ?? false
    }

    isValidAbilityTarget(slot: number): boolean {
        if (!this.pendingPlacement && !this.pendingAttack) return false
        const cardId = this.pendingPlacement?.cardId
            ?? this.myField[this.pendingAttack?.attackerSlot ?? -1]?.id
        const card = this.hand.find(c => c.id === cardId)
            ?? this.myField.find(u => u?.id === cardId)
        if (!card) return false
        const ab = (card as Card).abilities?.find(a => a.ask >= 1)
        if (!ab) return false
        const unit = this.opponentField[slot]
        if (!unit) return false
        if (ab.ask === 2) return !unit.hasAction
        return true
    }

    private notify(msg: string): void {
        this.notification = msg
        setTimeout(() => { this.notification = '' }, 2500)
    }

    private notifyAbility(msg: any): void {
        const names: Record<number, string> = { 1: 'Damage', 2: 'BP↑', 5: 'Stunned', 7: 'Draw', 8: 'Restored' }
        const n = names[msg.ability_type] ?? ''
        if (n) this.notify(`${n}${msg.amount ? ' ' + msg.amount : ''}`)
    }

    private send(obj: any): void {
        if (this.socket?.readyState === WebSocket.OPEN)
            this.socket.send(JSON.stringify(obj))
    }
}

function removeFirst<T>(arr: T[], pred: (x: T) => boolean): T[] {
    const i = arr.findIndex(pred)
    if (i < 0) return arr
    return [...arr.slice(0, i), ...arr.slice(i + 1)]
}

function abilityTypeName(type: number): string {
    const n: Record<number, string> = { 1: 'Damage', 5: 'Stun', 12: 'Unblockable', 11: 'Speed Move' }
    return n[type] ?? 'ability'
}

export const gameState = new GameState()
