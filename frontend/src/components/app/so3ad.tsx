// <So3ad pose="wave" />  or  <So3ad pose="sit" size={120} />
// The Yallaway mascot (MASTER.md section 9). One pose per situation in the section 9 table:
// wave (home hero), scroll (search loading), tap (payment processing), jump (booking confirmed),
// shrug (empty search), sit (empty lists), lost (404 / error), watch (hold expiring / expired),
// key (login needed), worried (confirm dialogs), avatar (tips).
// Same look in every image: fitted lilac hijab, loose hip-length purple hoodie,
// cyan joggers, lavender sneakers, phone in hand. Every standing pose is built from the same
// head, body and legs below; only the arms, the face and the prop change.
// Animations are CSS classes in globals.css; under reduced motion each one ends on its still frame.
// Decorative by default (alt=""): put her line as real text next to her.
import type { ReactNode } from "react";
import { cn } from "cn";

const C = {
  skin: "#D9A77E",
  brow: "#3B2416",
  hijab: "#B3A4DE",
  hijabDark: "#9886C8",
  hoodie: "#6E56B8",
  hoodieDark: "#5F4AA3",
  jogger: "#4FA9B7",
  joggerDark: "#3D8E9B",
  shoe: "#ECEAF4",
  phone: "#2B2D45",
  screen: "#6CC4D2",
  case: "#4C8F9A",
  caseDark: "#3D7A84",
  ink: "#1A1020",
  cheek: "#E08F7A",
  string: "#F2F0F7",
};

export type So3adPose =
  | "wave"
  | "scroll"
  | "tap"
  | "jump"
  | "shrug"
  | "sit"
  | "lost"
  | "watch"
  | "key"
  | "worried"
  | "avatar";

type So3adProps = {
  pose?: So3adPose;
  /** Width in px; height follows. */
  size?: number;
  /** Set only when the image itself carries meaning (otherwise keep it decorative). */
  label?: string;
  className?: string;
};

const STANDING = "0 0 220 260";
const VIEW_BOX: Record<So3adPose, string> = {
  wave: STANDING,
  scroll: STANDING,
  tap: STANDING,
  jump: "0 -20 220 280",
  shrug: STANDING,
  sit: "0 0 200 200",
  lost: STANDING,
  watch: STANDING,
  key: "0 10 220 250",
  worried: STANDING,
  avatar: "62 28 110 100",
};

export function So3ad({ pose = "wave", size = 200, label, className }: So3adProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  const [, , w, h] = VIEW_BOX[pose].split(" ").map(Number);
  return (
    <svg
      viewBox={VIEW_BOX[pose]}
      width={size}
      height={(size * h) / w}
      data-pose={pose}
      className={cn("h-auto max-w-full", className)}
      {...a11y}
    >
      {POSES[pose]()}
    </svg>
  );
}

const POSES: Record<So3adPose, () => ReactNode> = {
  wave: WavePose,
  scroll: ScrollPose,
  tap: TapPose,
  jump: JumpPose,
  shrug: ShrugPose,
  sit: SitPose,
  lost: LostPose,
  watch: WatchPose,
  key: KeyPose,
  worried: WorriedPose,
  avatar: AvatarPose,
};

/* ---------- shared parts (standing poses, viewBox 220 x 260) ---------- */

type Face = "happy" | "focus" | "cheer" | "confused" | "sigh" | "smirk" | "worried";

function Eyes({ y = 68, big = false, blink = false }: { y?: number; big?: boolean; blink?: boolean }) {
  const rx = big ? 3.3 : 2.8;
  const ry = big ? 4 : 3.4;
  return (
    <g className={blink ? "so3ad-blink" : undefined}>
      <ellipse cx="98" cy={y} rx={rx} ry={ry} fill={C.ink} />
      <ellipse cx="114" cy={y} rx={rx} ry={ry} fill={C.ink} />
      <circle cx="99" cy={y - 1.2} r="1" fill="#FFFFFF" />
      <circle cx="115" cy={y - 1.2} r="1" fill="#FFFFFF" />
    </g>
  );
}

function FaceFeatures({ face, blink }: { face: Face; blink: boolean }) {
  const line = { stroke: C.ink, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const };
  const brow = { stroke: C.brow, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const };
  switch (face) {
    case "focus":
      return (
        <>
          <path d="M94 61 h8 M110 61 h8" {...brow} />
          <Eyes y={70} blink={blink} />
          <path d="M101 79 Q106 81 111 79" {...line} />
        </>
      );
    case "cheer":
      return (
        <>
          <path d="M94 58 q4 -4 8 -2 M110 56 q4 -2 8 2" {...brow} />
          <Eyes big blink={blink} />
          <path d="M98 76 Q106 88 114 76 Z" fill={C.ink} />
          <path d="M101 80 Q106 85 111 80" fill={C.cheek} />
        </>
      );
    case "confused":
      return (
        <>
          <path d="M94 57 q4 -4 8 -2 M110 61 q4 0 8 1" {...brow} />
          <Eyes blink={blink} />
          <path d="M100 79 q3 -2.5 6 0 q3 2.5 6 0" {...line} />
        </>
      );
    case "sigh":
      return (
        <>
          <path d="M94 62 l8 -3 M118 62 l-8 -3" {...brow} />
          <path d="M95 71 q3 2 6 0 M111 71 q3 2 6 0" {...line} />
          <ellipse cx="106" cy="79" rx="2.6" ry="2" fill={C.ink} />
        </>
      );
    case "smirk":
      return (
        <>
          <path d="M94 59 q4 -2 8 0 M110 56 q4 -3 8 0" {...brow} />
          <Eyes blink={blink} />
          <path d="M99 78 Q108 82 113 75" {...line} />
        </>
      );
    case "worried":
      return (
        <>
          <path d="M94 60 l8 -3.5 M118 60 l-8 -3.5" {...brow} />
          <Eyes big blink={blink} />
          <ellipse cx="106" cy="79" rx="2.6" ry="3.2" fill={C.ink} />
        </>
      );
    default:
      return (
        <>
          <path d="M94 60 q4 -3 8 -1 M110 59 q4 -2 8 1" {...brow} />
          <Eyes blink={blink} />
          <path d="M99 77 Q106 83 113 77" {...line} />
        </>
      );
  }
}

function Head({ face = "happy", blink = false }: { face?: Face; blink?: boolean }) {
  return (
    <g transform="translate(106 68) scale(1.15) translate(-106 -68)">
      <path d="M86 68 Q85 40 106 39 Q127 40 126 68 Q127 86 122 96 Q114 102 106 102 Q98 102 90 96 Q85 86 86 68 Z" fill={C.hijab} />
      <path d="M90 94 Q106 108 122 94 L126 104 Q106 116 86 104 Z" fill={C.hijabDark} />
      <ellipse cx="106" cy="68" rx="17" ry="19.5" fill={C.skin} />
      <ellipse cx="106" cy="68" rx="18.4" ry="21" fill="none" stroke={C.hijabDark} strokeWidth="1.8" />
      <path d="M94 45 Q106 40 118 45" stroke={C.hijabDark} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <FaceFeatures face={face} blink={blink} />
      <circle cx="93" cy="75" r="3" fill={C.cheek} opacity=".5" />
      <circle cx="119" cy="75" r="3" fill={C.cheek} opacity=".5" />
    </g>
  );
}

function Legs() {
  return (
    <>
      <path d="M80 162 L132 162 L134 200 Q134 218 131 226 L109 226 L106 190 L103 226 L81 226 Q78 218 78 200 Z" fill={C.jogger} />
      <path d="M106 190 V176" stroke={C.joggerDark} strokeWidth="2" strokeLinecap="round" />
      <path d="M89 194 Q91 210 90 222 M123 194 Q121 210 122 222" stroke={C.joggerDark} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
      <rect x="83" y="222" width="20" height="8" rx="3" fill={C.joggerDark} />
      <rect x="109" y="222" width="20" height="8" rx="3" fill={C.joggerDark} />
      <path d="M84 232 Q84 228 90 228 L101 228 Q104 228 104 231 L104 236 Q104 239 101 239 L77 239 Q73 239 73 235.5 Q73 232 78 232 Z" fill={C.shoe} />
      <path d="M128 232 Q128 228 122 228 L111 228 Q108 228 108 231 L108 236 Q108 239 111 239 L135 239 Q139 239 139 235.5 Q139 232 134 232 Z" fill={C.shoe} />
      <path d="M73 237.5 H104 M108 237.5 H139" stroke={C.hoodieDark} strokeWidth="3" strokeLinecap="round" />
      <path d="M88 231.5 l4 0 M95 231.5 l4 0 M117 231.5 l4 0 M124 231.5 l4 0" stroke={C.screen} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function Torso() {
  return (
    <>
      <path d="M78 108 Q106 96 134 108 L138 166 Q106 171 74 166 Z" fill={C.hoodie} />
      <path d="M74 162 Q106 167 138 162 L138 168 Q106 173 74 168 Z" fill={C.hoodieDark} />
      <path d="M90 138 h32 l-4 14 h-24 z" fill={C.hoodieDark} />
      <path d="M100 118 v14 M112 118 v14" stroke={C.string} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function Shadow() {
  return <ellipse cx="110" cy="246" rx="80" ry="8" fill="#000" opacity=".35" />;
}

/** A sleeve from the shoulder along `d`, ending in a hand at (hx, hy). */
function Arm({ d, hx, hy }: { d: string; hx: number; hy: number }) {
  return (
    <>
      <path d={d} stroke={C.hoodie} strokeWidth="13" fill="none" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="7" fill={C.skin} />
    </>
  );
}

/** Her phone, 17 x 28, top-left at (x, y), turned by `rotate` degrees around its centre. */
function Phone({ x, y, rotate = 0, children }: { x: number; y: number; rotate?: number; children?: ReactNode }) {
  return (
    <g transform={`rotate(${rotate} ${x + 8.5} ${y + 14})`}>
      <rect x={x} y={y} width="17" height="28" rx="3" fill={C.phone} />
      <rect x={x + 2.5} y={y + 3} width="12" height="20" rx="1.5" fill={C.screen} />
      {children ?? <path d={`M${x + 5} ${y + 8}h7 M${x + 5} ${y + 12}h5 M${x + 5} ${y + 16}h7`} stroke={C.phone} strokeWidth="1.5" strokeLinecap="round" />}
    </g>
  );
}

function Standing({ face, blink, children }: { face?: Face; blink?: boolean; children: ReactNode }) {
  return (
    <>
      <Shadow />
      <Legs />
      <Torso />
      {children}
      <Head face={face} blink={blink} />
    </>
  );
}

/* ---------- poses ---------- */

// Home hero: waving her phone, with a rolling suitcase. Wave loop 2.4s.
function WavePose() {
  return (
    <>
      <Shadow />
      <rect x="146" y="150" width="50" height="78" rx="10" fill={C.case} />
      <rect x="146" y="176" width="50" height="6" fill={C.caseDark} />
      <rect x="146" y="200" width="50" height="6" fill={C.caseDark} />
      <path d="M160 150 V128 H182 V150" fill="none" stroke={C.caseDark} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="156" cy="232" r="5" fill={C.phone} />
      <circle cx="186" cy="232" r="5" fill={C.phone} />
      <Legs />
      <Torso />
      <Arm d="M134 112 Q150 136 150 150" hx={152} hy={152} />
      <g className="so3ad-wave">
        <path d="M78 112 Q60 96 58 76" stroke={C.hoodie} strokeWidth="13" fill="none" strokeLinecap="round" />
        <Phone x={48.5} y={46} rotate={-12} />
        <circle cx="58" cy="72" r="7.5" fill={C.skin} />
      </g>
      <Head />
    </>
  );
}

// Search loading: scrolling fast on her phone. Thumb loop 1.6s.
function ScrollPose() {
  return (
    <Standing face="focus">
      <Arm d="M80 114 Q72 142 98 148" hx={98} hy={148} />
      <Arm d="M132 114 Q142 142 116 148" hx={116} hy={148} />
      <Phone x={98.5} y={122}>
        <g className="so3ad-scroll-list">
          <path d="M103 129h7 M103 134h5 M103 139h7 M103 144h5" stroke={C.phone} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </Phone>
      <circle className="so3ad-thumb" cx="113" cy="140" r="4" fill={C.skin} />
    </Standing>
  );
}

// Payment processing: holding the phone, tapping it while she waits. Tap loop 1.2s.
function TapPose() {
  return (
    <Standing face="focus">
      <Arm d="M80 114 Q70 142 94 150" hx={94} hy={150} />
      <Phone x={88} y={124} />
      <g className="so3ad-tap">
        <path d="M132 114 Q146 136 116 136" stroke={C.hoodie} strokeWidth="13" fill="none" strokeLinecap="round" />
        <circle cx="112" cy="136" r="7" fill={C.skin} />
        <rect x="102" y="133.5" width="8" height="4" rx="2" fill={C.skin} />
      </g>
    </Standing>
  );
}

// Booking confirmed: jumping with both arms up, confetti. Plays once, 1.2s.
function JumpPose() {
  const confetti = [
    [40, 20, C.screen, 20],
    [60, 50, C.hijab, -30],
    [176, 26, C.hijab, 40],
    [190, 60, C.screen, -15],
    [30, 90, C.shoe, 60],
    [196, 100, C.hoodie, 25],
    [150, 6, C.shoe, -40],
    [74, 4, C.hoodie, 10],
  ] as const;
  return (
    <>
      <Shadow />
      <g className="so3ad-confetti">
        {confetti.map(([x, y, fill, r]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="8" height="4" rx="1" fill={fill} transform={`rotate(${r} ${x + 4} ${y + 2})`} />
        ))}
      </g>
      <g className="so3ad-jump">
        <Legs />
        <Torso />
        <Arm d="M80 112 Q62 92 64 66" hx={64} hy={64} />
        <Phone x={56} y={30} rotate={-15} />
        <Arm d="M132 112 Q150 92 148 66" hx={148} hy={64} />
        <Head face="cheer" />
      </g>
    </>
  );
}

// Empty search: shrugging, an empty map in one hand and her phone in the other. Still + blink.
function ShrugPose() {
  return (
    <Standing face="confused" blink>
      <Arm d="M80 114 Q58 132 52 116" hx={52} hy={114} />
      <g transform="rotate(-8 44 98)">
        <rect x="26" y="84" width="38" height="26" rx="2" fill={C.shoe} />
        <path d="M38.7 84 v26 M51.3 84 v26" stroke={C.hijabDark} strokeWidth="1.5" />
      </g>
      <Arm d="M132 114 Q154 132 160 116" hx={160} hy={114} />
      <Phone x={152} y={84} rotate={10} />
    </Standing>
  );
}

// Empty lists: sitting on her suitcase. Still + blink.
function SitPose() {
  return (
    <>
      <ellipse cx="100" cy="190" rx="62" ry="7" fill="#000" opacity=".35" />
      <rect x="62" y="132" width="76" height="52" rx="10" fill={C.case} />
      <rect x="62" y="150" width="76" height="6" fill={C.caseDark} />
      <rect x="88" y="124" width="24" height="10" rx="4" fill="none" stroke={C.caseDark} strokeWidth="4" />
      <rect x="78" y="114" width="44" height="24" rx="8" fill={C.jogger} />
      <rect x="80" y="124" width="18" height="50" rx="7" fill={C.jogger} />
      <rect x="102" y="124" width="18" height="50" rx="7" fill={C.jogger} />
      <rect x="80" y="166" width="18" height="7" rx="2.5" fill={C.joggerDark} />
      <rect x="102" y="166" width="18" height="7" rx="2.5" fill={C.joggerDark} />
      <path d="M80 177 Q80 173 85 173 L95 173 Q98 173 98 176 L98 180 Q98 182.5 95 182.5 L74 182.5 Q71 182.5 71 179.5 Q71 177 75 177 Z" fill={C.shoe} />
      <path d="M120 177 Q120 173 115 173 L105 173 Q102 173 102 176 L102 180 Q102 182.5 105 182.5 L126 182.5 Q129 182.5 129 179.5 Q129 177 125 177 Z" fill={C.shoe} />
      <path d="M71 181.5 H98 M102 181.5 H129" stroke={C.hoodieDark} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M75 82 Q100 72 125 82 L127 124 Q100 129 73 124 Z" fill={C.hoodie} />
      <path d="M73 120 Q100 125 127 120 L127 126 Q100 131 73 126 Z" fill={C.hoodieDark} />
      <path d="M88 103 h24 l-3 10 h-18 z" fill={C.hoodieDark} />
      <path d="M96 94 v10 M104 94 v10" stroke={C.string} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M76 88 Q66 108 82 122" stroke={C.hoodie} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M124 88 Q134 108 118 122" stroke={C.hoodie} strokeWidth="10" fill="none" strokeLinecap="round" />
      <rect x="91" y="113" width="18" height="12" rx="2" fill={C.phone} />
      <rect x="93" y="115" width="14" height="8" rx="1" fill={C.screen} />
      <circle cx="86" cy="122" r="5" fill={C.skin} />
      <circle cx="114" cy="122" r="5" fill={C.skin} />
      <g transform="translate(100 54) scale(1.15) translate(-100 -54)">
        <path d="M85 56 Q84 36 100 35 Q116 36 115 56 Q116 70 112 78 Q106 83 100 83 Q94 83 88 78 Q84 70 85 56 Z" fill={C.hijab} />
        <path d="M88 76 Q100 88 112 76 L115 84 Q100 94 85 84 Z" fill={C.hijabDark} />
        <ellipse cx="100" cy="54" rx="13" ry="15" fill={C.skin} />
        <ellipse cx="100" cy="54" rx="14.2" ry="16.2" fill="none" stroke={C.hijabDark} strokeWidth="1.6" />
        <path d="M92 39 Q100 35.5 108 39" stroke={C.hijabDark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M90 50 q3 -2 6 0 M104 50 q3 -2 6 0" stroke={C.brow} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <g className="so3ad-blink">
          <ellipse cx="94" cy="56" rx="2" ry="2.5" fill={C.ink} />
          <ellipse cx="106" cy="56" rx="2" ry="2.5" fill={C.ink} />
        </g>
        <path d="M96 63 Q100 64 104 63" stroke={C.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
    </>
  );
}

// 404 / error: holding a map that flips upside down (once, 0.8s); phone in her hoodie pocket.
function LostPose() {
  return (
    <Standing face="confused">
      <rect x="99" y="132" width="12" height="10" rx="2" fill={C.phone} />
      <rect x="101" y="134" width="8" height="5" rx="1" fill={C.screen} />
      <Arm d="M80 114 Q70 140 80 150" hx={80} hy={150} />
      <Arm d="M132 114 Q142 140 132 150" hx={132} hy={150} />
      <g className="so3ad-flip">
        <rect x="74" y="128" width="64" height="40" rx="2" fill={C.shoe} />
        <path d="M95.3 128 v40 M116.7 128 v40" stroke={C.hijabDark} strokeWidth="1.5" />
        <path d="M82 158 Q96 140 108 150 T130 136" stroke={C.jogger} strokeWidth="2" fill="none" strokeDasharray="3 3" />
        <path d="M130 131 a4 4 0 1 1 0.1 0 M130 139 v-4" fill={C.hoodie} stroke={C.hoodie} strokeWidth="2" />
        <path d="M82 134 l3 -5 l3 5 M85 129 v8" stroke={C.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="80" cy="150" r="7" fill={C.skin} />
      <circle cx="132" cy="150" r="7" fill={C.skin} />
    </Standing>
  );
}

// Hold expiring / expired: raising her wrist to look at her watch, sighing (once, 0.8s).
function WatchPose() {
  return (
    <Standing face="sigh">
      <Arm d="M132 114 Q146 136 146 152" hx={147} hy={154} />
      <Phone x={140} y={150} rotate={8} />
      <g className="so3ad-raise">
        <path d="M80 114 Q66 138 96 130" stroke={C.hoodie} strokeWidth="13" fill="none" strokeLinecap="round" />
        <rect x="92" y="122" width="8" height="15" rx="2" fill={C.phone} />
        <circle cx="96" cy="129.5" r="5.5" fill={C.screen} stroke={C.phone} strokeWidth="1.5" />
        <path d="M96 126.5 v3 h2.5" stroke={C.phone} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <circle cx="105" cy="129" r="7" fill={C.skin} />
      </g>
    </Standing>
  );
}

// Login needed: holding up a key, phone in the other hand. Still.
function KeyPose() {
  return (
    <Standing face="smirk">
      <Arm d="M80 114 Q66 136 66 150" hx={65} hy={152} />
      <Phone x={50} y={136} rotate={-8} />
      <Arm d="M132 112 Q150 98 150 78" hx={150} hy={76} />
      <circle cx="150" cy="40" r="9" fill="none" stroke={C.screen} strokeWidth="5" />
      <path d="M150 49 V70 M150 58 h7 M150 64 h5" stroke={C.screen} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="150" cy="76" r="7" fill={C.skin} />
    </Standing>
  );
}

// Confirm dialogs: worried, both hands up, phone in one of them. Still.
function WorriedPose() {
  return (
    <Standing face="worried">
      <Arm d="M80 114 Q60 112 64 90" hx={64} hy={88} />
      <Phone x={50} y={62} rotate={-10} />
      <circle cx="64" cy="88" r="7" fill={C.skin} />
      <Arm d="M132 114 Q152 112 148 90" hx={148} hy={88} />
      <path d="M143 80 v-6 M148 79 v-8 M153 80 v-6" stroke={C.skin} strokeWidth="4" strokeLinecap="round" />
    </Standing>
  );
}

// Tips: head and shoulders, pointing up with one finger. Still.
function AvatarPose() {
  return (
    <>
      <path d="M78 128 Q106 108 134 128 Z" fill={C.hoodie} />
      <path d="M132 124 Q148 116 150 100" stroke={C.hoodie} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="151" cy="97" r="6.5" fill={C.skin} />
      <rect x="149" y="80" width="4.5" height="14" rx="2.25" fill={C.skin} />
      <Head />
    </>
  );
}

/** <So3adTip>Read the refund tiers first, habibi.</So3adTip>: a short tip with So3ad's head (MASTER.md section 9, Tips). */
export function So3adTip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <So3ad pose="avatar" size={40} />
      <p className="rounded-2xl rounded-bl-sm border border-border bg-muted px-3 py-1.5 text-sm">&ldquo;{children}&rdquo;</p>
    </div>
  );
}
