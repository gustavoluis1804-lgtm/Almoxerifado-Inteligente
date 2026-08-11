const imageStyles = document.createElement('link'); imageStyles.rel = 'stylesheet'; imageStyles.href = '/css/images.css'; document.head.appendChild(imageStyles);
const themeStyles = document.createElement('link'); themeStyles.rel = 'stylesheet'; themeStyles.href = '/css/theme.css'; document.head.appendChild(themeStyles);
const themeFixes = document.createElement('link'); themeFixes.rel = 'stylesheet'; themeFixes.href = '/css/theme-fixes.css'; document.head.appendChild(themeFixes);
let currentTheme = localStorage.getItem('almox_theme') || 'dark'; document.body.dataset.theme = currentTheme;
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const page = document.body.dataset.page;
  document.querySelector(`[data-nav="${page}"]`)?.classList.add('active');
  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuBtn')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.addEventListener('click', (e) => { if (innerWidth < 760 && sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('#menuBtn')) sidebar.classList.remove('open'); });
  document.getElementById('globalSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) location.href = `/pages/itens.html?q=${encodeURIComponent(e.target.value.trim())}`; });
  API.get('/health').then((health) => {
    if (health.database?.empty) {
      toast(`O projeto Supabase ${health.database.projectRef} está conectado, mas sem dados. Confira se é o mesmo projeto aberto no painel.`, 'error');
    }
  }).catch((error) => toast(error.message, 'error'));
  API.get('/auth/me').then((user) => {
    document.querySelectorAll('.sidebar-user strong, .user-chip strong').forEach((el) => { el.textContent = user.nome; });
    document.querySelectorAll('.sidebar-user small, .user-chip small').forEach((el) => { el.textContent = user.email; });
    const initials = user.nome.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    document.querySelectorAll('.avatar').forEach((el) => { el.textContent = initials || 'US'; });
    if (document.body.dataset.page === 'dashboard') {
      const greeting = document.querySelector('.hero-panel .page-title');
      if (greeting) greeting.textContent = `Olá, ${user.nome.split(/\s+/)[0]}! 👋`;
    }
  }).catch(() => location.replace('/login.html'));
  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const notificationButton = topActions.querySelector('.icon-btn');
    if (notificationButton) {
      notificationButton.type = 'button';
      notificationButton.classList.add('notification-btn');
      notificationButton.title = 'Notificações de estoque';
      notificationButton.setAttribute('aria-label', 'Abrir notificações');
      notificationButton.setAttribute('aria-expanded', 'false');
      const panel = document.createElement('div');
      panel.className = 'notification-panel';
      panel.hidden = true;
      panel.innerHTML = '<div class="notification-head"><div><strong>Notificações</strong><small>Alertas do estoque</small></div></div><div class="notification-list"><div class="notification-empty">Carregando...</div></div>';
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
          list.innerHTML = items.map((item) => `<a class="notification-item" href="/pages/item.html?sku=${encodeURIComponent(item.sku)}">${itemThumb(item.imagem_url,item.nome,'notification-photo')}<span><strong>${esc(item.nome)}</strong><small>${esc(item.sku)} · ${item.quantidade} un. disponíveis (mínimo ${item.estoque_minimo})</small></span></a>`).join('') || '<div class="notification-empty">Tudo certo! Nenhum item com estoque baixo.</div>';
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
      loadNotifications();
    }
    const themeButton = document.createElement('button');
    themeButton.className = 'icon-btn theme-toggle'; themeButton.type = 'button';
    const renderThemeButton = () => { themeButton.title = currentTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'; themeButton.setAttribute('aria-label', themeButton.title); themeButton.innerHTML = `<i data-lucide="${currentTheme === 'dark' ? 'sun' : 'moon'}"></i>`; lucide.createIcons(); };
    themeButton.addEventListener('click', () => { currentTheme = currentTheme === 'dark' ? 'light' : 'dark'; document.body.dataset.theme = currentTheme; localStorage.setItem('almox_theme', currentTheme); renderThemeButton(); });
    topActions.appendChild(themeButton); renderThemeButton();
    const logout = document.createElement('button');
    logout.className = 'icon-btn logout-btn';
    logout.type = 'button';
    logout.title = 'Sair do sistema';
    logout.setAttribute('aria-label', 'Sair do sistema');
    logout.innerHTML = '<i data-lucide="log-out"></i>';
    logout.addEventListener('click', async () => { await API.post('/auth/logout', {}); location.replace('/login.html'); });
    topActions.appendChild(logout);
    lucide.createIcons();
  }
});
function toast(message, type='ok') { const el=document.getElementById('toast'); if(!el)return; el.textContent=message; el.className=`toast show ${type==='error'?'error':''}`; clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.className='toast',3200); }
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function itemThumb(url,name='',className='item-thumb'){return url?`<img class="${className}" src="${esc(url)}" alt="Foto de ${esc(name)}" loading="lazy">`:`<span class="${className} item-thumb-empty" aria-label="Item sem foto">📦</span>`;}
function formatDate(v){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}
window.toast=toast;window.esc=esc;window.itemThumb=itemThumb;window.formatDate=formatDate;
