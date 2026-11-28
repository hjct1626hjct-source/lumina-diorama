import * as THREE from 'three';
import { createBotWToonMaterial } from '../rendering/BotWToonShader';
import { modelLoader, type NormalizedInstance } from '../rendering/ModelLoader';
import { getTerrainHeight } from '../world/TerrainGenerator';
import { REGION_LIST } from '../data/regions';
import type { RegionId, RuneId, WeatherType } from '../types/botw';

export const PLATEAU_RUNE_SHRINE_IDS = [
  'shrine_oman_au',
  'shrine_ja_baij',
  'shrine_owa_daim',
  'shrine_keh_namut',
] as const;

export const PLATEAU_SHRINE_RUNE_MAP: Record<string, RuneId[]> = {
  shrine_oman_au: ['magnesis'],
  shrine_ja_baij: ['bomb_round', 'bomb_square'],
  shrine_owa_daim: ['stasis'],
  shrine_keh_namut: ['cryonis'],
};

export function hasCompletedAllPlateauShrines(completedShrines: string[]): boolean {
  return PLATEAU_RUNE_SHRINE_IDS.every((id) => completedShrines.includes(id));
}

export interface EventFlowContext {
  isNaked: boolean;
  triggersNpcFear: boolean;
  hasGerudoEntry: boolean;
  isBloodMoon: boolean;
  isRaining: boolean;
  timeHours: number;
  memoriesCount: number;
  hasParaglider: boolean;
  plateauShrinesDone?: boolean;
  hasCameraRune?: boolean;
  tarreyTownStage: number;
  thunderHelmRecovered: boolean;
}

export interface NpcDialoguePayload {
  speakerName: string;
  roleTitle: string;
  lines: string[];
  choices?: Array<{ label: string; action: string }>;
  isYigaAmbush?: boolean;
  shopItems?: Array<{ id: string; nameJa: string; price: number; rainExclusive?: boolean }>;
}

export interface WorldNpc {
  id: string;
  nameJa: string;
  displayNameJa: string; // Yiga disguised travelers show literally "旅人" per BotW spec!
  roleJa: string;
  region: RegionId;
  homePos: THREE.Vector3;
  shelterPos: THREE.Vector3;
  nightPos: THREE.Vector3;
  position: THREE.Vector3;
  yaw: number;
  wakeHour: number;
  sleepHour: number;
  isChild?: boolean;
  isMerchant?: boolean;
  isYigaDisguised?: boolean;
  yigaTriggered?: boolean;
  merchantDiscountOnRain?: boolean;
  merchantRainAncientStock?: boolean;
  glbKey: string;
  tintColor?: string;
  scaleMultiplier?: number;
  root: THREE.Group;
  fallbackGroup?: THREE.Group | null;
  glbInstance: NormalizedInstance | null;
  behaviorLabel: string;
}

export interface WorldKorok {
  id: string;
  puzzleType: string;
  puzzleNameJa: string;
  region: RegionId;
  position: THREE.Vector3;
  found: boolean;
  root: THREE.Group;
  korokMesh: THREE.Group;
}

export interface WildlifeEntity {
  id: string;
  type: 'horse' | 'fox' | 'stork' | 'parrot';
  glbKey: string;
  position: THREE.Vector3;
  homePos: THREE.Vector3;
  yaw: number;
  speed: number;
  tamed?: boolean;
  bond?: number;
  root: THREE.Group;
  glb: NormalizedInstance | null;
}

/**
 * Pure EventFlow Conditional Dialogue Evaluator (exported for unit testing & live dialogue!).
 * Implements BotW's authentic dynamic dialogue branches:
 * - Naked/underwear state reactions unique per NPC/tribe (Paya, Bolson, Purah, Robbie, Old Man, Gerudo, Stables)
 * - Monster/Dark Link/Tingle/Phantom Ganon fear reactions
 * - Gerudo Town Vai disguise gate check
 * - Blood Moon ecstatic dialogue (Hino)
 * - Rain & Time-of-day reactions + 15 Traveling Merchants rain stock/discounts
 * - Yiga Disguised Traveler reveal!
 */
export function evaluateNpcEventFlow(npc: WorldNpc, ctx: EventFlowContext): NpcDialoguePayload {
  // 1. Yiga Disguised Roadside Traveler!
  if (npc.isYigaDisguised) {
    return {
      speakerName: '旅人',
      roleTitle: '街道の旅人？',
      lines: [
        '……おや、ハイラルの若き剣士さんだね。',
        'あんたが噂のリンクか……ふふふ、ちょうどよかった。',
        'コーガ様のお命じにより、ここで命をもらうぞ！！',
      ],
      isYigaAmbush: true,
    };
  }

  // 2. Gerudo Town Guard Male Ban / Vai Disguise Gate Check
  if (npc.id === 'npc_gerudo_guard') {
    if (!ctx.hasGerudoEntry) {
      return {
        speakerName: 'ゲルドの門番',
        roleTitle: 'ゲルドの街 衛兵',
        lines: [
          'おい、そこのヴォーイ（男）！止まりなさい！',
          'ゲルドの街は古来より男子禁制（ヴァーイ限定）だ。',
          '街に入りたければ、カラカラバザールの「淑女シリーズ（女装）」を身に着けてきな！（サンドブーツ・スノーブーツ・雷鳴の兜の組合せでも通せるぞ）',
        ],
      };
    }
    return {
      speakerName: 'ゲルドの門番',
      roleTitle: 'ゲルドの街 衛兵',
      lines: [
        'サヴォッタ！可愛らしいヴァーイ（女性）だね。',
        '砂漠の昼は40〜50℃超えの猛暑、夜は氷点下だ。気化冷却の水路で体を冷やしていきな！',
      ],
    };
  }

  // 3. Naked / Unequipped All 3 Armor Slots EventFlow Branch!
  if (ctx.isNaked) {
    if (npc.id === 'npc_paya') {
      return {
        speakerName: 'パーヤ',
        roleTitle: 'インパの孫娘（カカリコ村）',
        lines: [
          'ひゃああああっ！？ リ、リンク様っ！お召し物を着てくださいませっ！！',
          'わ、私、直視できませんっ……！（顔を真っ赤にして両手で覆っている）',
        ],
      };
    }
    if (npc.id === 'npc_bolson') {
      return {
        speakerName: 'サクラダ',
        roleTitle: 'サクラダ工務店 棟梁',
        lines: [
          'あらヤダ！あなた、随分と開放的なスタイルね〜っ！',
          'でも筋肉のラインは悪くないわよ？ それよりマイホームとイチカラ村の「薪110本」、忘れてないわよね！',
        ],
      };
    }
    if (npc.id === 'npc_old_man') {
      const isKingRevealed = ctx.hasParaglider;
      return {
        speakerName: isKingRevealed ? 'ハイラル王ロームの霊' : '謎の老人',
        roleTitle: isKingRevealed ? '最後のハイラル王' : '始まりの台地',
        lines: isKingRevealed
          ? [
              'ほっほっほ……パラセールを託した後も、裸で台地を駆け回るとはなかなかの豪傑じゃな！',
              'この先の雪山や火山では防寒着や耐火装備も忘れずにな。ハイラルの未来を頼んだぞ、リンク！',
            ]
          : [
              'ほっほっほ……目を覚ましたばかりとはいえ、何も着ずに外を歩くとは大胆な若者じゃな！',
              '回生の祠の中の宝箱には服が残っていたはずじゃし、この台地の北にある4つの祠を巡ればパラセールも授けようぞ。',
            ],
        choices: isKingRevealed
          ? [{ label: '『ハイラル王の手記』を読む', action: 'read_king_journal' }]
          : [
              {
                label: ctx.plateauShrinesDone ? '4つの祠を制覇した（パラセールを受け取る）' : '4つの祠とパラセールについて聞く',
                action: 'grant_paraglider',
              },
            ],
      };
    }
    if (npc.id === 'npc_purah') {
      return {
        speakerName: 'プルア',
        roleTitle: 'ハテノ古代研究所 所長',
        lines: [
          'チェッキー☆ ……って、あらヤダ！？ リンクくん何も着てないじゃないの！！',
          ctx.hasCameraRune
            ? 'せめて何か羽織ってよね〜！ ウツシエとハイラル図鑑の調査は引き続き頼んだわよ！'
            : 'まあ古代研究に服は関係ないか！ 欠損している「ウツシエ」を今すぐシーカーストーンに復旧してあげる！',
        ],
        choices: ctx.hasCameraRune
          ? undefined
          : [{ label: 'ウツシエ（写真・図鑑機能）を起動する', action: 'unlock_camera_rune' }],
      };
    }
    return {
      speakerName: npc.nameJa,
      roleTitle: npc.roleJa,
      lines: [
        'うわっ！？ おいおい、なんで裸なんだ！？',
        '風邪をひく前にポーチから防具を装備した方がいいぞ！',
      ],
    };
  }

  // 4. Fearful Armor Set Reaction (Dark Link / Tingle / Phantom Ganon / Radiant Bone)
  if (ctx.triggersNpcFear && npc.id !== 'npc_old_man' && npc.id !== 'npc_impa') {
    return {
      speakerName: npc.nameJa,
      roleTitle: npc.roleJa,
      lines: [
        'ひぃっ！！ な、なんだその不気味な姿は……！？魔物か！？',
        'お、驚かせないでくれよ……心臓が止まるかと思ったぞ！',
      ],
    };
  }

  // 5. Blood Moon Special Dialogue (Hino at Dueling Peaks Stable!)
  if (npc.id === 'npc_hino' && ctx.isBloodMoon) {
    return {
      speakerName: 'ヒノックス研究家 ヒノ',
      roleTitle: '双子馬宿・赤い月観測者',
      lines: [
        'おおおおおっ！！来たぞぉぉぉっ！！赤い月だぁぁっ！！',
        '23:30〜0:15の今なら料理が100%大成功するぞ！そして午前0時には魔物が蘇る……最高だぁぁ！！',
      ],
    };
  }

  // 6. Named Story & Village NPCs with Time-of-day & Rain EventFlow branches!
  if (npc.id === 'npc_old_man') {
    const isKingRevealed = ctx.hasParaglider;
    return {
      speakerName: isKingRevealed ? 'ハイラル王ロームの霊' : '謎の老人',
      roleTitle: isKingRevealed ? '最後のハイラル王' : '始まりの台地',
      lines: isKingRevealed
        ? [
            'ほっほっほ……ついに4つの試練を乗り越えたか、リンク。わしの真の名はローム・ボスフォレームス・ハイラル。',
            'パラセールがあれば高台から広大なハイラルへ飛び立てる。草原に火を放てば上昇気流にも乗れるぞ。さあ、カカリコ村のインパを訪ねよ！',
          ]
        : [
            ctx.isRaining
              ? 'おお、雨が降ってきたのう。濡れた崖は登る途中で滑ってしまうから、焚き火のそばで雨が上がるのを待つのも手じゃ。'
              : 'ようこそ目覚めたな、若者よ。この台地の北にそびえる古城と、周囲の塔や遺跡に興味があるのかのう？',
            ctx.plateauShrinesDone
              ? 'おお……始まりの台地にある4つの試練の祠をすべて踏破したか！約束どおり、時の神殿跡の屋根でも語った「パラセール」と真実を授けよう！'
              : 'かつてこの台地にはシーカーの試練を司る祠が4つ眠っておった。まずはすべての祠を巡り、克服の証を集めてくるのじゃ！',
          ],
      choices: isKingRevealed
        ? [{ label: '『ハイラル王の手記』を読む', action: 'read_king_journal' }]
        : [
            {
              label: ctx.plateauShrinesDone ? '4つの祠の踏破を報告し、パラセールを受け取る' : '4つの祠とパラセールについて聞く',
              action: 'grant_paraglider',
            },
          ],
    };
  }

  if (npc.id === 'npc_purah') {
    return {
      speakerName: 'プルア',
      roleTitle: 'ハテノ古代研究所 所長',
      lines: [
        'チェッキー☆ ……おや？ そのシーカーストーン、古代技術研究者のあたしが放っておくわけにはいかないわね！',
        ctx.hasCameraRune
          ? 'ウツシエとシーカーセンサー＋は順調？ 魔物や素材を撮ってハイラル図鑑を埋めてきてちょうだい！'
          : '基本ルーンだけじゃ物足りないでしょ？ 欠損している「ウツシエ」を今すぐシーカーストーンに復旧してあげる！',
      ],
      choices: ctx.hasCameraRune
        ? undefined
        : [{ label: 'ウツシエ（写真・図鑑機能）を起動する', action: 'unlock_camera_rune' }],
    };
  }

  if (npc.id === 'npc_paya') {
    const routineLine =
      ctx.timeHours >= 8 && ctx.timeHours < 19
        ? '今は屋敷で代々伝わるシーカーの宝珠を磨いております。'
        : ctx.timeHours >= 19 || ctx.timeHours < 1
        ? ctx.isRaining
          ? '雨の夜ですので、窓辺から静かに村の景色を眺めております……'
          : '夜は屋外の守護像へ、リンク様のご無事をお祈りしているのです。'
        : '夜更けにこっそり日記を綴っておりました……見ないでくださいませ！';
    return {
      speakerName: 'パーヤ',
      roleTitle: 'カカリコ村・インパの孫娘',
      lines: [
        'あ、リンク様！お会いできて光栄でございますっ！',
        routineLine,
      ],
      choices: [{ label: '『パーヤの日記』を覗く', action: 'read_paya_diary' }],
    };
  }

  if (npc.id === 'npc_impa') {
    return {
      speakerName: 'インパ',
      roleTitle: 'カカリコ村 長老',
      lines: [
        `リンクよ、よくぞ参った。現在取り戻したウツシエの記憶は ${ctx.memoriesCount} / 23 じゃ。`,
        '1万年前の厄災、そして100年前の大厄災の真実……4体の神獣を解放し、ハイラル城のゼルダ姫を救い出すのじゃ！',
      ],
      choices: [
        { label: 'ウツシエの記憶と三層歴史を聞く', action: 'open_adventure_log' },
        { label: '『ゼルダの日記』の記録を確認', action: 'read_zelda_diary' },
      ],
    };
  }

  if (npc.id === 'npc_dorian') {
    return {
      speakerName: 'ドゥラン',
      roleTitle: 'カカリコ村 門番',
      lines:
        ctx.timeHours >= 22 || ctx.timeHours < 4
          ? ['……今夜は丘の上で片付けねばならぬ用がある。イーガ団の影が近づいているのだ……。（ほこらチャレンジ「盗まれた宝珠」）']
          : ['娘のココナとプリコを守るため、俺はインパ様のお屋敷を警護している。'],
    };
  }

  if (npc.id === 'npc_bolson') {
    return {
      speakerName: 'サクラダ ＆ エノキダ',
      roleTitle: 'ハテノ村・サクラダ工務店',
      lines: [
        `ハテノ村のマイホームとイチカラ村の開拓（現在ステージ ${ctx.tarreyTownStage}/5）は順調よ！`,
        '薪の束110本と、名前に「ダ」がつく職人たち（ゴロン・ゲルド・リト・ゾーラ）を集めれば、アッカレに素敵なイチカラ村と結婚式が完成するわ！',
      ],
      choices: [
        { label: 'イチカラ村の建設を進める（薪・職人支援）', action: 'advance_tarrey_town' },
        { label: '染色屋（東風屋）で防具を15色染色する', action: 'open_dye_shop' },
      ],
    };
  }

  if (npc.id === 'npc_kass') {
    return {
      speakerName: 'カッシーワ',
      roleTitle: 'さすらいの吟遊詩人（リト族）',
      lines: [
        '♪〜 師匠が残した古詩を奏でております。ハイラル各地の8つの古詩と『英傑たちの詩』を聴いていかれますか？',
        'すべての祠の試練を解き明かした時、私は家族の待つリトの村へ帰るつもりです。',
      ],
    };
  }

  if (npc.id === 'npc_great_fairy') {
    return {
      speakerName: '大妖精クチューラ',
      roleTitle: '大妖精の泉',
      lines: [
        'あら〜可愛い坊や！私の力であなたの防具を★1〜★4まで強化してあげるわ！',
        '3部位すべて★2以上にすれば、強力なセットボーナスが発動するわよ〜！',
      ],
      choices: [{ label: '防具を強化してもらう（大妖精強化画面）', action: 'open_fairy_upgrade' }],
    };
  }

  // 7. All 15 Traveling Merchants with Rain Exclusive Stock (Beris) & Rain 10-Rupee Discount (Paragus)!
  if (npc.isMerchant) {
    const discount = ctx.isRaining && npc.merchantDiscountOnRain ? 10 : 0;
    const baseItems: Array<{ id: string; nameJa: string; price: number; rainExclusive?: boolean }> = [
      { id: 'apple', nameJa: 'リンゴ', price: Math.max(5, 15 - discount) },
      { id: 'spicy_pepper', nameJa: 'ポカポカ草の実', price: Math.max(5, 20 - discount) },
      { id: 'hearty_durian', nameJa: 'マックスドリアン', price: Math.max(15, 45 - discount) },
      { id: 'wood', nameJa: '薪の束', price: Math.max(5, 18 - discount) },
      { id: 'arrow_bundle', nameJa: '木の矢 ×10', price: Math.max(10, 35 - discount) },
    ];
    if (ctx.isRaining && npc.merchantRainAncientStock) {
      baseItems.push(
        { id: 'ancient_shaft', nameJa: '【雨天限定】古代のシャフト', price: 120, rainExclusive: true },
        { id: 'ancient_core', nameJa: '【雨天限定】古代のコア', price: 320, rainExclusive: true }
      );
    }
    return {
      speakerName: npc.nameJa,
      roleTitle: npc.roleJa,
      lines: [
        ctx.isRaining && npc.merchantRainAncientStock
          ? '雨の日だけの特別品「古代のシャフト」「古代のコア」を出してるよ！見てってくれ！'
          : ctx.isRaining && npc.merchantDiscountOnRain
          ? '雨宿りついでに大サービス！今だけ全品10ルピー引きだよ！'
          : `いらっしゃい！${npc.nameJa}の行商へようこそ！（矢は所持50本未満で午前0時に再補充されるよ）`,
      ],
      shopItems: baseItems,
    };
  }

  // Generic atmospheric villager with weather awareness
  return {
    speakerName: npc.nameJa,
    roleTitle: npc.roleJa,
    lines: [
      ctx.isRaining
        ? 'おっと、雨だ！軒下へ避難しないとびしょ濡れになっちまう！'
        : `やあ旅の人！ここは${npc.roleJa}さ。ハイラル全土の15の塔と祠、そして4体の神獣が君を待っているよ！`,
    ],
  };
}

/**
 * All 33 Official BotW Korok Seed Puzzle Archetypes!
 */
export const KOROK_33_PUZZLE_TYPES: Array<{ code: string; nameJa: string }> = [
  { code: 'lift_rock', nameJa: '石を持ち上げる' },
  { code: 'stone_circle', nameJa: '石の模様（輪）を完成させる' },
  { code: 'metal_cube', nameJa: '鉄キューブのマグネパズル' },
  { code: 'diving_ring', nameJa: '水面の蓮の輪へ飛び込む' },
  { code: 'sparkle_chase', nameJa: '走り回るキラキラに触れる' },
  { code: 'flower_trail', nameJa: '黄色い花を順番に追う' },
  { code: 'pinwheel_balloons', nameJa: '風車のそばの風船を射抜く' },
  { code: 'boulder_hole', nameJa: '大岩を穴へ落とす' },
  { code: 'ice_melt', nameJa: '氷塊を炎で溶かす' },
  { code: 'apple_offer', nameJa: '地蔵へリンゴをお供えする' },
  { code: 'matching_trees', nameJa: '3本並びの木の実を揃える' },
  { code: 'race_ring', nameJa: '切り株から制限時間内に光の輪へ到達' },
  { code: 'acorn_shoot', nameJa: '揺れるドングリを射抜く' },
  { code: 'burn_leaves', nameJa: '落ち葉の山を燃やす' },
  { code: 'archery_emblem', nameJa: '盾紋章の的を射抜く' },
  { code: 'tallest_peak', nameJa: '最頂点のキラキラを調べる' },
  { code: 'tree_branch_stick', nameJa: '橋下の枝を拾う' },
  { code: 'stone_stack_break', nameJa: '積み岩を破壊する' },
  { code: 'metal_chain_ball', nameJa: '鎖鉄球を穴に入れる' },
  { code: 'stasis_golf', nameJa: 'ビタロックで岩を崖上へ飛ばす' },
  { code: 'snowball_roll', nameJa: '雪玉を大きくして扉/穴へ転がす' },
  { code: 'light_chase_fairy', nameJa: '浮遊する光の粒を追う' },
  { code: 'banana_offer', nameJa: 'ゲルド像へツルギバナナを供える' },
  { code: 'egg_offer', nameJa: 'カカリコ像へトリのタマゴを供える' },
  { code: 'rusty_shield_offer', nameJa: '錆びた盾を供える' },
  { code: 'flower_order_count', nameJa: '花びらの数（1→5）順に歩く' },
  { code: 'burn_thorns', nameJa: 'イバラを燃やして石を持ち上げる' },
  { code: 'boulder_lift_slab', nameJa: 'ビタロック/オクタ風船で石板を退かす' },
  { code: 'horse_fence_jump', nameJa: '馬で3連柵を跳び越える' },
  { code: 'bridge_lantern', nameJa: '橋柱の上を調べる' },
  { code: 'shrine_roof_sparkle', nameJa: '建造物の尖塔てっぺんを調べる' },
  { code: 'pot_break_tree', nameJa: '木のウロのツボを割る' },
  { code: 'durian_offer', nameJa: 'フィローネ像へマックスドリアンを供える' },
];

/**
 * Manages ALL Hyrule NPCs (24h/Weather autonomous life AI + 15 Traveling Merchants + 16 Yiga Disguised Travelers),
 * Interactive Korok Puzzles (all 33 types!), and Animated Wildlife/Mounts (Horses, Foxes, Birds)!
 */
export class NpcAndKorokSystem {
  public readonly group = new THREE.Group();
  public npcs: WorldNpc[] = [];
  public koroks: WorldKorok[] = [];
  public wildlife: WildlifeEntity[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'HyruleNpcsKoroksWildlife';
    scene.add(this.group);
  }

  populateAll(foundKoroks: string[]): void {
    while (this.group.children.length > 0) this.group.remove(this.group.children[0]);
    this.npcs = [];
    this.koroks = [];
    this.wildlife = [];

    this.spawnStoryAndVillageNpcs();
    this.spawnAll15Merchants();
    this.spawn16YigaDisguisedTravelers();
    this.spawnKoroks(foundKoroks);
    this.spawnWildlifeAndHorses();
  }

  private addNpc(spec: {
    id: string;
    nameJa: string;
    displayNameJa?: string;
    roleJa: string;
    region: RegionId;
    x: number;
    z: number;
    glbKey: string;
    wakeHour?: number;
    sleepHour?: number;
    isChild?: boolean;
    isMerchant?: boolean;
    isYigaDisguised?: boolean;
    merchantDiscountOnRain?: boolean;
    merchantRainAncientStock?: boolean;
    tintColor?: string;
  }): void {
    const y = getTerrainHeight(spec.x, spec.z);
    const root = new THREE.Group();
    root.position.set(spec.x, y, spec.z);

    const scaleMultiplier = spec.isChild ? 0.72 : 1.0;
    const glb = modelLoader.instantiate(spec.glbKey, {
      scaleMultiplier,
      tintColor: spec.tintColor,
    });
    let fallbackGroup: THREE.Group | null = null;
    if (glb) {
      root.add(glb.root);
    } else {
      fallbackGroup = this.buildStylizedNpcFallback(spec.tintColor ?? '#5b7aa8', scaleMultiplier, spec.glbKey === 'npc_mage');
      root.add(fallbackGroup);
    }

    this.group.add(root);

    this.npcs.push({
      id: spec.id,
      nameJa: spec.nameJa,
      displayNameJa: spec.displayNameJa ?? spec.nameJa,
      roleJa: spec.roleJa,
      region: spec.region,
      homePos: new THREE.Vector3(spec.x, y, spec.z),
      shelterPos: new THREE.Vector3(spec.x + 4.5, getTerrainHeight(spec.x + 4.5, spec.z + 2.5), spec.z + 2.5),
      nightPos: new THREE.Vector3(spec.x - 3.5, getTerrainHeight(spec.x - 3.5, spec.z - 3.0), spec.z - 3.0),
      position: new THREE.Vector3(spec.x, y, spec.z),
      yaw: 0,
      wakeHour: spec.wakeHour ?? (spec.isChild ? 7.5 : 5.5), // Parents wake earlier than children!
      sleepHour: spec.sleepHour ?? (spec.isChild ? 20.5 : 22.0),
      isChild: spec.isChild,
      isMerchant: spec.isMerchant,
      isYigaDisguised: spec.isYigaDisguised,
      merchantDiscountOnRain: spec.merchantDiscountOnRain,
      merchantRainAncientStock: spec.merchantRainAncientStock,
      glbKey: spec.glbKey,
      tintColor: spec.tintColor,
      scaleMultiplier,
      root,
      fallbackGroup,
      glbInstance: glb,
      behaviorLabel: '活動中',
    });
  }

  /**
   * Sculpted multi-part Hylian NPC placeholder displayed cleanly while heavy animated character GLBs stream in background.
   */
  private buildStylizedNpcFallback(tunicHex: string, scale: number, hooded: boolean): THREE.Group {
    const g = new THREE.Group();
    g.scale.setScalar(scale);
    const tunicMat = createBotWToonMaterial({ color: tunicHex, rimStrength: 0.34 });
    const leatherMat = createBotWToonMaterial({ color: '#5c3c24', rimStrength: 0.24 });
    const skinMat = createBotWToonMaterial({ color: '#f3cfa6', warmSkinShadow: true, rimStrength: 0.26 });
    const hairMat = createBotWToonMaterial({ color: hooded ? tunicHex : '#4a3a2c', rimStrength: 0.32 });

    // Boots & legs
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.44, 6, 10), leatherMat);
      leg.position.set(s * 0.11, 0.32, 0);
      leg.castShadow = true;
      g.add(leg);
    }

    // Tunic coat / cloak skirt
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.56, 12), tunicMat);
    skirt.position.y = 0.68;
    skirt.castShadow = true;
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.32, 8, 12), tunicMat);
    chest.position.y = 1.06;
    chest.scale.set(1.12, 1.0, 0.85);
    chest.castShadow = true;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 14), leatherMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.90;
    g.add(skirt, chest, belt);

    // Arms & hands
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.40, 6, 10), tunicMat);
      arm.position.set(s * 0.25, 1.04, 0.02);
      arm.rotation.z = s * 0.16;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), skinMat);
      hand.position.set(s * 0.29, 0.80, 0.04);
      g.add(arm, hand);
    }

    // Head + hair/hood
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), skinMat);
    head.position.y = 1.46;
    head.castShadow = true;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(hooded ? 0.182 : 0.166, 14, 10, 0, Math.PI * 2, 0, Math.PI * (hooded ? 0.72 : 0.56)),
      hairMat
    );
    crown.position.set(0, 1.48, -0.015);
    g.add(head, crown);

    return g;
  }

  /**
   * Seamlessly hot-swaps any NPCs or Wildlife matching a freshly background-loaded GLB key
   * while preserving exact world position, AI schedule state, and animation playback!
   */
  public hotSwapModel(key: string): number {
    let swapped = 0;
    for (const npc of this.npcs) {
      if (npc.glbKey !== key || npc.glbInstance) continue;
      const glb = modelLoader.instantiate(key, {
        scaleMultiplier: npc.scaleMultiplier,
        tintColor: npc.tintColor,
      });
      if (!glb) continue;
      if (npc.fallbackGroup) {
        npc.root.remove(npc.fallbackGroup);
        npc.fallbackGroup = null;
      }
      npc.root.add(glb.root);
      npc.glbInstance = glb;
      glb.playClip('idle');
      swapped++;
    }
    for (const w of this.wildlife) {
      if (w.glbKey !== key || w.glb) continue;
      const glb = modelLoader.instantiate(key);
      if (!glb) continue;
      w.root.add(glb.root);
      glb.playClip(w.type === 'stork' || w.type === 'parrot' ? 'run' : 'walk');
      w.glb = glb;
      swapped++;
    }
    return swapped;
  }

  private spawnStoryAndVillageNpcs(): void {
    // Old Man / King Rhoam right along path from Shrine of Resurrection -> Temple of Time (great for immediate NPC dialogue!)
    this.addNpc({ id: 'npc_old_man', nameJa: '謎の老人', roleJa: '始まりの台地の導き手', region: 'great_plateau', x: -286, z: 458, glbKey: 'npc_mage', tintColor: '#5c4d3e', wakeHour: 0, sleepHour: 24 });
    this.addNpc({ id: 'npc_pikango_gp', nameJa: 'カンギス (Pikango)', roleJa: '旅の絵描き（記憶ヒント）', region: 'great_plateau', x: -234, z: 486, glbKey: 'npc_traveler', tintColor: '#c49654' });

    // Kakariko Village iconic schedule NPCs
    this.addNpc({ id: 'npc_impa', nameJa: 'インパ', roleJa: 'カカリコ村 長老', region: 'dueling_peaks', x: 430, z: 256, glbKey: 'npc_mage', tintColor: '#9c3e48' });
    this.addNpc({ id: 'npc_paya', nameJa: 'パーヤ', roleJa: 'インパの孫娘', region: 'dueling_peaks', x: 435, z: 263, glbKey: 'npc_rogue', tintColor: '#c87298', wakeHour: 6, sleepHour: 24 });
    this.addNpc({ id: 'npc_dorian', nameJa: 'ドゥラン (Dorian)', roleJa: 'カカリコ村 門番', region: 'dueling_peaks', x: 422, z: 268, glbKey: 'npc_knight', tintColor: '#3a4a68', wakeHour: 5, sleepHour: 24 });
    this.addNpc({ id: 'npc_koko', nameJa: 'ココナ (Koko)', roleJa: '料理好きの姉', region: 'dueling_peaks', x: 441, z: 270, glbKey: 'npc_rogue', isChild: true, tintColor: '#e2885c' });
    this.addNpc({ id: 'npc_cottla', nameJa: 'プリコ (Cottla)', roleJa: 'ココナの妹', region: 'dueling_peaks', x: 444, z: 272, glbKey: 'npc_rogue', isChild: true, tintColor: '#e8b05c' });
    this.addNpc({ id: 'npc_great_fairy', nameJa: '大妖精クチューラ', roleJa: '大妖精の泉（防具強化）', region: 'dueling_peaks', x: 510, z: 215, glbKey: 'npc_mage', tintColor: '#f27ab8', wakeHour: 0, sleepHour: 24 });

    // Hateno, Stables, Champions' Successors, Kass, Gerudo Guard, Rohan
    this.addNpc({ id: 'npc_bolson', nameJa: 'サクラダ ＆ カツラダ', roleJa: 'サクラダ工務店（ハテノ村）', region: 'hateno', x: 954, z: 575, glbKey: 'npc_barbarian', tintColor: '#e26a9c' });
    this.addNpc({ id: 'npc_purah', nameJa: 'プルア', roleJa: 'ハテノ古代研究所 所長', region: 'hateno', x: 1114, z: 545, glbKey: 'npc_mage', isChild: true, tintColor: '#d95448' });
    this.addNpc({ id: 'npc_robbie', nameJa: 'ロベリー', roleJa: 'アッカレ古代研究所', region: 'akkala', x: 1285, z: -955, glbKey: 'npc_mage', tintColor: '#38b2e8' });
    this.addNpc({ id: 'npc_sidon', nameJa: 'シド王子', roleJa: 'ゾーラの里 王子', region: 'lanayru', x: 960, z: -120, glbKey: 'npc_knight', tintColor: '#d93848' });
    this.addNpc({ id: 'npc_riju', nameJa: 'ルージュ族長', roleJa: 'ゲルドの街 族長', region: 'wasteland', x: -1060, z: 846, glbKey: 'npc_mage', isChild: true, tintColor: '#e6b842' });
    this.addNpc({ id: 'npc_gerudo_guard', nameJa: 'ゲルドの門番', roleJa: 'ゲルドの街 衛兵', region: 'wasteland', x: -1060, z: 892, glbKey: 'npc_knight', tintColor: '#c48642', wakeHour: 0, sleepHour: 24 });
    this.addNpc({ id: 'npc_teba', nameJa: 'テバ', roleJa: 'リトの村 戦士', region: 'tabantha', x: -1072, z: -416, glbKey: 'npc_rogue', tintColor: '#e8eef5' });
    this.addNpc({ id: 'npc_yunobo', nameJa: 'ユン坊', roleJa: 'ゴロンシティ ダルケルの子孫', region: 'eldin', x: 454, z: -754, glbKey: 'npc_barbarian', tintColor: '#c89254' });
    this.addNpc({ id: 'npc_kass', nameJa: 'カッシーワ', roleJa: '吟遊詩人（古詩8連作）', region: 'dueling_peaks', x: 248, z: 446, glbKey: 'npc_traveler', tintColor: '#3886c4', wakeHour: 0, sleepHour: 24 });
    this.addNpc({ id: 'npc_hino', nameJa: 'ヒノ', roleJa: '双子馬宿・赤い月観測者', region: 'dueling_peaks', x: 468, z: 545, glbKey: 'npc_traveler', tintColor: '#8c4252', wakeHour: 0, sleepHour: 24 });
    this.addNpc({ id: 'npc_rohan', nameJa: 'ロハン (Rohan)', roleJa: '朝寝坊の鍛冶職人', region: 'eldin', x: 442, z: -764, glbKey: 'npc_barbarian', wakeHour: 10.5, sleepHour: 21 });
  }

  /**
   * Spawns ALL 15 official BotW Traveling Merchants with rain-exclusive stock & rain discounts!
   */
  private spawnAll15Merchants(): void {
    const merchants: Array<{ id: string; name: string; region: RegionId; x: number; z: number; rainAncient?: boolean; rainDiscount?: boolean }> = [
      { id: 'm_terry', name: 'テリー (Beedle)', region: 'dueling_peaks', x: 454, z: 536 },
      { id: 'm_bugli', name: 'ブグリ', region: 'central_hyrule', x: -195, z: 245 },
      { id: 'm_giroccho', name: 'ギロッチョ', region: 'central_hyrule', x: 145, z: 230 },
      { id: 'm_bongo', name: 'ボンゴ', region: 'hateno', x: 745, z: 525 },
      { id: 'm_cambo', name: 'カンボ', region: 'dueling_peaks', x: 355, z: 485 },
      { id: 'm_beris', name: 'ベリス (Botrick)', region: 'central_hyrule', x: -435, z: 285, rainAncient: true },
      { id: 'm_paragus', name: 'パラガス (Mezer)', region: 'hateno', x: 865, z: 560, rainDiscount: true },
      { id: 'm_chumin', name: 'チューミン', region: 'lanayru', x: 365, z: -15 },
      { id: 'm_chario', name: 'チャリオ', region: 'woodland', x: 255, z: -415 },
      { id: 'm_udo', name: 'ウドー', region: 'eldin', x: 625, z: -390 },
      { id: 'm_enashima', name: 'エナシマ', region: 'akkala', x: 970, z: -260 },
      { id: 'm_yammo', name: 'ヤム', region: 'ridgeland', x: -795, z: -115 },
      { id: 'm_matsu', name: 'マッツ', region: 'tabantha', x: -955, z: -430 },
      { id: 'm_mapin', name: 'マピン', region: 'lake', x: 170, z: 915 },
      { id: 'm_garaton', name: 'ガラトン', region: 'wasteland', x: -735, z: 550 },
    ];
    for (const m of merchants) {
      this.addNpc({
        id: m.id,
        nameJa: m.name,
        roleJa: m.rainAncient ? '行商人（雨天限定・古代素材取扱）' : m.rainDiscount ? '行商人（雨天10ルピー割引）' : '街道の行商人',
        region: m.region,
        x: m.x,
        z: m.z,
        glbKey: 'npc_traveler',
        isMerchant: true,
        merchantRainAncientStock: m.rainAncient,
        merchantDiscountOnRain: m.rainDiscount,
        tintColor: '#669458',
      });
    }
  }

  /**
   * Spawns all 16 fixed roadside disguised Yiga Clan "旅人" (Traveler) ambush NPCs!
   */
  private spawn16YigaDisguisedTravelers(): void {
    const spots: Array<[RegionId, number, number]> = [
      ['great_plateau', -168, 412],
      ['central_hyrule', -290, 210],
      ['central_hyrule', -65, 110],
      ['dueling_peaks', 290, 445],
      ['dueling_peaks', 410, 345],
      ['hateno', 680, 540],
      ['lanayru', 580, -35],
      ['akkala', 945, -365],
      ['eldin', 595, -455],
      ['woodland', 180, -360],
      ['ridgeland', -570, -180],
      ['tabantha', -910, -290],
      ['hebra', -610, -760],
      ['gerudo_highlands', -920, 410],
      ['wasteland', -780, 680],
      ['faron', 420, 880],
    ];
    spots.forEach(([reg, x, z], i) => {
      this.addNpc({
        id: `yiga_disguise_${i + 1}`,
        nameJa: `イーガ団変装者#${i + 1}`,
        displayNameJa: '旅人', // Authentic BotW clue: generic "旅人" name instead of a proper name!
        roleJa: '街道の旅人',
        region: reg,
        x,
        z,
        glbKey: 'npc_traveler',
        isYigaDisguised: true,
        tintColor: '#7a685c',
        wakeHour: 0,
        sleepHour: 24,
      });
    });
  }

  /**
   * Spawns interactive Korok puzzles representing ALL 33 official Korok puzzle types across all 15 Regions!
   */
  private spawnKoroks(foundIds: string[]): void {
    const leafMat = createBotWToonMaterial({ color: '#68b842', rimStrength: 0.45 });
    const woodMat = createBotWToonMaterial({ color: '#8f6a44' });
    const sparkleMat = new THREE.MeshBasicMaterial({ color: '#fff07a', transparent: true, opacity: 0.85 });

    KOROK_33_PUZZLE_TYPES.forEach((ptype, idx) => {
      // Place first 3 on Great Plateau for immediate discovery, rest distributed across all 15 Regions
      let x: number;
      let z: number;
      let regId: RegionId;
      if (idx === 0) {
        regId = 'great_plateau';
        x = -268;
        z = 445;
      } else if (idx === 1) {
        regId = 'great_plateau';
        x = -210;
        z: 488;
        z = 488;
      } else if (idx === 2) {
        regId = 'great_plateau';
        x = -322;
        z = 482;
      } else {
        const reg = REGION_LIST[idx % REGION_LIST.length];
        regId = reg.id;
        const a = idx * 2.39996;
        const r = 45 + (idx * 29) % 130;
        x = reg.center.x + Math.cos(a) * r;
        z = reg.center.z + Math.sin(a) * r;
      }

      const id = `korok_${idx + 1}_${ptype.code}`;
      const y = getTerrainHeight(x, z);
      const found = foundIds.includes(id);

      const root = new THREE.Group();
      root.position.set(x, y, z);

      // Puzzle visual prop (stone ring / pinwheel / sparkle flower)
      const marker = new THREE.Mesh(
        idx % 3 === 0 ? new THREE.DodecahedronGeometry(0.52, 0) : idx % 3 === 1 ? new THREE.TorusGeometry(0.9, 0.12, 6, 12) : new THREE.OctahedronGeometry(0.38, 0),
        idx % 3 === 0 ? createBotWToonMaterial({ color: '#8c867a' }) : sparkleMat
      );
      marker.position.y = idx % 3 === 1 ? 0.18 : 0.45;
      if (idx % 3 === 1) marker.rotation.x = Math.PI / 2;
      root.add(marker);

      // Cute Korok popping up when found ("Yahaha!")
      const korokMesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 6, 8), woodMat);
      body.position.y = 0.42;
      const leafMask = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.06, 7), leafMat);
      leafMask.rotation.x = Math.PI / 2;
      leafMask.position.set(0, 0.56, 0.22);
      korokMesh.add(body, leafMask);
      korokMesh.visible = found;
      root.add(korokMesh);

      this.group.add(root);
      this.koroks.push({
        id,
        puzzleType: ptype.code,
        puzzleNameJa: ptype.nameJa,
        region: regId,
        position: new THREE.Vector3(x, y, z),
        found,
        root,
        korokMesh,
      });
    });
  }

  /**
   * Spawns animated CC0/MIT Hyrule Wildlife & Tameable Horses (`horse.glb`, `fox.glb`, `bird_stork.glb`, `bird_parrot.glb`)!
   */
  private spawnWildlifeAndHorses(): void {
    const specs: Array<{ type: WildlifeEntity['type']; x: number; z: number; key: string; speed: number }> = [
      { type: 'horse', x: -205, z: 432, key: 'horse', speed: 4.5 },
      { type: 'horse', x: -180, z: 185, key: 'horse', speed: 4.8 },
      { type: 'horse', x: 430, z: 525, key: 'horse', speed: 4.6 },
      { type: 'fox', x: -260, z: 472, key: 'fox', speed: 3.4 },
      { type: 'fox', x: -222, z: 462, key: 'fox', speed: 3.2 },
      { type: 'fox', x: 410, z: 270, key: 'fox', speed: 3.3 },
      { type: 'stork', x: -240, z: 450, key: 'bird_stork', speed: 8.5 },
      { type: 'stork', x: -120, z: 100, key: 'bird_stork', speed: 9.0 },
      { type: 'parrot', x: 450, z: 860, key: 'bird_parrot', speed: 8.0 },
    ];

    specs.forEach((sp, i) => {
      const y = getTerrainHeight(sp.x, sp.z) + (sp.type === 'stork' || sp.type === 'parrot' ? 22 : 0);
      const root = new THREE.Group();
      root.position.set(sp.x, y, sp.z);
      const glb = modelLoader.instantiate(sp.key);
      if (glb) {
        root.add(glb.root);
        glb.playClip(sp.type === 'stork' || sp.type === 'parrot' ? 'run' : 'walk');
      }
      this.group.add(root);

      this.wildlife.push({
        id: `wild_${sp.type}_${i}`,
        type: sp.type,
        glbKey: sp.key,
        position: new THREE.Vector3(sp.x, y, sp.z),
        homePos: new THREE.Vector3(sp.x, y, sp.z),
        yaw: Math.random() * Math.PI * 2,
        speed: sp.speed,
        tamed: i === 0,
        bond: i === 0 ? 100 : 30,
        root,
        glb,
      });
    });
  }

  /**
   * Updates NPC 24-hour schedules, rain sheltering AI, Korok Mask rattle detection, and wildlife animations!
   */
  update(
    dt: number,
    timeSec: number,
    timeHours: number,
    weather: WeatherType,
    playerPos: THREE.Vector3
  ): { nearbyKorokDistance: number } {
    const isRaining = weather === 'rain' || weather === 'thunderstorm';

    for (const npc of this.npcs) {
      const distP = npc.position.distanceTo(playerPos);
      if (distP > 130) continue;

      npc.glbInstance?.mixer?.update(dt);

      // Autonomous 24h & Rain Shelter Target Selection!
      let target = npc.homePos;
      const awake = timeHours >= npc.wakeHour && timeHours < npc.sleepHour;
      if (isRaining && !npc.isYigaDisguised && npc.id !== 'npc_great_fairy') {
        target = npc.shelterPos;
        npc.behaviorLabel = '雨宿り中';
      } else if (!awake) {
        target = npc.nightPos;
        npc.behaviorLabel = '就寝・帰宅';
      } else if (npc.id === 'npc_paya') {
        if (timeHours >= 8 && timeHours < 19) {
          target = npc.homePos;
          npc.behaviorLabel = '宝珠磨き (8-19時)';
        } else if (timeHours >= 19 || timeHours < 1) {
          target = npc.shelterPos;
          npc.behaviorLabel = '守護像へ祈り (19-1時)';
        } else {
          target = npc.nightPos;
          npc.behaviorLabel = '日記執筆 (1時〜)';
        }
      } else if (npc.id === 'npc_dorian' && (timeHours >= 22 || timeHours < 4)) {
        target = npc.nightPos;
        npc.behaviorLabel = '夜間の丘へ移動';
      } else {
        npc.behaviorLabel = npc.isMerchant ? '行商巡回中' : '日中活動';
      }

      const toT = target.clone().sub(npc.position);
      toT.y = 0;
      const moveDist = toT.length();
      if (moveDist > 0.65 && distP > 4.0) {
        toT.normalize();
        const spd = isRaining ? 3.8 : 1.9; // Dash briskly under eaves when raining!
        npc.position.x += toT.x * spd * dt;
        npc.position.z += toT.z * spd * dt;
        npc.position.y = getTerrainHeight(npc.position.x, npc.position.z);
        npc.yaw = Math.atan2(toT.x, toT.z);
        npc.glbInstance?.playClip(isRaining ? 'run' : 'walk');
      } else {
        npc.position.y = getTerrainHeight(npc.position.x, npc.position.z);
        if (distP < 6.5) {
          // Turn warmly toward Link when nearby
          npc.yaw = Math.atan2(playerPos.x - npc.position.x, playerPos.z - npc.position.z);
        }
        npc.glbInstance?.playClip('idle');
      }

      npc.root.position.copy(npc.position);
      npc.root.rotation.y = npc.yaw;
    }

    // Wildlife & Birds wandering + flying orbits
    for (const w of this.wildlife) {
      w.glb?.mixer?.update(dt);
      if (w.type === 'stork' || w.type === 'parrot') {
        const a = timeSec * 0.25 + w.homePos.x * 0.01;
        w.position.x = w.homePos.x + Math.cos(a) * 38;
        w.position.z = w.homePos.z + Math.sin(a) * 38;
        w.position.y = w.homePos.y + Math.sin(a * 2.5) * 4.5;
        w.yaw = -a;
      } else if (w.position.distanceTo(playerPos) < 120) {
        const a = timeSec * 0.18 + w.homePos.z * 0.02;
        const tx = w.homePos.x + Math.cos(a) * 10;
        const tz = w.homePos.z + Math.sin(a) * 10;
        const dx = tx - w.position.x;
        const dz = tz - w.position.z;
        w.position.x += dx * dt * 0.6;
        w.position.z += dz * dt * 0.6;
        w.position.y = getTerrainHeight(w.position.x, w.position.z);
        w.yaw = Math.atan2(dx, dz);
      }
      w.root.position.copy(w.position);
      w.root.rotation.y = w.yaw;
    }

    // Korok Mask proximity check
    let nearestKorok = Infinity;
    for (const k of this.koroks) {
      if (k.found) {
        k.korokMesh.rotation.y += dt * 1.4;
        continue;
      }
      const d = k.position.distanceTo(playerPos);
      if (d < nearestKorok) nearestKorok = d;
    }

    return { nearbyKorokDistance: nearestKorok };
  }
}
