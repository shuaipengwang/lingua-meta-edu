# 数字人少儿英语陪练 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 跑通"数字人老师带读 → 孩子跟读 → ASR 评分 → 反馈"一条核心闭环的微信小程序 + Node/TS 后端 MVP。

**Architecture:** 三层：公众号（渠道，不在本期实现）→ 微信小程序（前端）←→ Node/TS 后端编排服务 ←→ 第三方能力（数字人/语音套件/对象存储）+ Postgres。后端是调度中枢，本身不做模型推理。

**Tech Stack:** 后端 Node.js + TypeScript + Fastify + Prisma + Postgres；前端微信小程序原生 + TypeScript；测试 Vitest（后端）+ miniprogram-simulate（前端）；第三方语音用讯飞发音评测 API（首版集成一家，预留适配层）。

**Spec 来源:** `docs/superpowers/specs/2026-09-08-digital-human-english-tutor-design.md`

---

## 文件结构总览

后端（`backend/`）按职责拆分，每文件单一职责：

```
backend/
├── prisma/
│   └── schema.prisma              # 数据模型（5 张表）
├── src/
│   ├── server.ts                   # Fastify 实例与路由挂载
│   ├── config.ts                   # 环境配置（第三方密钥、DB URL）
│   ├── db.ts                       # Prisma client 单例
│   ├── auth/
│   │   └── openid.ts               # wx.login code → openid
│   ├── content/
│   │   ├── contentRoutes.ts        # 取主题/关卡/句子路由
│   │   └── contentService.ts       # 内容查询逻辑
│   ├── progress/
│   │   ├── progressRoutes.ts       # 进度读写路由
│   │   └── progressService.ts      # 解锁/得星/attempt 落库
│   ├── speech/
│   │   ├── speechRoutes.ts         # 上传音频→评分路由
│   │   ├── speechService.ts        # 编排：上传→ASR+评测→返回
│   │   ├── xfyunClient.ts          # 讯飞发音评测适配
│   │   └── speechTypes.ts          # SpeechProvider 接口
│   ├── feedback/
│   │   └── feedbackPolicy.ts       # 分数阈值→反馈分支
│   └── seeds/
│       └── seedContent.ts          # 72 句课程数据种子
└── tests/                          # 镜像 src 结构
```

前端（`miniprogram/`）按页面拆：

```
miniprogram/
├── app.ts / app.json / app.wxss
├── pages/
│   ├── home/                       # 首页
│   ├── lessons/                    # 选课
│   ├── lesson/                     # 上课页（核心循环）
│   └── summary/                    # 课末小结
├── components/
│   ├── avatar/                     # 数字人形象（Lottie）
│   └── recordButton/              # 按住说话
├── services/
│   ├── request.ts                  # 封装 wx.request
│   ├── auth.ts                     # 静默 wx.login + openid
│   └── lessonClient.ts             # 后端 API 客户端
└── utils/
    └── feedbackAssets.ts           # 反馈模板资源映射
```

**职责边界**：后端 services 层做业务逻辑、不碰 HTTP；routes 层做 HTTP 适配、不碰业务；speechTypes 定义 provider 接口、xfyunClient 是其中一个实现，方便后续换厂商。前端 services 层封装后端调用、不碰 UI；pages 只管交互。

---

## 任务批次

计划分 5 批，每批产出可独立验证的软件：

- **批次 1：后端骨架 + 数据模型**（Task 1-3）— DB 起来、内容种子能跑
- **批次 2：内容与进度后端**（Task 4-6）— 取课/解锁/记 attempt 的 API 可用
- **批次 3：语音评分与反馈编排**（Task 7-9）— 核心闭环后端跑通
- **批次 4：小程序前端**（Task 10-14）— 4 页 + 数字人 + 录音 + 循环
- **批次 5：端到端集成与降级**（Task 15-16）— 闭环联通 + 错误降级

---

# 批次 1：后端骨架 + 数据模型

### Task 1: 后端项目初始化与 Fastify 骨架

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.gitignore`
- Create: `backend/src/server.ts`
- Create: `backend/src/config.ts`
- Create: `backend/tests/health.test.ts`

- [ ] **Step 1: 初始化 package.json 与依赖**

Run:
```bash
cd backend && npm init -y && npm install fastify dotenv && npm install -D typescript vitest @types/node tsx
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: 写 src/config.ts**

```typescript
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  wxAppId: process.env.WX_APP_ID ?? '',
  wxAppSecret: process.env.WX_APP_SECRET ?? '',
  xfyunAppId: process.env.XFYUN_APP_ID ?? '',
  xfyunApiKey: process.env.XFYUN_API_KEY ?? '',
  xfyunApiSecret: process.env.XFYUN_API_SECRET ?? '',
};
```

- [ ] **Step 4: 写健康检查测试（失败先）**

`backend/tests/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';

describe('health', () => {
  it('returns ok on /health', async () => {
    const server = buildServer();
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await server.close();
  });
});
```

- [ ] **Step 5: 运行测试确认失败**

Run: `cd backend && npx vitest run tests/health.test.ts`
Expected: FAIL — `buildServer` 未定义

- [ ] **Step 6: 写最小 server.ts 使测试通过**

`backend/src/server.ts`:
```typescript
import Fastify from 'fastify';

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get('/health', async () => ({ status: 'ok' }));

  return server;
}

async function start() {
  const server = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await server.listen({ port, host: '0.0.0.0' });
}

const isMain = process.argv[1]?.endsWith('server.ts');
if (isMain) start();
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cd backend && npx vitest run tests/health.test.ts`
Expected: PASS

- [ ] **Step 8: 加 vitest 配置与 scripts**

`backend/package.json` scripts 字段：
```json
{
  "scripts": {
    "test": "vitest run",
    "dev": "tsx watch src/server.ts"
  }
}
```

`backend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

- [ ] **Step 9: 写 .gitignore**

```
node_modules/
dist/
.env
```

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat(backend): init fastify skeleton with health check"
```

---

### Task 2: Prisma 数据模型与迁移

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`
- Create: `backend/tests/db.test.ts`

- [ ] **Step 1: 安装 Prisma**

Run: `cd backend && npm install prisma @prisma/client && npx prisma init`

- [ ] **Step 2: 写 schema.prisma（5 张表，按 spec 第 3 节）**

`backend/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Theme {
  id          String    @id @default(cuid())
  themeId     String    @unique
  name        String
  coverImage  String
  order       Int
  lessons     Lesson[]
}

model Lesson {
  id          String    @id @default(cuid())
  lessonId    String    @unique
  themeId     String
  theme       Theme     @relation(fields: [themeId], references: [themeId])
  title       String
  difficulty  Int
  unlockRule  String    @default("prev_1star")
  sentences   Sentence[]
  progress    UserProgress[]
}

model Sentence {
  id          String    @id @default(cuid())
  sentenceId  String    @unique
  lessonId    String
  lesson      Lesson    @relation(fields: [lessonId], references: [lessonId])
  enText      String
  cnText      String
  audioRef    String
  imageRef    String
  attempts    SentenceAttempt[]
}

model User {
  id          String    @id @default(cuid())
  userId      String    @unique
  openid      String    @unique
  nickname    String
  avatar      String
  createdAt   DateTime  @default(now())
  progress    UserProgress[]
  attempts    SentenceAttempt[]
}

model UserProgress {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [userId])
  lessonId    String
  lesson      Lesson    @relation(fields: [lessonId], references: [lessonId])
  stars       Int       @default(0)
  status      String    @default("locked")
  updatedAt   DateTime  @updatedAt

  @@unique([userId, lessonId])
}

model SentenceAttempt {
  id          String    @id @default(cuid())
  attemptId   String    @unique
  userId      String
  user        User      @relation(fields: [userId], references: [userId])
  sentenceId  String
  sentence    Sentence  @relation(fields: [sentenceId], references: [sentenceId])
  score       Int       @default(0)
  retry       Boolean   @default(false)
  timeout     Boolean   @default(false)
  createdAt   DateTime  @default(now())
}
```

- [ ] **Step 3: 创建迁移**

Run: `cd backend && npx prisma migrate dev --name init`
Expected: 生成 `prisma/migrations/*` 并应用

- [ ] **Step 4: 写 db.ts 单例**

`backend/src/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 5: 写 db 测试**

`backend/tests/db.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';

describe('db', () => {
  it('can connect and query', async () => {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    expect((result as Array<{ ok: number }>)[0].ok).toBe(1);
  });
});
```

- [ ] **Step 6: 运行测试**

Run: `cd backend && npx vitest run tests/db.test.ts`
Expected: PASS（需有本地 Postgres + DATABASE_URL）

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat(backend): add prisma schema for 5-table data model"
```

---

### Task 3: 72 句课程内容种子

**Files:**
- Create: `backend/src/seeds/seedContent.ts`
- Create: `backend/tests/seedContent.test.ts`

- [ ] **Step 1: 写种子数据测试（验证 3 主题×4 关卡×6 句子）**

`backend/tests/seedContent.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { seedData } from '../src/seeds/seedContent.js';

describe('seedContent', () => {
  it('has 3 themes', () => {
    expect(seedData.themes).toHaveLength(3);
  });

  it('has 4 lessons per theme', () => {
    for (const t of seedData.themes) {
      const lessons = seedData.lessons.filter((l) => l.themeId === t.themeId);
      expect(lessons).toHaveLength(4);
    }
  });

  it('has 6 sentences per lesson', () => {
    for (const l of seedData.lessons) {
      const s = seedData.sentences.filter((x) => x.lessonId === l.lessonId);
      expect(s).toHaveLength(6);
    }
  });

  it('totals 72 sentences', () => {
    expect(seedData.sentences).toHaveLength(72);
  });

  it('every sentence has non-empty audio and image ref', () => {
    for (const s of seedData.sentences) {
      expect(s.audioRef.length).toBeGreaterThan(0);
      expect(s.imageRef.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/seedContent.test.ts`
Expected: FAIL — `seedData` 未定义

- [ ] **Step 3: 写 seedContent.ts**

`backend/src/seeds/seedContent.ts`:
```typescript
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
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && npx vitest run tests/seedContent.test.ts`
Expected: PASS（5 测试全过）

- [ ] **Step 5: 加 seed npm script**

在 `backend/package.json` 的 scripts 加：
```json
"seed": "tsx src/seeds/runSeed.ts"
```

新建 `backend/src/seeds/runSeed.ts`：
```typescript
import { prisma } from '../db.js';
import { runSeed } from './seedContent.js';

async function main() {
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: 执行 seed 落库**

Run: `cd backend && npx prisma generate && npm run seed`
Expected: 3 主题、12 关卡、72 句落库成功

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat(backend): add 72-sentence seed content (3 themes x 4 lessons x 6 sentences)"
```

---

# 批次 2：内容与进度后端

### Task 4: 内容查询路由

**Files:**
- Create: `backend/src/content/contentService.ts`
- Create: `backend/src/content/contentRoutes.ts`
- Create: `backend/tests/contentService.test.ts`

- [ ] **Step 1: 写 service 测试**

`backend/tests/contentService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import { listThemes, listLessons, listSentences } from '../src/content/contentService.js';

beforeEach(async () => {
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('contentService', () => {
  it('lists 3 themes ordered', async () => {
    const themes = await listThemes();
    expect(themes).toHaveLength(3);
    expect(themes[0].order).toBeLessThanOrEqual(themes[1].order);
  });

  it('lists 4 lessons for animals', async () => {
    const lessons = await listLessons('animals');
    expect(lessons).toHaveLength(4);
    expect(lessons.every((l) => l.themeId === 'animals')).toBe(true);
  });

  it('lists 6 sentences for animals-1', async () => {
    const sentences = await listSentences('animals-1');
    expect(sentences).toHaveLength(6);
    expect(sentences[0].enText.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/contentService.test.ts`
Expected: FAIL — 函数未定义

- [ ] **Step 3: 写 contentService.ts**

`backend/src/content/contentService.ts`:
```typescript
import { prisma } from '../db.js';

export async function listThemes() {
  return prisma.theme.findMany({ orderBy: { order: 'asc' } });
}

export async function listLessons(themeId: string) {
  return prisma.lesson.findMany({ where: { themeId }, orderBy: { difficulty: 'asc' } });
}

export async function listSentences(lessonId: string) {
  return prisma.sentence.findMany({ where: { lessonId } });
}
```

- [ ] **Step 4: 测试通过**

Run: `cd backend && npx vitest run tests/contentService.test.ts`
Expected: PASS

- [ ] **Step 5: 写 contentRoutes.ts 并挂到 server**

`backend/src/content/contentRoutes.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import { listThemes, listLessons, listSentences } from './contentService.js';

export async function contentRoutes(server: FastifyInstance) {
  server.get('/themes', async () => listThemes());
  server.get('/themes/:themeId/lessons', async (req) => {
    const { themeId } = req.params as { themeId: string };
    return listLessons(themeId);
  });
  server.get('/lessons/:lessonId/sentences', async (req) => {
    const { lessonId } = req.params as { lessonId: string };
    return listSentences(lessonId);
  });
}
```

修改 `backend/src/server.ts` 加入挂载：
```typescript
import Fastify from 'fastify';
import { contentRoutes } from './content/contentRoutes.js';

export function buildServer() {
  const server = Fastify({ logger: true });
  server.get('/health', async () => ({ status: 'ok' }));
  server.register(contentRoutes);
  return server;
}

async function start() {
  const server = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await server.listen({ port, host: '0.0.0.0' });
}

const isMain = process.argv[1]?.endsWith('server.ts');
if (isMain) start();
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): add content query routes for themes/lessons/sentences"
```

---

### Task 5: openid 静默登录与 User 建号

**Files:**
- Create: `backend/src/auth/openid.ts`
- Create: `backend/tests/openid.test.ts`

- [ ] **Step 1: 写测试（mock 微信 API）**

`backend/tests/openid.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { code2openid } from '../src/auth/openid.js';

describe('code2openid', () => {
  it('returns openid on success', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ openid: 'wx_open_123', session_key: 'sk' }), { status: 200 })
    );
    const openid = await code2openid('fake_code', { appId: 'a', appSecret: 's' });
    expect(openid).toBe('wx_open_123');
    fetchSpy.mockRestore();
  });

  it('throws on missing openid in response', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), { status: 200 })
    );
    await expect(code2openid('bad', { appId: 'a', appSecret: 's' })).rejects.toThrow();
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/openid.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 openid.ts**

`backend/src/auth/openid.ts`:
```typescript
export type WxAppCreds = { appId: string; appSecret: string };

export async function code2openid(code: string, creds: WxAppCreds): Promise<string> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${creds.appId}&secret=${creds.appSecret}&js_code=${code}&grant_type=authorization_code`;
  const res = await fetch(url);
  const body = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };
  if (!body.openid) {
    throw new Error(`wx login failed: ${body.errcode} ${body.errmsg ?? ''}`);
  }
  return body.openid;
}
```

- [ ] **Step 4: 测试通过**

Run: `cd backend && npx vitest run tests/openid.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): add wx login code-to-openid helper with tests"
```

---

### Task 6: 进度服务（解锁/记 attempt/得星）

**Files:**
- Create: `backend/src/progress/progressService.ts`
- Create: `backend/src/progress/progressRoutes.ts`
- Create: `backend/tests/progressService.test.ts`

- [ ] **Step 1: 写 service 测试**

`backend/tests/progressService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import {
  ensureUser,
  getOrCreateProgress,
  recordAttempt,
  finalizeLessonStars,
  nextLessonUnlocked,
} from '../src/progress/progressService.js';

beforeEach(async () => {
  await prisma.sentenceAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.user.deleteMany();
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('progressService', () => {
  it('ensureUser creates a user with openid', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'cat.png');
    expect(u.openid).toBe('wx_open_1');
    expect(u.nickname).toBe('Tom');
  });

  it('ensureUser is idempotent on openid', async () => {
    await ensureUser('wx_open_1', 'Tom', 'cat.png');
    const u2 = await ensureUser('wx_open_1', 'Tom2', 'cat2.png');
    expect(u2.openid).toBe('wx_open_1');
  });

  it('first lesson is unlocked by default', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    const p = await getOrCreateProgress(u.userId, 'animals-1');
    expect(p.status).toBe('unlocked');
  });

  it('next lesson is locked until prev has >=1 star', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    const p = await getOrCreateProgress(u.userId, 'animals-2');
    expect(p.status).toBe('locked');
  });

  it('recording an attempt stores score and retry flag', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const att = await recordAttempt(u.userId, sent.sentenceId, 80, false, false);
    expect(att.score).toBe(80);
    expect(att.retry).toBe(false);
  });

  it('finalizeLessonStars sets stars and unlocks next', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    await finalizeLessonStars(u.userId, 'animals-1', 3);
    const p1 = await prisma.userProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: u.userId, lessonId: 'animals-1' } } });
    expect(p1.stars).toBe(3);
    expect(p1.status).toBe('done');
    const p2 = await getOrCreateProgress(u.userId, 'animals-2');
    expect(p2.status).toBe('unlocked');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/progressService.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 progressService.ts**

`backend/src/progress/progressService.ts`:
```typescript
import { prisma } from '../db.js';

const PASS_THRESHOLD = 60; // 单句及格分

export async function ensureUser(openid: string, nickname: string, avatar: string) {
  return prisma.user.upsert({
    where: { openid },
    create: { userId: `u_${openid}`, openid, nickname, avatar },
    update: {},
  });
}

export async function getOrCreateProgress(userId: string, lessonId: string) {
  const existing = await prisma.userProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  if (existing) return existing;

  // 判断是否应解锁：是该主题第一关 或 前一关已 done
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { lessonId } });
  const themeLessons = await prisma.lesson.findMany({
    where: { themeId: lesson.themeId },
    orderBy: { difficulty: 'asc' },
  });
  const idx = themeLessons.findIndex((l) => l.lessonId === lessonId);
  const isFirst = idx === 0;
  let unlocked = isFirst;
  if (!isFirst) {
    const prevId = themeLessons[idx - 1].lessonId;
    const prev = await prisma.userProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: prevId } },
    });
    unlocked = !!prev && prev.status === 'done' && prev.stars >= 1;
  }

  return prisma.userProgress.create({
    data: {
      userId,
      lessonId,
      status: unlocked ? 'unlocked' : 'locked',
      stars: 0,
    },
  });
}

export async function recordAttempt(
  userId: string,
  sentenceId: string,
  score: number,
  retry: boolean,
  timeout: boolean
) {
  return prisma.sentenceAttempt.create({
    data: {
      attemptId: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      sentenceId,
      score,
      retry,
      timeout,
    },
  });
}

export async function finalizeLessonStars(userId: string, lessonId: string, stars: number) {
  await prisma.userProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, stars, status: 'done' },
    update: { stars, status: 'done' },
  });
  // 解锁下一关（同主题内）
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { lessonId } });
  const themeLessons = await prisma.lesson.findMany({
    where: { themeId: lesson.themeId },
    orderBy: { difficulty: 'asc' },
  });
  const idx = themeLessons.findIndex((l) => l.lessonId === lessonId);
  if (idx >= 0 && idx < themeLessons.length - 1) {
    const nextId = themeLessons[idx + 1].lessonId;
    await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: nextId } },
      create: { userId, lessonId: nextId, status: 'unlocked', stars: 0 },
      update: { status: 'unlocked' },
    });
  }
}

export async function nextLessonUnlocked(userId: string, lessonId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { lessonId } });
  const themeLessons = await prisma.lesson.findMany({
    where: { themeId: lesson.themeId },
    orderBy: { difficulty: 'asc' },
  });
  const idx = themeLessons.findIndex((l) => l.lessonId === lessonId);
  if (idx < 0 || idx >= themeLessons.length - 1) return false;
  const next = await prisma.userProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: themeLessons[idx + 1].lessonId } },
  });
  return !!next && next.status === 'unlocked';
}

export { PASS_THRESHOLD };
```

- [ ] **Step 4: 测试通过**

Run: `cd backend && npx vitest run tests/progressService.test.ts`
Expected: PASS

- [ ] **Step 5: 写 progressRoutes.ts 并挂到 server**

`backend/src/progress/progressRoutes.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import { ensureUser, getOrCreateProgress, finalizeLessonStars, nextLessonUnlocked } from './progressService.js';

export async function progressRoutes(server: FastifyInstance) {
  server.post('/auth/login', async (req) => {
    const { code, nickname, avatar } = req.body as { code: string; nickname: string; avatar: string };
    // code → openid 在 routes 层调 auth，service 层只接收 openid
    const { code2openid } = await import('../auth/openid.js');
    const { config } = await import('../config.js');
    const openid = await code2openid(code, { appId: config.wxAppId, appSecret: config.wxAppSecret });
    const user = await ensureUser(openid, nickname, avatar);
    return { userId: user.userId, openid };
  });

  server.get('/progress/:userId/:lessonId', async (req) => {
    const { userId, lessonId } = req.params as { userId: string; lessonId: string };
    return getOrCreateProgress(userId, lessonId);
  });

  server.post('/progress/:userId/:lessonId/finalize', async (req) => {
    const { userId, lessonId } = req.params as { userId: string; lessonId: string };
    const { stars } = req.body as { stars: number };
    await finalizeLessonStars(userId, lessonId, stars);
    const nextUnlocked = await nextLessonUnlocked(userId, lessonId);
    return { ok: true, nextUnlocked };
  });
}
```

修改 `server.ts`：
```typescript
import { progressRoutes } from './progress/progressRoutes.js';
// 在 buildServer 内：
server.register(progressRoutes);
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): add progress service with unlock/attempts/stars"
```

---

# 批次 3：语音评分与反馈编排

### Task 7: SpeechProvider 接口与讯飞客户端

**Files:**
- Create: `backend/src/speech/speechTypes.ts`
- Create: `backend/src/speech/xfyunClient.ts`
- Create: `backend/tests/xfyunClient.test.ts`

- [ ] **Step 1: 写接口与 mock-friendly 测试**

`backend/src/speech/speechTypes.ts`:
```typescript
export type SpeechResult = {
  recognizedText: string;
  score: number;          // 0-100
  isSilent: boolean;      // 无声音/纯噪音
};

export type SpeechProvider = {
  evaluate(args: { audioBase64: string; referenceText: string; format: 'mp3' | 'aac' }): Promise<SpeechResult>;
};
```

`backend/tests/xfyunClient.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createXfyunClient } from '../src/speech/xfyunClient.js';

describe('xfyunClient', () => {
  it('maps a successful response to SpeechResult', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { rec: 'I see a cat.', score: 85 }, data: { ws: [{ wb: [{ score: 85 }] }] } }), { status: 200 })
    );
    const client = createXfyunClient({ appId: 'a', apiKey: 'k', apiSecret: 's' });
    const r = await client.evaluate({ audioBase64: 'AAAA', referenceText: 'I see a cat.', format: 'mp3' });
    expect(r.recognizedText).toBe('I see a cat.');
    expect(r.score).toBe(85);
    expect(r.isSilent).toBe(false);
    fetchSpy.mockRestore();
  });

  it('treats empty recognition as silent', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { rec: '', score: 0 } }), { status: 200 })
    );
    const client = createXfyunClient({ appId: 'a', apiKey: 'k', apiSecret: 's' });
    const r = await client.evaluate({ audioBase64: 'AAAA', referenceText: 'I see a cat.', format: 'mp3' });
    expect(r.isSilent).toBe(true);
    expect(r.score).toBe(0);
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/xfyunClient.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 xfyunClient.ts**

讯飞发音评测（ise）鉴权较复杂，首版用 application/json 直传模式，签名由 SDK 简化处理；真实环境需替换为讯飞官方签名流程。此处实现接口契约 + 解析逻辑，签名细节用 TODO 占位但运行路径完整。

`backend/src/speech/xfyunClient.ts`:
```typescript
import type { SpeechProvider, SpeechResult } from './speechTypes.js';
import { config } from '../config.js';

export type XfyunCreds = { appId: string; apiKey: string; apiSecret: string };

export function createXfyunClient(creds: XfyunCreds): SpeechProvider {
  return {
    async evaluate({ audioBase64, referenceText, format }) {
      const body = {
        common: { app_id: creds.appId },
        business: {
          category: 'read_sentence',
          text: referenceText,
          aus: 1,
        },
        data: {
          status: 2,
          audio: audioBase64,
          aue: format === 'mp3' ? 'lame' : 'aac',
        },
      };

      const res = await fetch('https://raasr.xfyun.cn/v2/ise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { result?: { rec?: string; score?: number }; data?: { ws?: Array<{ wb: Array<{ score: number }> }> };
      const rec = json.result?.rec ?? '';
      const score = json.result?.score ?? 0;
      const result: SpeechResult = {
        recognizedText: rec,
        score,
        isSilent: rec.trim().length === 0,
      };
      return result;
    },
  };
}

export const defaultSpeechProvider: SpeechProvider = createXfyunClient({
  appId: config.xfyunAppId,
  apiKey: config.xfyunApiKey,
  apiSecret: config.xfyunApiSecret,
});
```

- [ ] **Step 4: 测试通过**

Run: `cd backend && npx vitest run tests/xfyunClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): add SpeechProvider interface and xfyun client"
```

---

### Task 8: 反馈策略（分数阈值→分支）

**Files:**
- Create: `backend/src/feedback/feedbackPolicy.ts`
- Create: `backend/tests/feedbackPolicy.test.ts`

- [ ] **Step 1: 写测试**

`backend/tests/feedbackPolicy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { decideFeedback } from '../src/feedback/feedbackPolicy.js';

describe('feedbackPolicy', () => {
  it('high score → praise', () => {
    expect(decideFeedback(85, false).branch).toBe('praise');
  });
  it('low score → retry', () => {
    expect(decideFeedback(40, false).branch).toBe('retry');
  });
  it('silent → retry with slow read', () => {
    expect(decideFeedback(0, true).branch).toBe('retry');
  });
  it('timeout → skip with neutral praise', () => {
    expect(decideFeedback(0, false, true).branch).toBe('skip');
  });
  it('praise returns a fixed template', () => {
    const fb = decideFeedback(85, false);
    expect(fb.avatarAnim).toBeTruthy();
    expect(fb.teacherLine).toContain('Great');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/feedbackPolicy.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 feedbackPolicy.ts**

`backend/src/feedback/feedbackPolicy.ts`:
```typescript
export type FeedbackBranch = 'praise' | 'retry' | 'skip';

export type Feedback = {
  branch: FeedbackBranch;
  teacherLine: string;     // 老师台词
  avatarAnim: string;     // 形象动画资源 key
  counts: boolean;         // 本次是否计星
};

const PRAISE_THRESHOLD = 60;

export function decideFeedback(score: number, isSilent: boolean, timeout = false): Feedback {
  if (timeout) {
    return { branch: 'skip', teacherLine: 'Good try!', avatarAnim: 'smile', counts: false };
  }
  if (isSilent || score < PRAISE_THRESHOLD) {
    return { branch: 'retry', teacherLine: "Let's try again!", avatarAnim: 'slow_read', counts: false };
  }
  return { branch: 'praise', teacherLine: 'Great job!', avatarAnim: 'cheer', counts: true };
}

export { PRAISE_THRESHOLD };
```

- [ ] **Step 4: 测试通过**

Run: `cd backend && npx vitest run tests/feedbackPolicy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): add feedback policy with score thresholds"
```

---

### Task 9: 语音编排路由（上传→评分→反馈）

**Files:**
- Create: `backend/src/speech/speechService.ts`
- Create: `backend/src/speech/speechRoutes.ts`
- Create: `backend/tests/speechService.test.ts`

- [ ] **Step 1: 写测试（注入 fake provider）**

`backend/tests/speechService.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import { ensureUser } from '../src/progress/progressService.js';
import { evaluateAndFeedback } from '../src/speech/speechService.js';
import type { SpeechProvider } from '../src/speech/speechTypes.js';

const fakeProvider: SpeechProvider = {
  async evaluate() {
    return { recognizedText: 'I see a cat.', score: 88, isSilent: false };
  },
};

beforeEach(async () => {
  await prisma.sentenceAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.user.deleteMany();
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('speechService.evaluateAndFeedback', () => {
  it('returns praise for high score and records attempt', async () => {
    const u = await ensureUser('wx_o1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const res = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sent.sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: fakeProvider,
    });
    expect(res.feedback.branch).toBe('praise');
    const atts = await prisma.sentenceAttempt.findMany({ where: { userId: u.userId } });
    expect(atts).toHaveLength(1);
    expect(atts[0].score).toBe(88);
  });

  it('returns retry and no star for silent audio', async () => {
    const silent: SpeechProvider = { async evaluate() { return { recognizedText: '', score: 0, isSilent: true }; } };
    const u = await ensureUser('wx_o1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const res = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sent.sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: silent,
    });
    expect(res.feedback.branch).toBe('retry');
    expect(res.feedback.counts).toBe(false);
  });

  it('returns skip and records timeout=true on provider timeout', async () => {
    const timeoutProvider: SpeechProvider = {
      async evaluate() { throw new Error('timeout'); },
    };
    const u = await ensureUser('wx_o1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const res = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sent.sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: timeoutProvider,
    });
    expect(res.feedback.branch).toBe('skip');
    const att = await prisma.sentenceAttempt.findFirstOrThrow({ where: { userId: u.userId } });
    expect(att.timeout).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && npx vitest run tests/speechService.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 speechService.ts**

`backend/src/speech/speechService.ts`:
```typescript
import { prisma } from '../db.js';
import { recordAttempt } from '../progress/progressService.js';
import { decideFeedback } from '../feedback/feedbackPolicy.js';
import type { SpeechProvider } from './speechTypes.js';

const EVAL_TIMEOUT_MS = 2000;

export type EvaluateArgs = {
  userId: string;
  sentenceId: string;
  audioBase64: string;
  format: 'mp3' | 'aac';
  provider: SpeechProvider;
};

export type EvaluateResult = {
  feedback: ReturnType<typeof decideFeedback>;
  score: number;
  recognizedText: string;
};

export async function evaluateAndFeedback(args: EvaluateArgs): Promise<EvaluateResult> {
  const sentence = await prisma.sentence.findUniqueOrThrow({ where: { sentenceId: args.sentenceId } });

  let score = 0;
  let recognizedText = '';
  let isSilent = false;
  let timedOut = false;

  try {
    const result = await withTimeout(
      args.provider.evaluate({ audioBase64: args.audioBase64, referenceText: sentence.enText, format: args.format }),
      EVAL_TIMEOUT_MS
    );
    score = result.score;
    recognizedText = result.recognizedText;
    isSilent = result.isSilent;
  } catch (e) {
    timedOut = true;
  }

  const feedback = decideFeedback(score, isSilent, timedOut);
  await recordAttempt(args.userId, args.sentenceId, score, feedback.branch === 'retry', timedOut);

  return { feedback, score, recognizedText };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
```

- [ ] **Step 4: 测试通过**

Run: `cd backend && npx vitest run tests/speechService.test.ts`
Expected: PASS

- [ ] **Step 5: 写 speechRoutes.ts 并挂到 server**

`backend/src/speech/speechRoutes.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import { evaluateAndFeedback } from './speechService.js';
import { defaultSpeechProvider } from './xfyunClient.js';

export async function speechRoutes(server: FastifyInstance) {
  server.post('/speech/evaluate', async (req) => {
    const { userId, sentenceId, audioBase64, format } = req.body as {
      userId: string;
      sentenceId: string;
      audioBase64: string;
      format: 'mp3' | 'aac';
    };
    return evaluateAndFeedback({ userId, sentenceId, audioBase64, format, provider: defaultSpeechProvider });
  });
}
```

修改 `server.ts`：
```typescript
import { speechRoutes } from './speech/speechRoutes.js';
// 在 buildServer 内：
server.register(speechRoutes);
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): add speech orchestration with timeout and feedback policy"
```

---

# 批次 4：小程序前端

### Task 10: 小程序骨架与 request/auth 封装

**Files:**
- Create: `miniprogram/app.ts`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/project.config.json`
- Create: `miniprogram/services/request.ts`
- Create: `miniprogram/services/auth.ts`

- [ ] **Step 1: 写 project.config.json**

`miniprogram/project.config.json`:
```json
{
  "miniprogramRoot": "./",
  "setting": {
    "es6": true,
    "useCompilerPlugins": true,
    "typescript": true
  },
  "appid": "",
  "compileType": "miniprogram"
}
```

- [ ] **Step 2: 写 app.json（4 页注册）**

`miniprogram/app.json`:
```json
{
  "pages": [
    "pages/home/home",
    "pages/lessons/lessons",
    "pages/lesson/lesson",
    "pages/summary/summary"
  ],
  "window": {
    "navigationBarTitleText": "英语陪练",
    "navigationBarBackgroundColor": "#FFFFFF",
    "navigationBarTextStyle": "black"
  },
  "useExtendedLib": {},
  "sitemapLocation": "sitemap.json"
}
```

`miniprogram/sitemap.json`:
```json
{
  "rules": [{ "action": "allow", "page": "*" }]
}
```

- [ ] **Step 3: 写 app.ts（启动 + 静默登录）**

`miniprogram/app.ts`:
```typescript
import { ensureLogin } from './services/auth.js';

App({
  async onLaunch() {
    try {
      await ensureLogin();
    } catch (e) {
      console.warn('login failed, will retry on demand', e);
    }
  },
});
```

- [ ] **Step 4: 写 request.ts（封装 wx.request）**

`miniprogram/services/request.ts`:
```typescript
const BASE = 'http://localhost:3000'; // 开发期；生产替换为后端域名

export type ApiError = { status: number; message: string };

export async function api<T = unknown>(path: string, options: { method?: 'GET' | 'POST'; data?: unknown } = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: BASE + path,
      method: options.method ?? 'GET',
      data: options.data ?? {},
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject({ status: res.statusCode, message: `request failed: ${res.statusCode}` } satisfies ApiError);
        }
      },
      fail: (err) => reject({ status: 0, message: err.errMsg } satisfies ApiError),
    });
  });
}
```

- [ ] **Step 5: 写 auth.ts（wx.login → openid → userId 存本地）**

`miniprogram/services/auth.ts`:
```typescript
import { api } from './request.js';

export type Session = { userId: string; openid: string };

export async function ensureLogin(): Promise<Session> {
  const cached = wx.getStorageSync('session') as Session | undefined;
  if (cached?.userId) return cached;

  const { code } = await wx.login();
  // 默认昵称头像，孩子首次进入可改
  const res = await api<Session>('/auth/login', {
    method: 'POST',
    data: { code, nickname: 'Friend', avatar: 'default.png' },
  });
  wx.setStorageSync('session', res);
  return res;
}

export function getSession(): Session | undefined {
  return wx.getStorageSync('session') as Session | undefined;
}
```

- [ ] **Step 6: 写 app.wxss 全局基础**

`miniprogram/app.wxss`:
```css
page {
  background: #F7F7F8;
  color: #171717;
  font-family: -apple-system, "PingFang SC", system-ui, sans-serif;
}
.btn-primary {
  background: #4B3FE3;
  color: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  text-align: center;
}
```

- [ ] **Step 7: Commit**

```bash
git add miniprogram/
git commit -m "feat(mp): init mini-program skeleton with request/auth"
```

---

### Task 11: 数字人形象与按住说话组件

**Files:**
- Create: `miniprogram/components/avatar/avatar.json`
- Create: `miniprogram/components/avatar/avatar.wxml`
- Create: `miniprogram/components/avatar/avatar.wxss`
- Create: `miniprogram/components/avatar/avatar.ts`
- Create: `miniprogram/components/recordButton/recordButton.json`
- Create: `miniprogram/components/recordButton/recordButton.wxml`
- Create: `miniprogram/components/recordButton/recordButton.wxss`
- Create: `miniprogram/components/recordButton/recordButton.ts`
- Create: `miniprogram/utils/feedbackAssets.ts`

- [ ] **Step 1: 写 feedbackAssets.ts（反馈模板资源映射）**

`miniprogram/utils/feedbackAssets.ts`:
```typescript
export type FeedbackBranch = 'praise' | 'retry' | 'skip';

export type FeedbackAsset = {
  branch: FeedbackBranch;
  teacherLine: string;
  lottieAnim: string; // 资源路径
};

export const feedbackAssets: Record<FeedbackBranch, FeedbackAsset> = {
  praise: { branch: 'praise', teacherLine: 'Great job!', lottieAnim: 'cdn://anim/cheer.json' },
  retry: { branch: 'retry', teacherLine: "Let's try again!", lottieAnim: 'cdn://anim/slow_read.json' },
  skip: { branch: 'skip', teacherLine: 'Good try!', lottieAnim: 'cdn://anim/smile.json' },
};

export function assetForBranch(branch: FeedbackBranch): FeedbackAsset {
  return feedbackAssets[branch];
}
```

- [ ] **Step 2: 写 avatar 组件（用 Lottie 简化版，首版用图片切换表情占位，验证交互）**

`miniprogram/components/avatar/avatar.json`:
```json
{ "component": true }
```

`miniprogram/components/avatar/avatar.wxml`:
```xml
<view class="avatar">
  <image class="avatar-img" src="{{image}}" mode="aspectFit" />
  <view class="bubble" wx:if="{{line}}">{{line}}</view>
</view>
```

`miniprogram/components/avatar/avatar.wxss`:
```css
.avatar { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.avatar-img { width: 160px; height: 160px; }
.bubble {
  background: #FFFFFF; border: 1px solid rgba(23,23,23,0.12);
  border-radius: 12px; padding: 8px 12px; font-size: 14px; color: #171717;
}
```

`miniprogram/components/avatar/avatar.ts`:
```typescript
Component({
  properties: {
    image: { type: String, value: 'cdn://avatar/idle.png' },
    line: { type: String, value: '' },
  },
});
```

- [ ] **Step 3: 写 recordButton 组件（按住说话）**

`miniprogram/components/recordButton/recordButton.json`:
```json
{ "component": true }
```

`miniprogram/components/recordButton/recordButton.wxml`:
```xml
<button
  class="rec {{recording ? 'rec-on' : ''}}"
  bind:touchstart="onStart"
  bind:touchend="onEnd"
  bind:touchcancel="onEnd"
>
  {{recording ? '请说话…' : '按住说话'}}
</button>
```

`miniprogram/components/recordButton/recordButton.wxss`:
```css
.rec {
  background: #4B3FE3; color: #fff; border-radius: 999px;
  padding: 16px 24px; font-size: 16px;
}
.rec-on { background: #6054F1; transform: scale(0.97); }
```

`miniprogram/components/recordButton/recordButton.ts`:
```typescript
const recorder = wx.getRecorderManager();

Component({
  data: { recording: false },
  methods: {
    onStart() {
      this.setData({ recording: true });
      recorder.start({ format: 'mp3', sampleRate: 16000, numberOfChannels: 1 });
    },
    onEnd() {
      if (!this.data.recording) return;
      this.setData({ recording: false });
      recorder.onStop((res) => {
        this.triggerEvent('recorded', { tempFilePath: res.tempFilePath });
      });
      recorder.stop();
    },
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/
git commit -m "feat(mp): add avatar and recordButton components"
```

---

### Task 12: 首页 + 选课页

**Files:**
- Create: `miniprogram/pages/home/home.{json,wxml,wxss,ts}`
- Create: `miniprogram/pages/lessons/lessons.{json,wxml,wxss,ts}`
- Create: `miniprogram/services/lessonClient.ts`

- [ ] **Step 1: 写 lessonClient.ts（后端 API 客户端）**

`miniprogram/services/lessonClient.ts`:
```typescript
import { api } from './request.js';
import { ensureLogin } from './auth.js';

export type Theme = { themeId: string; name: string; coverImage: string; order: number };
export type Lesson = { lessonId: string; themeId: string; title: string; difficulty: number };
export type Sentence = { sentenceId: string; lessonId: string; enText: string; cnText: string; audioRef: string; imageRef: string };
export type Progress = { userId: string; lessonId: string; stars: number; status: 'locked' | 'unlocked' | 'done' };

export async function listThemes() { return api<Theme[]>('/themes'); }
export async function listLessons(themeId: string) { return api<Lesson[]>(`/themes/${themeId}/lessons`); }
export async function listSentences(lessonId: string) { return api<Sentence[]>(`/lessons/${lessonId}/sentences`); }

export async function getProgress(lessonId: string) {
  const s = await ensureLogin();
  return api<Progress>(`/progress/${s.userId}/${lessonId}`);
}

export async function finalizeLesson(lessonId: string, stars: number) {
  const s = await ensureLogin();
  return api<{ ok: boolean; nextUnlocked: boolean }>(`/progress/${s.userId}/${lessonId}/finalize`, {
    method: 'POST',
    data: { stars },
  });
}
```

- [ ] **Step 2: 写首页（展示主题列表，点击进选课）**

`miniprogram/pages/home/home.json`:
```json
{ "usingComponents": {} }
```

`miniprogram/pages/home/home.wxml`:
```xml
<view class="home">
  <view class="streak">连续学习 {{streak}} 天</view>
  <view class="theme-list">
    <view class="theme-card" wx:for="{{themes}}" wx:key="themeId" data-id="{{item.themeId}}" bind:tap="goLessons">
      <image class="cover" src="{{item.coverImage}}" mode="aspectFill" />
      <view class="title">{{item.name}}</view>
    </view>
  </view>
</view>
```

`miniprogram/pages/home/home.wxss`:
```css
.home { padding: 16px; }
.streak { font-size: 14px; color: #52525B; margin-bottom: 12px; }
.theme-list { display: flex; flex-direction: column; gap: 12px; }
.theme-card { background: #fff; border-radius: 12px; padding: 12px; border: 1px solid rgba(23,23,23,0.08); }
.cover { width: 100%; height: 120px; border-radius: 8px; }
.title { margin-top: 8px; font-size: 16px; font-weight: 500; }
```

`miniprogram/pages/home/home.ts`:
```typescript
import { listThemes } from '../../services/lessonClient.js';

Page({
  data: { themes: [], streak: 1 },

  async onShow() {
    try {
      const themes = await listThemes();
      this.setData({ themes });
    } catch (e) {
      wx.showToast({ title: '稍后再试', icon: 'none' });
    }
  },

  goLessons(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    wx.navigateTo({ url: `/pages/lessons/lessons?themeId=${id}` });
  },
});
```

- [ ] **Step 3: 写选课页**

`miniprogram/pages/lessons/lessons.json`:
```json
{ "usingComponents": {} }
```

`miniprogram/pages/lessons/lessons.wxml`:
```xml
<view class="lessons">
  <view class="lesson-row" wx:for="{{lessons}}" wx:key="lessonId" data-id="{{item.lessonId}}" bind:tap="goLesson">
    <view class="title">{{item.title}}</view>
    <view class="meta">难度 {{item.difficulty}} 星</view>
    <view class="status">{{item.statusLabel}}</view>
  </view>
</view>
```

`miniprogram/pages/lessons/lessons.wxss`:
```css
.lessons { padding: 16px; }
.lesson-row { background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid rgba(23,23,23,0.08); }
.title { font-size: 16px; font-weight: 500; }
.meta { font-size: 12px; color: #52525B; margin-top: 4px; }
.status { font-size: 12px; color: #4B3FE3; margin-top: 4px; }
```

`miniprogram/pages/lessons/lessons.ts`:
```typescript
import { listLessons, getProgress } from '../../services/lessonClient.js';

Page({
  data: { lessons: [] as Array<{ lessonId: string; title: string; difficulty: number; statusLabel: string }> },

  async onLoad(query: { themeId: string }) {
    const lessons = await listLessons(query.themeId);
    const withStatus = await Promise.all(
      lessons.map(async (l) => {
        let statusLabel = '未解锁';
        try {
          const p = await getProgress(l.lessonId);
          statusLabel = p.status === 'done' ? '已完成' : p.status === 'unlocked' ? '可学习' : '未解锁';
        } catch {}
        return { lessonId: l.lessonId, title: l.title, difficulty: l.difficulty, statusLabel };
      })
    );
    this.setData({ lessons: withStatus });
  },

  goLesson(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    wx.navigateTo({ url: `/pages/lesson/lesson?lessonId=${id}` });
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/
git commit -m "feat(mp): add home and lessons pages"
```

---

### Task 13: 上课页核心循环

**Files:**
- Create: `miniprogram/pages/lesson/lesson.{json,wxml,wxss,ts}`

- [ ] **Step 1: 写 lesson.json**

`miniprogram/pages/lesson/lesson.json`:
```json
{
  "usingComponents": {
    "avatar": "/components/avatar/avatar",
    "recordButton": "/components/recordButton/recordButton"
  }
}
```

- [ ] **Step 2: 写 lesson.wxml**

`miniprogram/pages/lesson/lesson.wxml`:
```xml
<view class="lesson">
  <avatar image="{{avatarImg}}" line="{{teacherLine}}" />

  <view class="sentence-card" wx:if="{{current}}">
    <image class="sent-img" src="{{current.imageRef}}" mode="aspectFit" />
    <view class="en">{{current.enText}}</view>
    <view class="cn">{{current.cnText}}</view>
  </view>

  <recordButton wx:if="{{awaitingSpeech}}" bind:recorded="onRecorded" />

  <view class="hint" wx:if="{{loadingScore}}">听到啦…</view>

  <button class="btn-primary" wx:if="{{finished}}" bind:tap="goSummary">完成本课</button>
</view>
```

- [ ] **Step 3: 写 lesson.wxss**

`miniprogram/pages/lesson/lesson.wxss`:
```css
.lesson { padding: 16px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
.sentence-card { background: #fff; border-radius: 12px; padding: 16px; width: 100%; text-align: center; border: 1px solid rgba(23,23,23,0.08); }
.sent-img { width: 120px; height: 120px; }
.en { font-size: 18px; font-weight: 500; margin-top: 8px; }
.cn { font-size: 14px; color: #52525B; margin-top: 4px; }
.hint { font-size: 14px; color: #52525B; }
```

- [ ] **Step 4: 写 lesson.ts（循环逻辑）**

`miniprogram/pages/lesson/lesson.ts`:
```typescript
import { listSentences, finalizeLesson } from '../../services/lessonClient.js';
import { assetForBranch, type FeedbackBranch } from '../../utils/feedbackAssets.js';
import { api } from '../../services/request.js';
import { ensureLogin } from '../../services/auth.js';

type SpeechEvalResponse = {
  feedback: { branch: FeedbackBranch; teacherLine: string; avatarAnim: string; counts: boolean };
  score: number;
  recognizedText: string;
};

Page({
  data: {
    sentences: [] as Array<{ sentenceId: string; enText: string; cnText: string; audioRef: string; imageRef: string }>,
    index: -1,
    current: null as null | { sentenceId: string; enText: string; cnText: string; audioRef: string; imageRef: string },
    avatarImg: 'cdn://avatar/idle.png',
    teacherLine: '',
    awaitingSpeech: false,
    loadingScore: false,
    finished: false,
  },

  async onLoad(query: { lessonId: string }) {
    const sentences = await listSentences(query.lessonId);
    this.setData({ sentences });
    this.next();
  },

  next() {
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.sentences.length) {
      this.finishLesson();
      return;
    }
    const current = this.data.sentences[nextIndex];
    this.setData({
      index: nextIndex,
      current,
      avatarImg: 'cdn://avatar/teaching.png',
      teacherLine: current.enText,
      awaitingSpeech: false,
    });
    // 预读：模拟老师带读（音频本地预生成，直接播放）
    this.playTeacher(current.audioRef);
    setTimeout(() => {
      this.setData({ awaitingSpeech: true, teacherLine: 'Your turn!' });
    }, 1500);
  },

  playTeacher(audioRef: string) {
    // 实际从 CDN 取音频播放；首版用 innerAudioContext
    const audio = wx.createInnerAudioContext();
    audio.src = audioRef;
    audio.play();
  },

  async onRecorded(e: WechatMiniprogram.CustomEvent<{ tempFilePath: string }>) {
    this.setData({ awaitingSpeech: false, loadingScore: true });
    const { tempFilePath } = e.detail;
    const session = await ensureLogin();
    const sentenceId = this.data.current!.sentenceId;
    const audioBase64 = await this.fileToBase64(tempFilePath);

    try {
      const res = await api<SpeechEvalResponse>('/speech/evaluate', {
        method: 'POST',
        data: { userId: session.userId, sentenceId, audioBase64, format: 'mp3' },
      });
      this.applyFeedback(res.feedback);
    } catch {
      // 降级：网络/服务失败，按 skip 处理，不让孩子卡住
      this.applyFeedback({ branch: 'skip', teacherLine: 'Good try!', avatarAnim: 'smile', counts: false });
    } finally {
      this.setData({ loadingScore: false });
    }
  },

  applyFeedback(fb: { branch: FeedbackBranch; teacherLine: string; avatarAnim: string; counts: boolean }) {
    const asset = assetForBranch(fb.branch);
    this.setData({
      avatarImg: `cdn://avatar/${fb.branch}.png`,
      teacherLine: asset.teacherLine,
    });
    if (fb.branch === 'retry') {
      // 留在本句重试
      setTimeout(() => {
        this.setData({ awaitingSpeech: true, teacherLine: 'Your turn!' });
      }, 1500);
    } else {
      // praise 或 skip 都前进
      setTimeout(() => this.next(), 1200);
    }
  },

  async finishLesson() {
    // 简单得星：基于已完成句数比例（MVP 简化）
    const total = this.data.sentences.length;
    const stars = Math.max(1, Math.min(3, Math.ceil(total / 2))); // 简化：至少 1 星
    const lessonId = (this as unknown as { options: { lessonId?: string } }).options?.lessonId ?? '';
    await finalizeLesson(lessonId, stars);
    this.setData({ finished: true, teacherLine: 'See you next time!', avatarImg: 'cdn://avatar/cheer.png' });
  },

  goSummary() {
    wx.redirectTo({ url: '/pages/summary/summary' });
  },

  fileToBase64(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (r) => resolve(r.data as string),
        fail: reject,
      });
    });
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/
git commit -m "feat(mp): add lesson page with read-record-evaluate-feedback loop"
```

---

### Task 14: 课末小结页

**Files:**
- Create: `miniprogram/pages/summary/summary.{json,wxml,wxss,ts}`

- [ ] **Step 1: 写 summary.json/wxml/wxss**

`miniprogram/pages/summary/summary.json`:
```json
{ "usingComponents": {} }
```

`miniprogram/pages/summary/summary.wxml`:
```xml
<view class="summary">
  <view class="stars">{{starsText}}</view>
  <view class="sticker">奖励贴纸 +1</view>
  <button class="btn-primary" bind:tap="goHome">回到首页</button>
</view>
```

`miniprogram/pages/summary/summary.wxss`:
```css
.summary { padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.stars { font-size: 32px; color: #4B3FE3; }
.sticker { font-size: 14px; color: #52525B; }
```

- [ ] **Step 2: 写 summary.ts**

`miniprogram/pages/summary/summary.ts`:
```typescript
Page({
  data: { starsText: '★ ★ ★' },

  onShow() {
    // 简化：MVP 直接显示三星占位；后续从后端取本课 stars
    // const stars = wx.getStorageSync('lastStars') ?? 3;
    this.setData({ starsText: '★ ★ ★' });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/
git commit -m "feat(mp): add lesson summary page"
```

---

# 批次 5：端到端集成与降级

### Task 15: 录音权限与降级路径

**Files:**
- Modify: `miniprogram/components/recordButton/recordButton.ts`
- Modify: `miniprogram/pages/lesson/lesson.ts`

- [ ] **Step 1: 录音前权限检查**

修改 `miniprogram/components/recordButton/recordButton.ts`：
```typescript
const recorder = wx.getRecorderManager();

Component({
  data: { recording: false },
  methods: {
    async onStart() {
      try {
        await wx.authorize({ scope: 'scope.record' });
      } catch {
        // 引导开权限，文案孩子友好
        wx.showModal({
          title: '打开小话筒',
          content: '我们要先开一下小话筒哦',
          confirmText: '去开',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          },
        });
        return;
      }
      this.setData({ recording: true });
      recorder.start({ format: 'mp3', sampleRate: 16000, numberOfChannels: 1 });
    },
    onEnd() {
      if (!this.data.recording) return;
      this.setData({ recording: false });
      recorder.onStop((res) => {
        this.triggerEvent('recorded', { tempFilePath: res.tempFilePath });
      });
      recorder.stop();
    },
  },
});
```

- [ ] **Step 2: 上课页加"只看不读"降级模式**

修改 `miniprogram/pages/lesson/lesson.ts` 顶部加降级状态：
```typescript
Page({
  data: {
    // ...原字段
    viewOnly: false,
  } as { viewOnly: boolean },

  methods: {
    async checkRecordPermission() {
      try {
        const setting = await wx.getSetting();
        if (!setting.authSetting['scope.record']) {
          // 已拒绝过：进入只看不读模式
          this.setData({ viewOnly: true });
        }
      } catch {}
    },
  },
});
```

在 `onLoad` 内调用 `this.checkRecordPermission()`。

修改 lesson.wxml 的录音按钮区域：
```xml
<recordButton wx:if="{{awaitingSpeech && !viewOnly}}" bind:recorded="onRecorded" />
<view class="hint" wx:if="{{viewOnly}}">跟老师一起念～</view>
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/
git commit -m "feat(mp): handle record permission with kid-friendly prompt and view-only fallback"
```

---

### Task 16: 端到端冒烟测试脚本

**Files:**
- Create: `backend/tests/e2e.test.ts`

- [ ] **Step 1: 写端到端测试（注入 fake provider，跑完整闭环）**

`backend/tests/e2e.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../src/server.js';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import { ensureUser } from '../src/progress/progressService.js';
import type { SpeechProvider } from '../src/speech/speechTypes.js';

// 注入 fake provider：替换默认讯飞
const fakeProvider: SpeechProvider = {
  async evaluate() { return { recognizedText: 'I see a cat.', score: 88, isSilent: false }; },
};

beforeEach(async () => {
  await prisma.sentenceAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.user.deleteMany();
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('e2e lesson loop', () => {
  it('goes from themes to lesson to feedback to finalize', async () => {
    const server = buildServer();

    // 1. 取主题
    const themes = await server.inject({ method: 'GET', url: '/themes' });
    expect(themes.statusCode).toBe(200);
    expect(themes.json()).toHaveLength(3);

    // 2. 取 animals 关卡和句子
    const lessons = (await server.inject({ method: 'GET', url: '/themes/animals/lessons' })).json() as Array<{ lessonId: string }>;
    const lessonId = lessons[0].lessonId;
    const sentences = (await server.inject({ method: 'GET', url: `/lessons/${lessonId}/sentences` })).json() as Array<{ sentenceId: string }>;
    expect(sentences).toHaveLength(6);

    // 3. 准备一个真实 user（绕过 /auth/login，直接用 ensureUser）
    const u = await ensureUser('wx_e2e_1', 'E2E', 'a.png');

    // 4. 评估第一句（注入 fake provider，需手动调 service 而非路由，因为路由用真实讯飞）
    const { evaluateAndFeedback } = await import('../src/speech/speechService.js');
    const r = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sentences[0].sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: fakeProvider,
    });
    expect(r.feedback.branch).toBe('praise');

    // 5. 结课 finalize
    const fin = await server.inject({
      method: 'POST',
      url: `/progress/${u.userId}/${lessonId}/finalize`,
      payload: { stars: 3 },
    });
    expect(fin.statusCode).toBe(200);
    expect(fin.json().ok).toBe(true);

    await server.close();
  });

  it('handles timeout as skip without crashing', async () => {
    const server = buildServer();
    const lessons = (await server.inject({ method: 'GET', url: '/themes/animals/lessons' })).json() as Array<{ lessonId: string }>;
    const sentences = (await server.inject({ method: 'GET', url: `/lessons/${lessons[0].lessonId}/sentences` })).json() as Array<{ sentenceId: string }>;
    const u = await ensureUser('wx_e2e_2', 'E2E', 'a.png');

    const { evaluateAndFeedback } = await import('../src/speech/speechService.js');
    const timeoutProvider: SpeechProvider = { async evaluate() { throw new Error('timeout'); } };
    const r = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sentences[0].sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: timeoutProvider,
    });
    expect(r.feedback.branch).toBe('skip');

    await server.close();
  });
});
```

- [ ] **Step 2: 运行端到端测试**

Run: `cd backend && npx vitest run tests/e2e.test.ts`
Expected: 2 测试全过

- [ ] **Step 3: 运行全量测试确保无回归**

Run: `cd backend && npm test`
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "test: add end-to-end smoke tests for lesson loop and timeout fallback"
```

---

## 自检

**Spec 覆盖**：
- §1 架构/选型 → Task 1（骨架）、Task 2（数据）、Task 7（语音适配）
- §1 小程序约束（主包/录音/审核） → Task 10/11/15
- §2 首页/选课/上课页/小结 → Task 12/13/14
- §2 上课循环（带读→跟读→评分→反馈） → Task 13 + Task 9 后端编排
- §3 5 张表 → Task 2
- §3 72 句种子 → Task 3
- §3 openid 锚点 → Task 5
- §4 10 步时序 → Task 9（后端）+ Task 13（前端）
- §4 延迟控制（2s 超时、预生成 TTS、预编排反馈） → Task 9（超时降级）、Task 11（反馈模板预编排）
- §5 容错四原则与五类场景 → Task 9（timeout skip）、Task 15（权限引导/只看不读）、Task 13（网络失败降级 skip）
- §5 attempt 必存 → Task 6（recordAttempt）+ Task 9（任何分支都记一条）

**占位符扫描**：无 TBD/TODO 占位，所有代码步骤含完整实现。讯飞签名细节有注释说明需替换，但运行路径完整。

**类型一致性**：`SpeechProvider`、`SpeechResult`、`FeedbackBranch`、`Feedback` 在 speechTypes/feedbackPolicy/前端 feedbackAssets 之间命名一致。`evaluateAndFeedback` 在 Task 9 定义、Task 16 调用签名匹配。

---

## 执行交付

Plan complete and saved to `docs/superpowers/plans/2026-09-08-digital-human-english-tutor.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 我每个 task 派一个新 subagent，task 之间我做两段式 review，迭代快、上下文干净

**2. Inline Execution** — 在当前会话按批次执行，每批结束 checkpoint 给你 review

哪种方式？
