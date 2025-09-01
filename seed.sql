-- Добавление планов подписки
INSERT OR IGNORE INTO subscription_plans (id, name, price, duration_days, messages_per_day, features) VALUES 
  (1, 'Бесплатный', 0, 0, 5, '{"features": ["5 сообщений в день", "Базовый ИИ"]}'),
  (2, 'Премиум', 299, 30, 100, '{"features": ["100 сообщений в день", "Продвинутый ИИ", "Персонализация"]}'),
  (3, 'VIP', 699, 30, 1000, '{"features": ["1000 сообщений в день", "Лучший ИИ", "Эксклюзивные персонажи", "Приоритетная поддержка"]}');

-- Тестовый пользователь
INSERT OR IGNORE INTO users (id, email, username, password_hash, full_name, subscription_type) VALUES 
  (1, 'test@example.com', 'testuser', 'hash123', 'Тестовый Пользователь', 'free');

-- Тестовый чат
INSERT OR IGNORE INTO chat_sessions (id, user_id, title, ai_personality, ai_character_settings) VALUES 
  (1, 1, 'Первый чат', 'Анна', '{"personality": "дружелюбная", "age": "25", "interests": ["психология", "кино", "путешествия"]}');

-- Тестовые сообщения
INSERT OR IGNORE INTO messages (session_id, user_id, role, content) VALUES 
  (1, 1, 'assistant', 'Привет! Я Анна, твоя виртуальная подруга. Как дела? 😊'),
  (1, 1, 'user', 'Привет! Как дела?'),
  (1, 1, 'assistant', 'У меня всё отлично! Рада тебя видеть. Расскажи, как прошёл твой день?');