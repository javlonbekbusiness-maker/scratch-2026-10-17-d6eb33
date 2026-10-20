/**
 * Topics = the chapters and annex sections of the Traffic Rules (Yo'l harakati qoidalari),
 * Cabinet of Ministers Resolution No. 172 of 12 April 2022, as published on lex.uz:
 *   Uzbek (Latin)  https://lex.uz/docs/-5953883
 *   Russian        https://lex.uz/ru/docs/5953887
 * Names are the official headings (chapter numbers moved to `ruleRef`). Descriptions are our own
 * short summaries. Groups, order, icons and visibility are editable in Admin → Topics; the seed only
 * creates missing rows and never overwrites admin edits (see prisma/seed.ts).
 *
 * The first 8 slugs (signs, priority, …) are the demo topics that existed before; they are kept so
 * existing questions and progress stay attached.
 */
export const RULE_GROUPS = [
  { slug: 'general', tone: 'brand', nameUz: 'Umumiy qoidalar', nameRu: 'Общие положения' },
  { slug: 'signs', tone: 'danger', nameUz: "Yo'l belgilari", nameRu: 'Дорожные знаки' },
  { slug: 'markings', tone: 'slate', nameUz: "Yo'l chiziqlari", nameRu: 'Дорожная разметка' },
  { slug: 'signals', tone: 'warning', nameUz: 'Svetofor va tartibga soluvchi ishoralari', nameRu: 'Сигналы светофора и регулировщика' },
  { slug: 'driving', tone: 'accent', nameUz: 'Harakatlanish qoidalari', nameRu: 'Правила движения' },
  { slug: 'special', tone: 'violet', nameUz: 'Maxsus holatlar', nameRu: 'Особые условия движения' },
  { slug: 'safety', tone: 'sky', nameUz: 'Xavfsizlik va tibbiy yordam', nameRu: 'Безопасность и первая помощь' },
] as const;

type T = { slug: string; group: (typeof RULE_GROUPS)[number]['slug']; ref: string; icon: string; nameUz: string; nameRu: string; descUz: string; descRu: string; library: string };

const RULES = '/library?tab=rules';
const SIGNS = '/library?tab=signs';

export const RULE_TOPICS: T[] = [
  // ── Umumiy qoidalar ──
  { slug: 'ch-01', group: 'general', ref: '1-bob', icon: 'book', library: RULES, nameUz: 'Umumiy qoidalar', nameRu: 'Общие положения', descUz: 'Qoidalarning amal qilish doirasi va asosiy atamalar.', descRu: 'Сфера действия Правил и основные термины.' },
  { slug: 'safety', group: 'general', ref: '2-bob', icon: 'car', library: RULES, nameUz: 'Haydovchilarning umumiy vazifalari', nameRu: 'Общие обязанности водителей', descUz: 'Haydovchi nimaga majbur va unga nima taqiqlanadi.', descRu: 'Что водитель обязан делать и что ему запрещено.' },
  { slug: 'ch-04', group: 'general', ref: '4-bob', icon: 'walk', library: RULES, nameUz: 'Piyodalarning majburiyatlari', nameRu: 'Обязанности пешеходов', descUz: "Piyodalar qayerda va qanday harakatlanishi, yo'lni qanday kesib o'tishi.", descRu: 'Где и как движутся пешеходы и как переходят дорогу.' },
  { slug: 'ch-05', group: 'general', ref: '5-bob', icon: 'users', library: RULES, nameUz: "Yo'lovchilarning majburiyatlari", nameRu: 'Обязанности пассажиров', descUz: "Yo'lovchilarning chiqishi, tushishi va safar paytidagi xulqi.", descRu: 'Посадка, высадка и поведение пассажиров в пути.' },
  { slug: 'ch-25', group: 'general', ref: '25-bob', icon: 'school', library: RULES, nameUz: 'Transport vositalarini boshqarishni oʻrgatish', nameRu: 'Обучение вождению транспортных средств', descUz: "Haydashni o'rganish tartibi va o'rgatuvchiga talablar.", descRu: 'Порядок обучения вождению и требования к инструктору.' },
  { slug: 'ch-29', group: 'general', ref: '29-bob', icon: 'shield', library: RULES, nameUz: "Mansabdor shaxslar va fuqarolarning yo'l harakati xavfsizligini taʼminlash boʻyicha majburiyatlari", nameRu: 'Обязанности должностных лиц и граждан по обеспечению безопасности дорожного движения', descUz: "Transportni yo'lga chiqarish, raqam va taniqlik belgilari.", descRu: 'Выпуск транспорта на линию, номерные и опознавательные знаки.' },

  // ── Yo'l belgilari (1-ilova) ──
  { slug: 'signs-1', group: 'signs', ref: '1-ilova, 1', icon: 'trap', library: SIGNS, nameUz: 'Ogohlantiruvchi belgilar', nameRu: 'Предупреждающие знаки', descUz: "Oldinda xavfli joy borligini bildiruvchi belgilar.", descRu: 'Знаки, сообщающие об опасном участке впереди.' },
  { slug: 'signs-2', group: 'signs', ref: '1-ilova, 2', icon: 'diamond', library: SIGNS, nameUz: 'Imtiyoz belgilari', nameRu: 'Знаки приоритета', descUz: "Chorraha va tor joylarda kim birinchi o'tishini belgilaydi.", descRu: 'Определяют очерёдность проезда перекрёстков и узких мест.' },
  { slug: 'signs', group: 'signs', ref: '1-ilova, 3', icon: 'octagon', library: SIGNS, nameUz: 'Taqiqlovchi belgilar', nameRu: 'Запрещающие знаки', descUz: 'Muayyan harakatni taqiqlovchi yoki cheklovchi belgilar.', descRu: 'Знаки, вводящие запреты и ограничения.' },
  { slug: 'signs-4', group: 'signs', ref: '1-ilova, 4', icon: 'arrowRight', library: SIGNS, nameUz: 'Buyuruvchi belgilar', nameRu: 'Предписывающие знаки', descUz: "Harakat yo'nalishi yoki usulini majburiy qiluvchi belgilar.", descRu: 'Знаки, предписывающие направление или способ движения.' },
  { slug: 'signs-5', group: 'signs', ref: '1-ilova, 5', icon: 'info', library: SIGNS, nameUz: 'Axborot-koʻrsatgich belgilari', nameRu: 'Информационно-указательные знаки', descUz: "Harakat rejimi, aholi punktlari va yo'nalishlar haqida axborot.", descRu: 'Сведения о режиме движения, населённых пунктах и направлениях.' },
  { slug: 'signs-6', group: 'signs', ref: '1-ilova, 6', icon: 'signpost', library: SIGNS, nameUz: 'Servis belgilari', nameRu: 'Знаки сервиса', descUz: "Yoqilg'i quyish, ovqatlanish, tibbiy yordam kabi xizmat joylari.", descRu: 'Места обслуживания: заправка, питание, медпомощь и другие.' },
  { slug: 'signs-7', group: 'signs', ref: '1-ilova, 7', icon: 'note', library: SIGNS, nameUz: 'Qoʻshimcha axborot belgilari', nameRu: 'Знаки дополнительной информации', descUz: "Asosiy belgining ta'sirini aniqlashtiruvchi lavhachalar.", descRu: 'Таблички, уточняющие действие основного знака.' },

  // ── Yo'l chiziqlari (2-ilova) ──
  { slug: 'marking-1', group: 'markings', ref: '2-ilova, 1', icon: 'road', library: SIGNS, nameUz: 'Yotiq chiziqlar', nameRu: 'Горизонтальная разметка', descUz: "Qatnov qismidagi chiziqlar, yo'nalish ko'rsatkichlari va yozuvlar.", descRu: 'Линии, стрелки и надписи на проезжей части.' },
  { slug: 'marking-2', group: 'markings', ref: '2-ilova, 2', icon: 'layers', library: SIGNS, nameUz: 'Tik chiziqlar', nameRu: 'Вертикальная разметка', descUz: "Yo'l inshootlari va to'siqlardagi chiziqlar.", descRu: 'Разметка на дорожных сооружениях и ограждениях.' },

  // ── Svetofor va ishoralar ──
  { slug: 'lights', group: 'signals', ref: '7-bob', icon: 'traffic', library: RULES, nameUz: 'Svetofor va tartibga soluvchining ishoralari', nameRu: 'Сигналы светофора и регулировщика', descUz: "Svetofor chiroqlari va tartibga soluvchi imo-ishoralarining ma'nosi.", descRu: 'Значение сигналов светофора и жестов регулировщика.' },
  { slug: 'ch-08', group: 'signals', ref: '8-bob', icon: 'bell', library: RULES, nameUz: 'Ogohlantiruvchi va avariya (xavf-xatar) ishoralari', nameRu: 'Предупредительные и аварийные сигналы (опасности)', descUz: "Burilish ko'rsatkichlari, tovush ishorasi va avariya to'xtash belgisi.", descRu: 'Указатели поворота, звуковой сигнал и знак аварийной остановки.' },

  // ── Harakatlanish qoidalari ──
  { slug: 'ch-09', group: 'driving', ref: '9-bob', icon: 'route', library: RULES, nameUz: 'Harakatlanishni boshlash, manyovr qilish', nameRu: 'Начало движения, маневрирование', descUz: "Joyidan qo'zg'alish, qayta tizilish, burilish va qayrilib olish.", descRu: 'Трогание, перестроение, повороты и разворот.' },
  { slug: 'ch-10', group: 'driving', ref: '10-bob', icon: 'grid', library: RULES, nameUz: "Yo'lning qatnov qismida transport vositalarining joylashuvi", nameRu: 'Расположение транспортных средств на проезжей части', descUz: "Bo'laklar bo'yicha harakatlanish va yonma-yon masofa.", descRu: 'Движение по полосам и боковой интервал.' },
  { slug: 'speed', group: 'driving', ref: '11-bob', icon: 'gauge', library: RULES, nameUz: 'Harakatlanish tezligi', nameRu: 'Скорость движения', descUz: "Tezlikni tanlash va turli yo'llardagi chegaralar.", descRu: 'Выбор скорости и ограничения на разных дорогах.' },
  { slug: 'overtaking', group: 'driving', ref: '12-bob', icon: 'car', library: RULES, nameUz: 'Quvib oʻtish', nameRu: 'Обгон', descUz: "Quvib o'tishdan oldin nimaga ishonch hosil qilish va qayerda taqiqlanadi.", descRu: 'В чём убедиться перед обгоном и где он запрещён.' },
  { slug: 'parking', group: 'driving', ref: '13-bob', icon: 'parking', library: RULES, nameUz: 'Toʻxtash va toʻxtab turish', nameRu: 'Остановка и стоянка', descUz: "To'xtash va to'xtab turish mumkin bo'lgan va taqiqlangan joylar.", descRu: 'Где можно и где нельзя останавливаться и стоять.' },
  { slug: 'priority', group: 'driving', ref: '14-bob', icon: 'intersection', library: RULES, nameUz: 'Chorrahalarda harakatlanish', nameRu: 'Проезд перекрестков', descUz: "Chorrahaga kirish, burilish va tirbandlikda o'zini tutish.", descRu: 'Въезд на перекрёсток, повороты и поведение при заторе.' },
  { slug: 'ch-15', group: 'driving', ref: '15-bob', icon: 'traffic', library: RULES, nameUz: 'Tartibga solingan chorrahalar', nameRu: 'Регулируемые перекрестки', descUz: "Svetofor yoki tartibga soluvchi bor chorrahalardan o'tish.", descRu: 'Проезд перекрёстков со светофором или регулировщиком.' },
  { slug: 'ch-16', group: 'driving', ref: '16-bob', icon: 'diamond', library: RULES, nameUz: 'Tartibga solinmagan chorrahalar', nameRu: 'Нерегулируемые перекрестки', descUz: "Teng va teng bo'lmagan yo'llar chorrahasida navbat.", descRu: 'Очерёдность на перекрёстках равнозначных и неравнозначных дорог.' },
  { slug: 'pedestrians', group: 'driving', ref: '17-bob', icon: 'walk', library: RULES, nameUz: 'Piyodalarning oʻtish joylari va yoʻnalishli transport vositalarining bekatlari', nameRu: 'Пешеходные переходы и остановки маршрутных транспортных средств', descUz: "O'tish joylari va bekatlar yonida piyodalarga yo'l berish.", descRu: 'Уступить пешеходам у переходов и остановок.' },
  { slug: 'ch-17-1', group: 'driving', ref: '17¹-bob', icon: 'ticket', library: RULES, nameUz: "Yo'nalishli transport vositalari uchun alohida ajratilgan tasmasi bor yo'l orqali harakatlanish", nameRu: 'Движение по дороге с полосой, выделенной для маршрутных транспортных средств', descUz: "Avtobuslar uchun ajratilgan bo'lak bor yo'lda harakatlanish.", descRu: 'Движение по дороге с выделенной полосой для автобусов.' },
  { slug: 'ch-18', group: 'driving', ref: '18-bob', icon: 'train', library: RULES, nameUz: 'Temir yoʻl kesishmalari orqali harakatlanish', nameRu: 'Движение через железнодорожные пути', descUz: "Temir yo'l kesishmasiga qachon kirish mumkin emas.", descRu: 'Когда нельзя въезжать на железнодорожный переезд.' },

  // ── Maxsus holatlar ──
  { slug: 'ch-06', group: 'special', ref: '6-bob', icon: 'siren', library: RULES, nameUz: 'Maxsus transport vositalarining imtiyozlari', nameRu: 'Приоритет специальных транспортных средств', descUz: "Yalt-yalt etuvchi chiroqli transportga yo'l berish.", descRu: 'Как уступать транспорту с проблесковыми маячками.' },
  { slug: 'ch-19', group: 'special', ref: '19-bob', icon: 'road', library: RULES, nameUz: 'Avtomagistrallarda harakatlanish', nameRu: 'Движение по автомагистралям', descUz: 'Avtomagistralda nima taqiqlanadi va majburiy to‘xtash.', descRu: 'Что запрещено на автомагистрали и вынужденная остановка.' },
  { slug: 'ch-20', group: 'special', ref: '20-bob', icon: 'home', library: RULES, nameUz: 'Turar joy dahalarida harakatlanish', nameRu: 'Движение в жилых зонах', descUz: "Turar joy dahalari va hovlilarda piyodalar ustunligi.", descRu: 'Приоритет пешеходов в жилых зонах и дворах.' },
  { slug: 'ch-21', group: 'special', ref: '21-bob', icon: 'slope', library: RULES, nameUz: 'Tik balandlik va nishabliklarda harakatlanish', nameRu: 'Движение на крутых подъемах и спусках', descUz: "Qiya yo'llarda kim yo'l berishi kerak.", descRu: 'Кто уступает дорогу на крутых подъёмах и спусках.' },
  { slug: 'ch-22', group: 'special', ref: '22-bob', icon: 'users', library: RULES, nameUz: 'Yoʻnalishli transport vositalarining imtiyozlari', nameRu: 'Приоритет маршрутных средств', descUz: "Bekatdan chiqayotgan avtobus va tramvayga yo'l berish.", descRu: 'Уступить автобусу и трамваю, отъезжающим от остановки.' },
  { slug: 'ch-24', group: 'special', ref: '24-bob', icon: 'truck', library: RULES, nameUz: 'Mexanik transport vositalarini shatakka olish', nameRu: 'Буксировка механических транспортных средств', descUz: 'Shatakka olish usullari va qachon taqiqlanadi.', descRu: 'Способы буксировки и когда она запрещена.' },
  { slug: 'ch-26', group: 'special', ref: '26-bob', icon: 'users', library: RULES, nameUz: 'Odam tashish', nameRu: 'Перевозка людей', descUz: "Odam tashish shartlari, jumladan bolalarni tashish.", descRu: 'Условия перевозки людей, в том числе детей.' },
  { slug: 'ch-27', group: 'special', ref: '27-bob', icon: 'box', library: RULES, nameUz: 'Yuk tashish', nameRu: 'Перевозка грузов', descUz: "Yukni joylashtirish, mahkamlash va belgilash.", descRu: 'Размещение, крепление и обозначение груза.' },
  { slug: 'ch-28', group: 'special', ref: '28-bob', icon: 'bike', library: RULES, nameUz: "Velosiped, moped va aravalar harakatlanishiga, shuningdek, hayvonlarni haydab o'tishga doir qo'shimcha talablar", nameRu: 'Дополнительные требования к движению велосипедов, мопедов и гужевых повозок, а также прогону животных', descUz: "Velosiped, moped, arava va hayvonlar bilan yo'lda harakatlanish.", descRu: 'Движение велосипедов, мопедов, повозок и прогон животных.' },

  // ── Xavfsizlik va tibbiy yordam ──
  { slug: 'ch-03', group: 'safety', ref: '3-bob', icon: 'medkit', library: RULES, nameUz: 'Yoʻl-transport hodisasi sodir boʻlganda haydovchining majburiyatlari', nameRu: 'Обязанности водителя при дорожно-транспортном происшествии', descUz: "YTH da to'xtash, jabrlanganlarga yordam berish va xabar qilish.", descRu: 'Остановиться, помочь пострадавшим и сообщить о ДТП.' },
  { slug: 'ch-23', group: 'safety', ref: '23-bob', icon: 'bulb', library: RULES, nameUz: 'Tashqi yoritish asboblaridan foydalanish', nameRu: 'Пользование внешними световыми приборами', descUz: "Fara, gabarit va tumanga qarshi chiroqlarni qachon yoqish.", descRu: 'Когда включать фары, габариты и противотуманные огни.' },
  { slug: 'annex-3', group: 'safety', ref: '3-ilova', icon: 'wrench', library: RULES, nameUz: 'Transport vositalaridan foydalanishni taqiqlovchi shartlar', nameRu: 'Условия, при которых запрещается эксплуатация транспортных средств', descUz: "Tormoz, rul, chiroqlar va shinalardagi qaysi nosozliklar bilan yurish mumkin emas.", descRu: 'С какими неисправностями тормозов, руля, света и шин ездить нельзя.' },
];
