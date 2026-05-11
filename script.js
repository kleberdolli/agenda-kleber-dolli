const storageKey = "agenda-musical-demo";
const adminSessionKey = "agenda-musical-admin";
const adminPassword = "Doll1Pu9";

let supabaseUrl = "";
let supabaseAnonKey = "";
let supabaseTable = "agenda_events";

const initialEvents = [
  {
    id: "show-001",
    date: "2026-05-16",
    city: "Salvador - BA",
    venue: "Espaço de Eventos",
    title: "Evento particular",
    status: "confirmed",
    period: "noite",
    time: "21h",
    publicNote: "Local resumido, sem endereço completo.",
  },
  {
    id: "show-002",
    date: "2026-05-23",
    city: "Feira de Santana - BA",
    venue: "Casa de Shows",
    title: "Show público",
    status: "confirmed",
    period: "noite",
    time: "22h",
    publicNote: "Informações detalhadas somente com a produção.",
  },
  {
    id: "free-001",
    date: "2026-06-01",
    city: "Disponível para solicitação",
    venue: "A combinar",
    title: "Data disponível",
    status: "available",
    period: "tarde",
    time: "A definir",
    publicNote: "Envie uma pré-reserva para análise.",
  },
  {
    id: "free-002",
    date: "2026-06-08",
    city: "Disponível para solicitação",
    venue: "A combinar",
    title: "Data disponível",
    status: "available",
    period: "noite",
    time: "A definir",
    publicNote: "Ideal para eventos particulares e corporativos.",
  },
  {
    id: "hold-001",
    date: "2026-06-15",
    city: "Cidade em análise",
    venue: "Pré-reserva",
    title: "Data em análise",
    status: "pending",
    period: "tarde",
    time: "A confirmar",
    publicNote: "Aguardando confirmação da equipe.",
  },
];

const initialQuotes = [];

const statusLabels = {
  confirmed: "Confirmado",
  available: "Disponível",
  pending: "Pré-reserva",
};

const periodLabels = {
  tarde: "À tarde",
  noite: "À noite",
};

let state = loadState();
let activeFilter = "all";
let usingSupabase = false;
let pendingImport = null;
/** Evita que uma resposta tardia do Supabase sobrescreva um backup recém-restaurado. */
let remoteAgendaGeneration = 0;

function eventPeriodKey(event) {
  return `${event.date}|${event.period}`;
}

/** Junta nuvem + o que está no navegador: para o mesmo dia/período, vale o local (backup/editado aqui). */
function mergeRemoteAndLocal(remoteRows, localEvents) {
  const map = new Map();
  for (const row of remoteRows) {
    const ev = fromSupabase(row);
    map.set(eventPeriodKey(ev), ev);
  }
  for (const e of localEvents) {
    map.set(eventPeriodKey(e), e);
  }
  return Array.from(map.values());
}

const eventGrid = document.querySelector("#eventGrid");
const requestList = document.querySelector("#requestList");
const bookingForm = document.querySelector("#bookingForm");
const quoteForm = document.querySelector("#quoteForm");
const shareShowButton = document.querySelector("#shareShowButton");
const formMessage = document.querySelector("#formMessage");
const quoteMessage = document.querySelector("#quoteMessage");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminPanel = document.querySelector("#adminPanel");
const adminMessage = document.querySelector("#adminMessage");
const adminDateForm = document.querySelector("#adminDateForm");
const adminExportBackup = document.querySelector("#adminExportBackup");
const adminImportBackup = document.querySelector("#adminImportBackup");
const adminBackupMessage = document.querySelector("#adminBackupMessage");
const contractInputs = [
  "contractClient",
  "contractDocument",
  "contractDate",
  "contractPeriod",
  "contractTime",
  "contractCity",
  "contractVenue",
  "contractValue",
  "contractPayment",
  "contractNotes",
].map((id) => document.querySelector(`#${id}`));

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

bookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const booking = {
    id: createId(),
    date: document.querySelector("#dateInput")?.value,
    period: document.querySelector("#periodInput")?.value,
    city: document.querySelector("#cityInput")?.value.trim() || "",
    venue: "Local sob análise",
    title: document.querySelector("#eventTypeInput")?.value,
    status: "pending",
    time: "A confirmar",
    publicNote: "Solicitação recebida. Aguardando análise da equipe.",
    requester: document.querySelector("#nameInput")?.value.trim() || "",
    phone: document.querySelector("#phoneInput")?.value.trim() || "",
    notes: document.querySelector("#notesInput")?.value.trim() || "",
  };

  try {
    state.events.push(booking);
    try {
      saveState();
    } catch (err) {
      state.events.pop();
      console.error(err);
      if (formMessage) {
        formMessage.textContent =
          "Não foi possível gravar no navegador (armazenamento cheio ou bloqueado). Libere espaço ou desative modo restrito.";
      }
      return;
    }

    const savedOnline = await saveEventToSupabase(booking);
    const bookingNotification = await notifyTelegram("pre-reserva", booking);
    bookingForm.reset();
    if (formMessage) {
      formMessage.textContent = bookingNotification.ok
        ? savedOnline
          ? "Pré-reserva enviada. Ela já aparece como data em análise."
          : "Pré-reserva registrada neste navegador, mas não consegui salvar online."
        : `Pré-reserva salva neste aparelho, mas a notificação falhou: ${bookingNotification.message}`;
    }
    activeFilter = "all";
    document.querySelectorAll(".filter").forEach((item) => {
      item.classList.toggle("active", item.dataset.filter === "all");
    });
  } catch (err) {
    console.error(err);
    if (formMessage) {
      formMessage.textContent =
        "Ocorreu um erro ao enviar. Confira se a pré-reserva apareceu na lista; se não, tente de novo.";
    }
  } finally {
    render();
  }
});

quoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const quote = {
    id: createId(),
    name: document.querySelector("#quoteName")?.value.trim() || "",
    phone: document.querySelector("#quotePhone")?.value.trim() || "",
    city: document.querySelector("#quoteCity")?.value.trim() || "",
    date: document.querySelector("#quoteDate")?.value,
    period: document.querySelector("#quotePeriod")?.value,
    type: document.querySelector("#quoteType")?.value,
    duration: document.querySelector("#quoteDuration")?.value,
    notes: document.querySelector("#quoteNotes")?.value.trim() || "",
    createdAt: new Date().toISOString(),
  };

  try {
    state.quotes.push(quote);
    saveState();
    const notification = await notifyTelegram("orcamento", quote);
    quoteForm.reset();
    if (quoteMessage) {
      quoteMessage.textContent = notification.ok
        ? "Solicitação de orçamento recebida e enviada para o Telegram."
        : notification.message;
    }
  } catch (err) {
    console.error(err);
    if (quoteMessage) quoteMessage.textContent = "Erro ao enviar. Verifique se o pedido foi salvo na lista.";
  } finally {
    render();
  }
});


document.querySelector("#downloadContract")?.addEventListener("click", downloadContractPDF);
document.querySelector("#printContract")?.addEventListener("click", printContract);
document.querySelector("#clearContract")?.addEventListener("click", clearContractForm);
document.querySelector("#clearQuoteForm")?.addEventListener("click", clearQuoteFormHandler);
document.querySelector("#clearBookingForm")?.addEventListener("click", clearBookingFormHandler);
document.querySelector("#adminLogout")?.addEventListener("click", adminLogout);
shareShowButton?.addEventListener("click", shareShowLink);
adminLoginForm?.addEventListener("submit", handleAdminLogin);
adminDateForm?.addEventListener("submit", handleAdminDateSave);
adminExportBackup?.addEventListener("click", () => {
  void exportAgendaBackup();
});
adminImportBackup?.addEventListener("change", handleImportBackupChange);
document.querySelector("#adminConfirmImport")?.addEventListener("click", () => {
  if (!pendingImport) return;
  remoteAgendaGeneration += 1;
  state = { events: pendingImport.events, quotes: pendingImport.quotes };
  pendingImport = null;
  saveState();
  render();
  document.querySelector("#adminConfirmImport")?.classList.add("hidden");
  setAdminBackupMessage(`Backup restaurado com sucesso. ${state.events.length} datas carregadas.`);
  document.querySelector("#eventGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
contractInputs.filter(Boolean).forEach((input) => input.addEventListener("input", renderContract));


async function shareShowLink() {
  const shareUrl = "https://agenda-kleber-dolli.vercel.app/";
  const shareData = {
    title: "Indique o show de Kleber Dolli",
    text: "Indique o show de Kleber Dolli!",
    url: shareUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
    shareShowButton.textContent = "Link copiado";
    window.setTimeout(() => {
      shareShowButton.textContent = "Indique Kleber Dolli";
    }, 2200);
  } catch {
    shareShowButton.textContent = "Copie o link";
    window.setTimeout(() => {
      shareShowButton.textContent = "Indique Kleber Dolli";
    }, 2200);
  }
}


async function loadPublicConfig() {
  if (window.location.protocol === "file:") return;
  try {
    const response = await fetch("/api/public-config");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.supabaseUrl || !data.supabaseAnonKey) return;
    supabaseUrl = data.supabaseUrl;
    supabaseAnonKey = data.supabaseAnonKey;
    supabaseTable = data.supabaseTable || supabaseTable;
  } catch {
    /* agenda local */
  }
}

async function supabaseRequest(path, options = {}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase não configurado");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha no Supabase");
  }

  if (response.status === 204) return null;
  return response.json();
}

function fromSupabase(row) {
  return {
    id: row.id,
    date: row.date,
    period: row.period,
    status: row.status,
    title: row.title || (row.status === "confirmed" ? "Reserva confirmada" : "Data em análise"),
    city: row.city || "Cidade a confirmar",
    venue: row.venue || "Local reservado",
    time: row.time || periodLabels[row.period],
    publicNote: row.public_note || "",
    requester: row.requester || "",
    phone: row.phone || "",
    notes: row.notes || "",
  };
}

function toSupabase(event) {
  return {
    date: event.date,
    period: event.period,
    status: event.status,
    title: event.title || null,
    city: event.city || null,
    venue: event.venue || null,
    time: event.time || null,
    public_note: event.publicNote || event.public_note || null,
    requester: event.requester || null,
    phone: event.phone || null,
    notes: event.notes || null,
    updated_at: new Date().toISOString(),
  };
}

async function loadAgendaFromSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    usingSupabase = false;
    return;
  }
  const gen = ++remoteAgendaGeneration;
  try {
    const rows = await supabaseRequest(`${supabaseTable}?select=*&date=gte.2026-06-01&date=lte.2026-06-30&order=date.asc,period.asc`, {
      method: "GET",
    });
    if (gen !== remoteAgendaGeneration) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      usingSupabase = false;
      console.warn(
        "Supabase retornou vazio (possível env/RLS). Mantendo dados locais para não apagar sua agenda."
      );
      return;
    }

    usingSupabase = true;
    const hasSavedLocal = !!localStorage.getItem(storageKey);
    state.events = hasSavedLocal
      ? mergeRemoteAndLocal(rows, state.events)
      : rows.map(fromSupabase);
    saveState();
    render();
  } catch (error) {
    if (gen !== remoteAgendaGeneration) return;
    usingSupabase = false;
    console.warn("Agenda online indisponível. Usando dados locais.", error);
  }
}

async function saveEventToSupabase(event) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }
  try {
    const payload = toSupabase(event);

    if (event.status === "confirmed") {
      await supabaseRequest(`${supabaseTable}?on_conflict=date,period`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ ...payload, status: "pending" }),
      });

      await supabaseRequest(
        `${supabaseTable}?date=eq.${encodeURIComponent(event.date)}&period=eq.${encodeURIComponent(event.period)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        }
      );
    } else {
      await supabaseRequest(`${supabaseTable}?on_conflict=date,period`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload),
      });
    }

    usingSupabase = true;
    return true;
  } catch (error) {
    usingSupabase = false;
    console.warn("Não foi possível salvar no Supabase.", error);
    return false;
  }
}

async function deleteEventFromSupabase(date, period) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }
  try {
    await supabaseRequest(`${supabaseTable}?date=eq.${encodeURIComponent(date)}&period=eq.${encodeURIComponent(period)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    usingSupabase = true;
    return true;
  } catch (error) {
    usingSupabase = false;
    console.warn("Não foi possível liberar a data no Supabase.", error);
    return false;
  }
}

async function saveAdminDateToSupabase(date, period, status) {
  if (status === "available") {
    return deleteEventFromSupabase(date, period);
  }

  const event = state.events.find((item) => item.date === date && item.period === period);
  if (!event) return false;
  return saveEventToSupabase(event);
}
function isAdminLogged() {
  return localStorage.getItem(adminSessionKey) === "yes";
}

function renderAdminState() {
  if (!adminLoginForm || !adminPanel) return;
  const logged = isAdminLogged();
  adminLoginForm.classList.toggle("hidden", logged);
  adminPanel.classList.toggle("hidden", !logged);
}

function handleAdminLogin(event) {
  event.preventDefault();
  const password = document.querySelector("#adminPassword")?.value || "";

  if (password !== adminPassword) {
    if (adminMessage) adminMessage.textContent = "Senha incorreta.";
    return;
  }

  localStorage.setItem(adminSessionKey, "yes");
  if (adminMessage) adminMessage.textContent = "";
  adminLoginForm.reset();
  render();
}

function adminLogout() {
  localStorage.removeItem(adminSessionKey);
  if (adminBackupMessage) adminBackupMessage.textContent = "";
  render();
}

function setAdminBackupMessage(text) {
  if (adminBackupMessage) adminBackupMessage.textContent = text || "";
}

async function exportAgendaBackup() {
  if (!isAdminLogged()) return;
  setAdminBackupMessage("Gerando backup…");

  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  try {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: "agenda-kleber-dolli",
      events: state.events,
      quotes: state.quotes,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const day = new Date().toISOString().slice(0, 10);
    const filename = `agenda-backup-${day}.json`;

    let shared = false;
    try {
      if (typeof File !== "undefined" && navigator.share) {
        const file = new File([blob], filename, { type: "application/json", lastModified: Date.now() });
        const can =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (can) {
          await navigator.share({
            title: "Backup da agenda Kleber Dolli",
            text: "Salve em Arquivos ou envie ao computador (WhatsApp, e-mail, Drive).",
            files: [file],
          });
          shared = true;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        setAdminBackupMessage("Compartilhamento cancelado.");
        return;
      }
    }

    if (shared) {
      setAdminBackupMessage("Pronto. Use “Salvar no Arquivos” ou envie o .json ao PC.");
      return;
    }

    if (!isIOS) {
      try {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = "noopener";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setAdminBackupMessage("Backup baixado (ou na pasta de downloads). Envie o .json ao celular se precisar.");
        return;
      } catch {
        /* clipboard abaixo */
      }
    }

    try {
      await navigator.clipboard.writeText(json);
      setAdminBackupMessage(
        isIOS
          ? `Backup COPIADO (${json.length} caracteres). Notas → colar → ⋯ → Salvar em Arquivos como ${filename}`
          : `Backup COPIADO. Salve um arquivo de texto como ${filename} ou envie ao PC.`
      );
    } catch {
      setAdminBackupMessage(
        "Não foi possível baixar nem copiar. Abra este site no computador e use Baixar backup."
      );
    }
  } catch (err) {
    console.error(err);
    setAdminBackupMessage(
      err && err.message ? `Erro ao exportar: ${err.message}` : "Erro ao exportar. Tente no computador."
    );
  }
}

function normalizeImportedBackup(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (Array.isArray(parsed.events)) {
    return {
      events: parsed.events,
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    };
  }
  return null;
}

async function readBackupFileAsText(file) {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader"));
    reader.readAsText(file);
  });
}

async function handleImportBackupChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file || !isAdminLogged()) {
    if (input) input.value = "";
    if (file && !isAdminLogged()) {
      setAdminBackupMessage("Entre no painel de novo para restaurar o backup.");
    }
    return;
  }

  try {
    const raw = await readBackupFileAsText(file);
    const text = raw.replace(/^\uFEFF/, "").trim();
    const parsed = JSON.parse(text);
    const normalized = normalizeImportedBackup(parsed);
    if (!normalized) {
      setAdminBackupMessage("Arquivo inválido: precisa conter eventos (events).");
      input.value = "";
      return;
    }

    // Armazena temporariamente e pede confirmação inline (window.confirm é bloqueado em mobile)
    pendingImport = normalized;
    input.value = "";
    setAdminBackupMessage(
      `Arquivo lido: ${normalized.events.length} datas encontradas. Clique em CONFIRMAR para substituir a agenda atual.`
    );
    const confirmBtn = document.querySelector("#adminConfirmImport");
    if (confirmBtn) confirmBtn.classList.remove("hidden");
  } catch (err) {
    const hint = err && err.message ? err.message : String(err);
    setAdminBackupMessage(`Não foi possível ler o arquivo: ${hint}`);
  }

  input.value = "";
}

async function handleAdminDateSave(event) {
  event.preventDefault();

  const date = document.querySelector("#adminDate").value;
  const period = document.querySelector("#adminPeriod").value;
  const status = document.querySelector("#adminStatus").value;

  state.events = state.events.filter((item) => !(item.date === date && item.period === period));

  if (status !== "available") {
    const statusText = status === "confirmed" ? "Reserva confirmada" : "Data em análise";
    const publicNote = document.querySelector("#adminNote").value.trim() ||
      (status === "confirmed"
        ? "Data fechada. Endereço completo tratado em particular."
        : "Pré-reserva ativa. Aguardando confirmação da equipe.");

    state.events.push({
      id: createId(),
      date,
      period,
      city: document.querySelector("#adminCity").value.trim() || "Cidade a confirmar",
      venue: document.querySelector("#adminVenue").value.trim() || "Local reservado",
      title: document.querySelector("#adminTitle").value.trim() || statusText,
      status,
      time: document.querySelector("#adminTime").value.trim() || periodLabels[period],
      publicNote,
    });
  }

  saveState();
  const savedOnline = await saveAdminDateToSupabase(date, period, status);
  adminDateForm.reset();
  render();

  if (adminMessage) {
    adminMessage.textContent = savedOnline
      ? "Agenda salva online. Ao recarregar, essa alteração deve continuar aparecendo."
      : "Salvei neste navegador, mas não consegui gravar online. Confira as regras do Supabase se sumir ao recarregar.";
  }
}
function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return { events: [...initialEvents], quotes: [...initialQuotes] };

  try {
    const parsed = JSON.parse(saved);
    return {
      events: parsed.events || [...initialEvents],
      quotes: parsed.quotes || [...initialQuotes],
    };
  } catch {
    return { events: [...initialEvents], quotes: [...initialQuotes] };
  }
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (err) {
    console.error("saveState", err);
    throw err;
  }
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `booking-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function render() {
  const sortedEvents = [...state.events].sort((a, b) => a.date.localeCompare(b.date));

  const calendarEvents = sortedEvents.filter((event) => isInJuneAgenda(event.date));
  renderCounters(calendarEvents);
  renderEvents(sortedEvents);
  renderRequests(
    sortedEvents.filter((event) => event.status === "pending" && event.requester),
    state.quotes
  );
  if (document.querySelector("#contractPreview")) renderContract();
  renderAdminState();
}

function renderCounters(events) {
  const confirmedEl = document.querySelector("#confirmedCount");
  const availableEl = document.querySelector("#availableCount");
  const pendingEl = document.querySelector("#pendingCount");
  if (confirmedEl) confirmedEl.textContent = countByStatus(events, "confirmed");
  if (availableEl) availableEl.textContent = countByStatus(events, "available");
  if (pendingEl) pendingEl.textContent = countByStatus(events, "pending");
}

function countByStatus(events, status) {
  if (status === "available") {
    const occupied = events.filter((event) => event.status !== "available").length;
    return Math.max(60 - occupied, 0);
  }

  return events.filter((event) => event.status === status).length;
}

function isInJuneAgenda(value) {
  return /^2026-06-(0[1-9]|[12][0-9]|30)$/.test(value || "");
}

function renderEvents(events) {
  if (!eventGrid) return;
  const days = buildCalendarDays(events);

  if (!days.length) {
    eventGrid.innerHTML = '<p class="empty-state">Nenhuma data encontrada nesse filtro.</p>';
    return;
  }

  eventGrid.innerHTML = days.map(createDayCard).join("");

  document.querySelectorAll("[data-request-date]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#dateInput").value = button.dataset.requestDate;
      document.querySelector("#periodInput").value = button.dataset.requestPeriod || "";
      document.querySelector("#solicitar").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function buildCalendarDays(events) {
  const days = [];

  for (let dayNumber = 1; dayNumber <= 30; dayNumber += 1) {
    const date = new Date(2026, 5, dayNumber);
    const dateKey = toDateInputValue(date);
    const slots = ["tarde", "noite"].map((period) => {
      const event = events.find((item) => item.date === dateKey && item.period === period);
      return event || createAvailableSlot(dateKey, period);
    });

    const filteredSlots =
      activeFilter === "all" ? slots : slots.filter((slot) => slot.status === activeFilter);

    if (activeFilter === "all" || filteredSlots.length) {
      days.push({ date: dateKey, slots: filteredSlots });
    }
  }

  return days;
}

function createAvailableSlot(date, period) {
  return {
    id: `available-${date}-${period}`,
    date,
    period,
    city: "Disponível para solicitação",
    venue: "A combinar",
    title: "Disponível",
    status: "available",
    time: periodLabels[period],
    publicNote: "Livre para orçamento ou pré-reserva.",
  };
}

function createDayCard(day) {
  const date = parseDate(day.date);
  const weekday = formatWeekday(day.date);

  return `
    <article class="day-card">
      <div class="day-head">
        <div class="date-block compact-date">
          <strong>${date.day}</strong>
          <span>${date.month}</span>
        </div>
        <div>
          <h3>${weekday}</h3>
          <p>${date.year}</p>
        </div>
      </div>
      <div class="period-list">
        ${day.slots.map(createPeriodSlot).join("")}
      </div>
    </article>
  `;
}

function createPeriodSlot(event) {
  const action =
    event.status === "available"
      ? `<button class="slot-action" type="button" data-request-date="${event.date}" data-request-period="${event.period}">Solicitar</button>`
      : "";

  return `
    <div class="period-slot ${event.status}">
      <div>
        <span class="period-name">${periodLabels[event.period] || "Período"}</span>
        <strong>${statusLabels[event.status]}</strong>
        <small>${event.status === "confirmed" ? `${event.venue}, ${event.city}` : event.publicNote}</small>
      </div>
      ${action}
    </div>
  `;
}

function renderRequests(requests, quotes) {
  if (!requestList) return;
  if (!requests.length && !quotes.length) {
    requestList.innerHTML =
      '<p class="empty-state">Nenhuma solicitação nova por enquanto.</p>';
    return;
  }

  const requestCards = requests
    .map((request) => {
      const date = formatDate(request.date);
      return `
        <article class="request-card">
          <div>
            <span class="badge pending">Em análise</span>
            <h3>${request.title} em ${request.city}</h3>
            <p>${date} • ${periodLabels[request.period] || "Período a definir"} • ${request.requester} • ${request.phone}</p>
            <p>${request.notes || "Sem observações adicionais."}</p>
          </div>
          <div class="request-actions">
            <button class="button approve" type="button" data-approve="${request.id}">Confirmar reserva</button>
            <button class="button remove" type="button" data-remove="${request.id}">Remover</button>
          </div>
        </article>
      `;
    })
    .join("");

  const quoteCards = quotes
    .map((quote) => {
      const date = quote.date ? formatDate(quote.date) : "Data a definir";
      return `
        <article class="request-card">
          <div>
            <span class="badge available">Orçamento</span>
            <h3>${quote.type} em ${quote.city}</h3>
            <p>${date} • ${periodLabels[quote.period] || "Período a definir"} • ${quote.name} • ${quote.phone}</p>
            <p>Duração: ${quote.duration}</p>
            <p>${quote.notes || "Sem detalhes adicionais."}</p>
          </div>
          <div class="request-actions">
            <button class="button primary" type="button" data-quote-book="${quote.id}">Criar pré-reserva</button>
            <button class="button remove" type="button" data-quote-remove="${quote.id}">Remover</button>
          </div>
        </article>
      `;
    })
    .join("");

  requestList.innerHTML = requestCards + quoteCards;

  document.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => approveRequest(button.dataset.approve));
  });

  document.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => removeRequest(button.dataset.remove));
  });

  document.querySelectorAll("[data-quote-book]").forEach((button) => {
    button.addEventListener("click", () => createBookingFromQuote(button.dataset.quoteBook));
  });

  document.querySelectorAll("[data-quote-remove]").forEach((button) => {
    button.addEventListener("click", () => removeQuote(button.dataset.quoteRemove));
  });
}

async function approveRequest(id) {
  state.events = state.events.map((event) => {
    if (event.id !== id) return event;

    return {
      ...event,
      status: "confirmed",
      venue: "Local reservado",
      time: event.time === "A confirmar" ? "Horário a combinar" : event.time,
      publicNote: "Reserva confirmada. Endereço completo tratado em particular.",
    };
  });
  saveState();
  const approved = state.events.find((event) => event.id === id);
  if (approved) await saveEventToSupabase(approved);
  render();
}

async function removeRequest(id) {
  const removed = state.events.find((event) => event.id === id);
  state.events = state.events.filter((event) => event.id !== id);
  saveState();
  if (removed) await deleteEventFromSupabase(removed.date, removed.period);
  render();
}

async function createBookingFromQuote(id) {
  const quote = state.quotes.find((item) => item.id === id);
  if (!quote) return;

  state.events.push({
    id: createId(),
    date: quote.date || new Date().toISOString().slice(0, 10),
    period: quote.period,
    city: quote.city,
    venue: "Local sob análise",
    title: quote.type,
    status: "pending",
    time: "A confirmar",
    publicNote: "Solicitação recebida. Aguardando análise da equipe.",
    requester: quote.name,
    phone: quote.phone,
    notes: `${quote.duration}. ${quote.notes}`.trim(),
  });
  const booking = state.events[state.events.length - 1];
  state.quotes = state.quotes.filter((item) => item.id !== id);
  saveState();
  if (booking) await saveEventToSupabase(booking);
  render();
}

function removeQuote(id) {
  state.quotes = state.quotes.filter((quote) => quote.id !== id);
  saveState();
  render();
}

async function notifyTelegram(type, payload) {
  if (window.location.protocol === "file:") {
    return {
      ok: false,
      message: "Solicitação recebida. Para enviar ao Telegram, teste pelo site publicado no Vercel.",
    };
  }

  const controller = new AbortController();
  const timeoutMs = 12000;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/notify-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        message: data.error || "Não foi possível enviar a notificação para o Telegram.",
      };
    }

    return { ok: true, message: "Enviado" };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return {
        ok: false,
        message: "A notificação demorou demais, mas sua solicitação foi salva neste navegador.",
      };
    }
    return {
      ok: false,
      message: "Solicitação recebida, mas o Telegram não respondeu. Confira o deploy no Vercel.",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getContractText() {
  const values = Object.fromEntries(
    contractInputs.map((input) => [input.id, input.value.trim() || "________________"])
  );

  const eventDate =
    values.contractDate === "________________" ? values.contractDate : formatDate(values.contractDate);

  return `CONTRATO DE APRESENTAÇÃO MUSICAL

CONTRATANTE: ${values.contractClient}
CPF/CNPJ: ${values.contractDocument}

DATA DO EVENTO: ${eventDate}
PERÍODO: ${values.contractPeriod}
HORÁRIO: ${values.contractTime}
CIDADE/UF: ${values.contractCity}
LOCAL DO EVENTO: ${values.contractVenue}

VALOR COMBINADO: ${values.contractValue}
FORMA DE PAGAMENTO: ${values.contractPayment}

OBSERVAÇÕES:
${values.contractNotes}

As partes declaram ciência das informações acima e poderão complementar este contrato com dados internos, endereço completo e cláusulas específicas acordadas entre contratante e produção.

Assinatura do contratante: ______________________________

Assinatura do artista/produção: _________________________`;
}

function renderContract() {
  const preview = document.querySelector("#contractPreview");
  if (!preview) return;
  preview.textContent = getContractText();
}

async function downloadContractPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  let yOffset = margin;

  try {
    const imgData = await loadImageAsBase64("assets/kleber-dolli-banner.jpeg");
    doc.addImage(imgData, "JPEG", margin, yOffset, 38, 20);
    yOffset += 26;
  } catch {
    yOffset += 4;
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATO DE APRESENTAÇÃO MUSICAL", pageWidth / 2, yOffset, { align: "center" });
  yOffset += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(getContractText().replace(/^CONTRATO DE APRESENTAÇÃO MUSICAL\n\n/, ""), contentWidth);
  doc.text(lines, margin, yOffset);

  doc.save("contrato-musical.pdf");
}

async function loadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function printContract() {
  window.print();
}

function clearContractForm() {
  contractInputs.forEach((input) => {
    input.value = "";
  });
  if (document.querySelector("#contractPreview")) renderContract();
  renderAdminState();
}

function clearQuoteFormHandler() {
  quoteForm.reset();
  quoteMessage.textContent = "";
}

function clearBookingFormHandler() {
  bookingForm?.reset();
  if (formMessage) formMessage.textContent = "";
}

function setupNavActiveSection() {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll("a[href^=\"#\"]"));
  if (!links.length) return;

  const linkById = new Map();
  for (const link of links) {
    const id = (link.getAttribute("href") || "").slice(1);
    if (!id) continue;
    linkById.set(id, link);
  }

  const sections = Array.from(linkById.keys())
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (id) => {
    for (const [, link] of linkById) {
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    }
    const active = linkById.get(id);
    if (!active) return;
    active.classList.add("is-active");
    active.setAttribute("aria-current", "page");
    active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  // Hash inicial (quando abre já em #orcamento, por ex.)
  const initial = (window.location.hash || "").slice(1);
  if (initial && linkById.has(initial)) setActive(initial);

  const observer = new IntersectionObserver(
    (entries) => {
      // Pega o mais visível
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
      if (visible?.target?.id) setActive(visible.target.id);
    },
    { rootMargin: "-35% 0px -55% 0px", threshold: [0.2, 0.35, 0.5, 0.65] }
  );

  sections.forEach((section) => observer.observe(section));
}


function parseDate(value) {
  const [year, month, day] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return {
    day,
    month: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    year,
  };
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatWeekday(value) {
  const [year, month, day] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}


function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

(async function bootstrap() {
  await loadPublicConfig();
  await loadAgendaFromSupabase();
  render();
  setupNavActiveSection();
})();

// Background music
const bgMusic = document.getElementById("bgMusic");
const soundToggle = document.getElementById("soundToggle");

if (soundToggle && bgMusic) {
  const musicPrefKey = "agenda-musical-sound";
  const musicCandidates = ["assets/musica.mp3", "assets/Kleber%20Dolli.mp3"];

  const setSoundUI = (playing) => {
    soundToggle.textContent = playing ? "🔇 Pausar música" : "🎵 Ativar música";
    soundToggle.setAttribute("aria-pressed", playing ? "true" : "false");
  };

  const showSoundError = (message) => {
    setSoundUI(false);
    // Reaproveita o texto do botão como feedback curto (sem alert).
    soundToggle.textContent = "⚠️ Música indisponível";
    window.setTimeout(() => setSoundUI(false), 2200);
    console.warn("[music]", message);
  };

  bgMusic.volume = 0.35;
  bgMusic.muted = false;
  bgMusic.addEventListener("error", () => {
    showSoundError("Falha ao carregar a música. Vou tentar outra fonte se existir.");
  });

  // Restaura preferência (somente após gesto do usuário o play é permitido).
  const savedPref = localStorage.getItem(musicPrefKey);
  if (savedPref === "on") {
    // Deixa o botão "ligado", mas não tenta autoplay.
    setSoundUI(false);
  }

  async function pickWorkingMusicSrc() {
    // Se o navegador já escolheu uma fonte válida, não mexe.
    if (bgMusic.currentSrc) return bgMusic.currentSrc;

    for (const candidate of musicCandidates) {
      try {
        const res = await fetch(candidate, { method: "HEAD", cache: "no-store" });
        if (!res.ok) continue;
        bgMusic.src = candidate;
        return candidate;
      } catch {
        // tenta próximo
      }
    }
    return "";
  }

  async function tryPlayMusic() {
    const picked = await pickWorkingMusicSrc();
    if (!picked) {
      showSoundError("Não encontrei o arquivo de música no servidor (verifique o upload em assets/).");
      return;
    }

    try {
      // Ajuda em alguns celulares a “armar” o elemento antes do play.
      bgMusic.load();
    } catch {
      /* ignore */
    }

    try {
      await bgMusic.play();
      localStorage.setItem(musicPrefKey, "on");
      setSoundUI(true);
    } catch (err) {
      localStorage.setItem(musicPrefKey, "off");
      const name = err?.name || "";
      if (name === "NotAllowedError") {
        showSoundError("O celular bloqueou o áudio. Toque no botão e aumente o volume/desative o modo silencioso.");
        return;
      }
      showSoundError(err?.message || "Navegador bloqueou o áudio.");
    }
  }

  soundToggle.addEventListener("click", () => {
    if (bgMusic.paused) {
      void tryPlayMusic();
    } else {
      bgMusic.pause();
      localStorage.setItem(musicPrefKey, "off");
      setSoundUI(false);
    }
  });

  // Se o usuário preferiu "on", tenta ligar no primeiro toque em qualquer lugar da página.
  if (savedPref === "on") {
    const firstGesture = () => {
      document.removeEventListener("pointerdown", firstGesture, true);
      void tryPlayMusic();
    };
    document.addEventListener("pointerdown", firstGesture, true);
  }
}
