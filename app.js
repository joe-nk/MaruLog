(function () {
  "use strict";

  var DATA_SIZE = 256;
  var DATA_TAIL_START = 128;
  var MAX_LOOP = 10000;
  var STORAGE_KEY = "quiz-scoreboard-state-v1";
  var DEFAULT_HOOKS = {
    correct: "(# $correct (+ (@ $correct) 1))",
    incorrect: "(# $incorrect (+ (@ $incorrect) 1))",
    through: "(# $correct (@ $correct))"
  };
  var RULE_DISPLAY_DEFAULTS = {
    count: "${data[0]}〇${data[1]}×",
    ny: "${score}pts",
    "10by10": "${score}pts",
    "7by7": "${score}pts",
    freeze: "${data[0]}〇${data[1]}× / ${data[6]}休み",
    custom: "${data[0]}〇${data[1]}×"
  };

  function createData() {
    return Array(DATA_SIZE).fill(0);
  }

  function defaultConfig() {
    var defaults = {
      mode: "custom",
      rule: "count",
      correctIndex: 0,
      incorrectIndex: 1,
      initialData: {
        2: 1,
        3: 1,
        4: 10,
        5: 7,
        6: 0
      },
      nyCorrectWeightIndex: 2,
      nyIncorrectWeightIndex: 3,
      tenByTenBaseIndex: 4,
      sevenBySevenBaseIndex: 5,
      freezeIndex: 6,
      displayTemplate: "${data[0]}〇${data[1]}×",
      hooks: Object.assign({}, DEFAULT_HOOKS),
      dark: false
    };
    var external = window.QUIZ_CONFIG || {};
    var merged = Object.assign({}, defaults, external);
    merged.hooks = Object.assign({}, defaults.hooks, external.hooks || {});
    merged.initialData = Object.assign({}, defaults.initialData || {}, external.initialData || {});
    return merged;
  }

  var initialConfig = defaultConfig();
  var initialData = createData();
  Object.keys(initialConfig.initialData || {}).forEach(function (key) {
    initialData[clampInitialIndex(key)] = normalizeInitialValue(initialConfig.initialData[key]);
  });
  var state = { config: initialConfig, data: initialData, history: [] };
  var dom = {};

  function clampInitialIndex(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(DATA_SIZE - 1, Math.trunc(n))) : 0;
  }

  function normalizeInitialValue(value) {
    var n = Number(value);
    return Number.isSafeInteger(n) ? Math.max(-2147483648, Math.min(2147483647, n)) : 0;
  }

  function clampIndex(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(DATA_SIZE - 1, Math.trunc(n)));
  }

  function normalizeValue(value) {
    if (value === true || value === false) return value;
    var n = Number(value);
    return Number.isSafeInteger(n) ? Math.max(-2147483648, Math.min(2147483647, n)) : 0;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      var base = defaultConfig();
      var savedConfig = saved && saved.config ? saved.config : {};
      state.config = Object.assign(base, savedConfig);
      var savedCounter = Array.isArray(savedConfig.counters) ? savedConfig.counters[0] : null;
      state.config.correctIndex = clampIndex(savedConfig.correctIndex !== undefined ? savedConfig.correctIndex : savedCounter && (savedCounter.correctIndex !== undefined ? savedCounter.correctIndex : savedCounter.dataIndex));
      state.config.incorrectIndex = clampIndex(savedConfig.incorrectIndex !== undefined ? savedConfig.incorrectIndex : savedCounter && savedCounter.incorrectIndex !== undefined ? savedCounter.incorrectIndex : 1);
      state.config.rule = normalizeRule(savedConfig.rule);
      state.config.nyCorrectWeightIndex = clampIndex(savedConfig.nyCorrectWeightIndex !== undefined ? savedConfig.nyCorrectWeightIndex : 2);
      state.config.nyIncorrectWeightIndex = clampIndex(savedConfig.nyIncorrectWeightIndex !== undefined ? savedConfig.nyIncorrectWeightIndex : 3);
      state.config.tenByTenBaseIndex = clampIndex(savedConfig.tenByTenBaseIndex !== undefined ? savedConfig.tenByTenBaseIndex : 4);
      state.config.sevenBySevenBaseIndex = clampIndex(savedConfig.sevenBySevenBaseIndex !== undefined ? savedConfig.sevenBySevenBaseIndex : 5);
      state.config.freezeIndex = clampIndex(savedConfig.freezeIndex !== undefined ? savedConfig.freezeIndex : 6);
      state.config.displayTemplate = typeof savedConfig.displayTemplate === "string" ? savedConfig.displayTemplate : state.config.displayTemplate;
      state.config.hooks = Object.assign({}, DEFAULT_HOOKS, savedConfig.hooks || {});
      state.config.dark = Boolean(savedConfig.dark);
      var sourceData = saved && Array.isArray(saved.data) ? saved.data : [];
      state.data = createData().map(function (_, i) { return normalizeValue(sourceData[i]); });
      // Migrate scoreboards saved before the built-in rule settings existed.
      if (savedConfig.rule === undefined) {
        if (state.data[2] === 0) state.data[2] = 1;
        if (state.data[3] === 0) state.data[3] = 1;
        if (state.data[4] === 0) state.data[4] = 10;
        if (state.data[5] === 0) state.data[5] = 7;
      }
    } catch (error) {
      setStatus("STORAGE RESET");
    }
  }

  function normalizeConfig() {
    state.config.rule = normalizeRule(state.config.rule);
    state.config.correctIndex = clampIndex(state.config.correctIndex);
    state.config.incorrectIndex = clampIndex(state.config.incorrectIndex);
    if (typeof state.config.displayTemplate !== "string" || !state.config.displayTemplate) {
      state.config.displayTemplate = "${data[" + state.config.correctIndex + "]}〇${data[" + state.config.incorrectIndex + "]}×";
    }
    state.config.hooks = Object.assign({}, DEFAULT_HOOKS, state.config.hooks || {});
  }

  function normalizeRule(rule) {
    return ["count", "ny", "10by10", "7by7", "freeze", "custom"].indexOf(rule) >= 0 ? rule : "count";
  }

  function persist() {
    var savedAt = dom.saveState;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: state.config, data: state.data }));
      if (savedAt) savedAt.textContent = "保存済み " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      if (savedAt) savedAt.textContent = "保存できません";
    }
  }

  function setStatus(message) {
    if (dom.statusText) dom.statusText.textContent = message;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  /* The browser runtime mirrors parser.ts and eval.ts so the app stays file://-compatible. */
  function tokenize(source) {
    var tokens = [];
    var i = 0;
    while (i < source.length) {
      var c = source[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "(") { tokens.push({ type: "lparen" }); i++; continue; }
      if (c === ")") { tokens.push({ type: "rparen" }); i++; continue; }
      if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(source[i + 1] || ""))) {
        var start = i;
        if (c === "-") i++;
        while (/[0-9]/.test(source[i] || "")) i++;
        if (source[i] === ".") throw new Error("expected a 32-bit signed integer at " + i);
        var text = source.slice(start, i);
        var value = Number(text);
        if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) throw new Error("integer out of 32-bit signed range at " + start);
        tokens.push({ type: "number", value: value });
        continue;
      }
      var symbolStart = i;
      while (i < source.length && !/\s/.test(source[i]) && source[i] !== "(" && source[i] !== ")") i++;
      var symbol = source.slice(symbolStart, i);
      if (symbol === "true" || symbol === "false") tokens.push({ type: "boolean", value: symbol === "true" });
      else tokens.push({ type: "symbol", value: symbol });
    }
    return tokens;
  }

  function parse(source) {
    var tokens = tokenize(source);
    var position = 0;
    function expression() {
      var token = tokens[position];
      if (!token) throw new Error("unexpected end of input");
      if (token.type === "number") { position++; return { type: "number", value: token.value }; }
      if (token.type === "boolean") { position++; return { type: "bool", value: token.value }; }
      if (token.type === "symbol") { position++; return { type: "symbol", name: token.value }; }
      if (token.type === "rparen") throw new Error("unexpected ')' at " + position);
      position++;
      var items = [];
      while (tokens[position] && tokens[position].type !== "rparen") items.push(expression());
      if (!tokens[position]) throw new Error("expected ')', reached end of input");
      position++;
      return { type: "list", items: items };
    }
    var result = expression();
    if (position !== tokens.length) throw new Error("unexpected token after expression");
    return result;
  }

  function evaluate(expr, data) {
    function number(value) {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) throw new Error("Number expected");
      return value;
    }
    function bool(value) {
      if (typeof value !== "boolean") throw new Error("Bool expected");
      return value;
    }
    function index(value) {
      var n = number(value);
      if (n < 0 || n >= DATA_SIZE) throw new Error("invalid data index: " + n);
      return n;
    }
    function int32(value) {
      if (!Number.isSafeInteger(value)) throw new Error("integer result is not finite");
      return value | 0;
    }
    function args(items, count, op) {
      if (items.length !== count + 1) throw new Error(op + ": expected " + count + " arguments, got " + (items.length - 1));
      return items.slice(1);
    }
    function run(node) {
      if (node.type === "number" || node.type === "bool") return node.value;
      if (node.type === "symbol") throw new Error("unexpected symbol: " + node.name);
      if (!node.items.length) throw new Error("empty expression");
      var head = node.items[0];
      /* eval.txt permits ((order-a) (order-b)); return the last value. */
      if (head.type === "list") {
        var result = false;
        node.items.forEach(function (item) { result = run(item); });
        return result;
      }
      if (head.type !== "symbol") throw new Error("operator must be a symbol");
      var op = head.name;
      if (op === "?") { var q = args(node.items, 3, op); return bool(run(q[0])) ? run(q[1]) : run(q[2]); }
      if (op === "!") {
        var loop = args(node.items, 2, op);
        for (var i = 0; i < MAX_LOOP; i++) { if (!bool(run(loop[0]))) return true; run(loop[1]); }
        return false;
      }
      if (["+", "-", "*", "/", "%", "&", "|", "^", "<", "=", "&&", "||"].indexOf(op) >= 0) {
        var pair = args(node.items, 2, op);
        var a = run(pair[0]);
        var b = run(pair[1]);
        if (op === "+") return int32(number(a) + number(b));
        if (op === "-") return int32(number(a) - number(b));
        if (op === "*") return Math.imul(number(a), number(b));
        if (op === "/" || op === "%") { var divisor = number(b); if (divisor === 0) throw new Error("Zero divide"); return int32(op === "/" ? Math.trunc(number(a) / divisor) : number(a) % divisor); }
        if (op === "&") return number(a) & number(b);
        if (op === "|") return number(a) | number(b);
        if (op === "^") return number(a) ^ number(b);
        if (op === "<") return number(a) < number(b);
        if (op === "=") return a === b;
        if (op === "&&") return bool(a) && bool(b);
        return bool(a) || bool(b);
      }
      if (op === "~") { var bit = args(node.items, 1, op); return ~number(run(bit[0])); }
      if (op === "~~") { var not = args(node.items, 1, op); return !bool(run(not[0])); }
      if (op === "@") { var get = args(node.items, 1, op); var value = data[index(run(get[0]))]; return typeof value === "number" ? number(value) : value; }
      if (op === "#") { var set = args(node.items, 2, op); var target = index(run(set[0])); var next = run(set[1]); if (typeof next === "number") number(next); data[target] = next; return next; }
      throw new Error("unknown operator: " + op);
    }
    return run(expr);
  }

  function runHook(kind) {
    if (state.config.rule !== "custom") {
      runDefaultRule(kind);
      return;
    }
    var source = String(state.config.hooks[kind] || "")
      .replace(/\$correct\b/g, String(state.config.correctIndex))
      .replace(/\$incorrect\b/g, String(state.config.incorrectIndex))
      .replace(/\$i\b/g, String(state.config.correctIndex));
    if (!source.trim()) return;
    var previous = state.data.slice();
    var result = evaluate(parse(source), state.data);
    state.history.push(previous);
    if (state.history.length > 50) state.history.shift();
    setStatus(kind.toUpperCase() + " => " + String(result));
    persist();
    renderDashboard();
    refreshTailEditor();
  }

  function dataNumber(index) {
    var value = state.data[clampIndex(index)];
    return typeof value === "number" ? value : 0;
  }

  function calculateScore() {
    var correct = dataNumber(state.config.correctIndex);
    var incorrect = dataNumber(state.config.incorrectIndex);
    switch (state.config.rule) {
      case "ny":
        return correct * dataNumber(state.config.nyCorrectWeightIndex) - incorrect * dataNumber(state.config.nyIncorrectWeightIndex);
      case "10by10":
        return correct * (dataNumber(state.config.tenByTenBaseIndex) - incorrect);
      case "7by7":
        return correct * (dataNumber(state.config.sevenBySevenBaseIndex) - incorrect);
      default:
        return correct;
    }
  }

  function writeData(index, value) {
    state.data[clampIndex(index)] = normalizeValue(value);
  }

  function runDefaultRule(kind) {
    var previous = state.data.slice();
    var correct = dataNumber(state.config.correctIndex);
    var incorrect = dataNumber(state.config.incorrectIndex);
    var freeze = dataNumber(state.config.freezeIndex);

    if (state.config.rule === "freeze" && freeze > 0 && kind !== "through") {
      setStatus("FREEZE: " + freeze + "回休み");
      return;
    }
    if (kind === "correct") writeData(state.config.correctIndex, correct + 1);
    if (kind === "incorrect") {
      writeData(state.config.incorrectIndex, incorrect + 1);
      if (state.config.rule === "freeze") writeData(state.config.freezeIndex, incorrect + 1);
    }
    if (kind === "through" && state.config.rule === "freeze") {
      writeData(state.config.freezeIndex, Math.max(0, freeze - 1));
    }
    if (kind === "through" && state.config.rule !== "freeze") return;
    if (kind !== "correct" && kind !== "incorrect" && kind !== "through") return;
    if (JSON.stringify(previous) === JSON.stringify(state.data)) return;
    state.history.push(previous);
    if (state.history.length > 50) state.history.shift();
    setStatus(state.config.rule.toUpperCase() + " => " + String(calculateScore()));
    persist();
    renderDashboard();
    refreshTailEditor();
  }

  function pushHistory() {
    state.history.push(state.data.slice());
    if (state.history.length > 50) state.history.shift();
  }

  function resetScoreData() {
    var nextData = createData();
    ["nyCorrectWeightIndex", "nyIncorrectWeightIndex", "tenByTenBaseIndex", "sevenBySevenBaseIndex"].forEach(function (key) {
      var index = clampIndex(state.config[key]);
      nextData[index] = state.data[index];
    });
    return nextData;
  }

  function renderDashboard() {
    dom.scoreTotal.textContent = renderDisplayTemplate(state.config.displayTemplate);
    dom.undo.disabled = state.history.length === 0;
    dom.displayTemplate.value = state.config.displayTemplate;
    dom.ruleSelect.value = state.config.rule;
    dom.customHooks.hidden = state.config.rule !== "custom";
    renderRuleSettings();
  }

  function renderDisplayTemplate(template) {
    return template.replace(/\$\{score\}/g, String(calculateScore())).replace(/\$\{data\[(\d{1,3})\]\}/g, function (_, rawIndex) {
      var index = Number(rawIndex);
      return index >= 0 && index < DATA_SIZE ? String(state.data[index]) : "";
    });
  }

  function updateDefaultDisplayIndex(key, oldIndex, newIndex) {
    var template = state.config.displayTemplate;
    if (key === "correctIndex") {
      if (template === "${data[" + oldIndex + "]}〇${data[" + state.config.incorrectIndex + "]}×") template = "${data[" + newIndex + "]}〇${data[" + state.config.incorrectIndex + "]}×";
      if (template === "${data[" + oldIndex + "]}〇${data[" + state.config.incorrectIndex + "]}× / ${data[" + state.config.freezeIndex + "]}休み") template = "${data[" + newIndex + "]}〇${data[" + state.config.incorrectIndex + "]}× / ${data[" + state.config.freezeIndex + "]}休み";
    }
    if (key === "incorrectIndex") {
      if (template === "${data[" + state.config.correctIndex + "]}〇${data[" + oldIndex + "]}×") template = "${data[" + state.config.correctIndex + "]}〇${data[" + newIndex + "]}×";
      if (template === "${data[" + state.config.correctIndex + "]}〇${data[" + oldIndex + "]}× / ${data[" + state.config.freezeIndex + "]}休み") template = "${data[" + state.config.correctIndex + "]}〇${data[" + newIndex + "]}× / ${data[" + state.config.freezeIndex + "]}休み";
    }
    if (key === "freezeIndex" && template === "${data[" + state.config.correctIndex + "]}〇${data[" + state.config.incorrectIndex + "]}× / ${data[" + oldIndex + "]}休み") {
      template = "${data[" + state.config.correctIndex + "]}〇${data[" + state.config.incorrectIndex + "]}× / ${data[" + newIndex + "]}休み";
    }
    state.config.displayTemplate = template;
  }

  function renderRuleSettings() {
    var rows = [
      ["〇 counter", "correctIndex", state.config.correctIndex, "〇 data index"],
      ["× counter", "incorrectIndex", state.config.incorrectIndex, "× data index"]
    ];
    if (state.config.rule === "ny") {
      rows.push(["〇 multiplier", "nyCorrectWeightIndex", state.config.nyCorrectWeightIndex, "value: " + dataNumber(state.config.nyCorrectWeightIndex)]);
      rows.push(["× multiplier", "nyIncorrectWeightIndex", state.config.nyIncorrectWeightIndex, "value: " + dataNumber(state.config.nyIncorrectWeightIndex)]);
    }
    if (state.config.rule === "10by10") rows.push(["base value", "tenByTenBaseIndex", state.config.tenByTenBaseIndex, "value: " + dataNumber(state.config.tenByTenBaseIndex)]);
    if (state.config.rule === "7by7") rows.push(["base value", "sevenBySevenBaseIndex", state.config.sevenBySevenBaseIndex, "value: " + dataNumber(state.config.sevenBySevenBaseIndex)]);
    if (state.config.rule === "freeze") rows.push(["freeze remaining", "freezeIndex", state.config.freezeIndex, "value: " + dataNumber(state.config.freezeIndex)]);
    var formulas = {
      count: "n〇m×: data値をそのまま表示",
      ny: "NY: correct × data[〇係数] - incorrect × data[×係数]",
      "10by10": "10by10: correct × (data[基準値] - incorrect)",
      "7by7": "7by7: correct × (data[基準値] - incorrect)",
      freeze: "Freeze: n回目の誤答でn回休み。スルーで残り休みを減らします",
      custom: "custom: 下のS式フックを実行"
    };
    dom.ruleFormula.textContent = formulas[state.config.rule];
    dom.ruleSettings.innerHTML = rows.map(function (row) {
      var index = row[2];
      var valueInput = row[1].indexOf("Index") >= 0 && row[1] !== "correctIndex" && row[1] !== "incorrectIndex" ? '<label class="field">data value<input data-rule-value="' + row[1] + '" type="number" value="' + escapeHtml(dataNumber(index)) + '"></label>' : '<span></span>';
      return '<div class="rule-setting"><label class="field">' + row[0] + '<input data-rule-index="' + row[1] + '" type="number" min="0" max="255" value="' + escapeHtml(index) + '"></label>' + valueInput + '<span class="rule-data-hint">' + row[3] + '</span></div>';
    }).join("");
  }

  function refreshTailEditor() {
    var lines = [];
    for (var i = DATA_TAIL_START; i < DATA_SIZE; i++) lines.push(String(state.data[i]));
    dom.dataTail.value = lines.join("\n");
  }

  function applyTail() {
    var lines = dom.dataTail.value.replace(/\r/g, "").split("\n");
    if (lines.length > DATA_SIZE - DATA_TAIL_START) {
      dom.dataError.textContent = "128行を超えています。";
      return;
    }
    var nextData = state.data.slice();
    for (var i = 0; i < lines.length; i++) {
      var text = lines[i].trim();
      if (!text) continue;
      var value;
      if (text === "true" || text === "false") value = text === "true";
      else if (/^-?\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text) >= -2147483648 && Number(text) <= 2147483647) value = Number(text);
      else { dom.dataError.textContent = "data[" + (DATA_TAIL_START + i) + "] は整数または true / false にしてください。"; return; }
      nextData[DATA_TAIL_START + i] = value;
    }
    dom.dataError.textContent = "";
    pushHistory();
    state.data = nextData;
    persist();
    renderDashboard();
    setStatus("DATA[128..255] UPDATED");
  }

  function bindEvents() {
    document.querySelector(".action-grid").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-action]");
      if (!button) return;
      try { runHook(button.dataset.action); }
      catch (error) { setStatus("ERROR: " + error.message); }
    });
    dom.ruleSelect.addEventListener("change", function (event) {
      var previousRule = state.config.rule;
      var nextRule = normalizeRule(event.target.value);
      if (dom.displayTemplate.value === (RULE_DISPLAY_DEFAULTS[previousRule] || "")) {
        state.config.displayTemplate = RULE_DISPLAY_DEFAULTS[nextRule];
      }
      state.config.rule = nextRule;
      persist();
      renderDashboard();
      setStatus("RULE: " + nextRule);
    });
    dom.ruleSettings.addEventListener("change", function (event) {
      var target = event.target;
      var key = target.dataset.ruleIndex;
      if (key) {
        var oldIndex = state.config[key];
        state.config[key] = clampIndex(target.value);
        updateDefaultDisplayIndex(key, oldIndex, state.config[key]);
        persist();
        renderDashboard();
        return;
      }
      var valueKey = target.dataset.ruleValue;
      if (valueKey) {
        var indexKey = valueKey;
        writeData(state.config[indexKey], target.value);
        persist();
        renderDashboard();
      }
    });
    dom.displayTemplate.addEventListener("change", function (event) {
      state.config.displayTemplate = event.target.value || "${data[" + state.config.correctIndex + "]}〇${data[" + state.config.incorrectIndex + "]}×";
      persist(); renderDashboard();
    });
    ["correct", "incorrect", "through"].forEach(function (kind) {
      dom["hook" + kind[0].toUpperCase() + kind.slice(1)].addEventListener("change", function (event) {
        state.config.hooks[kind] = event.target.value; persist();
      });
    });
    dom.resetHooks.addEventListener("click", function () { state.config.hooks = Object.assign({}, DEFAULT_HOOKS); syncHookEditors(); persist(); setStatus("DEFAULT HOOKS RESTORED"); });
    dom.resetData.addEventListener("click", function () { pushHistory(); state.data = resetScoreData(); persist(); renderDashboard(); refreshTailEditor(); setStatus("SCORES RESET"); });
    dom.undo.addEventListener("click", function () {
      if (!state.history.length) return;
      state.data = state.history.pop();
      persist(); renderDashboard(); refreshTailEditor(); setStatus("UNDO");
    });
    dom.applyTail.addEventListener("click", applyTail);
    dom.themeToggle.addEventListener("click", function () { state.config.dark = !state.config.dark; applyTheme(); persist(); });
    dom.configToggle.addEventListener("click", function () {
      var opening = dom.configPanel.hidden;
      dom.configPanel.hidden = !opening;
      dom.configToggle.setAttribute("aria-expanded", String(opening));
      if (opening) dom.configPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function syncHookEditors() {
    dom.hookCorrect.value = state.config.hooks.correct;
    dom.hookIncorrect.value = state.config.hooks.incorrect;
    dom.hookThrough.value = state.config.hooks.through;
  }

  function applyTheme() {
    document.documentElement.classList.toggle("dark", state.config.dark);
    dom.themeToggle.textContent = state.config.dark ? "Light" : "Dark";
    dom.themeToggle.setAttribute("aria-pressed", String(state.config.dark));
  }

  function init() {
    dom = {
      scoreTotal: document.getElementById("score-total"),
      displayTemplate: document.getElementById("display-template"),
      hookCorrect: document.getElementById("hook-correct"),
      hookIncorrect: document.getElementById("hook-incorrect"),
      hookThrough: document.getElementById("hook-through"),
      dataTail: document.getElementById("data-tail"),
      dataError: document.getElementById("data-error"),
      applyTail: document.getElementById("apply-tail"),
      resetData: document.getElementById("reset-data"),
      undo: document.getElementById("undo"),
      resetHooks: document.getElementById("reset-hooks"),
      themeToggle: document.getElementById("theme-toggle"),
      configToggle: document.getElementById("config-toggle"),
      configPanel: document.getElementById("config-panel"),
      ruleSelect: document.getElementById("rule-select"),
      ruleSettings: document.getElementById("rule-settings"),
      ruleFormula: document.getElementById("rule-formula"),
      customHooks: document.getElementById("custom-hooks"),
      statusText: document.getElementById("status-text"),
      saveState: document.getElementById("save-state"),
      modeLabel: document.getElementById("mode-label")
    };
    loadState();
    normalizeConfig();
    if (dom.modeLabel) dom.modeLabel.textContent = String(state.config.mode || "custom").toUpperCase();
    syncHookEditors(); applyTheme(); renderDashboard(); refreshTailEditor(); bindEvents();
  }

  init();
}());
