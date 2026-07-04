(function () {
  "use strict";

  var api = window.carvis;
  if (!api) {
    document.body.innerHTML = '<div style="padding:40px;color:#e04c5f;">preload not loaded — contextIsolation may be broken</div>';
    return;
  }

  var panelsGrid = document.getElementById("panels-grid");
  var outputsList = document.getElementById("outputs-list");
  var commandInput = document.getElementById("command-input");
  var commandSubmit = document.getElementById("command-submit");

  var statActive = document.getElementById("stat-active");
  var statIdle = document.getElementById("stat-idle");
  var statRetained = document.getElementById("stat-retained");
  var statQueue = document.getElementById("stat-queue");

  var panelMap = Object.create(null);

  api.onStateUpdated(function (state) {
    render(state);
  });

  api.getState().then(function (state) {
    if (state) render(state);
  });

  function render(state) {
    if (!state) return;

    statActive.textContent = state.runtime.activePidCount;
    statIdle.textContent = state.runtime.idlePidCount;
    statRetained.textContent = state.runtime.retainedPidCount;
    statQueue.textContent = state.runtime.queueDepth;

    renderPanels(state.panels);
    renderOutputs(state.outputs);
  }

  function renderPanels(panels) {
    if (!panels || panels.length === 0) return;

    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var existingEl = panelMap[panel.role];

      if (!existingEl) {
        existingEl = createPanelElement(panel.role, panel.title);
        panelMap[panel.role] = existingEl;
        panelsGrid.appendChild(existingEl);
      }

      updatePanelElement(existingEl, panel);
    }
  }

  function createPanelElement(role, label) {
    var div = document.createElement("div");
    div.className = "panel " + role;

    var header = document.createElement("div");
    header.className = "panel-header";

    var roleSpan = document.createElement("span");
    roleSpan.className = "panel-role";
    roleSpan.textContent = label;

    var statusSpan = document.createElement("span");
    statusSpan.className = "panel-status";
    statusSpan.textContent = "—";

    header.appendChild(roleSpan);
    header.appendChild(statusSpan);

    var info = document.createElement("div");
    info.className = "panel-info";

    var preview = document.createElement("div");
    preview.className = "panel-output-preview";

    div.appendChild(header);
    div.appendChild(info);
    div.appendChild(preview);

    return div;
  }

  function updatePanelElement(el, panel) {
    var statusEl = el.querySelector(".panel-status");
    var infoEl = el.querySelector(".panel-info");
    var previewEl = el.querySelector(".panel-output-preview");

    statusEl.textContent = panel.status;
    statusEl.className = "panel-status status-" + panel.status;

    var pidText = panel.pid !== undefined ? "PID " + panel.pid : "—";
    var hbText = panel.lastHeartbeatAt ? "HB " + formatTime(panel.lastHeartbeatAt) : "";

    infoEl.innerHTML =
      '<span>' + pidText + "</span>" +
      (hbText ? "<span>" + hbText + "</span>" : "");

    if (panel.latestOutput) {
      previewEl.textContent = panel.latestOutput;
      previewEl.style.display = "";
    } else {
      previewEl.style.display = "none";
    }
  }

  function renderOutputs(outputs) {
    if (!outputs || outputs.length === 0) {
      outputsList.innerHTML = '<div class="outputs-empty">No outputs yet.</div>';
      return;
    }

    outputsList.className = "";
    var html = "";

    for (var i = 0; i < outputs.length; i++) {
      var out = outputs[i];
      html +=
        '<div class="output-entry">' +
        '<span class="output-path">' + escapeHtml(out.outputPath) + "</span>" +
        '<button class="output-open-btn" data-path="' + escapeAttr(out.outputPath) + '">Open</button>' +
        "</div>";
    }

    outputsList.innerHTML = html;

    var buttons = outputsList.querySelectorAll(".output-open-btn");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener("click", function () {
        var filePath = this.getAttribute("data-path");
        if (filePath) api.openOutput(filePath);
      });
    }
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch (_) {
      return iso;
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  commandSubmit.addEventListener("click", function () {
    submitCommand();
  });

  commandInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCommand();
    }
  });

  function submitCommand() {
    var text = commandInput.value.trim();
    if (text.length === 0) return;

    api.submitCommand(text);
    commandInput.value = "";
  }
})();
