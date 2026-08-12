const imageStyles = document.createElement('link');
imageStyles.rel = 'stylesheet';
imageStyles.href = '/css/images.css';
document.head.appendChild(imageStyles);

const themeStyles = document.createElement('link');
themeStyles.rel = 'stylesheet';
themeStyles.href = '/css/theme.css';
document.head.appendChild(themeStyles);

const themeFixes = document.createElement('link');
themeFixes.rel = 'stylesheet';
themeFixes.href = '/css/theme-fixes.css';
document.head.appendChild(themeFixes);

const optimizationStyles = document.createElement('link');
optimizationStyles.rel = 'stylesheet';
optimizationStyles.href = '/css/optimizations.css';
document.head.appendChild(optimizationStyles);

let currentTheme = localStorage.getItem('almox_theme') || 'dark';
document.body.dataset.theme = currentTheme;

function onIdle(task, timeout = 900) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout });
    return;
  }
  window.setTimeout(task, timeout);
}

document.addEventListener('DOMContentLoaded', () => {
  window.lucide?.createIcons();
  const page = document.body.dataset.page;
  document.querySelector(`[data-nav="${page}"]`)?.classList.add('active');

  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuBtn')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.addEventListener('click', (event) => {
    if (window.innerWidth < 760 && sidebar?.classList.contains('open') && !sidebar.contains(event.target) && !event.target.closest('#menuBtn')) {
      sidebar.classList.remove('open');
    }
  });

  document.getElementById('globalSearch')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.value.trim()) {
      location.href = `/pages/itens.html?q=${encodeURIComponent(event.target.value.trim())}`;
    }
  });

  onIdle(() => {
    API.get('/health')
      .then((health) => {
        if (health.database?.empty) {
          toast(`O projeto Supabase ${health.database.projectRef} est\u00e1 conectado, mas sem dados. Confira se \u00e9 o mesmo projeto aberto no painel.`, 'error');
        }
      })
      .catch((error) => toast(error.message, 'error'));
  }, 1200);

  API.get('/auth/me')
    .then((user) => {
      document.querySelectorAll('.sidebar-user strong, .user-chip strong').forEach((el) => { el.textContent = user.nome; });
      document.querySelectorAll('.sidebar-user small, .user-chip small').forEach((el) => { el.textContent = user.email; });
      const initials = user.nome.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      document.querySelectorAll('.avatar').forEach((el) => { el.textContent = initials || 'US'; });
      if (document.body.dataset.page === 'dashboard') {
        const greeting = document.querySelector('.hero-panel .page-title');
        if (greeting) greeting.textContent = `Ol\u00e1, ${user.nome.split(/\s+/)[0]}!`;
      }
    })
    .catch(() => location.replace('/login.html'));

  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const notificationButton = topActions.querySelector('.icon-btn');
    if (notificationButton) {
      notificationButton.type = 'button';
      notificationButton.classList.add('notification-btn');
      notificationButton.title = 'Notifica\u00e7\u00f5es de estoque';
      notificationButton.setAttribute('aria-label', 'Abrir notifica\u00e7\u00f5es');
      notificationButton.setAttribute('aria-expanded', 'false');

      const panel = document.createElement('div');
      panel.className = 'notification-panel';
      panel.hidden = true;
      panel.innerHTML = '<div class="notification-head"><div><strong>Notifica\u00e7\u00f5es</strong><small>Alertas do estoque</small></div></div><div class="notification-list"><div class="notification-empty">Carregando...</div></div>';
      topActions.appendChild(panel);

      const loadNotifications = async () => {
        const list = panel.querySelector('.notification-list');
        try {
          const items = await API.get('/dashboard/estoque-baixo');
          const dot = notificationButton.querySelector('.dot');
          if (items.length) {
            dot.textContent = items.length > 9 ? '9+' : String(items.length);
            dot.classList.add('notification-count');
          } else {
            dot.textContent = '';
            dot.classList.remove('notification-count');
          }
          list.innerHTML = items.map((item) => `<a class="notification-item" href="/pages/item.html?sku=${encodeURIComponent(item.sku)}">${itemThumb(item.imagem_url, item.nome, 'notification-photo')}<span><strong>${esc(item.nome)}</strong><small>${esc(item.sku)} - ${item.quantidade} un. dispon\u00edveis (m\u00ednimo ${item.estoque_minimo})</small></span></a>`).join('') || '<div class="notification-empty">Tudo certo! Nenhum item com estoque baixo.</div>';
        } catch (error) {
          list.innerHTML = `<div class="notification-empty danger-text">${esc(error.message)}</div>`;
        }
      };

      notificationButton.addEventListener('click', (event) => {
        event.stopPropagation();
        panel.hidden = !panel.hidden;
        notificationButton.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) loadNotifications();
      });
      panel.addEventListener('click', (event) => event.stopPropagation());
      document.addEventListener('click', () => {
        panel.hidden = true;
        notificationButton.setAttribute('aria-expanded', 'false');
      });
      onIdle(loadNotifications, 1800);
    }

    const themeButton = document.createElement('button');
    themeButton.className = 'icon-btn theme-toggle';
    themeButton.type = 'button';
    const renderThemeButton = () => {
      themeButton.title = currentTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';
      themeButton.setAttribute('aria-label', themeButton.title);
      themeButton.innerHTML = `<i data-lucide="${currentTheme === 'dark' ? 'sun' : 'moon'}"></i>`;
      window.lucide?.createIcons();
    };
    themeButton.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.dataset.theme = currentTheme;
      localStorage.setItem('almox_theme', currentTheme);
      renderThemeButton();
    });
    topActions.appendChild(themeButton);
    renderThemeButton();

    const logout = document.createElement('button');
    logout.className = 'icon-btn logout-btn';
    logout.type = 'button';
    logout.title = 'Sair do sistema';
    logout.setAttribute('aria-label', 'Sair do sistema');
    logout.innerHTML = '<i data-lucide="log-out"></i>';
    logout.addEventListener('click', async () => {
      await API.post('/auth/logout', {});
      location.replace('/login.html');
    });
    topActions.appendChild(logout);
    window.lucide?.createIcons();
  }
});

function toast(message, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${type === 'error' ? 'error' : ''}`;
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function itemInitials(name = '') {
  const parts = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] || 'I') + (parts[1]?.[0] || 'T');
}

function itemThumbFallback(label = 'IT', className = 'item-thumb') {
  const element = document.createElement('span');
  element.className = `${className} item-thumb-empty`;
  element.textContent = label || 'IT';
  element.setAttribute('aria-label', 'Item sem foto');
  return element;
}

function itemThumb(url, name = '', className = 'item-thumb') {
  const initials = esc(itemInitials(name).toUpperCase());
  if (url) {
    return `<img class="${esc(className)}" src="${esc(url)}" alt="Foto de ${esc(name)}" loading="lazy" decoding="async" data-fallback="${initials}" onerror="this.replaceWith(window.itemThumbFallback(this.dataset.fallback,this.className))">`;
  }
  return `<span class="${esc(className)} item-thumb-empty" aria-label="Item sem foto">${initials}</span>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

window.toast = toast;
window.esc = esc;
window.itemThumb = itemThumb;
window.itemThumbFallback = itemThumbFallback;
window.formatDate = formatDate;
