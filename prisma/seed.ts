/**
 * Demo seed. Idempotent: safe to run repeatedly.
 *
 * The 40 questions are generic road-safety SAMPLES written for the demo — not the
 * official exam bank. Replace them with licensed content via Admin → Bulk import
 * (rows with the same external_id are updated). Rule references point to the
 * placeholder articles P-1…P-8, which should be replaced with real YHQ articles.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient, type MessageChannel } from '@prisma/client';
import { latinToCyrillic as cy } from '../src/lib/translit';
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS } from '../src/lib/template-defaults';

const db = new PrismaClient();
const SAMPLE_NOTE_UZ = ' (Namuna — rasmiy matn bilan almashtiring.)';
const SAMPLE_NOTE_RU = ' (Пример — замените официальным текстом.)';

// ─── Reference data ──────────────────────────────────────────────────────────

// nameCy/descCy are given where automatic transliteration gets loanwords or Latin letters wrong.
const CATEGORIES: { code: string; nameUz: string; nameRu: string; descUz: string; descRu: string; nameCy?: string; descCy?: string }[] = [
  { code: 'A', nameUz: 'Mototsikllar', nameCy: 'Мотоцикллар', nameRu: 'Мотоциклы', descUz: 'Mototsikl va motorollerlar', descCy: 'Мотоцикл ва мотороллерлар', descRu: 'Мотоциклы и мотороллеры' },
  { code: 'B', nameUz: 'Yengil avtomobillar', nameRu: 'Легковые автомобили', descUz: 'Yengil avtomobil, 3,5 t gacha', descRu: 'Легковые, до 3,5 т' },
  { code: 'C', nameUz: 'Yuk avtomobillari', nameRu: 'Грузовые автомобили', descUz: 'Yuk avtomobillari, 3,5 t dan ortiq', descRu: 'Грузовые, свыше 3,5 т' },
  { code: 'D', nameUz: 'Avtobuslar', nameRu: 'Автобусы', descUz: "8 dan ortiq yo'lovchi o'rni", descRu: 'Более 8 пассажирских мест' },
  { code: 'BE', nameUz: 'B + tirkama', nameCy: 'B + тиркама', nameRu: 'B + прицеп', descUz: 'B toifasi og‘ir tirkama bilan', descCy: 'B тоифаси оғир тиркама билан', descRu: 'Категория B с тяжёлым прицепом' },
  { code: 'CE', nameUz: 'C + tirkama', nameCy: 'C + тиркама', nameRu: 'C + прицеп', descUz: 'C toifasi tirkama bilan', descCy: 'C тоифаси тиркама билан', descRu: 'Категория C с прицепом' },
];

const TOPICS = [
  { slug: 'signs', icon: '🚸', nameUz: "Yo'l belgilari", nameRu: 'Дорожные знаки' },
  { slug: 'priority', icon: '↔️', nameUz: 'Ustunlik va chorrahalar', nameRu: 'Приоритет и перекрёстки' },
  { slug: 'speed', icon: '⚡', nameUz: 'Tezlik va masofa', nameRu: 'Скорость и дистанция' },
  { slug: 'parking', icon: '🅿️', nameUz: "To'xtash va to'xtab turish", nameRu: 'Остановка и стоянка' },
  { slug: 'overtaking', icon: '🚗', nameUz: "Quvib o'tish", nameRu: 'Обгон' },
  { slug: 'pedestrians', icon: '🚶', nameUz: 'Piyodalar', nameRu: 'Пешеходы' },
  { slug: 'safety', icon: '🛡️', nameUz: 'Xavfsizlik va birinchi yordam', nameRu: 'Безопасность и первая помощь' },
  { slug: 'lights', icon: '🚦', nameUz: 'Svetoforlar', nameRu: 'Светофоры' },
];

const PLANS = [
  { slug: 'week', durationDays: 7, priceUzs: 29000, labelUz: '1 hafta', labelRu: '1 неделя', sortOrder: 1 },
  { slug: 'month', durationDays: 30, priceUzs: 79000, labelUz: '1 oy', labelRu: '1 месяц', sortOrder: 2 },
  { slug: '3months', durationDays: 90, priceUzs: 179000, labelUz: '3 oy', labelRu: '3 месяца', sortOrder: 3, isFeatured: true },
  { slug: 'until-pass', durationDays: 365, priceUzs: 249000, labelUz: "O'tguningizcha", labelRu: 'До сдачи', sortOrder: 4, untilPass: true },
];

const ARTICLES = [
  ['P-1', 'Yo‘l belgilari', 'Дорожные знаки'],
  ['P-2', 'Chorrahalarda harakatlanish', 'Проезд перекрёстков'],
  ['P-3', 'Harakat tezligi', 'Скорость движения'],
  ['P-4', "To'xtash va to'xtab turish", 'Остановка и стоянка'],
  ['P-5', "Quvib o'tish", 'Обгон'],
  ['P-6', "Piyodalar o'tish joylari", 'Пешеходные переходы'],
  ['P-7', 'Haydovchining umumiy majburiyatlari', 'Общие обязанности водителей'],
  ['P-8', 'Svetofor signallari', 'Сигналы светофора'],
] as const;

const SIGNS: [string, string, string, string, string][] = [
  // file, group, code, nameUz, nameRu
  ['children', 'Ogohlantiruvchi / Предупреждающие', '1.x', 'Bolalar', 'Дети'],
  ['slippery', 'Ogohlantiruvchi / Предупреждающие', '1.x', "Sirpanchiq yo'l", 'Скользкая дорога'],
  ['traffic-light', 'Ogohlantiruvchi / Предупреждающие', '1.x', 'Svetofor bilan tartibga solish', 'Светофорное регулирование'],
  ['yield', 'Ustunlik / Приоритет', '2.x', "Yo'l bering", 'Уступите дорогу'],
  ['stop', 'Ustunlik / Приоритет', '2.x', "To'xtamasdan harakatlanish taqiqlanadi", 'Движение без остановки запрещено'],
  ['priority-road', 'Ustunlik / Приоритет', '2.x', "Asosiy yo'l", 'Главная дорога'],
  ['no-entry', 'Taqiqlovchi / Запрещающие', '3.x', 'Kirish taqiqlangan', 'Въезд запрещён'],
  ['no-overtaking', 'Taqiqlovchi / Запрещающие', '3.x', "Quvib o'tish taqiqlangan", 'Обгон запрещён'],
  ['speed-40', 'Taqiqlovchi / Запрещающие', '3.x', 'Maksimal tezlik cheklovi (40)', 'Ограничение максимальной скорости (40)'],
  ['speed-60', 'Taqiqlovchi / Запрещающие', '3.x', 'Maksimal tezlik cheklovi (60)', 'Ограничение максимальной скорости (60)'],
  ['no-parking', 'Taqiqlovchi / Запрещающие', '3.x', "To'xtab turish taqiqlangan", 'Стоянка запрещена'],
  ['no-stopping', 'Taqiqlovchi / Запрещающие', '3.x', "To'xtash taqiqlangan", 'Остановка запрещена'],
  ['roundabout', 'Buyuruvchi / Предписывающие', '4.x', 'Aylanma harakat', 'Круговое движение'],
  ['one-way', 'Axborot / Информационные', '5.x', "Bir tomonlama harakatli yo'l", 'Дорога с односторонним движением'],
  ['crossing', 'Axborot / Информационные', '5.x', "Piyodalar o'tish joyi", 'Пешеходный переход'],
  ['parking', 'Axborot / Информационные', '6.x', "To'xtab turish joyi", 'Место стоянки'],
];

// ─── 40 sample questions ─────────────────────────────────────────────────────
// [topic, image, [uz, ru], answers [[uz, ru], …], correctIndex, [explanationUz, explanationRu], ruleRef]
type Q = [string, string | null, [string, string], [string, string][], number, [string, string], string];

const Q_SIGN = ['Bu belgi nimani bildiradi?', 'Что означает этот знак?'] as [string, string];

const QUESTIONS: Q[] = [
  ['signs', '/signs/stop.svg', Q_SIGN, [["To'xtamasdan harakatlanish taqiqlanadi", 'Движение без остановки запрещено'], ["Yo'l bering", 'Уступите дорогу'], ['Kirish taqiqlangan', 'Въезд запрещён']], 0,
    ["To'xtash chizig'i (yoki chorraha chegarasi) oldida to'liq to'xtab, so'ng yo'l berish kerak.", 'Нужно полностью остановиться у стоп-линии (или края перекрёстка), затем уступить дорогу.'], 'P-1'],
  ['signs', '/signs/yield.svg', Q_SIGN, [["Yo'l bering", 'Уступите дорогу'], ["Asosiy yo'l", 'Главная дорога'], ["To'xtash taqiqlangan", 'Остановка запрещена']], 0,
    ["Kesib o'tilayotgan yo'ldagi transportga yo'l berish kerak.", 'Нужно уступить дорогу транспорту на пересекаемой дороге.'], 'P-1'],
  ['signs', '/signs/no-entry.svg', Q_SIGN, [["Bir tomonlama yo'l", 'Одностороннее движение'], ['Kirish taqiqlangan', 'Въезд запрещён'], ["To'xtab turish joyi", 'Место стоянки']], 1,
    ['Barcha transport vositalarining shu yo‘nalishda kirishi taqiqlanadi.', 'Въезд всех транспортных средств в этом направлении запрещён.'], 'P-1'],
  ['signs', '/signs/speed-60.svg', Q_SIGN, [['Minimal tezlik 60 km/soat', 'Минимальная скорость 60 км/ч'], ['Maksimal tezlik 60 km/soat', 'Максимальная скорость 60 км/ч'], ['Tavsiya etilgan tezlik 60 km/soat', 'Рекомендуемая скорость 60 км/ч']], 1,
    ["Belgida ko'rsatilgan tezlikdan oshib harakatlanish taqiqlanadi.", 'Запрещается движение со скоростью, превышающей указанную на знаке.'], 'P-3'],
  ['signs', '/signs/no-parking.svg', Q_SIGN, [["To'xtash taqiqlangan", 'Остановка запрещена'], ["To'xtab turish taqiqlangan", 'Стоянка запрещена'], ['Avtoturargoh', 'Автостоянка']], 1,
    ["Qisqa to'xtash mumkin, lekin to'xtab turish (uzoq qolish) taqiqlanadi.", 'Кратковременная остановка разрешена, стоянка — запрещена.'], 'P-4'],
  ['signs', '/signs/priority-road.svg', Q_SIGN, [["Yo'l bering", 'Уступите дорогу'], ["Asosiy yo'l", 'Главная дорога'], ['Chorraha', 'Перекрёсток'], ['Yo‘l ishlari', 'Дорожные работы']], 1,
    ["Siz asosiy yo'ldasiz: tartibga solinmagan chorrahalarda ustunlik sizda.", 'Вы на главной дороге: на нерегулируемых перекрёстках у вас приоритет.'], 'P-1'],
  ['signs', '/signs/children.svg', Q_SIGN, [["Piyodalar o'tish joyi", 'Пешеходный переход'], ['Bolalar', 'Дети'], ['Maktab avtobusi bekati', 'Остановка школьного автобуса']], 1,
    ["Bolalar bo'lishi mumkin bo'lgan hudud: tezlikni pasaytiring va ehtiyot bo'ling.", 'Участок, где возможно появление детей: снизьте скорость и будьте внимательны.'], 'P-1'],
  ['signs', '/signs/one-way.svg', Q_SIGN, [['Faqat avtobuslar uchun', 'Только для автобусов'], ["Bir tomonlama harakatli yo'l", 'Дорога с односторонним движением'], ['Kirish taqiqlangan', 'Въезд запрещён']], 1,
    ['Butun kenglik bo‘yicha transport faqat bir yo‘nalishda harakatlanadi.', 'Транспорт по всей ширине дороги движется в одном направлении.'], 'P-1'],

  ['priority', '/placeholders/intersection.svg', ["Tartibga solinmagan teng ahamiyatli yo'llar chorrahasida kimga yo'l berish kerak?", 'Кому уступить на нерегулируемом перекрёстке равнозначных дорог?'],
    [["O'ng tomondan yaqinlashayotgan transportga", 'Транспорту, приближающемуся справа'], ['Chap tomondan yaqinlashayotgan transportga', 'Транспорту, приближающемуся слева'], ['Kattaroq transportga', 'Более крупному транспорту']], 0,
    ["Teng ahamiyatli yo'llarda o'ng tomondagi transport ustun («o'ng qo'l qoidasi»).", 'На равнозначных дорогах приоритет у транспорта справа («правило правой руки»).'], 'P-2'],
  ['priority', null, ["Maxsus ovozli signal va ko'k chiroq yoqilgan transport yaqinlashsa, nima qilish kerak?", 'Что делать, если приближается транспорт с синим маячком и сиреной?'],
    [['Tezlikni oshirish', 'Увеличить скорость'], ["Yo'l berish", 'Уступить дорогу'], ['Signal chalish', 'Подать звуковой сигнал']], 1,
    ["Maxsus signallar yoqilgan transportga to'sqinliksiz o'tishi uchun yo'l berish shart.", 'Транспорту со спецсигналами нужно уступить дорогу для беспрепятственного проезда.'], 'P-2'],
  ['priority', null, ['Svetofor va tartibga soluvchi signallari zid kelsa, qaysi biriga amal qilinadi?', 'Сигналы светофора и регулировщика противоречат друг другу. Чему подчиняться?'],
    [['Svetoforga', 'Светофору'], ['Tartibga soluvchiga', 'Регулировщику'], ["Yo'l belgilariga", 'Дорожным знакам']], 1,
    ["Tartibga soluvchi signallari svetofor va belgilardan ustun turadi.", 'Сигналы регулировщика имеют приоритет над светофором и знаками.'], 'P-2'],
  ['priority', null, ['Hovli hududidan chiqayotganda haydovchi nima qilishi kerak?', 'Что должен сделать водитель при выезде с дворовой территории?'],
    [["Yo'ldagi transport va piyodalarga yo'l berish", 'Уступить дорогу транспорту и пешеходам'], ["Faqat piyodalarga yo'l berish", 'Уступить только пешеходам'], ['Signal berib chiqish', 'Выехать, подав сигнал']], 0,
    ["Hovlidan chiqishda yo'lda harakatlanayotgan barcha ishtirokchilarga yo'l beriladi.", 'При выезде со двора уступают всем участникам движения на дороге.'], 'P-2'],
  ['priority', '/placeholders/intersection.svg', ['Chapga burilayotganda qarama-qarshi tomondan to‘g‘riga kelayotgan transportga nisbatan qanday harakat qilasiz?', 'Как поступить при повороте налево по отношению к встречному транспорту, движущемуся прямо?'],
    [['Ustunlik menda', 'Приоритет у меня'], ["Yo'l beraman", 'Уступлю дорогу'], ['Signal berib o‘taman', 'Проеду, подав сигнал']], 1,
    ["Chapga burilishda qarama-qarshi yo'nalishdan to'g'riga va o'ngga harakatlanayotganlarga yo'l beriladi.", 'При повороте налево уступают встречному транспорту, движущемуся прямо и направо.'], 'P-2'],
  ['priority', '/placeholders/roundabout.svg', ['Chorrahaga kirishdan oldin harakat tirbandligi bo‘lsa, nima qilish kerak?', 'Что делать, если за перекрёстком затор?'],
    [['Chorrahaga kirib kutish', 'Въехать на перекрёсток и ждать'], ['Chorrahaga kirmaslik', 'Не въезжать на перекрёсток'], ['Signal berish', 'Подать звуковой сигнал']], 1,
    ["Tirbandlik sababli chorrahada to'xtab qolish xavfi bo'lsa, unga kirish taqiqlanadi.", 'Запрещено въезжать на перекрёсток, если из-за затора придётся остановиться на нём.'], 'P-2'],

  ['speed', null, ['Tezlikni tanlashda haydovchi nimalarni hisobga olishi kerak?', 'Что должен учитывать водитель при выборе скорости?'],
    [['Faqat belgidagi cheklovni', 'Только ограничение на знаке'], ["Yo'l, ob-havo sharoiti va ko'rinishni", 'Дорожные и погодные условия, видимость'], ['Boshqa avtomobillar tezligini', 'Скорость других автомобилей']], 1,
    ["Tezlik cheklovdan oshmasligi va sharoitga mos bo'lishi kerak.", 'Скорость не должна превышать ограничение и должна соответствовать условиям.'], 'P-3'],
  ['speed', '/signs/speed-40.svg', ['Ushbu belgi qanday tezlikdan oshishni taqiqlaydi?', 'Превышение какой скорости запрещает этот знак?'],
    [['30 km/soat', '30 км/ч'], ['40 km/soat', '40 км/ч'], ['60 km/soat', '60 км/ч']], 1,
    ["Belgidagi raqam km/soatdagi maksimal ruxsat etilgan tezlikni bildiradi.", 'Число на знаке — максимальная разрешённая скорость в км/ч.'], 'P-3'],
  ['speed', '/signs/slippery.svg', ['Bu belgi nimadan ogohlantiradi?', 'О чём предупреждает этот знак?'],
    [["Notekis yo'l", 'Неровная дорога'], ["Sirpanchiq yo'l", 'Скользкая дорога'], ["Yo'l ishlari", 'Дорожные работы']], 1,
    ["Yo'l qoplamasi sirpanchiq bo'lishi mumkin: tezlikni pasaytiring, keskin manevr qilmang.", 'Покрытие может быть скользким: снизьте скорость, избегайте резких манёвров.'], 'P-1'],
  ['speed', '/placeholders/night.svg', ["Tunda qarama-qarshi transport bilan uchrashganda uzoq yorug'likni nima qilish kerak?", 'Что сделать с дальним светом при встречном разъезде ночью?'],
    [["O'chirmaslik", 'Не выключать'], ["Yaqin yorug'likka almashtirish", 'Переключить на ближний'], ['Avariya signalini yoqish', 'Включить аварийную сигнализацию']], 1,
    ["Qarama-qarshi haydovchini ko'zini qamashtirmaslik uchun yaqin yorug'likka o'tiladi.", 'Чтобы не ослепить встречного водителя, переключаются на ближний свет.'], 'P-7'],
  ['speed', null, ["Ho'l yo'lda tormozlash masofasi quruq yo'lga nisbatan qanday o'zgaradi?", 'Как меняется тормозной путь на мокрой дороге по сравнению с сухой?'],
    [['Kamayadi', 'Уменьшается'], ["O'zgarmaydi", 'Не меняется'], ['Ortadi', 'Увеличивается']], 2,
    ["Ho'l yo'lda g'ildirak ilashishi kamayadi, shuning uchun tormozlash masofasi uzayadi.", 'На мокрой дороге сцепление хуже, поэтому тормозной путь длиннее.'], 'P-3'],

  ['parking', '/signs/parking.svg', Q_SIGN, [['Avtobus bekati', 'Остановка автобуса'], ["To'xtab turish joyi", 'Место стоянки'], ['Politsiya posti', 'Пост полиции']], 1,
    ["Transport vositalarini to'xtatib qo'yish uchun ajratilgan joy.", 'Место, отведённое для стоянки транспортных средств.'], 'P-4'],
  ['parking', '/signs/no-stopping.svg', Q_SIGN, [["To'xtash taqiqlangan", 'Остановка запрещена'], ["To'xtab turish taqiqlangan", 'Стоянка запрещена'], ['Kirish taqiqlangan', 'Въезд запрещён']], 0,
    ["Bu yerda har qanday to'xtash ham, to'xtab turish ham taqiqlanadi.", 'Здесь запрещены и остановка, и стоянка.'], 'P-4'],
  ['parking', '/placeholders/crossing.svg', ["Piyodalar o'tish joyida to'xtab turish mumkinmi?", 'Можно ли ставить автомобиль на пешеходном переходе?'],
    [['Ha, 5 daqiqagacha', 'Да, до 5 минут'], ['Yo‘q, taqiqlanadi', 'Нет, запрещено'], ['Faqat tunda', 'Только ночью']], 1,
    ["Piyodalar o'tish joyida to'xtash va to'xtab turish taqiqlanadi.", 'На пешеходном переходе остановка и стоянка запрещены.'], 'P-4'],
  ['parking', null, ['Avtomobilni tark etishdan oldin haydovchi nima qilishi kerak?', 'Что должен сделать водитель, прежде чем покинуть автомобиль?'],
    [["Uning o'z-o'zidan harakatlanishini istisno qilish", 'Исключить его самопроизвольное движение'], ['Faqat eshiklarni qulflash', 'Только запереть двери'], ['Hech narsa', 'Ничего']], 0,
    ["To'xtash tormozini qo'yish va zarur bo'lsa uzatmani qo'shish kerak.", 'Нужно включить стояночный тормоз и при необходимости передачу.'], 'P-4'],
  ['parking', '/placeholders/railway.svg', ["Temir yo'l kesishmasida to'xtab turish mumkinmi?", 'Можно ли останавливаться на железнодорожном переезде?'],
    [['Ha', 'Да'], ['Yo‘q, taqiqlanadi', 'Нет, запрещено'], ['Faqat kunduzi', 'Только днём']], 1,
    ["Temir yo'l kesishmalarida to'xtash va to'xtab turish taqiqlanadi.", 'На железнодорожных переездах остановка и стоянка запрещены.'], 'P-4'],

  ['overtaking', '/signs/no-overtaking.svg', Q_SIGN, [["Quvib o'tish taqiqlangan", 'Обгон запрещён'], ['Ikki tomonlama harakat', 'Двустороннее движение'], ["Tor yo'l", 'Сужение дороги']], 0,
    ["Belgi ta'sir hududida sekin harakatlanuvchi transportdan boshqasini quvib o'tish taqiqlanadi.", 'В зоне действия знака запрещён обгон всех ТС, кроме тихоходных.'], 'P-5'],
  ['overtaking', '/placeholders/overtaking.svg', ["Quvib o'tishni boshlashdan oldin nimaga ishonch hosil qilish kerak?", 'В чём нужно убедиться перед началом обгона?'],
    [['Faqat burilish signali berganimga', 'Только в том, что включил поворотник'], ["Qarama-qarshi bo'lak bo'sh va masofa yetarli ekanligiga", 'Что встречная полоса свободна и расстояние достаточно'], ['Orqadagi transport sekinlashganiga', 'Что сзади идущий замедлился']], 1,
    ["Manevr xavfsiz bo'lishi va boshqalarga xalaqit bermasligi kerak.", 'Манёвр должен быть безопасным и не создавать помех другим.'], 'P-5'],
  ['overtaking', '/placeholders/crossing.svg', ["Piyodalar o'tish joyida quvib o'tish mumkinmi?", 'Разрешён ли обгон на пешеходном переходе?'],
    [['Ha', 'Да'], ['Yo‘q', 'Нет'], ["Piyoda bo'lmasa — ha", 'Да, если нет пешеходов']], 1,
    ["Piyodalar o'tish joylarida quvib o'tish taqiqlanadi.", 'На пешеходных переходах обгон запрещён.'], 'P-5'],
  ['overtaking', null, ['Sizni quvib o‘tayotgan transport haydovchisiga nisbatan nima qilish taqiqlanadi?', 'Что запрещено делать по отношению к обгоняющему вас водителю?'],
    [["Bo'lakda qolish", 'Оставаться в своей полосе'], ['Tezlikni oshirish yoki to‘sqinlik qilish', 'Увеличивать скорость или иначе мешать'], ['Tezlikni saqlash', 'Сохранять скорость']], 1,
    ["Quvib o'tilayotgan haydovchi tezlikni oshirib yoki boshqa usulda xalaqit bermasligi kerak.", 'Обгоняемому водителю запрещено мешать обгону, в том числе увеличивая скорость.'], 'P-5'],

  ['pedestrians', '/signs/crossing.svg', Q_SIGN, [["Piyodalar yo'lkasi", 'Пешеходная дорожка'], ["Piyodalar o'tish joyi", 'Пешеходный переход'], ['Bolalar', 'Дети']], 1,
    ["Piyodalar yo'lni kesib o'tishi uchun belgilangan joy.", 'Место, обозначенное для перехода пешеходов через дорогу.'], 'P-6'],
  ['pedestrians', '/placeholders/crossing.svg', ["Tartibga solinmagan piyodalar o'tish joyiga yaqinlashganda nima qilish kerak?", 'Что делать при приближении к нерегулируемому переходу?'],
    [["Kesib o'tayotgan piyodalarga yo'l berish", 'Уступить пешеходам, переходящим дорогу'], ["Signal chalib o'tish", 'Проехать, подав сигнал'], ['Tezlikni oshirish', 'Увеличить скорость']], 0,
    ["Yo'lni kesib o'tayotgan yoki o'tishga kirgan piyodalarga yo'l beriladi.", 'Нужно уступить пешеходам, переходящим или вступившим на переход.'], 'P-6'],
  ['pedestrians', '/placeholders/intersection.svg', ["O'ngga burilganda burilayotgan yo'lni kesib o'tayotgan piyodalarga nisbatan nima qilasiz?", 'Как поступить при повороте направо с пешеходами, переходящими дорогу, на которую вы поворачиваете?'],
    [['Ustunlik menda', 'Приоритет у меня'], ["Yo'l beraman", 'Уступлю дорогу'], ["Faqat svetofor bo'lsa yo'l beraman", 'Уступлю только при светофоре']], 1,
    ["Burilishda kesib o'tilayotgan yo'ldagi piyodalarga yo'l beriladi.", 'При повороте уступают пешеходам на пересекаемой проезжей части.'], 'P-6'],
  ['pedestrians', null, ["Oq tayoqli ko'zi ojiz piyoda yo'lni kesib o'tayotgan bo'lsa, nima qilasiz?", 'Что делать, если дорогу переходит слепой пешеход с белой тростью?'],
    [['Signal chalaman', 'Подам сигнал'], ["To'xtab, uni o'tkazib yuboraman", 'Остановлюсь и пропущу его'], ["Aylanib o'taman", 'Объеду его']], 1,
    ["Ko'zi ojiz piyodalarga har qanday joyda yo'l berish kerak.", 'Слепым пешеходам нужно уступать дорогу в любом месте.'], 'P-6'],

  ['safety', null, ['Harakatlanish vaqtida xavfsizlik kamarini kim taqishi shart?', 'Кто обязан быть пристёгнут ремнём безопасности во время движения?'],
    [['Faqat haydovchi', 'Только водитель'], ['Haydovchi va barcha yo‘lovchilar', 'Водитель и все пассажиры'], ["Faqat old o'rindiqdagilar", 'Только сидящие впереди']], 1,
    ["Kamar bilan jihozlangan barcha o'rindiqlarda o'tirganlar kamar taqishi shart.", 'Пристёгиваться обязаны все, кто сидит на местах, оборудованных ремнями.'], 'P-7'],
  ['safety', null, ['Harakatlanish vaqtida telefonni qo‘lda ushlab gaplashish mumkinmi?', 'Можно ли во время движения разговаривать по телефону, держа его в руке?'],
    [['Ha', 'Да'], ["Yo'q, faqat «qo'lsiz» qurilma orqali", 'Нет, только через гарнитуру «hands-free»'], ['Faqat tunda', 'Только ночью']], 1,
    ['Telefon chalg‘itadi; faqat qo‘lni band qilmaydigan qurilma bilan foydalanish mumkin.', 'Телефон отвлекает; пользоваться можно только устройством без участия рук.'], 'P-7'],
  ['safety', '/placeholders/highway.svg', ['Majburiy to‘xtaganda avariya signalidan tashqari yana nima qilish kerak?', 'Что нужно сделать при вынужденной остановке, кроме включения аварийки?'],
    [['Hech narsa', 'Ничего'], ["Avariya to'xtash belgisini o'rnatish", 'Выставить знак аварийной остановки'], ['Farani yoqish', 'Включить фары']], 1,
    ["Boshqa haydovchilarni oldindan ogohlantirish uchun belgi o'rnatiladi.", 'Знак выставляют, чтобы заранее предупредить других водителей.'], 'P-7'],
  ['safety', null, ['Mast holatda transport boshqarish mumkinmi?', 'Можно ли управлять транспортом в состоянии опьянения?'],
    [['Kam miqdorda mumkin', 'В небольшом количестве можно'], ['Taqiqlanadi', 'Запрещено'], ['Kechasi mumkin', 'Ночью можно']], 1,
    ["Har qanday mastlik holatida transport boshqarish taqiqlanadi.", 'Управление транспортом в любом состоянии опьянения запрещено.'], 'P-7'],
  ['safety', null, ['YTH da jarohatlanganlar bo‘lsa, birinchi navbatda nima qilish kerak?', 'Что сделать в первую очередь, если в ДТП есть пострадавшие?'],
    [['Hodisa joyini tark etish', 'Покинуть место ДТП'], ['Birinchi yordam ko‘rsatish va tez yordam chaqirish', 'Оказать первую помощь и вызвать скорую'], ['Avtomobilni siljitish', 'Переместить автомобиль']], 1,
    ["Jarohatlanganlarga yordam berish va tez yordam chaqirish — birinchi vazifa.", 'Первая задача — помочь пострадавшим и вызвать скорую помощь.'], 'P-7'],

  ['lights', '/signs/traffic-light.svg', ['Bu belgi nimadan ogohlantiradi?', 'О чём предупреждает этот знак?'],
    [['Svetofor bilan tartibga solinadigan joy', 'Светофорное регулирование'], ["Temir yo'l kesishmasi", 'Железнодорожный переезд'], ["Yo'l ishlari", 'Дорожные работы']], 0,
    ["Oldinda svetofor bilan tartibga solinadigan chorraha yoki o'tish joyi bor.", 'Впереди перекрёсток или переход, регулируемый светофором.'], 'P-8'],
  ['lights', null, ['Yashildan keyin yonadigan sariq signal nimani bildiradi?', 'Что означает жёлтый сигнал после зелёного?'],
    [['Tezlikni oshiring', 'Увеличьте скорость'], ['Harakat taqiqlanadi, signal almashishi haqida ogohlantiradi', 'Движение запрещено, предупреждает о смене сигнала'], ['Harakat ruxsat etiladi', 'Движение разрешено']], 1,
    ["Sariq signal harakatni taqiqlaydi (xavfsiz to'xtab bo'lmaydigan holatlar bundan mustasno).", 'Жёлтый запрещает движение (кроме случаев, когда безопасно остановиться нельзя).'], 'P-8'],
  ['lights', null, ['Miltillovchi sariq signal nimani bildiradi?', 'Что означает мигающий жёлтый сигнал?'],
    [['Harakat taqiqlanadi', 'Движение запрещено'], ['Harakat ruxsat, tartibga solinmagan chorraha haqida ogohlantiradi', 'Движение разрешено, предупреждает о нерегулируемом перекрёстке'], ["Svetofor ishlamoqda, to'xtang", 'Светофор работает, остановитесь']], 1,
    ["Miltillovchi sariq chiroqda chorraha tartibga solinmagan hisoblanadi.", 'При мигающем жёлтом перекрёсток считается нерегулируемым.'], 'P-8'],
];

// ─── Seeding ─────────────────────────────────────────────────────────────────

async function main() {
  if (QUESTIONS.length !== 40) throw new Error(`expected 40 questions, have ${QUESTIONS.length}`);

  const catIds: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const data = {
      code: c.code, nameUz: c.nameUz, nameCy: c.nameCy ?? cy(c.nameUz), nameRu: c.nameRu,
      descUz: c.descUz, descCy: c.descCy ?? cy(c.descUz), descRu: c.descRu, sortOrder: i,
    };
    const row = await db.category.upsert({ where: { slug: c.code.toLowerCase() }, create: { slug: c.code.toLowerCase(), ...data }, update: data });
    catIds[c.code] = row.id;
  }

  const topicIds: Record<string, string> = {};
  for (const [i, t] of TOPICS.entries()) {
    const data = { nameUz: t.nameUz, nameCy: cy(t.nameUz), nameRu: t.nameRu, icon: t.icon, sortOrder: i };
    const row = await db.topic.upsert({ where: { slug: t.slug }, create: { slug: t.slug, ...data }, update: data });
    topicIds[t.slug] = row.id;
  }

  for (const p of PLANS) {
    const data = { ...p, labelCy: cy(p.labelUz) };
    await db.plan.upsert({ where: { slug: p.slug }, create: data, update: data });
  }

  // Exam format — UNVERIFIED defaults; confirm against the official exam and edit in Admin → Exam templates.
  for (const code of Object.keys(catIds)) {
    const exists = await db.examTemplate.findFirst({ where: { categoryId: catIds[code], kind: 'EXAM' } });
    if (!exists) {
      await db.examTemplate.create({
        data: { name: `Official exam (${code}) — verify`, kind: 'EXAM', categoryId: catIds[code], questionCount: 20, timeLimitSec: 25 * 60, passPercent: 90, isDefault: true },
      });
    }
  }
  if (!(await db.examTemplate.findFirst({ where: { categoryId: catIds.B, kind: 'TICKET' } }))) {
    await db.examTemplate.create({ data: { name: 'Practice ticket (B) — 10 questions', kind: 'TICKET', categoryId: catIds.B, questionCount: 10, timeLimitSec: 0, passPercent: 90 } });
  }

  // Shuffle questions deterministically across 4 tickets of 10 so each ticket mixes topics.
  const order = QUESTIONS.map((_, i) => i).sort((a, b) => ((a * 7) % 40) - ((b * 7) % 40));
  for (const [pos, qi] of order.entries()) {
    const [topic, img, text, answers, correct, exp, ref] = QUESTIONS[qi];
    const externalId = `SAMPLE-B-${String(qi + 1).padStart(3, '0')}`;
    const data = {
      categoryId: catIds.B,
      topicId: topicIds[topic],
      ticketNumber: Math.floor(pos / 10) + 1,
      sortOrder: pos % 10,
      textUz: text[0],
      textCy: cy(text[0]),
      textRu: text[1],
      imageUrl: img,
      explanationUz: exp[0] + SAMPLE_NOTE_UZ,
      explanationCy: cy(exp[0] + SAMPLE_NOTE_UZ),
      explanationRu: exp[1] + SAMPLE_NOTE_RU,
      ruleRef: ref,
      difficulty: 1,
    };
    const answerRows = answers.map(([uz, ru], i) => ({ textUz: uz, textCy: cy(uz), textRu: ru, isCorrect: i === correct, sortOrder: i }));
    const existing = await db.question.findUnique({ where: { externalId } });
    if (existing) {
      await db.answer.deleteMany({ where: { questionId: existing.id } });
      await db.question.update({ where: { id: existing.id }, data: { ...data, answers: { create: answerRows } } });
    } else {
      await db.question.create({ data: { ...data, externalId, answers: { create: answerRows } } });
    }
  }
  for (let n = 1; n <= 4; n++) {
    await db.ticket.upsert({
      where: { categoryId_number: { categoryId: catIds.B, number: n } },
      create: { categoryId: catIds.B, number: n, isFree: n <= 2 },
      update: { isFree: n <= 2 },
    });
  }

  await db.roadSign.deleteMany();
  await db.roadSign.createMany({
    data: SIGNS.map(([file, group, code, nameUz, nameRu], i) => ({ code, group, nameUz, nameCy: cy(nameUz), nameRu, descUz: 'Namuna tavsif.', descCy: cy('Namuna tavsif.'), descRu: 'Пример описания.', imageUrl: `/signs/${file}.svg`, sortOrder: i })),
  });

  for (const [number, titleUz, titleRu] of ARTICLES) {
    const bodyUz = `[NAMUNA] Bu yerda YHQning tegishli moddasi matni joylashadi. Rasmiy matnni Admin → Signs & rules bo'limida kiriting.`;
    const bodyRu = `[ПРИМЕР] Здесь будет текст соответствующей статьи ПДД. Введите официальный текст в разделе Admin → Signs & rules.`;
    const data = { chapter: 'Namuna', titleUz, titleCy: cy(titleUz), titleRu, bodyUz, bodyCy: cy(bodyUz), bodyRu };
    await db.ruleArticle.upsert({ where: { number }, create: { number, ...data }, update: data });
  }

  // Message templates: uz-Cyrl SMS stays Latin (GSM-7 is ~2× cheaper per segment than UCS-2).
  for (const key of TEMPLATE_KEYS) {
    const d = DEFAULT_TEMPLATES[key];
    const rows: { channel: MessageChannel; lang: string; subject: string | null; body: string }[] = [
      { channel: 'SMS', lang: 'uz', subject: null, body: d.uz.sms },
      { channel: 'SMS', lang: 'uz-Cyrl', subject: null, body: d.uz.sms },
      { channel: 'SMS', lang: 'ru', subject: null, body: d.ru.sms },
      { channel: 'EMAIL', lang: 'uz', subject: d.uz.emailSubject, body: d.uz.email },
      { channel: 'EMAIL', lang: 'uz-Cyrl', subject: cy(d.uz.emailSubject), body: cy(d.uz.email) },
      { channel: 'EMAIL', lang: 'ru', subject: d.ru.emailSubject, body: d.ru.email },
      { channel: 'PUSH', lang: 'uz', subject: null, body: d.uz.push },
      { channel: 'PUSH', lang: 'uz-Cyrl', subject: null, body: cy(d.uz.push) },
      { channel: 'PUSH', lang: 'ru', subject: null, body: d.ru.push },
    ];
    for (const r of rows) {
      await db.messageTemplate.upsert({
        where: { key_channel_lang: { key, channel: r.channel, lang: r.lang } },
        create: { key, ...r },
        update: {},
      });
    }
  }

  if (!(await db.campaign.findFirst({ where: { type: 'WELCOME' } }))) {
    await db.campaign.create({ data: { name: 'Welcome offer', type: 'WELCOME', discountPct: 20, durationHours: 24, isActive: true } });
  }

  // Demo promo codes for testing every type and error message.
  const day = 86400_000;
  const promos = [
    { code: 'DEMO20', type: 'PERCENT' as const, value: 20, perUserLimit: 5, note: 'Demo: 20% off' },
    { code: 'MINUS15K', type: 'FIXED' as const, value: 15000, minOrderUzs: 50000, note: 'Demo: 15 000 off, min 50 000' },
    { code: 'PLUS7', type: 'FREE_DAYS' as const, value: 7, combinable: true, note: 'Demo: +7 days' },
    { code: 'TRIAL3', type: 'FREE_TRIAL' as const, value: 3, note: 'Demo: 3-day free trial' },
    { code: 'EXPIRED', type: 'PERCENT' as const, value: 50, endsAt: new Date(Date.now() - day), note: 'Demo: expired' },
    { code: 'MONTHONLY', type: 'PERCENT' as const, value: 30, planSlugs: ['month'], note: 'Demo: only 1-month plan' },
  ];
  for (const p of promos) await db.promoCode.upsert({ where: { code: p.code }, create: p, update: {} });

  const adminPhone = process.env.ADMIN_PHONE ?? '+998900000001';
  await db.user.upsert({
    where: { phone: adminPhone },
    create: { phone: adminPhone, name: 'Admin', role: 'ADMIN', onboarded: true, categoryId: catIds.B, consentAt: new Date(), referralCode: randomBytes(5).toString('hex').toUpperCase() },
    update: { role: 'ADMIN' },
  });

  const counts = await Promise.all([db.category.count(), db.topic.count(), db.question.count(), db.ticket.count(), db.plan.count(), db.roadSign.count(), db.messageTemplate.count()]);
  console.log(`Seeded: ${counts[0]} categories, ${counts[1]} topics, ${counts[2]} questions, ${counts[3]} tickets, ${counts[4]} plans, ${counts[5]} signs, ${counts[6]} templates. Admin: ${adminPhone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
