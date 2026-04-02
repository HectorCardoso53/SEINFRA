// ============================================================
// ordens.js — CRUD de Ordens de Serviço, formulário e dashboard
// ============================================================

import {
  salvarOrdemFirestore,
  excluirOrdemFirestore,
  consultarProximoNumeroOS,
  buscarResumoDashboard,
  atualizarStatusComDashboard,
  buscarOrdemPorId,
} from "../firestore.js";

import {
  mostrarAlerta,
  mostrarConfirmacao,
  renderizarMateriais,
  renderizarMateriaisEncerramento,
  atualizarHeader,
  showPage,
} from "./ui.js";
import {
  upper,
  formatarDataCompleta,
  agruparMateriais,
  buildOrdem,
  validarOrdem,
  setoresPorDiretoria,
  normalizarTexto,
} from "./utils.js";
import {
  carregarPagina,
  carregarTabelaRelatorios,
  invalidarCache,
} from "./filtros.js";
import {
  osAtual,
  materiais,
  materiaisEncerramento,
  salvando,
  sistemaInicializado,
  setOsAtual,
  setMateriais,
  setMateriaisEncerramento,
  setSalvando,
  setSistemaInicializado,
  setGraficoStatus,
  setGraficoMes,
  graficoStatus,
  graficoMes,
} from "./state.js";

import { mostrarProgresso, concluirProgresso } from "./ui.js";

/* =========================
   CONTROLE DO CAMPO RESPONSAVEL-ABERTURA

   O auth.js chama window._onAuthPronto(nome) quando o Firebase responde.
   Aqui decidimos o que fazer com esse nome:
   - Se estiver em modo edição: ignora completamente
   - Se for nova OS: preenche com o nome do usuário logado
========================= */

let _valorEdicaoAtual = null;

window._onAuthPronto = function (nomeUsuario) {
  const campo = document.getElementById("responsavel-abertura");
  if (!campo) return;

  if (_valorEdicaoAtual !== null) {
    // Em modo edição — mantém o valor da OS, ignora o auth
    campo.value = _valorEdicaoAtual;
  } else {
    // Nova OS — preenche com o usuário logado
    campo.value = nomeUsuario;
  }
};

function ativarModoEdicao(valorDaOS) {
  _valorEdicaoAtual = valorDaOS || "";
  const campo = document.getElementById("responsavel-abertura");
  if (campo) campo.value = _valorEdicaoAtual;
}

function desativarModoEdicao() {
  _valorEdicaoAtual = null;
  const campo = document.getElementById("responsavel-abertura");
  if (campo && window.userNome) campo.value = window.userNome;
}

/* =========================
   INICIALIZAÇÃO
========================= */
export async function inicializarSistema() {
  if (sistemaInicializado) return;
  setSistemaInicializado(true);
  try {
    setDataAtual();
    await atualizarNumeroOS();
    await carregarPagina(1);
    await carregarResumoDashboard_();
    atualizarHeader("dashboard");
  } catch (error) {
    console.error("Erro ao inicializar sistema:", error);
  }
}

export async function atualizarNumeroOS() {
  const numero = await consultarProximoNumeroOS();
  const campo = document.getElementById("numero-os");
  if (campo) campo.value = numero;
}

export function setDataAtual() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const hora = String(now.getHours()).padStart(2, "0");
  const minuto = String(now.getMinutes()).padStart(2, "0");
  const campo = document.getElementById("data-abertura");
  if (campo) campo.value = `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

/* =========================
   DASHBOARD
========================= */
export async function carregarResumoDashboard_() {
  const resumo = await buscarResumoDashboard();
  atualizarDashboardComResumo(resumo);
}

export async function atualizarDashboardComResumo(resumo) {
  if (!resumo) return;
  document.getElementById("total-ordens").textContent = resumo.total;
  document.getElementById("total-abertas").textContent = resumo.abertas;
  document.getElementById("total-andamento").textContent = resumo.andamento;
  document.getElementById("total-encerradas").textContent = resumo.encerradas;
  document.getElementById("total-materiais").textContent =
    resumo.totalMateriais;
  await atualizarGraficos(resumo);
}

export async function atualizarGraficos(resumo) {
  if (graficoStatus) graficoStatus.destroy();
  const novoGraficoStatus = new Chart(
    document.getElementById("grafico-status"),
    {
      type: "doughnut",
      data: {
        labels: ["Abertas", "Em andamento", "Encerradas"],
        datasets: [
          {
            data: [resumo.abertas, resumo.andamento, resumo.encerradas],
            backgroundColor: ["#3498db", "#ff9800", "#4caf50"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    },
  );
  setGraficoStatus(novoGraficoStatus);

  const meses = resumo.ordensPorMes || new Array(12).fill(0);
  if (graficoMes) graficoMes.destroy();
  const novoGraficoMes = new Chart(document.getElementById("grafico-mes"), {
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
      datasets: [{ label: "Ordens", data: meses, backgroundColor: "#3498db" }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
  setGraficoMes(novoGraficoMes);
}

/* =========================
   FORMULÁRIO
========================= */
export function coletarDadosFormulario(
  setorFinal,
  descricao,
  responsavelExecucao,
) {
  return {
    tipoOS: document.getElementById("tipo-os")?.value,
    dataAbertura: document.getElementById("data-abertura")?.value,
    setorResponsavel: setorFinal,
    nomeSolicitante: document.getElementById("nome-solicitante")?.value.trim(),
    cpf: document.getElementById("cpf-solicitante")?.value.trim(),
    telefone: document.getElementById("telefone-solicitante")?.value.trim(),
    setorSolicitante: document.getElementById("setor-solicitante")?.value,
    descricao,
    local: document.getElementById("local-servico")?.value.trim(),
    pontoReferencia: document.getElementById("ponto-referencia")?.value.trim(),
    materiais: [...materiais],
    responsavelExecucao,
    responsavelAbertura: document.getElementById("responsavel-abertura")?.value,
  };
}

export async function limparFormulario() {
  desativarModoEdicao();
  setOsAtual(null);
  document.getElementById("form-os").reset();
  setMateriais([]);
  renderizarMateriais([]);
  setDataAtual();
  const numero = await consultarProximoNumeroOS();
  document.getElementById("numero-os").value = numero;
  if (window.userNome) {
    document.getElementById("responsavel-abertura").value = window.userNome;
  }
}

export function limparFormularioOS(modoEdicao = false) {
  desativarModoEdicao();
  if (!modoEdicao) document.getElementById("numero-os").value = "";
  document.getElementById("data-abertura").value = "";
  document.getElementById("tipo-os").value = "";
  document.getElementById("setor-responsavel").value = "";
  document.getElementById("setor-solicitante").innerHTML =
    '<option value="">Selecione</option>';
  document.getElementById("nome-solicitante").value = "";
  document.getElementById("descricao-servico").value = "";
  document.getElementById("local-servico").value = "";
  document.getElementById("ponto-referencia").value = "";
  document.getElementById("responsavel-execucao").value = "";
  document.getElementById("responsavel-abertura").value = window.userNome || "";
  setMateriais([]);
  renderizarMateriais([]);
}

/* =========================
   ADICIONAR MATERIAL
========================= */
export function adicionarMaterial() {
  const nome = document.getElementById("material-nome").value.trim();
  const quantidadeInput = document.getElementById("material-quantidade").value;
  const unidade = document.getElementById("material-unidade").value.trim();
  const quantidade = quantidadeInput ? parseFloat(quantidadeInput) : null;

  if (!nome || !unidade) {
    mostrarAlerta(
      "Informe pelo menos a descrição e a unidade do material.",
      "Atenção",
    );
    return;
  }

  const novosMateriais = [...materiais, { nome, quantidade, unidade }];
  setMateriais(novosMateriais);
  document.getElementById("material-nome").value = "";
  document.getElementById("material-quantidade").value = "";
  document.getElementById("material-unidade").value = "";
  renderizarMateriais(novosMateriais);
}

export function removerMaterial(index) {
  const novosMateriais = materiais.filter((_, i) => i !== index);
  setMateriais(novosMateriais);
  renderizarMateriais(novosMateriais);
}

/* =========================
   SUBMIT DO FORMULÁRIO
========================= */
export async function handleFormOSSubmit(e) {
  e.preventDefault();
  if (salvando) return;
  setSalvando(true);
  mostrarProgresso();

  try {
    const descricao = document.getElementById("descricao-servico").value.trim();
    const responsavelExecucao =
      document.getElementById("responsavel-execucao").value.trim() || "";
    const setorSelect = document.getElementById("setor-responsavel").value;
    const dadosBrutos = coletarDadosFormulario(
      setorSelect,
      descricao,
      responsavelExecucao,
    );

    validarOrdem(dadosBrutos);
    const dadosOrdem = buildOrdem(dadosBrutos);

    if (osAtual && osAtual.id) {
      await atualizarStatusComDashboard(osAtual.id, dadosOrdem);
      window.invalidarCache?.();
      await carregarPagina(1);
      await carregarResumoDashboard_();
      mostrarAlerta("Ordem atualizada com sucesso!", "Sucesso");
      limparFormularioOS();
      setOsAtual(null);
      showPage("relatorios");
      return;
    }

    const resultado = await salvarOrdemFirestore(dadosOrdem);
    window.invalidarCache?.();
    await carregarPagina(1);
    await carregarResumoDashboard_();
    mostrarAlerta(`Ordem ${resultado.numero} criada com sucesso!`, "Sucesso");
    limparFormulario();
  } catch (error) {
    console.error(error);
    mostrarAlerta(error.message, "Erro");
  } finally {
    setSalvando(false);
    concluirProgresso();
  }
}

/* =========================
   VISUALIZAR OS
========================= */
export async function visualizarOS(id) {
  let ordem = await buscarOrdemPorId(id);
  if (!ordem) return;

  setOsAtual(ordem);
  const tipoOS = (ordem.tipoOS || "").toLowerCase();

  const materiaisHTML =
    ordem.materiais?.length > 0
      ? ordem.materiais
          .map(
            (m) =>
              `<div style="margin-bottom:6px;">• ${m.nome} - ${m.quantidade || ""} ${m.unidade}</div>`,
          )
          .join("")
      : "";

  const criadoEmFormatado = ordem.criadoEm?.seconds
    ? new Date(ordem.criadoEm.seconds * 1000).toLocaleString("pt-BR")
    : "-";

  const detalhesHTML = `
<div style="display:flex; flex-direction:column; gap:14px;">
<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px;">Informações Gerais</h3>
<div><strong>Número:</strong> ${ordem.numero}</div>
<div><strong>Status:</strong> ${ordem.status}</div>
<div><strong>Data de Abertura:</strong> ${formatarDataCompleta(ordem.dataAbertura)}</div>
<div><strong>Data de Encerramento:</strong> ${ordem.dataEncerramento ? formatarDataCompleta(ordem.dataEncerramento) : "-"}</div>

<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">Solicitante</h3>
<div><strong>Nome:</strong> ${ordem.nomeSolicitante}</div>
<div><strong>CPF:</strong> ${ordem.cpfSolicitante || "-"}</div>
<div><strong>Telefone:</strong> ${ordem.telefoneSolicitante || "-"}</div>
${tipoOS !== "externa" ? `<div><strong>Setor Solicitante:</strong> ${ordem.setorSolicitante || "-"}</div>` : ""}
<div><strong>Setor Responsável:</strong> ${ordem.setorResponsavel}</div>

<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">Execução</h3>
<div><strong>Responsável Execução:</strong> ${ordem.responsavelExecucao || "-"}</div>
<div><strong>Responsável Abertura:</strong> ${ordem.responsavelAbertura || "-"}</div>
<div><strong>Local do Serviço:</strong> ${ordem.localServico}</div>
<div><strong>Ponto de Referência:</strong> ${ordem.pontoReferencia || "-"}</div>
<div><strong>Local no mapa:</strong> ${ordem.latitude ? `<a href="https://www.google.com/maps?q=${ordem.latitude},${ordem.longitude}" target="_blank">Abrir no Google Maps</a>` : "Não informado"}</div>

<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">Serviço</h3>
<div><strong>Descrição:</strong> ${ordem.descricaoServico}</div>

${ordem.materiais?.length ? `<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">Materiais Utilizados</h3><div>${materiaisHTML}</div>` : ""}

<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">Encerramento</h3>
${ordem.observacaoFinal ? `<div><strong>Observação Final:</strong> ${ordem.observacaoFinal}</div>` : ""}
<div><strong>Assinatura Chefia:</strong> ${ordem.assinaturaChefia || "-"}</div>
<div><strong>Assinatura Recebedor:</strong> ${ordem.assinaturaRecebedor || "-"}</div>

<h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">Controle Interno</h3>
<div><strong>Criado por:</strong> ${ordem.criadoPor || "-"}</div>
<div><strong>Criado em:</strong> ${criadoEmFormatado}</div>
</div>`;

  document.getElementById("detalhes-content").innerHTML = detalhesHTML;

  const btnEncerrar = document.getElementById("btn-encerrar");
  const btnAlterar = document.getElementById("btn-alterar-status");
  if (ordem.status === "Encerrada") {
    btnEncerrar.style.display = "none";
    btnAlterar.style.display = "none";
  } else {
    btnEncerrar.style.display = "inline-flex";
    btnAlterar.style.display = "inline-flex";
  }

  const modal = document.getElementById("modal-detalhes");
  modal.classList.remove("hidden");
  modal.classList.add("show");
}

export function fecharModalDetalhes() {
  document.getElementById("modal-detalhes").classList.remove("show");
  document.getElementById("modal-detalhes").classList.add("hidden");
  setOsAtual(null);
}

/* =========================
   ALTERAR STATUS
========================= */
export async function alterarStatus() {
  if (!osAtual) return;
  const novoStatus = osAtual.status === "Aberta" ? "Em andamento" : "Aberta";
  await atualizarStatusComDashboard(osAtual.id, { status: novoStatus });
  await carregarPagina(1);
  await carregarResumoDashboard_();
}

/* =========================
   ENCERRAMENTO
========================= */
export function mostrarEncerramento() {
  if (!osAtual) return;
  setMateriaisEncerramento([]);
  renderizarMateriaisEncerramento([]);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("data-encerramento").value =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  document.getElementById("assinatura-chefia").value = "Liliana Bentes";
  if (window.userNome)
    document.getElementById("assinatura-recebedor").value = window.userNome;

  const modal = document.getElementById("modal-encerramento");
  modal.classList.remove("hidden");
  modal.classList.add("show");
}

export function fecharModalEncerramento() {
  const modal = document.getElementById("modal-encerramento");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.getElementById("form-encerramento").reset();
}

export async function handleFormEncerramentoSubmit(e) {
  e.preventDefault();
  if (!osAtual) return;
  mostrarProgresso();

  try {
    const assinaturaChefia = document.getElementById("assinatura-chefia").value.trim();
    const assinaturaRecebedor = document.getElementById("assinatura-recebedor").value.trim();
    const dataEncerramento = document.getElementById("data-encerramento").value;

    if (!assinaturaChefia || !assinaturaRecebedor) {
      mostrarAlerta("Informe o responsável e o cidadão.", "Atenção");
      return;
    }

    let ordemAtualizada = osAtual;
    if (!ordemAtualizada || ordemAtualizada.materiais === undefined) {
      ordemAtualizada = await buscarOrdemPorId(osAtual.id);
    }

    const materiaisExistentes = Array.isArray(ordemAtualizada?.materiais)
      ? ordemAtualizada.materiais
      : [];
    const novosMateriais = Array.isArray(materiaisEncerramento)
      ? materiaisEncerramento
      : [];
    const materiaisFinal = agruparMateriais([
      ...materiaisExistentes,
      ...novosMateriais,
    ]);

    await atualizarStatusComDashboard(osAtual.id, {
      status: "Encerrada",
      dataEncerramento,
      assinaturaChefia,
      assinaturaRecebedor,
      observacaoFinal: null,
      materiais: materiaisFinal,
    });

    window.invalidarCache?.();
    await visualizarOS(osAtual.id);
    setMateriaisEncerramento([]);
    renderizarMateriaisEncerramento([]);
    fecharModalEncerramento();
    await carregarPagina(1);
    await carregarResumoDashboard_();
    mostrarAlerta("Ordem encerrada com sucesso!", "Sucesso");

  } catch (error) {
    console.error(error);
    mostrarAlerta("Erro ao encerrar a ordem.", "Erro");
  } finally {
    concluirProgresso();
  }
}

/* =========================
   EXCLUIR OS
   🔑 Busca direto do Firestore pelo id — funciona com filtros ativos
========================= */
export async function excluirOS(id) {
  // Busca a ordem direto do Firestore — não depende do array local
  const ordem = await buscarOrdemPorId(id);
  if (!ordem) {
    mostrarAlerta("Ordem não encontrada.", "Erro");
    return;
  }

  mostrarConfirmacao(
    `Tem certeza que deseja excluir a OS ${ordem.numero}?`,
    async function () {
      mostrarProgresso();
      try {
        await excluirOrdemFirestore(id);
        window.invalidarCache?.();
        await carregarPagina(1);
        await carregarResumoDashboard_();
        mostrarAlerta("Ordem excluída com sucesso!", "Sucesso");
      } catch (error) {
        console.error(error);
        mostrarAlerta("Erro ao excluir a ordem.", "Erro");
      } finally {
        concluirProgresso();
      }
    },
  );
}

/* =========================
   EDITAR OS
   🔑 Busca direto do Firestore pelo id — funciona com filtros ativos
========================= */
export async function editarOS(id) {
  // Busca a ordem direto do Firestore — não depende do array local
  const ordem = await buscarOrdemPorId(id);
  if (!ordem) {
    mostrarAlerta("Ordem não encontrada.", "Erro");
    return;
  }

  if (ordem.status === "Encerrada") {
    mostrarAlerta("Não é permitido editar uma OS encerrada.", "Atenção");
    return;
  }

  // 🔑 Ativa modo edição com o valor correto da OS
  ativarModoEdicao(ordem.responsavelAbertura);

  setOsAtual(ordem);
  showPage("nova-os");

  const tipo = (ordem.tipoOS || "").toLowerCase();
  document.getElementById("tipo-os").value = tipo;
  document.getElementById("numero-os").value = ordem.numero;
  document.getElementById("data-abertura").value = ordem.dataAbertura;
  document.getElementById("setor-responsavel").value = ordem.setorResponsavel;
  document.getElementById("nome-solicitante").value = ordem.nomeSolicitante;
  document.getElementById("descricao-servico").value = ordem.descricaoServico;
  document.getElementById("ponto-referencia").value =
    ordem.pontoReferencia || "";
  document.getElementById("local-servico").value = ordem.localServico;
  document.getElementById("responsavel-execucao").value =
    ordem.responsavelExecucao || "";

  carregarSetores(ordem.setorResponsavel);

  const setorLimpo = ordem.setorSolicitante
    ?.replace(/^SETOR\s+/i, "")
    .trim()
    .toUpperCase();
  setTimeout(() => {
    document.getElementById("setor-solicitante").value = setorLimpo;
  }, 100);

  setMateriais(ordem.materiais || []);
  renderizarMateriais(ordem.materiais || []);
  mostrarAlerta("Modo edição ativado.", "Informação");
}

/* =========================
   SETORES
========================= */
export function carregarSetores(diretoriaSelecionada) {
  const selectSetor = document.getElementById("setor-solicitante");
  const diretoria = normalizarTexto(diretoriaSelecionada);
  const setores = setoresPorDiretoria[diretoria] || [];
  selectSetor.innerHTML = '<option value="">SELECIONE O SETOR</option>';
  setores.forEach((setor) => {
    const option = document.createElement("option");
    option.value = setor;
    option.textContent = setor;
    selectSetor.appendChild(option);
  });
}

/* =========================
   MATERIAIS DE ENCERRAMENTO
========================= */
export function adicionarMaterialEncerramento() {
  const nomeInput = document.getElementById("enc-material-nome");
  const unidadeInput = document.getElementById("enc-material-unidade");
  const quantidadeInput = document.getElementById("enc-material-quantidade");

  if (!nomeInput || !unidadeInput || !quantidadeInput) return;

  const nome = nomeInput.value.trim();
  const unidade = unidadeInput.value.trim();
  const quantidade = quantidadeInput.value;

  if (!nome || !unidade) {
    mostrarAlerta("Preencha material e unidade.", "Atenção");
    return;
  }

  const novos = [
    ...materiaisEncerramento,
    { nome, unidade, quantidade: quantidade ? parseFloat(quantidade) : null },
  ];
  setMateriaisEncerramento(novos);
  nomeInput.value = "";
  unidadeInput.value = "";
  quantidadeInput.value = "";
  renderizarMateriaisEncerramento(novos);
}

export function removerMaterialEncerramento(index) {
  const novos = materiaisEncerramento.filter((_, i) => i !== index);
  setMateriaisEncerramento(novos);
  renderizarMateriaisEncerramento(novos);
}
