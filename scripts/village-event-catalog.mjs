// Weekly village-bastion events. Stable IDs preserve history and occurrence limits.
export const EVENT_CATALOG_VERSION=4;
export const EVENTS=[
  {
    "id": "harvest",
    "category": "good",
    "title": "Праздник урожая",
    "text": "Жители устраивают общий ужин во дворе бастиона. Выберите, кому из соседей отправить приглашение: праздник может стать началом знакомства или примирения.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "master",
    "category": "good",
    "title": "Мастер на постой",
    "text": "Ремесленник просит ночлег и предлагает показать хозяевам бастиона свою работу. Можно обсудить будущий объект или заказ; договор заключается отдельно.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "merchants",
    "category": "good",
    "title": "Гости торгового двора",
    "text": "Приезжие торговцы платят за место на деревенской площади и ночлег у бастиона. Разовый сбор поступает в казну.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 20
    },
    "maxOccurrences": null
  },
  {
    "id": "purchase",
    "category": "good",
    "title": "Возврат переплаты",
    "text": "Поставщик возвращает переплату по прежнему заказу для бастиона.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 15
    },
    "maxOccurrences": null
  },
  {
    "id": "neighbors",
    "category": "good",
    "title": "Соседская помощь",
    "text": "Жители соседней деревни приходят на совместные работы и ужин. Хозяевам предстоит выбрать место встречи и обсудить общее дело.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "timber",
    "category": "good",
    "title": "Место для нового объекта",
    "text": "Плотник предлагает удобное место для будущей постройки. Партия может выбрать её назначение; строительство оплачивается по обычным правилам.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "spoiled",
    "category": "bad",
    "title": "Промокшая крыша",
    "text": "После ливня течёт крыша одного из используемых помещений. Жители предлагают провести ремонт; выберите, кто им займётся. Объект не теряет приказ автоматически.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "cattle",
    "category": "bad",
    "title": "Заболевшее животное",
    "text": "Смотритель просит позвать лекаря к больному животному. Можно помочь лично или договориться с местным специалистом; плату обсуждают до лечения.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "road",
    "category": "bad",
    "title": "Следы на дороге",
    "text": "Патруль обнаружил свежие следы тяжёлой повозки, свернувшей с дороги к деревне. Решите, послать ли разведчика или осмотреть следы самим.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "delivery",
    "category": "bad",
    "title": "Курьер опоздал",
    "text": "Посыльный с письмом для бастиона не прибыл к сроку. У ворот найден его дорожный знак; это повод для поисков, а не отмена недельных приказов.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "sawmill",
    "category": "bad",
    "title": "Ремонт ворот",
    "text": "Плотник предлагает устранить повреждение общих ворот за 40 зм. Принятие предложения оплачивает ремонт; можно отложить его или выполнить работу в игре.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": -40
    },
    "maxOccurrences": null
  },
  {
    "id": "seed-delay",
    "category": "bad",
    "title": "Просьба земледельцев",
    "text": "Земледельцы просят разрешить провести праздник у бастиона. Партия выбирает площадку и отвечает на просьбу; отдельного учёта урожая нет.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "refugees",
    "category": "story",
    "title": "Люди у ворот",
    "text": "Несколько семей просят временный приют. Решите, где их разместить и чем помочь; население остаётся описательной частью истории деревни.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "traveler",
    "category": "story",
    "title": "Путник с картой",
    "text": "Путник предлагает показать на карте заброшенную сторожку неподалёку. Он согласен рассказать больше за ужином в бастионе.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "dispute",
    "category": "story",
    "title": "Спор о дворе",
    "text": "Две семьи спорят, кому пользоваться общей площадкой. Хозяев бастиона просят выслушать стороны и установить понятный порядок.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "caravan",
    "category": "story",
    "title": "Пропавший обоз",
    "text": "Обоз, направлявшийся к деревне, исчез на последнем участке дороги. Можно отправить людей на поиски или заняться этим лично; награда обсуждается с владельцем.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "stranger",
    "category": "story",
    "title": "Незнакомый купец",
    "text": "Купец предлагает редкий товар и просит представить его хозяевам бастиона. Перед сделкой можно проверить происхождение товара; покупка добровольная.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "help",
    "category": "story",
    "title": "Просьба соседнего бастиона",
    "text": "Посланник соседнего укреплённого дома просит сопровождения через опасный участок. Обсудите ответ и возможную взаимную услугу.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "cache",
    "category": "special",
    "title": "Общинный тайник",
    "text": "При уборке старого помещения найдена запечатанная шкатулка с общинными монетами. 50 зм возвращаются в казну.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 50
    },
    "maxOccurrences": 1,
    "followUp": {
      "title": "Истории о тайнике",
      "text": "Находка общинного тайника обросла слухами. Жители предлагают проверить другую старую запись; новых монет событие не выдаёт.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "alden",
    "category": "special",
    "title": "Вопросы об Альдене",
    "text": "Гость расспрашивает жителей об Альдене и просит встречи в бастионе. Партия решает, что ему рассказать и стоит ли доверять незнакомцу.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "relic",
    "category": "special",
    "title": "Вещь с неизвестным клеймом",
    "text": "В старой стене найдена вещь с необычным знаком. Её можно показать учёному или исследовать; находка не получает магических свойств автоматически.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": 1,
    "followUp": {
      "title": "Исследование клейма",
      "text": "Новый гость узнал знак на ранее найденной вещи и предлагает версию её происхождения.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "lights",
    "category": "special",
    "title": "Огни над заливом",
    "text": "Ночной дозор видит огни над водой напротив деревни. Можно наблюдать с берега, отправить лодку или передать сведения знакомому исследователю.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "envoy",
    "category": "special",
    "title": "Посланник у ворот",
    "text": "Посланник соседнего владения просит принять его в бастионе. Он предлагает начать переговоры о взаимопомощи; соглашение возникает только после разговора.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "fish-gift",
    "category": "good",
    "title": "Рыбаки благодарят",
    "text": "Рыбаки устроили удачную продажу и пожертвовали часть выручки на общие нужды деревни.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 15
    },
    "maxOccurrences": null
  },
  {
    "id": "grain-gift",
    "category": "good",
    "title": "Благодарность фермеров",
    "text": "Земледельцы передают в казну разовое пожертвование после удачной ярмарки.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 20
    },
    "maxOccurrences": null
  },
  {
    "id": "returned-crates",
    "category": "good",
    "title": "Возвращённая посылка",
    "text": "У ворот оставили ящик с вещами, потерянными прежним курьером. Жители просят найти адресата по сохранившейся печати.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "debt-return",
    "category": "good",
    "title": "Возвращённый долг",
    "text": "Старый должник возвращает общине 25 зм и благодарит за давнюю помощь.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 25
    },
    "maxOccurrences": 1,
    "followUp": {
      "title": "Благодарность старого должника",
      "text": "Человек, вернувший долг, прислал письмо и предлагает познакомить партию с полезным знакомым.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "fair-fee",
    "category": "good",
    "title": "Небольшая ярмарка",
    "text": "Жители устроили ярмарку у бастиона. После расчётов организаторы передают в казну разовый сбор.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 20
    },
    "maxOccurrences": null
  },
  {
    "id": "dry-wood",
    "category": "good",
    "title": "Заказ для мастерской",
    "text": "Соседям нужны вывески, лавки или дорожные сундуки. Если в бастионе есть подходящая мастерская, можно обсудить заказ; иначе познакомить заказчика с деревенским мастером.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "bread-gift",
    "category": "good",
    "title": "Хлеб для праздника",
    "text": "Пекарь предлагает устроить общий стол у бастиона. Выберите повод и гостей; это встреча жителей, а не прибавка к отдельному запасу еды.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "mistake-refund",
    "category": "good",
    "title": "Честный поставщик",
    "text": "Поставщик нашёл ошибку в счёте и возвращает 15 зм в казну.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": 15
    },
    "maxOccurrences": null
  },
  {
    "id": "damp-grain",
    "category": "bad",
    "title": "Помощь после ливня",
    "text": "У семьи промокла крыша. Жители собирают помощь; хозяева бастиона могут выделить 10 зм на работу мастера или решить вопрос лично.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": -10
    },
    "maxOccurrences": null
  },
  {
    "id": "split-barrel",
    "category": "bad",
    "title": "Неловкость на празднике",
    "text": "Во время праздника разбита чужая утварь. Пострадавший просит разобраться, кто возместит ущерб; обязательной выплаты из казны нет.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "rusted-nails",
    "category": "bad",
    "title": "Пропавший инструмент",
    "text": "Работник не может найти инструмент перед выполнением поручения. Партия может помочь с поисками; приказ не отменяется автоматически.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "soaked-boards",
    "category": "bad",
    "title": "Спор о доставке",
    "text": "Поставщик привёз изделия не того размера. Решите, требовать ли замену или использовать их для другого дела; деньги без новой сделки не списываются.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "cart-axle",
    "category": "bad",
    "title": "Сломанная повозка",
    "text": "Для ремонта общей повозки мастер просит 20 зм. Можно оплатить работу сейчас, отложить её или починить повозку самостоятельно.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": -20
    },
    "maxOccurrences": null
  },
  {
    "id": "lost-coins",
    "category": "bad",
    "title": "Недостача в кассе",
    "text": "После сверки обнаружена подтверждённая недостача 10 зм. Исправьте запись казны и решите, расследовать ли пропажу.",
    "track": null,
    "min": 0,
    "effects": {
      "treasury": -10
    },
    "maxOccurrences": null
  },
  {
    "id": "blocked-drain",
    "category": "bad",
    "title": "Вода во дворе",
    "text": "После дождя вода собирается у входа в бастион. Жители просят выбрать, кто расчистит сток; помещение и недельный приказ остаются доступны.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "boundary",
    "category": "story",
    "title": "Старая межа",
    "text": "На границе деревни найден старый межевой камень. Община просит выяснить историю участка, прежде чем обсуждать новую постройку.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": 1,
    "followUp": {
      "title": "Вопросы о старой меже",
      "text": "Соседи принесли новую запись о найденном межевом камне. Можно продолжить разбирательство.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "school",
    "category": "story",
    "title": "Учитель в деревне",
    "text": "Проезжий учитель предлагает вечерние занятия. Их можно провести в подходящем помещении бастиона или на деревенской площади.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "water-question",
    "category": "story",
    "title": "Странный вкус воды",
    "text": "Жители просят исследовать колодец. Можно пригласить специалиста или разобраться самим; болезнь не назначается заранее.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "household-move",
    "category": "story",
    "title": "Новоселье по соседству",
    "text": "Семья переезжает в другой дом и приглашает хозяев бастиона на новоселье. За столом можно узнать местные новости.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "craft-lesson",
    "category": "story",
    "title": "Открытый урок ремесла",
    "text": "Мастер приглашает жителей на показ своей работы. Если подходящий объект есть в бастионе, он просит провести встречу там; иначе урок пройдёт в деревне.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "market-invitation",
    "category": "story",
    "title": "Приглашение на ярмарку",
    "text": "Соседи приглашают представить деревню на ярмарке. Выберите делегатов и предложение; торговую сделку и её стоимость обсудите отдельно.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "missing-pet",
    "category": "story",
    "title": "Пёс у старого подвала",
    "text": "Пропавший пёс найден у замурованного входа возле бастиона. Он упорно лает на щель в кладке; можно осмотреть подвал.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "family-letter",
    "category": "story",
    "title": "Письмо издалека",
    "text": "Бывший житель пишет, что узнал о восстановлении деревни. Он просит передать привет семье и предлагает встретиться в дороге.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "merchant-complaint",
    "category": "story",
    "title": "Спор с покупателем",
    "text": "Покупатель недоволен выполненным заказом и просит хозяев бастиона рассудить спор. Компенсацию назначают только после решения партии.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "shore-find",
    "category": "special",
    "title": "Знак старой пристани",
    "text": "После отлива найден знак прежних владельцев пристани. По нему можно искать старые карты или свидетелей истории деревни.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": 1,
    "followUp": {
      "title": "Новости о старой пристани",
      "text": "Лодочник нашёл упоминание знака пристани в дорожной книге и предлагает показать запись.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "shared-dream",
    "category": "special",
    "title": "Сон о воротах",
    "text": "Несколько жителей видели одинаковые ворота во сне. Их рисунки похожи на узор в старой части бастиона; решите, исследовать ли совпадение.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "grove-message",
    "category": "special",
    "title": "Приглашение из рощи",
    "text": "На опушке оставлено приглашение хозяевам бастиона. Посланник просит прийти без большой свиты и выслушать заботы обитателей рощи.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "morkant-arrival",
    "category": "special",
    "title": "Приход Альдевальда Морканта",
    "text": "К деревне подъезжает роскошная карета. Альдевальд Моркант в человеческом облике, Нимраэль и Эзракиль просят гостеприимства. Гость интересуется преданиями о возвращении умерших к жизни. Партия может предложить ночлег в бастионе и поговорить с путниками; тайну Морканта они публично не раскрывают.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": 1,
    "followUp": {
      "title": "Вести от Альдевальда Морканта",
      "text": "В бастион доставлено письмо Морканта. Он продолжает искать путь к возвращению к жизни и спрашивает, появились ли у партии новые сведения. Нимраэль и Эзракиль остаются его спутниками. Это продолжение знакомства, а не повторный первый приход.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "valkrein-visit",
    "category": "story",
    "title": "Визит Эдмунда Валькрейна",
    "text": "Эдмунд Валькрейн привозит товары и интересуется будущими заказами деревни и бастиона. Обсудите покупку, продажу или поставку для выбранного объекта. Ассортимент берётся из его листа; деньги меняются только после отдельной сделки. Каждый визит может продолжать предыдущие переговоры.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": 3,
    "followUp": {
      "title": "Посыльный Валькрейна",
      "text": "После прежних визитов Валькрейн передаёт предложения через посыльного. Партия может обсудить поставку для бастиона или отправить ответ. Сделка оплачивается отдельно; личный визит не расходуется.",
      "category": "story",
      "effects": {},
      "maxOccurrences": null,
      "track": null,
      "min": 0
    }
  },
  {
    "id": "quiet-week",
    "category": "story",
    "title": "Спокойная неделя",
    "text": "Деревня живёт обычными заботами. Приказы бастиона выполняются в обычном порядке; дополнительных решений не требуется.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "patrol-report",
    "category": "story",
    "title": "Доклад дозора",
    "text": "Дозорные сообщают о незнакомых кострах возле дороги. Решите, наблюдать ли за ними или поговорить с путниками.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "new-recruit",
    "category": "story",
    "title": "Доброволец у ворот",
    "text": "Местный житель просится на службу. Его можно представить начальнику стражи или поручить небольшое дело без создания отдельного счётчика работников.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "lost-banner",
    "category": "story",
    "title": "Потерянное знамя",
    "text": "У дороги нашли знамя неизвестного отряда. Жители принесли его в бастион и ждут решения, кому сообщить о находке.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "training-day",
    "category": "story",
    "title": "Открытые учения",
    "text": "Стража предлагает показать жителям упражнения. Выберите площадку и пригласите желающих; дополнительных боевых бонусов это само по себе не даёт.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "night-noise",
    "category": "story",
    "title": "Ночной шум",
    "text": "Из пустого помещения бастиона ночью слышны шаги. Можно проверить его лично или назначить наблюдение.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "surveyor",
    "category": "story",
    "title": "Землемер",
    "text": "Землемер предлагает осмотреть место будущей постройки. Решите, нужна ли его услуга, и обсудите цену до заключения сделки.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "inn-song",
    "category": "story",
    "title": "Песня о героях",
    "text": "Бард исполняет песню о партии, заметно приукрашивая её подвиги. Можно пригласить его в бастион или публично поправить рассказ.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "pilgrims",
    "category": "story",
    "title": "Паломники",
    "text": "Паломники просят указать безопасную дорогу и место для отдыха. Подходящее помещение бастиона или деревенская площадь могут стать местом встречи.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "old-soldier",
    "category": "story",
    "title": "Старый солдат",
    "text": "Ветеран узнаёт герб на воротах и рассказывает, где видел его прежде. Он согласен поделиться историей за разговором.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "map-error",
    "category": "story",
    "title": "Ошибка на карте",
    "text": "Путники уверяют, что указатель ведёт не туда. Решите, проверить ли дорогу и кто исправит знак.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "letters",
    "category": "story",
    "title": "Почта для деревни",
    "text": "Прибыл мешок писем. Одно адресовано прежнему владельцу бастиона, чья судьба неизвестна.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "duel-request",
    "category": "story",
    "title": "Вызов на поединок",
    "text": "Гость вызывает одного из хозяев бастиона на дружеское состязание. Участие, условия и ставки добровольны.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "festival-plan",
    "category": "story",
    "title": "Какой будет праздник",
    "text": "Жители предлагают три повода для праздника: память предков, открытие нового объекта или возвращение партии. Выберите один вместе с ними.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "missing-courier",
    "category": "story",
    "title": "Чужая сумка",
    "text": "Ребёнок нашёл сумку посыльного с неповреждённой печатью. Решите, искать ли владельца и кому доверить хранение.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "watch-animal",
    "category": "story",
    "title": "Зверь возле ворот",
    "text": "К воротам несколько ночей приходит необычный зверь. Он не нападает и, кажется, чего-то ждёт.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "archive-copy",
    "category": "story",
    "title": "Просьба переписчика",
    "text": "Переписчик просит разрешения сделать копию местной летописи. Если в бастионе есть библиотека, встреча может пройти там; иначе он работает в доме старосты.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "rare-book",
    "category": "story",
    "title": "Книга на обмен",
    "text": "Путник предлагает книгу в обмен на другую историю или услугу. Её содержание и ценность выясняются при осмотре.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "shrine-visit",
    "category": "story",
    "title": "Гость у святыни",
    "text": "Странствующий служитель просит провести открытую беседу о местных обычаях. Место встречи выбирает партия.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "workshop-rival",
    "category": "story",
    "title": "Соседний ремесленник",
    "text": "Мастер из соседнего селения предлагает совместный заказ. Можно познакомить его с работниками подходящего объекта или отказаться.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "order-question",
    "category": "story",
    "title": "Уточнение поручения",
    "text": "Исполнитель недельного приказа просит выбрать внешний вид результата или способ доставки. Приказ не срывается, но партия определяет детали.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "order-story",
    "category": "story",
    "title": "Неожиданный свидетель",
    "text": "Исполняя поручение, работник услышал разговор о заброшенном доме. После обычного отчёта он просит поговорить с хозяевами бастиона.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "order-thanks",
    "category": "story",
    "title": "Благодарность за поручение",
    "text": "Жители благодарят исполнителей недавнего приказа. Решите, отметить ли их работу общим ужином или личной благодарностью.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "order-offer",
    "category": "story",
    "title": "Дополнительный заказ",
    "text": "К выполненному поручению появился интерес у соседей. Новый заказ и оплату обсуждают отдельно; он не выдаёт бесплатного приказа.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "guest-room",
    "category": "story",
    "title": "Кому дать комнату",
    "text": "Две группы гостей одновременно просят ночлег. Партия решает, где их разместить, используя имеющиеся помещения деревни и бастиона.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "feast-dispute",
    "category": "story",
    "title": "Спор за столом",
    "text": "На общем ужине гости поспорили о местной истории. Можно дать им высказаться или предложить поискать доказательства.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "weather-shelter",
    "category": "story",
    "title": "Укрытие от бури",
    "text": "Путники укрываются у стен бастиона от непогоды. Среди них есть человек, знающий дорогу к следующей цели партии.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "river-crossing",
    "category": "story",
    "title": "Переправа",
    "text": "Соседи просят помочь организовать переправу для важного гостя. Решите, участвовать ли лично или дать совет местным лодочникам.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "child-discovery",
    "category": "story",
    "title": "Детская находка",
    "text": "Дети принесли странный камень из оврага. Он может оказаться обычным минералом или указать на старые выработки; это выясняется исследованием.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "old-key",
    "category": "story",
    "title": "Старый ключ",
    "text": "При уборке найден ключ с гербом. Жители предлагают проверить старые двери бастиона и записи о его прежних хозяевах.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "seal-letter",
    "category": "story",
    "title": "Письмо с печатью",
    "text": "В бастион доставлено письмо без имени отправителя. На воске виден незнакомый знак; решите, кому доверить изучение.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "local-guide",
    "category": "story",
    "title": "Местный проводник",
    "text": "Охотник предлагает показать безопасную тропу к соседнему владению. Условия сопровождения обсуждаются отдельно.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "harbor-news",
    "category": "story",
    "title": "Новости с пристани",
    "text": "Лодочник приносит слух о необычном грузе. Он готов рассказать, с какого судна его выгрузили.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "raess-rumor",
    "category": "story",
    "title": "Слух о Раэссе",
    "text": "Путник спрашивает, встречала ли партия Раэсса Валиру. Он знает лишь имя и недавнее место встречи, а не скрытые сведения о персонаже.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "ragnaret-message",
    "category": "story",
    "title": "Весть о Рагнарете",
    "text": "Посыльный сообщает, что в соседнем городе видели Рагнарета. Можно проверить слух или передать собственное сообщение через надёжного знакомого.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "midnight-sign",
    "category": "story",
    "title": "Знак Полуночи",
    "text": "Стражник нашёл у дороги знак, похожий на украшение спутников Морканта. Его происхождение можно выяснить в разговоре, если партия уже знакома с ними.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "carriage-tracks",
    "category": "story",
    "title": "Следы кареты",
    "text": "На дороге заметили колею роскошной кареты. Местные предлагают узнать, кто проезжал мимо; находка не означает нового первого знакомства.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "local-petition",
    "category": "story",
    "title": "Общая просьба",
    "text": "Жители просят выделить место для собраний. Партия выбирает подходящее существующее помещение или обсуждает будущую постройку.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "object-name",
    "category": "story",
    "title": "Название объекта",
    "text": "Жители придумали несколько названий для объекта бастиона. Выберите одно или предложите своё; характеристики объекта не меняются.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "memorial",
    "category": "story",
    "title": "Памятный день",
    "text": "Наступил день памяти людей, защитивших деревню. Решите, как отметить его и какие имена сохранить в летописи.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "peace-talk",
    "category": "story",
    "title": "Встреча соседей",
    "text": "Представители двух соседних семей хотят заключить мир на нейтральной территории бастиона. Партия может выступить свидетелем.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "found-owner",
    "category": "story",
    "title": "Нашёлся хозяин",
    "text": "За ранее найденной обычной вещью приходит человек с доказательствами владения. Если подходящей находки не было, речь идёт о вещи, переданной старосте.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "roadside-market",
    "category": "story",
    "title": "Торговля у дороги",
    "text": "Несколько мелких торговцев предлагают остановиться возле деревни на один день. Разрешите место и обсудите правила без обязательной покупки.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "request-healer",
    "category": "story",
    "title": "Просьба лекаря",
    "text": "Лекарь просит тихое помещение для приёма жителей. Можно предложить комнату в бастионе или помочь договориться с хозяином другого дома.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "watch-fire",
    "category": "story",
    "title": "Огонь на холме",
    "text": "Ночной дозор заметил сигнальный костёр. Решите, ответить ли на сигнал, послать наблюдателя или дождаться утра.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "guest-performance",
    "category": "story",
    "title": "Представление",
    "text": "Небольшая труппа предлагает выступить во дворе. Условия выступления согласуются заранее; доход не начисляется автоматически.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "quiet-work",
    "category": "story",
    "title": "Обычные заботы",
    "text": "Неделя прошла без происшествий. Жители заняты своим делом, а бастион завершает назначенные поручения.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  },
  {
    "id": "weekly-council",
    "category": "story",
    "title": "Совет на следующую неделю",
    "text": "Представители деревни предлагают собраться в бастионе и обсудить ближайшее поручение, будущий объект или поездку партии.",
    "track": null,
    "min": 0,
    "effects": {},
    "maxOccurrences": null
  }
];

export function eventLimit(s,e){const value=s.eventLimits?.[e.id];return value===undefined?(e.maxOccurrences??null):value===-1?null:value;}
export function eventCount(s,key){return Math.max(s.eventCounts?.[key]??0,(s.eventHistory??[]).filter(e=>e.eventKey===key&&e.status==='applied').length);}
export function eventRepeatText(s,e){const limit=eventLimit(s,e),count=eventCount(s,e.id);return limit===null?'Повторяемое':limit===0?'Выключено':limit===1?`Одноразовое · ${count}/1`:`Ограниченное · ${count}/${limit}`;}

export function eventEffectText(e){
 const f=e.effects??{};
 if(f.days)return `Срок текущего проекта: ${f.days>0?'+':''}${f.days} дн.`;
 if(f.discount)return `Разовая скидка на неоплаченный этап: ${f.discount} зм.`;
 const names={stock:'Запас припасов',materials:'Материалы',treasury:'Казна'};
 for(const [k,name] of Object.entries(names))if(f[k])return `${name}: ${f[k]>0?'+':''}${f[k]}${k==='treasury'?' зм':''}, один раз.${f[k]<0?(k==='treasury'?' Нужна полная сумма в казне; нового долга не будет.':' Списание ограничено доступным остатком; нового долга не будет.'):''} Недельные показатели не меняются.`;
 if(f.gold)return `Старое событие: расчёт ${Math.abs(f.gold)} зм с выбранным персонажем.`;
 return 'Сюжетное событие: автоматических изменений нет.';
}

// Village-owned definitions; existing pending/history entries remain immutable snapshots.
export function eventDefinitions(s){return [...EVENTS,...(s.customEvents??[])].map(e=>{const entry={...structuredClone(e),...structuredClone(s.eventOverrides?.[e.id]??{}),id:e.id};const limit=entry.maxOccurrences;if(entry.followUp&&limit!==null&&eventCount(s,e.id)>=limit)return {...entry,...structuredClone(entry.followUp),id:e.id,continuation:true};return entry;});}
export function eventRange(s,key){const index=eventDefinitions(s).findIndex(e=>e.id===key);return s.eventRanges?.[key]??(index>=0&&index<100?[index+1,index+1]:[0,0]);}
export function eventSettings(s){return {mode:s.eventSettings?.mode??'table',interval:s.eventSettings?.interval??7,cooldown:s.eventSettings?.cooldown??60};}
export function eventAtRoll(s,roll){return eventDefinitions(s).find(e=>{const [a,b]=eventRange(s,e.id);return a>0&&roll>=a&&roll<=b;});}
