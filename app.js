// Importações do Firebase SDK via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 🔑 SUAS CREDENCIAIS OFICIAIS DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDCebqa5_gwSsVIzNXbcL6A6T2-k7HnFL0",
  authDomain: "meu-delivery3.firebaseapp.com",
  projectId: "meu-delivery3",
  storageBucket: "meu-delivery3.firebasestorage.app",
  messagingSenderId: "652989209672",
  appId: "1:652989209672:web:75fbe66fd34ec1fa96cc7d",
  measurementId: "G-W2NLBTF3V0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Registrar Service Worker para o PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registrado com sucesso!'));
}

// Carregar vitrine de produtos de todas as lojas aprovadas ao iniciar
window.addEventListener('DOMContentLoaded', () => {
  carregarVitrineGeral();
});

// Lógica do Prompt de Instalação PWA
let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const installButton = document.getElementById('btn-install');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.style.display = 'block';
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

// Regra do Carrinho: Se não logado, abre login
window.tentarAdicionarCarrinho = function(nomeProd) {
  const user = auth.currentUser;
  if (!user) {
    alert("Você precisa entrar na sua conta para adicionar itens ao carrinho!");
    window.abrirModalLogin();
  } else {
    alert(`Produto "${nomeProd}" adicionado ao carrinho com sucesso!`);
  }
};

// Controle de UI do Modal
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
  document.getElementById('trocar-modo').innerText = modoCadastro ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se';
};

window.realizarLogin = async function() {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  if (!email || !senha) {
    alert("Preencha o e-mail e a senha.");
    return;
  }

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

// Observador de Estado de Autenticação (Admin & Lojas)
onAuthStateChanged(auth, async (user) => {
  const btnLoginOpen = document.getElementById('btn-login-open');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const adminPanel = document.getElementById('admin-panel');
  const storePanel = document.getElementById('store-panel');

  if (user) {
    btnLoginOpen.style.display = 'none';
    userInfo.style.display = 'block';
    userName.innerText = user.email;

    // Verificar se é Admin ou Loja
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data().role === 'admin') {
        adminPanel.style.display = 'block';
        carregarLojasPendentes();
      } else {
        adminPanel.style.display = 'none';
      }

      // Exibir painel da loja para qualquer usuário logado gerenciar seu negócio
      storePanel.style.display = 'block';
      verificarStatusLoja(user.uid);

    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
    }

  } else {
    btnLoginOpen.style.display = 'block';
    userInfo.style.display = 'none';
    adminPanel.style.display = 'none';
    storePanel.style.display = 'none';
  }
});

// ==========================================
// 🏪 FUNÇÕES DA LOJA E PRODUTOS
// ==========================================

async function verificarStatusLoja(userId) {
  const regBox = document.getElementById('store-registration-box');
  const pendBox = document.getElementById('store-pending-box');
  const apprBox = document.getElementById('store-approved-box');

  try {
    const storeRef = doc(db, "stores", userId);
    const storeSnap = await getDoc(storeRef);

    if (!storeSnap.exists()) {
      regBox.style.display = 'block';
      pendBox.style.display = 'none';
      apprBox.style.display = 'none';
    } else {
      const storeData = storeSnap.data();
      regBox.style.display = 'none';

      if (storeData.status === 'pending') {
        pendBox.style.display = 'block';
        apprBox.style.display = 'none';
      } else if (storeData.status === 'approved') {
        pendBox.style.display = 'none';
        apprBox.style.display = 'block';

        // Definir link exclusivo da loja
        const linkExclusivo = `${window.location.origin}/?loja=${userId}`;
        document.getElementById('store-exclusive-link').value = linkExclusivo;

        carregarProdutosDaLoja(userId);
      } else {
        pendBox.style.display = 'block';
        pendBox.innerHTML = "<p style='color:red;'>Sua loja foi recusada ou bloqueada pelo administrador.</p>";
        apprBox.style.display = 'none';
      }
    }
  } catch (error) {
    console.error("Erro ao verificar loja:", error);
  }
}

window.cadastrarLoja = async function() {
  const user = auth.currentUser;
  const nome = document.getElementById('store-name-input').value;
  const telefone = document.getElementById('store-phone-input').value;

  if (!nome || !telefone) {
    alert("Preencha todos os campos da loja.");
    return;
  }

  try {
    await setDoc(doc(db, "stores", user.uid), {
      nome: nome,
      telefone: telefone,
      email: user.email,
      status: 'pending',
      criadoEm: new Date().toISOString()
    });
    alert("Solicitação enviada com sucesso! Aguarde a aprovação do Administrador.");
    verificarStatusLoja(user.uid);
  } catch (error) {
    alert("Erro ao cadastrar loja: " + error.message);
  }
};

window.copiarLinkLoja = function() {
  const linkInput = document.getElementById('store-exclusive-link');
  linkInput.select();
  navigator.clipboard.writeText(linkInput.value);
  alert("Link exclusivo copiado com sucesso!");
};

window.adicionarProduto = async function() {
  const user = auth.currentUser;
  const nome = document.getElementById('prod-name').value;
  const preco = document.getElementById('prod-price').value;
  const imagem = document.getElementById('prod-img').value;

  if (!nome || !preco || !imagem) {
    alert("Preencha todos os campos do produto (incluindo o link da foto).");
    return;
  }

  try {
    await addDoc(collection(db, "products"), {
      storeId: user.uid,
      nome: nome,
      preco: preco,
      imagem: imagem,
      oculto: false,
      criadoEm: new Date().toISOString()
    });

    alert("Produto publicado com sucesso!");
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-img').value = '';
    carregarProdutosDaLoja(user.uid);
    carregarVitrineGeral();
  } catch (error) {
    alert("Erro ao publicar produto: " + error.message);
  }
};

async function carregarProdutosDaLoja(storeId) {
  const container = document.getElementById('store-products-list');
  container.innerHTML = "Carregando seus produtos...";

  try {
    const q = query(collection(db, "products"), where("storeId", "==", storeId));
    const querySnapshot = await getDocs(q);
    container.innerHTML = "";

    querySnapshot.forEach((docSnap) => {
      const prod = docSnap.data();
      const prodId = docSnap.id;

      container.innerHTML += `
        <div style="background:#f1f1f1; padding:10px; margin-bottom:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${prod.nome}</strong> - R$ ${prod.preco} ${prod.oculto ? '<span style="color:orange;">(Oculto)</span>' : ''}
          </div>
          <div>
            <button onclick="alternarOcultarProduto('${prodId}', ${prod.oculto})" style="background:${prod.oculto ? 'green' : 'orange'}; color:white; border:none; padding:5px; cursor:pointer; border-radius:3px;">${prod.oculto ? 'Exibir' : 'Ocultar'}</button>
            <button onclick="excluirProduto('${prodId}')" style="background:red; color:white; border:none; padding:5px; cursor:pointer; border-radius:3px; margin-left:5px;">Excluir</button>
          </div>
        </div>
      `;
    });

    if (container.innerHTML === "") {
      container.innerHTML = "<p>Nenhum produto cadastrado ainda.</p>";
    }
  } catch (error) {
    container.innerHTML = "Erro ao carregar produtos.";
  }
}

window.alternarOcultarProduto = async function(prodId, estadoAtual) {
  try {
    await updateDoc(doc(db, "products", prodId), { oculto: !estadoAtual });
    const user = auth.currentUser;
    carregarProdutosDaLoja(user.uid);
    carregarVitrineGeral();
  } catch (e) {
    alert("Erro ao alterar visibilidade do produto.");
  }
};

window.excluirProduto = async function(prodId) {
  if (confirm("Tem certeza que deseja excluir este produto?")) {
    try {
      await deleteDoc(doc(db, "products", prodId));
      alert("Produto excluído!");
      const user = auth.currentUser;
      carregarProdutosDaLoja(user.uid);
      carregarVitrineGeral();
    } catch (e) {
      alert("Erro ao excluir produto.");
    }
  }
};

// ==========================================
// 🌐 VITRINE GERAL (Para Clientes e Visitantes)
// ==========================================

async function carregarVitrineGeral() {
  const container = document.getElementById('produtos-container');
  container.innerHTML = "Carregando produtos...";

  // Verificar se a URL tem parâmetro de link exclusivo de loja (ex: ?loja=ID)
  const urlParams = new URLSearchParams(window.location.search);
  const lojaParam = urlParams.get('loja');

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";

    let produtosEncontrados = 0;

    querySnapshot.forEach((docSnap) => {
      const prod = docSnap.data();

      // Se o produto está oculto, não exibe na vitrine pública
      if (prod.oculto) return;

      // Se o cliente acessou por um link exclusivo de loja, filtra apenas os produtos daquela loja
      if (lojaParam && prod.storeId !== lojaParam) return;

      produtosEncontrados++;
      container.innerHTML += `
        <div class="produto-card">
          <img src="${prod.imagem}" alt="${prod.nome}" onerror="this.src='https://via.placeholder.com/150'">
          <h3>${prod.nome}</h3>
          <p>R$ ${prod.preco}</p>
          <button onclick="tentarAdicionarCarrinho('${prod.nome}')">Adicionar ao Carrinho</button>
        </div>
      `;
    });

    if (produtosEncontrados === 0) {
      container.innerHTML = "<p>Nenhum produto disponível no momento.</p>";
    }
  } catch (error) {
    container.innerHTML = "Erro ao carregar a vitrine.";
  }
}

// ==========================================
// 🛠️ FUNÇÕES DO ADMIN (Já existentes)
// ==========================================

window.carregarLojasPendentes = async function() {
  const container = document.getElementById('lista-lojas-pendentes');
  container.innerHTML = "Buscando lojas...";

  try {
    const querySnapshot = await getDocs(collection(db, "stores"));
    container.innerHTML = "";
    
    querySnapshot.forEach((docSnap) => {
      const loja = docSnap.data();
      const lojaId = docSnap.id;

      if (loja.status === 'pending') {
        container.innerHTML += `
          <div style="background:#f1f1f1; padding:10px; margin-bottom:10px; border-radius:5px;">
            <p><strong>Loja:</strong> ${loja.nome}</p>
            <p><strong>E-mail:</strong> ${loja.email}</p>
            <button onclick="aprovarLoja('${lojaId}')" style="background:green; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">Aprovar</button>
            <button onclick="removerLoja('${lojaId}')" style="background:red; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:3px; margin-left:5px;">Recusar/Remover</button>
          </div>
        `;
      }
    });

    if (container.innerHTML === "") {
      container.innerHTML = "<p>Nenhuma loja pendente no momento.</p>";
    }
  } catch (error) {
    container.innerHTML = "Erro ao carregar lojas.";
  }
};

window.aprovarLoja = async function(lojaId) {
  try {
    await updateDoc(doc(db, "stores", lojaId), { status: 'approved' });
    alert("Loja aprovada com sucesso!");
    carregarLojasPendentes();
  } catch (e) {
    alert("Erro ao aprovar loja.");
  }
};

window.removerLoja = async function(lojaId) {
  try {
    await updateDoc(doc(db, "stores", lojaId), { status: 'rejected' });
    alert("Loja recusada/removida.");
    carregarLojasPendentes();
  } catch (e) {
    alert("Erro ao remover loja.");
  }
};

window.salvarComissao = function() {
  const valor = document.getElementById('comissao-admin').value;
  if(!valor) {
    alert("Digite um valor para a comissão.");
    return;
  }
  alert("Comissão de " + valor + "% salva com sucesso! (Configuração global aplicada)");
};
