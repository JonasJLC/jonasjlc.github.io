/**
 * Common Danish dinner ingredients and how they are bought (idea 13). Data only: `purchase.ts` does the work.
 *
 * Package sizes are typical for Netto, Føtex, Rema 1000 and Lidl. They only have to be sensible: a household corrects a
 * wrong one with the unit picker on the shopping list (`sp_unit_preferences`), or by editing this table.
 *
 * Aliases are lower case and in `canonicalName` form (no parentheses, single spaces). An alias belongs to one entry only.
 */

export type Rule = 'count' | 'package' | 'weight' | 'pantry';
export type PackUnit = 'dåse' | 'bakke' | 'pakke' | 'bæger' | 'karton' | 'glas' | 'pose' | 'bundt' | 'net' | 'flaske' | 'tube';
export type Measure = 'g' | 'ml' | 'stk';

export type Ingredient = {
  /** Stable id, also stored in `sp_unit_preferences.ingredient_key`. Never rename one that has shipped. */
  key: string;
  /** Display name on the list, e.g. "Tomater". */
  name: string;
  /** Singular, plural and variants. */
  aliases: string[];
  rule: Rule;
  pack?: { unit: PackUnit; size: number; measure: Measure };
  /** Weight of one piece, for count <-> weight. */
  pieceGrams?: number;
  /** Grams in a level spoon, when it differs from water. */
  spoonGrams?: { tsk: number; spsk: number };
  /** Density, for a volume given for a weighed item (or grams of fruit per ml of juice). */
  gramsPerMl?: number;
  /** Extra recipe units in the ingredient's base measure: a "fed" is 0.1 of a garlic bulb. */
  per?: Record<string, number>;
  /** Pantry items bought for baking: above this many base units (g) they use their package rule instead. */
  pantryBelow?: number;
};

const count = (key: string, name: string, aliases: string[], pieceGrams: number, extra: Partial<Ingredient> = {}): Ingredient =>
  ({ key, name, aliases, rule: 'count', pieceGrams, ...extra });
const weight = (key: string, name: string, aliases: string[], pieceGrams: number, extra: Partial<Ingredient> = {}): Ingredient =>
  ({ key, name, aliases, rule: 'weight', pieceGrams, ...extra });
const pkg = (key: string, name: string, aliases: string[], unit: PackUnit, size: number, measure: Measure, extra: Partial<Ingredient> = {}): Ingredient =>
  ({ key, name, aliases, rule: 'package', pack: { unit, size, measure }, ...extra });
const pantry = (key: string, name: string, aliases: string[], extra: Partial<Ingredient> = {}): Ingredient =>
  ({ key, name, aliases, rule: 'pantry', ...extra });

const herb = { spoonGrams: { tsk: 1, spsk: 4 } };

export const ingredients: Ingredient[] = [
  // ---- Frugt & grønt, by the piece
  count('lime', 'Lime', ['lime', 'limes', 'limefrugt', 'limefrugter', 'limesaft', 'limeskal'], 70, { gramsPerMl: 2.3 }),
  count('citron', 'Citron', ['citron', 'citroner', 'citronsaft', 'citronskal'], 100, { gramsPerMl: 2 }),
  count('avocado', 'Avocado', ['avocado', 'avocadoer', 'avokado'], 200),
  count('løg', 'Løg', ['løg', 'gule løg', 'gult løg', 'zittauerløg'], 100),
  count('rødløg', 'Rødløg', ['rødløg', 'røde løg', 'rødt løg'], 100),
  count('skalotteløg', 'Skalotteløg', ['skalotteløg', 'skalotter'], 30),
  count('forårsløg', 'Forårsløg', ['forårsløg', 'foråsløg', 'grønne løg'], 15),
  count('hvidløg', 'Hvidløg', ['hvidløg', 'hvidløgsfed', 'fed hvidløg'], 50, { per: { fed: 0.1 } }),
  count('peberfrugt', 'Peberfrugt', ['peberfrugt', 'peberfrugter', 'peberfrugt rød', 'paprikafrugt'], 150),
  count('agurk', 'Agurk', ['agurk', 'agurker', 'slangeagurk'], 350),
  count('æg', 'Æg', ['æg', 'æggeblomme', 'æggeblommer', 'æggehvide', 'æggehvider'], 60),
  count('squash', 'Squash', ['squash', 'squasher', 'courgette', 'zucchini'], 300),
  count('aubergine', 'Aubergine', ['aubergine', 'auberginer'], 300),
  count('porre', 'Porre', ['porre', 'porrer'], 250),
  count('chili', 'Chili', ['chili', 'chilier', 'chilipeber', 'chilifrugt', 'jalapeño', 'jalapeno', 'jalapenos'], 15),
  count('ingefær', 'Ingefær', ['ingefær', 'frisk ingefær', 'ingefærrod'], 50, { per: { cm: 0.1 } }),
  count('broccoli', 'Broccoli', ['broccoli', 'broccolihoved', 'broccolibuketter'], 400),
  count('blomkål', 'Blomkål', ['blomkål', 'blomkålshoved'], 800),
  count('spidskål', 'Spidskål', ['spidskål'], 600),
  count('hvidkål', 'Hvidkål', ['hvidkål'], 1000),
  count('rødkål', 'Rødkål', ['rødkål'], 1000),
  count('salat', 'Salat', ['salat', 'salathoved', 'hjertesalat', 'icebergsalat', 'romainesalat', 'feldsalat'], 300),
  count('fennikel', 'Fennikel', ['fennikel', 'fennikler'], 250),
  count('bladselleri', 'Bladselleri', ['bladselleri', 'stangselleri', 'stilkselleri'], 400, { per: { stilk: 0.1, stilke: 0.1, stængel: 0.1, stængler: 0.1 } }),
  count('knoldselleri', 'Knoldselleri', ['knoldselleri', 'selleri', 'sellerirod'], 700),
  count('majskolbe', 'Majskolber', ['majskolbe', 'majskolber'], 250),
  count('græskar', 'Græskar', ['græskar', 'butternut', 'butternutsquash', 'hokkaido'], 1000),
  count('æble', 'Æbler', ['æble', 'æbler'], 150),
  count('pære', 'Pærer', ['pære', 'pærer'], 150),
  count('banan', 'Bananer', ['banan', 'bananer'], 120),
  count('appelsin', 'Appelsiner', ['appelsin', 'appelsiner', 'appelsinsaft'], 200, { gramsPerMl: 2.5 }),
  count('mango', 'Mango', ['mango', 'mangoer'], 400),
  count('granatæble', 'Granatæble', ['granatæble', 'granatæbler', 'granatæblekerner'], 300),
  count('baguette', 'Baguette', ['baguette', 'baguettes', 'flute', 'flutes'], 250),
  count('rugbrød', 'Rugbrød', ['rugbrød'], 1000),
  count('hel-kylling', 'Hel kylling', ['hel kylling', 'helt kylling'], 1400),
  count('svinemørbrad', 'Svinemørbrad', ['svinemørbrad', 'mørbrad', 'svinemørbrader'], 500),

  // ---- Frugt & grønt, loose by weight
  weight('kartofler', 'Kartofler', ['kartoffel', 'kartofler', 'nye kartofler', 'bagekartofler', 'bagekartoffel'], 120),
  weight('søde-kartofler', 'Søde kartofler', ['søde kartofler', 'sød kartoffel', 'sødekartofler'], 300),
  weight('gulerødder', 'Gulerødder', ['gulerod', 'gulerødder', 'gulerod i tern'], 80),
  weight('rødbeder', 'Rødbeder', ['rødbede', 'rødbeder'], 150),
  weight('pastinak', 'Pastinak', ['pastinak', 'pastinakker'], 150),
  weight('persillerod', 'Persillerod', ['persillerod', 'persillerødder'], 100),
  weight('jordskokker', 'Jordskokker', ['jordskok', 'jordskokker'], 50),

  // ---- Frugt & grønt, packed
  pkg('tomat', 'Tomater', ['tomat', 'tomater', 'bøftomat', 'bøftomater', 'kvalitetstomater'], 'bakke', 500, 'g', { pieceGrams: 100 }),
  pkg('cherrytomat', 'Cherrytomater', ['cherrytomat', 'cherrytomater', 'cherry tomater', 'snacktomater', 'blommetomater'], 'bakke', 250, 'g', { pieceGrams: 15 }),
  pkg('champignon', 'Champignoner', ['champignon', 'champignoner', 'svampe', 'brune champignoner'], 'bakke', 250, 'g', { pieceGrams: 20 }),
  pkg('spinat', 'Spinat', ['spinat', 'babyspinat', 'frisk spinat'], 'pose', 200, 'g', { gramsPerMl: 0.1 }),
  pkg('rucola', 'Rucola', ['rucola', 'rucolasalat'], 'pose', 65, 'g', { gramsPerMl: 0.1 }),
  pkg('salatmix', 'Salatmix', ['salatmix', 'blandet salat', 'salatblanding'], 'pose', 150, 'g'),
  pkg('ærter', 'Ærter', ['ærter', 'grønne ærter', 'frosne ærter', 'ærter frost'], 'pose', 500, 'g', { gramsPerMl: 0.65 }),
  pkg('grønne-bønner', 'Grønne bønner', ['grønne bønner', 'haricots verts', 'bønner grønne'], 'pose', 400, 'g'),
  pkg('sukkerærter', 'Sukkerærter', ['sukkerærter', 'sugarsnaps'], 'bakke', 150, 'g'),
  pkg('persille', 'Persille', ['persille', 'kruspersille', 'bredbladet persille'], 'bundt', 30, 'g', herb),
  pkg('dild', 'Dild', ['dild'], 'bundt', 30, 'g', herb),
  pkg('koriander', 'Koriander', ['koriander', 'frisk koriander', 'korianderblade'], 'bundt', 30, 'g', herb),
  pkg('basilikum', 'Basilikum', ['basilikum', 'basilikumblade'], 'bundt', 30, 'g', herb),
  pkg('purløg', 'Purløg', ['purløg'], 'bundt', 30, 'g', herb),
  pkg('mynte', 'Mynte', ['mynte', 'mynteblade'], 'bundt', 30, 'g', herb),

  // ---- Kød & fisk
  pkg('hakket-oksekød', 'Hakket oksekød', ['hakket oksekød', 'hakket okse', 'oksekød hakket', 'hakket kød', 'oksefars'], 'bakke', 500, 'g'),
  pkg('hakket-svinekød', 'Hakket svinekød', ['hakket svinekød', 'hakket svin', 'svinefars'], 'bakke', 500, 'g'),
  pkg('hakket-kalv-flæsk', 'Hakket kalv og flæsk', ['hakket kalv og flæsk', 'hakket kalv- og flæskekød', 'fars'], 'bakke', 500, 'g'),
  pkg('kyllingebryst', 'Kyllingebryst', ['kyllingebryst', 'kyllingebryster', 'kyllingebrystfilet', 'kyllingebrystfileter', 'kyllingefilet', 'kyllingefileter', 'kyllingeinderfilet', 'kyllingeinderfileter'], 'bakke', 400, 'g', { pieceGrams: 150 }),
  pkg('kylling', 'Kylling', ['kylling', 'kyllingekød', 'kyllingestrimler'], 'bakke', 500, 'g'),
  pkg('kyllingelår', 'Kyllingelår', ['kyllingelår', 'kyllingeoverlår', 'kyllingeunderlår', 'overlårsfilet', 'overlårsfileter'], 'bakke', 1000, 'g', { pieceGrams: 150 }),
  pkg('bacon', 'Bacon', ['bacon', 'baconterninger', 'bacon i tern', 'baconskiver', 'bacon i skiver'], 'pakke', 150, 'g', { per: { skive: 15, skiver: 15 } }),
  pkg('laks', 'Laks', ['laks', 'laksefilet', 'laksefileter', 'laksesider'], 'bakke', 250, 'g', { pieceGrams: 125 }),
  pkg('torsk', 'Torsk', ['torsk', 'torskefilet', 'torskefileter', 'hvid fisk'], 'bakke', 400, 'g', { pieceGrams: 125 }),
  pkg('rejer', 'Rejer', ['rejer', 'tigerrejer', 'kæmperejer', 'pillede rejer'], 'pose', 400, 'g'),
  pkg('tun', 'Tun', ['tun', 'tunfisk', 'tun i olie'], 'dåse', 185, 'g', { spoonGrams: { tsk: 5, spsk: 15 } }),
  pkg('medister', 'Medister', ['medister', 'medisterpølse'], 'pakke', 500, 'g'),
  pkg('pølser', 'Pølser', ['pølse', 'pølser', 'grillpølser', 'wienerpølser', 'chipolata'], 'pakke', 8, 'stk', { pieceGrams: 50 }),
  pkg('chorizo', 'Chorizo', ['chorizo', 'chorizopølse'], 'pakke', 100, 'g'),
  pkg('skinke', 'Skinke', ['skinke', 'skinkestrimler', 'skinketern', 'kogt skinke'], 'pakke', 150, 'g'),
  pkg('stegeflæsk', 'Stegeflæsk', ['stegeflæsk', 'flæsk', 'flæsk i skiver'], 'bakke', 500, 'g'),
  pkg('tofu', 'Tofu', ['tofu'], 'pakke', 400, 'g'),

  // ---- Mejeri & æg
  pkg('mælk', 'Mælk', ['mælk', 'letmælk', 'sødmælk', 'minimælk', 'skummetmælk', 'havremælk'], 'karton', 1000, 'ml'),
  pkg('kærnemælk', 'Kærnemælk', ['kærnemælk'], 'karton', 1000, 'ml'),
  pkg('piskefløde', 'Piskefløde', ['piskefløde', 'fløde', 'kaffefløde'], 'karton', 250, 'ml'),
  pkg('madlavningsfløde', 'Madlavningsfløde', ['madlavningsfløde', 'madfløde'], 'karton', 250, 'ml'),
  pkg('creme-fraiche', 'Creme fraiche', ['creme fraiche', 'cremefraiche', 'crème fraîche', 'creme fraîche', 'crème fraiche'], 'bæger', 200, 'ml'),
  pkg('yoghurt', 'Yoghurt', ['yoghurt', 'yoghurt naturel', 'ymer'], 'karton', 1000, 'ml'),
  pkg('græsk-yoghurt', 'Græsk yoghurt', ['græsk yoghurt', 'græsk yoghurt naturel', 'tyrkisk yoghurt'], 'bæger', 500, 'ml'),
  pkg('skyr', 'Skyr', ['skyr'], 'bæger', 450, 'g', { gramsPerMl: 1.05 }),
  pkg('parmesan', 'Parmesan', ['parmesan', 'parmesanost', 'parmigiano', 'grana padano'], 'pakke', 100, 'g', { spoonGrams: { tsk: 2, spsk: 6 }, gramsPerMl: 0.4 }),
  pkg('revet-ost', 'Revet ost', ['revet ost', 'revet mozzarella', 'pizzaost', 'revet cheddar'], 'pose', 175, 'g', { spoonGrams: { tsk: 2, spsk: 6 }, gramsPerMl: 0.4 }),
  pkg('mozzarella', 'Mozzarella', ['mozzarella', 'mozzarellaost', 'mozzarellakugle', 'mozzarellakugler', 'burrata'], 'pakke', 125, 'g', { pieceGrams: 125 }),
  pkg('feta', 'Feta', ['feta', 'fetaost', 'salatost'], 'pakke', 150, 'g', { gramsPerMl: 0.5 }),
  pkg('mascarpone', 'Mascarpone', ['mascarpone'], 'bæger', 250, 'g', { gramsPerMl: 1 }),
  pkg('ricotta', 'Ricotta', ['ricotta'], 'bæger', 250, 'g', { gramsPerMl: 1 }),
  pkg('flødeost', 'Flødeost', ['flødeost', 'philadelphia', 'smøreost'], 'bæger', 200, 'g', { gramsPerMl: 1 }),
  pkg('hytteost', 'Hytteost', ['hytteost'], 'bæger', 250, 'g', { gramsPerMl: 1 }),
  pkg('ost', 'Ost', ['ost', 'skiveost', 'cheddar', 'gouda', 'mellemlagret ost'], 'pakke', 400, 'g'),

  // ---- Brød
  pkg('tortillas', 'Tortillas', ['tortilla', 'tortillas', 'tortillapandekager', 'hvedetortillas', 'wraps', 'wrap'], 'pakke', 8, 'stk'),
  pkg('tacoskaller', 'Tacoskaller', ['tacoskaller', 'tacoskal', 'taco shells'], 'pakke', 12, 'stk'),
  pkg('pitabrød', 'Pitabrød', ['pitabrød', 'pita', 'pitabrod'], 'pakke', 6, 'stk'),
  pkg('naanbrød', 'Naanbrød', ['naanbrød', 'naan', 'nanbrød'], 'pakke', 4, 'stk'),
  pkg('burgerboller', 'Burgerboller', ['burgerboller', 'burgerbolle', 'hamburgerboller'], 'pakke', 4, 'stk'),
  pkg('toastbrød', 'Toastbrød', ['toastbrød', 'toast'], 'pakke', 20, 'stk'),
  pkg('tortillachips', 'Tortillachips', ['tortillachips', 'nachos', 'nachochips'], 'pose', 200, 'g'),

  // ---- Kolonial
  pkg('pasta', 'Pasta', ['pasta', 'penne', 'fusilli', 'farfalle', 'rigatoni', 'tagliatelle', 'makaroni', 'macaroni', 'linguine', 'tortellini', 'pastaskruer'], 'pakke', 500, 'g', { gramsPerMl: 0.4 }),
  pkg('spaghetti', 'Spaghetti', ['spaghetti'], 'pakke', 500, 'g'),
  pkg('lasagneplader', 'Lasagneplader', ['lasagneplader', 'lasagnaplader', 'lasagneplade'], 'pakke', 500, 'g', { pieceGrams: 20 }),
  pkg('ris', 'Ris', ['ris', 'jasminris', 'basmatiris', 'langkornede ris', 'risottoris', 'grødris', 'arborioris'], 'pakke', 1000, 'g', { gramsPerMl: 0.85 }),
  pkg('nudler', 'Nudler', ['nudler', 'ægnudler', 'risnudler', 'udonnudler'], 'pakke', 250, 'g'),
  pkg('couscous', 'Couscous', ['couscous'], 'pakke', 500, 'g', { gramsPerMl: 0.75 }),
  pkg('bulgur', 'Bulgur', ['bulgur'], 'pakke', 500, 'g', { gramsPerMl: 0.75 }),
  pkg('quinoa', 'Quinoa', ['quinoa'], 'pakke', 500, 'g', { gramsPerMl: 0.8 }),
  pkg('linser', 'Linser', ['linser', 'røde linser', 'grønne linser', 'beluga linser'], 'pakke', 500, 'g', { gramsPerMl: 0.8 }),
  pkg('havregryn', 'Havregryn', ['havregryn', 'grovvalsede havregryn'], 'pose', 1000, 'g', { gramsPerMl: 0.4 }),
  pkg('passata', 'Passata', ['passata', 'tomatpassata', 'tomatsauce passata'], 'karton', 500, 'g', { gramsPerMl: 1 }),
  pkg('tomater-daase', 'Hakkede tomater', ['hakkede tomater', 'flåede tomater', 'tomater på dåse', 'dåsetomater', 'hakkede tomater på dåse'], 'dåse', 400, 'g', { gramsPerMl: 1 }),
  pkg('tomatpure', 'Tomatpuré', ['tomatpuré', 'tomatpure', 'tomatkoncentrat'], 'dåse', 140, 'g', { spoonGrams: { tsk: 5, spsk: 16 } }),
  pkg('kokosmælk', 'Kokosmælk', ['kokosmælk', 'kokosmaelk', 'light kokosmælk'], 'dåse', 400, 'ml'),
  pkg('kikærter', 'Kikærter', ['kikærter', 'kikærter på dåse'], 'dåse', 400, 'g', { gramsPerMl: 0.8 }),
  pkg('kidneybønner', 'Kidneybønner', ['kidneybønner', 'røde kidneybønner', 'kidney bønner'], 'dåse', 400, 'g', { gramsPerMl: 0.8 }),
  pkg('sorte-bønner', 'Sorte bønner', ['sorte bønner'], 'dåse', 400, 'g', { gramsPerMl: 0.8 }),
  pkg('hvide-bønner', 'Hvide bønner', ['hvide bønner', 'butterbeans', 'cannellinibønner'], 'dåse', 400, 'g', { gramsPerMl: 0.8 }),
  pkg('majs', 'Majs', ['majs', 'majskerner', 'majs på dåse'], 'dåse', 340, 'g', { gramsPerMl: 0.7 }),
  pkg('oliven', 'Oliven', ['oliven', 'sorte oliven', 'grønne oliven', 'kalamataoliven'], 'glas', 150, 'g'),
  pkg('pesto', 'Pesto', ['pesto', 'grøn pesto', 'rød pesto'], 'glas', 190, 'g', { spoonGrams: { tsk: 5, spsk: 15 } }),
  pkg('hummus', 'Hummus', ['hummus'], 'bæger', 200, 'g', { spoonGrams: { tsk: 5, spsk: 15 } }),
  pkg('peanutbutter', 'Peanutbutter', ['peanutbutter', 'jordnøddesmør', 'peanut butter'], 'glas', 350, 'g', { spoonGrams: { tsk: 5, spsk: 16 } }),
  pkg('cashewnødder', 'Cashewnødder', ['cashewnødder', 'cashewnød', 'cashew'], 'pose', 200, 'g', { gramsPerMl: 0.55 }),
  pkg('mandler', 'Mandler', ['mandler', 'mandelflager', 'hakkede mandler'], 'pose', 200, 'g', { gramsPerMl: 0.5 }),
  pkg('pinjekerner', 'Pinjekerner', ['pinjekerner'], 'pose', 100, 'g', { spoonGrams: { tsk: 3, spsk: 10 }, gramsPerMl: 0.6 }),
  pkg('jordnødder', 'Peanuts', ['peanuts', 'jordnødder', 'saltede peanuts'], 'pose', 250, 'g', { gramsPerMl: 0.55 }),
  pkg('chokolade', 'Chokolade', ['chokolade', 'mørk chokolade', 'chokoladeplade'], 'pakke', 100, 'g'),
  pkg('gær', 'Gær', ['gær', 'frisk gær'], 'pakke', 50, 'g'),
  pkg('hvidvin', 'Hvidvin', ['hvidvin', 'tør hvidvin'], 'flaske', 750, 'ml'),
  pkg('rødvin', 'Rødvin', ['rødvin', 'vin'], 'flaske', 750, 'ml'),
  pkg('appelsinjuice', 'Juice', ['juice', 'appelsinjuice', 'æblejuice'], 'karton', 1000, 'ml'),

  // ---- Pantry: "Tjek at I har"
  pantry('salt', 'Salt', ['salt', 'havsalt', 'flagesalt', 'groft salt', 'fint salt']),
  pantry('peber', 'Peber', ['peber', 'sort peber', 'friskkværnet peber', 'hvid peber', 'cayennepeber', 'peberkorn']),
  pantry('olie', 'Olie', ['olie', 'rapsolie', 'solsikkeolie', 'neutral olie', 'madolie', 'sesamolie']),
  pantry('olivenolie', 'Olivenolie', ['olivenolie', 'ekstra jomfru olivenolie']),
  pantry('eddike', 'Eddike', ['eddike', 'hvidvinseddike', 'æbleeddike', 'balsamico', 'balsamicoeddike', 'rødvinseddike', 'riseddike']),
  pantry('spidskommen', 'Spidskommen', ['spidskommen', 'stødt spidskommen', 'spidskommenfrø']),
  pantry('paprika', 'Paprika', ['paprika', 'paprikapulver', 'røget paprika', 'sød paprika']),
  pantry('kanel', 'Kanel', ['kanel', 'stødt kanel', 'kanelstang']),
  pantry('oregano', 'Oregano', ['oregano', 'tørret oregano']),
  pantry('karry', 'Karry', ['karry', 'karrypulver', 'karrypasta', 'garam masala']),
  pantry('gurkemeje', 'Gurkemeje', ['gurkemeje']),
  pantry('chilipulver', 'Chilipulver', ['chilipulver', 'chiliflager', 'chili flakes', 'tørret chili']),
  pantry('timian', 'Timian', ['timian', 'tørret timian', 'frisk timian']),
  pantry('rosmarin', 'Rosmarin', ['rosmarin', 'tørret rosmarin']),
  pantry('laurbærblade', 'Laurbærblade', ['laurbærblade', 'laurbærblad']),
  pantry('muskatnød', 'Muskatnød', ['muskatnød', 'muskat']),
  pantry('stødt-koriander', 'Stødt koriander', ['stødt koriander', 'korianderfrø']),
  pantry('krydderi', 'Krydderiblanding', ['krydderi', 'tacokrydderi', 'italiensk krydderi', 'krydderiblanding', 'hvidløgspulver', 'løgpulver']),
  pantry('bouillon', 'Bouillon', ['bouillon', 'bouillonterning', 'bouillonterninger', 'hønsebouillon', 'grøntsagsbouillon', 'oksebouillon', 'fond', 'kyllingefond']),
  pantry('sojasauce', 'Sojasauce', ['sojasauce', 'soja', 'soya', 'japansk soja']),
  pantry('fiskesauce', 'Fiskesauce', ['fiskesauce', 'worcestershiresauce']),
  pantry('honning', 'Honning', ['honning', 'flydende honning', 'ahornsirup', 'sirup']),
  pantry('sennep', 'Sennep', ['sennep', 'dijonsennep', 'grov sennep']),
  pantry('ketchup', 'Ketchup', ['ketchup', 'tomatketchup']),
  pantry('mayonnaise', 'Mayonnaise', ['mayonnaise', 'mayo']),
  pantry('kapers', 'Kapers', ['kapers']),
  pantry('sesamfrø', 'Sesamfrø', ['sesamfrø', 'sesam']),
  pantry('bagepulver', 'Bagepulver', ['bagepulver', 'natron', 'tørgær']),
  pantry('vaniljesukker', 'Vaniljesukker', ['vaniljesukker', 'vanilje', 'vaniljestang']),
  pantry('maizena', 'Maizena', ['maizena', 'majsstivelse', 'kartoffelmel']),
  pantry('kakao', 'Kakao', ['kakao', 'kakaopulver']),
  pantry('vand', 'Vand', ['vand', 'koldt vand', 'kogende vand', 'lunkent vand']),
  pantry('sukker', 'Sukker', ['sukker', 'rørsukker', 'brun farin', 'farin'], { pantryBelow: 50, pack: { unit: 'pose', size: 1000, measure: 'g' }, spoonGrams: { tsk: 4, spsk: 13 }, gramsPerMl: 0.85 }),
  pantry('flormelis', 'Flormelis', ['flormelis'], { pantryBelow: 50, pack: { unit: 'pose', size: 500, measure: 'g' }, spoonGrams: { tsk: 3, spsk: 8 }, gramsPerMl: 0.55 }),
  pantry('mel', 'Hvedemel', ['mel', 'hvedemel', 'speltmel', 'rugmel', 'durummel'], { pantryBelow: 50, pack: { unit: 'pose', size: 1000, measure: 'g' }, spoonGrams: { tsk: 3, spsk: 10 }, gramsPerMl: 0.6 }),
  pantry('smør', 'Smør', ['smør', 'usaltet smør', 'smør eller margarine', 'margarine', 'plantemargarine'], { pantryBelow: 50, pack: { unit: 'pakke', size: 250, measure: 'g' }, spoonGrams: { tsk: 5, spsk: 15 }, gramsPerMl: 0.95 }),
];
