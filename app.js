const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");
const STORAGE_KEY = "adch-progress-v1";
const traits = [
  "持续注意",
  "另辟蹊径",
  "对象恒常性",
  "视觉注意力",
  "质疑前提",
  "边界判断",
  "整体意识",
  "拒绝无效目标",
];

let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"level":0,"done":[],"settings":{}}');
let runtime = {};
const activePointers = new Map();
const behaviorProfiles = [
  { elapsed: 700, actions: 1, press: 650 },
  { elapsed: 800, actions: 2, drags: 1 },
  { elapsed: 1100, actions: 5, travel: 60 },
  { elapsed: 1000, actions: 4, travel: 45 },
  { elapsed: 1100, actions: 6, travel: 60 },
  { elapsed: 1400, actions: 8, travel: 80, inputs: 1 },
  { elapsed: 1400, actions: 8, travel: 80, inputs: 1 },
  { elapsed: 1200, actions: 4, drags: 1 },
];

function freshBehavior(level = state.level) {
  return {
    level,
    startedAt: performance.now(),
    actions: 0,
    drags: 0,
    inputs: 0,
    travel: 0,
    longestPress: 0,
    lastPoint: null,
  };
}

let humanBehavior = freshBehavior();

function resetHumanBehavior(level = state.level) {
  activePointers.clear();
  humanBehavior = freshBehavior(level);
}

function currentHumanBehavior() {
  if (humanBehavior.level !== state.level) resetHumanBehavior();
  return humanBehavior;
}

function hasHumanBehavior() {
  const evidence = currentHumanBehavior();
  const profile = behaviorProfiles[state.level];
  if (!profile) return false;
  return performance.now() - evidence.startedAt >= profile.elapsed
    && evidence.actions >= profile.actions
    && evidence.drags >= (profile.drags || 0)
    && evidence.inputs >= (profile.inputs || 0)
    && evidence.travel >= (profile.travel || 0)
    && evidence.longestPress >= (profile.press || 0);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function vibrate(pattern = 20) {
  if (state.settings.vibration !== false && navigator.vibrate) navigator.vibrate(pattern);
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function tone(freq, duration, type = "square", gain = 0.06, delay = 0) {
  if (state.settings.sound === false) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}
function slide(freqStart, freqEnd, duration, type = "square", gain = 0.06, delay = 0) {
  if (state.settings.sound === false) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), t + duration);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}
const sfx = {
  tap:    () => tone(520, 0.05, "square", 0.04),
  place:  () => tone(660, 0.04, "square", 0.05),
  remove: () => tone(330, 0.04, "square", 0.04),
  connect:() => { tone(523, 0.06, "triangle", 0.05); tone(784, 0.08, "triangle", 0.05, 0.05); },
  success:() => { tone(587, 0.10, "triangle", 0.07); tone(880, 0.15, "triangle", 0.07, 0.08); },
  fail:   () => slide(220, 110, 0.20, "sawtooth", 0.05),
  complete: () => { tone(523, 0.10, "triangle", 0.07); tone(659, 0.10, "triangle", 0.07, 0.10); tone(784, 0.20, "triangle", 0.08, 0.20); },
  draw:   () => tone(440, 0.02, "sine", 0.02),
};

function shell({ title, prompt, body, controls = "", feedback = "", home = false }) {
  const dots = Array.from({ length: 8 }, (_, index) => `<i class="${state.done.includes(index) ? "done" : index === state.level ? "current" : ""}"></i>`).join("");
  return `
    <div class="app ${home ? "intro-page" : ""}">
      <div class="device-statusbar" aria-hidden="true"></div>
      <header class="topbar">
        <div><div class="eyebrow">CAPTCHA//PUZZLE GAME 自动验证测试</div><div class="confidence">人类置信度 ${Math.min(98, 16 + state.done.length * 11)}%</div></div>
        <div class="top-actions"><button class="button secondary" id="settings" aria-label="设置">设置</button></div>
      </header>
      <div class="progress" aria-label="测试进度">${dots}</div>
      ${home ? "" : `<section class="card">
        <div class="eyebrow">TEST ${String(state.level).padStart(2, "0")} / 07</div>
        <h1 class="title">${title}</h1>
        <p class="prompt">${prompt}</p>
      </section>`}
      <section class="board-wrap">${body}</section>
      <p class="feedback ${runtime.ok ? "ok" : ""}">${feedback}</p>
      ${controls}
      <section class="record ${state.done.length ? "" : "record-empty"}" ${state.done.length ? "" : 'aria-hidden="true"'}><h2>已确认的人类特征</h2><div class="record-list">${state.done.map((n) => `<span>${traits[n]}</span>`).join("")}</div></section>
    </div>
  `;
}

function common() {
  $("#settings")?.addEventListener("click", () => {
    app.insertAdjacentHTML("beforeend", `
      <div class="modal" id="modal"><section class="card">
        <div class="eyebrow">LOCAL SETTINGS</div><h2 class="title">测试设置</h2>
        <p class="caption">所有解题数据仅保存在此设备。</p>
        <p><button class="button secondary" id="sound">音效：${state.settings.sound === false ? "关" : "开"}</button></p>
        <p><button class="button secondary" id="vibration">振动：${state.settings.vibration === false ? "关" : "开"}</button></p>
        <p><button class="button secondary" id="reset">清除全部进度</button></p>
        <button class="button" id="close">返回测试</button>
      </section></div>`);
    $("#close").onclick = () => { sfx.tap(); $("#modal").remove(); };
    $("#sound").onclick = () => { state.settings.sound = state.settings.sound === false; sfx.tap(); save(); $("#modal").remove(); render(); };
    $("#vibration").onclick = () => { state.settings.vibration = state.settings.vibration === false; sfx.tap(); save(); $("#modal").remove(); render(); };
    $("#reset").onclick = () => { sfx.tap(); state = { level: 0, done: [], settings: state.settings }; runtime = {}; resetHumanBehavior(); save(); $("#modal").remove(); render(); };
  });
}

function complete() {
  if (!hasHumanBehavior()) return fail("验证未通过。");
  if (!state.done.includes(state.level)) state.done.push(state.level);
  state.level += 1;
  resetHumanBehavior();
  save();
  vibrate([30, 30, 90]);
  sfx.complete();
  app.insertAdjacentHTML("beforeend", `
    <div class="modal" id="modal"><section class="card success-modal">
      <h2 class="title">通过验证</h2>
      <button class="button" id="next">继续验证</button>
    </section></div>`);
  $("#next").onclick = () => { sfx.tap(); $("#modal").remove(); runtime = {}; resetHumanBehavior(); render(); };
}

function fail(text) {
  runtime.ok = false;
  runtime.feedback = text;
  vibrate([35, 45, 35]);
  sfx.fail();
  render();
}

function fitBoardToViewport() {
  const wrap = $(".board-wrap");
  const board = wrap?.firstElementChild;
  if (!wrap || !board) return;
  board.style.transform = "none";
  board.style.boxShadow = "";
  board.style.flexShrink = "0";
  const rect = board.getBoundingClientRect();
  const contentHeight = Math.max(rect.height, board.scrollHeight);
  const scale = Math.min(1, (wrap.clientWidth - 10) / rect.width, (wrap.clientHeight - 38) / contentHeight);
  if (scale < 1) {
    board.style.transform = `scale(${scale})`;
    board.style.transformOrigin = "center center";
    if (getComputedStyle(board).boxShadow !== "none") {
      const shadowOffset = 5 / scale;
      board.style.boxShadow = `${shadowOffset}px ${shadowOffset}px 0 #121212`;
    }
  }
}

function render() {
  runtime = { ...runtime, feedback: runtime.feedback || "" };
  const levels = [intro, slider, masyu, lightUp, sudoku, slither, hashi, finale];
  levels[Math.min(state.level, 7)]();
  common();
  requestAnimationFrame(fitBoardToViewport);
}

function intro() {
  let holding = false, started = 0, frame;
  app.innerHTML = shell({
    title: "我不是机器人",
    prompt: "请勾选下方方框开始游戏。",
    home: true,
    body: `<div class="landing">
      <header class="card landing-hero">
        <div class="landing-kicker"><span>PUZZLE GAME</span><span>8 LEVELS</span></div>
        <h1 class="landing-title">
          <span class="landing-title-lead"><span class="robot-icon" aria-hidden="true">🤖</span>全自动区分</span>
          <span class="landing-title-pair"><strong class="machine-label">计算机</strong><span>与</span><strong class="human-label">人类</strong></span>
          <span>的图灵测试</span>
        </h1>
        <p class="landing-sub"><span>只有人类能过关的解谜游戏</span></p>
      </header>
      <div class="start-caption"><span>TEST 00</span><b>勾选下方方框开始游戏</b></div>
      <div class="check-zone" id="check"><div class="checkbox" id="box"></div><div class="check-copy"><b>我不是机器人</b><div class="hold-meter"><i id="meter"></i><span class="hold-target"></span></div></div></div>
    </div>`,
    feedback: runtime.feedback,
  });
  const check = $("#check"), meter = $("#meter"), box = $("#box");
  function tick(now) {
    if (!holding) return;
    const pct = Math.min(100, ((now - started) / 1500) * 100);
    runtime.holdProgress = pct;
    meter.style.width = `${pct}%`;
    if (pct >= 100) {
      holding = false;
      fail("验证未通过。");
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  check.onpointerdown = (event) => {
    event.preventDefault();
    sfx.tap();
    holding = true; started = performance.now(); box.classList.add("holding");
    check.setPointerCapture?.(event.pointerId); frame = requestAnimationFrame(tick);
  };
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => check.addEventListener(name, () => {
    if (!holding) return;
    holding = false; cancelAnimationFrame(frame); box.classList.remove("holding");
    if (name === "pointerup" && runtime.holdProgress >= 59 && runtime.holdProgress <= 69) {
      box.textContent = "✓";
      complete();
      return;
    }
    fail("验证未通过。");
  }));
}

function slider() {
  const prior = runtime.slider ?? 0;
  const targetPosition = runtime.targetPosition ?? 66;
  app.innerHTML = shell({
    title: "滑动解锁",
    prompt: "拖动滑条至目标区域。",
    body: `<div class="slider-box"><div class="slider-track"><button id="target" class="target" style="left:${targetPosition}%" aria-label="目标区域"></button><input id="slider" type="range" min="0" max="100" value="${prior}" aria-label="拖动拼图块"></div></div>`,
    feedback: runtime.feedback,
  });
  const sliderNode = $("#slider");
  sliderNode.oninput = () => {
    const positions = [66, 18, 76, 39];
    const value = Number(sliderNode.value);
    const activeIndex = runtime.targetIndex ?? 0;
    const currentTarget = runtime.targetPosition ?? targetPosition;
    runtime.slider = Number(sliderNode.value);
    if (value < currentTarget || value > currentTarget + 14) return;
    runtime.targetIndex = (activeIndex + 1) % positions.length;
    runtime.targetPosition = positions[runtime.targetIndex];
    $("#target").style.left = `${runtime.targetPosition}%`;
  };
  $("#target").onclick = () => { sfx.connect(); complete(); };
}

const lightUpBoards = [
  { size: 4, blocks: [0, 5], clues: { 0: 2, 5: 3 }, dots: [] },
  { size: 6, blocks: [0, 8, 12, 13, 16, 20, 24], clues: { 0: 1, 16: 3, 24: 2 } },
];
function lightUp() {
  const boardIndex = runtime.lightUpStage || 0;
  const board = lightUpBoards[boardIndex];
  const { size, clues } = board;
  const blocked = new Set(board.blocks);
  const lights = new Set(runtime.lightUp || []);
  const isBlack = (index) => blocked.has(index);
  const neighbors = (index) => {
    const row = Math.floor(index / size), column = index % size;
    return [row > 0 ? index - size : -1, row < size - 1 ? index + size : -1, column > 0 ? index - 1 : -1, column < size - 1 ? index + 1 : -1]
      .filter((cell) => cell >= 0);
  };
  const isSolved = (candidate) => {
    const lit = new Set();
    let collision = false;
    candidate.forEach((start) => {
      lit.add(start);
      const row = Math.floor(start / size), column = start % size;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dy, dx]) => {
        let y = row + dy, x = column + dx;
        while (y >= 0 && y < size && x >= 0 && x < size) {
          const index = y * size + x;
          if (isBlack(index)) break;
          if (candidate.has(index)) collision = true;
          lit.add(index);
          y += dy;
          x += dx;
        }
      });
    });
    return !collision
      && Object.entries(clues).every(([index, count]) => neighbors(Number(index)).filter((cell) => candidate.has(cell)).length === count)
      && Array.from({ length: size * size }, (_, index) => index).filter((index) => !isBlack(index)).every((index) => lit.has(index));
  };
  const illuminated = new Set();
  const collidingLights = new Set();
  let lightsConflict = false;
  lights.forEach((start) => {
    illuminated.add(start);
    const row = Math.floor(start / size), column = start % size;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dy, dx]) => {
      let y = row + dy, x = column + dx;
      while (y >= 0 && y < size && x >= 0 && x < size) {
        const index = y * size + x;
        if (isBlack(index)) break;
        if (lights.has(index)) {
          lightsConflict = true;
          collidingLights.add(start);
          collidingLights.add(index);
        }
        illuminated.add(index);
        y += dy;
        x += dx;
      }
    });
  });
  const clueOverages = new Set(Object.entries(clues)
    .filter(([index, count]) => neighbors(Number(index)).filter((cell) => lights.has(cell)).length > count)
    .map(([index]) => Number(index)));
  const clueMatches = new Set(Object.entries(clues)
    .filter(([index, count]) => neighbors(Number(index)).filter((cell) => lights.has(cell)).length === count)
    .map(([index]) => Number(index)));
  app.innerHTML = shell({
    title: "点亮所有格子",
    prompt: "将所有格子点亮为黄色",
    body: `<div class="lightup-grid" id="lightup" style="--grid-size:${size}">${Array.from({ length: size * size }, (_, index) => {
      if (isBlack(index)) return `<div class="lightup-cell blackout ${Object.hasOwn(clues, index) ? clueOverages.has(index) ? "clue-over" : clueMatches.has(index) ? "clue-met" : "" : "no-clue"}" aria-label="遮挡图块${clues[index] ? `，识别数字 ${clues[index]}` : ""}">${clues[index] || ""}</div>`;
      return `<button class="lightup-cell ${illuminated.has(index) ? "lit" : ""} ${lights.has(index) ? "has-light" : ""} ${collidingLights.has(index) ? "conflict" : ""}" data-light-cell="${index}" aria-label="图像区域 ${index + 1}">${lights.has(index) ? `<i class="scan-light"></i>` : ""}</button>`;
    }).join("")}</div>`,
    controls: `<div class="controls wide-controls"><button id="clear-lightup" class="button secondary lightup-reset">还原初始状态</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-light-cell]").forEach((cell) => cell.onclick = () => {
    const index = Number(cell.dataset.lightCell);
    const had = lights.has(index);
    had ? lights.delete(index) : lights.add(index);
    had ? sfx.remove() : sfx.place();
    runtime.lightUp = [...lights];
    if (isSolved(lights)) {
      if (boardIndex < lightUpBoards.length - 1) {
        runtime.lightUpStage = boardIndex + 1;
        runtime.lightUp = [];
        render();
        return;
      }
      render();
      window.setTimeout(() => {
        const current = new Set(runtime.lightUp || []);
        if (state.level === 3 && isSolved(current)) {
          complete();
        }
      }, 260);
      return;
    }
    render();
  });
  $("#clear-lightup").onclick = () => { runtime.lightUp = []; render(); };
}

function masyu() {
  const target = ["a","a","b","b","c","a","b","c","c","a","a","c","c","c","c","c"];
  const initial = ["a","","","b","c","","b","c","","","a","","","","",""];
  const selected = runtime.traffic ?? [...initial];
  const colors = ["a", "b", "c"];
  const linksFor = (tiles) => {
    const result = Array(16).fill("");
    colors.forEach((color) => {
      const queue = initial.map((value, index) => value === color && tiles[index] === color ? index : -1).filter((index) => index >= 0);
      const visited = new Set(queue);
      while (queue.length) {
        const index = queue.shift();
        result[index] = color;
        const row = Math.floor(index / 4);
        const column = index % 4;
        [row > 0 ? index - 4 : -1, row < 3 ? index + 4 : -1, column > 0 ? index - 1 : -1, column < 3 ? index + 1 : -1]
          .filter((neighbor) => neighbor >= 0 && !visited.has(neighbor) && tiles[neighbor] === color)
          .forEach((neighbor) => { visited.add(neighbor); queue.push(neighbor); });
      }
    });
    return result;
  };
  const connected = linksFor(selected);
  const signal = (color) => `<span class="traffic-signal ${color}"><i></i><i></i><i></i></span>`;
  app.innerHTML = shell({
    title: "找到所有红绿灯",
    prompt: "找到所有包含红绿灯的图像。",
    body: `<div class="link-grid traffic-grid" id="traffic">${selected.map((color, index) => `<button class="link-cell" data-traffic="${index}" data-color="${initial[index] || connected[index]}" aria-label="验证码图像 ${index + 1}">${color ? signal(color) : ""}</button>`).join("")}</div>`,
    controls: `<div class="controls"><button id="restore-traffic" class="button secondary traffic-reset">还原初始状态</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-traffic]").forEach((tile) => tile.onclick = () => {
    const index = Number(tile.dataset.traffic);
    const prev = selected[index];
    selected[index] = ["", ...colors][(["", ...colors].indexOf(selected[index]) + 1) % 4];
    prev === "" ? sfx.place() : selected[index] === "" ? sfx.remove() : sfx.tap();
    runtime.traffic = selected;
    if (selected.every((color, cell) => color === target[cell])) {
      render();
      window.setTimeout(() => {
        if (state.level === 2 && runtime.traffic?.every((color, cell) => color === target[cell])) {
          complete();
        }
      }, 260);
      return;
    }
    render();
  });
  $("#restore-traffic").onclick = () => { runtime.traffic = [...initial]; render(); };
}

const sudokuLinkInitial = ["4","","","","v","4","","","v","corner","","","corner","h","h",""];
const sudokuNumberSlots = new Set([0, 1, 2, 3, 5, 6, 7, 10, 11, 15]);
const sudokuAnchors = { 0: "4" };
const sudokuPathPairs = [[0, 15], [5, 10]];
function sudoku() {
  const palette = ["1", "2", "3", "4"];
  const links = runtime.sudokuLinks || [...sudokuLinkInitial];
  const tool = runtime.sudokuTool || "1";
  const invalidNumbers = (cells) => {
    const invalid = new Set();
    const markDuplicates = (indexes) => {
      const groups = new Map();
      indexes.forEach((index) => {
        const value = cells[index];
        if (!["1", "2", "3", "4"].includes(value)) return;
        groups.set(value, [...(groups.get(value) || []), index]);
      });
      groups.forEach((indexesForValue) => {
        if (indexesForValue.length > 1) indexesForValue.forEach((index) => invalid.add(index));
      });
    };

    Object.entries(sudokuAnchors).forEach(([index, value]) => {
      if (cells[Number(index)] !== value) invalid.add(Number(index));
    });
    sudokuPathPairs.forEach(([start, end]) => {
      if (["1", "2", "3", "4"].includes(cells[start])
        && ["1", "2", "3", "4"].includes(cells[end])
        && cells[start] !== cells[end]) {
        invalid.add(start);
        invalid.add(end);
      }
    });
    for (let row = 0; row < 4; row += 1) markDuplicates([...sudokuNumberSlots].filter((index) => Math.floor(index / 4) === row));
    for (let column = 0; column < 4; column += 1) markDuplicates([...sudokuNumberSlots].filter((index) => index % 4 === column));
    for (const row of [0, 2]) {
      for (const column of [0, 2]) {
        markDuplicates([...sudokuNumberSlots].filter((index) => Math.floor(index / 4) >= row
          && Math.floor(index / 4) < row + 2 && index % 4 >= column && index % 4 < column + 2));
      }
    }
    return invalid;
  };
  const invalid = invalidNumbers(links);
  const isSolved = (cells) => {
    if (![...sudokuNumberSlots].every((index) => ["1", "2", "3", "4"].includes(cells[index]))) return false;
    if (!Object.entries(sudokuAnchors).every(([index, value]) => cells[Number(index)] === value)) return false;
    return sudokuPathPairs.every(([start, end]) => cells[start] === cells[end])
      && invalidNumbers(cells).size === 0;
  };
  app.innerHTML = shell({
    title: "数字校验",
    prompt: "填入所有黑色数字。",
    body: `<div class="link-puzzle"><div class="sudoku link-sudoku" id="sudoku">${links.map((value, index) => {
      if (sudokuNumberSlots.has(index)) return `<button data-link-cell="${index}" class="endpoint-cell ${invalid.has(index) ? "invalid-number" : ""}">${value}</button>`;
      return `<div class="path-cell">${["h","v","corner"].includes(value) ? `<i class="path-glyph ${value}"></i>` : ""}</div>`;
    }).join("")}</div><div class="number-pad">${palette.map((item) => `<button data-tool="${item}" class="${tool === item ? "active" : ""}" aria-label="数字 ${item}">${item}</button>`).join("")}</div></div>`,
    controls: `<div class="controls"><button id="clear-link" class="button secondary">还原初始状态</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-tool]").forEach((button) => button.onclick = () => {
    sfx.tap();
    runtime.sudokuTool = button.dataset.tool;
    render();
  });
  document.querySelectorAll("[data-link-cell]").forEach((cell) => cell.onclick = () => {
    const index = Number(cell.dataset.linkCell);
    links[index] = tool;
    sfx.place();
    runtime.sudokuLinks = links;
    if (isSolved(links)) {
      render();
      window.setTimeout(() => {
        const current = runtime.sudokuLinks || [];
        if (state.level === 4 && isSolved(current)) {
          complete();
        }
      }, 260);
      return;
    }
    render();
  });
  $("#clear-link").onclick = () => { runtime.sudokuLinks = [...sudokuLinkInitial]; render(); };
}

const fenceSegments = [
  ...Array.from({ length: 4 }, (_, y) => Array.from({ length: 3 }, (_, x) => ({ id: `h-${x}-${y}`, d: `M ${x * 100} ${y * 100} H ${(x + 1) * 100}` }))).flat(),
  ...Array.from({ length: 4 }, (_, x) => Array.from({ length: 3 }, (_, y) => ({ id: `v-${x}-${y}`, d: `M ${x * 100} ${y * 100} V ${(y + 1) * 100}` }))).flat(),
];
const splitFenceSegments = Array.from({ length: 3 }, (_, row) => {
  const y = row * 100;
  return [
    { id: `d-${row}-tl`, d: `M 100 ${y} L 150 ${y + 50}` },
    { id: `d-${row}-br`, d: `M 150 ${y + 50} L 200 ${y + 100}` },
    { id: `d-${row}-tr`, d: `M 200 ${y} L 150 ${y + 50}` },
    { id: `d-${row}-bl`, d: `M 150 ${y + 50} L 100 ${y + 100}` },
  ];
}).flat();
const letterFenceBoards = [
  {
    clue: [3, 3, 3, 1, 2, 1, 3, 3, 3],
    target: ["h-0-0", "v-1-0", "h-1-1", "v-2-0", "h-2-0", "v-3-0", "v-3-1", "v-3-2", "h-2-3", "v-2-2", "h-1-2", "v-1-2", "h-0-3", "v-0-0", "v-0-1", "v-0-2"],
  },
  {
    clue: [3, 2, 3, 2, 3, 2, 2, 2, 2],
    target: ["h-0-0", "v-1-0", "v-1-1", "h-1-2", "v-2-0", "v-2-1", "h-2-0", "v-3-0", "v-3-1", "v-3-2", "h-0-3", "h-1-3", "h-2-3", "v-0-0", "v-0-1", "v-0-2"],
  },
  {
    clue: [2, 1, 2, 2, 2, 2, 3, 1, 3],
    clueItems: [
      [2, 50, 60], [2, 150, 30], [1, 120, 65], [1, 180, 65], [2, 250, 60],
      [2, 50, 160], [2, 150, 130], [2, 120, 165], [2, 180, 165], [2, 250, 160],
      [3, 50, 260], [1, 120, 265], [1, 180, 265], [3, 250, 260],
    ],
    extra: splitFenceSegments,
    target: ["h-0-0", "v-0-0", "v-0-1", "v-0-2", "d-0-tl", "d-0-tr", "h-2-0", "v-3-0", "v-3-1", "v-3-2", "h-2-3", "v-2-1", "v-2-2", "d-1-tl", "d-1-tr", "v-1-1", "v-1-2", "h-0-3"],
  },
  {
    clue: [2, 1, 3, 2, 1, 2, 3, 1, 3],
    clueItems: [
      [2, 50, 60], [1, 150, 30], [1, 120, 65], [2, 180, 65], [3, 250, 60],
      [2, 50, 160], [1, 150, 130], [2, 120, 165], [1, 180, 165], [2, 250, 160],
      [3, 50, 260], [1, 120, 265], [1, 180, 265], [3, 250, 260],
    ],
    extra: splitFenceSegments,
    target: [
      "h-0-0", "h-2-0", "h-0-3", "h-2-3",
      "v-0-0", "v-0-1", "v-0-2", "v-1-1", "v-1-2",
      "v-2-0", "v-2-2", "v-3-0", "v-3-1", "v-3-2",
      "d-0-tl", "d-0-br", "d-1-tl", "d-1-br",
    ],
  },
];
const initialFences = () => [Array.from(letterFenceBoards[0].target), [], [], []];

function fenceClues(board) {
  if (!board.clueItems) {
    return board.clue.map((value, index) => {
      const x = index % 3;
      const y = Math.floor(index / 3);
      return {
        value,
        x: x * 100 + 50,
        y: y * 100 + 60,
        edges: [`h-${x}-${y}`, `h-${x}-${y + 1}`, `v-${x}-${y}`, `v-${x + 1}-${y}`],
      };
    });
  }

  const triangles = (row) => ({
    top: [`h-1-${row}`, `d-${row}-tl`, `d-${row}-tr`],
    left: [`v-1-${row}`, `d-${row}-tl`, `d-${row}-bl`],
    right: [`v-2-${row}`, `d-${row}-tr`, `d-${row}-br`],
    bottom: [`h-1-${row + 1}`, `d-${row}-bl`, `d-${row}-br`],
  });
  const entries = [];
  board.clueItems.forEach(([value, x, y], index) => {
    const row = index < 5 ? 0 : index < 10 ? 1 : 2;
    const position = index % 5;
    const triangle = triangles(row);
    let edges;
    if (index >= 10) {
      edges = [
        [`h-0-2`, `h-0-3`, `v-0-2`, `v-1-2`],
        triangle.left,
        triangle.right,
        [`h-2-2`, `h-2-3`, `v-2-2`, `v-3-2`],
      ][index - 10];
    } else {
      edges = [
        [`h-0-${row}`, `h-0-${row + 1}`, `v-0-${row}`, `v-1-${row}`],
        triangle.top,
        triangle.left,
        triangle.right,
        [`h-2-${row}`, `h-2-${row + 1}`, `v-2-${row}`, `v-3-${row}`],
      ][position];
    }
    entries.push({ value, x, y, edges });
  });
  return entries;
}

function slither() {
  const fences = runtime.fences || initialFences();
  const letterAnswer = runtime.letterAnswer || "";
  const solved = (board, active) => {
    const target = new Set(board.target);
    return active.size === target.size && [...active].every((id) => target.has(id));
  };
  const boardMarkup = (board, boardIndex) => {
    const active = new Set(fences[boardIndex]);
    const edges = [...fenceSegments, ...(board.extra || [])];
    const baseGrid = [
      ...Array.from({ length: 4 }, (_, index) => `<path class="fence-gridline" d="M ${index * 100} 0 V 300"/>`),
      ...Array.from({ length: 4 }, (_, index) => `<path class="fence-gridline" d="M 0 ${index * 100} H 300"/>`),
      ...(board.cuts || []).map((d) => `<path class="fence-cut" d="${d}"/>`),
    ].join("");
    const clues = fenceClues(board).map((clue) => {
      const count = clue.edges.filter((id) => active.has(id)).length;
      const status = count > clue.value ? "over" : count === clue.value ? "matched" : "";
      return `<text class="fence-clue ${status}" x="${clue.x}" y="${clue.y}">${clue.value}</text>`;
    }).join("");
    const drawEdges = (selected) => edges.filter((edge) => active.has(edge.id) === selected)
      .map((edge) => `<path class="letter-fence-edge ${selected ? "active" : ""}" data-letter-board="${boardIndex}" data-letter-edge="${edge.id}" d="${edge.d}" role="button" tabindex="0" aria-label="切换围栏段"/>`).join("");
    return `<div class="letter-fence-wrap ${solved(board, active) ? "solved" : ""}"><svg class="letter-fence" viewBox="-8 -8 316 316" role="group" aria-label="异常图像围栏 ${boardIndex + 1}">${baseGrid}${drawEdges(false)}${drawEdges(true)}${clues}</svg></div>`;
  };
  app.innerHTML = shell({
    title: "围栏验证",
    prompt: "用围栏把数字圈出来，并找到缺失的字母",
    body: `<div class="fence-rail">${letterFenceBoards.map(boardMarkup).join("")}</div>`,
    controls: `<div class="controls letter-check"><button id="clear" class="button secondary">清除</button><input id="letter-answer" class="letter-answer" type="text" inputmode="text" maxlength="1" autocapitalize="characters" autocomplete="off" aria-label="输入验证字母" value="${letterAnswer}"><button id="submit-letter" class="button">验证</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-letter-edge]").forEach((edge) => edge.onclick = () => {
    const boardIndex = Number(edge.dataset.letterBoard);
    const id = edge.dataset.letterEdge;
    const active = new Set(fences[boardIndex]);
    const had = active.has(id);
    had ? active.delete(id) : active.add(id);
    had ? sfx.remove() : sfx.connect();
    fences[boardIndex] = [...active];
    runtime.fences = fences;
    render();
  });
  $("#clear").onclick = () => { runtime.fences = initialFences(); render(); };
  $("#letter-answer").oninput = (event) => {
    event.target.value = event.target.value.slice(0, 1).toUpperCase();
    runtime.letterAnswer = event.target.value;
    sfx.tap();
  };
  $("#submit-letter").onclick = () => {
    const allSolved = letterFenceBoards.every((board, index) => solved(board, new Set(fences[index])));
    if (!allSolved) return fail("图像尚未还原。");
    if ((runtime.letterAnswer || "").toUpperCase() !== "A") return fail("验证未通过。");
    complete();
  };
}

const nodeDefs = [
  { p: [14, 14] }, { p: [42, 14] },
  { p: [14, 42] }, { p: [42, 42] },
  { p: [14, 70] }, { p: [42, 70] },
  { p: [58, 28] }, { p: [86, 28] },
  { p: [58, 56] }, { p: [86, 56] },
  { p: [58, 84] }, { p: [86, 84] },
  { p: [28, 28], hidden: true }, { p: [28, 56], hidden: true }, { p: [28, 84], hidden: true },
  { p: [72, 14], hidden: true }, { p: [72, 42], hidden: true }, { p: [72, 70], hidden: true },
];
const bridgeKey = (a, b) => [a, b].sort((left, right) => left - right).join("-");
const targetBridges = new Map([
  [bridgeKey(0, 1), 2], [bridgeKey(1, 3), 2], [bridgeKey(2, 3), 2],
  [bridgeKey(3, 5), 2], [bridgeKey(4, 5), 2],
  [bridgeKey(6, 7), 2], [bridgeKey(6, 8), 2], [bridgeKey(8, 9), 2],
  [bridgeKey(8, 10), 2], [bridgeKey(7, 9), 2], [bridgeKey(9, 11), 2],
  [bridgeKey(10, 11), 2],
]);
const bridgeDefs = nodeDefs.flatMap((node, index) => nodeDefs
  .map((other, otherIndex) => ({ other, otherIndex }))
  .filter(({ other, otherIndex }) => otherIndex > index && (node.p[0] === other.p[0] || node.p[1] === other.p[1]))
  .filter(({ other }) => !nodeDefs.some((middle) => {
    if (middle === node || middle === other) return false;
    if (node.p[0] === other.p[0]) {
      return middle.p[0] === node.p[0] && middle.p[1] > Math.min(node.p[1], other.p[1]) && middle.p[1] < Math.max(node.p[1], other.p[1]);
    }
    return middle.p[1] === node.p[1] && middle.p[0] > Math.min(node.p[0], other.p[0]) && middle.p[0] < Math.max(node.p[0], other.p[0]);
  }))
  .map(({ otherIndex }) => ({
    a: index,
    b: otherIndex,
    n: targetBridges.get(bridgeKey(index, otherIndex)) || 0,
  })));
nodeDefs.forEach((node, index) => {
  node.v = bridgeDefs.reduce((sum, bridge) => sum + (bridge.a === index || bridge.b === index ? bridge.n : 0), 0);
});
function hashi() {
  const bridges = runtime.bridges || Array(bridgeDefs.length).fill(0);
  const selectedNode = runtime.hashiSelection;
  const sums = nodeDefs.map(() => 0);
  bridgeDefs.forEach((edge, index) => {
    sums[edge.a] += bridges[index];
    sums[edge.b] += bridges[index];
  });
  app.innerHTML = shell({
    title: "节点互证",
    prompt: "让节点网络的所有数字归零，找到两位数字验证码。",
    body: `<div class="hashi">${bridgeDefs.map((edge, index) => {
      if (!bridges[index]) return "";
      const start = nodeDefs[edge.a].p, end = nodeDefs[edge.b].p;
      const dx = end[0] - start[0], dy = end[1] - start[1];
      const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return `<button class="bridge active ${bridges[index] === 2 ? "double" : ""}" data-bridge="${index}" aria-label="调整桥梁数量" style="left:${start[0]}%;top:${start[1]}%;width:${length}%;transform:rotate(${angle}deg)"><i></i><b></b></button>`;
    }).join("")}${nodeDefs.map((node, index) => {
      const over = sums[index] > node.v;
      const value = node.hidden ? (sums[index] ? -sums[index] : "") : node.v - sums[index];
      return `<button class="node ${node.hidden ? "blank" : ""} ${!node.hidden && sums[index] === node.v ? "zero" : ""} ${over ? "over" : ""} ${selectedNode === index ? "selected" : ""}" data-hashi-node="${index}" aria-label="选择节点" style="left:${node.p[0]}%;top:${node.p[1]}%">${value}</button>`;
    }).join("")}</div>`,
    controls: `<div class="controls number-check-controls"><button id="clear" class="button secondary">清除</button><input id="hashi-answer" class="number-answer" type="text" inputmode="numeric" pattern="[0-9]{2}" maxlength="2" autocomplete="off" aria-label="输入两位数字" value="${runtime.hashiAnswer || ""}"><button id="submit" class="button">验证</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-hashi-node]").forEach((node) => node.onclick = () => {
    const nodeIndex = Number(node.dataset.hashiNode);
    if (selectedNode === undefined) {
      sfx.tap();
      runtime.hashiSelection = nodeIndex;
      render();
      return;
    }
    if (selectedNode === nodeIndex) {
      sfx.remove();
      delete runtime.hashiSelection;
      render();
      return;
    }
    const bridgeIndex = bridgeDefs.findIndex((bridge) =>
      (bridge.a === selectedNode && bridge.b === nodeIndex) ||
      (bridge.a === nodeIndex && bridge.b === selectedNode)
    );
    if (bridgeIndex < 0) {
      runtime.hashiSelection = nodeIndex;
      render();
      return;
    }
    if (!bridges[bridgeIndex] && bridgeDefs.some((edge, index) => {
      if (!bridges[index] || index === bridgeIndex) return false;
      const [a, b] = [nodeDefs[bridgeDefs[bridgeIndex].a].p, nodeDefs[bridgeDefs[bridgeIndex].b].p];
      const [c, d] = [nodeDefs[edge.a].p, nodeDefs[edge.b].p];
      const aVertical = a[0] === b[0];
      const cVertical = c[0] === d[0];
      if (aVertical === cVertical) return false;
      const vertical = aVertical ? [a, b] : [c, d];
      const horizontal = aVertical ? [c, d] : [a, b];
      const [vx, vy1] = [vertical[0][0], Math.min(vertical[0][1], vertical[1][1])];
      const vy2 = Math.max(vertical[0][1], vertical[1][1]);
      const [hy, hx1] = [horizontal[0][1], Math.min(horizontal[0][0], horizontal[1][0])];
      const hx2 = Math.max(horizontal[0][0], horizontal[1][0]);
      return vx > hx1 && vx < hx2 && hy > vy1 && hy < vy2;
    })) {
      delete runtime.hashiSelection;
      return fail("道路被已有桥梁阻断。");
    }
    bridges[bridgeIndex] = (bridges[bridgeIndex] + 1) % 3;
    bridges[bridgeIndex] === 0 ? sfx.remove() : sfx.connect();
    runtime.bridges = bridges;
    delete runtime.hashiSelection;
    render();
  });
  document.querySelectorAll("[data-bridge]").forEach((bridge) => bridge.onclick = () => {
    const index = Number(bridge.dataset.bridge);
    bridges[index] = (bridges[index] + 1) % 3;
    bridges[index] === 0 ? sfx.remove() : sfx.connect();
    runtime.bridges = bridges;
    delete runtime.hashiSelection;
    render();
  });
  $("#hashi-answer")?.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 2);
    runtime.hashiAnswer = event.target.value;
    sfx.tap();
  });
  $("#clear").onclick = () => {
    runtime.bridges = Array(bridgeDefs.length).fill(0);
    delete runtime.hashiSelection;
    runtime.hashiAnswer = "";
    render();
  };
  $("#submit").onclick = () => {
    if (!sums.every((sum, index) => sum === nodeDefs[index].v)) return fail("节点网络尚未恢复。");
    if (runtime.hashiAnswer === "38") complete();
    else fail("数字验证未通过。");
  };
}

function finale() {
  const attempts = runtime.finalAttempts || 0;
  const puzzleActive = runtime.finalPuzzle === true;
  const wordPlaced = runtime.finalWordPlaced === true;
  const prompt = puzzleActive
    ? `请画出一条${wordPlaced ? '<span class="prompt-emphasis">不完全笔直</span>' : '<span class="word-slot prompt-emphasis" id="word-slot" role="button" tabindex="0" aria-label="文字放置位置">完全笔直</span>'}的水平线。`
    : '请画出一条<span class="prompt-emphasis">完全笔直</span>的水平线。';
  app.innerHTML = shell({
    title: "完美直线",
    prompt,
    body: `<div class="draw-pad" id="pad"><div class="baseline"></div><canvas id="canvas"></canvas></div>`,
    controls: wordPlaced
      ? `<div class="controls"><button id="submit" class="button">提交直线</button></div>`
      : puzzleActive
      ? `<div class="controls"><button id="submit" class="button">提交直线</button></div>`
      : attempts >= 3
      ? `<div class="controls"><button id="stop" class="button danger">结束验证</button></div>`
      : `<div class="controls"><button id="submit" class="button">提交直线</button></div>`,
    feedback: puzzleActive
      ? wordPlaced
        ? runtime.finalCompleted ? "" : runtime.feedback || "误差存在。你画的线不直。"
        : `误差存在。你画的线<span class="movable-word" id="movable-not" draggable="true" role="button" tabindex="0" aria-label="拖动汉字不">不</span>直。`
      : runtime.feedback,
  });
  const canvas = $("#canvas"), pad = $("#pad"), context = canvas.getContext("2d");
  const rect = pad.getBoundingClientRect(); canvas.width = rect.width * devicePixelRatio; canvas.height = rect.height * devicePixelRatio; context.scale(devicePixelRatio, devicePixelRatio);
  let drawing = false, points = [];
  function pos(event) { const box=pad.getBoundingClientRect(); return {x:event.clientX-box.left,y:event.clientY-box.top}; }
  function draw(event) { const p=pos(event); points.push(p); context.strokeStyle="#146ef5"; context.lineWidth=4; context.lineCap="round"; if(points.length > 1){ const prev=points.at(-2); context.beginPath(); context.moveTo(prev.x,prev.y); context.lineTo(p.x,p.y); context.stroke(); } }
  pad.onpointerdown=(event)=>{drawing=true; points=[]; pad.setPointerCapture?.(event.pointerId); draw(event);};
  pad.onpointermove=(event)=>{if(drawing) draw(event);}; pad.onpointerup=()=>{drawing=false; runtime.points=points;};
  $("#submit")?.addEventListener("click", () => {
    if (!wordPlaced) {
      context.clearRect(0, 0, rect.width, rect.height);
      delete runtime.points;
    }
    if (puzzleActive && wordPlaced) {
      if (!runtime.points || runtime.points.length < 2) {
        return fail("请先完成划线。");
      }
      runtime.finalCompleted = true;
      runtime.feedback = "";
      $(".feedback").textContent = "";
      complete();
      return;
    }
    if (puzzleActive) return;
    runtime.finalAttempts = attempts + 1;
    runtime.finalPuzzle = true;
    runtime.feedback = "";
    render();
  });
  if (puzzleActive && !wordPlaced) {
    const movable = $("#movable-not");
    const slot = $("#word-slot");
    const placeWord = () => {
      if (runtime.finalWordPlaced || !slot) return;
      sfx.connect();
      vibrate(20);
      runtime.finalWordPlaced = true;
      delete runtime.points;
      render();
    };
    let touchDrag = null;
    let suppressClick = false;
    const moveTouchGhost = (event) => {
      if (!touchDrag) return;
      touchDrag.ghost.style.left = `${event.clientX}px`;
      touchDrag.ghost.style.top = `${event.clientY}px`;
      if (Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY) > 6) touchDrag.moved = true;
    };
    const clearTouchDrag = () => {
      touchDrag?.ghost.remove();
      touchDrag = null;
      movable.classList.remove("dragging");
    };
    movable.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || touchDrag) return;
      event.preventDefault();
      suppressClick = true;
      const ghost = document.createElement("span");
      ghost.className = "word-drag-ghost";
      ghost.textContent = "不";
      document.body.appendChild(ghost);
      touchDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, ghost };
      movable.setPointerCapture?.(event.pointerId);
      movable.classList.add("dragging");
      moveTouchGhost(event);
    });
    movable.addEventListener("pointermove", (event) => {
      if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
      event.preventDefault();
      moveTouchGhost(event);
    });
    movable.addEventListener("pointerup", (event) => {
      if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
      event.preventDefault();
      const moved = touchDrag.moved;
      const dropped = moved && document.elementFromPoint(event.clientX, event.clientY)?.closest("#word-slot");
      clearTouchDrag();
      if (dropped) placeWord();
      else if (!moved) movable.classList.toggle("armed");
      window.setTimeout(() => { suppressClick = false; }, 0);
    });
    movable.addEventListener("pointercancel", () => {
      clearTouchDrag();
      window.setTimeout(() => { suppressClick = false; }, 0);
    });
    movable.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", "不");
      movable.classList.add("dragging");
    });
    movable.addEventListener("dragend", () => movable.classList.remove("dragging"));
    movable.addEventListener("click", (event) => {
      if (suppressClick) {
        event.preventDefault();
        return;
      }
      movable.classList.toggle("armed");
    });
    slot.addEventListener("dragover", (event) => event.preventDefault());
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      placeWord();
    });
    slot.addEventListener("click", () => {
      if (movable.classList.contains("armed")) placeWord();
    });
    movable.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        movable.classList.toggle("armed");
      }
    });
    slot.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && movable.classList.contains("armed")) {
        event.preventDefault();
        placeWord();
      }
    });
  }
  $("#stop")?.addEventListener("click", () => {
    app.insertAdjacentHTML("beforeend", `<div class="modal" id="modal"><section class="card"><div class="eyebrow">SYSTEM PROMPT</div><h2 class="title">确认放弃证明吗？</h2><p class="prompt">你可以继续无限接近一个触控设备无法达到的目标。</p><div class="controls"><button class="button secondary" id="back">继续尝试</button><button class="button danger" id="confirm">确认结束</button></div></section></div>`);
    $("#back").onclick=()=>{ sfx.tap(); $("#modal").remove(); }; $("#confirm").onclick=()=>{ sfx.tap(); $("#modal").remove(); finish(); };
  });
}

function finish() {
  if (!hasHumanBehavior()) return fail("验证未通过。");
  if (!state.done.includes(7)) state.done.push(7);
  state.level = 8;
  resetHumanBehavior();
  save();
  vibrate([40,40,40,100]);
  sfx.complete();
  render();
}

function certificate() {
  app.innerHTML = `<div class="app certificate-page"><div class="device-statusbar" aria-hidden="true"></div><section class="certificate">
    <div class="eyebrow">CAPTCHA FINAL RECORD</div>
    <h1>恭喜通过测试，你是人类</h1>
    <p class="prompt">那么，你愿意扮演一个机器人吗？</p>
    <div class="stamp">HUMAN<br>VERIFIED</div>
    <div class="record-list">${traits.map((trait) => `<span>${trait}</span>`).join("")}</div>
    <aside class="game-promo" aria-labelledby="promo-title">
      <div class="game-promo-copy">
        <span class="game-promo-kicker">NEXT PUZZLE</span>
        <h2 id="promo-title">别问模型</h2>
        <p>扮演无所不知的大模型，进入一场规则不断累积的对话式解谜。</p>
      </div>
      <a class="button game-promo-link" id="promo-link" href="https://intersection98.github.io/Do-not-ask-LLM/" target="_blank" rel="noopener noreferrer">开始下一场解谜 <span aria-hidden="true">↗</span></a>
    </aside>
    <button class="button secondary replay-button" id="replay">重新测试</button>
  </section></div>`;
  $("#promo-link").onclick = () => { sfx.tap(); };
  $("#replay").onclick = () => { sfx.tap(); state = { level: 0, done: [], settings: state.settings }; runtime = {}; resetHumanBehavior(); save(); render(); };
}

const oldRender = render;
render = function() {
  if (state.level >= 8) return certificate();
  oldRender();
};
window.addEventListener("resize", () => requestAnimationFrame(fitBoardToViewport), { passive: true });

document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.closest(".modal") && el.id === "next") return;
  if (el.id === "submit" || el.id === "submit-letter") return;
  if (el.dataset.tool || el.dataset.traffic || el.dataset.lightCell || el.dataset.hashiNode || el.dataset.bridge || el.dataset.letterEdge) return;
  sfx.tap();
}, { passive: true });

document.addEventListener("pointerdown", (event) => {
  if (!event.isTrusted || !event.isPrimary) return;
  const evidence = currentHumanBehavior();
  evidence.actions += 1;
  const point = { x: event.clientX, y: event.clientY };
  if (evidence.lastPoint) evidence.travel += Math.hypot(point.x - evidence.lastPoint.x, point.y - evidence.lastPoint.y);
  evidence.lastPoint = point;
  activePointers.set(event.pointerId, {
    startedAt: performance.now(),
    lastX: event.clientX,
    lastY: event.clientY,
    distance: 0,
    samples: 0,
  });
}, { capture: true, passive: true });

document.addEventListener("pointermove", (event) => {
  if (!event.isTrusted) return;
  const pointer = activePointers.get(event.pointerId);
  if (!pointer) return;
  pointer.distance += Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  pointer.samples += 1;
}, { capture: true, passive: true });

document.addEventListener("pointerup", (event) => {
  if (!event.isTrusted) return;
  const pointer = activePointers.get(event.pointerId);
  if (!pointer) return;
  const evidence = currentHumanBehavior();
  const duration = performance.now() - pointer.startedAt;
  evidence.longestPress = Math.max(evidence.longestPress, duration);
  if (pointer.samples >= 2 && pointer.distance >= 8) evidence.drags += 1;
  activePointers.delete(event.pointerId);
}, { capture: true, passive: true });

document.addEventListener("pointercancel", (event) => {
  activePointers.delete(event.pointerId);
}, { capture: true, passive: true });

document.addEventListener("keydown", (event) => {
  if (!event.isTrusted || event.metaKey || event.ctrlKey || event.altKey) return;
  const evidence = currentHumanBehavior();
  evidence.actions += 1;
}, { capture: true });

document.addEventListener("input", (event) => {
  if (!event.isTrusted) return;
  currentHumanBehavior().inputs += 1;
}, { capture: true });

render();
