// All saved game state lives in these types. Everything here is plain JSON so a save restores exactly.
export type Difficulty = 'relaxed' | 'normal' | 'hard' | 'legend';
export type Lang = 'en' | 'ar';
export type Personality = 'easygoing' | 'picky' | 'budget' | 'wealthy' | 'emotional' | 'traditional' | 'party';
export type ThemeId = 'classic' | 'royal' | 'boho' | 'beach' | 'glam' | 'romantic' | 'rustic' | 'fairytale';
export type MenuId = 'buffet' | 'three_course' | 'luxury';
export type Phase = 'arrive' | 'entrance' | 'dinner' | 'dancing' | 'farewell';
export type Bi = [string, string]; // [english, arabic]

export interface Look {
  gender: 'm' | 'f';
  skin: number; // index into skin palette
  hair: number; // hairstyle index
  hairColor: number;
  outfit: number; // outfit index
  color: number; // accent color index
  acc: string[]; // accessories: sunglasses, glasses, earrings, watch, necklace
  beard?: number;
  body?: 'adult' | 'child' | 'elderly';
  uniform?: string; // staff uniform id
  dress?: 'bride' | 'groom';
  height?: number;
  c?: string; // custom main clothing color (guests)
  c2?: string; // custom secondary color
}

export interface DemandLine { id: string; on: boolean; }
export interface ClientRequest {
  id: string;
  groom: Bi; bride: Bi; story: number; personality: Personality;
  guests: number; menu: MenuId; theme: ThemeId; flower: string; light: string; music: string; venue: string;
  date: number; // day number of wedding
  hall: number; // hall index requested
  expires: number; // day it expires
  budget: number; // hidden
  demands: string[];
  vip?: boolean; celebrity?: boolean; returning?: string; // returning couple id
  look: { g: Look; b: Look };
  met?: boolean; countered?: boolean; status: 'new' | 'met' | 'countered' | 'rejected';
  counterOffer?: number;
}
export interface Plan { theme: ThemeId; flower: string; light: string; music: string; venue: string; planned: boolean; byManager?: boolean; food?: 'standard' | 'premium' | 'luxury'; seating?: number; }
export interface Booking {
  id: string; req: ClientRequest; hall: number; date: number;
  lines: DemandLine[]; priceLevel: number; total: number; cost: number; deposit: number; paid: number;
  plan: Plan; removed: number;
}
export interface WeddingRecord {
  id: string; day: number; hall: number; names: [Bi, Bi]; guests: number; happiness: number; themeMatch: number;
  fixed: number; missed: number; payment: number; tips: number; costs: number; profit: number; repChange: number;
  review: Bi; stars: number; photo?: string; celebrity?: boolean; skipped?: boolean; unattended?: boolean; returned?: boolean;
  personality: Personality; theme: ThemeId; loved: string[]; wanted: string[]; shopSales: number;
}
export interface Employee {
  id: string; name: Bi; role: string; skill: number; trait: string; wage: number; morale: number;
  weekWeddings: number; hall: number; look: Look; hiredDay: number; askedRaise?: boolean; fatigue?: number; restUntil?: number;
  toggles?: { run: boolean; fix: boolean; plan: boolean; accept: boolean };
  named?: string; // story character id
}
export interface Candidate {
  id: string; name: Bi; role: string; skill: number; trait: string; wage: number; interviewed: boolean; look: Look; quote: number;
}
export interface Loan { id: string; cat: string; principal: number; interestTotal: number; weekly: number; weeksLeft: number; paid: number; rate: number; nextDue: number; missed: number; }
export interface Campaign { id: string; until: number; }
export interface Mod { key: string; value: number; until: number; }
export interface Message {
  id: string; day: number; from: Bi; text: Bi; read: boolean; kind: string;
  choices?: { label: Bi; action: string; arg?: any }[]; answered?: number; ref?: string;
}
export interface Post { id: string; day: number; photo?: string; caption: Bi; likes: number; comments: number[]; boosted?: boolean; }
export interface Photo { id: string; day: number; data: string; names: [Bi, Bi]; happiness: number; }
export interface PlacedItem { uid: number; id: string; x: number; z: number; rot: number; }
export interface SmallBooking { id: string; type: string; guests: number; date: number; price: number; hall: number; done?: boolean; result?: number; accepted?: boolean; }
export interface HallState {
  id: string; owned: boolean; name: string; size: number; upgrades: Record<string, number>;
  layout: PlacedItem[]; savedLayouts: Record<string, PlacedItem[]>; managerId: string | null;
  plots: Record<string, number>; cosmetics: Record<string, string>; ratingHistory: number[]; weddings: number;
  smallBookings: SmallBooking[]; nextUid: number;
}
export interface Goal { type: string; n?: number; hall?: number; }
export interface WeeklyGoal { type: string; n: number; progress: number; reward: number; claimed: boolean; }
export interface Research { done: string[]; active: string | null; until: number; }
export interface Stats { [k: string]: number; }
export interface PendingNews { id: string; sabotage?: boolean; }
export interface Settings {
  quality: 'smooth' | 'high' | 'ultra'; shadows: boolean; glow: boolean; particles: boolean; cameraSpeed: number; invertRotation: boolean;
  autoCamera: boolean; weddingLength: 'short' | 'normal' | 'long'; music: number; sound: number; bubbles: boolean; floatingMoney: boolean; haptics: boolean;
}
export interface GameState {
  version: number; slot: number; created: number; savedAt: number; seed: number;
  difficulty: Difficulty; ownerName: string; owner: Look;
  day: number; money: number; reputation: number; followers: number; rosaDebt: number;
  halls: HallState[]; activeHall: number;
  staff: Employee[]; candidates: Candidate[]; candidatesDay: number;
  requests: ClientRequest[]; bookings: Booking[]; history: WeddingRecord[];
  loans: Loan[]; campaigns: Campaign[]; mods: Mod[]; shopOwned: string[];
  messages: Message[]; posts: Post[]; photos: Photo[]; pendingCalls: { id: string; who: string; arg?: any }[];
  chapter: number; chapterStartDay: number; chapterStats: Stats; chapterStars: number[]; chapterDone: boolean;
  weekly: { week: number; goals: WeeklyGoal[] };
  achievements: { claimed: string[] };
  research: Research; victor: { rating: number; offerMade: boolean; flowersSent: boolean };
  sabotageSurvived: number; sabotageScheduled: number[];
  stats: Stats; weekStats: Stats;
  dailyGift: { lastDate: string; streak: number; spunDate: string };
  tutorial: { step: number; done: boolean };
  unlocked: string[];
  pendingNews: PendingNews | null; lastNewsDay: number; newsSeen: string[];
  returningPool: { id: string; names: [Bi, Bi]; hall: number; day: number; looks: { g: Look; b: Look } }[];
  settings: Settings; idCounter: number; lastReport: WeddingRecord | null;
  removeAds: boolean;
  suppliers?: Record<string, number>; // flowers / cake / photo: 0 budget, 1 standard, 2 premium
  investor?: { until: number; share: number; amount: number } | null;
}
