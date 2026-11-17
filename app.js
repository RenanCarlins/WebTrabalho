'use strict';

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);

const CATEGORIAS = ['Hortifruti', 'Padaria', 'Laticínios', 'Bebidas', 'Mercearia', 'Limpeza'];
const STATUS = ['Pendente', 'Pago', 'Cancelado'];
const ROTAS = ['painel', 'caixa', 'produtos', 'clientes', 'pedidos'];
const ESTOQUE_BAIXO = 5;

const CHAVES = { 
  produtos: 'caixa_produtos', 
  clientes: 'caixa_clientes', 
  pedidos: 'caixa_pedidos' 
};
//Plata
const dinheiro = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
//BD
const esc = texto => String(texto).replace(/[&<>"']/g, c => ({ 
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
}[c]));
//ID
const novoId = () => Date.now() + Math.floor(Math.random() * 1000);

const soma = (lista, fn) => lista.reduce((total, item) => total + fn(item), 0);
//Desconto
const percentualCombo = categorias => (categorias >= 4 ? 15 : categorias === 3 ? 10 : categorias === 2 ? 5 : 0);

//Status estoque
const badgeEstoque = n =>
  n === 0 ? '<span class="badge text-bg-danger">Esgotado</span>'
  : n <= ESTOQUE_BAIXO ? `<span class="badge text-bg-warning">${n} un. (baixo)</span>`
  : `<span class="badge text-bg-dark">${n} un.</span>`;

//Dados
const SEED_PRODUTOS = [
  ['Banana prata (kg)', 'Hortifruti', 6.99, 40], ['Tomate (kg)', 'Hortifruti', 8.49, 30], ['Alface crespa', 'Hortifruti', 3.99, 4],
  ['Pão francês (kg)', 'Padaria', 14.9, 25], ['Bolo de cenoura', 'Padaria', 12.5, 8],
  ['Leite integral 1L', 'Laticínios', 5.49, 60], ['Queijo mussarela (kg)', 'Laticínios', 44.9, 12], ['Iogurte natural', 'Laticínios', 4.2, 3],
  ['Suco de laranja 1L', 'Bebidas', 7.8, 20], ['Refrigerante cola 2L', 'Bebidas', 9.5, 35],
  ['Arroz 5kg', 'Mercearia', 28.9, 18], ['Feijão preto 1kg', 'Mercearia', 8.9, 22], ['Café torrado 500g', 'Mercearia', 19.9, 0],
  ['Detergente 500ml', 'Limpeza', 2.8, 50], ['Sabão em pó 1kg', 'Limpeza', 12.9, 15],
].map(([nome, categoria, preco, estoque], i) => ({ id: i + 1, nome, categoria, preco, estoque }));

//Dados
const SEED_CLIENTES = [
  { id: 101, nome: 'Maria Souza', cpf: '123.456.789-09', telefone: '(47) 99999-1234', email: 'maria@email.com' },
  { id: 102, nome: 'João Pereira', cpf: '987.654.321-00', telefone: '(47) 98888-4321', email: 'joao@email.com' },
];
//Conferindo
function ler(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
//BDl
const db = {
  produtos: ler(CHAVES.produtos, SEED_PRODUTOS),
  clientes: ler(CHAVES.clientes, SEED_CLIENTES),
  pedidos: ler(CHAVES.pedidos, []),
};

let carrinho = [];

//Salva
function salvar() {
  Object.entries(CHAVES).forEach(([nome, chave]) => localStorage.setItem(chave, JSON.stringify(db[nome])));
}

function toast(mensagem, tipo = 'dark') {
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo} border-0`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(mensagem)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button></div>`;
  $('#toasts').append(el);
  el.addEventListener('hidden.bs.toast', () => el.remove());
  new bootstrap.Toast(el, { delay: 2800 }).show();
}
//Barra
function montarFiltros(el, aoMudar) {
  el.innerHTML = `
    <div class="col-md-4"><input type="search" class="form-control f-busca" placeholder="Buscar produto" aria-label="Buscar produto"></div>
    <div class="col-6 col-md-2"><select class="form-select f-cat" aria-label="Categoria"><option value="">Todas as categorias</option>${CATEGORIAS.map(c => `<option>${c}</option>`).join('')}</select></div>
    <div class="col-6 col-md-3"><select class="form-select f-est" aria-label="Estoque">
      <option value="">Todo o estoque</option><option value="ok">Em estoque</option><option value="baixo">Estoque baixo</option><option value="zero">Esgotado</option></select></div>
    <div class="col-md-3"><select class="form-select f-ord" aria-label="Ordenar por">
      <option value="nome">Nome (A–Z)</option><option value="preco-asc">Menor preço</option><option value="preco-desc">Maior preço</option></select></div>`;
  el.addEventListener('input', aoMudar);
}
//Pesquisa
function filtrar(el) {
  const valor = seletor => $(seletor, el).value;
  const busca = valor('.f-busca').trim().toLowerCase(), cat = valor('.f-cat'), est = valor('.f-est'), ord = valor('.f-ord');
  
  const passaEstoque = p => !est || (est === 'zero' ? p.estoque === 0 : est === 'baixo' ? p.estoque > 0 && p.estoque <= ESTOQUE_BAIXO : p.estoque > 0);
  
  return db.produtos
    .filter(p => p.nome.toLowerCase().includes(busca) && (!cat || p.categoria === cat) && passaEstoque(p))
    .sort((a, b) => (ord === 'preco-asc' ? a.preco - b.preco : ord === 'preco-desc' ? b.preco - a.preco : a.nome.localeCompare(b.nome, 'pt-BR')));
}
//Painel
function renderPainel() {
  const vendas = db.pedidos.filter(p => p.status !== 'Cancelado');
  const faturamento = soma(vendas, p => p.total);
  
  const indicadores = [
    ['Faturamento total', dinheiro(faturamento)],
    ['Vendas realizadas', vendas.length],
    ['Ticket médio', dinheiro(vendas.length ? faturamento / vendas.length : 0)],
    ['Descontos concedidos', dinheiro(soma(vendas, p => p.desconto))],
    ['Clientes cadastrados', db.clientes.length],
    ['Unidades em estoque', soma(db.produtos, p => p.estoque)],
  ];
  
  $('#kpis').innerHTML = indicadores.map(([titulo, valor]) =>
    `<div class="col-6 col-lg-4"><div class="card kpi h-100"><div class="card-body">
      <p class="small text-muted mb-1">${titulo}</p><p class="kpi-valor mb-0">${valor}</p></div></div></div>`).join('');

  //Estoque baixo
  const baixos = db.produtos.filter(p => p.estoque <= ESTOQUE_BAIXO).sort((a, b) => a.estoque - b.estoque);
  $('#reposicao').innerHTML = baixos.length
    ? `<ul class="list-group">${baixos.map(p => `<li class="list-group-item d-flex justify-content-between align-items-center">${esc(p.nome)}${badgeEstoque(p.estoque)}</li>`).join('')}</ul>`
    : '<div class="alert alert-light border">Nenhum produto com estoque baixo.</div>';
}
//Tela do Caixa
function renderCaixa() {
  const lista = filtrar($('#filtros-caixa'));
  $('#grade-caixa').innerHTML = lista.map(p => `
    <div class="col-6 col-md-4 col-xl-3"><article class="card produto h-100"><div class="card-body d-flex flex-column">
      <span class="badge text-bg-light border align-self-start mb-2">${p.categoria}</span>
      <h3 class="h6">${esc(p.nome)}</h3>
      <p class="mt-auto mb-2"><span class="preco">${dinheiro(p.preco)}</span></p>
      <p class="small mb-2">${badgeEstoque(p.estoque)}</p>
      <button type="button" class="btn btn-dark btn-sm" data-acao="mais" data-id="${p.id}" ${p.estoque ? '' : 'disabled'}>Adicionar ao cupom</button>
    </div></article></div>`).join('') || '<p class="text-muted">Nenhum produto encontrado.</p>';
}
//CRUD produtos
function renderProdutos() {
  const lista = filtrar($('#filtros-produtos'));
  $('#tabela-produtos').innerHTML = lista.length ? lista.map(p => `
    <tr><td>${esc(p.nome)}</td><td>${p.categoria}</td><td class="text-end mono">${dinheiro(p.preco)}</td><td class="text-end">${badgeEstoque(p.estoque)}</td>
    <td class="text-end text-nowrap">
      <button type="button" class="btn btn-sm btn-outline-dark" data-acao="editar-produto" data-id="${p.id}">Editar</button>
      <button type="button" class="btn btn-sm btn-outline-danger" data-acao="excluir-produto" data-id="${p.id}">Excluir</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="text-center text-muted py-4">Nenhum produto encontrado. Ajuste os filtros ou cadastre um produto.</td></tr>';
}
//CRUD clientes
function renderClientes() {
  $('#tabela-clientes').innerHTML = db.clientes.length ? db.clientes.map(c => `
    <tr><td>${esc(c.nome)}</td><td class="mono">${esc(c.cpf)}</td><td>${esc(c.telefone)}</td><td>${esc(c.email)}</td>
    <td class="text-end">${db.pedidos.filter(p => p.clienteId === c.id && p.status !== 'Cancelado').length}</td>
    <td class="text-end text-nowrap">
      <button type="button" class="btn btn-sm btn-outline-dark" data-acao="editar-cliente" data-id="${c.id}">Editar</button>
      <button type="button" class="btn btn-sm btn-outline-danger" data-acao="excluir-cliente" data-id="${c.id}">Excluir</button></td></tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum cliente cadastrado. Use o botão Novo cliente.</td></tr>';

  const select = $('#cupom-cliente'), atual = select.value;
  select.innerHTML = '<option value="">Consumidor não identificado</option>' + db.clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  select.value = atual || '';
}
//Status
function renderPedidos() {
  const lista = [...db.pedidos].reverse();
  $('#tabela-pedidos').innerHTML = lista.length ? lista.map(p => `
    <tr><td class="mono">#${p.numero}</td>
    <td>${new Date(p.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
    <td>${esc(p.clienteNome)}</td>
    <td class="small">${p.itens.map(i => `${i.qtd}×${esc(i.nome)}`).join(', ')}</td>
    <td class="text-end mono">${dinheiro(p.total)}${p.pct ? `<br><span class="badge text-bg-warning">−${p.pct}% combo</span>` : ''}</td>
    <td><select class="form-select form-select-sm" data-pedido="${p.id}" aria-label="Status do pedido ${p.numero}" ${p.status === 'Cancelado' ? 'disabled' : ''}>
      ${STATUS.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma venda registrada. Finalize um cupom na tela Caixa.</td></tr>';
}
//Calcula
function calcular() {
  const itens = carrinho.map(i => ({ ...i, p: db.produtos.find(p => p.id === i.id) })).filter(i => i.p);
  const subtotal = Math.round(soma(itens, i => i.p.preco * i.qtd) * 100) / 100;
  const cats = new Set(itens.map(i => i.p.categoria)).size; //Identifica a quantidade de categorias
  const pct = percentualCombo(cats);
  const desconto = Math.round(subtotal * pct) / 100;
  return { itens, subtotal, cats, pct, desconto, total: Math.round((subtotal - desconto) * 100) / 100 };
}
//Mensagem desconto
function textoCombo(c) {
  if (!c.itens.length) return 'Adicione produtos de categorias diferentes para ganhar desconto.';
  if (c.pct >= 15) return 'Combo máximo: 15% de desconto aplicado.';
  return `${c.pct}% aplicado. Inclua mais uma categoria diferente para chegar a ${percentualCombo(c.cats + 1)}%.`;
}
//Atualiza Carrinho
function renderCarrinho() {
  const c = calcular();
  $('#contador-cupom').textContent = soma(c.itens, i => i.qtd);
  $('#itens-cupom').innerHTML = c.itens.length ? c.itens.map(i => `
    <li class="d-flex justify-content-between align-items-center py-2">
      <div class="me-2"><div>${esc(i.p.nome)}</div><small class="text-muted">${dinheiro(i.p.preco)} × ${i.qtd}</small></div>
      <div class="text-nowrap">
        <button type="button" class="btn btn-sm btn-outline-dark" data-acao="menos" data-id="${i.id}" aria-label="Diminuir quantidade">−</button>
        <button type="button" class="btn btn-sm btn-outline-dark" data-acao="mais" data-id="${i.id}" aria-label="Aumentar quantidade">+</button>
        <button type="button" class="btn btn-sm btn-outline-danger" data-acao="remover" data-id="${i.id}" aria-label="Remover item">×</button>
      </div></li>`).join('')
    : '<li class="text-muted py-3">O cupom está vazio. Adicione produtos na tela Caixa.</li>';
  $('#aviso-combo').innerHTML = `<div class="alert alert-warning small">${textoCombo(c)}</div>`;
  $('#resumo-cupom').innerHTML = `
    <div class="d-flex justify-content-between"><span>Subtotal</span><span>${dinheiro(c.subtotal)}</span></div>
    <div class="d-flex justify-content-between"><span>Desconto combo (${c.pct}%)</span><span>− ${dinheiro(c.desconto)}</span></div>
    <div class="d-flex justify-content-between fs-5 fw-bold"><span>Total</span><span>${dinheiro(c.total)}</span></div>`;
  $('#finalizar').disabled = !c.itens.length;
  $('#limpar').disabled = !c.itens.length;
}
//Cupom
function mudarQuantidade(id, delta) {
  const produto = db.produtos.find(p => p.id === id);
  const item = carrinho.find(i => i.id === id);
  const nova = (item?.qtd || 0) + delta;
  if (nova > produto.estoque) return toast(`Estoque insuficiente de ${produto.nome}.`, 'warning');
  if (item) item.qtd = nova; else if (nova > 0) carrinho.push({ id, qtd: nova });
  carrinho = carrinho.filter(i => i.qtd > 0);
  renderCarrinho();
}
//Conclui a venda
function finalizarVenda() {
  const c = calcular();
  if (!c.itens.length) return;
  const semEstoque = c.itens.find(i => i.qtd > i.p.estoque);
  if (semEstoque) return toast(`Estoque insuficiente de ${semEstoque.p.nome}.`, 'danger');

  const cliente = db.clientes.find(x => x.id === Number($('#cupom-cliente').value));
  const numero = Math.max(0, ...db.pedidos.map(p => p.numero)) + 1;
  
  //-+=
  c.itens.forEach(i => { i.p.estoque -= i.qtd; });
  
  //Finalizado
  db.pedidos.push({
    id: novoId(), numero, data: new Date().toISOString(),
    clienteId: cliente?.id ?? null, clienteNome: cliente?.nome ?? 'Consumidor não identificado',
    itens: c.itens.map(i => ({ id: i.id, nome: i.p.nome, categoria: i.p.categoria, preco: i.p.preco, qtd: i.qtd })),
    subtotal: c.subtotal, desconto: c.desconto, pct: c.pct, total: c.total, status: 'Pendente',
  });
  
  carrinho = [];
  salvar();
  renderTudo();
  bootstrap.Offcanvas.getOrCreateInstance('#cupom').hide();
  toast(`Venda #${numero} registrada: ${dinheiro(c.total)}.`, 'success');
}
//Restaura o estoque
function mudarStatus(id, novo) {
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido || pedido.status === 'Cancelado') return;
  
  //Devolve os itens ao estoque
  if (novo === 'Cancelado') {
    pedido.itens.forEach(i => { 
      const p = db.produtos.find(x => x.id === i.id); 
      if (p) p.estoque += i.qtd; 
    });
  }
  
  pedido.status = novo;
  salvar();
  renderTudo();
  toast(`Pedido #${pedido.numero}: ${novo.toLowerCase()}.`, novo === 'Cancelado' ? 'danger' : 'success');
}
//Criação
function abrirFormulario(sufixo, registro, tituloNovo, tituloEdicao) {
  const form = $(`#form-${sufixo}`);
  form.reset();
  form.classList.remove('was-validated');
}