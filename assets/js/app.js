import {
  salvarOrdemFirestore,
  atualizarOrdemFirestore,
  excluirOrdemFirestore,
  gerarNumeroOS,
  consultarProximoNumeroOS,
  buscarUltimasOrdensFirestore,
  sincronizarContadorOS,
  buscarOrdensPaginadas,
  buscarResumoDashboard,
} from "./firestore.js";

// 🔥 VARIÁVEIS GLOBAIS
let ordens = [];
let materiais = [];
let osAtual = null;

let latitudeSelecionada = null;
let longitudeSelecionada = null;
let mapa = null;
let marcador = null;
let materiaisEncerramento = [];
let ultimaDoc = null;
let carregando = false;

async function carregarMaisOrdens() {
  if (carregando) return;

  carregando = true;

  const resultado = await buscarOrdensPaginadas(ultimaDoc, 20);

  ultimaDoc = resultado.ultimoDocumento;

  const idsExistentes = new Set(ordens.map((o) => o.id));

  const novas = resultado.lista.filter((o) => !idsExistentes.has(o.id));

  ordens = ordens.concat(novas);

  carregarTabelaRelatorios(ordens);

  carregando = false;
}

function extrairNumeroOS(numero) {
  if (!numero) return 0;

  const match = numero.match(/OS\s*(\d+)/);

  return match ? parseInt(match[1]) : 0;
}

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  inicializarSistema();

  carregarAnoMateriais();
  carregarFiltroAno();

  const tipoOS = document.getElementById("tipo-os");
  const campoSetor = document.getElementById("campo-setor-solicitante");
  const inputSetor = document.getElementById("setor-solicitante");

  if (tipoOS) {
    tipoOS.addEventListener("change", () => {
      if (tipoOS.value === "externa") {
        campoSetor.style.visibility = "hidden";
        campoSetor.style.height = "0";
        campoSetor.style.margin = "0";
        inputSetor.required = false;
      } else {
        campoSetor.style.visibility = "visible";
        campoSetor.style.height = "auto";
        inputSetor.required = true;
      }
    });
  }
});

function iniciarMapa() {
  if (mapa) return;

  mapa = L.map("mapa-os").setView([-1.7724905, -55.8626615], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(mapa);

  mapa.on("click", function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    latitudeSelecionada = lat;
    longitudeSelecionada = lng;

    if (marcador && mapa) {
      mapa.removeLayer(marcador);
    }
    marcador = L.marker([lat, lng]).addTo(mapa);

    console.log("Local selecionado:", lat, lng);
  });
}

async function inicializarSistema() {
  setDataAtual();

  await atualizarNumeroOS();

  await carregarMaisOrdens(); // 🔥 FALTAVA ISSO

  atualizarDashboard();
  carregarTabelaDashboard();
  aplicarFiltros();

  atualizarHeader("dashboard");
}

async function atualizarNumeroOS() {
  const numero = await consultarProximoNumeroOS();

  const campo = document.getElementById("numero-os");

  if (campo) {
    campo.value = numero;
  }
}

const overlay = document.querySelector(".overlay");

if (overlay) {
  overlay.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.remove("open");
    overlay.classList.remove("show");
  });
}

function atualizarHeader(pageId) {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  const map = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Visão geral do sistema de ordens de serviço",
    },

    "nova-os": {
      title: "Nova Ordem de Serviço",
      subtitle: "Criação de uma nova OS",
    },

    relatorios: {
      title: "Relatórios",
      subtitle: "Consulta e análise das ordens",
    },

    "materiais-mes": {
      title: "Materiais por Mês",
      subtitle: "Relatório de materiais utilizados nas ordens",
    },

    usuarios: {
      title: "Cadastro de Usuários",
      subtitle: "Gerenciamento de acessos do sistema",
    },
  };

  if (map[pageId]) {
    title.textContent = map[pageId].title;
    subtitle.textContent = map[pageId].subtitle;
  }
}

// Definir data atual
function setDataAtual() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const hora = String(now.getHours()).padStart(2, "0");
  const minuto = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("data-abertura").value =
    `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

// Adicionar Material
window.adicionarMaterial = function () {
  const nome = document.getElementById("material-nome").value.trim();
  const quantidadeInput = document.getElementById("material-quantidade").value;
  const unidade = document.getElementById("material-unidade").value.trim();

  // quantidade agora é opcional
  const quantidade = quantidadeInput ? parseFloat(quantidadeInput) : null;

  if (!nome || !unidade) {
    mostrarAlerta(
      "Informe pelo menos a descrição e a unidade do material.",
      "Atenção",
    );
    return;
  }

  materiais.push({
    nome,
    quantidade,
    unidade,
  });

  document.getElementById("material-nome").value = "";
  document.getElementById("material-quantidade").value = "";
  document.getElementById("material-unidade").value = "";

  renderizarMateriais();
};

function renderizarMateriais() {
  const lista = document.getElementById("lista-materiais");

  if (materiais.length === 0) {
    lista.classList.add("hidden");
    lista.innerHTML = "";
    return;
  }

  lista.classList.remove("hidden");

  lista.innerHTML = materiais
    .map(
      (m, index) => `
    <div class="material-item">
      <div class="material-info">
        <strong>${m.nome}</strong><br>
        <small>
    ${m.quantidade ? m.quantidade + " " + m.unidade : m.unidade}
</small>
      </div>
      <button
        type="button"
        class="btn btn-danger btn-small"
        onclick="removerMaterial(${index})">
        Remover
      </button>
    </div>
  `,
    )
    .join("");
}

// Salvar OS
document
  .getElementById("form-os")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const descricao = document.getElementById("descricao-servico").value.trim();

    const responsavelExecucao =
      document.getElementById("responsavel-execucao").value.trim() || "";

    if (!descricao) {
      mostrarAlerta("A descrição do serviço é obrigatória.", "Atenção");
      return;
    }

    const setorSelect = document.getElementById("setor-responsavel").value;
    const novoSetor = document.getElementById("novo-setor")?.value.trim();

    const setorFinal = setorSelect === "outro" ? novoSetor : setorSelect;

    const dadosOrdem = {
      tipoOS: document.getElementById("tipo-os").value,
      dataAbertura: document.getElementById("data-abertura").value,

      latitude: latitudeSelecionada,
      longitude: longitudeSelecionada,

      setorResponsavel: setorFinal,

      nomeSolicitante: document.getElementById("nome-solicitante").value,
      cpfSolicitante: document.getElementById("cpf-solicitante").value,
      telefoneSolicitante: document.getElementById("telefone-solicitante")
        .value,

      setorSolicitante: document.getElementById("setor-solicitante").value,

      descricaoServico: descricao,
      localServico: document.getElementById("local-servico").value,

      pontoReferencia: document.getElementById("ponto-referencia").value,

      materiais: [...materiais],

      responsavelExecucao: responsavelExecucao,
      responsavelAbertura: document.getElementById("responsavel-abertura")
        .value,
    };

    try {
      // ✏️ EDITAR OS
      if (osAtual && osAtual.id) {
        await atualizarOrdemFirestore(osAtual.id, dadosOrdem);

        mostrarAlerta("Ordem atualizada com sucesso!", "Sucesso");

        osAtual = null;

        showPage("relatorios");

        atualizarDashboard();
        carregarTabelaDashboard();
        aplicarFiltros();

        return;
      }

      // 🆕 NOVA OS

      // 🔹 pega o número que já está no campo da tela

      dadosOrdem.status = "Aberta";
      dadosOrdem.dataEncerramento = null;
      dadosOrdem.observacaoFinal = null;
      dadosOrdem.assinaturaChefia = null;
      dadosOrdem.assinaturaRecebedor = null;

      const resultado = await salvarOrdemFirestore(dadosOrdem);

      mostrarAlerta(`Ordem ${resultado.numero} criada com sucesso!`, "Sucesso");

      // 🔥 CRIA OBJETO LOCAL
      const novaOrdem = {
        ...dadosOrdem,
        id: resultado.id,
        numero: resultado.numero,
        status: "Aberta",
        criadoEm: new Date(),
      };

      // 🔥 ADICIONA NO TOPO (IMPORTANTE)
      ordens.unshift(novaOrdem);
      // 🔥 ATUALIZA TUDO
      aplicarFiltros();
      carregarTabelaDashboard();
      atualizarDashboard();

      limparFormulario();

      atualizarDashboard();
      carregarTabelaDashboard();
      aplicarFiltros();
    } catch (error) {
      console.error(error);
      mostrarAlerta(error.message, "Erro");
    }
  });

async function limparFormulario() {
  osAtual = null;

  document.getElementById("form-os").reset();

  materiais = [];
  renderizarMateriais();

  latitudeSelecionada = null;
  longitudeSelecionada = null;

  if (marcador && mapa) {
    mapa.removeLayer(marcador);
  }

  setDataAtual();

  const numero = await consultarProximoNumeroOS();
  document.getElementById("numero-os").value = numero;

  if (window.userNome) {
    document.getElementById("responsavel-abertura").value = window.userNome;
  }
}
window.mostrarAlerta = function (mensagem, titulo = "Aviso") {
  document.getElementById("modal-alerta-titulo").innerText = titulo;
  document.getElementById("modal-alerta-mensagem").innerText = mensagem;
  document.getElementById("modal-alerta").classList.remove("hidden");
};

window.fecharAlerta = function () {
  document.getElementById("modal-alerta").classList.add("hidden");
};

window.fecharConfirm = function () {
  document.getElementById("modal-confirm").classList.add("hidden");
};

// Dashboard
async function atualizarDashboard() {
  const resumo = await buscarResumoDashboard();

  document.getElementById("total-ordens").textContent = resumo.total;
  document.getElementById("total-andamento").textContent = resumo.andamento;
  document.getElementById("total-encerradas").textContent = resumo.encerradas;
  document.getElementById("total-materiais").textContent =
    resumo.totalMateriais;

  atualizarGraficos();
}

window.gerarRelatorioMateriais = function () {
  const mesSelect = document.getElementById("materiais-mes");
  const anoSelect = document.getElementById("materiais-ano");

  if (!mesSelect || !anoSelect) {
    console.error("Campos de mês ou ano não encontrados.");
    return;
  }

  const mes = Number(mesSelect.value);
  const ano = Number(anoSelect.value);

  if (isNaN(mes) || isNaN(ano)) {
    mostrarAlerta("Selecione o mês e o ano para gerar o relatório.", "Atenção");
    return;
  }

  let materiaisSomados = {};
  let quantidadeTotal = 0;

  ordens.forEach((ordem) => {
    if (!ordem.dataAbertura) return;

    const data = new Date(ordem.dataAbertura);

    if (data.getMonth() === mes && data.getFullYear() === ano) {
      if (!ordem.materiais || ordem.materiais.length === 0) return;

      ordem.materiais.forEach((mat) => {
        const chave = mat.nome + "_" + mat.unidade;

        if (!materiaisSomados[chave]) {
          materiaisSomados[chave] = {
            nome: mat.nome,
            unidade: mat.unidade,
            quantidade: 0,
            os: 0,
          };
        }

        const qtd = Number(mat.quantidade || 0);

        materiaisSomados[chave].quantidade += qtd;
        materiaisSomados[chave].os += 1;

        quantidadeTotal += qtd;
      });
    }
  });

  const lista = Object.values(materiaisSomados);

  // Atualiza cards
  document.getElementById("total-materiais-mes").textContent = lista.length;
  document.getElementById("total-quantidade-mes").textContent = quantidadeTotal;

  renderTabelaMateriaisMes(lista);
};

function carregarTabelaDashboard() {
  const tbody = document.getElementById("tabela-dashboard");
  const ultimasOrdens = ordens.slice(0, 5);

  if (ultimasOrdens.length === 0) {
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                <h3>Nenhuma ordem de serviço cadastrada</h3>
                <p>Clique em "Nova Ordem" para criar sua primeira OS</p>
            </td>
        </tr>`;
    console.log(ultimasOrdens);
    return;
  }

  tbody.innerHTML = ultimasOrdens
    .map(
      (ordem) => `
        <tr>
            <td>${ordem.numero}</td>
            <td>${formatarData(ordem.dataAbertura)}</td>
            <td>${ordem.nomeSolicitante}</td>
            <td>${(ordem.descricaoServico || "Sem descrição").substring(0, 50)}...</td>
            <td>
                <span class="status-badge status-${ordem.status.toLowerCase().replace(" ", "-")}">
                    ${ordem.status}
                </span>
            </td>
            <td>
                <button class="btn btn-primary btn-small"
                    onclick="visualizarOS('${ordem.id}')">
                    Ver Detalhes
                </button>
            </td>
        </tr>
    `,
    )
    .join("");
}

// Relatórios
window.aplicarFiltros = function () {
  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;
  const mes = document.getElementById("filtro-mes").value;
  const ano = document.getElementById("filtro-ano").value;
  const status = document.getElementById("filtro-status").value;

  const solicitante = document
    .getElementById("filtro-solicitante")
    .value.trim()
    .toLowerCase();

  const setorSolicitante = document
    .getElementById("filtro-setor-solicitante")
    ?.value.trim()
    .toLowerCase();

  let ordensFiltradas = [...ordens];

  if (dataInicio) {
    const inicio = new Date(dataInicio + "T00:00:00");

    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura) >= inicio,
    );
  }

  if (dataFim) {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura) <= new Date(dataFim + "T23:59:59"),
    );
  }

  if (mes !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura).getMonth() === Number(mes),
    );
  }

  if (ano !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura).getFullYear() === Number(ano),
    );
  }

  if (status) {
    ordensFiltradas = ordensFiltradas.filter((o) => o.status === status);
  }

  if (solicitante) {
    ordensFiltradas = ordensFiltradas.filter((o) =>
      o.nomeSolicitante?.toLowerCase().includes(solicitante),
    );
  }

  // 🔥 NOVO FILTRO POR SETOR
  if (setorSolicitante) {
    ordensFiltradas = ordensFiltradas.filter((o) =>
      o.setorSolicitante?.toLowerCase().includes(setorSolicitante),
    );
  }

  carregarTabelaRelatorios(ordensFiltradas);
};

function carregarFiltroAno() {
  const select = document.getElementById("filtro-ano");
  if (!select) return;

  const anoAtual = new Date().getFullYear();
  const anoInicial = 2026;

  select.innerHTML = '<option value="">Todos</option>';

  for (let ano = anoAtual; ano >= anoInicial; ano--) {
    const opt = document.createElement("option");
    opt.value = ano;
    opt.textContent = ano;
    select.appendChild(opt);
  }
}

function carregarTabelaRelatorios(ordensParaExibir) {
  const tbody = document.getElementById("tabela-relatorios");

  if (!ordensParaExibir || ordensParaExibir.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <h3>Nenhuma ordem encontrada</h3>
          <p>Tente ajustar os filtros</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = ordensParaExibir
    .map((ordem) => {
      const statusClasse = ordem.status
        ? ordem.status.toLowerCase().replace(/\s/g, "-")
        : "aberta";

      return `
        <tr>
          <td>${ordem.numero || "-"}</td>

          <td>
            ${ordem.dataAbertura ? formatarData(ordem.dataAbertura) : "-"}
          </td>

          <td>
            <span class="status-badge status-${statusClasse}">
              ${ordem.status || "-"}
            </span>
          </td>

          <td>${ordem.nomeSolicitante || "-"}</td>

          <td>${ordem.setorSolicitante || "-"}</td>

          <td>
            ${(ordem.descricaoServico || "-").substring(0, 40)}...
          </td>

          <td class="acoes">
    <button 
      class="btn btn-primary btn-icon"
      onclick="visualizarOS('${ordem.id}')"
      title="Visualizar">
      <i class="bi bi-eye"></i>
    </button>

    <button 
      class="btn btn-secondary btn-icon"
      onclick="editarOS('${ordem.id}')"
      title="Editar">
      <i class="bi bi-pencil"></i>
    </button>

    <button 
      class="btn btn-danger btn-icon"
      onclick="excluirOS('${ordem.id}')"
      title="Excluir">
      <i class="bi bi-trash"></i>
    </button>
</td>
        </tr>
      `;
    })
    .join("");
}

// Visualizar OS
window.visualizarOS = function (id) {
  osAtual = ordens.find((o) => o.id === id);
  if (!osAtual) return;

  const materiaisHTML =
    osAtual.materiais?.length > 0
      ? osAtual.materiais
          .map(
            (m) =>
              `<div style="margin-bottom:6px;">• ${m.nome} - ${m.quantidade || ""} ${m.unidade}</div>`,
          )
          .join("")
      : "";

  const criadoEmFormatado = osAtual.criadoEm?.seconds
    ? new Date(osAtual.criadoEm.seconds * 1000).toLocaleString("pt-BR")
    : "-";

  let detalhesHTML = `

<div style="display:flex; flex-direction:column; gap:14px;">

<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px;">
Informações Gerais
</h3>

<div><strong>Número:</strong> ${osAtual.numero}</div>
<div><strong>Status:</strong> ${osAtual.status}</div>
<div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>

<div><strong>Data de Encerramento:</strong> ${
    osAtual.dataEncerramento
      ? formatarDataCompleta(osAtual.dataEncerramento)
      : "-"
  }</div>


<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
Solicitante
</h3>

<div><strong>Nome:</strong> ${osAtual.nomeSolicitante}</div>

${
  (osAtual.tipoOS || "").toLowerCase() !== "externa"
    ? `<div><strong>Setor Solicitante:</strong> ${osAtual.setorSolicitante}</div>`
    : ""
}

<div><strong>Setor Responsável:</strong> ${osAtual.setorResponsavel}</div>


<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
Execução
</h3>

<div><strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao || ""}</div>

<div><strong>Responsável Abertura:</strong> ${osAtual.responsavelAbertura}</div>

<div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>

${
  (osAtual.tipoOS || "").toLowerCase() === "externa"
    ? `<div><strong>Ponto de Referência:</strong> ${osAtual.pontoReferencia || "-"}</div>`
    : ""
}


<div>
<strong>Local no mapa:</strong>
${
  osAtual.latitude
    ? `<a href="https://www.google.com/maps?q=${osAtual.latitude},${osAtual.longitude}" target="_blank">
Abrir no Google Maps
</a>`
    : "Não informado"
}
</div>


<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
Serviço
</h3>

<div><strong>Descrição:</strong> ${osAtual.descricaoServico}</div>


${
  osAtual.materiais?.length
    ? `
<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
Materiais Utilizados
</h3>

<div>${materiaisHTML}</div>
`
    : ""
}


<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
Encerramento
</h3>

${
  osAtual.observacaoFinal
    ? `<div><strong>Observação Final:</strong> ${osAtual.observacaoFinal}</div>`
    : ""
}

<div><strong>Assinatura Chefia:</strong> ${osAtual.assinaturaChefia || "-"}</div>

<div><strong>Assinatura Recebedor:</strong> ${osAtual.assinaturaRecebedor || "-"}</div>


<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
Controle Interno
</h3>

<div><strong>Criado por:</strong> ${osAtual.criadoPor || "-"}</div>

<div><strong>Criado em:</strong> ${criadoEmFormatado}</div>

</div>
`;

  document.getElementById("detalhes-content").innerHTML = detalhesHTML;

  const btnEncerrar = document.getElementById("btn-encerrar");
  const btnAlterar = document.getElementById("btn-alterar-status");

  if (osAtual.status === "Encerrada") {
    btnEncerrar.style.display = "none";
    btnAlterar.style.display = "none";
  } else {
    btnEncerrar.style.display = "inline-flex";
    btnAlterar.style.display = "inline-flex";
  }

  const modal = document.getElementById("modal-detalhes");

  modal.classList.remove("hidden");
  modal.classList.add("show");
};

window.fecharModalDetalhes = function () {
  document.getElementById("modal-detalhes").classList.remove("show");
  document.getElementById("modal-detalhes").classList.add("hidden");
  osAtual = null;
};

function fecharMenuMobile() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");

  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// Alterar Status
window.alterarStatus = async function () {
  if (!osAtual) return;

  const novoStatus = osAtual.status === "Aberta" ? "Em andamento" : "Aberta";

  await atualizarOrdemFirestore(osAtual.id, {
    status: novoStatus,
  });

  // 🔥 ATUALIZA NO ARRAY (CORRETO)
  ordens = ordens.map((o) =>
    o.id === osAtual.id ? { ...o, status: novoStatus } : o,
  );

  visualizarOS(osAtual.id);

  atualizarDashboard();
  carregarTabelaDashboard();
  aplicarFiltros();
};

// Encerramento
window.mostrarEncerramento = function () {
  if (!osAtual) return;

  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const hora = String(now.getHours()).padStart(2, "0");
  const minuto = String(now.getMinutes()).padStart(2, "0");

  document.getElementById("data-encerramento").value =
    `${ano}-${mes}-${dia}T${hora}:${minuto}`;

  // 🔹 Preenche automático
  document.getElementById("assinatura-chefia").value = "Liliana Bentes";

  if (window.userNome) {
    document.getElementById("assinatura-recebedor").value = window.userNome;
  }

  const modal = document.getElementById("modal-encerramento");
  modal.classList.remove("hidden");
  modal.classList.add("show");
};

window.excluirOS = function (id) {
  const ordem = ordens.find((o) => o.id === id);
  if (!ordem) return;

  mostrarConfirmacao(
    `Tem certeza que deseja excluir a OS ${ordem.numero}?`,
    async function () {
      try {
        await excluirOrdemFirestore(id);

        ordens = ordens.filter((o) => o.id !== id);

        aplicarFiltros();
        carregarTabelaDashboard();
        atualizarDashboard();

        mostrarAlerta("Ordem excluída com sucesso!", "Sucesso");
      } catch (error) {
        console.error(error);
        mostrarAlerta("Erro ao excluir a ordem.", "Erro");
      }
    },
  );
};

window.mostrarConfirmacao = function (mensagem, callbackConfirmar) {
  document.getElementById("modal-confirm-mensagem").innerText = mensagem;

  const modal = document.getElementById("modal-confirm");
  modal.classList.remove("hidden");

  const btn = document.getElementById("btn-confirmar-acao");

  btn.onclick = function () {
    callbackConfirmar();
    window.fecharConfirm();
  };
};

window.editarOS = function (id) {
  const ordem = ordens.find((o) => o.id === id);
  if (!ordem) return;

  // 🔒 NÃO PERMITE EDITAR ENCERRADA
  if (ordem.status === "Encerrada") {
    mostrarAlerta("Não é permitido editar uma OS encerrada.", "Atenção");
    return;
  }

  osAtual = ordem;

  showPage("nova-os");

  document.getElementById("numero-os").value = ordem.numero;
  document.getElementById("data-abertura").value = ordem.dataAbertura;
  document.getElementById("setor-responsavel").value = ordem.setorResponsavel;
  document.getElementById("nome-solicitante").value = ordem.nomeSolicitante;
  document.getElementById("setor-solicitante").value = ordem.setorSolicitante;
  document.getElementById("descricao-servico").value = ordem.descricaoServico;
  document.getElementById("ponto-referencia").value =
    ordem.pontoReferencia || "";
  document.getElementById("local-servico").value = ordem.localServico;
  document.getElementById("responsavel-execucao").value =
    ordem.responsavelExecucao;
  document.getElementById("responsavel-abertura").value =
    ordem.responsavelAbertura;

  materiais = ordem.materiais || [];
  renderizarMateriais();

  mostrarAlerta("Modo edição ativado.", "Informação");
};

window.fecharModalEncerramento = function () {
  const modal = document.getElementById("modal-encerramento");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.getElementById("form-encerramento").reset();
};

document
  .getElementById("form-encerramento")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!osAtual) return;

    const assinaturaChefia = document
      .getElementById("assinatura-chefia")
      .value.trim();

    const assinaturaRecebedor = document
      .getElementById("assinatura-recebedor")
      .value.trim();

    const dataEncerramento = document.getElementById("data-encerramento").value;

    if (!assinaturaChefia || !assinaturaRecebedor) {
      mostrarAlerta("Informe o responsável e o cidadão.", "Atenção");
      return;
    }

    await atualizarOrdemFirestore(osAtual.id, {
      status: "Encerrada",
      dataEncerramento: dataEncerramento,
      assinaturaChefia: assinaturaChefia,
      assinaturaRecebedor: assinaturaRecebedor,
      observacaoFinal: null,
      materiais: [...materiais],
    });

    ordens = ordens.map((o) =>
      o.id === osAtual.id ? { ...o, status: "Encerrada" } : o,
    );

    fecharModalEncerramento();
    visualizarOS(osAtual.id);
    atualizarDashboard();
    carregarTabelaDashboard();
    aplicarFiltros();

    mostrarAlerta("Ordem de Serviço encerrada com sucesso!", "Sucesso");
  });

function formatarData(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarDataCompleta(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

function renderTabelaMateriaisMes(lista) {
  const tbody = document.getElementById("tabela-materiais-mes");

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          Nenhum material utilizado neste período
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista
    .map(
      (m) => `
    <tr>
      <td>${m.nome}</td>
      <td>${m.quantidade}</td>
      <td>${m.unidade}</td>
      <td>${m.os}</td>
    </tr>
  `,
    )
    .join("");
}

function carregarAnoMateriais() {
  const select = document.getElementById("materiais-ano");

  if (!select) return;

  const anoAtual = new Date().getFullYear();

  select.innerHTML = "";

  for (let i = anoAtual; i >= 2026; i--) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;

    if (i === anoAtual) opt.selected = true;

    select.appendChild(opt);
  }
}

let graficoStatus = null;
let graficoMes = null;

async function atualizarGraficos() {
  const resumo = await buscarResumoDashboard();

  const abertas = resumo.abertas;
  const andamento = resumo.andamento;
  const encerradas = resumo.encerradas;

  // STATUS DAS ORDENS
  if (graficoStatus) graficoStatus.destroy();

  graficoStatus = new Chart(document.getElementById("grafico-status"), {
    type: "doughnut",

    data: {
      labels: ["Abertas", "Em andamento", "Encerradas"],
      datasets: [
        {
          data: [abertas, andamento, encerradas],
          backgroundColor: ["#3498db", "#ff9800", "#4caf50"],
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  // ORDENS POR MÊS
  let meses = new Array(12).fill(0);

  ordens.forEach((o) => {
    const data = new Date(o.dataAbertura);
    meses[data.getMonth()]++;
  });

  if (graficoMes) graficoMes.destroy();

  graficoMes = new Chart(document.getElementById("grafico-mes"), {
    type: "bar",

    data: {
      labels: [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ],

      datasets: [
        {
          label: "Ordens",
          data: meses,
          backgroundColor: "#3498db",
        },
      ],
    },

    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

window.toggleSidebar = function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".overlay");

  if (sidebar) sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("show");
};

window.previsualizarOS = function () {
  const tipoOS = (document.getElementById("tipo-os").value || "").toLowerCase();
  const tipoTitulo =
    tipoOS === "externa" ? "EXTERNA" : tipoOS === "interna" ? "INTERNA" : "";

  const numero = document.getElementById("numero-os").value;
  const data = document.getElementById("data-abertura").value;
  const solicitante = document.getElementById("nome-solicitante").value;
  const setorSolicitante = document.getElementById("setor-solicitante").value;
  const setorResponsavel = document.getElementById("setor-responsavel").value;
  const descricao = document.getElementById("descricao-servico").value;
  const local = document.getElementById("local-servico").value;

  const execucao =
    document.getElementById("responsavel-execucao")?.value || "-";
  const abertura = document.getElementById("responsavel-abertura").value;

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const assinaturasHTML =
    tipoOS === "externa"
      ? `
<div class="assinaturas">

  <div class="assinatura-box">
    <div class="linha"></div>
    Secretária
  </div>

  <div class="assinatura-box">
    <div class="linha"></div>
    Responsável
  </div>

  <div class="assinatura-box">
    <div class="linha"></div>
    Requerente
  </div>

</div>
`
      : `
<div class="assinaturas">

  <div class="assinatura-box">
    <div class="linha"></div>
    Secretária
  </div>

  <div class="assinatura-box">
    <div class="linha"></div>
    Responsável
  </div>

</div>
`;

  const conteudoOS = `

<div class="header">
  <img src="assets/img/prefeitura.png">

  <div class="header-text">
    <h1>Prefeitura Municipal de Oriximiná</h1>
    <p>Secretaria de Infraestrutura – SEINFRA</p>
  </div>
</div>

<div class="titulo">
ORDEM DE SERVIÇO ${tipoTitulo}
</div>


<div class="secao">

<h3>Informações Gerais</h3>

<div><strong>Número:</strong> ${numero}</div>
<div><strong>Status:</strong> Aberta</div>
<div><strong>Data de Abertura:</strong> ${formatarDataCompleta(data)}</div>
<div><strong>Data de Encerramento:</strong> -</div>

</div>


<div class="secao">

<h3>Solicitante</h3>

<div><strong>Nome:</strong> ${solicitante}</div>

${
  tipoOS !== "externa"
    ? `<div><strong>Setor:</strong> ${setorSolicitante}</div>`
    : ""
}

<div><strong>Setor Responsável:</strong> ${setorResponsavel}</div>

</div>


<div class="secao">

<h3>Execução</h3>

<div><strong>Responsável Execução:</strong> ${execucao}</div>
<div><strong>Responsável Abertura:</strong> ${abertura}</div>
<div><strong>Local do Serviço:</strong> ${local}</div>

</div>


<div class="secao">

<h3>Descrição do Serviço</h3>

<div>${descricao}</div>

</div>


<div class="secao">

<h3>Encerramento</h3>

${assinaturasHTML}

</div>

`;

  const w = window.open("", "_blank");

  w.document.write(`

<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">
<title>Pré-visualização OS</title>

<style>

@page{
  size:A4 portrait;
  margin:12mm;
}

body{
  font-family:Arial;
  font-size:12px;
}

/* FOLHA */

.folha{
display:flex;
flex-direction:column;
gap:15px;
}

.os-bloco{
border:1px solid #000;
padding:12px;
}

/* HEADER */

.header{
display:flex;
align-items:center;
justify-content:center;
gap:10px;
margin-bottom:10px;
}

.header img{
width:40px;
}

.header-text h1{
font-size:16px;
margin:0;
}

.header-text p{
font-size:11px;
margin:0;
}

/* TITULO */

.titulo{
text-align:center;
font-size:14px;
font-weight:bold;
margin:10px 0;
}

/* SEÇÕES */

.secao{
margin-bottom:10px;
}

.secao h3{
font-size:12px;
border-bottom:1px solid #000;
margin-bottom:6px;
}

/* ASSINATURAS */

.assinaturas{
display:flex;
justify-content:space-around;
margin-top:25px;
gap:30px;
}

.assinatura-box{
flex:1;
text-align:center;
}

.linha{
border-top:1px solid #000;
margin-bottom:5px;
}

/* LINHA CORTE */

.linha-corte{
border-top:2px dashed #000;
margin:5px 0;
}

/* FOOTER */

.footer{
margin-top:10px;
font-size:10px;
text-align:right;
}

</style>

</head>

<body>

<div class="folha">

<div class="os-bloco">
${conteudoOS}
<div class="footer">Documento gerado em: ${dataEmissao}</div>
</div>

<div class="linha-corte"></div>

<div class="os-bloco">
${conteudoOS}
<div class="footer">Documento gerado em: ${dataEmissao}</div>
</div>

</div>

<script>
window.onload=function(){
window.print()
}
</script>

</body>
</html>

`);

  w.document.close();
};

window.gerarPDFMateriais = function () {
  if (!osAtual || !osAtual.materiais || osAtual.materiais.length === 0) {
    alert("Esta ordem não possui materiais.");
    return;
  }

  const lista = osAtual.materiais
    .map(
      (m, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${m.nome}</td>
            <td>${m.quantidade || "-"}</td>
            <td>${m.unidade}</td>
        </tr>
    `,
    )
    .join("");

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Materiais - ${osAtual.numero}</title>

        <style>
            @page {
                size: A4 portrait;
                margin: 20mm;
            }

            body {
                font-family: Arial, sans-serif;
                color: #000;
            }

            .header {
                text-align: center;
                margin-bottom: 25px;
            }

            .header img {
                width: 80px;
                margin-bottom: 10px;
            }

            .header h1 {
                font-size: 18px;
                margin: 0;
            }

            .header p {
                font-size: 13px;
                margin: 2px 0;
            }
                td:nth-child(3),
td:nth-child(4),
th:nth-child(3),
th:nth-child(4){
  text-align:center;
}

            .title {
                text-align: center;
                font-size: 16px;
                font-weight: bold;
                margin: 20px 0;
            }

            .info {
                margin-bottom: 20px;
                font-size: 14px;
            }

            table {
                width: 100%;
                border-collapse: collapse;
            }

            th, td {
  border: 1px solid #000;
  padding: 8px;
  font-size: 13px;
}

th{
  background-color:#f2f2f2;
}

/* alinhar colunas */
td:nth-child(3),
td:nth-child(4),
th:nth-child(3),
th:nth-child(4){
  text-align:center;
}

            .footer {
                margin-top: 40px;
                font-size: 12px;
                text-align: right;
            }

        </style>
    </head>

    <body>

        <div class="header">
            <img src="assets/img/prefeitura.png">
            <h1>Prefeitura Municipal de Oriximiná</h1>
            <p>Secretaria de Infraestrutura – SEINFRA</p>
        </div>

        <div class="title">
            RELAÇÃO DE MATERIAIS SOLICITADOS
        </div>

        <div class="info">
            <strong>Número da OS:</strong> ${osAtual.numero}<br>
            <strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}<br>
            <strong>Solicitante:</strong> ${osAtual.nomeSolicitante}<br>
            <strong>Setor:</strong> ${osAtual.setorSolicitante}<br>
            <strong>Local do Serviço:</strong> ${osAtual.localServico}<br>
            <strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao || ""}
        </div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Material</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                </tr>
            </thead>
            <tbody>
                ${lista}
            </tbody>
        </table>

        <div class="footer">
            Documento gerado em: ${dataEmissao}
        </div>

        <script>
            window.onload = function () {
                window.print();
            }
        </script>

    </body>
    </html>
  `);

  w.document.close();
};

window.imprimirDetalhesOS = function () {
  if (!osAtual) return;

  const temMateriais = osAtual.materiais && osAtual.materiais.length > 0;

  const materiaisHTML = temMateriais
    ? osAtual.materiais
        .map(
          (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.nome}</td>
          <td>${m.quantidade || "-"}</td>
          <td>${m.unidade}</td>
        </tr>
      `,
        )
        .join("")
    : "";

  const dataEmissao = new Date().toLocaleString("pt-BR");
  const tipoOS = (osAtual.tipoOS || "").toLowerCase();

  const tipoTitulo =
    tipoOS === "externa" ? "EXTERNA" : tipoOS === "interna" ? "INTERNA" : "";

  const assinaturasHTML =
    (osAtual.tipoOS || "").toLowerCase() === "externa"
      ? `
<div class="assinaturas">

<div class="assinatura-box">
<div class="linha"></div>
Secretária
</div>

<div class="assinatura-box">
<div class="linha"></div>
${osAtual.responsavelExecucao || ""}
Responsável
</div>

<div class="assinatura-box">
<div class="linha"></div>
${osAtual.assinaturaRecebedor || ""}
Requerente
</div>

</div>
`
      : `
<div class="assinaturas">

<div class="assinatura-box">
<div class="linha"></div>
Secretária
</div>

<div class="assinatura-box">
<div class="linha"></div>
Responsável
</div>

</div>
`;

  const conteudoOS = `
<div class="header">
  <img src="assets/img/prefeitura.png">
  <div class="header-text">
    <h1>Prefeitura Municipal de Oriximiná</h1>
    <p>Secretaria de Infraestrutura – SEINFRA</p>
  </div>
</div>

<div class="titulo">ORDEM DE SERVIÇO ${tipoTitulo}</div>

<div class="secao">
<h3>Informações Gerais</h3>
<div><strong>Número:</strong> ${osAtual.numero}</div>
<div><strong>Status:</strong> ${osAtual.status}</div>
<div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
<div><strong>Data de Encerramento:</strong> ${
    osAtual.dataEncerramento
      ? formatarDataCompleta(osAtual.dataEncerramento)
      : "-"
  }</div>
</div>

<div class="secao">
<h3>Solicitante</h3>

<div><strong>Nome:</strong> ${osAtual.nomeSolicitante}</div>

${
  tipoOS === "externa"
    ? `
<div><strong>CPF:</strong> ${osAtual.cpfSolicitante || "-"}</div>
<div><strong>Telefone:</strong> ${osAtual.telefoneSolicitante || "-"}</div>
`
    : `<div><strong>Setor:</strong> ${osAtual.setorSolicitante}</div>`
}

<div><strong>Setor Responsável:</strong> ${osAtual.setorResponsavel}</div>

</div>

<div class="secao">
<h3>Execução</h3>

<div><strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao || ""}</div>
<div><strong>Responsável Abertura:</strong> ${osAtual.responsavelAbertura}</div>
<div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>

${
  (osAtual.tipoOS || "").toLowerCase() === "externa"
    ? `<div><strong>Ponto de Referência:</strong> ${osAtual.pontoReferencia || "-"}</div>`
    : ""
}



</div>

<div class="secao">
<h3>Descrição do Serviço</h3>
<div>${osAtual.descricaoServico}</div>
</div>

${
  temMateriais
    ? `
<div class="secao">
<h3>Materiais Utilizados</h3>
<table>
<thead>
<tr>
<th>#</th>
<th>Material</th>
<th>Quantidade</th>
<th>Unidade</th>
</tr>
</thead>
<tbody>
${materiaisHTML}
</tbody>
</table>
</div>
`
    : ""
}

<div class="secao">
<h3>Encerramento</h3>
${assinaturasHTML}
</div>
`;

  const w = window.open("", "_blank");

  w.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>

<meta charset="UTF-8">
<title>Ordem de Serviço - ${osAtual.numero}</title>

<style>

@page{
  size:A4 portrait;
  margin:12mm;
}

body{
  font-family:Arial;
  font-size:12px;
}

/* BLOCO DA OS */

.folha{
display:flex;
flex-direction:column;
gap:15px;
}

.os-bloco{
border:1px solid #000;
padding:12px;
}

/* HEADER */

.header{
display:flex;
align-items:center;
justify-content:center;
gap:6px;
margin-bottom:3px;
}

.header img{
width:30px;
}

.header-text h1{
font-size:14px;
margin:0;
}

.header-text p{
font-size:10px;
margin:0;
}

/* TITULO */

.titulo{
text-align:center;
font-size:12px;
font-weight:bold;
margin:10px 0;
}

/* SEÇÕES */

.secao{
margin-bottom:10px;
}

.secao h3{
font-size:12px;
border-bottom:1px solid #000;
margin-bottom:6px;
}

/* TABELA */

table{
width:100%;
border-collapse:collapse;
}

th,td{
border:1px solid #000;
padding:4px;
font-size:11px;
}

/* ASSINATURAS */

.assinaturas{
display:flex;
justify-content:space-around;
gap:30px;
margin-top:25px;
}

.assinatura-box{
flex:1;
text-align:center;
}

.linha{
border-top:1px solid #000;
margin-bottom:5px;
}

/* LINHA DE CORTE */

.linha-corte{
border-top:2px dashed #000;
text-align:center;
font-size:10px;
margin:5px 0;
}

/* FOOTER */

.footer{
margin-top:10px;
font-size:10px;
text-align:right;
}

</style>

</head>

<body>

<div class="folha">

<div class="os-bloco">
${conteudoOS}
<div class="footer">Documento gerado em: ${dataEmissao}</div>
</div>

<div class="linha-corte"></div>

<div class="os-bloco">
${conteudoOS}
<div class="footer">Documento gerado em: ${dataEmissao}</div>
</div>

</div>

<script>
window.onload = function(){
  window.print();
}
</script>

</body>
</html>
`);

  w.document.close();
};

window.exportarMateriaisOS = function () {
  if (!osAtual || !osAtual.materiais || osAtual.materiais.length === 0) {
    alert("Esta ordem não possui materiais.");
    return;
  }

  const lista = osAtual.materiais
    .map(
      (m, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${m.nome}</td>
            <td>${m.quantidade}</td>
            <td>${m.unidade}</td>
        </tr>
    `,
    )
    .join("");

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Materiais da ${osAtual.numero}</title>
            <style>
    @page {
        size: A4 portrait;
        margin: 15mm;
    }

    html, body {
        width: 210mm;
        min-height: 297mm;
    }

    body {
        font-family: Arial, sans-serif;
        color: #000;
        margin: 0;
        padding: 0;
    }

    .page {
        width: 100%;
        min-height: 100%;
    }

    .header {
        text-align: center;
        margin-bottom: 20px;
    }

    .header img {
        width: 80px;
        margin-bottom: 10px;
    }

    .header h1 {
        font-size: 18px;
        margin: 0;
    }

    .header p {
        font-size: 13px;
        margin: 2px 0;
    }

    .document-title {
        text-align: center;
        font-size: 16px;
        font-weight: bold;
        margin: 20px 0;
    }

    .info-box {
        margin-bottom: 20px;
        font-size: 14px;
    }

    .info-box div {
        margin-bottom: 6px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }

    th, td {
        border: 1px solid #000;
        padding: 8px;
        font-size: 13px;
    }

    th {
        background-color: #f2f2f2;
    }

    .footer {
        margin-top: 40px;
        font-size: 12px;
        text-align: right;
    }

    @media print {
        body {
            width: 210mm;
            height: 297mm;
        }
    }
</style>

           
        </head>
        <body>

            <div class="header">
                <img src="assets/img/prefeitura.png" alt="Prefeitura">
                <h1>Prefeitura Municipal de Oriximiná</h1>
                <p>Secretaria de Infraestrutura – SEINFRA</p>
            </div>

            <div class="document-title">
                RELAÇÃO DE MATERIAIS SOLICITADOS
            </div>

            <div class="info-box">
                <div><strong>Número da OS:</strong> ${osAtual.numero}</div>
                <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
                <div><strong>Solicitante:</strong> ${osAtual.nomeSolicitante}</div>
                <div><strong>Setor:</strong> ${osAtual.setorSolicitante}</div>
                <div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>
                <div><strong>Responsável pela Execução:</strong> ${osAtual.responsavelExecucao || ""}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Material</th>
                        <th>Quantidade</th>
                        <th>Unidade</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista}
                </tbody>
            </table>

            <div class="footer">
                Documento gerado em: ${dataEmissao}
            </div>

            <script>
                window.onload = function () {
                    window.print();
                }
            </script>

        </body>
        </html>
    `);

  w.document.close();
};

window.imprimirMateriaisMes = function () {
  const linhas = document.querySelectorAll("#tabela-materiais-mes tr");

  if (!linhas.length) {
    mostrarAlerta("Nenhum material para imprimir.", "Atenção");
    return;
  }

  let conteudoTabela = "";

  linhas.forEach((linha) => {
    const colunas = linha.querySelectorAll("td");

    if (colunas.length >= 3) {
      conteudoTabela += `
        <tr>
          <td>${colunas[0].innerText}</td>
          <td>${colunas[1].innerText}</td>
          <td>${colunas[2].innerText}</td>
        </tr>
      `;
    }
  });

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <title>Relatório de Materiais</title>

      <style>

        @page {
          size: A4 portrait;
          margin: 20mm;
        }

        body {
          font-family: Arial, sans-serif;
        }

        .header {
          text-align:center;
          margin-bottom:25px;
        }

        .header img {
          width:80px;
          margin-bottom:10px;
        }

        .titulo{
          text-align:center;
          font-size:16px;
          font-weight:bold;
          margin:20px 0;
        }

        table{
          width:100%;
          border-collapse:collapse;
        }

        th,td{
          border:1px solid #000;
          padding:8px;
          font-size:13px;
        }

        th{
          background:#f2f2f2;
        }

        .footer{
          margin-top:40px;
          text-align:right;
          font-size:12px;
        }

      </style>

  </head>

  <body>

    <div class="header">
      <img src="assets/img/prefeitura.png">
      <h2>Prefeitura Municipal de Oriximiná</h2>
      <p>Secretaria de Infraestrutura – SEINFRA</p>
    </div>

    <div class="titulo">
      RELATÓRIO DE MATERIAIS UTILIZADOS
    </div>

    <table>

      <thead>
        <tr>
          <th>Material</th>
          <th>Quantidade</th>
          <th>Unidade</th>
        </tr>
      </thead>

      <tbody>
        ${conteudoTabela}
      </tbody>

    </table>

    <div class="footer">
      Documento gerado em: ${dataEmissao}
    </div>

    <script>
      window.onload = function(){
        window.print();
      }
    </script>

  </body>
  </html>
  `);

  w.document.close();
};

window.imprimirRelatorio = function () {
  let linhas = "";

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;
  const mes = document.getElementById("filtro-mes").value;
  const ano = document.getElementById("filtro-ano").value;
  const status = document.getElementById("filtro-status").value;

  const solicitante = document
    .getElementById("filtro-solicitante")
    .value.trim()
    .toLowerCase();

  const setorSolicitante = document
    .getElementById("filtro-setor-solicitante")
    ?.value.trim()
    .toLowerCase();

  let ordensFiltradas = [...ordens];

  // DATA INICIAL
  if (dataInicio) {
    const inicio = new Date(dataInicio + "T00:00:00");

    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura) >= inicio,
    );
  }

  // DATA FINAL
  if (dataFim) {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura) <= new Date(dataFim + "T23:59:59"),
    );
  }

  // MÊS
  if (mes !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura).getMonth() === Number(mes),
    );
  }

  // ANO
  if (ano !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura).getFullYear() === Number(ano),
    );
  }

  // STATUS
  if (status) {
    ordensFiltradas = ordensFiltradas.filter((o) => o.status === status);
  }

  // SOLICITANTE
  if (solicitante) {
    ordensFiltradas = ordensFiltradas.filter((o) =>
      o.nomeSolicitante?.toLowerCase().includes(solicitante),
    );
  }

  // SETOR SOLICITANTE
  if (setorSolicitante) {
    ordensFiltradas = ordensFiltradas.filter((o) =>
      o.setorSolicitante?.toLowerCase().includes(setorSolicitante),
    );
  }

  // GERAR LINHAS
  ordensFiltradas.forEach((o) => {
    linhas += `
      <tr>
        <td>${o.numero}</td>
        <td>${formatarData(o.dataAbertura)}</td>
        <td>${o.status}</td>
        <td>${o.nomeSolicitante}</td>
        <td>${o.setorSolicitante}</td>
        <td>${o.descricaoServico}</td>
      </tr>
    `;
  });

  const w = window.open("", "_blank");

  w.document.write(`

<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">
<title>Relatório</title>

<style>

@page{
  size:A4 portrait;
  margin:20mm;
}

body{
  font-family:Arial, sans-serif;
  color:#000;
}

.header{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:15px;
  margin-bottom:25px;
  text-align:center;
}

.header img{
  width:50px;
}

.header-text{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
}

.header-text h1{
  font-size:18px;
  margin:0;
}

.header-text p{
  font-size:13px;
  margin:2px 0;
}

.titulo{
  text-align:center;
  font-size:16px;
  font-weight:bold;
  margin:20px 0;
}

table{
  width:100%;
  border-collapse:collapse;
}

th,td{
  border:1px solid #000;
  padding:6px;
  font-size:12px;
  vertical-align:top;
}

th{
  background:#f2f2f2;
}

td:nth-child(6){
  max-width:300px;
  word-break:break-word;
}

.footer{
  margin-top:30px;
  font-size:12px;
}

</style>

</head>

<body>

<div class="header">

<img src="assets/img/prefeitura.png">

<div class="header-text">
<h1>Prefeitura Municipal de Oriximiná</h1>
<p>Secretaria de Infraestrutura – SEINFRA</p>
</div>

</div>

<div class="titulo">
RELATÓRIO DE ORDENS DE SERVIÇO
</div>

<table>

<thead>
<tr>
<th>Nº OS</th>
<th>Data</th>
<th>Status</th>
<th>Solicitante</th>
<th>Setor</th>
<th>Descrição</th>
</tr>
</thead>

<tbody>
${linhas}
</tbody>

</table>

<div class="footer">
Documento gerado em: ${dataEmissao}
</div>

<script>
window.onload = () => window.print()
</script>

</body>
</html>

`);

  w.document.close();
};

window.showPage = function (pageId, element) {
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.add("hidden");
  });

  document.getElementById("page-" + pageId).classList.remove("hidden");

  document.querySelectorAll(".menu-item").forEach((m) => {
    m.classList.remove("active");
  });

  if (element) element.classList.add("active");

  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".overlay");

  sidebar.classList.remove("open");
  overlay.classList.remove("show");

  // 🔥 INICIAR MAPA
  if (pageId === "nova-os") {
    setTimeout(iniciarMapa, 200);

    atualizarNumeroOS();
  }
};

window.toggleMenu = function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".overlay");
  const main = document.querySelector(".main-content");

  if (!sidebar) return;

  const isMobile = window.innerWidth <= 768;

  // MOBILE → abre gaveta
  if (isMobile) {
    sidebar.classList.toggle("open");

    if (overlay) {
      overlay.classList.toggle("show");
    }
  }

  // DESKTOP → recolhe sidebar
  else {
    sidebar.classList.toggle("oculto");

    if (main) {
      main.classList.toggle("expandido");
    }
  }
};

const cpfInput = document.getElementById("cpf-solicitante");

cpfInput?.addEventListener("input", function (e) {
  let v = e.target.value.replace(/\D/g, "");

  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

  e.target.value = v;
});

const telefoneInput = document.getElementById("telefone-solicitante");

telefoneInput?.addEventListener("input", function (e) {
  let v = e.target.value.replace(/\D/g, "");

  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d{5})(\d)/, "$1-$2");

  e.target.value = v;
});

