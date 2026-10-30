const peopleList = document.getElementById('people-list');
const chatFeed = document.getElementById('chat-feed');
const onlineCount = document.getElementById('online-count');
const personForm = document.getElementById('person-form');
const chatForm = document.getElementById('chat-form');
const socket = io();

function getInitials(name) {
  const clean = (name || 'Anonymous').trim();
  if (!clean) return 'A';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
    .slice(0, 2);
}

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const seconds = Math.max(1, Math.round(diffMs / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function renderPeople(people) {
  if (!people.length) {
    peopleList.innerHTML = `
      <div class="empty-state">
        <div>
          <h3>No names on the board yet.</h3>
          <p>Add someone and let the verdicts pile up.</p>
        </div>
      </div>
    `;
    return;
  }

  peopleList.innerHTML = people
    .map((person) => {
      const safeJudgements = (person.judgements || []).filter(
        (judgement) => judgement && String(judgement.text || '').trim() !== ''
      );

      return `
        <article class="person-card" data-person-id="${person.id}">
          <div class="person-head">
            <div class="person-avatar">${getInitials(person.name)}</div>
            <div class="person-meta">
              <h3>${escapeHtml(person.name)}</h3>
              <span>${safeJudgements.length} verdict${safeJudgements.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <form class="person-form">
            <textarea name="judgementText" maxlength="300" placeholder="Add a verdict for ${escapeHtml(person.name)}..." required></textarea>
            <input name="judgementAuthor" type="text" maxlength="30" placeholder="Your name (optional)" />
            <button type="submit">Add verdict</button>
          </form>

          <ul class="judgement-list">
            ${safeJudgements
              .slice(0, 6)
              .map(
                (judgement) => `
                  <li class="judgement-item">
                    <div class="judgement-meta">
                      <span>${escapeHtml(judgement.author || 'Anonymous')}</span>
                      <span>${timeAgo(judgement.created_at)}</span>
                    </div>
                    <p>${escapeHtml(judgement.text)}</p>
                  </li>
                `
              )
              .join('') || '<li class="judgement-item"><p>No verdicts yet. Start the gossip.</p></li>'}
          </ul>
        </article>
      `;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchPeople() {
  try {
    const response = await fetch('/api/people');
    const people = await response.json();
    renderPeople(people);
  } catch (error) {
    console.error('Failed to load people:', error);
  }
}

async function addPerson(event) {
  event.preventDefault();
  const input = document.getElementById('person-name');
  const name = input.value.trim();

  const response = await fetch('/api/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.error || 'Could not add person.');
    return;
  }

  input.value = '';
  fetchPeople();
}

async function addJudgement(event) {
  const form = event.target.closest('.person-form');
  if (!form) return;

  event.preventDefault();
  const article = form.closest('.person-card');
  const personId = article.dataset.personId;
  const text = form.elements.judgementText.value.trim();
  const author = form.elements.judgementAuthor.value.trim();

  if (!text) {
    alert('Add a verdict before sending.');
    return;
  }

  const response = await fetch(`/api/people/${personId}/judgements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, author }),
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.error || 'Could not add verdict.');
    return;
  }

  form.reset();
  fetchPeople();
}

function renderChat(messages) {
  if (!messages.length) {
    chatFeed.innerHTML = '<div class="empty-state"><div><h3>Silence in the room.</h3><p>Start the live chat.</p></div></div>';
    chatFeed.scrollTop = chatFeed.scrollHeight;
    return;
  }

  const storedAuthor = localStorage.getItem('aparichit-author') || '';
  chatFeed.innerHTML = messages
    .map((message) => {
      const isSelf = message.author === storedAuthor && storedAuthor.trim();
      return `
        <div class="chat-message ${isSelf ? 'self' : ''}">
          <div class="chat-message-header">
            <span>${escapeHtml(message.author || 'Anonymous')}</span>
            <span>${timeAgo(message.created_at)}</span>
          </div>
          <p>${escapeHtml(message.message)}</p>
        </div>
      `;
    })
    .join('');

  chatFeed.scrollTop = chatFeed.scrollHeight;
}

async function loadChat() {
  try {
    const response = await fetch('/api/chat');
    const messages = await response.json();
    renderChat(messages);
  } catch (error) {
    console.error('Failed to load chat:', error);
  }
}

function sendChatMessage(event) {
  event.preventDefault();
  const authorInput = document.getElementById('chat-author');
  const messageInput = document.getElementById('chat-message');
  const author = authorInput.value.trim() || 'Anonymous';
  const message = messageInput.value.trim();

  if (!message) {
    alert('Say something in the chat.');
    return;
  }

  localStorage.setItem('aparichit-author', author);
  socket.emit('chat:message', { author, message });
  messageInput.value = '';
}

socket.on('connect', () => {
  onlineCount.textContent = 'online';
});

socket.on('disconnect', () => {
  onlineCount.textContent = 'offline';
});

socket.on('chat:history', (messages) => {
  renderChat(messages);
});

socket.on('chat:message', (message) => {
  const messages = Array.from(chatFeed.querySelectorAll('.chat-message'));
  const currentMessages = messages.length ? messages.map((row) => row.textContent) : [];
  const nextState = currentMessages.length ? [...currentMessages] : [];
  if (nextState.some((item) => item.includes(message.message) && item.includes(message.author))) {
    return;
  }

  const current = chatFeed.innerHTML;
  const storedAuthor = localStorage.getItem('aparichit-author') || '';
  const isSelf = message.author === storedAuthor && storedAuthor.trim();
  const html = `
    <div class="chat-message ${isSelf ? 'self' : ''}">
      <div class="chat-message-header">
        <span>${escapeHtml(message.author || 'Anonymous')}</span>
        <span>${timeAgo(message.created_at)}</span>
      </div>
      <p>${escapeHtml(message.message)}</p>
    </div>
  `;
  chatFeed.insertAdjacentHTML('beforeend', html);
  chatFeed.scrollTop = chatFeed.scrollHeight;
});

socket.on('person:added', () => {
  fetchPeople();
});

socket.on('judgement:added', () => {
  fetchPeople();
});

personForm.addEventListener('submit', addPerson);
peopleList.addEventListener('submit', addJudgement);
chatForm.addEventListener('submit', sendChatMessage);

document.addEventListener('DOMContentLoaded', () => {
  fetchPeople();
  loadChat();

  const author = localStorage.getItem('aparichit-author');
  const chatAuthorInput = document.getElementById('chat-author');
  if (author) {
    chatAuthorInput.value = author;
  }
});
