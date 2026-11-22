// <So3ad pose="wave" />  or  <So3ad pose="sit" size={120} />
// The Yallaway mascot (MASTER.md section 9). Concept art: two poses exist today
// ("wave" for the home hero and success, "sit" for empty states). The final
// flat-vector pose set (search, payment, 404, hold expired...) replaces these
// drawings later without changing how pages call the component.
// Same look in every image: fitted lilac hijab, loose hip-length purple hoodie,
// cyan joggers, lavender sneakers, phone in hand.
// Decorative by default (alt=""): put her line as real text next to her.
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

export type So3adPose = "wave" | "sit";

type So3adProps = {
  pose?: So3adPose;
  /** Width in px; height follows. */
  size?: number;
  /** Set only when the image itself carries meaning (otherwise keep it decorative). */
  label?: string;
  className?: string;
};

export function So3ad({ pose = "wave", size = 200, label, className }: So3adProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return pose === "sit" ? (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cn("h-auto max-w-full", className)} {...a11y}>
      <SitPose />
    </svg>
  ) : (
    <svg viewBox="0 0 220 260" width={size} height={(size * 260) / 220} className={cn("h-auto max-w-full", className)} {...a11y}>
      <WavePose />
    </svg>
  );
}

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
        <ellipse cx="94" cy="56" rx="2" ry="2.5" fill={C.ink} />
        <ellipse cx="106" cy="56" rx="2" ry="2.5" fill={C.ink} />
        <path d="M96 63 Q100 64 104 63" stroke={C.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
    </>
  );
}

function WavePose() {
  return (
    <>
      <ellipse cx="110" cy="246" rx="80" ry="8" fill="#000" opacity=".35" />
      <rect x="146" y="150" width="50" height="78" rx="10" fill={C.case} />
      <rect x="146" y="176" width="50" height="6" fill={C.caseDark} />
      <rect x="146" y="200" width="50" height="6" fill={C.caseDark} />
      <path d="M160 150 V128 H182 V150" fill="none" stroke={C.caseDark} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="156" cy="232" r="5" fill={C.phone} />
      <circle cx="186" cy="232" r="5" fill={C.phone} />
      <path d="M80 162 L132 162 L134 200 Q134 218 131 226 L109 226 L106 190 L103 226 L81 226 Q78 218 78 200 Z" fill={C.jogger} />
      <path d="M106 190 V176" stroke={C.joggerDark} strokeWidth="2" strokeLinecap="round" />
      <path d="M89 194 Q91 210 90 222 M123 194 Q121 210 122 222" stroke={C.joggerDark} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
      <rect x="83" y="222" width="20" height="8" rx="3" fill={C.joggerDark} />
      <rect x="109" y="222" width="20" height="8" rx="3" fill={C.joggerDark} />
      <path d="M84 232 Q84 228 90 228 L101 228 Q104 228 104 231 L104 236 Q104 239 101 239 L77 239 Q73 239 73 235.5 Q73 232 78 232 Z" fill={C.shoe} />
      <path d="M128 232 Q128 228 122 228 L111 228 Q108 228 108 231 L108 236 Q108 239 111 239 L135 239 Q139 239 139 235.5 Q139 232 134 232 Z" fill={C.shoe} />
      <path d="M73 237.5 H104 M108 237.5 H139" stroke={C.hoodieDark} strokeWidth="3" strokeLinecap="round" />
      <path d="M88 231.5 l4 0 M95 231.5 l4 0 M117 231.5 l4 0 M124 231.5 l4 0" stroke={C.screen} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M78 108 Q106 96 134 108 L138 166 Q106 171 74 166 Z" fill={C.hoodie} />
      <path d="M74 162 Q106 167 138 162 L138 168 Q106 173 74 168 Z" fill={C.hoodieDark} />
      <path d="M90 138 h32 l-4 14 h-24 z" fill={C.hoodieDark} />
      <path d="M100 118 v14 M112 118 v14" stroke={C.string} strokeWidth="2" strokeLinecap="round" />
      <path d="M134 112 Q150 136 150 150" stroke={C.hoodie} strokeWidth="13" fill="none" strokeLinecap="round" />
      <circle cx="152" cy="152" r="7" fill={C.skin} />
      <g className="so3ad-wave">
        <path d="M78 112 Q60 96 58 76" stroke={C.hoodie} strokeWidth="13" fill="none" strokeLinecap="round" />
        <g transform="rotate(-12 57 60)">
          <rect x="49" y="46" width="17" height="28" rx="3" fill={C.phone} />
          <rect x="51.5" y="49" width="12" height="20" rx="1.5" fill={C.screen} />
          <path d="M54 54h7 M54 58h5 M54 62h7" stroke={C.phone} strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <circle cx="58" cy="72" r="7.5" fill={C.skin} />
      </g>
      <g transform="translate(106 68) scale(1.15) translate(-106 -68)">
        <path d="M86 68 Q85 40 106 39 Q127 40 126 68 Q127 86 122 96 Q114 102 106 102 Q98 102 90 96 Q85 86 86 68 Z" fill={C.hijab} />
        <path d="M90 94 Q106 108 122 94 L126 104 Q106 116 86 104 Z" fill={C.hijabDark} />
        <ellipse cx="106" cy="68" rx="17" ry="19.5" fill={C.skin} />
        <ellipse cx="106" cy="68" rx="18.4" ry="21" fill="none" stroke={C.hijabDark} strokeWidth="1.8" />
        <path d="M94 45 Q106 40 118 45" stroke={C.hijabDark} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M94 60 q4 -3 8 -1 M110 59 q4 -2 8 1" stroke={C.brow} strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="98" cy="68" rx="2.8" ry="3.4" fill={C.ink} />
        <ellipse cx="114" cy="68" rx="2.8" ry="3.4" fill={C.ink} />
        <circle cx="99" cy="66.8" r="1" fill="#FFFFFF" />
        <circle cx="115" cy="66.8" r="1" fill="#FFFFFF" />
        <path d="M99 77 Q106 83 113 77" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="93" cy="75" r="3" fill={C.cheek} opacity=".5" />
        <circle cx="119" cy="75" r="3" fill={C.cheek} opacity=".5" />
      </g>
    </>
  );
}
