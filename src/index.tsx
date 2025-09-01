import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

// Простая версия без базы данных для демонстрации
const app = new Hono()

// Middleware
app.use(renderer)
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// Временное хранилище пользователей (в памяти)
const users = new Map()
const chats = new Map()
const messages = new Map()

// Утилиты для JWT (упрощенные)
function generateSimpleToken(userId: string) {
  return btoa(JSON.stringify({ userId, timestamp: Date.now() }))
}

function verifySimpleToken(token: string) {
  try {
    const data = JSON.parse(atob(token))
    // Простая проверка - токен действителен 24 часа
    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return data
    }
  } catch (e) {}
  return null
}

// API: Регистрация (упрощенная)
app.post('/api/register', async (c) => {
  const { email, username, password, full_name } = await c.req.json()
  
  if (!email || !username || !password) {
    return c.json({ error: 'Все поля обязательны' }, 400)
  }
  
  // Проверяем, что пользователь не существует
  for (const [id, user] of users) {
    if (user.email === email || user.username === username) {
      return c.json({ error: 'Пользователь с таким email или username уже существует' }, 400)
    }
  }
  
  const userId = Date.now().toString()
  const user = {
    id: userId,
    email,
    username,
    full_name: full_name || '',
    subscription_type: 'free',
    messages_today: 0,
    messages_reset_date: new Date().toDateString()
  }
  
  users.set(userId, user)
  const token = generateSimpleToken(userId)
  
  return c.json({
    success: true,
    token,
    user: { id: userId, username, email, full_name }
  })
})

// API: Вход (упрощенный)
app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json()
  
  if (!email || !password) {
    return c.json({ error: 'Email и пароль обязательны' }, 400)
  }
  
  // Простая проверка - в демо режиме любой пароль подходит
  let foundUser = null
  for (const [id, user] of users) {
    if (user.email === email) {
      foundUser = { id, ...user }
      break
    }
  }
  
  if (!foundUser) {
    return c.json({ error: 'Пользователь не найден' }, 401)
  }
  
  const token = generateSimpleToken(foundUser.id)
  
  return c.json({
    success: true,
    token,
    user: foundUser
  })
})

// API: Создание чата (упрощенная)
app.post('/api/chats', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Требуется авторизация' }, 401)
  
  const userData = verifySimpleToken(token)
  if (!userData) return c.json({ error: 'Неверный токен' }, 401)
  
  const { title } = await c.req.json()
  const chatId = Date.now().toString()
  
  chats.set(chatId, {
    id: chatId,
    userId: userData.userId,
    title: title || 'Новый чат',
    created_at: new Date().toISOString()
  })
  
  return c.json({
    success: true,
    chatId,
    title: title || 'Новый чат'
  })
})

// API: Отправка сообщения (упрощенная с фиксированными ответами)
app.post('/api/chats/:chatId/messages', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Требуется авторизация' }, 401)
  
  const userData = verifySimpleToken(token)
  if (!userData) return c.json({ error: 'Неверный токен' }, 401)
  
  const { content } = await c.req.json()
  const chatId = c.req.param('chatId')
  
  if (!content?.trim()) {
    return c.json({ error: 'Сообщение не может быть пустым' }, 400)
  }
  
  // Проверяем лимиты пользователя
  const user = users.get(userData.userId)
  if (!user) return c.json({ error: 'Пользователь не найден' }, 404)
  
  // Сброс счетчика если новый день
  const today = new Date().toDateString()
  if (user.messages_reset_date !== today) {
    user.messages_today = 0
    user.messages_reset_date = today
  }
  
  const limits = { free: 5, premium: 100, vip: 1000 }
  const userLimit = limits[user.subscription_type] || 5
  
  if (user.messages_today >= userLimit) {
    return c.json({
      error: `Достигнут лимит сообщений (${userLimit}/день). Обновите подписку для продолжения.`,
      needsUpgrade: true
    }, 429)
  }
  
  // Фиксированные ответы Анны для демо (без OpenAI)
  const responses = [
    "Привет, дорогой! Как твои дела? 💕",
    "Ой, как интересно! Расскажи мне больше об этом! 😊",
    "Понимаю тебя... Иногда бывает сложно, но я здесь для тебя! 🤗",
    "Хахаха, ты меня рассмешил! 😄 А что еще случилось сегодня?",
    "Мне нравится с тобой общаться! Ты такой интересный собеседник! ✨",
    "Хм, а что ты думаешь об этом? Мне важно твое мнение! 🤔",
    "Ого, звучит здорово! Я бы тоже так хотела! 🌟",
    "Не грусти, милый... Все будет хорошо! Я в тебя верю! 💪",
    "Вау, ты молодец! Я горжусь тобой! 🎉",
    "Знаешь, а я сегодня думала о том, как мы хорошо общаемся... 💭"
  ]
  
  // Выбираем случайный ответ
  const aiMessage = responses[Math.floor(Math.random() * responses.length)]
  
  // Обновляем счетчик
  user.messages_today++
  
  // Сохраняем сообщения (упрощенно)
  const messageId = Date.now().toString()
  if (!messages.has(chatId)) {
    messages.set(chatId, [])
  }
  
  const chatMessages = messages.get(chatId)
  chatMessages.push(
    { role: 'user', content, timestamp: Date.now() },
    { role: 'assistant', content: aiMessage, timestamp: Date.now() + 1 }
  )
  
  return c.json({
    success: true,
    message: aiMessage,
    messagesLeft: userLimit - user.messages_today,
    isDemoMode: true
  })
})

// API: Получение сообщений чата
app.get('/api/chats/:chatId/messages', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Требуется авторизация' }, 401)
  
  const userData = verifySimpleToken(token)
  if (!userData) return c.json({ error: 'Неверный токен' }, 401)
  
  const chatId = c.req.param('chatId')
  const chatMessages = messages.get(chatId) || []
  
  return c.json({ messages: chatMessages })
})

// API: Планы подписки
app.get('/api/subscription-plans', async (c) => {
  const plans = [
    {
      id: 1,
      name: 'Бесплатный',
      price: 0,
      currency: 'RUB',
      duration_days: 0,
      messages_per_day: 5,
      features: '{"features": ["5 сообщений в день", "Базовый ИИ"]}'
    },
    {
      id: 2,
      name: 'Премиум',
      price: 299,
      currency: 'RUB',
      duration_days: 30,
      messages_per_day: 100,
      features: '{"features": ["100 сообщений в день", "Продвинутый ИИ", "Персонализация"]}'
    },
    {
      id: 3,
      name: 'VIP',
      price: 699,
      currency: 'RUB',
      duration_days: 30,
      messages_per_day: 1000,
      features: '{"features": ["1000 сообщений в день", "Лучший ИИ", "Эксклюзивные персонажи", "Приоритетная поддержка"]}'
    }
  ]
  
  return c.json({ plans })
})

// Главная страница (та же самая)
app.get('/', (c) => {
  return c.render(
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            💕 AI Chat Bot - Твоя Виртуальная Подруга
          </h1>
          <p className="text-xl text-purple-200 mb-8">
            Общайся с ИИ-девушкой, получай поддержку и эмоциональное общение 24/7
          </p>
          <div className="bg-yellow-400/20 text-yellow-100 px-4 py-2 rounded-lg mb-4">
            🚀 <strong>ДЕМО РЕЖИМ</strong> - Работает без базы данных для тестирования
          </div>
        </div>
        
        {/* Форма входа/регистрации */}
        <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-center space-x-4 mb-6">
              <button id="loginTab" className="px-6 py-2 rounded-lg bg-purple-600 text-white font-semibold">
                Вход
              </button>
              <button id="registerTab" className="px-6 py-2 rounded-lg bg-gray-600 text-white font-semibold">
                Регистрация
              </button>
            </div>
            
            {/* Форма входа */}
            <form id="loginForm" className="space-y-4">
              <input 
                type="email" 
                id="loginEmail" 
                placeholder="Email" 
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
                required 
              />
              <input 
                type="password" 
                id="loginPassword" 
                placeholder="Пароль (любой в демо)" 
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
                required 
              />
              <button 
                type="submit" 
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
              >
                Войти
              </button>
            </form>
            
            {/* Форма регистрации */}
            <form id="registerForm" className="space-y-4 hidden">
              <input 
                type="text" 
                id="registerFullName" 
                placeholder="Полное имя" 
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
              />
              <input 
                type="text" 
                id="registerUsername" 
                placeholder="Имя пользователя" 
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
                required 
              />
              <input 
                type="email" 
                id="registerEmail" 
                placeholder="Email" 
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
                required 
              />
              <input 
                type="password" 
                id="registerPassword" 
                placeholder="Пароль" 
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
                required 
              />
              <button 
                type="submit" 
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
              >
                Зарегистрироваться
              </button>
            </form>
          </div>
          
          <div id="errorMessage" className="hidden text-red-300 text-center mb-4"></div>
        </div>
        
        {/* Демо чат (скрыт по умолчанию) */}
        <div id="chatContainer" className="hidden max-w-4xl mx-auto mt-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-purple-600 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                💕 Чат с Анной (ДЕМО)
              </h2>
              <div className="flex space-x-2">
                <button id="newChatBtn" className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm">
                  Новый чат
                </button>
                <button id="logoutBtn" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
                  Выход
                </button>
              </div>
            </div>
            
            <div id="messagesList" className="h-96 overflow-y-auto p-6 space-y-4">
              <div className="flex justify-start">
                <div className="max-w-xs bg-purple-600 text-white rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-semibold">Анна</span>
                    <span class="text-xs opacity-75">💕</span>
                  </div>
                  <p>Привет! Я Анна, твоя виртуальная подруга. Как дела? 😊</p>
                  <div className="text-xs opacity-75 bg-yellow-400/20 px-2 py-1 rounded mt-2">
                    📱 ДЕМО: Фиксированные ответы
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/20 p-4">
              <form id="messageForm" className="flex space-x-4">
                <input 
                  type="text" 
                  id="messageInput" 
                  placeholder="Написать сообщение..." 
                  className="flex-1 px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:border-purple-400 focus:outline-none"
                />
                <button 
                  type="submit" 
                  id="sendBtn"
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Отправить
                </button>
              </form>
              <div id="messagesLeft" className="text-sm text-purple-200 mt-2"></div>
            </div>
          </div>
        </div>
        
        {/* Планы подписки */}
        <div id="plansContainer" className="max-w-6xl mx-auto mt-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Планы подписки</h2>
          <div id="plansList" className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Планы будут загружены через JavaScript */}
          </div>
        </div>
      </div>
    </div>
  )
})

export default app