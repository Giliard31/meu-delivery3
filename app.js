import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Estado local do Carrinho de Compras
let carrinho = [];

// Service Worker PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registrado com sucesso!'));
}

window.addEventListener('DOMContentLoaded', () => {
  carregarVitrineGeral();
  atualizarCarrinhoUI();
});

// Lógica PWA Prompt
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
    if (outcome === 'accepted') console.log('PWA instalado');
    deferredPrompt = null;
    installBanner.style.display = 'none';
  }
});

// ==========================================
// 🛒 LÓGICA DO CARRINHO E INTERAÇÃO DO CLIENTE
// ==========================================

window.adicionarAoCarrinho = function(id, nome, preco, storeId) {
  const user = auth.currentUser;
  if (!user) {
    alert("Você precisa entrar na sua conta para adicionar itens ao carrinho!");
    window.abrirModalLogin();
    return;
  }

  const precoNum = parseFloat(preco);
  const itemExistente = carrinho.find(item => item.id === id);

  if (itemExistente) {
    itemExistente.qtd += 1;
  } else {
    carrinho.push({ id, nome, preco: precoNum, qtd: 1, storeId });
  }

  atualizarCarrinhoUI();
  alert(`"${nome}" adicionado ao carrinho!`);
};

function atualizarCarrinhoUI() {
  const container = document.getElementById('carrinho-itens');
  const totalContainer = document.getElementById('carrinho-total');

  if (carrinho.length === 0) {
    container.innerHTML = "<p>Seu carrinho está vazio.</p>";
    totalContainer.innerText = "Total: R$ 0,00";
    return;
  }

  container.innerHTML = "";
  let total = 0;

  carrinho.forEach((item, index) => {
    let subtotal = item.preco * item.qtd;
    total += subtotal;
    container.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
        <span>${item.nome} (${item.qtd}x) - R$ ${subtotal.toFixed(2)}</span>
        <button onclick="removerDoCarrinho(${index})" style="background:red; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">X</button>
      </div>
    `;
  });

  totalContainer.innerText = `Total: R$ ${total.toFixed(2)}`;
}

window.removerDoCarrinho = function(index) {
  carrinho.splice(index, 1);
  atualizarCarrinhoUI();
};

window.finalizarPedido = async function() {
  const user = auth.currentUser;
  if (!user) {
    alert("Faça login para finalizar o pedido.");
    window.abrirModalLogin();
    return;
  }

  if (carrinho.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  // Verificar se o cliente preencheu o perfil/endereço
  try {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists() || !userSnap.data().rua || !userSnap.data().telefone) {
      alert("Por favor, preencha seus dados de endereço e telefone no seu Perfil antes de finalizar o pedido!");
      window.abrirPerfilCliente();
      return;
    }

    const dadosCliente = userSnap.data();

    // Salvar o pedido no Firestore
    await addDoc(collection(db, "orders"), {
      clientId: user.uid,
      clientName: dadosCliente.nome || user.email,
      clientPhone: dadosCliente.telefone,
      clientAddress: `${dadosCliente.rua}, ${dadosCliente.bairro}`,
      items: carrinho,
      status: 'pendente',
      criadoEm: new Date().toISOString()
    });

    alert("Pedido finalizado com sucesso! Enviado para a loja.");
    carrinho = [];
    atualizarCarrinhoUI();

    // Solicitar avaliação da loja após o pedido concluído
    setTimeout(() => {
      let nota = prompt("Deseja avaliar a loja de 1 a 5 estrelas?");
      if (nota) {
        alert("Obrigado pela sua avaliação!");
      }
    }, 1000);

  } catch (error) {
    alert("Erro ao finalizar pedido: " + error.message);
  }
};

// ==========================================
// 👤 PERFIL E ENDEREÇO DO CLIENTE
// ==========================================

window.abrirPerfilCliente = async function() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      document.getElementById('cli-nome').value = data.nome || '';
      document.getElementById('cli-tel').value = data.telefone || '';
      document.getElementById('cli-bairro').value = data.bairro || '';
      document.getElementById('cli-rua').value = data.rua || '';
    }
  } catch (e) {
    console.error("Erro ao carregar perfil", e);
  }

  document.getElementById('profile-modal').style.display = 'flex';
};

window.fecharPerfilCliente = function() {
  document.getElementById('profile-modal').style.display = 'none';
};

window.salvarPerfilCliente = async function() {
  const user = auth.currentUser;
  const nome = document.getElementById('cli-nome').value;
  const telefone = document.getElementById('cli-tel').value;
  const bairro = document.getElementById('cli-bairro').value;
  const rua = document.getElementById('cli-rua').value;

  if (!nome || !telefone || !bairro || !rua) {
    alert("Preencha todos os campos do endereço e telefone.");
    return;
  }

  try {
    // Mantém a role anterior (se for admin ou loja) ou define como cliente
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    let roleAtual = "client";
    if (userSnap.exists() && userSnap.data().role) {
      roleAtual = userSnap.data().role;
    }

    await setDoc(userDocRef, {
      email: user.email,
      role: roleAtual,
      nome,
      telefone,
      bairro,
      rua
    }, { merge: true });

    alert("Dados de perfil salvos com sucesso!");
    window.fecharPerfilCliente();
  } catch (error) {
    alert("Erro ao salvar perfil: " + error.message);
  }
};

// ==========================================
// 🔐 AUTENTICAÇÃO E MODAIS
// ==========================================

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
      alert("Conta criada com sucesso! Complete seus dados no menu 'Meu Perfil'.");
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

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data().role === 'admin') {
        adminPanel.style.display = 'block';
        carregarLojasPendentes();
      } else {
        adminPanel.style.display = 'none';
      }

      storePanel.style.display = 'block';
      verificarStatusLoja(user.uid);
    } catch (e) {
      console.error(e);
    }

  } else {
    btnLoginOpen.style.display = 'block';
    userInfo.style.display = 'none';
    adminPanel.style.display = 'none';
    storePanel.style.display = 'none';
  }
});

// ==========================================
// 🏪 LOJAS E VITRINE GERAL
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

        const linkExclusivo = `${window.location.origin}/?loja=${userId}`;
        document.getElementById('store-exclusive-link').value = linkExclusivo;

        carregarProdutosDaLoja(userId);
      } else {
        pendBox.style.display = 'block';
        pendBox.innerHTML = "<p style='color:red;'>Sua loja foi recusada ou bloqueada.</p>";
        apprBox.style.display = 'none';
      }
    }
  } catch (error) {
    console.error(error);
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
      nome, telefone, email: user.email, status: 'pending', criadoEm: new Date().toISOString()
    });
    alert("Solicitação enviada! Aguarde a aprovação do Administrador.");
    verificarStatusLoja(user.uid);
  } catch (error) {
    alert("Erro: " + error.message);
  }
};

window.copiarLinkLoja = function() {
  const linkInput = document.getElementById('store-exclusive-link');
  linkInput.select();
  navigator.clipboard.writeText(linkInput.value);
  alert("Link copiado com sucesso!");
};

window.adicionarProduto = async function() {
  const user = auth.currentUser;
  const nome = document.getElementById('prod-name').value;
  const preco = document.getElementById('prod-price').value;
  const imagem = document.getElementById('prod-img').value;

  if (!nome || !preco || !imagem) {
    alert("Preencha todos os campos do produto.");
    return;
  }

  try {
    await addDoc(collection(db, "products"), {
      storeId: user.uid, nome, preco, imagem, oculto: false, criadoEm: new Date().toISOString()
    });

    alert("Produto publicado!");
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-img').value = '';
    carregarProdutosDaLoja(user.uid);
    carregarVitrineGeral();
  } catch (error) {
    alert("Erro: " + error.message);
  }
};

async function carregarProdutosDaLoja(storeId) {
  const container = document.getElementById('store-products-list');
  container.innerHTML = "Carregando...";

  try {
    const q = query(collection(db, "products"), where("storeId", "==", storeId));
    const querySnapshot = await getDocs(q);
    container.innerHTML = "";

    querySnapshot.forEach((docSnap) => {
      const prod = docSnap.data();
      const prodId = docSnap.id;

      container.innerHTML += `
        <div style="background:#f1f1f1; padding:10px; margin-bottom:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
          <div><strong>${prod.nome}</strong> - R$ ${prod.preco} ${prod.oculto ? '<span style="color:orange;">(Oculto)</span>' : ''}</div>
          <div>
            <button onclick="alternarOcultarProduto('${prodId}', ${prod.oculto})" style="background:${prod.oculto ? 'green' : 'orange'}; color:white; border:none; padding:5px; cursor:pointer; border-radius:3px;">${prod.oculto ? 'Exibir' : 'Ocultar'}</button>
            <button onclick="excluirProduto('${prodId}')" style="background:red; color:white; border:none; padding:5px; cursor:pointer; border-radius:3px; margin-left:5px;">Excluir</button>
          </div>
        </div>
      `;
    });

    if (container.innerHTML === "") container.innerHTML = "<p>Nenhum produto cadastrado.</p>";
  } catch (e) {
    container.innerHTML = "Erro ao carregar produtos.";
  }
}

window.alternarOcultarProduto = async function(prodId, estadoAtual) {
  try {
    await updateDoc(doc(db, "products", prodId), { oculto: !estadoAtual });
    carregarProdutosDaLoja(auth.currentUser.uid);
    carregarVitrineGeral();
  } catch (e) { alert("Erro."); }
};

window.excluirProduto = async function(prodId) {
  if (confirm("Excluir este produto?")) {
    try {
      await deleteDoc(doc(db, "products", prodId));
      alert("Excluído!");
      carregarProdutosDaLoja(auth.currentUser.uid);
      carregarVitrineGeral();
    } catch (e) { alert("Erro."); }
  }
};

async function carregarVitrineGeral() {
  const container = document.getElementById('produtos-container');
  container.innerHTML = "Carregando vitrine...";

  const urlParams = new URLSearchParams(window.location.search);
  const lojaParam = urlParams.get('loja');

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    let count = 0;

    querySnapshot.forEach((docSnap) => {
      const prod = docSnap.data();
      const prodId = docSnap.id;

      if (prod.oculto) return;
      if (lojaParam && prod.storeId !== lojaParam) return;

      count++;
      container.innerHTML += `
        <div class="produto-card">
          <img src="${prod.imagem}" alt="${prod.nome}" onerror="this.src='https://via.placeholder.com/150'">
          <h3>${prod.nome}</h3>
          <p>R$ ${prod.preco}</p>
          <button onclick="adicionarAoCarrinho('${prodId}', '${prod.nome}', '${prod.preco}', '${prod.storeId}')">Adicionar ao Carrinho</button>
        </div>
      `;
    });

    if (count === 0) container.innerHTML = "<p>Nenhum produto disponível.</p>";
  } catch (e) {
    container.innerHTML = "Erro ao carregar vitrine.";
  }
}

// Admin
window.carregarLojasPendentes = async function() {
  const container = document.getElementById('lista-lojas-pendentes');
  container.innerHTML = "Carregando...";
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
            <button onclick="aprovarLoja('${lojaId}')" style="background:green; color:white; border:none; padding:5px 10px; cursor:pointer;">Aprovar</button>
            <button onclick="removerLoja('${lojaId}')" style="background:red; color:white; border:none; padding:5px 10px; cursor:pointer; margin-left:5px;">Recusar</button>
          </div>
        `;
      }
    });
    if (container.innerHTML === "") container.innerHTML = "<p>Nenhuma loja pendente.</p>";
  } catch (e) { container.innerHTML = "Erro."; }
};

window.aprovarLoja = async function(lojaId) {
  await updateDoc(doc(db, "stores", lojaId), { status: 'approved' });
  alert("Loja aprovada!");
  carregarLojasPendentes();
};

window.removerLoja = async function(lojaId) {
  await updateDoc(doc(db, "stores", lojaId), { status: 'rejected' });
  alert("Loja recusada.");
  carregarLojasPendentes();
};

window.salvarComissao = function() {
  const valor = document.getElementById('comissao-admin').value;
  if(!valor) return alert("Digite o valor.");
  alert("Comissão de " + valor + "% salva!");
};
