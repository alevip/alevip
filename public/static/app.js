// AI Chat Bot Frontend JavaScript
let currentUser = null;
let currentChatId = null;
let authToken = null;

// Utility functions
function showNotification(message, type = 'success') {
  // Remove existing notifications
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Show notification
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  // Hide and remove notification
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    setTimeout(() => {
      errorDiv.classList.add('hidden');
    }, 5000);
  }
  showNotification(message, 'error');
}

function setAuthToken(token) {
  authToken = token;
  localStorage.setItem('auth_token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function getAuthToken() {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
    if (authToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
  }
  return authToken;
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('auth_token');
  delete axios.defaults.headers.common['Authorization'];
}

function showLogin() {
  document.getElementById('chatContainer').classList.add('hidden');
  document.querySelector('.max-w-md').classList.remove('hidden');
}

function showChat() {
  document.querySelector('.max-w-md').classList.add('hidden');
  document.getElementById('chatContainer').classList.remove('hidden');
}

function addMessage(content, role, animate = true) {
  const messagesList = document.getElementById('messagesList');
  const messageDiv = document.createElement('div');
  
  if (role === 'user') {
    messageDiv.className = 'flex justify-end';
    messageDiv.innerHTML = `
      <div class="max-w-xs message-user text-white rounded-2xl px-4 py-3 ${animate ? 'message-animation' : ''}">
        <p>${content}</p>
        <div class="text-xs opacity-75 text-right mt-1">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    `;
  } else {
    messageDiv.className = 'flex justify-start';
    messageDiv.innerHTML = `
      <div class="max-w-xs message-ai text-white rounded-2xl px-4 py-3 ${animate ? 'message-animation' : ''}">
        <div class="flex items-center space-x-2 mb-1">
          <span class="text-sm font-semibold">Анна</span>
          <span class="text-xs">💕</span>
        </div>
        <p>${content}</p>
        <div class="text-xs opacity-75 mt-1">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    `;
  }
  
  messagesList.appendChild(messageDiv);
  messagesList.scrollTop = messagesList.scrollHeight;
}

function showTypingIndicator() {
  const messagesList = document.getElementById('messagesList');
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typingIndicator';
  typingDiv.className = 'flex justify-start';
  typingDiv.innerHTML = `
    <div class="typing-indicator">
      <div class="flex items-center space-x-2 mr-2">
        <span class="text-sm font-semibold text-white">Анна</span>
        <span class="text-xs">💕</span>
      </div>
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  
  messagesList.appendChild(typingDiv);
  messagesList.scrollTop = messagesList.scrollHeight;
}

function hideTypingIndicator() {
  const typingDiv = document.getElementById('typingIndicator');
  if (typingDiv) {
    typingDiv.remove();
  }
}

async function loadMessages(chatId) {
  try {
    const response = await axios.get(`/api/chats/${chatId}/messages`);
    const messagesList = document.getElementById('messagesList');
    
    // Clear existing messages except welcome message
    messagesList.innerHTML = `
      <div class="flex justify-start">
        <div class="max-w-xs message-ai text-white rounded-2xl px-4 py-3">
          <div class="flex items-center space-x-2 mb-1">
            <span class="text-sm font-semibold">Анна</span>
            <span class="text-xs opacity-75">💕</span>
          </div>
          <p>Привет! Я Анна, твоя виртуальная подруга. Как дела? 😊</p>
        </div>
      </div>
    `;
    
    // Add messages from database
    response.data.messages.forEach(message => {
      if (message.role !== 'system') {
        addMessage(message.content, message.role, false);
      }
    });
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

async function loadSubscriptionPlans() {
  try {
    const response = await axios.get('/api/subscription-plans');
    const plansList = document.getElementById('plansList');
    
    if (response.data.plans && response.data.plans.length > 0) {
      plansList.innerHTML = response.data.plans.map(plan => {
        const features = JSON.parse(plan.features || '{}').features || [];
        const isPopular = plan.name === 'Премиум';
        
        return `
          <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl ${isPopular ? 'ring-2 ring-purple-400 relative' : ''} hover-scale">
            ${isPopular ? '<div class="absolute -top-3 left-1/2 transform -translate-x-1/2 premium-badge">Популярный</div>' : ''}
            <h3 class="text-2xl font-bold text-white mb-2">${plan.name}</h3>
            <div class="text-4xl font-bold text-purple-300 mb-4">
              ${plan.price > 0 ? `${plan.price} ₽` : 'Бесплатно'}
              ${plan.price > 0 ? `<span class="text-sm text-gray-300">/месяц</span>` : ''}
            </div>
            <ul class="space-y-2 mb-6">
              ${features.map(feature => `
                <li class="flex items-center text-gray-200">
                  <i class="fas fa-check text-green-400 mr-2"></i>
                  ${feature}
                </li>
              `).join('')}
            </ul>
            <button 
              onclick="subscribeToPlan(${plan.id}, '${plan.name}', ${plan.price})"
              class="w-full py-3 ${isPopular ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg font-semibold transition-colors ${plan.price === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
              ${plan.price === 0 ? 'disabled' : ''}
            >
              ${plan.price === 0 ? 'Текущий план' : 'Выбрать план'}
            </button>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading subscription plans:', error);
  }
}

function subscribeToPlan(planId, planName, price) {
  if (!currentUser) {
    showError('Необходимо войти в аккаунт');
    return;
  }
  
  showNotification(`Функция оплаты будет добавлена. План: ${planName} (${price}₽)`, 'warning');
}

// Event handlers
document.addEventListener('DOMContentLoaded', function() {
  // Tab switching
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  loginTab.addEventListener('click', () => {
    loginTab.classList.remove('bg-gray-600');
    loginTab.classList.add('bg-purple-600');
    registerTab.classList.remove('bg-purple-600');
    registerTab.classList.add('bg-gray-600');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });
  
  registerTab.addEventListener('click', () => {
    registerTab.classList.remove('bg-gray-600');
    registerTab.classList.add('bg-indigo-600');
    loginTab.classList.remove('bg-purple-600');
    loginTab.classList.add('bg-gray-600');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });
  
  // Login form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
      const response = await axios.post('/api/login', { email, password });
      
      if (response.data.success) {
        currentUser = response.data.user;
        setAuthToken(response.data.token);
        
        showNotification(`Добро пожаловать, ${currentUser.username}!`);
        showChat();
        
        // Create or load first chat
        const chatResponse = await axios.post('/api/chats', { 
          title: 'Чат с Анной',
          ai_personality: 'Анна'
        });
        
        if (chatResponse.data.success) {
          currentChatId = chatResponse.data.chatId;
          await loadMessages(currentChatId);
        }
        
        // Update messages left indicator
        updateMessagesLeftIndicator();
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Ошибка при входе');
    }
  });
  
  // Register form
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const full_name = document.getElementById('registerFullName').value;
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
      const response = await axios.post('/api/register', {
        full_name,
        username,
        email,
        password
      });
      
      if (response.data.success) {
        currentUser = response.data.user;
        setAuthToken(response.data.token);
        
        showNotification(`Регистрация успешна! Добро пожаловать, ${username}!`);
        showChat();
        
        // Create first chat
        const chatResponse = await axios.post('/api/chats', { 
          title: 'Мой первый чат',
          ai_personality: 'Анна'
        });
        
        if (chatResponse.data.success) {
          currentChatId = chatResponse.data.chatId;
          await loadMessages(currentChatId);
        }
        
        updateMessagesLeftIndicator();
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Ошибка при регистрации');
    }
  });
  
  // Message form
  const messageForm = document.getElementById('messageForm');
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content || !currentChatId) return;
    
    // Disable send button
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Отправляем...';
    
    // Add user message
    addMessage(content, 'user');
    messageInput.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
      const response = await axios.post(`/api/chats/${currentChatId}/messages`, {
        content
      });
      
      if (response.data.success) {
        hideTypingIndicator();
        addMessage(response.data.message, 'assistant');
        
        // Update messages left counter
        const messagesLeft = response.data.messagesLeft;
        updateMessagesLeftIndicator(messagesLeft);
        
        if (messagesLeft <= 0) {
          showNotification('Лимит сообщений исчерпан! Обновите подписку для продолжения.', 'warning');
        }
      }
    } catch (error) {
      hideTypingIndicator();
      
      if (error.response?.status === 429) {
        showError('Лимит сообщений исчерпан! Обновите подписку для продолжения.');
      } else {
        showError(error.response?.data?.error || 'Ошибка при отправке сообщения');
      }
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Отправить';
    }
  });
  
  // New chat button
  document.getElementById('newChatBtn').addEventListener('click', async () => {
    if (!currentUser) return;
    
    try {
      const response = await axios.post('/api/chats', {
        title: 'Новый чат',
        ai_personality: 'Анна'
      });
      
      if (response.data.success) {
        currentChatId = response.data.chatId;
        await loadMessages(currentChatId);
        showNotification('Новый чат создан!');
      }
    } catch (error) {
      showError('Ошибка при создании нового чата');
    }
  });
  
  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearAuth();
    showLogin();
    showNotification('Вы вышли из аккаунта');
  });
  
  // Check if user is already logged in
  const existingToken = getAuthToken();
  if (existingToken) {
    // Try to load user profile
    axios.get('/api/profile')
      .then(response => {
        currentUser = response.data.user;
        showChat();
        
        // Load or create first chat
        return axios.post('/api/chats', { 
          title: 'Чат с Анной',
          ai_personality: 'Анна'
        });
      })
      .then(response => {
        if (response.data.success) {
          currentChatId = response.data.chatId;
          loadMessages(currentChatId);
        }
        updateMessagesLeftIndicator();
      })
      .catch(() => {
        // Invalid token, clear auth
        clearAuth();
      });
  }
  
  // Load subscription plans
  loadSubscriptionPlans();
});

async function updateMessagesLeftIndicator(messagesLeft) {
  const messagesLeftDiv = document.getElementById('messagesLeft');
  
  if (!currentUser) {
    messagesLeftDiv.textContent = '';
    return;
  }
  
  try {
    if (messagesLeft === undefined) {
      // Fetch current user profile to get messages left
      const response = await axios.get('/api/profile');
      const user = response.data.user;
      
      const limits = {
        free: 5,
        premium: 100,
        vip: 1000
      };
      
      const userLimit = limits[user.subscription_type] || 5;
      messagesLeft = Math.max(0, userLimit - (user.messages_today || 0));
    }
    
    if (messagesLeft <= 0) {
      messagesLeftDiv.innerHTML = `
        <span class="text-red-300">⚠️ Лимит сообщений исчерпан</span>
        <button onclick="document.getElementById('plansContainer').scrollIntoView({behavior: 'smooth'})" 
                class="ml-2 text-purple-300 underline hover:text-purple-200">
          Обновить план
        </button>
      `;
    } else {
      messagesLeftDiv.innerHTML = `
        <span class="text-purple-200">💬 Осталось сообщений: ${messagesLeft}</span>
      `;
    }
  } catch (error) {
    console.error('Error updating messages left:', error);
  }
}