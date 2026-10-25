export const WORLD_W = 2100;
export const WORLD_H = 1000;
export const FLOOR_Y = 800;
export const HW = 18;
export const FH = 96;
export const GRAV = 2100;
export const WINS = 3;

export type Side = "player" | "rival";
export type Intensity = "measured" | "fierce";

export type Phase =
  | "free"
  | "bow"
  | "cut"
  | "thrust"
  | "lunge"
  | "aerial"
  | "leap"
  | "riposte"
  | "bash"
  | "uppercut"
  | "finisher"
  | "block"
  | "roll"
  | "evade"
  | "flip"
  | "vault"
  | "slide"
  | "dash"
  | "grapple"
  | "stun"
  | "launch"
  | "downed"
  | "rise";

export type Stage = "none" | "windup" | "active" | "recover";

export interface AttackDef {
  windup: number;
  active: number;
  recover: number;
  dmg: number;
  kb: number;
  stun: number;
  reach: number;
  stam: number;
  a0: number;
  a1: number;
  extend: boolean;
  dash: number;
  pop: number;
  guardBreak: boolean;
  lift: number;
}

export interface Palette {
  armorA: string;
  armorB: string;
  metal: string;
  cape: string;
  plume: string;
  glow: string;
  trim: string;
  cloth: string;
  deep: string;
}

export interface TrailPt {
  x: number;
  y: number;
  a: number;
}

export interface GameEvent {
  kind: "tap" | "double" | "swipe" | "knife" | "grapple";
  dx: number;
  dy: number;
}

export interface Fighter {
  id: Side;
  name: string;
  short: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  phase: Phase;
  phaseT: number;
  phaseDur: number;
  attack: AttackDef | null;
  onGround: boolean;
  oneWay: boolean;
  wallDir: -1 | 0 | 1;
  dropTimer: number;
  health: number;
  healthLag: number;
  stamina: number;
  knives: number;
  regenT: number;
  throwLock: number;
  throwAnim: number;
  iFrames: number;
  parryWindow: number;
  riposte: number;
  hitThisSwing: boolean;
  bladeLocal: number;
  bladeLen: number;
  shield: number;
  shieldHeld: boolean;
  autoShield: number;
  hitFlash: number;
  squash: number;
  gait: number;
  trail: TrailPt[];
  coyote: number;
  airDash: number;
  techWindow: number;
  buffered: GameEvent | null;
  bufferT: number;
  alive: boolean;
  pal: Palette;
  moveX: number;
  aimX: number;
  aimY: number;
  aimOk: boolean;
  tether: { x: number; y: number } | null;
  grappleCd: number;
  glint: boolean;
  stage: Stage;
  phrase: string;
  phraseT: number;
  phraseBig: boolean;
  stuckT: number;
  isAI: boolean;
  personality: number;
  prevVy: number;
  rollDir: number;
  ghostT: number;
  attackId: number;
  extraWind: number;
  spin: number;
  wasGround: boolean;
  braceSaid: boolean;
  feint: number;
  stamDelay: number;
  comboCount: number;
  comboTimer: number;
}

export interface SlashLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  max: number;
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Surface {
  id: string;
  x: number;
  y: number;
  w: number;
  oneWay: boolean;
}

export interface Anchor {
  x: number;
  y: number;
}

export interface Knife {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  stuck: boolean;
  owner: Side;
  grace: number;
  life: number;
  dmg: number;
}

export interface Pickup {
  x: number;
  y: number;
  respawn: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "dust" | "ember" | "mote";
  g: number;
}

export interface Shock {
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  power: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  big: boolean;
  isDmg?: boolean;
  dmg?: number;
}

export interface Ghost {
  x: number;
  y: number;
  life: number;
  color: string;
  facing: 1 | -1;
}

export interface LogLine {
  who: string;
  text: string;
  side: "p" | "r";
  life: number;
}

export interface AIState {
  cd: number;
  mood: "engage" | "pause";
  pause: number;
  shieldUntil: number;
  knifeCd: number;
  grappleCd: number;
  parryChance: number;
}

export type SfxName =
  | "swing"
  | "hit"
  | "heavyhit"
  | "crit"
  | "parry"
  | "clash"
  | "land"
  | "throw"
  | "web"
  | "ko"
  | "engage"
  | "whoosh"
  | "bash"
  | "block"
  | "break"
  | "shatter"
  | "combo"
  | "dash"
  | "jump"
  | "dodge"
  | "click"
  | "tick";

export interface World {
  time: number;
  mode: "attract" | "intro" | "fight" | "ko" | "between" | "match";
  modeT: number;
  hitstop: number;
  timeScale: number;
  shake: number;
  punch: number;
  letter: number;
  flash: number;
  message: string;
  submessage: string;
  messageT: number;
  player: Fighter;
  rival: Fighter;
  knives: Knife[];
  pickups: Pickup[];
  particles: Particle[];
  floaters: Floater[];
  shocks: Shock[];
  slashes: SlashLine[];
  ghosts: Ghost[];
  log: LogLine[];
  sfx: SfxName[];
  aiP: AIState;
  aiR: AIState;
  scoreP: number;
  scoreR: number;
  round: number;
  intensity: Intensity;
  winner: Side | null;
  matchWinner: Side | null;
  attract: boolean;
  coach: string;
  coachT: number;
  tipI: number;
  debug: boolean;
  lessons: number;
  flashColor: string;
}

export interface PlayerInput {
  moveX: number;
  shield: boolean;
  events: GameEvent[];
  aimX: number;
  aimY: number;
  aimOk: boolean;
}

export interface Snapshot {
  mode: World["mode"];
  attract: boolean;
  paused: boolean;
  hpP: number;
  hpR: number;
  hpLagP: number;
  hpLagR: number;
  stamP: number;
  stamR: number;
  knivesP: number;
  knivesR: number;
  scoreP: number;
  scoreR: number;
  round: number;
  message: string;
  sub: string;
  messageA: number;
  coach: string;
  log: { who: string; text: string; side: "p" | "r" }[];
  winner: Side | null;
  matchWinner: Side | null;
  intensity: Intensity;
  muted: boolean;
  low: boolean;
}

export const CAEL: Palette = {
  armorA: "#d9c4a0",
  armorB: "#8c6a3e",
  metal: "#f3e6cf",
  cape: "#8d2e34",
  plume: "#e6b15c",
  glow: "#ffb15a",
  trim: "#e4b15a",
  cloth: "#5c2428",
  deep: "#2a1a14",
};

export const VESPER: Palette = {
  armorA: "#c5cbe0",
  armorB: "#3c445c",
  metal: "#e7e9f4",
  cape: "#2a2150",
  plume: "#b9a4ff",
  glow: "#c7b6ff",
  trim: "#b9a4ff",
  cloth: "#1b1730",
  deep: "#12121c",
};

export const ATTACKS: Record<string, AttackDef> = {
  cut: {
    windup: 0.16,
    active: 0.11,
    recover: 0.22,
    dmg: 12,
    kb: 380,
    stun: 0.28,
    reach: 108,
    stam: 14,
    a0: 1.9,
    a1: -0.7,
    extend: false,
    dash: 70,
    pop: -170,
    guardBreak: false,
    lift: 0,
  },
  thrust: {
    windup: 0.15,
    active: 0.08,
    recover: 0.26,
    dmg: 15,
    kb: 500,
    stun: 0.32,
    reach: 134,
    stam: 16,
    a0: 0.2,
    a1: 0.02,
    extend: true,
    dash: 30,
    pop: -230,
    guardBreak: false,
    lift: 0,
  },
  lunge: {
    windup: 0.13,
    active: 0.11,
    recover: 0.22,
    dmg: 14,
    kb: 540,
    stun: 0.3,
    reach: 120,
    stam: 18,
    a0: 1.0,
    a1: -0.28,
    extend: false,
    dash: 620,
    pop: -190,
    guardBreak: false,
    lift: 0,
  },
  aerial: {
    windup: 0.07,
    active: 0.15,
    recover: 0.14,
    dmg: 13,
    kb: 360,
    stun: 0.26,
    reach: 114,
    stam: 12,
    a0: 1.35,
    a1: -1.0,
    extend: false,
    dash: 60,
    pop: 120,
    guardBreak: false,
    lift: 0,
  },
  leap: {
    windup: 0.1,
    active: 0.14,
    recover: 0.16,
    dmg: 13,
    kb: 420,
    stun: 0.27,
    reach: 116,
    stam: 16,
    a0: 1.65,
    a1: -0.5,
    extend: false,
    dash: 40,
    pop: -210,
    guardBreak: false,
    lift: -900,
  },
  riposte: {
    windup: 0.05,
    active: 0.1,
    recover: 0.16,
    dmg: 20,
    kb: 620,
    stun: 0.44,
    reach: 122,
    stam: 6,
    a0: 1.45,
    a1: -0.35,
    extend: false,
    dash: 160,
    pop: -250,
    guardBreak: true,
    lift: 0,
  },
  bash: {
    windup: 0.08,
    active: 0.09,
    recover: 0.2,
    dmg: 9,
    kb: 720,
    stun: 0.36,
    reach: 68,
    stam: 14,
    a0: 1.15,
    a1: 0.35,
    extend: false,
    dash: 240,
    pop: -90,
    guardBreak: true,
    lift: 0,
  },
  uppercut: {
    windup: 0.1,
    active: 0.1,
    recover: 0.18,
    dmg: 14,
    kb: 420,
    stun: 0.34,
    reach: 114,
    stam: 12,
    a0: -0.7,
    a1: 1.75,
    extend: false,
    dash: 110,
    pop: -350,
    guardBreak: false,
    lift: 0,
  },
  finisher: {
    windup: 0.14,
    active: 0.11,
    recover: 0.25,
    dmg: 22,
    kb: 680,
    stun: 0.44,
    reach: 142,
    stam: 18,
    a0: 0.4,
    a1: -0.15,
    extend: true,
    dash: 360,
    pop: -260,
    guardBreak: true,
    lift: 0,
  },
};

export const SURFACES: Surface[] = [
  { id: "floor", x: 48, y: FLOOR_Y, w: WORLD_W - 96, oneWay: false },
  { id: "lstep", x: 150, y: 670, w: 270, oneWay: true },
  { id: "rstep", x: 1680, y: 670, w: 270, oneWay: true },
  { id: "midL", x: 600, y: 600, w: 200, oneWay: true },
  { id: "midR", x: 1300, y: 600, w: 200, oneWay: true },
  { id: "lterrace", x: 64, y: 525, w: 410, oneWay: true },
  { id: "rterrace", x: 1626, y: 525, w: 410, oneWay: true },
  { id: "crown", x: 860, y: 270, w: 380, oneWay: true },
  { id: "colLtop", x: 455, y: 555, w: 64, oneWay: false },
  { id: "colRtop", x: 1581, y: 555, w: 64, oneWay: false },
];

export const SOLIDS: Rect[] = [
  { id: "wallL", x: 0, y: 0, w: 48, h: WORLD_H },
  { id: "wallR", x: WORLD_W - 48, y: 0, w: 48, h: WORLD_H },
  { id: "colL", x: 455, y: 555, w: 64, h: FLOOR_Y - 555 },
  { id: "colR", x: 1581, y: 555, w: 64, h: FLOOR_Y - 555 },
];

export const ANCHORS: Anchor[] = [
  { x: 170, y: 148 },
  { x: 400, y: 108 },
  { x: 690, y: 156 },
  { x: 960, y: 78 },
  { x: 1140, y: 86 },
  { x: 1410, y: 156 },
  { x: 1700, y: 108 },
  { x: 1930, y: 148 },
];

export const ATTACK_PHASES = new Set<Phase>([
  "cut",
  "thrust",
  "lunge",
  "aerial",
  "leap",
  "riposte",
  "bash",
  "uppercut",
  "finisher",
]);

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);

export function faceOf(n: number, fallback: number = 1): 1 | -1 {
  if (n > 0.02) return 1;
  if (n < -0.02) return -1;
  return fallback >= 0 ? 1 : -1;
}

export function bladeDir(facing: number, local: number) {
  return { x: facing * Math.cos(local), y: -Math.sin(local) };
}

export function handOf(f: Fighter) {
  return { x: f.x + f.facing * 10, y: f.y - FH * 0.7 };
}

export function bladeSegment(f: Fighter) {
  const h = handOf(f);
  const d = bladeDir(f.facing, f.bladeLocal);
  const len = f.bladeLen;
  return { x1: h.x, y1: h.y, x2: h.x + d.x * len, y2: h.y + d.y * len };
}
