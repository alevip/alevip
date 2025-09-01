import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

// Типы для Cloudflare Workers
type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY: string;
  JWT_SECRET: string;
  AI_CHARACTER_NAME: string;
  AI_CHARACTER_PERSONALITY: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use(renderer)
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// Утилиты для работы с JWT
async function generateJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '')
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '')
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  )
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '')
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid token')
    
    const [header, payload, signature] = parts
    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new TextEncoder().encode(`${header}.${payload}`)
    )
    
    const expectedEncodedSignature = btoa(String.fromCharCode(...new Uint8Array(expectedSignature))).replace(/=/g, '')
    
    if (signature !== expectedEncodedSignature) {
      throw new Error('Invalid signature')
    }
    
    return JSON.parse(atob(payload))
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// Middleware для проверки авторизации
async function authMiddleware(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || 
                c.req.cookie('auth_token')
  
  if (!token) {
    return c.json({ error: 'Требуется авторизация' }, 401)
  }
  
  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch (error) {
    return c.json({ error: 'Неверный токен' }, 401)
  }
}

// Утилита для хеширования паролей
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'salt') // В реальном проекте используйте случайную соль
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

// API: Регистрация
app.post('/api/register', async (c) => {
  const { email, username, password, full_name } = await c.req.json()
  
  if (!email || !username || !password) {
    return c.json({ error: 'Все поля обязательны' }, 400)
  }
  
  try {
    const passwordHash = await hashPassword(password)
    
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, username, password_hash, full_name) 
      VALUES (?, ?, ?, ?)
    `).bind(email, username, passwordHash, full_name || null).run()
    
    const token = await generateJWT(
      { userId: result.meta.last_row_id, username, email }, 
      c.env.JWT_SECRET
    )
    
    return c.json({ 
      success: true, 
      token,
      user: { id: result.meta.last_row_id, username, email, full_name }
    })
  } catch (error) {
    return c.json({ error: 'Пользователь с таким email или username уже существует' }, 400)
  }
})

// API: Вход
app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json()
  
  if (!email || !password) {
    return c.json({ error: 'Email и пароль обязательны' }, 400)
  }
  
  try {
    const passwordHash = await hashPassword(password)
    
    const user = await c.env.DB.prepare(`
      SELECT id, email, username, full_name, subscription_type, subscription_expires 
      FROM users 
      WHERE email = ? AND password_hash = ? AND is_active = 1
    `).bind(email, passwordHash).first()
    
    if (!user) {
      return c.json({ error: 'Неверный email или пароль' }, 401)
    }
    
    // Обновляем время последнего входа
    await c.env.DB.prepare(`
      UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(user.id).run()
    
    const token = await generateJWT(
      { userId: user.id, username: user.username, email: user.email }, 
      c.env.JWT_SECRET
    )
    
    return c.json({ 
      success: true, 
      token,
      user
    })
  } catch (error) {
    return c.json({ error: 'Ошибка при входе' }, 500)
  }
})

// API: Получение профиля пользователя
app.get('/api/profile', authMiddleware, async (c) => {
  const user = c.get('user')
  
  const userProfile = await c.env.DB.prepare(`
    SELECT id, email, username, full_name, subscription_type, subscription_expires, 
           messages_today, messages_reset_date, created_at
    FROM users WHERE id = ?
  `).bind(user.userId).first()
  
  return c.json({ user: userProfile })
})

// API: Создание нового чата
app.post('/api/chats', authMiddleware, async (c) => {
  const user = c.get('user')
  const { title, ai_personality } = await c.req.json()
  
  const result = await c.env.DB.prepare(`
    INSERT INTO chat_sessions (user_id, title, ai_personality, ai_character_settings) 
    VALUES (?, ?, ?, ?)
  `).bind(
    user.userId, 
    title || 'Новый чат', 
    ai_personality || c.env.AI_CHARACTER_NAME,
    JSON.stringify({ personality: c.env.AI_CHARACTER_PERSONALITY })
  ).run()
  
  return c.json({ 
    success: true, 
    chatId: result.meta.last_row_id,
    title: title || 'Новый чат'
  })
})

// API: Получение списка чатов пользователя
app.get('/api/chats', authMiddleware, async (c) => {
  const user = c.get('user')
  
  const chats = await c.env.DB.prepare(`
    SELECT id, title, ai_personality, created_at, updated_at
    FROM chat_sessions 
    WHERE user_id = ? AND is_active = 1 
    ORDER BY updated_at DESC
  `).bind(user.userId).all()
  
  return c.json({ chats: chats.results })
})

// API: Получение сообщений чата
app.get('/api/chats/:chatId/messages', authMiddleware, async (c) => {
  const user = c.get('user')
  const chatId = c.req.param('chatId')
  
  // Проверяем, что чат принадлежит пользователю
  const chat = await c.env.DB.prepare(`
    SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?
  `).bind(chatId, user.userId).first()
  
  if (!chat) {
    return c.json({ error: 'Чат не найден' }, 404)
  }
  
  const messages = await c.env.DB.prepare(`
    SELECT role, content, created_at
    FROM messages 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `).bind(chatId).all()
  
  return c.json({ messages: messages.results })
})

// API: Отправка сообщения и получение ответа от ИИ
app.post('/api/chats/:chatId/messages', authMiddleware, async (c) => {
  const user = c.get('user')
  const chatId = c.req.param('chatId')
  const { content } = await c.req.json()
  
  if (!content?.trim()) {
    return c.json({ error: 'Сообщение не может быть пустым' }, 400)
  }
  
  try {
    // Проверяем лимиты пользователя
    const userProfile = await c.env.DB.prepare(`
      SELECT subscription_type, messages_today, messages_reset_date, subscription_expires
      FROM users WHERE id = ?
    `).bind(user.userId).first()
    
    // Сброс счетчика сообщений если прошел день
    const today = new Date().toISOString().split('T')[0]
    if (userProfile.messages_reset_date !== today) {
      await c.env.DB.prepare(`
        UPDATE users SET messages_today = 0, messages_reset_date = ? WHERE id = ?
      `).bind(today, user.userId).run()
      userProfile.messages_today = 0
    }
    
    // Проверка лимитов
    const limits = {
      free: 5,
      premium: 100,
      vip: 1000
    }
    
    const userLimit = limits[userProfile.subscription_type] || 5
    if (userProfile.messages_today >= userLimit) {
      return c.json({ 
        error: `Достигнут лимит сообщений (${userLimit}/день). Обновите подписку для продолжения.`,
        needsUpgrade: true 
      }, 429)
    }
    
    // Сохраняем сообщение пользователя
    await c.env.DB.prepare(`
      INSERT INTO messages (session_id, user_id, role, content) 
      VALUES (?, ?, 'user', ?)
    `).bind(chatId, user.userId, content).run()
    
    // Получаем настройки персонажа
    const chatSettings = await c.env.DB.prepare(`
      SELECT ai_character_settings FROM chat_sessions WHERE id = ?
    `).bind(chatId).first()
    
    const characterSettings = JSON.parse(chatSettings.ai_character_settings || '{}')
    
    // Получаем историю сообщений для контекста
    const recentMessages = await c.env.DB.prepare(`
      SELECT role, content FROM messages 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).bind(chatId).all()
    
    // Формируем запрос к OpenAI
    const messages = [
      {
        role: 'system',
        content: characterSettings.personality || c.env.AI_CHARACTER_PERSONALITY
      },
      ...recentMessages.results.reverse().slice(0, -1), // Исключаем последнее сообщение пользователя
      { role: 'user', content }
    ]
    
    // Вызов OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.8
      })
    })
    
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', openaiResponse.status, errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
    }
    
    const aiResponse = await openaiResponse.json()
    
    if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
      console.error('Invalid OpenAI response:', aiResponse)
      throw new Error('Invalid response from OpenAI')
    }
    
    const aiMessage = aiResponse.choices[0].message.content
    
    // Сохраняем ответ ИИ
    await c.env.DB.prepare(`
      INSERT INTO messages (session_id, user_id, role, content, tokens_used) 
      VALUES (?, ?, 'assistant', ?, ?)
    `).bind(chatId, user.userId, aiMessage, aiResponse.usage?.total_tokens || 0).run()
    
    // Обновляем счетчик сообщений пользователя
    await c.env.DB.prepare(`
      UPDATE users SET messages_today = messages_today + 1 WHERE id = ?
    `).bind(user.userId).run()
    
    // Обновляем время последнего обновления чата
    await c.env.DB.prepare(`
      UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(chatId).run()
    
    return c.json({
      success: true,
      message: aiMessage,
      messagesLeft: userLimit - (userProfile.messages_today + 1)
    })
    
  } catch (error) {
    console.error('Error sending message:', error)
    
    // Fallback ответы если OpenAI недоступен
    const fallbackResponses = [
      "Извини, у меня сейчас проблемы с подключением, но я здесь для тебя! 💕",
      "Что-то с интернетом... Но я всё равно рада тебя видеть! 😊",
      "Сейчас у меня технические неполадки, но скоро всё будет хорошо! 🌟",
      "Извини за задержку, дорогой! Расскажи мне больше о своём дне! 💖"
    ]
    
    const fallbackMessage = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
    
    // Сохраняем fallback ответ
    try {
      await c.env.DB.prepare(`
        INSERT INTO messages (session_id, user_id, role, content) 
        VALUES (?, ?, 'assistant', ?)
      `).bind(chatId, user.userId, fallbackMessage).run()
      
      // Обновляем счетчик сообщений
      await c.env.DB.prepare(`
        UPDATE users SET messages_today = messages_today + 1 WHERE id = ?
      `).bind(user.userId).run()
      
      return c.json({
        success: true,
        message: fallbackMessage,
        messagesLeft: userLimit - (userProfile.messages_today + 1),
        isFailover: true
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return c.json({ error: 'Ошибка при отправке сообщения' }, 500)
    }
  }
})

// API: Получение планов подписки
app.get('/api/subscription-plans', async (c) => {
  const plans = await c.env.DB.prepare(`
    SELECT id, name, price, currency, duration_days, messages_per_day, features
    FROM subscription_plans WHERE is_active = 1
    ORDER BY price ASC
  `).all()
  
  return c.json({ plans: plans.results })
})

// Главная страница
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
                placeholder="Пароль" 
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
                💕 Чат с Анной
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
                    <span className="text-xs opacity-75">💕</span>
                  </div>
                  <p>Привет! Я Анна, твоя виртуальная подруга. Как дела? 😊</p>
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