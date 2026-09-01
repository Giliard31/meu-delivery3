// Importe o Firebase da CDN (substitua com suas credenciais do projeto Firebase)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuração do seu Firebase (Pegue no painel do Firebase)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Registrar Service Worker para o PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registrado com sucesso!'));
}

// Lógica do Prompt de Instalação PWA
let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const installButton = document.getElementById('btn-install');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.style.display = 'block'; // Mostra o banner pedindo para instalar
});

installButton.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('Usuário aceitou instalar o PWA');
    }
    deferredPrompt = null;
    installBanner.style.display = 'none';
  }
});

// Controle de Interação com o Carrinho (Regra: se não logado, abre login)
window.tentarAdicionarCarrinho = function() {
  const user = auth.currentUser;
  if (!user) {
    alert("Você precisa entrar na sua conta para adicionar itens ao carrinho!");
    window.abrirModalLogin();
  } else {
    alert("Produto adicionado ao carrinho com sucesso!");
  }
};

// Funções globais de UI do Modal
let modoCadastro = false;

window.abrirModalLogin = function() {
  document.getElementById('auth-modal').style.display = 'flex';
};

window.fecharModalLogin = function() {
  document.getElementById('auth-modal').style.display = 'none';
};

window.alternarModoCadastro = function() {
  modoCadastro = !modoCadastro;
  document.getElementById('modal-title').innerText = modoCadastro ? 'Criar Conta' : 'Entrar';
  document.getElementById('btn-acao-auth').innerText = modoCadastro ? 'Cadastrar' : 'Entrar';
  document.getElementById('trocar-modo').innerText = modoCadastro ? 'Já tem conta? Faça login' : 'Não tiene conta? Cadastre-se';
};

window.realizarLogin = async function() {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  try {
    if (modoCadastro) {
      await createUserWithEmailAndPassword(auth, email, senha);
      alert("Conta criada com sucesso!");
    } else {
      await signInWithEmailAndPassword(auth, email, senha);
      alert("Login realizado com sucesso!");
    }
    window.fecharModalLogin();
  } catch (error) {
    alert("Erro: " + error.message);
  }
};

window.fazerLogout = function() {
  signOut(auth).then(() => {
    alert("Você saiu da conta.");
  });
};

// Observador de Estado de Autenticação (Muda o topo automaticamente)
onAuthStateChanged(auth, (user) => {
  const btnLoginOpen = document.getElementById('btn-login-open');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');

  if (user) {
    btnLoginOpen.style.display = 'none';
    userInfo.style.display = 'block';
    userName.innerText = user.email;
  } else {
    btnLoginOpen.style.display = 'block';
    userInfo.style.display = 'none';
  }
});
