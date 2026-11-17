import Phaser from 'phaser';
import {
  BALL,
  GAME_HEIGHT,
  GAME_WIDTH,
  MATCH,
  PITCH,
  PLAYER,
  type MatchOptions,
  type SquadSize,
  type TeamSide,
} from '../config';
import { SimpleAI } from '../ai/SimpleAI';
import { BallSprite } from '../entities/BallSprite';
import { PlayerSprite } from '../entities/PlayerSprite';
import { TouchControls } from '../ui/TouchControls';

type MatchState = 'playing' | 'goal' | 'ended';

export class GameScene extends Phaser.Scene {
  private squadSize: SquadSize = 3;
  private players: PlayerSprite[] = [];
  private homeTeam: PlayerSprite[] = [];
  private awayTeam: PlayerSprite[] = [];
  private human!: PlayerSprite;
  private ball!: BallSprite;
  private ai = new SimpleAI();
  private touch!: TouchControls;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private kickKey!: Phaser.Input.Keyboard.Key;

  private scoreHome = 0;
  private scoreAway = 0;
  private timeLeft = MATCH.durationSec;
  private state: MatchState = 'playing';
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private pitchBounds!: Phaser.Geom.Rectangle;
  private goalTop!: number;
  private goalBottom!: number;
  private lastPointerKick = false;

  constructor() {
    super('Game');
  }

  init(data: MatchOptions): void {
    this.squadSize = data?.squadSize === 2 ? 2 : 3;
    this.scoreHome = 0;
    this.scoreAway = 0;
    this.timeLeft = MATCH.durationSec;
    this.state = 'playing';
    this.players = [];
    this.homeTeam = [];
    this.awayTeam = [];
  }

  create(): void {
    this.drawPitch();
    this.spawnTeams();
    this.ball = new BallSprite(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.physics.add.collider(this.players, this.players);
    this.physics.add.collider(this.players, this.ball, undefined, undefined, this);
    this.physics.world.setBounds(
      this.pitchBounds.x,
      this.pitchBounds.y,
      this.pitchBounds.width,
      this.pitchBounds.height,
    );

    this.setupInput();
    this.touch = new TouchControls(this);
    this.createHud();
    this.resetPositions('home');

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.tickClock(),
    });
  }

  update(_time: number, delta: number): void {
    if (this.state !== 'playing') {
      for (const p of this.players) {
        const body = p.body as Phaser.Physics.Arcade.Body;
        body.setAcceleration(0, 0);
        body.setVelocity(0, 0);
      }
      return;
    }

    this.handleHumanInput();
    this.updateAI(delta);
    this.ball.applyFriction();
    this.constrainBallToPitch();
    this.checkGoals();
    this.tryHumanKick();
  }

  private drawPitch(): void {
    const m = PITCH.margin;
    this.pitchBounds = new Phaser.Geom.Rectangle(m, m, GAME_WIDTH - m * 2, GAME_HEIGHT - m * 2);
    this.goalTop = GAME_HEIGHT / 2 - PITCH.goalWidth / 2;
    this.goalBottom = GAME_HEIGHT / 2 + PITCH.goalWidth / 2;

    const g = this.add.graphics();
    g.fillStyle(PITCH.grassDark, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stripe grass
    g.fillStyle(PITCH.grassLight, 1);
    const stripeW = 48;
    for (let x = m; x < GAME_WIDTH - m; x += stripeW * 2) {
      g.fillRect(x, m, stripeW, GAME_HEIGHT - m * 2);
    }

    g.lineStyle(3, PITCH.lineColor, 0.9);
    g.strokeRect(m, m, GAME_WIDTH - m * 2, GAME_HEIGHT - m * 2);

    // Halfway
    g.lineBetween(GAME_WIDTH / 2, m, GAME_WIDTH / 2, GAME_HEIGHT - m);
    g.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 64);
    g.fillStyle(PITCH.lineColor, 1);
    g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 4);

    // Penalty boxes
    const boxW = 90;
    const boxH = 180;
    g.strokeRect(m, GAME_HEIGHT / 2 - boxH / 2, boxW, boxH);
    g.strokeRect(GAME_WIDTH - m - boxW, GAME_HEIGHT / 2 - boxH / 2, boxW, boxH);

    // Goals (visual nets)
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(m - PITCH.goalDepth, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);
    g.fillRect(GAME_WIDTH - m, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);
    g.lineStyle(4, 0xfffde7, 1);
    g.strokeRect(m - PITCH.goalDepth, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);
    g.strokeRect(GAME_WIDTH - m, this.goalTop, PITCH.goalDepth, PITCH.goalWidth);

    // Goal mouths open: disable world bounds on goal openings via custom ball clamp
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
    const formations = this.formationSlots(this.squadSize);
    // Prefer midfielder as human in 3v3 (index 1); in 2v2 use first slot
    const humanIndex = this.squadSize === 3 ? 1 : 0;
    formations.home.forEach((pos, i) => {
      const control = i === humanIndex ? 'human' : 'ai';
      const p = new PlayerSprite(this, pos.x, pos.y, 'home', i, control);
      this.homeTeam.push(p);
      this.players.push(p);
      if (control === 'human') this.human = p;
    });

    formations.away.forEach((pos, i) => {
      const p = new PlayerSprite(this, pos.x, pos.y, 'away', i, 'ai');
      this.awayTeam.push(p);
      this.players.push(p);
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
          { x: 180, y: cy - 50 },
          { x: 280, y: cy + 50 },
        ],
        away: [
          { x: GAME_WIDTH - 180, y: cy + 50 },
          { x: GAME_WIDTH - 280, y: cy - 50 },
        ],
      };
    }
    return {
      home: [
        { x: 150, y: cy },
        { x: 260, y: cy - 70 },
        { x: 260, y: cy + 70 },
      ],
      away: [
        { x: GAME_WIDTH - 150, y: cy },
        { x: GAME_WIDTH - 260, y: cy + 70 },
        { x: GAME_WIDTH - 260, y: cy - 70 },
      ],
    };
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D') as typeof this.wasd;
    this.kickKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Ignore UI stick / kick button regions roughly on left/right bottom
      if (pointer.x < 200 && pointer.y > GAME_HEIGHT - 180) return;
      if (pointer.x > GAME_WIDTH - 180 && pointer.y > GAME_HEIGHT - 180) return;
      this.lastPointerKick = true;
    });
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 18, this.scoreString(), {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(40)
      .setScrollFactor(0);

    this.timerText = this.add
      .text(GAME_WIDTH / 2, 50, this.timeString(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fff59d',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(40)
      .setScrollFactor(0);

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

    const menu = this.add
      .text(GAME_WIDTH - 16, 16, 'MENU', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#c8e6c9',
        backgroundColor: '#1b5e20aa',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(40)
      .setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('Menu'));
  }

  private handleHumanInput(): void {
    const body = this.human.body as Phaser.Physics.Arcade.Body;
    let ax = 0;
    let ay = 0;

    if (this.cursors?.left.isDown || this.wasd?.A.isDown) ax -= 1;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) ax += 1;
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) ay -= 1;
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) ay += 1;

    const stick = this.touch.getAxis();
    if (stick.lengthSq() > 0.01) {
      ax = stick.x;
      ay = stick.y;
    }

    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay) || 1;
      body.setAcceleration((ax / len) * PLAYER.accel, (ay / len) * PLAYER.accel);
      body.setMaxSpeed(PLAYER.speed);
    } else {
      body.setAcceleration(0, 0);
    }
  }

  private tryHumanKick(): void {
    const now = this.time.now;
    const wantKick =
      Phaser.Input.Keyboard.JustDown(this.kickKey) ||
      this.touch.consumeKick() ||
      this.lastPointerKick;
    this.lastPointerKick = false;
    if (!wantKick || !this.human.canKick(now)) return;

    const dist = Phaser.Math.Distance.Between(this.human.x, this.human.y, this.ball.x, this.ball.y);
    if (dist > PLAYER.kickRange) return;

    const angle = Phaser.Math.Angle.Between(this.human.x, this.human.y, this.ball.x, this.ball.y);
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    const hBody = this.human.body as Phaser.Physics.Arcade.Body;
    const boost = 1 + Math.min(hBody.speed / PLAYER.speed, 1) * 0.25;
    body.setVelocity(
      Math.cos(angle) * PLAYER.kickPower * boost,
      Math.sin(angle) * PLAYER.kickPower * boost,
    );
    this.human.markKick(now);

    // Tiny juice
    this.tweens.add({
      targets: this.ball,
      scale: 1.15,
      duration: 60,
      yoyo: true,
    });
  }

  private updateAI(delta: number): void {
    for (const p of this.players) {
      if (p.control !== 'ai') continue;
      const mates = p.team === 'home' ? this.homeTeam : this.awayTeam;
      const foes = p.team === 'home' ? this.awayTeam : this.homeTeam;
      this.ai.update(p, this.ball, mates, foes, delta);
    }
  }

  private constrainBallToPitch(): void {
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    const m = PITCH.margin;
    const r = BALL.radius;

    // Top / bottom
    if (this.ball.y - r < m) {
      this.ball.y = m + r;
      body.setVelocityY(Math.abs(body.velocity.y) * BALL.bounce);
    } else if (this.ball.y + r > GAME_HEIGHT - m) {
      this.ball.y = GAME_HEIGHT - m - r;
      body.setVelocityY(-Math.abs(body.velocity.y) * BALL.bounce);
    }

    const inGoalY = this.ball.y > this.goalTop && this.ball.y < this.goalBottom;

    // Left side
    if (this.ball.x - r < m) {
      if (inGoalY) {
        // allow into goal mouth for scoring check
        if (this.ball.x < m - PITCH.goalDepth + r) {
          this.ball.x = m - PITCH.goalDepth + r;
          body.setVelocityX(Math.abs(body.velocity.x) * BALL.bounce);
        }
      } else {
        this.ball.x = m + r;
        body.setVelocityX(Math.abs(body.velocity.x) * BALL.bounce);
      }
    }

    // Right side
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
    const m = PITCH.margin;
    const inGoalY = this.ball.y > this.goalTop + 4 && this.ball.y < this.goalBottom - 4;

    if (inGoalY && this.ball.x < m - 6) {
      this.onGoal('away');
    } else if (inGoalY && this.ball.x > GAME_WIDTH - m + 6) {
      this.onGoal('home');
    }
  }

  private onGoal(scorer: TeamSide): void {
    if (this.state !== 'playing') return;
    this.state = 'goal';
    if (scorer === 'home') this.scoreHome += 1;
    else this.scoreAway += 1;
    this.scoreText.setText(this.scoreString());

    const name = MATCH.teams[scorer].name;
    this.showBanner(`GOAL! ${name}`, 1200, () => {
      if (this.timeLeft <= 0) {
        this.endMatch();
      } else {
        this.resetPositions(scorer === 'home' ? 'away' : 'home');
        this.state = 'playing';
        this.bannerText.setAlpha(0);
      }
    });
  }

  private tickClock(): void {
    if (this.state !== 'playing') return;
    this.timeLeft -= 1;
    this.timerText.setText(this.timeString());
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endMatch();
    }
  }

  private endMatch(): void {
    this.state = 'ended';
    let result = 'Draw';
    if (this.scoreHome > this.scoreAway) result = `${MATCH.teams.home.name} wins!`;
    else if (this.scoreAway > this.scoreHome) result = `${MATCH.teams.away.name} wins!`;

    this.showBanner(`${result}\n${this.scoreString()}`, 0);

    const rematch = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, 'REMATCH', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#e8f5e9',
        backgroundColor: '#1b5e20',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(46)
      .setInteractive({ useHandCursor: true });
    rematch.on('pointerdown', () => this.scene.restart({ squadSize: this.squadSize }));
  }

  private resetPositions(kickOffTo: TeamSide): void {
    const slots = this.formationSlots(this.squadSize);
    this.homeTeam.forEach((p, i) => {
      const s = slots.home[i];
      p.setPosition(s.x, s.y);
      const body = p.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
    });
    this.awayTeam.forEach((p, i) => {
      const s = slots.away[i];
      p.setPosition(s.x, s.y);
      const body = p.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
    });

    const offset = kickOffTo === 'home' ? -24 : 24;
    this.ball.setPosition(GAME_WIDTH / 2 + offset, GAME_HEIGHT / 2);
    const b = this.ball.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, 0);
  }

  private showBanner(text: string, holdMs: number, after?: () => void): void {
    this.bannerText.setText(text).setAlpha(1);
    if (holdMs <= 0) return;
    this.time.delayedCall(holdMs, () => after?.());
  }

  private scoreString(): string {
    return `${this.scoreHome}  –  ${this.scoreAway}`;
  }

  private timeString(): string {
    const m = Math.floor(this.timeLeft / 60);
    const s = this.timeLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
