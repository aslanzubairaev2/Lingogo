import { Phrase } from '../types';

const now = Date.now();

// FIX: Updated data structure to match the new Phrase type with nested objects.
const generalPhrases: Omit<Phrase, 'id' | 'category'>[] = [
  {
    text: { native: "Где туалет?", learning: "Wo ist die Toilette?" },
    romanization: { learning: "[во ист ди туалетте]" },
    context: { native: "Когда нужно найти туалет в общественном месте" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Сколько это стоит?", learning: "Wie viel kostet das?" },
    romanization: { learning: "[ви филь костет дас]" },
    context: { native: "В магазине, на рынке, при покупке чего-либо" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можно счет, пожалуйста?", learning: "Die Rechnung, bitte." },
    romanization: { learning: "[ди рэхнунг битте]" },
    context: { native: "В ресторане, кафе при оплате" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я хочу это", learning: "Ich möchte das." },
    romanization: { learning: "[их мёхте дас]" },
    context: { native: "Когда указываешь на вещь и говоришь, что хочешь её" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не знаю", learning: "Ich weiß nicht." },
    romanization: { learning: "[их вайс нихт]" },
    context: { native: "Короткий ответ, когда не знаешь ответа" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не говорю по-немецки", learning: "Ich spreche kein Deutsch." },
    romanization: { learning: "[их шпрехе кайн дойч]" },
    context: { native: "Когда хочешь объяснить, что не знаешь немецкий язык" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Помогите!", learning: "Hilfe!" },
    romanization: { learning: "[хильфе]" },
    context: { native: "В экстренной ситуации, просьба о помощи" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Полицию!", learning: "Polizei!" },
    romanization: { learning: "[полицай]" },
    context: { native: "Когда нужна помощь полиции" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я потерялся", learning: "Ich habe mich verlaufen." },
    romanization: { learning: "[их хабе мих ферлауфен]" },
    context: { native: "Когда заблудился в городе или в незнакомом месте" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где ближайшая аптека?", learning: "Wo ist die nächste Apotheke?" },
    romanization: { learning: "[во ист ди нэхсте аптеке]" },
    context: { native: "Когда нужно найти аптеку" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "У меня аллергия", learning: "Ich habe eine Allergie." },
    romanization: { learning: "[их хабе айне аллергии]" },
    context: { native: "При разговоре с врачом или в ресторане о еде" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вызовите скорую", learning: "Rufen Sie einen Krankenwagen." },
    romanization: { learning: "[руфен зи айнен кранкенваген]" },
    context: { native: "В экстренной ситуации, когда нужен врач" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можно воду?", learning: "Ein Wasser, bitte." },
    romanization: { learning: "[айн васса битте]" },
    context: { native: "В ресторане, кафе или магазине, когда заказываешь воду" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я голоден", learning: "Ich habe Hunger." },
    romanization: { learning: "[их хабе хунгер]" },
    context: { native: "Когда хочешь сказать, что ты голоден" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я хочу пить", learning: "Ich habe Durst." },
    romanization: { learning: "[их хабе дурст]" },
    context: { native: "Когда испытываешь жажду" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Приятного аппетита", learning: "Guten Appetit." },
    romanization: { learning: "[гутен аппетит]" },
    context: { native: "Фраза перед едой, пожелание приятного аппетита" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "За здоровье!", learning: "Zum Wohl!" },
    romanization: { learning: "[цум вол]" },
    context: { native: "Тост, когда чокаются бокалами" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где вокзал?", learning: "Wo ist der Bahnhof?" },
    romanization: { learning: "[во ист дер банхоф]" },
    context: { native: "Когда ищешь железнодорожный вокзал" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где автобусная остановка?", learning: "Wo ist die Bushaltestelle?" },
    romanization: { learning: "[во ист ди бусхальтештеле]" },
    context: { native: "Когда ищешь автобусную остановку" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я опоздал", learning: "Ich bin zu spät." },
    romanization: { learning: "[их бин цу шпэт]" },
    context: { native: "Когда пришёл позже, чем нужно было" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Удачи!", learning: "Viel Glück!" },
    romanization: { learning: "[филь глюк]" },
    context: { native: "Когда желаешь кому-то успеха" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Будьте здоровы!", learning: "Gesundheit!" },
    romanization: { learning: "[гезундхайт]" },
    context: { native: "Говорится, когда кто-то чихнул" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не уверен", learning: "Ich bin nicht sicher." },
    romanization: { learning: "[их бин нихт зихер]" },
    context: { native: "Когда сомневаешься в ответе" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я устал", learning: "Ich bin müde." },
    romanization: { learning: "[их бин мюде]" },
    context: { native: "Когда хочешь сказать, что устал" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это хорошо", learning: "Das ist gut." },
    romanization: { learning: "[дас ист гут]" },
    context: { native: "Частый комментарий, когда что-то нравится" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не понимаю", learning: "Ich verstehe nicht" },
    romanization: { learning: "[их фер-штэ-э нихт]" },
    context: { native: "Когда не понял собеседника" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можете повторить?", learning: "Können Sie das wiederholen?" },
    romanization: { learning: "[кёнэн зи дас видэр-олен]" },
    context: { native: "Просьба повторить сказанное" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Говорите, пожалуйста, медленнее", learning: "Sprechen Sie bitte langsamer" },
    romanization: { learning: "[шпрэхэн зи битте лангзама]" },
    context: { native: "Когда собеседник говорит слишком быстро" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я учу немецкий", learning: "Ich lerne Deutsch" },
    romanization: { learning: "[их лэрнэ дойч]" },
    context: { native: "О себе, в разговоре с немцами" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как вас зовут?", learning: "Wie heißen Sie?" },
    romanization: { learning: "[ви хайсэн зи]" },
    context: { native: "Знакомство вежливое" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как тебя зовут?", learning: "Wie heißt du?" },
    romanization: { learning: "[ви хайст ду]" },
    context: { native: "Знакомство в неформальной обстановке" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Меня зовут ...", learning: "Ich heiße ..." },
    romanization: { learning: "[их хайсэ]" },
    context: { native: "Ответ при знакомстве" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Очень приятно", learning: "Freut mich" },
    romanization: { learning: "[фройт мих]" },
    context: { native: "Ответ на знакомство" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Откуда вы?", learning: "Woher kommen Sie?" },
    romanization: { learning: "[во-хэр комэн зи]" },
    context: { native: "Вежливый вопрос о происхождении" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я из России", learning: "Ich komme aus Russland" },
    romanization: { learning: "[их комэ аус руссланд]" },
    context: { native: "Рассказываешь, откуда приехал" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Сколько вам лет?", learning: "Wie alt sind Sie?" },
    romanization: { learning: "[ви альт зинт зи]" },
    context: { native: "Вежливый вопрос о возрасте" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Мне 30 лет", learning: "Ich bin 30 Jahre alt" },
    romanization: { learning: "[их бин драйсиг ярэ альт]" },
    context: { native: "Рассказываешь про возраст" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Чем вы занимаетесь?", learning: "Was machen Sie beruflich?" },
    romanization: { learning: "[вас махэн зи беруфлих]" },
    context: { native: "Вежливый вопрос о профессии" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я работаю учителем", learning: "Ich arbeite als Lehrer" },
    romanization: { learning: "[их арбайтэ альс лера]" },
    context: { native: "Сообщаешь о профессии" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где вы живёте?", learning: "Wo wohnen Sie?" },
    romanization: { learning: "[во вонэн зи]" },
    context: { native: "Вежливый вопрос о месте жительства" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я живу в Берлине", learning: "Ich wohne in Berlin" },
    romanization: { learning: "[их воне ин берлин]" },
    context: { native: "Сообщаешь место проживания" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "У вас есть семья?", learning: "Haben Sie Familie?" },
    romanization: { learning: "[хабэн зи фамилие]" },
    context: { native: "Вежливый вопрос о семье" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "У меня есть дети", learning: "Ich habe Kinder" },
    romanization: { learning: "[их хабэ кинда]" },
    context: { native: "Говоришь о семье" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я немного говорю по-немецки", learning: "Ich spreche ein bisschen Deutsch" },
    romanization: { learning: "[их шпрэхэ айн бисхен дойч]" },
    context: { native: "Сообщаешь уровень владения языком" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы говорите по-английски?", learning: "Sprechen Sie Englisch?" },
    romanization: { learning: "[шпрэхэн зи енглиш]" },
    context: { native: "Спрашиваешь, понимает ли собеседник английский" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где вы работаете?", learning: "Wo arbeiten Sie?" },
    romanization: { learning: "[во арбайтэн зи]" },
    context: { native: "Вежливый вопрос о месте работы" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я работаю в офисе", learning: "Ich arbeite im Büro" },
    romanization: { learning: "[их арбайтэ им бюро]" },
    context: { native: "Рассказываешь о месте работы" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Что вы делаете в свободное время?", learning: "Was machen Sie in Ihrer Freizeit?" },
    romanization: { learning: "[вас махэн зи ин ира фрайцайт]" },
    context: { native: "Вежливый вопрос о хобби" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я люблю читать книги", learning: "Ich lese gern Bücher" },
    romanization: { learning: "[их лезэ гэрн бюхэр]" },
    context: { native: "Говоришь о хобби" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я часто смотрю фильмы", learning: "Ich schaue oft Filme" },
    romanization: { learning: "[их шауе офт фильме]" },
    context: { native: "Рассказываешь о хобби или досуге" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы любите спорт?", learning: "Mögen Sie Sport?" },
    romanization: { learning: "[мёгэн зи шпорт]" },
    context: { native: "Вежливый вопрос о спортивных увлечениях" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я люблю путешествовать", learning: "Ich reise gern" },
    romanization: { learning: "[их райзе гэрн]" },
    context: { native: "Рассказываешь о хобби или увлечениях" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы часто путешествуете?", learning: "Reisen Sie oft?" },
    romanization: { learning: "[райзэн зи офт]" },
    context: { native: "Вежливый вопрос о путешествиях" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы женаты? / Вы замужем?", learning: "Sind Sie verheiratet?" },
    romanization: { learning: "[зинд зи фэрхайратэт]" },
    context: { native: "Вежливый вопрос о семейном положении" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не женат / Я не замужем", learning: "Ich bin ledig" },
    romanization: { learning: "[их бин ледиґ]" },
    context: { native: "Рассказываешь о семейном положении" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "У меня есть брат", learning: "Ich habe einen Bruder" },
    romanization: { learning: "[их хабэ айнэн бруда]" },
    context: { native: "Рассказываешь о семье" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "У меня есть сестра", learning: "Ich habe eine Schwester" },
    romanization: { learning: "[их хабэ айнэ швеста]" },
    context: { native: "Рассказываешь о семье" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где мы можем встретиться?", learning: "Wo können wir uns treffen?" },
    romanization: { learning: "[во кёнэн вир унс треффэн]" },
    context: { native: "Назначение встречи" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Когда мы встретимся?", learning: "Wann treffen wir uns?" },
    romanization: { learning: "[ван треффэн вир унс]" },
    context: { native: "Вопрос о времени встречи" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Во сколько мы встретимся?", learning: "Um wie viel Uhr treffen wir uns?" },
    romanization: { learning: "[ум ви фи́ль у́р треффэн вир унс]" },
    context: { native: "Вопрос о точном времени встречи" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где находится туалет?", learning: "Wo ist die Toilette?" },
    romanization: { learning: "[во ист ди туалеттэ]" },
    context: { native: "Обычный вопрос в общественном месте" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как пройти к вокзалу?", learning: "Wie komme ich zum Bahnhof?" },
    romanization: { learning: "[ви комэ их цум банхоф]" },
    context: { native: "Спросить дорогу до вокзала" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это далеко отсюда?", learning: "Ist es weit von hier?" },
    romanization: { learning: "[ист эс вай̯т фон хи́р]" },
    context: { native: "Уточняешь расстояние" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Покажите, пожалуйста, на карте", learning: "Zeigen Sie es bitte auf der Karte" },
    romanization: { learning: "[цайгэн зи эс битте ауф дер карте]" },
    context: { native: "Просишь указать место на карте" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я ищу аптеку", learning: "Ich suche eine Apotheke" },
    romanization: { learning: "[их зу́хэ айнэ аптеке]" },
    context: { native: "Ищешь ближайшую аптеку" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где находится ближайший банкомат?", learning: "Wo ist der nächste Geldautomat?" },
    romanization: { learning: "[во ист дер нёхстэ гельд-аутомат]" },
    context: { native: "Спросить, где можно снять деньги" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как пройти в центр города?", learning: "Wie komme ich ins Stadtzentrum?" },
    romanization: { learning: "[ви комэ их инс штат-центрум]" },
    context: { native: "Спросить дорогу в центр" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы можете мне помочь?", learning: "Können Sie mir helfen?" },
    romanization: { learning: "[кёнэн зи мир хельфэн]" },
    context: { native: "Просишь помощи у кого-то" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Конечно", learning: "Natürlich" },
    romanization: { learning: "[натюрлих]" },
    context: { native: "Короткий ответ-согласие" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Без проблем", learning: "Kein Problem" },
    romanization: { learning: "[кайн проблем]" },
    context: { native: "Ответ, что всё в порядке" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я потерялся", learning: "Ich habe mich verlaufen" },
    romanization: { learning: "[их хабэ мих фэрла́уфэн]" },
    context: { native: "Если заблудился в городе" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Подождите минуту", learning: "Einen Moment, bitte" },
    romanization: { learning: "[айнэн момент битте]" },
    context: { native: "Просьба немного подождать" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не знаю", learning: "Ich weiß nicht" },
    romanization: { learning: "[их вайс нихт]" },
    context: { native: "Короткий ответ на вопрос" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Мне всё равно", learning: "Es ist mir egal" },
    romanization: { learning: "[эс ист мир эгал]" },
    context: { native: "Выражение безразличия" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я согласен", learning: "Ich bin einverstanden" },
    romanization: { learning: "[их бин айнферштандэн]" },
    context: { native: "Согласие в разговоре" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не согласен", learning: "Ich bin nicht einverstanden" },
    romanization: { learning: "[их бин нихт айнферштандэн]" },
    context: { native: "Выражение несогласия" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы правы", learning: "Sie haben recht" },
    romanization: { learning: "[зи хабэн рехт]" },
    context: { native: "Согласие с собеседником" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это хорошая идея", learning: "Das ist eine gute Idee" },
    romanization: { learning: "[дас ист айнэ гутэ иде́э]" },
    context: { native: "Оценка предложенного варианта" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не уверен", learning: "Ich bin nicht sicher" },
    romanization: { learning: "[их бин нихт зихер]" },
    context: { native: "Выражаешь сомнение" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можете мне подсказать?", learning: "Können Sie mir Bescheid sagen?" },
    romanization: { learning: "[кёнэн зи мир бишайд загэн]" },
    context: { native: "Просьба дать информацию" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я не уверен, что понимаю", learning: "Ich bin nicht sicher, ob ich verstehe" },
    romanization: { learning: "[их бин нихт зихер, об их фер-штэ-э]" },
    context: { native: "Выражаешь сомнение в понимании" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как это сказать по-немецки?", learning: "Wie sagt man das auf Deutsch?" },
    romanization: { learning: "[ви загт ман дас ауф дойч]" },
    context: { native: "Учишься формулировать на немецком" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Что это значит?", learning: "Was bedeutet das?" },
    romanization: { learning: "[вас бедойтэт дас]" },
    context: { native: "Уточняешь значение слова или выражения" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы можете это записать?", learning: "Können Sie das aufschreiben?" },
    romanization: { learning: "[кёнэн зи дас ауфшрайбэн]" },
    context: { native: "Просьба записать информацию" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можете показать мне дорогу?", learning: "Können Sie mir den Weg zeigen?" },
    romanization: { learning: "[кёнэн зи мир ден вег цайгэн]" },
    context: { native: "Просьба показать направление" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где я могу купить билет?", learning: "Wo kann ich ein Ticket kaufen?" },
    romanization: { learning: "[во кан их айн тикет кауфэн]" },
    context: { native: "Покупка билета на транспорт или мероприятие" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Сколько времени займёт дорога?", learning: "Wie lange dauert die Fahrt?" },
    romanization: { learning: "[ви ланге дауэрт ди фарт]" },
    context: { native: "Спросить о длительности поездки" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Во сколько отправляется поезд?", learning: "Wann fährt der Zug ab?" },
    romanization: { learning: "[ван ферт дер цуг ап]" },
    context: { native: "Уточнить расписание поезда" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я ищу этот адрес", learning: "Ich suche diese Adresse" },
    romanization: { learning: "[их зухэ дизэ адрэссе]" },
    context: { native: "Сказать, что ищешь конкретное место" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это рядом?", learning: "Ist es in der Nähe?" },
    romanization: { learning: "[ист эс ин дер нэ́э]" },
    context: { native: "Спросить, далеко ли находится место" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я спешу", learning: "Ich habe es eilig" },
    romanization: { learning: "[их хабэ эс айлиг]" },
    context: { native: "Сообщаешь, что торопишься" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Не волнуйтесь", learning: "Machen Sie sich keine Sorgen" },
    romanization: { learning: "[махэн зи зих кайнэ зоргэн]" },
    context: { native: "Успокоить собеседника" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это очень важно", learning: "Das ist sehr wichtig" },
    romanization: { learning: "[дас ист зеа́р вихтих]" },
    context: { native: "Подчеркнуть значимость чего-то" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это не имеет значения", learning: "Das spielt keine Rolle" },
    romanization: { learning: "[дас шпильт кайнэ роллэ]" },
    context: { native: "Когда что-то неважно" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я устал", learning: "Ich bin müde" },
    romanization: { learning: "[их бин мюдэ]" },
    context: { native: "Состояние усталости" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я голоден", learning: "Ich habe Hunger" },
    romanization: { learning: "[их хабэ хунгер]" },
    context: { native: "Сообщить о голоде" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я хочу пить", learning: "Ich habe Durst" },
    romanization: { learning: "[их хабэ дурст]" },
    context: { native: "Сообщить о жажде" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это вкусно", learning: "Das ist lecker" },
    romanization: { learning: "[дас ист леккэр]" },
    context: { native: "Оценка еды" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Счёт, пожалуйста", learning: "Die Rechnung, bitte" },
    romanization: { learning: "[ди рэхнунг битте]" },
    context: { native: "Просьба в кафе или ресторане" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можно карту, пожалуйста?", learning: "Kann ich eine Karte bekommen?" },
    romanization: { learning: "[кан их айнэ карте бэкоммэн]" },
    context: { native: "Спросить карту меню или города" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я хотел бы это заказать", learning: "Ich möchte das bestellen" },
    romanization: { learning: "[их мёхтэ дас бэштэллен]" },
    context: { native: "Заказ еды или услуги" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Что вы посоветуете?", learning: "Was empfehlen Sie?" },
    romanization: { learning: "[вас эмфелен зи]" },
    context: { native: "Совет при выборе еды или услуги" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Приятного аппетита", learning: "Guten Appetit" },
    romanization: { learning: "[гутен аппетит]" },
    context: { native: "Пожелание перед едой" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Будьте здоровы! (при чихании)", learning: "Gesundheit!" },
    romanization: { learning: "[гезундхайт]" },
    context: { native: "Реакция, когда кто-то чихнул" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это срочно", learning: "Es ist dringend" },
    romanization: { learning: "[эс ист дрингэнд]" },
    context: { native: "Подчеркнуть срочность" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я замёрз", learning: "Mir ist kalt" },
    romanization: { learning: "[мир ист кальт]" },
    context: { native: "Сообщаешь, что тебе холодно" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Мне жарко", learning: "Mir ist heiß" },
    romanization: { learning: "[мир ист хайс]" },
    context: { native: "Сообщаешь, что тебе жарко" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можно сюда?", learning: "Ist hier frei?" },
    romanization: { learning: "[ист хиa фрай?]" },
    context: { native: "Спросить, свободно ли место" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я бронировал столик", learning: "Ich habe einen Tisch reserviert" },
    romanization: { learning: "[их хабэ айнэн тиш резерви́рт]" },
    context: { native: "Сообщить в ресторане о брони" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где ближайшая аптека?", learning: "Wo ist die nächste Apotheke?" },
    romanization: { learning: "[во ист ди нёхстэ аптекэ]" },
    context: { native: "Спросить дорогу в аптеку" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Мне нужен врач", learning: "Ich brauche einen Arzt" },
    romanization: { learning: "[их браухэ айнэн арцт]" },
    context: { native: "Сообщаешь о необходимости врача" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вызовите скорую!", learning: "Rufen Sie einen Krankenwagen!" },
    romanization: { learning: "[руфэн зи айнэн кранкенваген]" },
    context: { native: "В экстренной ситуации" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я плохо себя чувствую", learning: "Mir geht es nicht gut" },
    romanization: { learning: "[мир гейт эс нихт гут]" },
    context: { native: "Сообщение о плохом самочувствии" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "У меня аллергия", learning: "Ich habe eine Allergie" },
    romanization: { learning: "[их хабэ айнэ аллерги́]" },
    context: { native: "Сообщить о наличии аллергии" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где больница?", learning: "Wo ist das Krankenhaus?" },
    romanization: { learning: "[во ист дас кранкенхаус]" },
    context: { native: "Спросить дорогу в больницу" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Осторожно!", learning: "Vorsicht!" },
    romanization: { learning: "[форзихт]" },
    context: { native: "Предупреждение об опасности" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Помогите!", learning: "Hilfe!" },
    romanization: { learning: "[хильфэ]" },
    context: { native: "Крик о помощи" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Остановитесь!", learning: "Halten Sie an!" },
    romanization: { learning: "[хальтэн зи ан]" },
    context: { native: "Команда остановиться" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я забронировал номер", learning: "Ich habe ein Zimmer reserviert" },
    romanization: { learning: "[их хабэ айн циммер резерви́рт]" },
    context: { native: "При заселении в отель" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Есть ли свободные номера?", learning: "Haben Sie freie Zimmer?" },
    romanization: { learning: "[хабэн зи фрайэ циммер]" },
    context: { native: "Вопрос при заселении в гостиницу" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "На сколько ночей?", learning: "Für wie viele Nächte?" },
    romanization: { learning: "[фюр ви филэ нэхтэ]" },
    context: { native: "Уточнение при бронировании" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Завтрак включён?", learning: "Ist das Frühstück inbegriffen?" },
    romanization: { learning: "[ист дас фрюштюк инбэгрифэн]" },
    context: { native: "Уточнить условия проживания" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я хотел бы оплатить", learning: "Ich möchte bezahlen" },
    romanization: { learning: "[их мёхтэ бэцален]" },
    context: { native: "Сообщаешь, что готов оплатить" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Вы принимаете карту?", learning: "Nehmen Sie Karte?" },
    romanization: { learning: "[немэн зи карте?]" },
    context: { native: "Спросить, можно ли оплатить картой" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где касса?", learning: "Wo ist die Kasse?" },
    romanization: { learning: "[во ист ди кассе]" },
    context: { native: "Спросить, где оплатить покупку" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я ищу метро", learning: "Ich suche die U-Bahn" },
    romanization: { learning: "[их зухэ ди убан]" },
    context: { native: "Спросить дорогу к метро" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где остановка автобуса?", learning: "Wo ist die Bushaltestelle?" },
    romanization: { learning: "[во ист ди бусхальтештелле]" },
    context: { native: "Спросить дорогу к остановке" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Мне нужен билет", learning: "Ich brauche ein Ticket" },
    romanization: { learning: "[их браухэ айн тикет]" },
    context: { native: "Купить билет на транспорт" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Сколько стоит билет?", learning: "Wie viel kostet ein Ticket?" },
    romanization: { learning: "[ви фил костет айн тикет]" },
    context: { native: "Уточнить цену билета" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Когда отправляется поезд?", learning: "Wann fährt der Zug?" },
    romanization: { learning: "[ван фэрт дер цуг]" },
    context: { native: "Спросить время отправления" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Где выход?", learning: "Wo ist der Ausgang?" },
    romanization: { learning: "[во ист дер аусганг]" },
    context: { native: "Спросить, как выйти" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как далеко?", learning: "Wie weit?" },
    romanization: { learning: "[ви вайт?]" },
    context: { native: "Уточнить расстояние" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это недалеко", learning: "Es ist nicht weit" },
    romanization: { learning: "[эс ист нихт вайт]" },
    context: { native: "Сообщить о близком расстоянии" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это близко", learning: "Es ist in der Nähe" },
    romanization: { learning: "[эс ист ин дер нээ]" },
    context: { native: "Сообщить, что место рядом" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это далеко", learning: "Es ist weit weg" },
    romanization: { learning: "[эс ист вайт вэк]" },
    context: { native: "Сообщить, что место далеко" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как туда добраться?", learning: "Wie komme ich dorthin?" },
    romanization: { learning: "[ви комэ их дортхин?]" },
    context: { native: "Спросить дорогу" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можно пешком?", learning: "Kann man zu Fuß gehen?" },
    romanization: { learning: "[кан ман цу фус гейн?]" },
    context: { native: "Уточнить, можно ли дойти пешком" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я голоден", learning: "Ich habe Hunger" },
    romanization: { learning: "[их хабэ хунгер]" },
    context: { native: "Сообщить о голоде" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я хочу пить", learning: "Ich habe Durst" },
    romanization: { learning: "[их хабэ дурст]" },
    context: { native: "Сообщить о жажде" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Счёт, пожалуйста", learning: "Die Rechnung, bitte" },
    romanization: { learning: "[ди рехнунг биттэ]" },
    context: { native: "Попросить счёт в кафе или ресторане" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Это очень вкусно", learning: "Es ist sehr lecker" },
    romanization: { learning: "[эс ист зеа лекка]" },
    context: { native: "Похвалить еду" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я вегетарианец", learning: "Ich bin Vegetarier" },
    romanization: { learning: "[их бин вегетариа]" },
    context: { native: "Сообщить в кафе или ресторане" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Без мяса, пожалуйста", learning: "Ohne Fleisch, bitte" },
    romanization: { learning: "[оне фляйш биттэ]" },
    context: { native: "Попросить еду без мяса" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можно без сахара?", learning: "Ohne Zucker, bitte" },
    romanization: { learning: "[оне цукка биттэ]" },
    context: { native: "Попросить напиток без сахара" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Говорите медленнее, пожалуйста", learning: "Sprechen Sie bitte langsamer" },
    romanization: { learning: "[шпрехэн зи биттэ лангзама]" },
    context: { native: "Попросить говорить медленнее" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Повторите, пожалуйста", learning: "Wiederholen Sie, bitte" },
    romanization: { learning: "[видерхолен зи биттэ]" },
    context: { native: "Попросить повторить сказанное" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как это сказать по-немецки?", learning: "Wie sagt man das auf Deutsch?" },
    romanization: { learning: "[ви загт ман дас ауф дойч?]" },
    context: { native: "Спросить перевод слова/фразы" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Я немного говорю по-немецки", learning: "Ich spreche ein wenig Deutsch" },
    romanization: { learning: "[их шпрехэ айн вениг дойч]" },
    context: { native: "Сообщить о своём уровне языка" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Можете помочь мне?", learning: "Können Sie mir helfen?" },
    romanization: { learning: "[кёнэн зи мир хельфэн?]" },
    context: { native: "Попросить о помощи" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Как вас зовут?", learning: "Wie heißen Sie?" },
    romanization: { learning: "[ви хайсэн зи?]" },
    context: { native: "Спросить имя собеседника" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Меня зовут ...", learning: "Ich heiße ..." },
    romanization: { learning: "[их хайсэ ...]" },
    context: { native: "Представиться" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  },
  {
    text: { native: "Очень приятно", learning: "Freut mich" },
    romanization: { learning: "[фройт мих]" },
    context: { native: "Вежливый ответ при знакомстве" },
    masteryLevel: 0, lastReviewedAt: null, nextReviewAt: now, knowCount: 0, knowStreak: 0, isMastered: false, lapses: 0
  }
];

const pronouns = [
  // Nominativ
  { native: "я", learning: "ich" },
  { native: "ты", learning: "du" },
  { native: "он", learning: "er" },
  { native: "она", learning: "sie" },
  { native: "оно", learning: "es" },
  { native: "мы", learning: "wir" },
  { native: "вы (неформ.)", learning: "ihr" },
  { native: "они", learning: "sie" },
  { native: "Вы (форм.)", learning: "Sie" },
  // Akkusativ
  { native: "меня (Akk)", learning: "mich" },
  { native: "тебя (Akk)", learning: "dich" },
  { native: "его (Akk)", learning: "ihn" },
  // Dativ
  { native: "мне (Dat)", learning: "mir" },
  { native: "тебе (Dat)", learning: "dir" },
  { native: "ему (Dat)", learning: "ihm" },
  { native: "им (Dat)", learning: "ihnen" },
  { native: "Вам (Dat)", learning: "Ihnen" },
  // Possessiv
  { native: "мой", learning: "mein" },
  { native: "твой", learning: "dein" },
  { native: "его (притяж.)", learning: "sein" },
  { native: "её", learning: "ihr" },
];

const wFragen = [
  { native: "Что?", learning: "Was?" },
  { native: "Кто?", learning: "Wer?" },
  { native: "Где?", learning: "Wo?" },
  { native: "Когда?", learning: "Wann?" },
  { native: "Как?", learning: "Wie?" },
  { native: "Почему?", learning: "Warum?" },
  { native: "Откуда?", learning: "Woher?" },
  { native: "Куда?", learning: "Wohin?" },
  { native: "Какой?", learning: "Welcher?" },
  { native: "Сколько? (неисчисл.)", learning: "Wie viel?" },
  { native: "Сколько? (исчисл.)", learning: "Wie viele?" }
];

const numbers = [
  { native: "ноль", learning: "null" },
  { native: "один", learning: "eins" },
  { native: "два", learning: "zwei" },
  { native: "три", learning: "drei" },
  { native: "четыре", learning: "vier" },
  { native: "пять", learning: "fünf" },
  { native: "шесть", learning: "sechs" },
  { native: "семь", learning: "sieben" },
  { native: "восемь", learning: "acht" },
  { native: "девять", learning: "neun" },
  { native: "десять", learning: "zehn" },
  { native: "одиннадцать", learning: "elf" },
  { native: "двенадцать", learning: "zwölf" },
  { native: "двадцать", learning: "zwanzig" },
  { native: "сто", learning: "hundert" },
];

const timePhrases = [
  // Days
  { native: "Понедельник", learning: "Montag" },
  { native: "Вторник", learning: "Dienstag" },
  { native: "Среда", learning: "Mittwoch" },
  { native: "Четверг", learning: "Donnerstag" },
  { native: "Пятница", learning: "Freitag" },
  { native: "Суббота", learning: "Samstag" },
  { native: "Воскресенье", learning: "Sonntag" },
  // Months
  { native: "Январь", learning: "Januar" },
  { native: "Февраль", learning: "Februar" },
  { native: "Март", learning: "März" },
  { native: "Апрель", learning: "April" },
  { native: "Май", learning: "Mai" },
  { native: "Июнь", learning: "Juni" },
  { native: "Июль", learning: "Juli" },
  { native: "Август", learning: "August" },
  { native: "Сентябрь", learning: "September" },
  { native: "Октябрь", learning: "Oktober" },
  { native: "Ноябрь", learning: "November" },
  { native: "Декабрь", learning: "Dezember" },
  // Conversational Time
  { native: "Который час?", learning: "Wie spät ist es?" },
  { native: "Сейчас час.", learning: "Es ist ein Uhr." },
  { native: "Сейчас два часа.", learning: "Es ist zwei Uhr." },
  { native: "Пол первого.", learning: "Es ist halb eins." }, // 12:30
  { native: "Полтретьего.", learning: "Es ist halb drei." }, // 2:30
  { native: "Четверть пятого.", learning: "Es ist Viertel nach vier." }, // 4:15
  { native: "Без четверти шесть.", learning: "Es ist Viertel vor sechs." }, // 5:45
  { native: "Десять минут седьмого.", learning: "Es ist zehn nach sechs." }, // 6:10
  { native: "Без двадцати девять.", learning: "Es ist zwanzig vor neun." }, // 8:40
  { native: "Пять минут после полудня.", learning: "Es ist fünf nach zwölf." }, // 12:05
];

const moneyPhrases = [
  { native: "Сколько это стоит?", learning: "Was kostet das?" },
  { native: "Это стоит 10 евро.", learning: "Das kostet zehn Euro." },
  { native: "23,75 евро", learning: "dreiundzwanzig Euro fünfundsiebzig" },
  { native: "12,50 долларов", learning: "zwölf Dollar fünfzig" },
  { native: "У вас есть сдача с 50 евро?", learning: "Haben Sie Wechselgeld für fünfzig Euro?" },
  { native: "Я хотел бы заплатить.", learning: "Ich möchte bezahlen." }
];


const mapToPhraseDefaults = (p: { native: string, learning: string, category: string }): Omit<Phrase, 'id'> => ({
  // FIX: Map flat structure to nested `text` object.
  text: { native: p.native, learning: p.learning },
  category: p.category,
  masteryLevel: 0,
  lastReviewedAt: null,
  nextReviewAt: now,
  knowCount: 0,
  knowStreak: 0,
  isMastered: false,
  lapses: 0,
});

const foundationalPhrasesList = [
  ...pronouns.map(p => ({ ...p, category: 'pronouns' as const })),
  ...wFragen.map(p => ({ ...p, category: 'w-fragen' as const })),
  ...numbers.map(p => ({ ...p, category: 'numbers' as const })),
  ...timePhrases.map(p => ({ ...p, category: 'time' as const })),
  ...moneyPhrases.map(p => ({ ...p, category: 'money' as const })),
];

export const foundationalPhrases: Omit<Phrase, 'id'>[] = foundationalPhrasesList.map(mapToPhraseDefaults);

export const initialPhrases: Omit<Phrase, 'id'>[] = [
  ...generalPhrases.map(p => ({ ...p, category: 'general' as const })),
  ...foundationalPhrasesList.map(p => ({ ...p, text: { native: p.native, learning: p.learning } })),
].map(p => ({
  text: p.text,
  category: p.category,
  romanization: (p as any).romanization,
  context: (p as any).context,
  masteryLevel: 0,
  lastReviewedAt: null,
  nextReviewAt: now,
  knowCount: 0,
  knowStreak: 0,
  isMastered: false,
  lapses: 0,
}));