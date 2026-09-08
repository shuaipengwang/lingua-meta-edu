type SeedTheme = { themeId: string; name: string; coverImage: string; order: number };
type SeedLesson = { lessonId: string; themeId: string; title: string; difficulty: number; unlockRule: string };
type SeedSentence = { sentenceId: string; lessonId: string; enText: string; cnText: string; audioRef: string; imageRef: string };

// 3 主题 × 4 关卡 × 6 句子 = 72 句
const themes: SeedTheme[] = [
  { themeId: 'animals', name: '动物', coverImage: 'cdn://theme/animals.png', order: 1 },
  { themeId: 'colors', name: '颜色', coverImage: 'cdn://theme/colors.png', order: 2 },
  { themeId: 'greetings', name: '问候', coverImage: 'cdn://theme/greetings.png', order: 3 },
];

const lessons: SeedLesson[] = [
  // Animals 4 关卡
  { lessonId: 'animals-1', themeId: 'animals', title: '宠物', difficulty: 1, unlockRule: 'prev_1star' },
  { lessonId: 'animals-2', themeId: 'animals', title: '农场', difficulty: 1, unlockRule: 'prev_1star' },
  { lessonId: 'animals-3', themeId: 'animals', title: '动物园', difficulty: 2, unlockRule: 'prev_1star' },
  { lessonId: 'animals-4', themeId: 'animals', title: '海洋', difficulty: 2, unlockRule: 'prev_1star' },
  // Colors 4 关卡
  { lessonId: 'colors-1', themeId: 'colors', title: '基础色', difficulty: 1, unlockRule: 'prev_1star' },
  { lessonId: 'colors-2', themeId: 'colors', title: '更多色', difficulty: 1, unlockRule: 'prev_1star' },
  { lessonId: 'colors-3', themeId: 'colors', title: '深浅色', difficulty: 2, unlockRule: 'prev_1star' },
  { lessonId: 'colors-4', themeId: 'colors', title: '彩虹', difficulty: 3, unlockRule: 'prev_1star' },
  // Greetings 4 关卡
  { lessonId: 'greetings-1', themeId: 'greetings', title: '打招呼', difficulty: 1, unlockRule: 'prev_1star' },
  { lessonId: 'greetings-2', themeId: 'greetings', title: '道谢', difficulty: 1, unlockRule: 'prev_1star' },
  { lessonId: 'greetings-3', themeId: 'greetings', title: '告别', difficulty: 2, unlockRule: 'prev_1star' },
  { lessonId: 'greetings-4', themeId: 'greetings', title: '礼貌用语', difficulty: 2, unlockRule: 'prev_1star' },
];

// 每关 6 句的句库；用辅助函数批量生成避免手抄出错
const animalsBank: Record<string, [string, string][]> = {
  'animals-1': [['I see a cat.', '我看到一只猫。'], ['The dog is big.', '这只狗很大。'], ['A bird flies.', '一只鸟在飞。'], ['The cat is small.', '这只猫很小。'], ['I have a dog.', '我有一只狗。'], ['The bird sings.', '鸟儿在唱歌。']],
  'animals-2': [['The pig is pink.', '猪是粉色的。'], ['A cow says moo.', '牛叫哞哞。'], ['The duck swims.', '鸭子在游泳。'], ['I see a sheep.', '我看到一只羊。'], ['The hen is red.', '母鸡是红色的。'], ['A horse runs.', '马在跑。']],
  'animals-3': [['The lion is strong.', '狮子很强壮。'], ['A monkey jumps.', '猴子在跳。'], ['The elephant is big.', '大象很大。'], ['I see a tiger.', '我看到一只老虎。'], ['The panda is cute.', '熊猫很可爱。'], ['A zebra runs fast.', '斑马跑得快。']],
  'animals-4': [['A fish swims.', '鱼在游泳。'], ['The whale is huge.', '鲸鱼很大。'], ['I see a crab.', '我看到一只螃蟹。'], ['The shark is fast.', '鲨鱼很快。'], ['A turtle walks.', '乌龟在走。'], ['The dolphin jumps.', '海豚在跳。']],
};

const colorsBank: Record<string, [string, string][]> = {
  'colors-1': [['I see red.', '我看到红色。'], ['The apple is red.', '苹果是红色的。'], ['I like blue.', '我喜欢蓝色。'], ['The sky is blue.', '天空是蓝色的。'], ['I see yellow.', '我看到黄色。'], ['The sun is yellow.', '太阳是黄色的。']],
  'colors-2': [['I see green.', '我看到绿色。'], ['The grass is green.', '草是绿色的。'], ['I like pink.', '我喜欢粉色。'], ['The flower is pink.', '花是粉色的。'], ['I see orange.', '我看到橙色。'], ['The orange is orange.', '橙子是橙色的。']],
  'colors-3': [['I see dark blue.', '我看到深蓝。'], ['The night is dark.', '夜晚很暗。'], ['I like light green.', '我喜欢浅绿。'], ['The leaf is light.', '叶子很浅。'], ['I see dark red.', '我看到深红。'], ['The wine is dark.', '酒是深色的。']],
  'colors-4': [['Red is first.', '红色在第一。'], ['Blue is next.', '蓝色接着。'], ['Yellow is bright.', '黄色很亮。'], ['Green is fresh.', '绿色很清新。'], ['Purple is nice.', '紫色很好看。'], ['The rainbow is pretty.', '彩虹很漂亮。']],
};

const greetingsBank: Record<string, [string, string][]> = {
  'greetings-1': [['Hello, friend!', '你好，朋友！'], ['Hi, there!', '嗨，你好！'], ['Good morning.', '早上好。'], ['Good afternoon.', '下午好。'], ['How are you?', '你好吗？'], ['Nice to meet you.', '很高兴认识你。']],
  'greetings-2': [['Thank you.', '谢谢。'], ['Thanks a lot.', '非常感谢。'], ['You are kind.', '你真好。'], ['I am happy.', '我很开心。'], ['That is great.', '太棒了。'], ['Thanks again.', '再次感谢。']],
  'greetings-3': [['Goodbye, friend.', '再见，朋友。'], ['See you later.', '回头见。'], ['Bye bye.', '拜拜。'], ['See you tomorrow.', '明天见。'], ['Take care.', '保重。'], ['Good night.', '晚安。']],
  'greetings-4': [['Sorry about that.', '对不起。'], ['Excuse me.', '打扰一下。'], ['Please sit.', '请坐。'], ['You are welcome.', '不客气。'], ['May I help?', '我能帮吗？'], ['Bless you.', '祝福你。']],
};

const banks: Record<string, Record<string, [string, string][]>> = {
  animals: animalsBank,
  colors: colorsBank,
  greetings: greetingsBank,
};

function buildSentences(): SeedSentence[] {
  const out: SeedSentence[] = [];
  for (const lesson of lessons) {
    const themeId = lesson.themeId;
    const bank = banks[themeId][lesson.lessonId];
    for (let i = 0; i < bank.length; i++) {
      const [en, cn] = bank[i];
      const idx = i + 1;
      out.push({
        sentenceId: `${lesson.lessonId}-s${idx}`,
        lessonId: lesson.lessonId,
        enText: en,
        cnText: cn,
        audioRef: `cdn://audio/${lesson.lessonId}-s${idx}.mp3`,
        imageRef: `cdn://img/${lesson.lessonId}-s${idx}.png`,
      });
    }
  }
  return out;
}

export const seedData = {
  themes,
  lessons,
  sentences: buildSentences(),
};

// 落库脚本入口
export async function runSeed(prismaClient: { theme: { upsert: (a: unknown) => Promise<unknown> }; lesson: { upsert: (a: unknown) => Promise<unknown> }; sentence: { upsert: (a: unknown) => Promise<unknown> } }) {
  for (const t of seedData.themes) {
    await prismaClient.theme.upsert({
      where: { themeId: t.themeId },
      create: t,
      update: t,
    });
  }
  for (const l of seedData.lessons) {
    await prismaClient.lesson.upsert({
      where: { lessonId: l.lessonId },
      create: l,
      update: l,
    });
  }
  for (const s of seedData.sentences) {
    await prismaClient.sentence.upsert({
      where: { sentenceId: s.sentenceId },
      create: s,
      update: s,
    });
  }
}
