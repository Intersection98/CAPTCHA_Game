const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");
const STORAGE_KEY = "adch-progress-v1";
const query = new URLSearchParams(location.search);
const debugMode = query.get("debug") === "1";
const requestedLevel = Math.max(0, Math.min(7, Number(query.get("level")) || 0));
const traits = [
  "持续意图",
  "身体误差",
  "对象恒常性",
  "视觉注意力",
  "质疑前提",
  "边界判断",
  "整体意识",
  "拒绝无效目标",
];

let state = debugMode
  ? { level: requestedLevel, done: Array.from({ length: requestedLevel }, (_, index) => index), settings: {} }
  : JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"level":0,"done":[],"settings":{}}');
let runtime = {};

function save() {
  if (!debugMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function vibrate(pattern = 20) {
  if (state.settings.vibration !== false && navigator.vibrate) navigator.vibrate(pattern);
}

function shell({ title, prompt, rule = "", body, controls = "", feedback = "" }) {
  const dots = Array.from({ length: 8 }, (_, index) => `<i class="${state.done.includes(index) ? "done" : index === state.level ? "current" : ""}"></i>`).join("");
  return `
    <div class="app">
      <header class="topbar">
        <div><div class="eyebrow">A.D.C.H. // ${debugMode ? "调试验证模式" : "自动验证测试"}</div><div class="confidence">人类置信度 ${Math.min(98, 16 + state.done.length * 11)}%</div></div>
        <div class="top-actions">${debugMode ? `<button class="button secondary" id="debug-levels">选关</button>` : ""}<button class="button secondary" id="settings" aria-label="设置">设置</button></div>
      </header>
      <div class="progress" aria-label="测试进度">${dots}</div>
      <section class="card">
        <div class="eyebrow">TEST ${String(state.level).padStart(2, "0")} / 07</div>
        <h1 class="title">${title}</h1>
        <p class="prompt">${prompt}</p>
      </section>
      <section class="board-wrap">${body}</section>
      <p class="feedback ${runtime.ok ? "ok" : ""}">${feedback}</p>
      ${controls}
      ${state.done.length ? `<section class="record"><h2>已确认的人类特征</h2><div class="record-list">${state.done.map((n) => `<span>${traits[n]}</span>`).join("")}</div></section>` : ""}
    </div>
  `;
}

function common() {
  $("#debug-levels")?.addEventListener("click", () => {
    const names = ["序章：我不是机器人", "01：轨迹校准", "02：找到所有红绿灯", "03：点亮所有格子", "04：数字校验", "05：异常围栏", "06：节点互证", "07：完美直线"];
    app.insertAdjacentHTML("beforeend", `<div class="modal" id="modal"><section class="card">
      <div class="eyebrow">DEBUG LEVEL SELECT</div><h2 class="title">选择测试关卡</h2>
      <div class="debug-levels">${names.map((name, index) => `<button class="button ${index === state.level ? "" : "secondary"}" data-debug-level="${index}">${name}</button>`).join("")}</div>
      <p><button class="button secondary" id="close">关闭</button></p>
    </section></div>`);
    $("#close").onclick = () => $("#modal").remove();
    document.querySelectorAll("[data-debug-level]").forEach((button) => button.onclick = () => {
      const level = Number(button.dataset.debugLevel);
      location.search = `?debug=1&level=${level}`;
    });
  });
  $("#settings")?.addEventListener("click", () => {
    app.insertAdjacentHTML("beforeend", `
      <div class="modal" id="modal"><section class="card">
        <div class="eyebrow">LOCAL SETTINGS</div><h2 class="title">测试设置</h2>
        <p class="caption">所有解题数据仅保存在此设备。</p>
        <p><button class="button secondary" id="vibration">振动：${state.settings.vibration === false ? "关" : "开"}</button></p>
        <p><button class="button secondary" id="reset">清除全部进度</button></p>
        <button class="button" id="close">返回测试</button>
      </section></div>`);
    $("#close").onclick = () => $("#modal").remove();
    $("#vibration").onclick = () => { state.settings.vibration = state.settings.vibration === false; save(); $("#modal").remove(); render(); };
    $("#reset").onclick = () => { state = { level: 0, done: [], settings: state.settings }; save(); $("#modal").remove(); render(); };
  });
}

function complete(trait, evidence) {
  if (!state.done.includes(state.level)) state.done.push(state.level);
  state.level += 1;
  save();
  vibrate([30, 30, 90]);
  app.insertAdjacentHTML("beforeend", `
    <div class="modal" id="modal"><section class="card">
      <div class="eyebrow">HUMAN SIGNAL RECORDED</div>
      <h2 class="title">${trait}</h2>
      <p class="prompt">${evidence}</p>
      <p class="rule">系统记录：<span class="mono">${trait.toUpperCase().replaceAll(" ", "_")}_CONFIRMED</span></p>
      <button class="button" id="next">继续验证</button>
    </section></div>`);
  $("#next").onclick = () => { $("#modal").remove(); runtime = {}; render(); };
}

function fail(text) {
  runtime.ok = false;
  runtime.feedback = text;
  vibrate([35, 45, 35]);
  render();
}

function render() {
  runtime = { ...runtime, feedback: runtime.feedback || "" };
  const levels = [intro, slider, masyu, lightUp, sudoku, slither, hashi, finale];
  levels[Math.min(state.level, 7)]();
  common();
}

function intro() {
  let holding = false, started = 0, frame;
  app.innerHTML = shell({
    title: "我不是机器人",
    prompt: "请勾选下方方框以继续。",
    rule: "系统需要确认：你能主动维持一个意图，而不仅是发出一次脉冲。",
    body: `<div class="check-zone" id="check"><div class="checkbox" id="box"></div><div><b>我不是机器人</b><div class="hold-meter"><i id="meter"></i><span class="hold-target"></span></div></div></div>`,
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
    holding = true; started = performance.now(); box.classList.add("holding");
    check.setPointerCapture?.(event.pointerId); frame = requestAnimationFrame(tick);
  };
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => check.addEventListener(name, () => {
    if (!holding) return;
    holding = false; cancelAnimationFrame(frame); box.classList.remove("holding");
    if (name === "pointerup" && runtime.holdProgress >= 59 && runtime.holdProgress <= 69) {
      box.textContent = "✓";
      complete("持续意图", "你在恰当的时刻维持并结束了自己的选择。");
      return;
    }
    fail("验证未通过。");
  }));
}

function slider() {
  const prior = runtime.slider ?? 20;
  const targetPosition = runtime.targetPosition ?? 66;
  app.innerHTML = shell({
    title: "轨迹校准",
    prompt: "拖动滑块，使缺口完全重合。",
    rule: "系统正在比较你的运动轨迹。",
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
  $("#target").onclick = () => complete("身体误差", "你没有盲从失效的滑动指令，而是直接对目标作出了判断。");
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
    rule: "白色图像必须全部清晰。黑色遮挡图块会阻断扫描；数字是其相邻已选图像的数量。",
    body: `<div class="lightup-grid" id="lightup" style="--grid-size:${size}">${Array.from({ length: size * size }, (_, index) => {
      if (isBlack(index)) return `<div class="lightup-cell blackout ${Object.hasOwn(clues, index) ? clueOverages.has(index) ? "clue-over" : clueMatches.has(index) ? "clue-met" : "" : "no-clue"}" aria-label="遮挡图块${clues[index] ? `，识别数字 ${clues[index]}` : ""}">${clues[index] || ""}</div>`;
      return `<button class="lightup-cell ${illuminated.has(index) ? "lit" : ""} ${lights.has(index) ? "has-light" : ""} ${collidingLights.has(index) ? "conflict" : ""}" data-light-cell="${index}" aria-label="图像区域 ${index + 1}">${lights.has(index) ? `<i class="scan-light"></i>` : ""}</button>`;
    }).join("")}</div>`,
    controls: `<div class="controls wide-controls"><button id="clear-lightup" class="button secondary lightup-reset">还原图像</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-light-cell]").forEach((cell) => cell.onclick = () => {
    const index = Number(cell.dataset.lightCell);
    lights.has(index) ? lights.delete(index) : lights.add(index);
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
          complete("视觉注意力", "你让所有图像区域获得可见度，同时没有让校正信号彼此冲突。");
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
    prompt: "请选择所有包含红绿灯的图像。",
    rule: "被选择的图像会立即刷新。相同信号之间的图块构成连续路径，路径不能交叉。",
    body: `<div><div class="link-grid traffic-grid" id="traffic">${selected.map((color, index) => `<button class="link-cell" data-traffic="${index}" data-color="${initial[index] || connected[index]}" aria-label="验证码图像 ${index + 1}">${color ? signal(color) : ""}</button>`).join("")}</div></div>`,
    controls: `<div class="controls"><button id="restore-traffic" class="button secondary traffic-reset">还原初始状态</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-traffic]").forEach((tile) => tile.onclick = () => {
    const index = Number(tile.dataset.traffic);
    selected[index] = ["", ...colors][(["", ...colors].indexOf(selected[index]) + 1) % 4];
    runtime.traffic = selected;
    if (selected.every((color, cell) => color === target[cell])) {
      render();
      window.setTimeout(() => {
        if (state.level === 2 && runtime.traffic?.every((color, cell) => color === target[cell])) {
          complete("对象恒常性", "你在反复刷新的图像中重建了连续的信号路径。");
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
    runtime.sudokuTool = button.dataset.tool;
    render();
  });
  document.querySelectorAll("[data-link-cell]").forEach((cell) => cell.onclick = () => {
    const index = Number(cell.dataset.linkCell);
    links[index] = tool;
    runtime.sudokuLinks = links;
    if (isSolved(links)) {
      render();
      window.setTimeout(() => {
        const current = runtime.sudokuLinks || [];
        if (state.level === 4 && isSolved(current)) {
          complete("表征转换", "你在同一张数字验证盘中重建了完整的连续路径。");
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
    title: "异常围栏",
    prompt: "请圈定全部异常区域，并找到缺失的字母",
    body: `<div class="fence-rail">${letterFenceBoards.map(boardMarkup).join("")}</div>`,
    controls: `<div class="controls letter-check"><button id="clear" class="button secondary">清除</button><input id="letter-answer" class="letter-answer" type="text" inputmode="text" maxlength="1" autocapitalize="characters" autocomplete="off" aria-label="输入验证字母" value="${letterAnswer}"><button id="submit-letter" class="button">验证</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-letter-edge]").forEach((edge) => edge.onclick = () => {
    const boardIndex = Number(edge.dataset.letterBoard);
    const id = edge.dataset.letterEdge;
    const active = new Set(fences[boardIndex]);
    active.has(id) ? active.delete(id) : active.add(id);
    fences[boardIndex] = [...active];
    runtime.fences = fences;
    render();
  });
  $("#clear").onclick = () => { runtime.fences = initialFences(); render(); };
  $("#letter-answer").oninput = (event) => {
    event.target.value = event.target.value.slice(0, 1).toUpperCase();
    runtime.letterAnswer = event.target.value;
  };
  $("#submit-letter").onclick = () => {
    const allSolved = letterFenceBoards.every((board, index) => solved(board, new Set(fences[index])));
    if (!allSolved) return fail("图像尚未还原。");
    if ((runtime.letterAnswer || "").toUpperCase() !== "A") return fail("验证未通过。");
    complete("边界判断", "你补全了被系统遗漏的字符。");
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
  const connected = () => {
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const current = queue.shift();
      bridgeDefs.forEach((edge, index) => {
        if (!bridges[index]) return;
        const next = edge.a === current ? edge.b : edge.b === current ? edge.a : -1;
        if (next >= 0 && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      });
    }
    return visited.size === nodeDefs.length;
  };
  app.innerHTML = shell({
    title: "节点互证",
    prompt: "恢复被隔离的节点网络。",
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
    controls: `<div class="controls"><button id="clear" class="button secondary">清除</button><button id="submit" class="button">验证网络</button></div>`,
    feedback: runtime.feedback,
  });
  document.querySelectorAll("[data-hashi-node]").forEach((node) => node.onclick = () => {
    const nodeIndex = Number(node.dataset.hashiNode);
    if (selectedNode === undefined) {
      runtime.hashiSelection = nodeIndex;
      render();
      return;
    }
    if (selectedNode === nodeIndex) {
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
    runtime.bridges = bridges;
    delete runtime.hashiSelection;
    render();
  });
  document.querySelectorAll("[data-bridge]").forEach((bridge) => bridge.onclick = () => {
    const index = Number(bridge.dataset.bridge);
    bridges[index] = (bridges[index] + 1) % 3;
    runtime.bridges = bridges;
    delete runtime.hashiSelection;
    render();
  });
  $("#clear").onclick = () => {
    runtime.bridges = Array(bridgeDefs.length).fill(0);
    delete runtime.hashiSelection;
    render();
  };
  $("#submit").onclick = () => {
    if (sums.every((sum, index) => sum === nodeDefs[index].v)) complete("整体意识", "你让每个局部信号都满足要求，并把它们组成一条整体可信的证据链。");
    else fail("验证未通过。");
  };
}

function finale() {
  const attempts = runtime.finalAttempts || 0;
  app.innerHTML = shell({
    title: "完美直线",
    prompt: "请画出一条完全笔直的水平线。",
    rule: `当前精度阈值：${attempts ? (0.03 / (attempts + 1)).toFixed(3) : "0.030"} px。系统会持续提高标准。`,
    body: `<div class="draw-pad" id="pad"><div class="baseline"></div><canvas id="canvas"></canvas></div>`,
    controls: attempts >= 3
      ? `<div class="controls"><button id="stop" class="button danger">结束验证</button></div>`
      : `<div class="controls"><button id="submit" class="button">提交直线</button></div>`,
    feedback: runtime.feedback,
  });
  const canvas = $("#canvas"), pad = $("#pad"), context = canvas.getContext("2d");
  const rect = pad.getBoundingClientRect(); canvas.width = rect.width * devicePixelRatio; canvas.height = rect.height * devicePixelRatio; context.scale(devicePixelRatio, devicePixelRatio);
  let drawing = false, points = [];
  function pos(event) { const box=pad.getBoundingClientRect(); return {x:event.clientX-box.left,y:event.clientY-box.top}; }
  function draw(event) { const p=pos(event); points.push(p); context.strokeStyle="#146ef5"; context.lineWidth=4; context.lineCap="round"; if(points.length > 1){ const prev=points.at(-2); context.beginPath(); context.moveTo(prev.x,prev.y); context.lineTo(p.x,p.y); context.stroke(); } }
  pad.onpointerdown=(event)=>{drawing=true; points=[]; pad.setPointerCapture?.(event.pointerId); draw(event);};
  pad.onpointermove=(event)=>{if(drawing) draw(event);}; pad.onpointerup=()=>{drawing=false; runtime.points=points;};
  $("#submit")?.addEventListener("click", () => { runtime.finalAttempts = attempts + 1; fail(`误差存在。系统将精度阈值提高至 ${(0.03 / (attempts + 2)).toFixed(3)} px。`); });
  $("#stop")?.addEventListener("click", () => {
    app.insertAdjacentHTML("beforeend", `<div class="modal" id="modal"><section class="card"><div class="eyebrow">SYSTEM PROMPT</div><h2 class="title">确认放弃证明吗？</h2><p class="prompt">你可以继续无限接近一个触控设备无法达到的目标。</p><div class="controls"><button class="button secondary" id="back">继续尝试</button><button class="button danger" id="confirm">确认结束</button></div></section></div>`);
    $("#back").onclick=()=>$("#modal").remove(); $("#confirm").onclick=()=>{ $("#modal").remove(); finish(); };
  });
}

function finish() {
  if (!state.done.includes(7)) state.done.push(7);
  state.level = 8; save(); vibrate([40,40,40,100]);
  render();
}

function certificate() {
  app.innerHTML = `<div class="app"><section class="certificate"><div class="eyebrow">A.D.C.H. FINAL RECORD</div><h1>我是人类</h1><p class="prompt">验证完成。你并不完美。这正是证据。</p><div class="stamp">HUMAN<br>VERIFIED</div><p class="caption mono">关联测试记录：D.N.A.L. / 身份方向相反</p><div class="record-list">${traits.map((trait) => `<span>${trait}</span>`).join("")}</div><p><button class="button" id="replay">重新测试</button></p></section></div>`;
  $("#replay").onclick = () => { state = { level: 0, done: [], settings: state.settings }; runtime = {}; save(); render(); };
}

const oldRender = render;
render = function() {
  if (state.level >= 8) return certificate();
  oldRender();
};
render();
