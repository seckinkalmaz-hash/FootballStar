import Phaser from 'phaser';
import {
  AIM,
  BALL,
  FLICK,
  GAME_HEIGHT,
  GAME_WIDTH,
  MATCH,
  PITCH,
  type MatchOptions,
  type SquadSize,
  type TeamSide,
} from '../config';
import { planAiKick } from '../ai/FlickAI';
import { BallSprite } from '../entities/BallSprite';
import { PlayerSprite } from '../entities/PlayerSprite';
import { KickAim, type KickResult } from '../ui/KickAim';

type Phase = 'input' | 'resolving' | 'red_wait' | 'goal' | 'ended';

export class GameScene extends Phaser.Scene {
  private squadSize: SquadSize = 3;
  private players: PlayerSprite[] = [];
  private homeTeam: PlayerSprite[] = [];
  private awayTeam: PlayerSprite[] = [];
  private ball!: BallSprite;
  private aim!: KickAim;

  private scoreHome = 0;
  private scoreAway = 0;
  private timeLeft = MATCH.durationSec;
  private matchStartedAt = 0;
  private phase: Phase = 'input';
  private turn: TeamSide = 'home';
  private settleSince = 0;
  private resolveMs = 0;
  private resolveHandled = false;
  private flickingSide: TeamSide = 'home';
  private turnToken = 0;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
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

  private aimAngle = -Math.PI / 2;
  private charge = 0.45;
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
    this.players = [];
    this.homeTeam = [];
    this.awayTeam = [];
    this.uiHits = [];
    this.kickoffLock = true;
    this.resolveHandled = false;
    this.resolveMs = 0;
    this.flickingSide = 'home';
    this.turnToken = 0;
    this.clearAiTimer();
    this.clockPausedAt = null;
    this.charge = 0.45;
    this.charging = false;
  }

  create(): void {
    this.drawPitch();
    this.spawnTeams();
    this.ball = new BallSprite(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Players are immovable walls — only the ball flies (goal shot, not billiards)
    this.physics.add.collider(this.ball, this.players);
    this.physics.world.setBounds(
      PITCH.margin,
      PITCH.margin,
      GAME_WIDTH - PITCH.margin * 2,
      GAME_HEIGHT - PITCH.margin * 2,
    );

    this.aim = new KickAim(this);
    this.aim.setHandler((r) => this.applyKick(r, 'home'));

    this.setupInput();
    this.createHud();
    this.resetPositions('home');
    this.matchStartedAt = this.time.now;
    this.beginTurn('home');

    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      this.time.delayedCall(700, () => this.quickKick(0.7));
    }
  }

  update(_t: number, delta: number): void {
    if (this.phase === 'ended' || this.phase === 'goal' || this.phase === 'red_wait') return;

    this.syncClock();
    this.constrainBall();

    if (this.phase === 'resolving') {
      this.resolveMs += Math.min(delta, 50);
      this.checkGoals();
      if (this.phase !== 'resolving') return;
      if (this.resolveMs < 400) return;
      if (this.allSettled()) {
        this.settleSince += Math.min(delta, 50);
        if (this.settleSince >= FLICK.settleMs && !this.resolveHandled) this.afterResolve();
      } else {
        this.settleSince = 0;
      }
      return;
    }

    if (this.phase === 'input' && this.turn === 'home') {
      // Keep aim locked to ball
      if (this.aim.visible) this.aim.showAt(this.ball.x, this.ball.y);
      this.handleKeyboardAim(delta);
    }
  }

  private clearAiTimer(): void {
    if (this.aiTimer != null) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
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
    // Soft rain streaks (reference look)
    g.lineStyle(1, 0xffffff, 0.12);
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      g.lineBetween(x, y, x - 2, y + 18);
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
      const p = new PlayerSprite(this, pos.x, pos.y, 'home', i);
      this.homeTeam.push(p);
      this.players.push(p);
    });
    slots.away.forEach((pos, i) => {
      const p = new PlayerSprite(this, pos.x, pos.y, 'away', i);
      this.awayTeam.push(p);
      this.players.push(p);
    });
  }

  private formationSlots(size: SquadSize): {
    home: { x: number; y: number }[];
    away: { x: number; y: number }[];
  } {
    const cy = GAME_HEIGHT / 2;
    // Leave a clear central shooting lane toward each goal
    if (size === 2) {
      return {
        home: [
          { x: 130, y: cy }, // keeper-ish
          { x: 310, y: cy + 95 },
        ],
        away: [
          { x: GAME_WIDTH - 130, y: cy },
          { x: GAME_WIDTH - 310, y: cy - 95 },
        ],
      };
    }
    return {
      home: [
        { x: 120, y: cy }, // near own goal
        { x: 300, y: cy - 110 },
        { x: 300, y: cy + 110 },
      ],
      away: [
        { x: GAME_WIDTH - 120, y: cy },
        { x: GAME_WIDTH - 300, y: cy - 110 },
        { x: GAME_WIDTH - 300, y: cy + 110 },
      ],
    };
  }

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.worldX > GAME_WIDTH - 100 && p.worldY < 50) return;
      if (this.phase !== 'input' || this.turn !== 'home' || !this.aim.enabled) return;
      this.aim.beginPull(p.worldX, p.worldY);
      this.aim.updatePull(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.aim.isPulling) this.aim.updatePull(p.worldX, p.worldY);
    });
    this.input.on('pointerup', () => {
      if (!this.aim.isPulling) return;
      this.aim.release();
    });

    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.on('keydown-F', () => this.quickKick(0.72));
    this.input.keyboard.on('keydown-ENTER', () => this.quickKick(0.65));
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
    const goMenu = () => {
      this.clearAiTimer();
      this.aim.hide();
      this.scene.start('Menu');
    };
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
    this.turnToken += 1;

    if (side === 'home') {
      this.phase = 'input';
      this.resumeClock();
      this.bannerText.setAlpha(0);
      this.placeKickerNearBall(this.nearest(this.homeTeam));
      this.aimAngle = Phaser.Math.Angle.Between(
        this.ball.x,
        this.ball.y,
        GAME_WIDTH - PITCH.margin,
        GAME_HEIGHT / 2,
      );
      this.aim.showAt(this.ball.x, this.ball.y);
      this.aim.setKeyboardAim(this.aimAngle, this.charge);
      this.turnText.setText('Blue — SHOOT at the Red goal →');
      this.turnText.setColor('#e8f5e9');
      this.hintText.setText('Aim the yellow arrow at the goal · drag for power · F quick shot');
    } else {
      this.phase = 'red_wait';
      this.pauseClock();
      this.aim.hide();
      this.turnText.setText('RED — shooting at Blue goal…');
      this.turnText.setColor('#ef9a9a');
      this.hintText.setText('Opponent shoots at your goal');
      this.bannerText.setText('RED SHOT').setAlpha(0.85);
      const token = this.turnToken;
      this.aiTimer = setTimeout(() => {
        if (token !== this.turnToken || this.phase !== 'red_wait') return;
        this.bannerText.setAlpha(0);
        this.runAiTurn();
      }, 1100);
    }
  }

  private nearest(team: PlayerSprite[]): PlayerSprite {
    let best = team[0];
    let d0 = Number.POSITIVE_INFINITY;
    for (const p of team) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.ball.x, this.ball.y);
      if (d < d0) {
        d0 = d;
        best = p;
      }
    }
    return best;
  }

  private placeKickerNearBall(kicker: PlayerSprite): void {
    for (const p of this.homeTeam) p.setSelected(false);
    kicker.setSelected(true);
    const attackX = GAME_WIDTH - PITCH.margin;
    const ang = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, attackX, GAME_HEIGHT / 2);
    // Stand slightly "behind" the ball relative to attack
    kicker.setPosition(
      this.ball.x - Math.cos(ang) * 36,
      this.ball.y - Math.sin(ang) * 36,
    );
    kicker.stopHard();
  }

  private applyKick(r: KickResult, side: TeamSide): void {
    if (this.phase !== 'input' && this.phase !== 'red_wait') return;
    if (side === 'home' && this.turn !== 'home') return;
    if (side === 'away' && this.turn !== 'away') return;

    this.aim.hide();
    this.phase = 'resolving';
    this.settleSince = 0;
    this.resolveMs = 0;
    this.resolveHandled = false;
    this.flickingSide = side;
    this.pauseClock();
    this.turnText.setText(side === 'away' ? 'Red shot…' : 'Shot!');
    this.hintText.setText('Ball flies — blockers stay put');

    // Only the ball moves. Players are static walls.
    for (const p of this.players) p.stopHard();
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(r.dirX * r.power, r.dirY * r.power);

    this.tweens.add({ targets: this.ball, scale: 1.14, duration: 70, yoyo: true });
  }

  private quickKick(power01: number): void {
    if (this.phase !== 'input' || this.turn !== 'home') return;
    const ang = Phaser.Math.Angle.Between(
      this.ball.x,
      this.ball.y,
      GAME_WIDTH - PITCH.margin,
      GAME_HEIGHT / 2,
    );
    const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * power01;
    this.applyKick(
      { dirX: Math.cos(ang), dirY: Math.sin(ang), power, power01 },
      'home',
    );
  }

  private runAiTurn(): void {
    if (this.phase !== 'red_wait' || this.turn !== 'away') return;
    const plan = planAiKick('away', this.awayTeam, this.ball);
    this.placeKickerNearBallAway(plan.kicker);
    this.phase = 'input';
    this.turn = 'away';
    this.applyKick(plan.kick, 'away');
  }

  private placeKickerNearBallAway(kicker: PlayerSprite): void {
    const ang = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, PITCH.margin, GAME_HEIGHT / 2);
    kicker.setPosition(
      this.ball.x - Math.cos(ang) * 36,
      this.ball.y - Math.sin(ang) * 36,
    );
    kicker.stopHard();
  }

  private allSettled(): boolean {
    // Only the ball needs to settle — players never slide
    return (this.ball.body as Phaser.Physics.Arcade.Body).speed <= FLICK.settleSpeed;
  }

  private afterResolve(): void {
    if (this.phase !== 'resolving' || this.resolveHandled) return;
    this.resolveHandled = true;
    for (const p of this.players) p.stopHard();
    this.ball.stopHard();
    this.kickoffLock = false;
    const next: TeamSide = this.flickingSide === 'home' ? 'away' : 'home';
    this.beginTurn(next);
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
      if (this.kickoffLock && this.flickingSide === 'home') {
        this.rejectKickoffGoal();
        return;
      }
      this.onGoal('away');
    } else if (inGoalY && this.ball.x > GAME_WIDTH - m + 8) {
      if (this.kickoffLock && this.flickingSide === 'home') {
        this.rejectKickoffGoal();
        return;
      }
      this.onGoal('home');
    }
  }

  private rejectKickoffGoal(): void {
    this.ball.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.ball.stopHard();
    this.kickoffLock = false;
    this.bannerText.setText('No goal from kick-off').setAlpha(1);
    this.time.delayedCall(700, () => this.bannerText.setAlpha(0));
  }

  private onGoal(scorer: TeamSide): void {
    if (this.phase === 'goal' || this.phase === 'ended') return;
    this.phase = 'goal';
    for (const p of this.players) p.stopHard();
    this.ball.stopHard();
    this.aim.hide();
    if (scorer === 'home') this.scoreHome += 1;
    else this.scoreAway += 1;
    this.scoreText.setText(this.scoreString());
    this.bannerText.setText(`GOAL! ${MATCH.teams[scorer].name}`).setAlpha(1);
    const done =
      this.scoreHome >= MATCH.goalsToWin ||
      this.scoreAway >= MATCH.goalsToWin ||
      this.timeLeft <= 0;
    this.time.delayedCall(1100, () => {
      if (done) this.endMatch();
      else {
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
    if (this.timeLeft <= 0 && this.phase === 'input' && this.turn === 'home') this.endMatch();
  }

  private endMatch(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.aim.hide();
    this.clearAiTimer();
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
    this.homeTeam.forEach((p, i) => {
      p.setPosition(slots.home[i].x, slots.home[i].y);
      p.stopHard();
    });
    this.awayTeam.forEach((p, i) => {
      p.setPosition(slots.away[i].x, slots.away[i].y);
      p.stopHard();
    });
    const offset = kickOffTo === 'home' ? -20 : 20;
    this.ball.setPosition(GAME_WIDTH / 2 + offset, GAME_HEIGHT / 2);
    this.ball.stopHard();
  }

  private handleKeyboardAim(delta: number): void {
    if (!this.aim.enabled) return;
    if (this.cursors?.left?.isDown) this.aimAngle -= 0.0022 * delta;
    if (this.cursors?.right?.isDown) this.aimAngle += 0.0022 * delta;

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.charging = true;
      this.charge = 0.2;
    }
    if (this.charging && this.spaceKey?.isDown) {
      this.charge = Math.min(1, this.charge + delta / 900);
    }
    if (this.charging && this.spaceKey && Phaser.Input.Keyboard.JustUp(this.spaceKey)) {
      this.charging = false;
      const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * this.charge;
      this.applyKick(
        {
          dirX: Math.cos(this.aimAngle),
          dirY: Math.sin(this.aimAngle),
          power,
          power01: this.charge,
        },
        'home',
      );
      return;
    }

    this.aim.setKeyboardAim(this.aimAngle, this.charging ? this.charge : Math.max(0.35, this.charge));
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
