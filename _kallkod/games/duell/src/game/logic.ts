import {
  ANCHORS,
  ATTACKS,
  ATTACK_PHASES,
  CAEL,
  FH,
  FLOOR_Y,
  GRAV,
  HW,
  SOLIDS,
  SURFACES,
  VESPER,
  WINS,
  WORLD_W,
  bladeSegment,
  clamp,
  faceOf,
  handOf,
  lerp,
  smooth,
  type AIState,
  type Fighter,
  type GameEvent,
  type Intensity,
  type Knife,
  type Phase,
  type PlayerInput,
  type Side,
  type World,
  type SfxName,
} from "./types";

const TIPS = [
  "Drag to move. Flick to commit. The same flick is not the same act.",
  "A brace is a wall. Its first instant is a parry.",
  "Flick away early and you leave. Flick on the flash and you turn the blade.",
  "Near stone, a flick into the wall plants the foot and clears them.",
  "Forward and down carries you through the body, not into the edge.",
  "In the air, forward is a cut. A web crosses what a jump cannot.",
  "After a parry, one tap is a riposte. Do not mash a second.",
  "Tempo is contrast. The pause is part of the weapon.",
  "A shield hates a bash, and hates a blade from above.",
  "Knocked to the stone — flick into it, or throw a web.",
];

function emptyAI(parry: number): AIState {
  return {
    cd: 0.2,
    mood: "engage",
    pause: 0,
    shieldUntil: 0,
    knifeCd: 0.4,
    grappleCd: 0.3,
    parryChance: parry,
  };
}

export function makeFighter(id: Side, x: number, facing: 1 | -1, ai: boolean): Fighter {
  const pal = id === "player" ? CAEL : VESPER;
  return {
    id,
    name: id === "player" ? "Cael Vey" : "Vesper Qin",
    short: id === "player" ? "Cael" : "Vesper",
    x,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing,
    phase: "free",
    phaseT: 0,
    phaseDur: 0,
    attack: null,
    onGround: true,
    oneWay: false,
    wallDir: 0,
    dropTimer: 0,
    health: 100,
    healthLag: 100,
    stamina: 100,
    knives: 3,
    regenT: 0,
    throwLock: 0,
    throwAnim: 0,
    iFrames: 0,
    parryWindow: 0,
    riposte: 0,
    hitThisSwing: false,
    bladeLocal: 0.7,
    bladeLen: 78,
    shield: 0,
    shieldHeld: false,
    autoShield: 0,
    hitFlash: 0,
    squash: 0,
    gait: 0,
    trail: [],
    coyote: 0.1,
    airDash: 1,
    techWindow: 0,
    buffered: null,
    bufferT: 0,
    alive: true,
    pal,
    moveX: 0,
    aimX: x + facing * 200,
    aimY: FLOOR_Y - 200,
    aimOk: false,
    tether: null,
    grappleCd: 0,
    glint: false,
    stage: "none",
    phrase: "",
    phraseT: 0,
    phraseBig: false,
    stuckT: 0,
    isAI: ai,
    personality: id === "player" ? 0.28 : 0.8,
    prevVy: 0,
    rollDir: facing,
    ghostT: 0,
    attackId: 1,
    extraWind: 0.08,
    spin: 0,
    wasGround: true,
    braceSaid: false,
    feint: 0,
    stamDelay: 0,
    comboCount: 0,
    comboTimer: 0,
  };
}

export function createWorld(intensity: Intensity): World {
  const measured = intensity === "measured";
  const w: World = {
    time: 0,
    mode: "attract",
    modeT: 0,
    hitstop: 0,
    timeScale: 1,
    shake: 0,
    punch: 0,
    letter: 0,
    flash: 0,
    message: "",
    submessage: "",
    messageT: 0,
    player: makeFighter("player", 340, 1, true),
    rival: makeFighter("rival", 1760, -1, true),
    knives: [],
    pickups: [
      { x: 700, y: 586, respawn: 0 },
      { x: 1400, y: 586, respawn: 0 },
    ],
    particles: [],
    floaters: [],
    shocks: [],
    slashes: [],
    ghosts: [],
    log: [],
    sfx: [],
    aiP: emptyAI(measured ? 0.18 : 0.3),
    aiR: emptyAI(measured ? 0.22 : 0.36),
    scoreP: 0,
    scoreR: 0,
    round: 1,
    intensity,
    winner: null,
    matchWinner: null,
    attract: true,
    coach: "The span is already in motion.",
    coachT: 0,
    tipI: 0,
    debug: false,
    lessons: 0,
    flashColor: "#fff6e0",
  };
  w.player.extraWind = measured ? 0.08 : 0.04;
  w.rival.extraWind = measured ? 0.13 : 0.05;
  w.player.personality = 0.25;
  w.rival.personality = 0.84;
  return w;
}

export function setIntensity(w: World, intensity: Intensity) {
  w.intensity = intensity;
  const measured = intensity === "measured";
  w.aiP.parryChance = measured ? 0.16 : 0.28;
  w.aiR.parryChance = measured ? 0.22 : 0.38;
  w.player.extraWind = 0;
  w.rival.extraWind = measured ? 0.13 : 0.05;
}

function sfx(w: World, n: SfxName) {
  w.sfx.push(n);
}

function burst(
  w: World,
  x: number,
  y: number,
  color: string,
  n: number,
  speed: number,
  kind: "spark" | "dust" | "ember" | "mote",
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    w.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s * (kind === "dust" ? -0.4 : 1) - (kind === "ember" ? 40 : 0),
      life: 0.25 + Math.random() * (kind === "spark" ? 0.28 : 0.5),
      max: 0.5,
      size: kind === "spark" ? 1.4 + Math.random() * 1.8 : 2 + Math.random() * 3,
      color,
      kind,
      g: kind === "spark" ? 900 : kind === "dust" ? -40 : kind === "ember" ? -30 : 0,
    });
  }
  if (w.particles.length > 260) w.particles.splice(0, w.particles.length - 260);
}

function shock(w: World, x: number, y: number, color: string, power: number) {
  w.shocks.push({ x, y, life: 0.28, max: 0.28, color, power });
}

function addSlash(w: World, x1: number, y1: number, x2: number, y2: number, color: string, width = 4, duration = 0.14) {
  w.slashes.push({ x1, y1, x2, y2, color, width, life: duration, max: duration });
  if (w.slashes.length > 12) w.slashes.shift();
}

function showDamage(w: World, x: number, y: number, dmg: number, crit = false, color = "#ffdf80") {
  w.floaters.push({
    x: x + (Math.random() - 0.5) * 24,
    y: y - 20,
    text: crit ? `-${dmg}!` : `-${dmg}`,
    life: crit ? 0.95 : 0.65,
    max: crit ? 0.95 : 0.65,
    color: crit ? "#ff5544" : color,
    big: crit,
    isDmg: true,
    dmg,
  });
  if (w.floaters.length > 20) w.floaters.shift();
}

function say(w: World, f: Fighter, text: string, big = false) {
  f.phrase = text;
  f.phraseT = big ? 0.95 : 0.62;
  f.phraseBig = big;
  w.floaters.push({
    x: f.x + (Math.random() - 0.5) * 20,
    y: f.y - FH - 18,
    text,
    life: big ? 0.95 : 0.62,
    max: big ? 0.95 : 0.62,
    color: big ? "#fff6df" : f.pal.glow,
    big,
  });
  if (w.floaters.length > 14) w.floaters.shift();
  const quiet = text === "rise" || text === "drop" || text === "close in" || text === "brace" || text === "release";
  if (!quiet) {
    w.log.unshift({ who: f.short, text, side: f.id === "player" ? "p" : "r", life: 3.4 });
    w.log = w.log.slice(0, 4);
  }
}

function place(f: Fighter, x: number, facing: 1 | -1) {
  f.x = x;
  f.y = FLOOR_Y;
  f.vx = 0;
  f.vy = 0;
  f.facing = facing;
  f.phase = "bow";
  f.phaseT = 0;
  f.phaseDur = 1.5;
  f.attack = null;
  f.stage = "none";
  f.onGround = true;
  f.oneWay = false;
  f.wallDir = 0;
  f.health = 100;
  f.healthLag = 100;
  f.stamina = 100;
  f.knives = 3;
  f.regenT = 0;
  f.throwLock = 0;
  f.throwAnim = 0;
  f.iFrames = 0;
  f.parryWindow = 0;
  f.riposte = 0;
  f.hitThisSwing = false;
  f.bladeLocal = -0.9;
  f.bladeLen = 78;
  f.shield = 0;
  f.shieldHeld = false;
  f.autoShield = 0;
  f.hitFlash = 0;
  f.alive = true;
  f.tether = null;
  f.grappleCd = 0.2;
  f.buffered = null;
  f.techWindow = 0;
  f.trail = [];
  f.squash = 0;
  f.moveX = 0;
  f.phrase = "";
  f.phraseT = 0;
  f.feint = 0;
  f.braceSaid = false;
  f.stamDelay = 0;
  f.comboCount = 0;
  f.comboTimer = 0;
}

export function resetRound(w: World, bow: boolean) {
  place(w.player, 340, 1);
  place(w.rival, 1760, -1);
  if (!bow) {
    w.player.phase = "free";
    w.rival.phase = "free";
    w.player.bladeLocal = 0.65;
    w.rival.bladeLocal = 0.65;
  }
  w.knives = [];
  w.pickups = [
    { x: 700, y: 586, respawn: 1.2 },
    { x: 1400, y: 586, respawn: 1.2 },
  ];
  w.winner = null;
  w.hitstop = 0;
  w.timeScale = 1;
  w.letter = 0;
}

export function beginAttract(w: World) {
  w.attract = true;
  w.player.isAI = true;
  w.rival.isAI = true;
  w.scoreP = 0;
  w.scoreR = 0;
  w.round = 1;
  w.matchWinner = null;
  w.mode = "attract";
  w.modeT = 0;
  resetRound(w, false);
  w.player.phase = "free";
  w.rival.phase = "free";
  w.message = "";
  w.coach = "The span is already in motion.";
}

export function beginDuel(w: World) {
  w.attract = false;
  w.player.isAI = false;
  w.rival.isAI = true;
  w.player.extraWind = 0;
  w.scoreP = 0;
  w.scoreR = 0;
  w.round = 1;
  w.matchWinner = null;
  w.mode = "intro";
  w.modeT = 0;
  resetRound(w, true);
  w.message = "ROUND I";
  w.submessage = "the meridian span";
  w.messageT = 1.15;
  w.coach = "Drag to move. Flick to commit. Tap to cut.";
  w.lessons = 0;
}

function beginFight(w: World) {
  w.mode = w.attract ? "attract" : "fight";
  w.modeT = 0;
  w.timeScale = 1;
  if (w.player.phase === "bow") w.player.phase = "free";
  if (w.rival.phase === "bow") w.rival.phase = "free";
  w.message = "ENGAGE";
  w.submessage = "";
  w.messageT = 0.7;
  sfx(w, "engage");
}

function roman(n: number) {
  return ["", "I", "II", "III", "IV", "V", "VI"][n] ?? String(n);
}

function endExchange(w: World, winner: Fighter, loser: Fighter) {
  if (w.mode === "ko" || w.mode === "match") return;
  w.mode = "ko";
  w.modeT = 0;
  w.winner = winner.id;
  w.timeScale = 0.34;
  w.hitstop = 0.05;
  w.shake = 16;
  w.punch = 0.1;
  w.letter = 1;
  w.flash = 0.35;
  w.flashColor = winner.pal.glow;
  loser.alive = false;
  loser.health = 0;
  loser.phase = "launch";
  loser.phaseT = 0;
  loser.phaseDur = 1.4;
  loser.attack = null;
  loser.stage = "none";
  loser.tether = null;
  loser.vy = -620;
  loser.vx = faceOf(loser.x - winner.x, winner.facing) * 560;
  loser.iFrames = 0;
  if (!w.attract) {
    if (winner.id === "player") w.scoreP++;
    else w.scoreR++;
    w.message = winner.short.toUpperCase();
    w.submessage = "takes the exchange";
    w.messageT = 1.6;
  } else {
    w.message = "";
    w.submessage = "";
  }
  sfx(w, "ko");
  shock(w, loser.x, loser.y - 50, winner.pal.glow, 90);
  burst(w, loser.x, loser.y - 40, "#fff", 18, 280, "spark");
}

function shielding(f: Fighter) {
  return f.shieldHeld || f.autoShield > 0;
}

function canAccept(f: Fighter, kind: "any" | "defense" | "attack" | "grapple") {
  if (!f.alive) return false;
  if (f.phase === "bow" || f.phase === "downed" || f.phase === "rise") return false;
  if (f.phase === "stun") return false;
  if (f.phase === "launch") return kind === "grapple";
  if (f.phase === "free" || f.phase === "block" || f.phase === "grapple" || f.phase === "dash") return true;
  if (f.phase === "flip" || f.phase === "vault" || f.phase === "evade") {
    return kind === "grapple" || kind === "attack" && f.phaseT > 0.18;
  }
  if (ATTACK_PHASES.has(f.phase) && f.attack) {
    if (f.stage === "windup" && f.phaseT < f.attack.windup * 0.46 && kind === "defense") return true;
    if (f.stage === "recover" && kind !== "attack") return true;
    if (f.stage === "recover" && kind === "attack" && f.riposte > 0) return true;
    if (kind === "grapple" && f.stage !== "active") return true;
  }
  if ((f.phase === "roll" || f.phase === "slide") && f.phaseT > f.phaseDur * 0.7 && kind !== "attack") return true;
  return false;
}

function cancelAttack(f: Fighter) {
  if (f.attack && f.stage === "windup") {
    f.stamina = clamp(f.stamina + f.attack.stam * 0.65, 0, 100);
    f.feint = 0.3;
  }
  f.attack = null;
  f.stage = "none";
  f.hitThisSwing = false;
}

function enterFree(f: Fighter) {
  f.phase = "free";
  f.phaseT = 0;
  f.attack = null;
  f.stage = "none";
}

function beginAttack(w: World, f: Fighter, opp: Fighter, name: string) {
  if (f.stamina < 8 && name !== "riposte") {
    say(w, f, "spent");
    return false;
  }
  const base = ATTACKS[name];
  if (!base) return false;
  cancelAttack(f);
  const atk = { ...base, windup: base.windup + (f.isAI ? f.extraWind : 0) };
  f.stamina = Math.max(0, f.stamina - atk.stam);
  f.stamDelay = 0.45;
  f.phase = name as Phase;
  f.phaseT = 0;
  f.phaseDur = atk.windup + atk.active + atk.recover;
  f.attack = atk;
  f.hitThisSwing = false;
  f.attackId++;
  f.stage = "windup";
  f.riposte = name === "riposte" ? 0 : f.riposte;
  f.tether = null;
  f.facing = faceOf(opp.x - f.x, f.facing);
  if (name === "leap") {
    f.vx = f.facing * 300;
    f.vy = -900;
    f.onGround = false;
  } else if (name === "aerial") {
    f.vx += f.facing * 70;
  } else if (name === "lunge") {
    f.facing = faceOf(opp.x - f.x, f.facing);
    f.vx = f.facing * 300;
  } else if (name === "uppercut") {
    f.facing = faceOf(opp.x - f.x, f.facing);
    f.vx = f.facing * 180;
  } else if (name === "finisher") {
    f.facing = faceOf(opp.x - f.x, f.facing);
    f.vx = f.facing * 380;
  }
  const sfxName: SfxName =
    name === "bash"
      ? "bash"
      : name === "uppercut"
        ? "combo"
        : name === "finisher"
          ? "whoosh"
          : "swing";
  sfx(w, sfxName);
  const label =
    name === "cut"
      ? "cut"
      : name === "uppercut"
        ? "uppercut"
        : name === "finisher"
          ? "heavy finisher"
          : name === "thrust"
            ? "thrust"
            : name === "lunge"
              ? "lunge"
              : name === "aerial"
                ? "aerial cut"
                : name === "leap"
                  ? "leaping cut"
                  : name === "riposte"
                    ? "riposte"
                    : "bash";
  say(w, f, label, name === "riposte" || name === "finisher");
  return true;
}

function startJump(w: World, f: Fighter) {
  if (f.coyote <= 0 && !f.onGround) return;
  f.vy = -980;
  f.onGround = false;
  f.coyote = 0;
  f.squash = -0.24;
  if (f.phase === "block") enterFree(f);
  burst(w, f.x, f.y, "#cbbfa8", 8, 140, "dust");
  w.punch = Math.max(w.punch, 0.03);
  sfx(w, "jump");
  say(w, f, "rise");
}

function startVault(w: World, f: Fighter, opp: Fighter) {
  const away = f.wallDir ? ((-f.wallDir) as 1 | -1) : faceOf(opp.x - f.x, f.facing);
  cancelAttack(f);
  f.phase = "vault";
  f.phaseT = 0;
  f.phaseDur = 0.62;
  f.facing = away;
  f.vx = away * 620;
  f.vy = -1160;
  f.onGround = false;
  f.iFrames = 0.22;
  f.tether = null;
  f.stamina = Math.max(0, f.stamina - 8);
  f.squash = 0.25;
  say(w, f, "WALL VAULT!", true);
  sfx(w, "dodge");
  burst(w, f.x + (f.wallDir || -away) * 22, f.y - 10, "#d9cbb4", 16, 220, "dust");
  burst(w, f.x + (f.wallDir || -away) * 22, f.y - 10, "#ffffff", 8, 200, "spark");
  w.shake = Math.max(w.shake, 7);
  w.punch = Math.max(w.punch, 0.05);
}

function startEvade(w: World, f: Fighter, opp: Fighter) {
  cancelAttack(f);
  const away = faceOf(f.x - opp.x, -f.facing);
  f.phase = "evade";
  f.phaseT = 0;
  f.phaseDur = 0.34;
  f.facing = faceOf(opp.x - f.x, f.facing);
  f.vx = away * 480;
  f.vy = -360;
  f.onGround = false;
  f.iFrames = 0.2;
  f.tether = null;
  say(w, f, "evade");
  sfx(w, "dodge");
  burst(w, f.x, f.y, "#cbbfa8", 6, 120, "dust");
}

function startBackflip(w: World, f: Fighter, opp: Fighter) {
  cancelAttack(f);
  const away = faceOf(f.x - opp.x, -f.facing);
  f.phase = "flip";
  f.phaseT = 0;
  f.phaseDur = 0.72;
  f.rollDir = away;
  f.vx = away * 340;
  f.vy = -1140;
  f.onGround = false;
  f.iFrames = 0.2;
  f.facing = faceOf(opp.x - f.x, f.facing);
  f.tether = null;
  say(w, f, "backflip", true);
  sfx(w, "dodge");
  burst(w, f.x, f.y, "#cbbfa8", 8, 160, "dust");
  w.punch = Math.max(w.punch, 0.04);
}

function startJumpOver(w: World, f: Fighter, opp: Fighter) {
  cancelAttack(f);
  const toward = faceOf(opp.x - f.x, f.facing);
  f.phase = "flip";
  f.phaseT = 0;
  f.phaseDur = 0.7;
  f.rollDir = toward;
  f.facing = toward;
  f.vx = toward * 380;
  f.vy = -1080;
  f.onGround = false;
  f.iFrames = 0.2;
  f.tether = null;
  say(w, f, "over", true);
  sfx(w, "jump");
  burst(w, f.x, f.y, "#cbbfa8", 10, 160, "dust");
  w.punch = Math.max(w.punch, 0.04);
}

function startLeap(w: World, f: Fighter, opp: Fighter) {
  f.facing = faceOf(opp.x - f.x, f.facing);
  beginAttack(w, f, opp, "leap");
}

function startRoll(w: World, f: Fighter, dir: 1 | -1) {
  if (f.stamina < 8) {
    say(w, f, "spent");
    return;
  }
  cancelAttack(f);
  f.phase = "roll";
  f.phaseT = 0;
  f.phaseDur = 0.42;
  f.rollDir = dir;
  f.facing = dir;
  f.vx = dir * 600;
  f.vy = Math.min(f.vy, 0);
  f.iFrames = 0.28;
  f.stamina = Math.max(0, f.stamina - 14);
  f.stamDelay = 0.3;
  f.tether = null;
  say(w, f, "roll");
  sfx(w, "dash");
  burst(w, f.x, f.y, "#cbbfa8", 10, 110, "dust");
}

function startSlide(w: World, f: Fighter, dir: 1 | -1) {
  cancelAttack(f);
  f.phase = "slide";
  f.phaseT = 0;
  f.phaseDur = 0.34;
  f.rollDir = dir;
  f.vx = dir * 420;
  f.iFrames = 0.12;
  f.tether = null;
  say(w, f, "slide");
  burst(w, f.x, f.y, "#cbbfa8", 5, 70, "dust");
}

function startDash(w: World, f: Fighter, dir: 1 | -1) {
  cancelAttack(f);
  f.phase = "dash";
  f.phaseT = 0;
  f.phaseDur = 0.22;
  f.rollDir = dir;
  f.facing = dir;
  f.vx = dir * 660;
  say(w, f, "close in");
  burst(w, f.x - dir * 10, f.y, "#cbbfa8", 4, 60, "dust");
}

function startParryPose(w: World, f: Fighter) {
  cancelAttack(f);
  f.phase = "block";
  f.phaseT = 0;
  f.parryWindow = 0.12;
  f.autoShield = 0.2;
  f.shield = Math.max(f.shield, 0.65);
  f.tether = null;
  sfx(w, "whoosh");
}

function findTether(f: Fighter, aimX: number, aimY: number, auto: boolean, opp: Fighter) {
  const ox = f.x;
  const oy = f.y - FH * 0.62;
  if (auto) {
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    for (const a of ANCHORS) {
      const d = Math.hypot(a.x - ox, a.y - oy);
      if (d > 680 || d < 48) continue;
      const toward = (a.x - ox) * faceOf(opp.x - ox, f.facing);
      const height = oy - a.y;
      const score = toward * 0.35 + height * 0.9 - d * 0.12 + (a.y < 120 ? 40 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (best) return best;
    return { x: clamp(ox + f.facing * 280, 70, WORLD_W - 70), y: 40 };
  }
  let dx = aimX - ox;
  let dy = aimY - oy;
  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag;
  dy /= mag;
  let best: { x: number; y: number } | null = null;
  let bestDot = 0.62;
  for (const a of ANCHORS) {
    const adx = a.x - ox;
    const ady = a.y - oy;
    const d = Math.hypot(adx, ady);
    if (d > 660 || d < 36) continue;
    const dot = (adx / d) * dx + (ady / d) * dy;
    if (dot > bestDot) {
      bestDot = dot;
      best = a;
    }
  }
  if (best) return best;
  const maxD = 560;
  for (let t = 24; t < maxD; t += 10) {
    const x = ox + dx * t;
    const y = oy + dy * t;
    if (y <= 42) return { x: clamp(x, 60, WORLD_W - 60), y: 42 };
    if (x <= 52) return { x: 52, y: clamp(y, 40, FLOOR_Y - 20) };
    if (x >= WORLD_W - 52) return { x: WORLD_W - 52, y: clamp(y, 40, FLOOR_Y - 20) };
    for (const c of SOLIDS) {
      if (c.id.startsWith("wall")) continue;
      if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) {
        return { x: ox + dx * (t - 10), y: oy + dy * (t - 10) };
      }
    }
  }
  if (dy < -0.15) return { x: clamp(ox + dx * 360, 70, WORLD_W - 70), y: 42 };
  return null;
}

function startGrapple(w: World, f: Fighter, opp: Fighter) {
  if (f.grappleCd > 0 || !f.alive) return;
  if (f.phase === "stun" || f.phase === "downed" || f.phase === "bow" || f.phase === "rise") return;
  let point = findTether(f, f.aimX, f.aimY, !f.aimOk || f.isAI, opp);
  if (!point) point = findTether(f, f.aimX, f.aimY, true, opp);
  if (!point) {
    say(w, f, "no purchase");
    f.grappleCd = 0.25;
    return;
  }
  cancelAttack(f);
  f.tether = point;
  f.phase = "grapple";
  f.phaseT = 0;
  f.phaseDur = 0.9;
  f.grappleCd = 0.28;
  f.onGround = false;
  const dx = point.x - f.x;
  const dy = point.y - (f.y - FH * 0.62);
  const mag = Math.hypot(dx, dy) || 1;
  f.vx += (dx / mag) * 440;
  f.vy += (dy / mag) * 440;
  shock(w, f.x, f.y - 40, f.pal.glow, 40);
  burst(w, point.x, point.y, "#ffffff", 10, 200, "spark");
  say(w, f, "WEB PULL!", true);
  sfx(w, "web");
}

function releaseGrapple(f: Fighter) {
  f.tether = null;
  if (f.phase === "grapple") enterFree(f);
}

function tryKnife(w: World, f: Fighter, opp: Fighter) {
  if (f.knives <= 0 || f.throwLock > 0) return;
  if (!f.alive || f.phase === "stun" || f.phase === "downed" || f.phase === "bow" || f.phase === "rise") return;
  const h = handOf(f);
  let dx: number;
  let dy: number;
  if (f.aimOk && !f.isAI) {
    dx = f.aimX - h.x;
    dy = f.aimY - h.y;
  } else {
    dx = opp.x - h.x + opp.vx * 0.18;
    dy = opp.y - FH * 0.55 - h.y;
  }
  const mag = Math.hypot(dx, dy) || 1;
  const speed = 980;
  const knife: Knife = {
    x: h.x + (dx / mag) * 20,
    y: h.y + (dy / mag) * 10,
    vx: (dx / mag) * speed + f.vx * 0.2,
    vy: (dy / mag) * speed + f.vy * 0.08,
    spin: Math.random() * 6,
    stuck: false,
    owner: f.id,
    grace: 0.12,
    life: 3.2,
    dmg: 8,
  };
  w.knives.push(knife);
  f.knives--;
  f.throwLock = 0.38;
  f.throwAnim = 0.22;
  if (f.regenT <= 0) f.regenT = 6.4;
  say(w, f, "knife");
  sfx(w, "throw");
}

function incoming(opp: Fighter, f: Fighter) {
  if (!opp.attack || opp.stage === "none" || opp.stage === "recover") {
    return { imminent: false, early: false };
  }
  const dist = Math.abs(opp.x - f.x);
  const reach = (opp.attack.reach || 80) + 48;
  if (dist > reach) return { imminent: false, early: false };
  if (Math.abs(opp.y - f.y) > 90) return { imminent: false, early: false };
  const inFront = (f.x - opp.x) * opp.facing > -16;
  if (!inFront) return { imminent: false, early: false };
  if (opp.stage === "active") return { imminent: true, early: false };
  const eta = opp.attack.windup - opp.phaseT;
  if (eta < 0.11) return { imminent: true, early: false };
  return { imminent: false, early: true };
}

function tryResolve(w: World, f: Fighter, opp: Fighter, e: GameEvent) {
  if (e.kind === "knife") {
    tryKnife(w, f, opp);
    return;
  }
  if (e.kind === "grapple") {
    if (f.phase === "launch" || canAccept(f, "grapple")) startGrapple(w, f, opp);
    else buffer(f, e);
    return;
  }

  const defense = e.kind === "swipe";
  const attack = e.kind === "tap" || e.kind === "double";
  const kind = attack ? "attack" : defense ? "defense" : "any";
  if (!canAccept(f, kind === "attack" ? "attack" : "defense")) {
    if (f.phase === "launch" && e.kind === "swipe") buffer(f, e);
    else if (f.phase !== "stun" && f.phase !== "downed") buffer(f, e);
    return;
  }

  if (f.phase === "grapple") {
    const keep = f.vx;
    const keepY = f.vy;
    releaseGrapple(f);
    f.vx = keep;
    f.vy = keepY;
    if (e.kind === "swipe") {
      const mag = Math.hypot(e.dx, e.dy) || 1;
      f.vx += (e.dx / mag) * 220;
      f.vy += (e.dy / mag) * 160;
    }
  }

  if (f.riposte > 0 && (e.kind === "tap" || e.kind === "double")) {
    f.shieldHeld = false;
    f.autoShield = 0;
    f.comboCount = 0;
    beginAttack(w, f, opp, "riposte");
    return;
  }

  if (e.kind === "tap" || e.kind === "double") {
    const gap = Math.abs(opp.x - f.x);
    if (!f.onGround) {
      beginAttack(w, f, opp, "aerial");
      return;
    }
    if (shielding(f) && gap < 156) {
      beginAttack(w, f, opp, "bash");
      return;
    }
    if (e.kind === "double") {
      f.comboCount = 0;
      beginAttack(w, f, opp, gap > 160 ? "lunge" : "thrust");
      return;
    }

    // 3-hit fluid attack combo on tap!
    const step = f.comboCount % 3;
    f.comboTimer = 0.58;
    f.comboCount = step + 1;

    if (step === 0) {
      beginAttack(w, f, opp, gap > 180 ? "lunge" : "cut");
    } else if (step === 1) {
      beginAttack(w, f, opp, "uppercut");
    } else {
      beginAttack(w, f, opp, "finisher");
      f.comboCount = 0;
    }
    return;
  }

  const dx = e.dx;
  const dy = e.dy;
  const mag = Math.hypot(dx, dy) || 1;
  const nx = dx / mag;
  const ny = dy / mag;
  const toOpp = faceOf(opp.x - f.x, f.facing);
  const toward = nx * toOpp;
  const dist = Math.abs(opp.x - f.x);
  const up = ny < -0.4;
  const down = ny > 0.4;
  const close = dist < 148;
  const mid = dist < 290;
  const air = !f.onGround;
  const threat = incoming(opp, f);

  if (f.wallDir && nx * f.wallDir > 0.38 && !down && Math.abs(nx) > 0.32 && f.phase !== "vault") {
    startVault(w, f, opp);
    return;
  }

  if (!air && toward < -0.22 && threat.imminent && Math.abs(ny) < 0.8) {
    startParryPose(w, f);
    return;
  }

  if (air) {
    if (down && toward > 0.05) {
      f.vy = Math.max(f.vy, 780);
      beginAttack(w, f, opp, "aerial");
      return;
    }
    if (toward > 0.18 && !down) {
      beginAttack(w, f, opp, "aerial");
      return;
    }
    if (up && toward > 0.2) {
      beginAttack(w, f, opp, "aerial");
      return;
    }
    if (down) {
      f.vy = Math.max(f.vy, 860);
      say(w, f, "drop");
      return;
    }
    if (up && f.airDash > 0) {
      f.airDash--;
      f.vy = -720;
      f.vx += nx * 160;
      say(w, f, "rise");
      sfx(w, "whoosh");
      return;
    }
    f.vx = nx * 480;
    f.vy = Math.min(f.vy, -180);
    f.iFrames = Math.max(f.iFrames, 0.08);
    say(w, f, "evasion");
    return;
  }

  if (up && toward > 0.22) {
    startLeap(w, f, opp);
    return;
  }
  if (up && toward < -0.22) {
    if (f.wallDir && f.wallDir !== toOpp) startVault(w, f, opp);
    else startBackflip(w, f, opp);
    return;
  }
  if (up && close) {
    startJumpOver(w, f, opp);
    return;
  }
  if (up) {
    startJump(w, f);
    return;
  }
  if (down && toward > 0.12) {
    startRoll(w, f, toOpp);
    return;
  }
  if (down && toward < -0.12) {
    startSlide(w, f, faceOf(-toOpp, -f.facing));
    return;
  }
  if (down) {
    if (f.onGround && f.oneWay) {
      f.dropTimer = 0.22;
      f.onGround = false;
      f.y += 4;
      say(w, f, "drop");
      return;
    }
    f.autoShield = Math.max(f.autoShield, 0.28);
    f.parryWindow = Math.max(f.parryWindow, 0.1);
    if (f.phase === "free") f.phase = "block";
    say(w, f, "brace");
    return;
  }
  if (toward > 0.18) {
    if (shielding(f) && close) {
      beginAttack(w, f, opp, "bash");
      return;
    }
    if (close) {
      beginAttack(w, f, opp, "cut");
      return;
    }
    if (mid) {
      beginAttack(w, f, opp, "lunge");
      return;
    }
    startDash(w, f, toOpp);
    return;
  }
  if (f.wallDir && f.wallDir !== toOpp) {
    startVault(w, f, opp);
    return;
  }
  startEvade(w, f, opp);
}

function buffer(f: Fighter, e: GameEvent) {
  f.buffered = e;
  f.bufferT = 0.16;
}

function computeStage(f: Fighter) {
  if (!f.attack || !ATTACK_PHASES.has(f.phase)) {
    f.stage = "none";
    f.glint = false;
    return;
  }
  const a = f.attack;
  if (f.phaseT < a.windup) {
    f.stage = "windup";
    f.glint = a.windup - f.phaseT < 0.14;
  } else if (f.phaseT < a.windup + a.active) {
    f.stage = "active";
    f.glint = false;
  } else {
    f.stage = "recover";
    f.glint = false;
  }
}

function updateBlade(f: Fighter, dt: number) {
  computeStage(f);
  if (f.attack && ATTACK_PHASES.has(f.phase)) {
    const a = f.attack;
    if (a.extend) {
      const u =
        f.stage === "windup"
          ? f.phaseT / a.windup
          : f.stage === "active"
            ? 1
            : 1 - (f.phaseT - a.windup - a.active) / Math.max(0.05, a.recover);
      f.bladeLocal = lerp(f.bladeLocal, 0.08, 0.45);
      f.bladeLen = 40 + a.reach * clamp(u, 0, 1);
    } else if (f.stage === "windup") {
      const u = smooth(clamp(f.phaseT / a.windup, 0, 1));
      f.bladeLocal = lerp(0.45, a.a0, u);
      f.bladeLen = a.reach * 0.92;
    } else if (f.stage === "active") {
      const u = smooth(clamp((f.phaseT - a.windup) / a.active, 0, 1));
      f.bladeLocal = lerp(a.a0, a.a1, u);
      f.bladeLen = a.reach;
    } else {
      const u = clamp((f.phaseT - a.windup - a.active) / Math.max(0.05, a.recover), 0, 1);
      f.bladeLocal = lerp(a.a1, 0.55, u);
      f.bladeLen = lerp(a.reach, 78, u);
    }
  } else if (f.phase === "bow") {
    f.bladeLocal = lerp(f.bladeLocal, -1.05, 0.08);
    f.bladeLen = lerp(f.bladeLen, 74, 0.1);
  } else if (f.phase === "block") {
    f.bladeLocal = lerp(f.bladeLocal, 1.15, 0.2);
    f.bladeLen = lerp(f.bladeLen, 70, 0.2);
  } else if (f.throwAnim > 0) {
    f.bladeLocal = lerp(f.bladeLocal, 0.9, 0.2);
  } else {
    const k = 1 - Math.pow(0.004, dt);
    f.bladeLocal = lerp(f.bladeLocal, 0.62, k);
    f.bladeLen = lerp(f.bladeLen, 78, k);
  }
  if (f.stage === "active" || f.phase === "vault" || Math.abs(f.vx) > 520) {
    const seg = bladeSegment(f);
    f.trail.push({ x: seg.x2, y: seg.y2, a: 1 });
  }
  for (const p of f.trail) p.a -= dt * 3.2;
  if (f.trail.length > 10) f.trail.splice(0, f.trail.length - 10);
  f.trail = f.trail.filter((p) => p.a > 0);
}

function locomotion(f: Fighter, dt: number) {
  if (f.phase === "roll") {
    f.vx = f.rollDir * 560;
    return;
  }
  if (f.phase === "slide") {
    f.vx = f.rollDir * 400;
    return;
  }
  if (f.phase === "dash") {
    f.vx = f.rollDir * 660;
    return;
  }
  if (f.phase === "lunge" && (f.stage === "windup" || f.stage === "active")) {
    f.vx = f.facing * (f.attack?.dash ?? 600);
    return;
  }
  if (f.phase === "vault" && f.phaseT < 0.42) return;
  if (f.phase === "evade" && f.phaseT < 0.22) return;
  if (f.phase === "flip" && f.phaseT < 0.35) return;
  if (f.phase === "bash" && f.stage !== "recover") {
    f.vx = lerp(f.vx, f.facing * 200, 0.2);
    return;
  }
  if (f.phase === "stun" || f.phase === "downed" || f.phase === "bow") {
    f.vx *= Math.pow(0.04, dt);
    return;
  }
  if (f.phase === "grapple") return;

  const attacking = ATTACK_PHASES.has(f.phase) && f.stage !== "recover";
  const accel = (f.onGround ? 3800 : 2400) * (attacking ? 0.35 : 1) * (f.phase === "block" ? 0.5 : 1);
  const target = clamp(f.moveX, -1, 1) * 380 * (f.phase === "block" ? 0.45 : 1);
  if (Math.abs(f.moveX) > 0.04 && !attacking) {
    // Immediate crisp turnaround when reversing direction
    if (f.onGround && Math.sign(target) !== Math.sign(f.vx) && Math.abs(f.vx) > 80) {
      f.vx *= Math.pow(0.0001, dt);
    }
    const d = target - f.vx;
    const step = clamp(d, -accel * dt, accel * dt);
    f.vx += step;
  } else if (f.onGround) {
    const fr = 3400 * dt;
    if (Math.abs(f.vx) < fr) f.vx = 0;
    else f.vx -= Math.sign(f.vx) * fr;
  }
  if (f.attack && f.attack.dash && f.stage === "active" && f.phase !== "lunge") {
    f.vx += f.facing * f.attack.dash * dt * 2.2;
  }
}

function sideHits(f: Fighter, r: { x: number; y: number; w: number; h: number }) {
  if (f.y <= r.y + 8) return false;
  if (f.y - FH >= r.y + r.h) return false;
  return f.x + HW > r.x && f.x - HW < r.x + r.w;
}

function physics(w: World, f: Fighter, opp: Fighter, dt: number) {
  f.prevVy = f.vy;
  f.wasGround = f.onGround;
  if (f.tether && f.phase === "grapple") {
    const ox = f.x;
    const oy = f.y - FH * 0.62;
    const dx = f.tether.x - ox;
    const dy = f.tether.y - oy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const stretch = Math.max(0, dist - 26);
    const pull = Math.min(4600, 700 + stretch * 12);
    f.vx += nx * pull * dt;
    f.vy += ny * pull * dt;
    const radial = f.vx * nx + f.vy * ny;
    f.vx -= radial * nx * 1.8 * dt;
    f.vy -= radial * ny * 1.8 * dt;
    f.vy += GRAV * 0.45 * dt;
  } else if (f.phase !== "bow") {
    f.vy += GRAV * dt;
  }
  if (f.vy > 1280) f.vy = 1280;

  locomotion(f, dt);

  f.wallDir = 0;
  f.x += f.vx * dt;
  if (f.x < HW + 8) {
    f.x = HW + 8;
    if (f.vx < 0) f.vx = 0;
    f.wallDir = -1;
  }
  if (f.x > WORLD_W - HW - 8) {
    f.x = WORLD_W - HW - 8;
    if (f.vx > 0) f.vx = 0;
    f.wallDir = 1;
  }
  for (const r of SOLIDS) {
    if (r.id.startsWith("wall")) continue;
    if (!sideHits(f, r)) continue;
    const prev = f.x - f.vx * dt;
    if (prev + HW <= r.x + 1) {
      f.x = r.x - HW;
      if (f.vx > 0) f.vx = 0;
      f.wallDir = 1;
    } else if (prev - HW >= r.x + r.w - 1) {
      f.x = r.x + r.w + HW;
      if (f.vx < 0) f.vx = 0;
      f.wallDir = -1;
    }
  }

  if ((f.phase === "launch" || f.phase === "stun") && f.wallDir && f.buffered && f.buffered.kind === "swipe") {
    const nx = f.buffered.dx;
    if (nx * f.wallDir > 0.2 || Math.abs(nx) < 0.2) {
      f.buffered = null;
      startVault(w, f, opp);
    }
  } else if ((f.phase === "launch" || f.phase === "stun") && f.wallDir && Math.abs(f.vx) > 180) {
    burst(w, f.x + f.wallDir * 16, f.y - 40, "#efe6d6", 8, 160, "spark");
    f.vx *= -0.42;
    f.vy = Math.min(f.vy, -180);
    w.shake = Math.max(w.shake, 5);
    sfx(w, "block");
  }

  f.y += f.vy * dt;
  const prevY = f.y - f.vy * dt;
  f.onGround = false;
  f.oneWay = false;
  if (f.vy >= 0 && f.dropTimer <= 0) {
    let land: { y: number; oneWay: boolean } | null = null;
    for (const s of SURFACES) {
      if (f.x < s.x - HW + 8 || f.x > s.x + s.w + HW - 8) continue;
      if (s.oneWay && f.dropTimer > 0) continue;
      if (prevY <= s.y + 1 && f.y >= s.y) {
        if (!land || s.y < land.y) land = { y: s.y, oneWay: s.oneWay };
      }
    }
    if (land) {
      f.y = land.y;
      f.vy = 0;
      f.onGround = true;
      f.oneWay = land.oneWay;
    }
  }
  if (f.y > FLOOR_Y + 2 && f.x > 48 && f.x < WORLD_W - 48) {
    f.y = FLOOR_Y;
    f.vy = 0;
    f.onGround = true;
  }

  if (!f.wasGround && f.onGround) {
    f.squash = clamp(Math.abs(f.prevVy) / 1400, 0.08, 0.4);
    if (Math.abs(f.prevVy) > 280) {
      burst(w, f.x, f.y, "#cfc3ae", 7, 90, "dust");
      sfx(w, "land");
    }
    if (f.phase === "launch") {
      if (f.health <= 0) {
        f.phase = "downed";
        f.phaseT = 0;
        f.phaseDur = 2.2;
        f.vx *= 0.2;
      } else if (f.buffered && (f.buffered.kind === "swipe" || f.buffered.kind === "tap" || f.buffered.kind === "double") && f.stamina >= 8) {
        const dir =
          f.buffered.kind === "swipe"
            ? faceOf(f.buffered.dx, faceOf(f.x - opp.x, -f.facing))
            : faceOf(f.x - opp.x, -f.facing);
        f.buffered = null;
        startRoll(w, f, dir);
        say(w, f, "tech", true);
      } else {
        f.phase = "downed";
        f.phaseT = 0;
        f.phaseDur = 0.48;
        f.vx *= 0.3;
      }
    }
  }

  if (f.onGround) {
    f.coyote = 0.1;
    f.airDash = 1;
    if (Math.abs(f.vx) > 30 && f.phase === "free") f.gait += dt * Math.abs(f.vx) * 0.045;
  } else {
    f.coyote = Math.max(0, f.coyote - dt);
  }

  if (f.phase === "launch" && f.buffered?.kind === "grapple") {
    const ev = f.buffered;
    f.buffered = null;
    tryResolve(w, f, opp, ev);
  }
}

function nearWall(f: Fighter) {
  f.wallDir = 0;
  if (f.x < 48 + HW + 42) f.wallDir = -1;
  if (f.x > WORLD_W - 48 - HW - 42) f.wallDir = 1;
  for (const r of SOLIDS) {
    if (r.id.startsWith("wall")) continue;
    const mid = r.x + r.w / 2;
    if (f.y > r.y + 10 && f.y - FH < r.y + r.h) {
      if (f.x < r.x && r.x - (f.x + HW) < 28) f.wallDir = 1;
      if (f.x > r.x + r.w && f.x - HW - (r.x + r.w) < 28) f.wallDir = -1;
      if (Math.abs(f.x - mid) < r.w / 2 + HW + 22 && f.y > r.y + 16) {
        f.wallDir = f.x < mid ? 1 : -1;
      }
    }
  }
}

function stepPhase(w: World, f: Fighter, opp: Fighter, dt: number) {
  f.phaseT += dt;
  f.parryWindow = Math.max(0, f.parryWindow - dt);
  f.riposte = Math.max(0, f.riposte - dt);
  f.iFrames = Math.max(0, f.iFrames - dt);
  f.autoShield = Math.max(0, f.autoShield - dt);
  f.dropTimer = Math.max(0, f.dropTimer - dt);
  f.throwLock = Math.max(0, f.throwLock - dt);
  f.throwAnim = Math.max(0, f.throwAnim - dt);
  f.grappleCd = Math.max(0, f.grappleCd - dt);
  f.techWindow = Math.max(0, f.techWindow - dt);
  f.hitFlash = Math.max(0, f.hitFlash - dt);
  f.phraseT = Math.max(0, f.phraseT - dt);
  f.feint = Math.max(0, f.feint - dt);
  f.squash = lerp(f.squash, 0, 1 - Math.pow(0.0015, dt));
  if (f.comboTimer > 0) {
    f.comboTimer -= dt;
    if (f.comboTimer <= 0) f.comboCount = 0;
  }
  if (f.bufferT > 0) {
    f.bufferT -= dt;
    if (f.bufferT <= 0) f.buffered = null;
  }

  if (f.phase === "bow") {
    if (f.phaseT > 1.35) enterFree(f);
  } else if (ATTACK_PHASES.has(f.phase) && f.phaseT >= f.phaseDur) {
    enterFree(f);
  } else if (
    (f.phase === "roll" ||
      f.phase === "evade" ||
      f.phase === "flip" ||
      f.phase === "vault" ||
      f.phase === "slide" ||
      f.phase === "dash") &&
    f.phaseT >= f.phaseDur
  ) {
    enterFree(f);
  } else if (f.phase === "stun" && f.phaseT >= f.phaseDur) {
    enterFree(f);
  } else if (f.phase === "downed" && f.phaseT >= f.phaseDur && f.alive) {
    f.phase = "rise";
    f.phaseT = 0;
    f.phaseDur = 0.32;
  } else if (f.phase === "rise" && f.phaseT >= f.phaseDur) {
    enterFree(f);
  } else if (f.phase === "grapple") {
    if (!f.tether || f.phaseT >= f.phaseDur) releaseGrapple(f);
  } else if (f.phase === "launch" && f.phaseT > 1.3 && f.onGround && f.alive) {
    f.phase = "downed";
    f.phaseT = 0;
    f.phaseDur = 0.4;
  }

  const wantShield = shielding(f);
  if (wantShield && f.alive && (f.phase === "free" || f.phase === "block")) {
    if (f.phase !== "block") {
      f.phase = "block";
      f.phaseT = 0;
      f.parryWindow = 0.12;
      f.attack = null;
      f.stage = "none";
      if (!f.braceSaid) {
        say(w, f, "brace");
        f.braceSaid = true;
      }
    }
  } else if (f.phase === "block" && !wantShield && f.parryWindow <= 0) {
    enterFree(f);
    f.braceSaid = false;
  }
  if (!wantShield) f.braceSaid = false;

  const targetShield = f.phase === "block" || wantShield ? 1 : f.phase === "bash" ? 0.8 : 0.08;
  f.shield = lerp(f.shield, targetShield, 1 - Math.pow(0.002, dt));

  if (f.buffered && canAccept(f, f.buffered.kind === "tap" || f.buffered.kind === "double" ? "attack" : "defense")) {
    const ev = f.buffered;
    f.buffered = null;
    tryResolve(w, f, opp, ev);
  }

  if (!ATTACK_PHASES.has(f.phase) && f.phase !== "stun" && f.phase !== "launch" && f.phase !== "roll") {
    if (Math.abs(opp.x - f.x) > 18 && (f.phase === "free" || f.phase === "block" || f.phase === "grapple")) {
      f.facing = faceOf(opp.x - f.x, f.facing);
    }
  }

  updateBlade(f, dt);

  if (Math.hypot(f.vx, f.vy) > 560 || f.phase === "vault" || f.phase === "roll" || f.phase === "dash") {
    f.ghostT -= dt;
    if (f.ghostT <= 0) {
      f.ghostT = 0.045;
      w.ghosts.push({
        x: f.x,
        y: f.y,
        life: 0.22,
        color: f.pal.glow,
        facing: f.facing,
      });
    }
  }

  if (f.knives < 3) {
    if (f.regenT <= 0) f.regenT = 6.4;
    f.regenT -= dt;
    if (f.regenT <= 0) {
      f.knives++;
      f.regenT = f.knives < 3 ? 6.4 : 0;
    }
  }
  const regenRate = f.phase === "block" ? 12 : f.phase === "free" || f.phase === "dash" ? 30 : 8;
  if (f.stamDelay > 0) f.stamDelay -= dt;
  const rate = f.stamDelay > 0 ? 6 : regenRate;
  f.stamina = clamp(f.stamina + rate * dt, 0, 100);
  if (f.healthLag > f.health) f.healthLag = Math.max(f.health, f.healthLag - dt * 22);
  else f.healthLag = f.health;

  if (f.isAI && f.onGround && Math.abs(f.moveX) > 0.45 && Math.abs(f.vx) < 24 && f.phase === "free") {
    f.stuckT += dt;
    if (f.stuckT > 0.18) {
      f.vy = -980;
      f.onGround = false;
      f.stuckT = 0;
    }
  } else f.stuckT = 0;
}

function distPointSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  const x = x1 + dx * t;
  const y = y1 + dy * t;
  return { d: Math.hypot(px - x, py - y), x, y };
}

function segHits(f: Fighter, seg: { x1: number; y1: number; x2: number; y2: number }) {
  const chest = distPointSeg(f.x, f.y - FH * 0.58, seg.x1, seg.y1, seg.x2, seg.y2);
  const head = distPointSeg(f.x + f.facing * 2, f.y - FH * 0.86, seg.x1, seg.y1, seg.x2, seg.y2);
  const r = f.phase === "slide" || f.phase === "roll" ? 22 : 28;
  if (chest.d < r) return chest;
  if (head.d < 16) return head;
  return null;
}

function segmentsIntersect(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
) {
  const d = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d1 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d2 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const d3 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d4 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function doClash(w: World, a: Fighter, b: Fighter) {
  const push = (f: Fighter, other: Fighter) => {
    if (f.attack) f.phaseT = f.attack.windup + f.attack.active;
    f.hitThisSwing = true;
    f.vx = faceOf(f.x - other.x, f.facing) * 260;
    f.vy = Math.min(f.vy, -120);
    f.stamina = Math.max(0, f.stamina - 6);
  };
  push(a, b);
  push(b, a);
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2 - 60;
  burst(w, x, y, "#ffffff", 24, 380, "spark");
  burst(w, x, y, "#ffe7b0", 14, 240, "spark");
  shock(w, x, y, "#ffffff", 65);
  addSlash(w, x - 40, y - 30, x + 40, y + 30, "#ffffff", 4, 0.12);
  addSlash(w, x - 40, y + 30, x + 40, y - 30, "#ffe7b0", 4, 0.12);
  w.hitstop = Math.max(w.hitstop, 0.09);
  w.shake = Math.max(w.shake, 12);
  w.punch = Math.max(w.punch, 0.06);
  w.flash = Math.max(w.flash, 0.18);
  w.flashColor = "#fff1cc";
  say(w, a, "CLASH!", true);
  sfx(w, "clash");
}

function doParry(w: World, def: Fighter, atk: Fighter, x: number, y: number) {
  atk.phase = "stun";
  atk.phaseT = 0;
  atk.phaseDur = 0.65;
  atk.attack = null;
  atk.stage = "none";
  atk.hitThisSwing = true;
  atk.vx = faceOf(atk.x - def.x, -def.facing) * 340;
  atk.vy = -120;
  atk.stamina = Math.max(0, atk.stamina - 18);
  atk.tether = null;

  def.phase = "free";
  def.attack = null;
  def.stage = "none";
  def.parryWindow = 0;
  def.riposte = 0.95;
  def.autoShield = 0;
  def.vx = faceOf(def.x - atk.x, def.facing) * 90;
  def.hitFlash = 0.14;

  // Ultra Juicy Parry Feedback!
  w.hitstop = Math.max(w.hitstop, 0.16); // freeze frame
  w.shake = Math.max(w.shake, 18);
  w.punch = Math.max(w.punch, 0.095);
  w.flash = 0.35;
  w.flashColor = "#ffffff";

  burst(w, x, y, "#ffffff", 34, 480, "spark");
  burst(w, x, y, def.pal.glow, 20, 320, "spark");
  shock(w, x, y, "#ffffff", 95);
  shock(w, x, y, def.pal.glow, 60);

  addSlash(w, x - 54, y - 48, x + 54, y + 48, "#ffffff", 5, 0.2);
  addSlash(w, x - 54, y + 48, x + 54, y - 48, def.pal.glow, 4, 0.2);

  say(w, def, "PARRY!", true);
  sfx(w, "parry");
  w.lessons++;
}

function doBlock(w: World, def: Fighter, atk: Fighter, x: number, y: number) {
  def.health = Math.max(0, def.health - 2);
  def.stamina = Math.max(0, def.stamina - 18);
  def.vx = faceOf(def.x - atk.x, def.facing) * 110;
  def.hitFlash = 0.08;
  if (atk.attack) atk.phaseT = Math.max(atk.phaseT, atk.attack.windup + atk.attack.active);
  atk.vx = faceOf(atk.x - def.x, -atk.facing) * 180;
  atk.hitThisSwing = true;
  burst(w, x, y, def.pal.metal, 12, 220, "spark");
  shock(w, x, y, def.pal.metal, 35);
  w.hitstop = Math.max(w.hitstop, 0.045);
  w.shake = Math.max(w.shake, 5);
  sfx(w, "block");
  showDamage(w, def.x, def.y - 60, 2, false, "#aaaaaa");
  if (def.health <= 0) endExchange(w, atk, def);
}

function doGuardBreak(w: World, def: Fighter, atk: Fighter, x: number, y: number) {
  def.stamina = 0;
  def.shield = 0;
  def.autoShield = 0;
  def.shieldHeld = false;
  def.phase = "stun";
  def.phaseT = 0;
  def.phaseDur = 0.6;
  def.attack = null;
  def.vx = faceOf(def.x - atk.x, -atk.facing) * 540;
  def.vy = -240;
  const dmg = atk.attack?.dmg ?? 12;
  def.health = Math.max(0, def.health - dmg);
  def.hitFlash = 0.22;
  atk.hitThisSwing = true;

  w.hitstop = 0.14;
  w.shake = 16;
  w.punch = 0.08;
  w.flash = 0.26;
  w.flashColor = "#ffaa44";

  burst(w, x, y, "#ffffff", 28, 420, "spark");
  burst(w, x, y, "#ff9933", 18, 280, "spark");
  shock(w, x, y, "#ffffff", 85);
  addSlash(w, x - 50, y - 30, x + 50, y + 30, "#ffaa44", 6, 0.18);

  say(w, def, "GUARD BREAK!", true);
  sfx(w, "shatter");
  showDamage(w, def.x, def.y - 60, dmg, true, "#ff6644");
  if (def.health <= 0) endExchange(w, atk, def);
}

function doHit(w: World, def: Fighter, atk: Fighter, x: number, y: number) {
  const at = atk.attack;
  if (!at) return;
  const isFinisher = atk.phase === "finisher" || atk.phase === "riposte";
  const isHeavy = at.dmg >= 14 || isFinisher;
  let dmg = at.dmg;
  if (isFinisher) dmg = Math.round(dmg * 1.2);

  def.health = Math.max(0, def.health - dmg);
  def.hitFlash = isHeavy ? 0.22 : 0.16;
  def.stamina = Math.max(0, def.stamina - 10);
  def.tether = null;
  def.riposte = 0;
  def.attack = null;
  def.stage = "none";

  const dir = faceOf(def.x - atk.x, atk.facing);
  const kb = at.kb + Math.abs(atk.vx) * 0.22;
  def.vx = dir * kb;
  def.vy = at.pop + (atk.phase === "aerial" ? Math.min(80, atk.vy * 0.2) : 0);
  atk.hitThisSwing = true;

  // Angled slash cutline through impact point
  const angle = Math.atan2(at.pop, dir * kb) + (Math.random() - 0.5) * 0.35;
  const cutLen = isHeavy ? 80 : 54;
  addSlash(
    w,
    x - Math.cos(angle) * cutLen,
    y - Math.sin(angle) * cutLen,
    x + Math.cos(angle) * cutLen,
    y + Math.sin(angle) * cutLen,
    "#ffffff",
    isHeavy ? 5.5 : 3.5,
    isHeavy ? 0.18 : 0.12
  );

  // Sparks & Shockwaves
  burst(w, x, y, "#ffffff", isHeavy ? 26 : 15, isHeavy ? 420 : 260, "spark");
  burst(w, x, y, atk.pal.glow, isHeavy ? 16 : 8, 220, "spark");
  shock(w, x, y, isHeavy ? "#ffdd88" : atk.pal.glow, isHeavy ? 68 : 42);

  // Hitstop, Shake & Audio
  w.hitstop = Math.max(w.hitstop, isFinisher ? 0.16 : isHeavy ? 0.11 : 0.07);
  w.shake = Math.max(w.shake, isFinisher ? 18 : isHeavy ? 13 : 8);
  w.punch = Math.max(w.punch, isHeavy ? 0.07 : 0.045);

  if (isHeavy) {
    w.flash = 0.18;
    w.flashColor = atk.pal.glow;
    sfx(w, "heavyhit");
  } else {
    sfx(w, "hit");
  }

  showDamage(w, def.x, def.y - 60, dmg, isHeavy, atk.pal.glow);

  if (def.health <= 0) {
    endExchange(w, atk, def);
    return;
  }
  if (kb > 520 || !def.onGround || atk.phase === "thrust" || atk.phase === "bash" || isFinisher) {
    def.phase = "launch";
    def.phaseT = 0;
    def.phaseDur = 0.85;
    def.techWindow = 0.35;
    def.iFrames = 0.08;
  } else {
    def.phase = "stun";
    def.phaseT = 0;
    def.phaseDur = at.stun;
  }
}

function stoneSpark(w: World, f: Fighter) {
  if (f.stage !== "active") return;
  const seg = bladeSegment(f);
  for (const r of SOLIDS) {
    if (seg.x2 > r.x && seg.x2 < r.x + r.w && seg.y2 > r.y && seg.y2 < r.y + r.h) {
      burst(w, seg.x2, seg.y2, "#efe6d4", 6, 140, "spark");
      if (f.attack) f.phaseT = Math.max(f.phaseT, f.attack.windup + f.attack.active * 0.7);
      f.vx -= f.facing * 40;
      sfx(w, "block");
      return;
    }
  }
}

function combat(w: World) {
  const a = w.player;
  const b = w.rival;
  if (
    a.stage === "active" &&
    b.stage === "active" &&
    a.attack &&
    b.attack &&
    !a.attack.guardBreak &&
    !b.attack.guardBreak &&
    a.phase !== "bash" &&
    b.phase !== "bash"
  ) {
    if (segmentsIntersect(bladeSegment(a), bladeSegment(b))) {
      doClash(w, a, b);
      return;
    }
  }
  resolveHit(w, a, b);
  resolveHit(w, b, a);
  stoneSpark(w, a);
  stoneSpark(w, b);
}

function resolveHit(w: World, atk: Fighter, def: Fighter) {
  if (atk.stage !== "active" || !atk.attack || atk.hitThisSwing || !def.alive) return;
  if (def.iFrames > 0 || def.phase === "downed" || def.phase === "bow") return;
  const bash = atk.phase === "bash";
  let x = def.x;
  let y = def.y - 50;
  let hit = false;
  if (bash) {
    const bx = atk.x + atk.facing * 46;
    const by = atk.y - FH * 0.55;
    hit = Math.hypot(def.x - bx, def.y - FH * 0.5 - by) < 58 && Math.abs(def.y - atk.y) < 78;
    x = bx;
    y = by;
  } else {
    const seg = bladeSegment(atk);
    const got = segHits(def, seg);
    if (got) {
      hit = true;
      x = got.x;
      y = got.y;
    }
  }
  if (!hit) return;
  const inFront = (def.x - atk.x) * atk.facing > -12;
  const overhead = !atk.onGround && atk.y < def.y - 46 && def.onGround;
  if (def.parryWindow > 0 && inFront && !bash && def.phase !== "launch") {
    doParry(w, def, atk, x, y);
    return;
  }
  const blocking = (def.phase === "block" || def.shield > 0.72) && inFront && !overhead && def.phase !== "stun" && def.phase !== "launch";
  if (blocking) {
    if (bash || atk.attack.guardBreak || def.stamina <= 8) doGuardBreak(w, def, atk, x, y);
    else doBlock(w, def, atk, x, y);
    return;
  }
  doHit(w, def, atk, x, y);
}

function updateKnives(w: World, dt: number) {
  for (const k of w.knives) {
    if (k.stuck) {
      k.life -= dt;
      continue;
    }
    k.grace = Math.max(0, k.grace - dt);
    k.life -= dt;
    k.vy += 520 * dt;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    k.spin += dt * 14;
    if (k.x < 52 || k.x > WORLD_W - 52) {
      k.vx *= -0.4;
      k.x = clamp(k.x, 56, WORLD_W - 56);
    }
    for (const s of SURFACES) {
      if (k.x > s.x && k.x < s.x + s.w && k.y >= s.y && k.y - k.vy * dt <= s.y + 8 && k.vy > 0) {
        k.stuck = true;
        k.y = s.y - 2;
        k.vx = 0;
        k.vy = 0;
        k.life = 12;
      }
    }
    if (k.stuck) continue;
    for (const f of [w.player, w.rival]) {
      if (!f.alive || k.grace > 0 && k.owner === f.id) continue;
      if (k.owner === f.id && k.grace > 0) continue;
      const hy = f.y - FH * 0.55;
      if (Math.hypot(k.x - f.x, k.y - hy) < 30 && Math.abs(f.y - k.y) < FH) {
        const inFront = (k.x - f.x) * f.facing > -8 || Math.abs(k.x - f.x) < 16;
        if (f.parryWindow > 0 && inFront) {
          k.vx = -k.vx * 0.85;
          k.vy = -380;
          k.owner = f.id;
          k.grace = 0.12;
          say(w, f, "deflect", true);
          sfx(w, "parry");
          burst(w, k.x, k.y, "#fff", 8, 180, "spark");
          continue;
        }
        if ((f.phase === "block" || f.shield > 0.7) && inFront && f.iFrames <= 0) {
          k.stuck = false;
          k.vx = faceOf(k.x - f.x, f.facing) * 80;
          k.vy = -160;
          k.owner = f.id;
          k.grace = 0.05;
          k.life = 1.2;
          sfx(w, "block");
          burst(w, k.x, k.y, f.pal.metal, 5, 100, "spark");
          continue;
        }
        if (f.iFrames > 0) continue;
        f.health = Math.max(0, f.health - k.dmg);
        f.hitFlash = 0.1;
        f.vx += faceOf(f.x - k.x, f.facing) * 260;
        f.vy = Math.min(f.vy, -120);
        if (f.phase === "free" || f.phase === "block" || f.phase === "dash") {
          f.phase = "stun";
          f.phaseT = 0;
          f.phaseDur = 0.22;
        }
        burst(w, k.x, k.y, "#fff", 8, 160, "spark");
        sfx(w, "hit");
        w.hitstop = Math.max(w.hitstop, 0.03);
        k.life = 0;
        if (f.health <= 0) {
          const winner = f.id === "player" ? w.rival : w.player;
          endExchange(w, winner, f);
        }
      }
    }
  }
  w.knives = w.knives.filter((k) => k.life > 0);
  for (const f of [w.player, w.rival]) {
    if (f.knives >= 3) continue;
    for (let i = w.knives.length - 1; i >= 0; i--) {
      const k = w.knives[i];
      if (!k.stuck) continue;
      if (Math.abs(k.x - f.x) < 30 && Math.abs(k.y - f.y) < 36) {
        f.knives++;
        w.knives.splice(i, 1);
        sfx(w, "tick");
        break;
      }
    }
  }
  for (const p of w.pickups) {
    if (p.respawn > 0) {
      p.respawn -= dt;
      continue;
    }
    for (const f of [w.player, w.rival]) {
      if (f.knives >= 3) continue;
      if (Math.abs(f.x - p.x) < 26 && Math.abs(f.y - p.y) < 40 && f.onGround) {
        f.knives++;
        p.respawn = 9;
        sfx(w, "tick");
      }
    }
  }
}

function separate(a: Fighter, b: Fighter) {
  if (a.iFrames > 0 || b.iFrames > 0) return;
  if (a.phase === "roll" || b.phase === "roll" || a.phase === "vault" || b.phase === "vault") return;
  if (Math.abs(a.y - b.y) > 56) return;
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  const min = 38;
  if (dist < min) {
    const push = (min - dist) / 2 + 0.2;
    const s = dx === 0 ? a.facing : Math.sign(dx);
    a.x -= s * push;
    b.x += s * push;
  }
}

function swipeToward(from: Fighter, toX: number, toY: number): GameEvent {
  return { kind: "swipe", dx: toX - from.x, dy: toY - (from.y - 40) };
}

function aiAct(w: World, f: Fighter, opp: Fighter, ai: AIState, dt: number) {
  if (!f.isAI || !f.alive) return;
  if (f.riposte > 0 && canAccept(f, "attack") && Math.random() < 0.65) {
    tryResolve(w, f, opp, { kind: "tap", dx: 0, dy: 0 });
    ai.cd = 0.35;
    return;
  }
  ai.cd -= dt;
  ai.knifeCd -= dt;
  ai.grappleCd -= dt;
  ai.shieldUntil -= dt;
  if (w.mode !== "fight" && w.mode !== "attract") return;
  f.shieldHeld = ai.shieldUntil > 0;

  const dist = Math.abs(opp.x - f.x);
  const to = faceOf(opp.x - f.x, f.facing);
  const wild = f.personality;
  const fierce = w.intensity === "fierce" ? 0.85 : 1;

  if (f.phase === "launch" && !f.onGround && Math.random() < dt * 1.6) {
    if (f.wallDir && Math.random() < 0.7) startVault(w, f, opp);
    else if (Math.random() < 0.55) startGrapple(w, f, opp);
    else f.buffered = { kind: "swipe", dx: -to, dy: 0.2 };
    return;
  }

  if (ai.mood === "pause") {
    ai.pause -= dt;
    f.moveX = Math.sin(w.time * 1.7 + wild) * 0.35;
    if (ai.pause <= 0) ai.mood = "engage";
    if (incoming(opp, f).imminent && Math.random() < 0.5) ai.mood = "engage";
    else return;
  }

  if (!canAccept(f, "any") && f.phase !== "block") {
    f.moveX = 0;
    return;
  }

  const threat = incoming(opp, f);
  if (threat.imminent && dist < 200 && ai.cd < 0.05) {
    const roll = Math.random();
    if (roll < ai.parryChance) {
      startParryPose(w, f);
      ai.shieldUntil = 0.16 + Math.random() * 0.2;
      ai.cd = 0.28 * fierce;
      return;
    }
    if (roll < ai.parryChance + 0.28) {
      tryResolve(w, f, opp, { kind: "swipe", dx: -to, dy: -0.15 });
      ai.cd = 0.32 * fierce;
      return;
    }
    if (roll < ai.parryChance + 0.5) {
      tryResolve(w, f, opp, { kind: "swipe", dx: to, dy: 0.85 });
      ai.cd = 0.34 * fierce;
      return;
    }
    if (roll < ai.parryChance + 0.68) {
      tryResolve(w, f, opp, { kind: "swipe", dx: 0, dy: -1 });
      ai.cd = 0.3 * fierce;
      return;
    }
  }

  if (ai.cd > 0) {
    if (f.phase === "free") f.moveX = dist > 160 ? to * (0.55 + wild * 0.3) : Math.sin(w.time * 2.2) * 0.25;
    return;
  }

  if (f.wallDir && dist < 320 && Math.random() < 0.08 + wild * 0.08) {
    tryResolve(w, f, opp, { kind: "swipe", dx: f.wallDir, dy: -0.35 });
    ai.cd = 0.45;
    return;
  }

  if (opp.y < f.y - 90 && f.onGround && dist < 460 && Math.random() < 0.5) {
    if (ai.grappleCd <= 0 && Math.random() < 0.6) {
      f.aimOk = false;
      startGrapple(w, f, opp);
      ai.grappleCd = 1.4;
      ai.cd = 0.4;
      return;
    }
    tryResolve(w, f, opp, { kind: "swipe", dx: to * 0.4, dy: -1 });
    ai.cd = 0.35;
    return;
  }

  if (dist > 430) {
    const r = Math.random();
    if (r < 0.16 + wild * 0.12 && f.knives > 0 && ai.knifeCd <= 0) {
      tryKnife(w, f, opp);
      ai.knifeCd = 2.4;
      ai.cd = 0.55;
      return;
    }
    if (r < 0.34 && ai.grappleCd <= 0) {
      f.aimOk = false;
      startGrapple(w, f, opp);
      ai.grappleCd = 1.5;
      ai.cd = 0.45;
      return;
    }
    if (r < 0.48) {
      tryResolve(w, f, opp, swipeToward(f, opp.x, f.y - 20));
      ai.cd = 0.4;
      return;
    }
    f.moveX = to;
    ai.cd = 0.14;
    if (Math.random() < 0.015 + (1 - wild) * 0.02) {
      ai.mood = "pause";
      ai.pause = 0.35 + Math.random() * 0.55;
    }
    return;
  }

  if (dist > 165) {
    const r = Math.random();
    if (r < 0.07 + (1 - wild) * 0.06) {
      ai.mood = "pause";
      ai.pause = 0.28 + Math.random() * 0.55;
      ai.cd = 0.1;
      return;
    }
    if (r < 0.28) {
      tryResolve(w, f, opp, { kind: "swipe", dx: to, dy: 0 });
      ai.cd = 0.48 * fierce;
      return;
    }
    if (r < 0.42) {
      tryResolve(w, f, opp, { kind: "swipe", dx: to * 0.7, dy: -0.75 });
      ai.cd = 0.5 * fierce;
      return;
    }
    if (r < 0.52 && f.knives > 0 && ai.knifeCd <= 0) {
      tryKnife(w, f, opp);
      ai.knifeCd = 2.6;
      ai.cd = 0.5;
      return;
    }
    if (r < 0.64 && ai.grappleCd <= 0 && Math.random() < wild + 0.2) {
      f.aimOk = false;
      startGrapple(w, f, opp);
      ai.grappleCd = 1.6;
      ai.cd = 0.4;
      return;
    }
    if (r < 0.74) {
      tryResolve(w, f, opp, { kind: "swipe", dx: 0.1 * to, dy: -1 });
      ai.cd = 0.36;
      return;
    }
    f.moveX = to * (0.4 + Math.random() * 0.6);
    ai.cd = 0.12;
    return;
  }

  if (f.stamina < 16) {
    tryResolve(w, f, opp, { kind: "swipe", dx: -to, dy: Math.random() < 0.4 ? -0.4 : 0.1 });
    ai.cd = 0.34;
    return;
  }
  const r = Math.random();
  if (r < 0.18) {
    tryResolve(w, f, opp, { kind: "tap", dx: 0, dy: 0 });
    ai.cd = 0.42 * fierce;
    return;
  }
  if (r < 0.3) {
    tryResolve(w, f, opp, { kind: "double", dx: 0, dy: 0 });
    ai.cd = 0.5 * fierce;
    return;
  }
  if (r < 0.44) {
    tryResolve(w, f, opp, { kind: "swipe", dx: to, dy: 0.9 });
    ai.cd = 0.4;
    return;
  }
  if (r < 0.56) {
    tryResolve(w, f, opp, { kind: "swipe", dx: -to, dy: -0.15 });
    ai.cd = 0.32;
    return;
  }
  if (r < 0.66) {
    tryResolve(w, f, opp, { kind: "swipe", dx: to * 0.55, dy: -0.85 });
    ai.cd = 0.4;
    return;
  }
  if (r < 0.76) {
    ai.shieldUntil = 0.35 + Math.random() * 0.35;
    f.shieldHeld = true;
    if (Math.random() < 0.45) {
      tryResolve(w, f, opp, { kind: "swipe", dx: to, dy: 0 });
    }
    ai.cd = 0.36;
    return;
  }
  if (r < 0.86) {
    tryResolve(w, f, opp, { kind: "swipe", dx: 0, dy: -1 });
    ai.cd = 0.34;
    return;
  }
  ai.mood = "pause";
  ai.pause = 0.22 + Math.random() * 0.4;
  ai.cd = 0.1;
}

function updateCoach(w: World, dt: number) {
  w.coachT -= dt;
  if (w.attract) {
    if (w.coachT <= 0) {
      w.coach = "A live duel. Enter when you want the blade.";
      w.coachT = 4;
    }
    return;
  }
  if (w.mode !== "fight") return;
  const f = w.player;
  const opp = w.rival;
  const dist = Math.abs(f.x - opp.x);
  let next = "";
  if (!f.alive) next = "";
  else if (f.phase === "launch") next = "You are in the air. Web, or flick into stone as you meet it.";
  else if (f.phase === "stun") next = "Open. The next landing can be a tech — flick as the feet find stone.";
  else if (f.wallDir && dist < 340) next = "Stone at your shoulder. Flick into it to plant and clear them.";
  else if (!f.onGround) next = "Airborne. Forward is a cut. Away is an escape. Web if the span is wide.";
  else if (opp.glint && dist < 210) next = "Their edge is bright. Brace or flick away on the flash — not before.";
  else if (f.riposte > 0) next = "The blade is yours. One tap. A riposte, not a rush.";
  else if (dist < 140) next = "Close. Cut, bash, roll through, or leave the ground.";
  else if (dist > 420) next = "Far. Lunge, a knife, or a web across the span.";
  else if (opp.phase === "block" && dist < 220) next = "They are a wall. Bash, or come down from above.";
  else if (w.coachT <= 0) {
    next = TIPS[w.tipI % TIPS.length];
    w.tipI++;
    w.coachT = 4.5;
  }
  if (next && next !== w.coach) {
    w.coach = next;
    if (w.coachT <= 0) w.coachT = 2.4;
  }
}

function ambient(w: World, dt: number) {
  if (Math.random() < dt * 10) {
    w.particles.push({
      x: 80 + Math.random() * (WORLD_W - 160),
      y: 200 + Math.random() * 620,
      vx: 8 + Math.random() * 16,
      vy: -12 - Math.random() * 20,
      life: 1.6 + Math.random(),
      max: 2.2,
      size: 1.2,
      color: Math.random() > 0.6 ? "#e4b15a" : "#c9b8ff",
      kind: "ember",
      g: -8,
    });
  }
  for (const p of w.particles) {
    p.life -= dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  w.particles = w.particles.filter((p) => p.life > 0);
  for (const s of w.shocks) s.life -= dt;
  w.shocks = w.shocks.filter((s) => s.life > 0);
  for (const sl of w.slashes) sl.life -= dt;
  w.slashes = w.slashes.filter((sl) => sl.life > 0);
  for (const g of w.ghosts) g.life -= dt;
  w.ghosts = w.ghosts.filter((g) => g.life > 0);
  for (const f of w.floaters) {
    f.life -= dt;
    f.y -= dt * (f.isDmg ? 45 : 28);
  }
  w.floaters = w.floaters.filter((f) => f.life > 0);
  for (const l of w.log) l.life -= dt;
  w.log = w.log.filter((l) => l.life > 0);
  w.shake = Math.max(0, w.shake - dt * 28);
  w.punch = Math.max(0, w.punch - dt * 0.8);
  w.flash = Math.max(0, w.flash - dt * 1.4);
  const wantLetter = w.mode === "ko" ? 1 : 0;
  w.letter = lerp(w.letter, wantLetter, 1 - Math.pow(0.01, dt));
  if (w.messageT > 0) w.messageT -= dt;
}

function applyInput(w: World, input: PlayerInput) {
  const f = w.player;
  if (f.isAI) return;
  f.moveX = input.moveX;
  f.aimX = input.aimX;
  f.aimY = input.aimY;
  f.aimOk = input.aimOk;
  const was = f.shieldHeld;
  f.shieldHeld = input.shield;
  if (input.shield && !was && f.phase === "free") {
    f.parryWindow = 0.12;
  }
  if (w.mode !== "fight" && w.mode !== "intro") return;
  if (w.mode === "intro" && input.events.length) {
    beginFight(w);
    return;
  }
  for (const e of input.events) tryResolve(w, f, w.rival, e);
}

export function updateWorld(w: World, dt: number, input: PlayerInput) {
  w.time += dt;
  const frozen = w.hitstop > 0;
  if (w.hitstop > 0) w.hitstop = Math.max(0, w.hitstop - dt);

  if (w.mode === "intro") {
    w.modeT += dt;
    stepPhase(w, w.player, w.rival, dt);
    stepPhase(w, w.rival, w.player, dt);
    if (w.modeT > 1.55) beginFight(w);
    ambient(w, dt);
    return;
  }

  if (w.mode === "between") {
    w.modeT += dt;
    ambient(w, dt);
    if (w.modeT > 1.7) {
      w.round++;
      w.mode = "intro";
      w.modeT = 0;
      resetRound(w, true);
      w.message = `ROUND ${roman(w.round)}`;
      w.submessage = "again";
      w.messageT = 1.1;
    }
    return;
  }

  if (w.mode === "match") {
    ambient(w, dt);
    return;
  }

  if (w.mode === "ko") {
    w.modeT += dt;
    const sim = frozen ? 0 : dt * w.timeScale;
    if (sim > 0) {
      physics(w, w.player, w.rival, sim);
      physics(w, w.rival, w.player, sim);
      stepPhase(w, w.player, w.rival, sim);
      stepPhase(w, w.rival, w.player, sim);
    }
    ambient(w, dt);
    const hold = w.attract ? 1.35 : 2.15;
    if (w.modeT > hold) {
      if (!w.attract && (w.scoreP >= WINS || w.scoreR >= WINS)) {
        w.mode = "match";
        w.matchWinner = w.scoreP >= WINS ? "player" : "rival";
        w.timeScale = 1;
        w.message = w.matchWinner === "player" ? "THE SPAN IS YOURS" : "VESPER KEEPS THE SPAN";
        w.submessage = w.matchWinner === "player" ? "timing, not a combo" : "again, if you wish";
        w.messageT = 2;
      } else if (w.attract) {
        resetRound(w, false);
        w.player.phase = "free";
        w.rival.phase = "free";
        w.mode = "attract";
        w.modeT = 0;
        w.timeScale = 1;
      } else {
        w.mode = "between";
        w.modeT = 0;
        w.timeScale = 1;
      }
    }
    return;
  }

  nearWall(w.player);
  nearWall(w.rival);
  applyInput(w, input);
  aiAct(w, w.player, w.rival, w.aiP, dt);
  aiAct(w, w.rival, w.player, w.aiR, dt);

  if (!frozen) {
    const sim = dt * w.timeScale;
    stepPhase(w, w.player, w.rival, sim);
    stepPhase(w, w.rival, w.player, sim);
    physics(w, w.player, w.rival, sim);
    physics(w, w.rival, w.player, sim);
    nearWall(w.player);
    nearWall(w.rival);
    separate(w.player, w.rival);
    combat(w);
    updateKnives(w, sim);
  }
  updateCoach(w, dt);
  ambient(w, dt);
}

export { WINS };
