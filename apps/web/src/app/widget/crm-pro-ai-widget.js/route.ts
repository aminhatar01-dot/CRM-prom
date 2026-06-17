const widgetScript = `
(function () {
  var currentScript = document.currentScript;
  var token = currentScript && currentScript.getAttribute("data-widget-token");
  var apiBase = currentScript ? new URL(currentScript.src).origin : "";
  if (!token || document.getElementById("crm-pro-ai-webchat")) return;

  var state = {
    open: false,
    conversationId: window.localStorage.getItem("crmProAiConversationId:" + token),
    visitorId: window.localStorage.getItem("crmProAiVisitorId:" + token) || crypto.randomUUID(),
    widget: { name: "CRM PRO AI", primary_color: "#0f766e", initial_message: "Hola", position: "bottom-right" }
  };
  window.localStorage.setItem("crmProAiVisitorId:" + token, state.visitorId);

  var root = document.createElement("div");
  root.id = "crm-pro-ai-webchat";
  root.style.position = "fixed";
  root.style.zIndex = "2147483000";
  root.style.fontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  document.body.appendChild(root);

  function setPosition() {
    root.style.bottom = "20px";
    if (state.widget.position === "bottom-left") {
      root.style.left = "20px";
      root.style.right = "auto";
    } else {
      root.style.right = "20px";
      root.style.left = "auto";
    }
  }

  function render(messages) {
    setPosition();
    var color = state.widget.primary_color || "#0f766e";
    root.innerHTML =
      '<div style="display:' + (state.open ? "block" : "none") + ';width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 96px);background:#fff;border:1px solid #d8dee4;border-radius:8px;box-shadow:0 18px 50px rgba(15,23,42,.22);overflow:hidden;margin-bottom:12px">' +
      '<div style="background:' + color + ';color:#fff;padding:14px 16px;font-weight:700;display:flex;justify-content:space-between;align-items:center"><span>' + escapeHtml(state.widget.name || "CRM PRO AI") + '</span><button data-close style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer">x</button></div>' +
      '<div data-messages style="height:318px;overflow:auto;padding:12px;background:#f8fafc">' + renderMessages(messages || []) + '</div>' +
      '<form data-form style="display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff"><input data-input autocomplete="off" placeholder="Escribe tu mensaje" style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font-size:14px"><button style="border:0;border-radius:6px;background:' + color + ';color:#fff;padding:0 14px;cursor:pointer">Enviar</button></form>' +
      '</div>' +
      '<button data-toggle style="width:58px;height:58px;border-radius:50%;border:0;background:' + color + ';color:#fff;font-weight:700;box-shadow:0 12px 30px rgba(15,23,42,.25);cursor:pointer">Chat</button>';

    root.querySelector("[data-toggle]").onclick = function () {
      state.open = !state.open;
      if (state.open) start();
      render(messages || []);
    };
    var close = root.querySelector("[data-close]");
    if (close) close.onclick = function () { state.open = false; render(messages || []); };
    var form = root.querySelector("[data-form]");
    if (form) form.onsubmit = function (event) {
      event.preventDefault();
      var input = root.querySelector("[data-input]");
      var body = input && input.value ? input.value.trim() : "";
      if (!body || !state.conversationId) return;
      input.value = "";
      send(body);
    };
  }

  function renderMessages(messages) {
    return messages.map(function (message) {
      var outbound = message.direction === "outbound";
      return '<div style="display:flex;justify-content:' + (outbound ? "flex-start" : "flex-end") + ';margin:8px 0">' +
        '<div style="max-width:78%;border-radius:8px;padding:9px 11px;font-size:14px;line-height:1.35;background:' + (outbound ? "#fff" : "#dcfce7") + ';border:1px solid #e5e7eb;color:#0f172a">' +
        escapeHtml(message.body || "") + '</div></div>';
    }).join("");
  }

  function start() {
    fetch(apiBase + "/api/webchat/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: token,
        visitor_id: state.visitorId,
        page_url: window.location.href
      })
    }).then(function (response) {
      return response.ok ? response.json() : Promise.reject();
    }).then(function (payload) {
      state.conversationId = payload.conversation_id;
      state.widget = payload.widget || state.widget;
      window.localStorage.setItem("crmProAiConversationId:" + token, state.conversationId);
      render(payload.messages || []);
      scrollMessages();
    }).catch(function () {});
  }

  function send(body) {
    fetch(apiBase + "/api/webchat/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: token,
        visitor_id: state.visitorId,
        conversation_id: state.conversationId,
        body: body
      })
    }).then(function () { return history(); }).catch(function () {});
  }

  function history() {
    if (!state.conversationId) return;
    fetch(apiBase + "/api/webchat/history?token=" + encodeURIComponent(token) + "&conversation_id=" + encodeURIComponent(state.conversationId))
      .then(function (response) { return response.ok ? response.json() : Promise.reject(); })
      .then(function (payload) { render(payload.messages || []); scrollMessages(); })
      .catch(function () {});
  }

  function scrollMessages() {
    var box = root.querySelector("[data-messages]");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
    });
  }

  render([]);
  if (state.conversationId) history();
})();
`;

export async function GET() {
  return new Response(widgetScript, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
}
