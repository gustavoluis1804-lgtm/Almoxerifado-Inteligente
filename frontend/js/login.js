const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const submitButton = form.querySelector('button[type="submit"]');
let loginTheme = localStorage.getItem('almox_theme') || 'dark'; document.body.dataset.theme = loginTheme;
const loginThemeButton = document.createElement('button'); loginThemeButton.className = 'login-theme-toggle'; loginThemeButton.type = 'button'; document.body.appendChild(loginThemeButton);
function renderLoginTheme(){loginThemeButton.title=loginTheme==='dark'?'Ativar modo claro':'Ativar modo escuro';loginThemeButton.setAttribute('aria-label',loginThemeButton.title);loginThemeButton.innerHTML=`<i data-lucide="${loginTheme==='dark'?'sun':'moon'}"></i>`;lucide.createIcons();}
loginThemeButton.addEventListener('click',()=>{loginTheme=loginTheme==='dark'?'light':'dark';document.body.dataset.theme=loginTheme;localStorage.setItem('almox_theme',loginTheme);renderLoginTheme();});
lucide.createIcons();
renderLoginTheme();

const savedEmail = localStorage.getItem('almox_email');
if (savedEmail) { email.value = savedEmail; rememberMe.checked = true; }

showPassword.addEventListener('click', () => {
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  showPassword.innerHTML = `<i data-lucide="${visible ? 'eye' : 'eye-off'}"></i><b>${visible ? 'Mostrar' : 'Ocultar'}</b>`;
  lucide.createIcons();
});

forgotPassword.addEventListener('click', () => {
  authNotice.textContent = 'Solicite ao administrador a redefinição da sua senha.';
  authNotice.classList.add('show'); setTimeout(() => authNotice.classList.remove('show'), 3500);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault(); errorBox.textContent = ''; submitButton.disabled = true;
  submitButton.innerHTML = '<span>Entrando...</span>';
  try {
    await API.post('/auth/login', { email: email.value, password: password.value });
    if (rememberMe.checked) localStorage.setItem('almox_email', email.value.trim()); else localStorage.removeItem('almox_email');
    location.replace('/');
  } catch (error) { errorBox.textContent = error.message; }
  finally { submitButton.disabled = false; submitButton.innerHTML = '<i data-lucide="lock-keyhole"></i><span>Entrar no sistema</span>'; lucide.createIcons(); }
});
