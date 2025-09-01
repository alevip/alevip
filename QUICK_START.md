# 🚀 Быстрый старт AI Chat Bot

## 📥 Способы развертывания

### Вариант 1: Cloudflare Pages (Рекомендуется)

**Преимущества**: Бесплатный хостинг, CDN, автоскейлинг, SSL

1. **Настройте Cloudflare API ключ**:
   ```
   1. Зайдите на https://dash.cloudflare.com/profile/api-tokens
   2. Создайте Custom Token с правами:
      - Account: Cloudflare Pages:Edit  
      - Zone: Zone:Read, Zone Settings:Read
   3. Скопируйте токен
   ```

2. **Клонируйте репозиторий**:
   ```bash
   git clone https://github.com/alevip/alevip.git ai-chat-bot
   cd ai-chat-bot
   npm install
   ```

3. **Настройте переменные**:
   ```bash
   # Создайте .dev.vars файл:
   OPENAI_API_KEY=sk-proj-ваш-ключ-openai
   JWT_SECRET=ваш-секретный-ключ
   AI_CHARACTER_NAME=Анна
   AI_CHARACTER_PERSONALITY=Я дружелюбная виртуальная подруга...
   ```

4. **Создайте D1 базу**:
   ```bash
   npx wrangler d1 create ai-chat-bot-production
   # Скопируйте database_id в wrangler.jsonc
   ```

5. **Деплой**:
   ```bash
   npm run build
   npx wrangler pages project create ai-chat-bot
   npx wrangler d1 migrations apply ai-chat-bot-production
   npx wrangler pages deploy dist --project-name ai-chat-bot
   ```

### Вариант 2: Vercel (Альтернатива)

1. **Форкните репозиторий** https://github.com/alevip/alevip
2. **Зайдите на https://vercel.com**
3. **Import GitHub repository**
4. **Настройте переменные окружения**:
   - `OPENAI_API_KEY` - ваш OpenAI ключ
   - `JWT_SECRET` - секретный ключ

### Вариант 3: Railway (Простой)

1. **Зайдите на https://railway.app** 
2. **Deploy from GitHub**
3. **Выберите репозиторий** alevip/alevip
4. **Добавьте переменные окружения**

### Вариант 4: Netlify

1. **Зайдите на https://netlify.com**
2. **New site from Git**
3. **Выберите GitHub репозиторий**
4. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

## 🔑 Получение API ключей

### OpenAI API Key (обязательно)
1. Регистрация: https://platform.openai.com
2. API Keys: https://platform.openai.com/api-keys  
3. Create new secret key
4. Скопируйте ключ (начинается с `sk-`)

**Стоимость**: ~$0.002 за 1K токенов (очень дешево!)

### Настройка платежей (для монетизации)

**ЮKassa (для России)**:
1. https://yookassa.ru
2. Регистрация ИП/ООО
3. Получите shop_id и secret_key

**Stripe (международные)**:
1. https://stripe.com
2. Создайте аккаунт
3. Получите API ключи

## 🧪 Тестирование локально

```bash
# Клонирование
git clone https://github.com/alevip/alevip.git
cd alevip
npm install

# Настройка .dev.vars (смотрите выше)

# Локальный запуск
npm run db:migrate:local
npm run db:seed
npm run build
npm run dev:d1

# Откройте http://localhost:3000
```

## 💰 Монетизация готова!

**Планы подписки уже настроены**:
- 🆓 Бесплатный: 5 сообщений/день
- 💎 Премиум: 299₽/месяц - 100 сообщений
- 👑 VIP: 699₽/месяц - 1000 сообщений

**Потенциальная прибыль**:
- 100 пользователей = 15-30k₽/месяц
- 500 пользователей = 75-150k₽/месяц  
- 1000 пользователей = 150-700k₽/месяц

## 🎯 Маркетинг

### Целевая аудитория:
- Мужчины 25-45 лет
- Одинокие, интроверты
- Пользователи соцсетей

### Каналы продвижения:
1. **ВКонтакте**: группы знакомств, психологии
2. **Telegram**: каналы для мужчин
3. **YouTube**: реклама на каналах психологии
4. **Яндекс.Директ**: ключевые слова "виртуальная подруга"
5. **TikTok**: видео про ИИ общение

### Креативы для рекламы:
- "Твоя виртуальная подруга всегда поддержит 💕"
- "ИИ-девушка, которая тебя понимает 🤖❤️"
- "Общение без обязательств 24/7 😊"

## 📈 Аналитика

После запуска добавьте:
- **Google Analytics** - отслеживание конверсий
- **Яндекс.Метрика** - поведение пользователей  
- **Cloudflare Analytics** - производительность

## 🆘 Поддержка

**GitHub**: https://github.com/alevip/alevip
**Документация**: README.md + DEPLOYMENT.md

---

**Готово к заработку! Удачи! 🚀💰**