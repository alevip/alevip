# 🚀 Инструкция по развертыванию AI Chat Bot

## Перед развертыванием

### 1. Получите необходимые ключи API

**OpenAI API Key** (обязательно):
1. Зайдите на https://platform.openai.com/api-keys
2. Создайте новый API ключ
3. Скопируйте ключ (начинается с `sk-`)

**Cloudflare API Token** (для развертывания):
1. Зайдите на https://dash.cloudflare.com/profile/api-tokens
2. Создайте токен с правами:
   - Zone: Zone Settings:Read, Zone:Read
   - Account: Cloudflare Pages:Edit
3. Скопируйте токен

### 2. Настройка переменных окружения

**Для локальной разработки** (файл `.dev.vars`):
```
OPENAI_API_KEY=sk-your-actual-openai-api-key
JWT_SECRET=your-strong-jwt-secret-key-here
AI_CHARACTER_NAME=Анна  
AI_CHARACTER_PERSONALITY=Я дружелюбная виртуальная подруга по имени Анна...
```

**Для продакшена** (через Cloudflare секреты):
```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name ai-chat-bot
npx wrangler pages secret put JWT_SECRET --project-name ai-chat-bot
```

## Локальная разработка

### 1. Установка и запуск
```bash
# Установка зависимостей
npm install

# Применение миграций базы данных
npm run db:migrate:local

# Заполнение тестовыми данными
npm run db:seed

# Сборка проекта
npm run build

# Запуск с PM2
pm2 start ecosystem.config.cjs

# Получение URL
# Используйте GetServiceUrl tool для получения публичного URL
```

### 2. Тестирование
- Откройте URL в браузере
- Зарегистрируйтесь как новый пользователь
- Протестируйте чат с ИИ (работает без OpenAI API в режиме заглушки)
- Проверьте систему лимитов

## Развертывание на Cloudflare Pages

### 1. Аутентификация
```bash
# Установите CLOUDFLARE_API_TOKEN в переменные окружения
export CLOUDFLARE_API_TOKEN=your-api-token

# Проверьте аутентификацию
npx wrangler whoami
```

### 2. Создание D1 базы данных
```bash
# Создайте production базу данных
npx wrangler d1 create ai-chat-bot-production

# Скопируйте database_id в wrangler.jsonc
# Замените "will-be-set-after-creation" на реальный ID
```

### 3. Создание Cloudflare Pages проекта
```bash
# Создайте проект Pages
npx wrangler pages project create ai-chat-bot \
  --production-branch main \
  --compatibility-date 2025-09-01

# Примените миграции к production базе
npx wrangler d1 migrations apply ai-chat-bot-production

# Добавьте тестовые данные (опционально)
npx wrangler d1 execute ai-chat-bot-production --file=./seed.sql
```

### 4. Развертывание
```bash
# Сборка проекта
npm run build

# Развертывание
npx wrangler pages deploy dist --project-name ai-chat-bot

# Ваше приложение будет доступно по адресу:
# https://ai-chat-bot.pages.dev
```

### 5. Настройка секретов
```bash
# Добавьте OpenAI API ключ
npx wrangler pages secret put OPENAI_API_KEY --project-name ai-chat-bot

# Добавьте JWT секрет
npx wrangler pages secret put JWT_SECRET --project-name ai-chat-bot

# Добавьте настройки персонажа
npx wrangler pages secret put AI_CHARACTER_NAME --project-name ai-chat-bot
npx wrangler pages secret put AI_CHARACTER_PERSONALITY --project-name ai-chat-bot
```

## Проверка развертывания

### 1. Тестирование API
```bash
# Проверка планов подписки
curl https://ai-chat-bot.pages.dev/api/subscription-plans

# Регистрация тестового пользователя
curl -X POST https://ai-chat-bot.pages.dev/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'
```

### 2. Проверка в браузере
1. Откройте https://ai-chat-bot.pages.dev
2. Зарегистрируйтесь
3. Протестируйте чат с ИИ
4. Проверьте ограничения сообщений

## Мониторинг и поддержка

### 1. Просмотр логов
```bash
# Логи Pages
npx wrangler pages deployment tail --project-name ai-chat-bot

# Статистика D1
npx wrangler d1 execute ai-chat-bot-production \
  --command "SELECT COUNT(*) as users FROM users"
```

### 2. Управление базой данных
```bash
# Консоль базы данных
npx wrangler d1 execute ai-chat-bot-production

# Бэкап базы данных
npx wrangler d1 export ai-chat-bot-production --output backup.sql

# Новые миграции
# Создайте файл в migrations/XXXX_migration_name.sql
npx wrangler d1 migrations apply ai-chat-bot-production
```

## Кастомный домен (опционально)

### 1. Добавление домена
```bash
# Добавьте ваш домен
npx wrangler pages domain add yourdomain.com --project-name ai-chat-bot
```

### 2. DNS настройки
Добавьте CNAME запись в DNS:
```
CNAME yourdomain.com ai-chat-bot.pages.dev
```

## Масштабирование

### 1. Увеличение лимитов
- Cloudflare Pages: 100,000 запросов/день (бесплатно)
- D1 Database: 100,000 операций/день (бесплатно)
- Для больших нагрузок используйте платные планы

### 2. Оптимизация
- Используйте Cloudflare Analytics для мониторинга
- Настройте кеширование статических файлов
- Оптимизируйте запросы к базе данных

---

## 💰 Монетизация

После развертывания добавьте:
1. **Stripe/ЮKassa интеграцию** для приема платежей
2. **Email уведомления** для пользователей
3. **Аналитику** для отслеживания конверсии
4. **A/B тестирование** цен и функций

**Готово к заработку!** 🚀