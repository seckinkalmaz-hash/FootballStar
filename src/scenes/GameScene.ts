import Phaser from 'phaser';
import {
  BALL,
  DISC,
  FLICK,
  GAME_HEIGHT,
  GAME_WIDTH,
  MATCH,
  PITCH,
  type MatchOptions,
  type SquadSize,
  type TeamSide,
} from '../config';
import { planAiFlick } from '../ai/FlickAI';
import { BallSprite } from '../entities/BallSprite';
import { PlayerSprite } from '../entities/PlayerSprite';
import { FlickAim, type FlickResult } from '../ui/FlickAim';

type Phase = 'input' | 'resolving' | 'red_wait' | 'goal' | 'ended';

export class GameScene extends Phaser.Scene {
  private squadSize: SquadSize = 3;
  private discs: PlayerSprite[] = [];
  private homeDiscs: PlayerSprite[] = [];
  private awayDiscs: PlayerSprite[] = [];
  private ball!: BallSprite;
  private aim!: FlickAim;

  private scoreHome = 0;
  private scoreAway = 0;
  private timeLeft = MATCH.durationSec;
  private matchStartedAt = 0;
  private phase: Phase = 'input';
  private turn: TeamSide = 'home';
  private selected: PlayerSprite | null = null;
  private settleSince = 0;
  private resolveMs = 0;
  private resolveHandled = false;
  private flickingSide: TeamSide = 'home';
  private turnToken = 0;
  private aiTimer: ReturnType <typeof setTimeout> | null = null;
  private kickoffLock = true;
  private clockPausedAt: number | null = null;

  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private goalTop = 0;
  private goalBottom = 0;
  private uiHits: { bounds: () => Phaser.Geom.Rectangle; action: () => void }[] = [];

  private aimAngle = 0;
  private charge = 0;
  private charging = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Game');
  }

  init(data: MatchOptions): void {
    this.squadSize = data?.squadSize === 2 ? 2 : 3;
    this.scoreHome = 0;
    this.scoreAway = 0;
    this.timeLeft = MATCH.durationSec;
    this.phase = 'input';
    this.turn = 'home';
    this.discs = [];
    this.homeDiscs = [];
    this.awayDiscs = [];
    this.selected = null;
    this.uiHits = [];
    this.kickoffLock = true;
    this.charge = 0;
    this.charging = false;
    this.resolveHandled = false;
    this.resolveMs = 0;
    this.flickingSide = 'home';
    this.turnToken = 0;
    this.clearAiTimer();
    this.clockPausedAt = null;
  }

  private clearAiTimer(): void {
    if (this.aiTimer != null) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  create(): void {
    this.drawPitch();
    this.spawnTeams();
    this.ball = new BallSprite(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.physics.add.collider(this.discs, this.discs);
    this.physics.add.collider(this.discs, this.ball);
    this.physics.world.setBounds(
      PITCH.margin,
      PITCH.margin,
      GAME_WIDTH - PITCH.margin * 2,
      GAME_HEIGHT - PITCH.margin * 2,
    );

    this.aim = new FlickAim(this);
    this.aim.setHandler((r) => this.applyFlick(r));

    this.setupInput();
    this.createHud();
    this.resetPositions('home');
    this.matchStartedAt = this.time.now;
    this.beginTurn('home');

    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      this.time.delayedCall(600, () => this.runDemoFlicks());
    }
  }

  update(_t: number, delta: number): void {
    this.writeDebug();
    if (this.phase === 'ended' || this.phase === 'goal' || this.phase === 'red_wait') return;

    this.syncClock();

    this.constrainBall();

    if (this.phase === 'resolving') {
      this.resolveMs += Math.min(delta, 50);
      this.checkGoals();
      if (this.phase !== 'resolving') return;
      // Require a minimum resolve window so velocity can apply before settle checks
      if (this.resolveMs < 400) return;
      if (this.allSettled()) {
        this.settleSince += Math.min(delta, 50);
        if (this.settleSince >= FLICK.settleMs && !this.resolveHandled) {
          this.afterResolve();
        }
      } else {
        this.settleSince = 0;
      }
      return;
    }

    if (this.phase === 'input' && this.turn === 'home') {
      this.handleKeyboardCharge(delta);
    }
  }

  private drawPitch(): void {
    const m = PITCH.margin;
    this.goalTop = GAME_HEIGHT / 2 - PITCH.goalWidth / 2;
    this.goalBottom = GAME_HEIGHT / 2 + PITCH.goalWidth / 2;

    const g = this.add.graphics();
    g.fillStyle(PITCH.grassDark, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(PITCH.grassLight, 1);
    for (let x = m; x < GAME_WIDTH - m; x += 96) {
      g.fillRect(x, m, 48, GAME_HEIGHT - m * 2);
    }
    g.lineStyle(3, PITCH.lineColor, 0.9);
    g.strokeRect(m, m, GAME_WIDTH - m * 2, GAME_HEIGHT - m * 2);
    g.lineBetween(GAME_WIDTH / 2, m, GAME_WIDTH / 2, GAME_HEIGHT - m);
    g.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 70);
    g.fillStyle(PITCH.lineColor, 1);
    g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 4);

    const boxW = 100;
    const boxH = 200;
    g.strokeRect(m, GAME_HEIGHT / 2 - boxH / 2, boxW, boxH);
    g.strokeRect(GAME_WIDTH - m - boxW, GAME_HEIGHT / 2 - boxH / 2, boxW, boxH);

    g.fillStyle(0xffffff, 0.14);
    g.fillRect(m - PITCH.goalDepth, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);
    g.fillRect(GAME_WIDTH - m, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);
    g.lineStyle(4, 0xfffde7, 1);
    g.strokeRect(m - PITCH.goalDepth, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);
    g.strokeRect(GAME_WIDTH - m, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);

    this.add
      .text(m + 8, m + 6, MATCH.teams.home.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#90caf9',
      })
      .setDepth(2);
    this.add
      .text(GAME_WIDTH - m - 8, m + 6, MATCH.teams.away.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ef9a9a',
      })
      .setOrigin(1, 0)
      .setDepth(2);
  }

  private spawnTeams(): void {
    const slots = this.formationSlots(this.squadSize);
    slots.home.forEach((pos, i) => {
      const d = new PlayerSprite(this, pos.x, pos.y, 'home', i);
      // Selection / drag handled at scene level (more reliable with Scale.FIT)
      this.homeDiscs.push(d);
      this.discs.push(d);
    });
    slots.away.forEach((pos, i) => {
      const d = new PlayerSprite(this, pos.x, pos.y, 'away', i);
      this.awayDiscs.push(d);
      this.discs.push(d);
    });
  }

  private formationSlots(size: SquadSize): {
    home: { x: number; y: number }[];
    away: { x: number; y: number }[];
  } {
    const cy = GAME_HEIGHT / 2;
    if (size === 2) {
      return {
        home: [
          { x: 200, y: cy - 70 },
          { x: 280, y: cy + 70 },
        ],
        away: [
          { x: GAME_WIDTH - 200, y: cy + 70 },
          { x: GAME_WIDTH - 280, y: cy - 70 },
        ],
      };
    }
    return {
      home: [
        { x: 160, y: cy },
        { x: 260, y: cy - 90 },
        { x: 260, y: cy + 90 },
      ],
      away: [
        { x: GAME_WIDTH - 160, y: cy },
        { x: GAME_WIDTH - 260, y: cy + 90 },
        { x: GAME_WIDTH - 260, y: cy - 90 },
      ],
    };
  }

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.phase !== 'input' || this.turn !== 'home' || !this.aim.enabled) return;
      // Ignore MENU hit zone
      if (p.worldX > GAME_WIDTH - 100 && p.worldY < 50) return;
      const hit = this.hitHomeDisc(p.worldX, p.worldY);
      if (!hit) return;
      this.selectDisc(hit);
      this.aim.begin(hit);
      this.aim.updatePull(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.aim.isPulling) return;
      this.aim.updatePull(p.worldX, p.worldY);
    });
    this.input.on('pointerup', () => {
      if (!this.aim.isPulling) return;
      this.aim.release();
    });

    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.keyboard.on('keydown-ONE', () => this.selectBySlot(0));
    this.input.keyboard.on('keydown-TWO', () => this.selectBySlot(1));
    this.input.keyboard.on('keydown-THREE', () => this.selectBySlot(2));
    // Instant flick toward ball (keyboard-friendly)
    this.input.keyboard.on('keydown-F', () => this.quickFlickTowardBall(0.72));
    this.input.keyboard.on('keydown-ENTER', () => this.quickFlickTowardBall(0.65));
  }

  private hitHomeDisc(x: number, y: number): PlayerSprite | null {
    let best: PlayerSprite | null = null;
    let bestD = DISC.radius + 18;
    for (const d of this.homeDiscs) {
      const dist = Phaser.Math.Distance.Between(x, y, d.x, d.y);
      if (dist <= bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  private quickFlickTowardBall(power01: number): void {
    if (this.phase !== 'input' || this.turn !== 'home') return;
    const disc = this.selected ?? this.homeDiscs[0];
    if (!disc) return;
    this.selectDisc(disc);
    const angle = Phaser.Math.Angle.Between(disc.x, disc.y, this.ball.x, this.ball.y);
    this.aim.fire(disc, angle, power01);
  }

  private runDemoFlicks(): void {
    if (this.phase !== 'input' || this.turn !== 'home') return;
    this.quickFlickTowardBall(0.8);
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 14, this.scoreString(), {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(40);

    this.timerText = this.add
      .text(GAME_WIDTH / 2, 46, this.timeString(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#fff59d',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(40);

    this.turnText = this.add
      .text(GAME_WIDTH / 2, 70, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#e8f5e9',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(40);

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#c8e6c9',
      })
      .setOrigin(0.5, 1)
      .setDepth(40);

    this.bannerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '40px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(45)
      .setAlpha(0);

    const menuBg = this.add
      .rectangle(GAME_WIDTH - 52, 28, 72, 28, 0x1b5e20, 0.9)
      .setStrokeStyle(1, 0xa5d6a7)
      .setDepth(40)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH - 52, 28, 'MENU', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#c8e6c9',
      })
      .setOrigin(0.5)
      .setDepth(41);
    const goMenu = () => this.scene.start('Menu');
    menuBg.on('pointerdown', goMenu);
    this.uiHits.push({ bounds: () => menuBg.getBounds(), action: goMenu });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      for (const hit of this.uiHits) {
        if (Phaser.Geom.Rectangle.Contains(hit.bounds(), pointer.worldX, pointer.worldY)) {
          hit.action();
          return;
        }
      }
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-M', goMenu);
      this.input.keyboard.on('keydown-R', () => {
        if (this.phase === 'ended') this.scene.restart({ squadSize: this.squadSize });
      });
    }
  }

  private beginTurn(side: TeamSide): void {
    this.clearAiTimer();
    this.turn = side;
    this.settleSince = 0;
    this.resolveMs = 0;
    this.charge = 0;
    this.charging = false;
    this.clearSelection();
    this.turnToken += 1;

    if (side === 'home') {
      this.phase = 'input';
      this.resumeClock();
      this.aim.enabled = true;
      this.bannerText.setAlpha(0);
      this.setDomTurn(null);
      this.selectDisc(this.homeDiscs[0] ?? null);
      this.turnText.setText('Blue turn — flick a disc');
      this.turnText.setColor('#e8f5e9');
      this.hintText.setText(
        'Drag back on Blue · F / Enter: quick flick to ball · 1–3 select · Space charge',
      );
    } else {
      // Dedicated wait phase so nothing else can treat this as Blue input
      this.phase = 'red_wait';
      this.pauseClock();
      this.aim.enabled = false;
      this.aim.cancel();
      this.turnText.setText('RED TURN — AI thinking');
      this.turnText.setColor('#ef9a9a');
      this.hintText.setText('Wait — opponent flick');
      this.bannerText.setText('RED TURN').setAlpha(0.9);
      this.setDomTurn('RED TURN', '#c62828');
      this.writeDebug();
      this.logFs(`beginTurn away token=${this.turnToken}`);
      const token = this.turnToken;
      this.aiTimer = window.setTimeout(() => {
        this.logFs(`aiTimer fire token=${token} cur=${this.turnToken} phase=${this.phase}`);
        if (token !== this.turnToken || this.phase !== 'red_wait') return;
        this.setDomTurn('RED FLICK…', '#b71c1c');
        this.runAiTurn();
      }, 1200);
    }
  }

  private logFs(msg: string): void {
    const w = window as Window & { __fsLog?: string[] };
    w.__fsLog = w.__fsLog ?? [];
    w.__fsLog.push(`${Date.now()}: ${msg}`);
  }

  /** DOM banner above the canvas — survives Phaser draw quirks under automation. */
  private setDomTurn(msg: string | null, bg = '#1b5e20'): void {
    let el = document.getElementById('fs-turn');
    if (!msg) {
      el?.remove();
      document.body.style.outline = '';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'fs-turn';
      el.style.cssText =
        'position:fixed;left:50%;top:18%;transform:translate(-50%,-50%);z-index:10000;' +
        'font:700 42px Georgia,serif;color:#fff;padding:18px 36px;border-radius:12px;' +
        'pointer-events:none;letter-spacing:0.04em;box-shadow:0 8px 32px #000a;';
      document.body.appendChild(el);
    }
    el.style.background = bg;
    el.textContent = msg;
    document.body.style.outline = `10px solid ${bg}`;
  }

  private selectBySlot(slot: number): void {
    if (this.phase !== 'input' || this.turn !== 'home') return;
    const d = this.homeDiscs.find((x) => x.slot === slot);
    if (d) this.selectDisc(d);
  }

  private selectDisc(disc: PlayerSprite | null): void {
    for (const d of this.homeDiscs) d.setSelected(false);
    this.selected = disc;
    disc?.setSelected(true);
    if (disc) {
      this.aimAngle = Phaser.Math.Angle.Between(disc.x, disc.y, this.ball.x, this.ball.y);
    }
  }

  private clearSelection(): void {
    for (const d of this.discs) d.setSelected(false);
    this.selected = null;
  }

  private applyFlick(r: FlickResult): void {
    if (this.phase !== 'input') return;
    if (this.turn === 'home' && r.disc.team !== 'home') return;
    if (this.turn === 'away' && r.disc.team !== 'away') return;

    this.aim.enabled = false;
    this.aim.cancel();
    this.phase = 'resolving';
    this.settleSince = 0;
    this.resolveMs = 0;
    this.resolveHandled = false;
    this.flickingSide = r.disc.team;
    this.pauseClock();
    this.turnText.setText(r.disc.team === 'away' ? 'Red flick…' : 'Resolving…');
    this.hintText.setText('');

    const body = r.disc.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(r.dirX * r.power, r.dirY * r.power);

    this.tweens.add({
      targets: r.disc,
      scale: 1.12,
      duration: 80,
      yoyo: true,
    });
  }

  private runAiTurn(): void {
    if (this.phase !== 'red_wait' || this.turn !== 'away') return;
    const plan = planAiFlick('away', this.awayDiscs, this.ball);
    plan.disc.setSelected(true);
    this.bannerText.setAlpha(0);
    // applyFlick expects phase === 'input'
    this.phase = 'input';
    this.applyFlick({
      disc: plan.disc,
      dirX: plan.dirX,
      dirY: plan.dirY,
      power: plan.power,
    });
  }

  private allSettled(): boolean {
    if ((this.ball.body as Phaser.Physics.Arcade.Body).speed > FLICK.settleSpeed) return false;
    for (const d of this.discs) {
      if ((d.body as Phaser.Physics.Arcade.Body).speed > FLICK.settleSpeed) return false;
    }
    return true;
  }

  private afterResolve(): void {
    if (this.phase !== 'resolving' || this.resolveHandled) return;
    this.resolveHandled = true;
    for (const d of this.discs) d.stopHard();
    this.ball.stopHard();
    this.clearSelection();

    // First contact after kickoff clears direct-goal lock conceptually for next shots
    this.kickoffLock = false;
    // Use the side that just flicked (not this.turn) so we never skip AI
    const next: TeamSide = this.flickingSide === 'home' ? 'away' : 'home';
    this.logFs(`afterResolve flickSide=${this.flickingSide} → next=${next}`);
    this.beginTurn(next);
  }

  private writeDebug(): void {
    const line = `phase=${this.phase} turn=${this.turn} flickSide=${this.flickingSide} token=${this.turnToken}`;
    (window as Window & { __fsDebug?: string }).__fsDebug = line;
    let el = document.getElementById('fs-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fs-debug';
      el.style.cssText =
        'position:fixed;left:8px;top:8px;z-index:9999;background:#000c;color:#0f0;font:12px monospace;padding:4px 8px;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = line;
  }

  private pauseClock(): void {
    if (this.clockPausedAt == null) this.clockPausedAt = this.time.now;
  }

  private resumeClock(): void {
    if (this.clockPausedAt == null) return;
    this.matchStartedAt += this.time.now - this.clockPausedAt;
    this.clockPausedAt = null;
  }

  private constrainBall(): void {
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    const m = PITCH.margin;
    const r = BALL.radius;

    if (this.ball.y - r < m) {
      this.ball.y = m + r;
      body.setVelocityY(Math.abs(body.velocity.y) * BALL.bounce);
    } else if (this.ball.y + r > GAME_HEIGHT - m) {
      this.ball.y = GAME_HEIGHT - m - r;
      body.setVelocityY(-Math.abs(body.velocity.y) * BALL.bounce);
    }

    const inGoalY = this.ball.y > this.goalTop && this.ball.y < this.goalBottom;

    if (this.ball.x - r < m) {
      if (inGoalY) {
        if (this.ball.x < m - PITCH.goalDepth + r) {
          this.ball.x = m - PITCH.goalDepth + r;
          body.setVelocityX(Math.abs(body.velocity.x) * BALL.bounce);
        }
      } else {
        this.ball.x = m + r;
        body.setVelocityX(Math.abs(body.velocity.x) * BALL.bounce);
      }
    }

    if (this.ball.x + r > GAME_WIDTH - m) {
      if (inGoalY) {
        if (this.ball.x > GAME_WIDTH - m + PITCH.goalDepth - r) {
          this.ball.x = GAME_WIDTH - m + PITCH.goalDepth - r;
          body.setVelocityX(-Math.abs(body.velocity.x) * BALL.bounce);
        }
      } else {
        this.ball.x = GAME_WIDTH - m - r;
        body.setVelocityX(-Math.abs(body.velocity.x) * BALL.bounce);
      }
    }
  }

  private checkGoals(): void {
    if (this.phase !== 'resolving') return;
    const m = PITCH.margin;
    const inGoalY = this.ball.y > this.goalTop + 4 && this.ball.y < this.goalBottom - 4;

    if (inGoalY && this.ball.x < m - 8) {
      // Soft kickoff lock: first shot of restart can't score for attacker — give ball back feel
      if (this.kickoffLock && this.turn === 'home') {
        this.rejectKickoffGoal();
        return;
      }
      this.onGoal('away');
    } else if (inGoalY && this.ball.x > GAME_WIDTH - m + 8) {
      if (this.kickoffLock && this.turn === 'home') {
        this.rejectKickoffGoal();
        return;
      }
      this.onGoal('home');
    }
  }

  private rejectKickoffGoal(): void {
    // Pull ball back to center-ish and continue resolve → turn swap
    this.ball.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.ball.stopHard();
    this.kickoffLock = false;
    this.bannerText.setText('No goal from kick-off').setAlpha(1);
    this.time.delayedCall(700, () => this.bannerText.setAlpha(0));
  }

  private onGoal(scorer: TeamSide): void {
    if (this.phase === 'goal' || this.phase === 'ended') return;
    this.phase = 'goal';
    for (const d of this.discs) d.stopHard();
    this.ball.stopHard();
    this.aim.cancel();
    this.aim.enabled = false;

    if (scorer === 'home') this.scoreHome += 1;
    else this.scoreAway += 1;
    this.scoreText.setText(this.scoreString());

    const name = MATCH.teams[scorer].name;
    this.bannerText.setText(`GOAL! ${name}`).setAlpha(1);

    const done =
      this.scoreHome >= MATCH.goalsToWin ||
      this.scoreAway >= MATCH.goalsToWin ||
      this.timeLeft <= 0;

    this.time.delayedCall(1100, () => {
      if (done) {
        this.endMatch();
      } else {
        this.bannerText.setAlpha(0);
        this.resetPositions(scorer === 'home' ? 'away' : 'home');
        this.kickoffLock = true;
        this.beginTurn(scorer === 'home' ? 'away' : 'home');
      }
    });
  }

  private syncClock(): void {
    if (this.phase === 'ended' || this.clockPausedAt != null) return;
    const elapsed = Math.floor((this.time.now - this.matchStartedAt) / 1000);
    const left = Math.max(0, MATCH.durationSec - elapsed);
    if (left !== this.timeLeft) {
      this.timeLeft = left;
      this.timerText.setText(this.timeString());
    }
    if (this.timeLeft <= 0 && this.phase === 'input' && this.turn === 'home') {
      this.endMatch();
    }
  }

  private endMatch(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.aim.enabled = false;
    this.aim.cancel();

    let result = 'Draw';
    if (this.scoreHome > this.scoreAway) result = `${MATCH.teams.home.name} wins!`;
    else if (this.scoreAway > this.scoreHome) result = `${MATCH.teams.away.name} wins!`;

    this.bannerText.setText(`${result}\n${this.scoreString()}`).setAlpha(1);
    this.turnText.setText('');
    this.hintText.setText('Press R to rematch');

    const restart = () => this.scene.restart({ squadSize: this.squadSize });
    const btn = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 78, 160, 48, 0x1b5e20, 1)
      .setStrokeStyle(2, 0xa5d6a7)
      .setDepth(46)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 78, 'REMATCH', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5)
      .setDepth(47);
    btn.on('pointerdown', restart);
    this.uiHits.push({ bounds: () => btn.getBounds(), action: restart });
  }

  private resetPositions(kickOffTo: TeamSide): void {
    const slots = this.formationSlots(this.squadSize);
    this.homeDiscs.forEach((d, i) => {
      const s = slots.home[i];
      d.setPosition(s.x, s.y);
      d.stopHard();
    });
    this.awayDiscs.forEach((d, i) => {
      const s = slots.away[i];
      d.setPosition(s.x, s.y);
      d.stopHard();
    });
    const offset = kickOffTo === 'home' ? -20 : 20;
    this.ball.setPosition(GAME_WIDTH / 2 + offset, GAME_HEIGHT / 2);
    this.ball.stopHard();
  }

  private handleKeyboardCharge(delta: number): void {
    if (this.phase !== 'input' || this.turn !== 'home' || !this.selected) return;

    if (this.cursors?.left?.isDown) this.aimAngle -= 0.0025 * delta;
    if (this.cursors?.right?.isDown) this.aimAngle += 0.0025 * delta;

    if (
      this.selected &&
      (this.charging || this.cursors?.left?.isDown || this.cursors?.right?.isDown)
    ) {
      this.drawKeyboardAim();
    }

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.charging = true;
      this.charge = 0.15;
    }
    if (this.charging && this.spaceKey?.isDown) {
      this.charge = Math.min(1, this.charge + delta / 900);
      this.drawKeyboardAim();
    }
    if (this.charging && this.spaceKey && Phaser.Input.Keyboard.JustUp(this.spaceKey)) {
      this.charging = false;
      this.aim.fire(this.selected, this.aimAngle, this.charge);
      this.charge = 0;
      this.clearKeyboardAim();
    }
  }

  private kbGfx?: Phaser.GameObjects.Graphics;

  private drawKeyboardAim(): void {
    if (!this.selected) return;
    if (!this.kbGfx) this.kbGfx = this.add.graphics().setDepth(31);
    const g = this.kbGfx;
    g.clear();
    const ax = this.selected.x;
    const ay = this.selected.y;
    const t = this.charge || 0.35;
    const travel = 50 + t * 100;
    const tx = ax + Math.cos(this.aimAngle) * travel;
    const ty = ay + Math.sin(this.aimAngle) * travel;
    g.lineStyle(4, 0xfff176, 0.95);
    g.lineBetween(ax, ay, tx, ty);
    g.strokeCircle(ax, ay, 26 + t * 10);
  }

  private clearKeyboardAim(): void {
    this.kbGfx?.clear();
  }

  private scoreString(): string {
    return `${this.scoreHome}  –  ${this.scoreAway}`;
  }

  private timeString(): string {
    const m = Math.floor(this.timeLeft / 60);
    const s = this.timeLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')} · first to ${MATCH.goalsToWin}`;
  }
}
