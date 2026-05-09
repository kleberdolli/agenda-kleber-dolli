const storageKey = "agenda-musical-demo";

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

const eventGrid = document.querySelector("#eventGrid");
const requestList = document.querySelector("#requestList");
const bookingForm = document.querySelector("#bookingForm");
const quoteForm = document.querySelector("#quoteForm");
const formMessage = document.querySelector("#formMessage");
const quoteMessage = document.querySelector("#quoteMessage");
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

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const booking = {
    id: createId(),
    date: document.querySelector("#dateInput").value,
    period: document.querySelector("#periodInput").value,
    city: document.querySelector("#cityInput").value.trim(),
    venue: "Local sob análise",
    title: document.querySelector("#eventTypeInput").value,
    status: "pending",
    time: "A confirmar",
    publicNote: "Solicitação recebida. Aguardando análise da equipe.",
    requester: document.querySelector("#nameInput").value.trim(),
    phone: document.querySelector("#phoneInput").value.trim(),
    notes: document.querySelector("#notesInput").value.trim(),
  };

  state.events.push(booking);
  saveState();
  const bookingNotification = await notifyTelegram("pre-reserva", booking);
  bookingForm.reset();
  formMessage.textContent = bookingNotification.ok
    ? "Pré-reserva enviada. Ela já aparece como data em análise."
    : `Pré-reserva salva, mas não foi possível notificar: ${bookingNotification.message}`;
  activeFilter = "all";
  document.querySelectorAll(".filter").forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === "all");
  });
  render();
});

quoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const quote = {
    id: createId(),
    name: document.querySelector("#quoteName").value.trim(),
    phone: document.querySelector("#quotePhone").value.trim(),
    city: document.querySelector("#quoteCity").value.trim(),
    date: document.querySelector("#quoteDate").value,
    period: document.querySelector("#quotePeriod").value,
    type: document.querySelector("#quoteType").value,
    duration: document.querySelector("#quoteDuration").value,
    notes: document.querySelector("#quoteNotes").value.trim(),
    createdAt: new Date().toISOString(),
  };

  state.quotes.push(quote);
  saveState();
  const notification = await notifyTelegram("orcamento", quote);
  quoteForm.reset();
  quoteMessage.textContent = notification.ok
    ? "Solicitação de orçamento recebida e enviada para o Telegram."
    : notification.message;
  render();
});


document.querySelector("#downloadContract")?.addEventListener("click", downloadContractPDF);
document.querySelector("#printContract")?.addEventListener("click", printContract);
document.querySelector("#clearContract")?.addEventListener("click", clearContractForm);
document.querySelector("#clearQuoteForm")?.addEventListener("click", clearQuoteFormHandler);
document.querySelector("#clearBookingForm")?.addEventListener("click", clearBookingFormHandler);
contractInputs.filter(Boolean).forEach((input) => input.addEventListener("input", renderContract));

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
  localStorage.setItem(storageKey, JSON.stringify(state));
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
}

function renderCounters(events) {
  document.querySelector("#confirmedCount").textContent = countByStatus(events, "confirmed");
  document.querySelector("#availableCount").textContent = countByStatus(events, "available");
  document.querySelector("#pendingCount").textContent = countByStatus(events, "pending");
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

function approveRequest(id) {
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
  render();
}

function removeRequest(id) {
  state.events = state.events.filter((event) => event.id !== id);
  saveState();
  render();
}

function createBookingFromQuote(id) {
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
  state.quotes = state.quotes.filter((item) => item.id !== id);
  saveState();
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

  try {
    const response = await fetch("/api/notify-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        message: data.error || "Não foi possível enviar a notificação para o Telegram.",
      };
    }

    return { ok: true, message: "Enviado" };
  } catch {
    return {
      ok: false,
      message: "Solicitação recebida, mas o Telegram não respondeu. Confira o deploy no Vercel.",
    };
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
}

function clearQuoteFormHandler() {
  quoteForm.reset();
  quoteMessage.textContent = "";
}

function clearBookingFormHandler() {
  bookingForm.reset();
  formMessage.textContent = "";
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

render();
