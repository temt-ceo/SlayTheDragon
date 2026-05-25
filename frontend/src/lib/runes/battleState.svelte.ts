export type Role = 'fighter' | 'magician' | 'healer'
export type ActionType =
    | 'attack' | 'defend' | 'charge_sword'
    | 'fireball' | 'fireball_aoe' | 'infuse_magic'
    | 'heal' | 'group_heal' | 'barrier'
    | 'fire_sword'
    | 'idle'

export interface Hero {
    name: string
    role: Role
    hp: number
    maxHp: number
    mp: number
    maxMp: number
    atk: number
    def: number
    alive: boolean
    defending: boolean
    barrierTurns: number
    swordCharged: boolean   // fighter contributed to Fire Sword
    magicCharged: boolean   // magician contributed to Fire Sword
    icon: string
}

export interface Enemy {
    id: number
    name: string
    hp: number
    maxHp: number
    atk: number
    def: number
    isBoss: boolean
    icon: string
    alive: boolean
}

export interface SelectedAction {
    type: ActionType
    targetEnemy?: number   // enemy id
    targetHero?: number    // hero index
}

export type Phase = 'select' | 'executing' | 'enemy_turn' | 'victory' | 'defeat'

export interface LogEntry {
    text: string
    kind: 'player' | 'enemy' | 'system' | 'fire'
}

const WAVES: Omit<Enemy, 'alive'>[][] = [
    [
        { id: 1, name: 'Drake',      hp: 90,  maxHp: 90,  atk: 22, def: 5,  isBoss: false, icon: '🐉', },
        { id: 2, name: 'Wyvern',     hp: 75,  maxHp: 75,  atk: 28, def: 3,  isBoss: false, icon: '🦎', },
    ],
    [
        { id: 3, name: 'Inferno',    hp: 120, maxHp: 120, atk: 35, def: 8,  isBoss: false, icon: '🔥', },
        { id: 4, name: 'Frost Drake',hp: 100, maxHp: 100, atk: 30, def: 10, isBoss: false, icon: '❄️', },
        { id: 5, name: 'Drake',      hp: 80,  maxHp: 80,  atk: 25, def: 5,  isBoss: false, icon: '🐉', },
    ],
    [
        { id: 6, name: 'BOSS DRAGON',hp: 480, maxHp: 480, atk: 55, def: 25, isBoss: true,  icon: '🔥🐉', },
    ],
]

function makeHeroes(): Hero[] {
    return [
        {
            name: 'Roland', role: 'fighter',
            hp: 220, maxHp: 220, mp: 30, maxMp: 30,
            atk: 55, def: 30, alive: true, defending: false, barrierTurns: 0,
            swordCharged: false, magicCharged: false, icon: '⚔️',
        },
        {
            name: 'Aria', role: 'magician',
            hp: 105, maxHp: 105, mp: 90, maxMp: 90,
            atk: 95, def: 8, alive: true, defending: false, barrierTurns: 0,
            swordCharged: false, magicCharged: false, icon: '🔮',
        },
        {
            name: 'Lira', role: 'healer',
            hp: 140, maxHp: 140, mp: 100, maxMp: 100,
            atk: 25, def: 15, alive: true, defending: false, barrierTurns: 0,
            swordCharged: false, magicCharged: false, icon: '💚',
        },
    ]
}

function makeWave(waveIdx: number): Enemy[] {
    return WAVES[waveIdx].map(e => ({ ...e, alive: true }))
}

class BattleState {
    heroes: Hero[]           = $state(makeHeroes())
    enemies: Enemy[]         = $state(makeWave(0))
    wave: number             = $state(0)          // 0-2
    phase: Phase             = $state('select')
    log: LogEntry[]          = $state([{ text: 'Wave 1 — Dragon horde approaches!', kind: 'system' }])
    actions: (SelectedAction | null)[] = $state([null, null, null])
    animHero: number         = $state(-1)
    animEnemy: number        = $state(-1)
    fireSwordForged: boolean = $state(false)
    fireSwordUsedThisTurn: boolean = $state(false)

    // ── Derived ──────────────────────────────────────────────
    allActionsSelected: boolean = $derived(
        this.actions.every((a, i) => a !== null || !this.heroes[i].alive)
    )

    fireSwordReady: boolean = $derived(
        this.heroes[0].swordCharged && this.heroes[1].magicCharged && !this.fireSwordForged
    )

    livingEnemies: Enemy[] = $derived(this.enemies.filter(e => e.alive))
    livingHeroes: Hero[]   = $derived(this.heroes.filter(h => h.alive))

    // ── Action selection ─────────────────────────────────────

    setAction(heroIdx: number, action: SelectedAction): void {
        if (this.phase !== 'select') return
        if (!this.heroes[heroIdx].alive) return
        const updated = [...this.actions]
        updated[heroIdx] = action
        this.actions = updated
    }

    clearAction(heroIdx: number): void {
        const updated = [...this.actions]
        updated[heroIdx] = null
        this.actions = updated
    }

    // ── Execute full turn ─────────────────────────────────────

    async executeTurn(): Promise<void> {
        if (!this.allActionsSelected || this.phase !== 'select') return
        this.phase = 'executing'
        this.fireSwordUsedThisTurn = false

        // Reset defending
        for (const h of this.heroes) h.defending = false

        // Decrement barrier
        for (const h of this.heroes) {
            if (h.barrierTurns > 0) h.barrierTurns--
        }

        for (let i = 0; i < 3; i++) {
            const hero = this.heroes[i]
            const act = this.actions[i]
            if (!hero.alive || !act) continue
            await this.executeHeroAction(i, act)
            await delay(400)
            if (this.livingEnemies.length === 0) break
        }

        if (this.livingEnemies.length === 0) {
            await this.handleWaveClear()
            return
        }

        // Enemy turn
        this.phase = 'enemy_turn'
        await delay(300)
        await this.doEnemyTurn()

        if (this.livingHeroes.length === 0) {
            this.phase = 'defeat'
            this.addLog('💀 The party has fallen...', 'system')
            return
        }

        this.actions = [null, null, null]
        this.phase = 'select'
    }

    private async executeHeroAction(idx: number, act: SelectedAction): Promise<void> {
        const hero = this.heroes[idx]
        this.animHero = idx
        await delay(200)

        switch (act.type) {
            // ── Fighter ──
            case 'attack': {
                const target = this.enemies.find(e => e.id === act.targetEnemy && e.alive)
                if (!target) break
                this.animEnemy = target.id
                const dmg = Math.max(1, hero.atk - target.def + rand(-5, 5))
                target.hp = Math.max(0, target.hp - dmg)
                if (target.hp === 0) target.alive = false
                this.addLog(`⚔️ ${hero.name} attacks ${target.name} for ${dmg} dmg!`, 'player')
                break
            }
            case 'defend': {
                hero.defending = true
                this.addLog(`🛡️ ${hero.name} takes a defensive stance.`, 'player')
                break
            }
            case 'charge_sword': {
                hero.swordCharged = true
                this.addLog(`⚔️ ${hero.name} channels sword energy into the Fire Sword!`, 'fire')
                this.checkFireSwordForge()
                break
            }

            // ── Magician ──
            case 'fireball': {
                const target = this.enemies.find(e => e.id === act.targetEnemy && e.alive)
                if (!target) break
                this.animEnemy = target.id
                if (hero.mp < 12) { this.addLog(`🔮 ${hero.name} is out of MP!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 12)
                const dmg = Math.max(1, hero.atk + rand(0, 20) - Math.floor(target.def * 0.5))
                target.hp = Math.max(0, target.hp - dmg)
                if (target.hp === 0) target.alive = false
                this.addLog(`🔥 ${hero.name} blasts ${target.name} with Fireball! ${dmg} dmg!`, 'player')
                break
            }
            case 'fireball_aoe': {
                if (hero.mp < 25) { this.addLog(`🔮 ${hero.name} is out of MP!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 25)
                let total = 0
                for (const e of this.enemies) {
                    if (!e.alive) continue
                    const dmg = Math.max(1, Math.floor(hero.atk * 0.7) + rand(0, 10) - Math.floor(e.def * 0.3))
                    e.hp = Math.max(0, e.hp - dmg)
                    if (e.hp === 0) e.alive = false
                    total += dmg
                }
                this.addLog(`💥 ${hero.name} unleashes Meteor Rain! ${total} total dmg!`, 'player')
                break
            }
            case 'infuse_magic': {
                if (hero.mp < 15) { this.addLog(`🔮 ${hero.name} is out of MP!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 15)
                hero.magicCharged = true
                this.addLog(`🔮 ${hero.name} infuses arcane fire into the Fire Sword!`, 'fire')
                this.checkFireSwordForge()
                break
            }

            // ── Fire Sword ──
            case 'fire_sword': {
                if (!this.fireSwordForged) break
                if (hero.mp < 30) { this.addLog(`Not enough MP for Fire Sword!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 30)
                this.fireSwordForged = false
                this.heroes[0].swordCharged = false
                this.heroes[1].magicCharged = false
                this.fireSwordUsedThisTurn = true
                for (const e of this.enemies) {
                    if (!e.alive) continue
                    // Fire Sword bypasses all DEF, triple damage on boss
                    const base = 180 + rand(0, 40)
                    const dmg = e.isBoss ? base * 3 : base
                    e.hp = Math.max(0, e.hp - dmg)
                    if (e.hp === 0) e.alive = false
                    this.addLog(
                        e.isBoss
                            ? `🔥⚔️ FIRE SWORD — BOSS CRITICAL! ${dmg} dmg! (Capability Transfer activated!)`
                            : `🔥⚔️ Fire Sword strikes ${e.name} for ${dmg} dmg!`,
                        'fire'
                    )
                }
                break
            }

            // ── Healer ──
            case 'heal': {
                const target = this.heroes[act.targetHero ?? idx]
                if (!target) break
                if (hero.mp < 18) { this.addLog(`💚 ${hero.name} is out of MP!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 18)
                const amount = 40 + rand(0, 20)
                target.hp = Math.min(target.maxHp, target.hp + amount)
                this.addLog(`💚 ${hero.name} heals ${target.name} for ${amount} HP!`, 'player')
                break
            }
            case 'group_heal': {
                if (hero.mp < 35) { this.addLog(`💚 ${hero.name} is out of MP!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 35)
                for (const h of this.heroes) {
                    if (!h.alive) continue
                    const amount = 25 + rand(0, 10)
                    h.hp = Math.min(h.maxHp, h.hp + amount)
                }
                this.addLog(`✨ ${hero.name} casts Group Heal on the whole party!`, 'player')
                break
            }
            case 'barrier': {
                if (hero.mp < 20) { this.addLog(`💚 ${hero.name} is out of MP!`, 'system'); break }
                hero.mp = Math.max(0, hero.mp - 20)
                for (const h of this.heroes) { if (h.alive) h.barrierTurns = 2 }
                this.addLog(`🌟 ${hero.name} raises a Barrier for 2 turns!`, 'player')
                break
            }
        }

        this.animHero = -1
        this.animEnemy = -1
    }

    private async doEnemyTurn(): Promise<void> {
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue
            await delay(350)
            this.animEnemy = enemy.id

            // Boss has a multi-hit
            const attacks = enemy.isBoss ? 2 : 1
            for (let hit = 0; hit < attacks; hit++) {
                const aliveHeroes = this.heroes.filter(h => h.alive)
                if (aliveHeroes.length === 0) break

                // Fighter absorbs if defending
                const defender = aliveHeroes.find(h => h.defending) ?? aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)]
                const mitigated = defender.barrierTurns > 0 ? Math.floor(enemy.atk * 0.4) : (defender.defending ? Math.floor(enemy.atk * 0.35) : enemy.atk)
                const dmg = Math.max(1, mitigated - defender.def + rand(-5, 5))
                defender.hp = Math.max(0, defender.hp - dmg)
                if (defender.hp === 0) defender.alive = false
                const shielded = defender.barrierTurns > 0 ? ' (Barrier!)' : (defender.defending ? ' (Blocked!)' : '')
                this.addLog(`${enemy.icon} ${enemy.name} attacks ${defender.name} for ${dmg} dmg!${shielded}`, 'enemy')
                await delay(200)
            }
            this.animEnemy = -1
        }
    }

    private checkFireSwordForge(): void {
        const fighter = this.heroes[0]
        const magician = this.heroes[1]
        if (fighter.swordCharged && magician.magicCharged && !this.fireSwordForged) {
            this.fireSwordForged = true
            this.addLog('🔥⚔️ FIRE SWORD FORGED! — Capability Transfer complete. Select Fire Sword to unleash!', 'fire')
        }
    }

    private async handleWaveClear(): Promise<void> {
        this.addLog(`✅ Wave ${this.wave + 1} cleared!`, 'system')
        if (this.wave >= WAVES.length - 1) {
            await delay(600)
            this.phase = 'victory'
            this.addLog('🏆 VICTORY! The Dragon is slain!', 'system')
            return
        }
        await delay(800)
        this.wave++
        this.enemies = makeWave(this.wave)
        // Restore some MP between waves
        for (const h of this.heroes) {
            if (h.alive) h.mp = Math.min(h.maxMp, h.mp + 20)
        }
        this.actions = [null, null, null]
        this.phase = 'select'
        this.addLog(`⚔️ Wave ${this.wave + 1} — ${this.wave === 2 ? 'BOSS DRAGON APPEARS!' : 'More dragons!'}`, 'system')
    }

    addLog(text: string, kind: LogEntry['kind']): void {
        this.log = [...this.log.slice(-19), { text, kind }]
    }

    reset(): void {
        this.heroes    = makeHeroes()
        this.enemies   = makeWave(0)
        this.wave      = 0
        this.phase     = 'select'
        this.log       = [{ text: 'Wave 1 — Dragon horde approaches!', kind: 'system' }]
        this.actions   = [null, null, null]
        this.animHero  = -1
        this.animEnemy = -1
        this.fireSwordForged = false
        this.fireSwordUsedThisTurn = false
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

function rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export const battle = new BattleState()
