import { prepareOffline } from "./offline.js";
import { loadTiles, renderTileMap, styleTerminalTile, tileAt } from "./tiles.js";

const main = document.querySelector("main");
const launch = document.querySelector("#launch");
const status = document.querySelector("#status");
const progress = document.querySelector("#download-progress");
const retry = document.querySelector("#retry");
const saveStatus = document.querySelector("#save-status");
const saveManagement = document.querySelector("#save-management");
const deleteSave = document.querySelector("#delete-save");
const deleteSaveStatus = document.querySelector("#delete-save-status");
const viewTitle = document.querySelector("#view-title");
const viewOptions = document.querySelector("#view-options");
const lookAround = document.querySelector("#look-around");
const levelMap = document.querySelector("#level-map");
const toggleTiles = document.querySelector("#toggle-tiles");
const fitMap = document.querySelector("#fit-map");
const zoomOut = document.querySelector("#zoom-out");
const zoomIn = document.querySelector("#zoom-in");
const hud = document.querySelector("#hud");
const vitals = document.querySelector("#vitals");
const depth = document.querySelector("#depth");
const hp = document.querySelector("#hp");
const sp = document.querySelector("#sp");
const speed = document.querySelector("#speed");
const hudStats = document.querySelector("#hud-stats");
const conditionSummary = document.querySelector("#condition-summary");
const activeConditions = document.querySelector("#active-conditions");
const extraConditions = document.querySelector("#extra-conditions");
const conditionsScreen = document.querySelector("#conditions-screen");
const characterScreen = document.querySelector("#character-screen");
const characterName = document.querySelector("#character-name");
const characterClass = document.querySelector("#character-class");
const characterSummary = document.querySelector("#character-summary");
const characterAttributes = document.querySelector("#character-attributes");
const birthStartOver = document.querySelector("#birth-start-over");
const characterConditions = document.querySelector("#character-conditions");
const characterCombat = document.querySelector("#character-combat");
const characterDefenses = document.querySelector("#character-defenses");
const characterProgress = document.querySelector("#character-progress");
const characterProgressLabel = document.querySelector("#character-progress-label");
const journal = document.querySelector("#journal");
const messages = document.querySelector("#messages");
const previousMessage = document.querySelector("#previous-message");
const latestMessage = document.querySelector("#latest-message");
const directionPad = document.querySelector("#direction-pad");
const directionCenter = document.querySelector("#direction-center");
const centerCaption = document.querySelector("#center-caption");
const terminalKeys = document.querySelector("#terminal-keys");
const cancelKey = document.querySelector("#cancel-key");
const confirmKey = document.querySelector("#confirm-key");
const worldActions = document.querySelector("#world-actions");
const playKeys = document.querySelector("#play-keys");
const runAction = document.querySelector("#run-action");
const otherPlayKeys = [...playKeys.children].filter((button) => button !== runAction);
const playKeyboard = document.querySelector("#play-keyboard");
const openMenu = document.querySelector("#open-menu");
const stopAction = document.querySelector("#stop-action");
const aimActions = document.querySelector("#aim-actions");
const nearest = document.querySelector("#nearest");
const targetActions = document.querySelector("#target-actions");
const previousTarget = document.querySelector("#previous-target");
const nextTarget = document.querySelector("#next-target");
const targetMode = document.querySelector("#target-mode");
const targetInspect = document.querySelector("#target-inspect");
const inputPrompt = document.querySelector("#input-prompt");
const editScreen = document.querySelector("#edit-screen");
const editValue = document.querySelector("#edit-value");
const detailsScreen = document.querySelector("#details-screen");
const splashScreen = document.querySelector("#splash-screen");
const angbandVersion = document.querySelector("#angband-version");
const victoryScreen = document.querySelector("#victory-screen");
const victoryName = document.querySelector("#victory-name");
const victoryClass = document.querySelector("#victory-class");
const outcomeSummary = document.querySelector("#outcome-summary");
const outcomeName = document.querySelector("#outcome-name");
const outcomeClass = document.querySelector("#outcome-class");
const outcomeCause = document.querySelector("#outcome-cause");
const outcomeStats = document.querySelector("#outcome-stats");
const outcomeDate = document.querySelector("#outcome-date");
const outcomeActions = document.querySelector("#outcome-actions");
const resultsList = document.querySelector("#results-list");
const resultsFile = document.querySelector("#results-file");
const resultsFileStatus = document.querySelector("#results-file-status");
const downloadResult = document.querySelector("#download-result");
const menuScreen = document.querySelector("#menu-screen");
const menuSummary = document.querySelector("#menu-summary");
const menuSections = document.querySelector("#menu-sections");
const menuRows = document.querySelector("#menu-rows");
const menuEmpty = document.querySelector("#menu-empty");
const menuActions = document.querySelector("#menu-actions");
const menuDescription = document.querySelector("#menu-description");
const birthPreview = document.querySelector("#birth-preview");
const birthChoice = document.querySelector("#birth-choice");
const birthBonuses = document.querySelector("#birth-bonuses");
const birthStatsScreen = document.querySelector("#birth-stats");
const birthIdentity = document.querySelector("#birth-identity");
const birthPoints = document.querySelector("#birth-points");
const birthStatRows = document.querySelector("#birth-stat-rows");
const resetStats = document.querySelector("#reset-stats");
const birthRollActions = document.querySelector("#birth-roll-actions");
const previousRoll = document.querySelector("#previous-roll");
const birthRollHistory = document.querySelector("#birth-roll-history");
const actionsScreen = document.querySelector("#actions-screen");
const quantity = document.querySelector("#quantity");
const optionDigits = document.querySelector("#option-digits");
const rest = document.querySelector("#rest");
const keyboard = document.querySelector("#keyboard");
const keyboardToggle = document.querySelector("#keyboard-toggle");

const specialKeys = new Map([
    ["Enter", 13], ["Backspace", 8], ["Escape", 27], ["Save", 19], ["SaveAndQuit", 24], ["Tab", 9],
    ["ArrowDown", 0x80], ["ArrowLeft", 0x81], ["ArrowRight", 0x82], ["ArrowUp", 0x83], ["CtrlT", 20],
]);
const gameMenu = [
    ["C", "Character"], ["Save", "Save and don't quit"], ["SaveAndQuit", "Save and quit"], ["=", "Options"], ["?", "Help"],
    ["Q", "Retire character and quit"],
];
const quickCommands = [
    ["r", "Read a scroll", null, "Scroll"], ["q", "Quaff a potion", null, "Potion"],
    ["u", "Use a staff", "Z", "Staff"], ["a", "Aim a wand", "z", "Wand"],
    ["z", "Zap a rod", "a", "Rod"], ["i", "Display inventory listing", null, "Pack"],
];
const spellCommands = {
    look: ["l", "Look around", "x", "Look"],
    browse: ["b", "Browse a book", "P", "Browse"],
    study: ["G", "Gain new spells", null, "Study"],
    cast: ["m", "Cast a spell", null, "Cast"],
};
const fireCommand = ["f", "Fire your missile weapon", "t", "Fire"];
const throwCommand = ["v", "Throw an item", null, "Throw"];
const restCommand = ["R", "Rest for a while", null, "Rest"];
const runCommand = [".", "Start running", ","];
const stealCommand = ["s", "Steal from a monster"];
const extraCommands = [
    runCommand, spellCommands.look, ["U", "Use an item", "X"],
    spellCommands.study, spellCommands.browse, throwCommand, spellCommands.cast, fireCommand,
    ["E", "Eat some food"], ["A", "Activate an object"], ["F", "Fuel your light source"],
    ["~", "Knowledge"], [":", "Take notes"], ["/", "Identify symbol"],
    ["*", "Target monster or location"], ["[", "Display visible monster list"], ["]", "Display visible item list"],
    ["h", "Fire at nearest target", "Tab"], ["+", "Alter a grid"], ["T", "Dig a tunnel", "CtrlT"],
    ["D", "Disarm a trap or chest, or lock a door"], ["o", "Open a door or a chest"], ["c", "Close a door"],
];
const panelTitles = { menu: "Menu", commands: "Commands", conditions: "Conditions" };
const commandFaces = new Map([["CtrlT", "^T"]]);
const restLabels = new Map([["&", "As needed"], ["*", "HP and SP"], ["!", "HP or SP"]]);

const scales = [0.75, 0.875, 1, 1.25, 1.5, 1.75];
const defaultAsciiZoom = scales.indexOf(1.5);
const defaultTileZoom = scales.indexOf(1);
const views = {
    terminal: {
        viewport: document.querySelector("#terminal-screen"),
        pre: document.querySelector("#terminal"),
        title: "Terminal",
        zoom: 2,
    },
    map: {
        viewport: document.querySelector("#map-screen"),
        pre: document.querySelector("#map"),
        canvas: document.querySelector("#map-tiles"),
        title: "Map",
    },
    target: {
        viewport: document.querySelector("#target-screen"),
        pre: document.querySelector("#target"),
        canvas: document.querySelector("#target-tiles"),
        title: "Targeting",
    },
};

let activeView = views.terminal;
let worker;
let request;
let mode;
let world;
let context = {};
let menu;
let renderedMenu;
let menuCursor;
let birthSelection;
let openPanel;
let panelTrigger;
let characterTrigger;
let pendingInput;
let stopTimer;
let running = false;
let saving = false;
let deletingSave = false;
let resultURL;
let outcomeSaveFailed = false;
let stopped = false;
let tilesReady = false;
let backgroundSaveRequested = false;
let drawPending = false;
let centerPending = false;
let keyboardOpen = false;
let keyboardLayer = 0;
let shifted = false;

function render(view, frame, region = {}) {
    const { width, height, palette } = frame;
    const { x = 0, y = 0, width: columns = width, height: rows = height } = region;
    const colors = [];
    for (let offset = 0; offset < palette.length; offset += 4) {
        colors.push(`rgb(${palette[offset + 1]} ${palette[offset + 2]} ${palette[offset + 3]})`);
    }

    const tiles = tilesReady && !!frame.terrainAttributes;
    view.grid = { x, y, columns, rows };
    view.gridElement = view.pre;
    if (view.canvas) {
        view.canvas.hidden = !tiles;
        view.pre.hidden = tiles;
        if (tiles) {
            renderTileMap(view.canvas, frame, view.grid, colors);
            view.gridElement = view.canvas;
            return;
        }
    }
    renderText(view.pre, frame, view.grid, colors, tiles);
}

function renderText(pre, frame, grid, colors, tiles) {
    const { width, codepoints, attributes, backgroundStride, shade, cursor } = frame;
    const { x, y, columns, rows } = grid;
    const fragment = document.createDocumentFragment();
    for (let row = 0; row < rows; row++) {
        const line = document.createElement("div");
        line.className = "term-line";
        const rowStart = (row + y) * width + x;
        const rowEnd = rowStart + columns;
        for (let start = rowStart; start < rowEnd;) {
            const attr = attributes[start];
            const span = document.createElement("span");
            const tile = tiles && tileAt(attr, codepoints[start]);
            let end = start + 1;
            if (tile) {
                styleTerminalTile(span, frame, start, tile);
            } else {
                if (start !== cursor) {
                    while (end < rowEnd && attributes[end] === attr && end !== cursor &&
                        !(tiles && tileAt(attr, codepoints[end]))) end++;
                }
                span.textContent = String.fromCodePoint(...codepoints.subarray(start, end));
                span.style.color = colors[attr % colors.length];
                switch (Math.floor(attr / backgroundStride)) {
                    case 1:
                        span.style.backgroundColor = span.style.color;
                        break;
                    case 2:
                        span.style.backgroundColor = colors[shade];
                        break;
                }
            }
            if (start === cursor) span.classList.add("cursor");
            line.append(span);
            start = end;
        }
        fragment.append(line);
    }
    pre.replaceChildren(fragment);
}

function draw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
        drawPending = false;
        const view = activeView;
        if (view.viewport.hidden) return;
        const region = view === views.target ? view.crop : undefined;
        const source = view === views.map ? views.map.frame : views.terminal.frame;
        if (!source) return;
        const target = mode === "aim" && context.target && containsCell(region, context.target) ?
            context.target : undefined;
        const cursor = target ? target.y * source.width + target.x : source.cursor;
        const frame = cursor === source.cursor ? source : { ...source, cursor };
        const previousGrid = view.gridElement;
        const cursorCell = mode === "target" && cursor >= 0 ?
            { x: cursor % frame.width, y: Math.floor(cursor / frame.width) } : undefined;
        const cell = view === views.map ? world : cursorCell ?? target ?? context.player;
        const focusChanged = cell?.x !== view.focusCell?.x || cell?.y !== view.focusCell?.y ||
            cell?.depth !== view.focusCell?.depth;
        const regionChanged = !sameRegion(region, view.region);
        const changed = source !== view.rendered || cursor !== view.cursor || regionChanged;
        if (changed) {
            render(view, frame, region);
            view.rendered = source;
            view.region = region;
            view.cursor = cursor;
        }
        updateViewZoom(view);
        updatePrompt();
        if (view === views.terminal) {
            if (!view.fit && (centerPending || changed) && !menu &&
                (isMenu() || isTextEntry(mode) || mode === "quantity" || mode === "rest")) showCursor(view);
        } else if (!view.fit && cell &&
            (centerPending || focusChanged || regionChanged || previousGrid !== view.gridElement)) {
            centerCell(view, cell);
        }
        view.focusCell = cell;
        centerPending = false;
    });
}

function sameRegion(a, b) {
    return a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function containsCell(region, { x, y }) {
    return region && x >= region.x && y >= region.y &&
        x < region.x + region.width && y < region.y + region.height;
}

function centerCell(view, cell) {
    const { viewport, gridElement, grid } = view;
    const column = cell.x - grid.x;
    const row = cell.y - grid.y;
    if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) return;
    const bounds = gridElement.getBoundingClientRect();
    const screen = viewport.getBoundingClientRect();
    viewport.scrollLeft += bounds.left - screen.left - viewport.clientLeft +
        (column + 0.5) * bounds.width / grid.columns - viewport.clientWidth / 2;
    viewport.scrollTop += bounds.top - screen.top - viewport.clientTop +
        (row + 0.5) * bounds.height / grid.rows - viewport.clientHeight / 2;
}

function showCursor({ viewport, pre }) {
    const cursor = pre.querySelector(".cursor")?.getBoundingClientRect();
    if (!cursor) return;
    const screen = viewport.getBoundingClientRect();
    const left = screen.left + viewport.clientLeft;
    const top = screen.top + viewport.clientTop;
    if (cursor.left < left || cursor.right > left + viewport.clientWidth) {
        viewport.scrollLeft += (cursor.left + cursor.right) / 2 - left - viewport.clientWidth / 2;
    }
    if (cursor.top < top || cursor.bottom > top + viewport.clientHeight) {
        viewport.scrollTop += (cursor.top + cursor.bottom) / 2 - top - viewport.clientHeight / 2;
    }
}

function zoomIndex(view) {
    return view.zoom ?? (view.gridElement === view.canvas ? defaultTileZoom : defaultAsciiZoom);
}

function updateViewZoom(view) {
    const { viewport, gridElement, grid } = view;
    const index = view === views.terminal ? view.zoom : zoomIndex(view);
    const fitted = Boolean(view.fit);
    viewport.classList.toggle("fit-map", fitted);
    fitMap.setAttribute("aria-pressed", String(fitted));
    zoomOut.disabled = fitted || index === 0;
    if (!fitted) {
        viewport.style.setProperty("--zoom", scales[index]);
        zoomIn.disabled = index === scales.length - 1;
        return;
    }
    const { clientWidth, clientHeight } = viewport;
    if (clientWidth <= 1 || clientHeight <= 1) return;
    const key = `${clientWidth}/${clientHeight}/${grid.columns}/${grid.rows}/${gridElement.id}`;
    viewport.style.setProperty("--zoom", 1);
    if (key !== view.fitKey) {
        view.fitScale = Math.min((clientWidth - 1) / gridElement.offsetWidth,
            (clientHeight - 1) / gridElement.offsetHeight, 1);
        view.fitKey = key;
    }
    viewport.style.setProperty("--fit-scale", view.fitScale);
    zoomIn.disabled = false;
}

function recenterView() {
    centerPending = true;
    draw();
}

function changeZoom(step) {
    const fitted = activeView.fit;
    if (fitted && (step < 0 || activeView.fitScale === undefined)) return;
    const index = fitted ? scales.findIndex((scale) => scale > activeView.fitScale) - 1 : zoomIndex(activeView);
    const next = Math.max(0, Math.min(scales.length - 1, index + step));
    if (!fitted && next === index) return;
    activeView.fit = false;
    activeView.zoom = next;
    recenterView();
}

function renderWorld(state) {
    const depthLabel = state.depth ? `${state.depth * 50}′` : "Town";
    depth.textContent = depthLabel;
    hp.textContent = `HP ${state.hp}/${state.maxHp}`;
    hp.classList.toggle("low", state.lowHp);
    sp.textContent = `SP ${state.sp}/${state.maxSp}`;
    sp.hidden = !state.magic;
    const speedLabel = `Speed ${state.speed}`;
    speed.textContent = state.speed === "Normal" ? speedLabel : state.speed;
    for (const [index, { label, value }] of state.stats.entries()) {
        let stat = hudStats.children[index];
        if (!stat) {
            stat = document.createElement("span");
            const name = document.createElement("small");
            name.textContent = label;
            stat.append(name, document.createElement("span"));
            hudStats.append(stat);
        }
        const current = stat.lastElementChild;
        if (current.textContent !== value) current.textContent = value;
    }
    const alerts = [...state.conditions].sort((left, right) => right.priority - left.priority);
    const labels = alerts.slice(0, 2).map(({ label }) => label);
    if (labels.length === 2 && labels.join(" · ").length > 25) labels.pop();
    const more = alerts.length - labels.length;
    conditionSummary.hidden = !alerts.length;
    activeConditions.textContent = labels.join(" · ");
    extraConditions.hidden = more <= 0;
    extraConditions.textContent = `+${more}`;
    const action = mode === "command" ? "Open Character" : "View conditions";
    vitals.setAttribute("aria-label", [action, hp.textContent, state.magic && sp.textContent,
        state.depth ? `Depth ${state.depth * 50} feet` : "Town", speedLabel,
        ...state.stats.map(({ label, value }) => `${label} ${value}`), ...labels,
        more > 0 && `${more} more conditions`].filter(Boolean).join(", "));

    const lines = state.log.flatMap(({ text, count }) => {
        const line = text.trim();
        return !line || /^=+$/.test(line) ? [] : [count > 1 ? `${line} (×${count})` : line];
    });
    if (lines.length === messages.childElementCount &&
        lines.every((line, index) => messages.children[index].textContent === line)) return;
    previousMessage.textContent = lines.at(-2) ?? "";
    latestMessage.textContent = lines.at(-1) ?? "";
    messages.replaceChildren(...lines.map((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        return item;
    }));
    messages.scrollTop = messages.scrollHeight;
}

function characterRows(rows) {
    const list = document.createElement("dl");
    list.className = "character-rows";
    for (const { label, value, temporary } of rows) {
        const row = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        if (temporary) {
            const effect = document.createElement("small");
            effect.textContent = `${temporary} (temporary)`;
            description.append(effect);
        }
        row.append(term, description);
        list.append(row);
    }
    return list;
}

const resultNumber = new Intl.NumberFormat("en");
const resultDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const outcomeTitles = { dead: "Character died", retired: "Character retired", victory: "Victory summary" };

function renderOutcome({ kind, name, race, className, level, depth, exp, gold, cause, timestamp }) {
    const identity = `${race} ${className} · Level ${level}`;
    const place = depth ? `Dungeon level ${depth} (${resultNumber.format(depth * 50)} ft)` : "Town";
    if (mode === "victory") {
        victoryName.textContent = name;
        victoryClass.textContent = identity;
        return;
    }
    outcomeName.textContent = name;
    outcomeClass.textContent = identity;
    outcomeCause.textContent = kind === "victory" ? "Retired after defeating Morgoth." :
        kind === "retired" ? "Retired from adventuring." : `Killed by ${cause}.`;
    outcomeStats.replaceChildren(characterRows([
        { label: "Location", value: place },
        { label: "Experience", value: resultNumber.format(exp) },
        { label: "Gold", value: resultNumber.format(gold) },
    ]));
    const date = new Date(timestamp * 1000);
    outcomeDate.dateTime = date.toISOString();
    outcomeDate.textContent = resultDate.format(date);
}

function renderResultsList({ title, sections }) {
    const nodes = [];
    for (const { title: section, entries } of sections) {
        if (!section && !entries.length && sections.length > 1) continue;
        if (section) {
            const heading = document.createElement("h3");
            heading.textContent = section;
            nodes.push(heading);
        }
        if (!entries.length) {
            const empty = document.createElement("p");
            empty.className = "results-empty";
            empty.textContent = title === "Hall of Fame" ? "No scores recorded." :
                title === "Messages" ? "No messages." : title === "Player history" ?
                    "No history recorded." : title === "Examine items" ? "Nothing to examine." : "Empty";
            nodes.push(empty);
            continue;
        }
        const list = document.createElement("ul");
        for (const { text, detail, highlighted } of entries) {
            const item = document.createElement("li");
            item.textContent = text;
            if (highlighted) item.setAttribute("aria-current", "true");
            if (detail) {
                const caption = document.createElement("small");
                caption.textContent = highlighted ? `This run\n${detail}` : detail;
                item.append(caption);
            }
            list.append(item);
        }
        nodes.push(list);
    }
    resultsList.replaceChildren(...nodes);
    resultsList.scrollTop = 0;
}

function clearResultFile() {
    if (resultURL) {
        const url = resultURL;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        resultURL = undefined;
    }
    downloadResult.removeAttribute("href");
    downloadResult.hidden = true;
}

function renderResultFile({ filename, data }) {
    clearResultFile();
    resultsFileStatus.textContent = data?.length ? filename : "Could not prepare the file.";
    if (!data?.length) return;
    resultURL = URL.createObjectURL(new Blob([data], { type: "text/plain;charset=utf-8" }));
    downloadResult.href = resultURL;
    downloadResult.download = filename;
    downloadResult.hidden = false;
}

function appendCharacterGroup(container, title, rows) {
    if (!rows.length) return;
    const heading = document.createElement("h3");
    heading.textContent = title;
    container.append(heading, characterRows(rows));
}

function renderConditions(container) {
    const state = world;
    const rows = [
        { label: "Nourishment", value: [state.foodGrade, `${state.food}%`].filter(Boolean).join(" · ") },
        { label: "Speed", value: state.speed },
        { label: "Light source", value: state.light },
    ];
    container.replaceChildren(characterRows(rows));
    const effects = state.conditions
        .filter(({ label }) => label !== state.foodGrade)
        .sort((left, right) => right.priority - left.priority);
    if (effects.length) {
        const list = document.createElement("ul");
        list.className = "character-effects";
        list.setAttribute("aria-label", "Active effects");
        for (const { label } of effects) {
            const item = document.createElement("li");
            item.textContent = label;
            list.append(item);
        }
        container.append(list);
    }
}

function renderBirthAttributes(rows) {
    const table = document.createElement("table");
    table.className = "birth-attributes";
    const header = table.createTHead().insertRow();
    for (const [label, description] of [
        ["", "Stat"], ["Self", "Base stat"], ["RB", "Race bonus"],
        ["CB", "Class bonus"], ["EB", "Equipment bonus"], ["Best", "Best"],
    ]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        cell.setAttribute("aria-label", description);
        cell.title = description;
        header.append(cell);
    }
    const body = table.createTBody();
    const bonus = (value) => value < 0 ? String(value) : `+${value}`;
    for (const { label, breakdown } of rows) {
        const row = body.insertRow();
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = `${label}:`;
        row.append(name);
        const { base, raceBonus, classBonus, equipmentBonus, best } = breakdown;
        for (const value of [base, bonus(raceBonus), bonus(classBonus), bonus(equipmentBonus), best]) {
            row.insertCell().textContent = value;
        }
    }
    characterAttributes.replaceChildren(table);
}

function renderCharacter() {
    const sheet = context.character;
    const reviewing = mode === "birth-review";
    if (!sheet || (!reviewing && !world)) return;
    characterName.textContent = sheet.name;
    characterName.hidden = !sheet.name;
    characterClass.textContent = `${sheet.race} ${sheet.className} · Level ${sheet.level}`;

    const rowsFor = (section) => sheet.rows.filter((row) => row.section === section);
    const vitals = [
        { label: "HP", value: `${sheet.hp}/${sheet.maxHp}` },
        ...(reviewing || sheet.magic ? [{ label: "SP", value: `${sheet.sp}/${sheet.maxSp}` }] : []),
    ];
    if (reviewing) renderBirthAttributes(rowsFor(0));
    else characterAttributes.replaceChildren(characterRows(rowsFor(0)));

    const progress = new Map(rowsFor(2).map(({ label, value }) => [label, value]));
    const combat = rowsFor(3);
    const experience = progress.get("Cur Exp");
    const nextLevel = progress.get("Adv Exp");
    const hasNextLevel = /^\d+$/.test(nextLevel ?? "");
    const background = rowsFor(1);
    const turnCounters = ["Game", "Standard", "Resting"];
    characterSummary.replaceChildren(characterRows([
        ...vitals,
        ...combat.filter(({ label }) => label === "Armor"),
        { label: "Gold", value: progress.get("Gold") },
        ...(reviewing ? background.filter(({ label }) => label === "Title") :
            [{ label: hasNextLevel ? "Cur Exp / Adv Exp" : "Cur Exp",
                value: hasNextLevel ? `${experience} / ${nextLevel}` : experience }]),
    ]));
    if (!reviewing) renderConditions(characterConditions);

    characterCombat.replaceChildren();
    const meleeHit = combat.findIndex(({ label }) => label === "To-hit");
    const attackRows = combat.map((row, index) => !reviewing && row.label === "To-hit" ?
        { ...row, label: index === meleeHit ? "Melee to-hit" : "Ranged to-hit" } : row);
    appendCharacterGroup(characterCombat, "Combat", attackRows.filter(({ label }) => label !== "Armor"));
    appendCharacterGroup(characterCombat, "Skills", rowsFor(4));

    characterDefenses.replaceChildren();
    for (const [group, title] of [["resistances", "Resistances"],
        ["abilities", "Abilities"], ["hindrances", "Hindrances"]]) {
        appendCharacterGroup(characterDefenses, title, sheet.defenses.filter((row) => row.group === group));
    }

    characterProgressLabel.textContent = reviewing ? "Background, progress & history" : "Progress & history";
    characterProgress.replaceChildren(characterRows([
        ...(reviewing ? [{ label: "Cur Exp", value: experience }] : []),
        { label: "Max Exp", value: progress.get("Max Exp") },
        ...(reviewing ? [{ label: "Adv Exp", value: nextLevel }] : []),
        { label: "Max Depth", value: progress.get("Max Depth") },
        { label: "Burden", value: progress.get("Burden") },
        ...(progress.has("Overweight") ? [{ label: "Overweight", value: progress.get("Overweight") }] : []),
    ]));
    appendCharacterGroup(characterProgress, "Turns used:",
        background.filter(({ label }) => turnCounters.includes(label)));
    appendCharacterGroup(characterProgress, "Background", background.filter(({ label }) =>
        label !== "Title" && !turnCounters.includes(label)));
    if (sheet.history) {
        if (reviewing) {
            const heading = document.createElement("h3");
            heading.textContent = "History";
            characterProgress.append(heading);
        }
        const history = document.createElement("p");
        history.className = "character-history";
        history.textContent = sheet.history;
        characterProgress.append(history);
    }
}

function isMenu() {
    return mode === "menu" || mode === "save-slots";
}

function isTextEntry(state) {
    return state === "name" || state === "text";
}

function closeInputPanel() {
    if (openPanel) {
        const trigger = panelTrigger;
        showPanel();
        trigger?.focus({ preventScroll: true });
        return true;
    }
    if (!keyboardOpen || isTextEntry(mode)) return false;
    toggleKeyboard();
    return true;
}

function showPanel(panel, trigger) {
    openPanel = panel;
    panelTrigger = trigger;
    if (panel) {
        journal.open = false;
        viewOptions.setAttribute("aria-expanded", "false");
        renderActionsPanel();
        if (panel === "conditions") renderConditions(conditionsScreen);
    }
    updateView();
    updateControls();
    if (panel) {
        const firstAction = panel === "conditions" ? conditionsScreen : actionsScreen.querySelector("button");
        if (panel === "conditions") conditionsScreen.scrollTop = 0;
        firstAction.focus({ preventScroll: true });
    }
}

function updateControls() {
    const disabled = request === undefined || saving || deletingSave || stopped;
    const command = mode === "command";
    const runDirection = mode === "run-direction";
    const selecting = mode === "target";
    const aiming = mode === "aim";
    const directing = mode === "direction";
    const editing = isTextEntry(mode);
    const counting = mode === "quantity";
    const optionNumber = mode === "option-number";
    const splash = mode === "splash";
    const resting = mode === "rest";
    const confirming = mode === "confirm";
    const history = mode === "history";
    const rolling = mode === "birth-roll";
    const reviewing = mode === "birth-review";
    const stats = mode === "birth-stats" || rolling;
    const birthChoiceMenu = !!menu?.birth;
    const more = mode === "more";
    const overview = mode === "overview";
    const details = mode === "details";
    const character = mode === "character";
    const outcome = mode === "menu" && !!context.outcome;
    const victory = mode === "victory";
    const resultChild = mode === "results-list" || mode === "results-file" || menu?.title === "Create spoilers";
    const retiring = mode === "retire";
    const hasTarget = aiming && context.current;
    const canOpenKeyboard = !runDirection && !counting && !optionNumber && !splash && !resting && !confirming && !history &&
        !more && !overview && !details && !openPanel && !birthChoiceMenu && !stats &&
        !outcome && !victory && !resultChild && !retiring && !reviewing;
    const showKeyboard = keyboardOpen && canOpenKeyboard;
    const playing = command && !openPanel && !showKeyboard;
    const showRunControls = !openPanel && !showKeyboard && (runDirection || running);
    const stopVisible = running || !stopAction.hidden;
    lookAround.hidden = levelMap.hidden = toggleTiles.hidden = !command || !!openPanel;
    lookAround.disabled = disabled;
    levelMap.disabled = disabled;
    toggleTiles.disabled = disabled || !tilesReady;
    toggleTiles.setAttribute("aria-pressed", String(!!views.map.frame?.terrainAttributes));
    vitals.setAttribute("aria-controls", command ? "character-screen" : "conditions-screen");
    vitals.disabled = disabled || runDirection || !(selecting || aiming || directing || command);
    views.terminal.viewport.classList.toggle("selectable", isMenu() && !menu);
    views.target.viewport.classList.toggle("selectable", selecting || aiming || directing);
    const playPad = command || selecting || aiming || directing;
    const padVisible = showRunControls || (!openPanel && !showKeyboard && !stopVisible &&
        (playPad || (isMenu() && !menu)));
    setActions(directionPad, padVisible, disabled || running);
    directionPad.classList.toggle("cardinal", mode === "save-slots");
    directionPad.classList.toggle("run-direction", runDirection);
    directionCenter.disabled = !running && !command && !(directing && context.center);
    centerCaption.textContent = directing ? "Here" : "Stand still";
    directionCenter.setAttribute("aria-label", directing ? "Choose your cell" : "Stand still");
    setActions(playKeys, showRunControls || (playing && !stopVisible), disabled && !running);
    playKeys.classList.toggle("run-controls", showRunControls);
    for (const button of otherPlayKeys) button.disabled = showRunControls;
    const runLabel = running ? "Stop" : runDirection ? "Cancel" : "Run";
    if (runAction.textContent !== runLabel) runAction.textContent = runLabel;
    if (running) delete runAction.dataset.key;
    else runAction.dataset.key = runDirection ? "Escape" : commandKey(runCommand, world?.roguelike);
    setActions(terminalKeys, !showRunControls && !playing && !stopVisible && !outcome &&
        !(command && showKeyboard), disabled);
    setActions(outcomeActions, outcome && !stopVisible, disabled);
    terminalKeys.classList.toggle("options-controls", Boolean(menu?.options));
    terminalKeys.classList.toggle("birth-choice-controls", birthChoiceMenu);
    terminalKeys.classList.toggle("birth-stat-controls", stats);
    terminalKeys.classList.toggle("birth-review-controls", reviewing);
    birthStartOver.hidden = !reviewing;
    terminalKeys.classList.toggle("results-controls", victory || resultChild || retiring);
    confirmKey.dataset.key = retiring ? "@" : confirming || history ? "y" : selecting ? "t" : aiming ?
        hasTarget ? "5" : "*" : details || character || overview ? "Escape" : "Enter";
    cancelKey.dataset.key = confirming || history ? "n" : "Escape";
    if (details) cancelKey.dataset.key = confirmKey.dataset.key;
    const useTarget = context.verb === "Use" ? "Use target" : `${context.verb} at target`;
    confirmKey.textContent = reviewing ? "Start game" : retiring ? "Retire character and quit" :
        confirming ? "Yes" : history ? "Keep history" : stats ? "Accept" :
        selecting ? context.attack ? context.verb : "Select target" :
        aiming ? hasTarget ? useTarget : "Target monster or location" :
        editing || counting || optionNumber || resting ? "Done" : isMenu() ? "Select" :
        overview || details || character ? "Close" : "Continue";
    confirmKey.hidden = !!openPanel || !!menu?.options || birthChoiceMenu || resultChild;
    confirmKey.disabled = directing || (selecting && !context.canSelect) ||
        (!more && !!menu && !menu.rows.some((row) => row.index === menuCursor && row.enabled));
    cancelKey.textContent = confirming ? (context.castWarning ? "Cancel" : "No") :
        history ? "Edit history" : openPanel || (showKeyboard && !editing) ?
        "Back" : selecting || aiming || directing || editing || counting || optionNumber || resting || retiring ?
            "Cancel" : command ? "Esc" : "Back";
    cancelKey.setAttribute("aria-label", cancelKey.textContent);
    cancelKey.hidden = more || character || victory;
    setActions(worldActions, showRunControls || (playing && !stopVisible), disabled || showRunControls);
    birthStatRows.disabled = resetStats.disabled = disabled;
    setActions(birthRollActions, rolling, disabled);
    previousRoll.disabled = !context.birthStats?.roll?.previous;
    setActions(aimActions, aiming && !showKeyboard && !openPanel && (context.nearest || hasTarget), disabled);
    nearest.hidden = !context.nearest;
    nearest.textContent = `${context.verb === "Use" ? "Use on" : context.verb + " at"} nearest`;
    aimActions.lastElementChild.hidden = !hasTarget;
    setActions(targetActions, selecting && !showKeyboard && !openPanel, disabled);
    previousTarget.disabled = nextTarget.disabled = context.freeAim || context.targetCount < 2;
    targetMode.textContent = context.freeAim ? "Interesting places" : "Free selection";
    targetMode.dataset.key = context.freeAim ? "m" : "o";
    targetMode.disabled = context.freeAim && !context.targetCount;
    targetInspect.disabled = !context.canInspect;
    setActions(quantity, counting, disabled);
    setActions(optionDigits, optionNumber, disabled);
    setActions(rest, resting && !stopVisible, disabled);
    setActions(keyboard, showKeyboard && !stopVisible, disabled);
    keyboardToggle.hidden = !canOpenKeyboard;
    keyboardToggle.textContent = showKeyboard ? "Hide" : "Keys";
    keyboardToggle.setAttribute("aria-expanded", String(showKeyboard));
    keyboardToggle.setAttribute("aria-label", showKeyboard ? "Hide keyboard" : "Keyboard");
    setActions(actionsScreen, !!openPanel && openPanel !== "conditions", disabled);
    setActions(menuActions, !more && !!menu?.actions.length, disabled);
    menuRows.disabled = menuSections.disabled = disabled || more;
    saveManagement.hidden = mode !== "save-slots";
    deleteSave.disabled = disabled || !(menuCursor > 0);
}

function showDeleteSaveStatus(message, failed = false) {
    deleteSaveStatus.textContent = message;
    deleteSaveStatus.classList.toggle("error", failed);
    deleteSaveStatus.hidden = false;
}

deleteSave.addEventListener("click", () => {
    if (mode !== "save-slots" || deleteSave.disabled || request === undefined) return;
    const selectedRequest = request;
    request = undefined;
    deletingSave = true;
    deleteSaveStatus.hidden = true;
    updateControls();
    worker.postMessage({ type: "delete-save", request: selectedRequest, cursor: menuCursor });
});

function setActions(group, visible, disabled) {
    group.hidden = !visible;
    group.disabled = disabled || !visible;
}

function terminalLine(row) {
    const frame = views.terminal.frame;
    return frame ? String.fromCodePoint(...frame.codepoints.subarray(
        row * frame.width, (row + 1) * frame.width)).trim() : "";
}

function updatePrompt() {
    let text = context.prompt || (menu?.options ? undefined : menu?.prompt);
    if (mode === "aim") text = `${context.verb}: choose a target or direction.`;
    if (mode === "direction" || mode === "run-direction") text = "Choose a direction.";
    if (running) text = "Running…";
    if (mode === "save-slots") text = "Choose a save or start a new game.";
    if (mode === "rest") text = "Rest for how long? Choose a preset or enter 1–9999 turns.";
    if (mode === "rest" && !stopAction.hidden) text = "Resting…";
    if (mode === "target" || mode === "more" ||
        (!text && (isTextEntry(mode) || mode === "quantity"))) {
        text = terminalLine(0);
        if (mode === "more") text = text.replace(/\s*-more-\s*$/, "");
    }
    if (context.castWarning) text = `${context.castWarning}\n${context.prompt.trim()}`;
    else if (["confirm", "details", "retire"].includes(mode) && context.prompt) text = "";
    inputPrompt.hidden = !text || !!openPanel;
    if (inputPrompt.textContent !== (text || "")) inputPrompt.textContent = text || "";
    const saveNotice = !saveStatus.hidden && !saveStatus.classList.contains("error");
    journal.hidden = hud.hidden || !inputPrompt.hidden || saveNotice;
    if (journal.hidden) journal.open = false;
}

function updateView(state = world, region = views.target.crop) {
    const previous = activeView;
    world = state;
    views.target.crop = region;
    const aiming = mode === "target" || mode === "aim" || mode === "direction";
    activeView = aiming && region ? views.target : world && context.worldView ? views.map : views.terminal;
    const editing = context.value !== undefined && !openPanel;
    const question = (mode === "confirm" || mode === "retire") && !context.castWarning && context.prompt;
    const showDetails = context.detail !== undefined;
    const reviewing = mode === "birth-review";
    const showCharacter = (mode === "character" || reviewing) && !!context.character;
    const showSplash = mode === "splash";
    const showVictory = mode === "victory";
    const showOutcome = mode === "menu" && !!context.outcome;
    victoryScreen.hidden = !showVictory;
    outcomeSummary.hidden = !showOutcome;
    resultsList.hidden = mode !== "results-list";
    resultsFile.hidden = mode !== "results-file";
    const showBirthStats = !!context.birthStats;
    splashScreen.hidden = !showSplash;
    birthStatsScreen.hidden = !showBirthStats;
    if (showSplash) angbandVersion.textContent = context.version;
    characterScreen.hidden = !showCharacter;
    characterScreen.classList.toggle("birth-review", reviewing);
    conditionsScreen.hidden = openPanel !== "conditions";
    detailsScreen.hidden = !showDetails;
    if (showDetails && detailsScreen.textContent !== context.detail) {
        detailsScreen.textContent = context.detail;
        detailsScreen.scrollTop = 0;
    }
    editScreen.hidden = !editing && !question;
    editValue.classList.toggle("confirmation", !editing && Boolean(question));
    if (editing) {
        const value = mode === "rest" ? restLabels.get(context.value.trim()) ?? context.value :
            mode === "quantity" && context.value === "*" ? "All" : context.value;
        const chars = [...value];
        const caret = document.createElement("span");
        caret.className = context.initial && chars.length ? "selection" : "caret";
        caret.setAttribute("aria-hidden", "true");
        if (value !== context.value) {
            editValue.textContent = value;
        } else if (context.initial && chars.length) {
            caret.textContent = value;
            caret.removeAttribute("aria-hidden");
            editValue.replaceChildren(caret);
        } else {
            editValue.replaceChildren(chars.slice(0, context.cursor).join(""), caret,
                chars.slice(context.cursor).join(""));
        }
    } else if (question) {
        editValue.textContent = question;
        if (context.price !== undefined) {
            const price = document.createElement("small");
            price.textContent = `Price: ${context.price} au`;
            editValue.append(price);
        }
    }
    for (const view of Object.values(views)) view.viewport.hidden =
        view !== activeView || !!menu || !!openPanel || editing || !!question || showDetails || showCharacter ||
        showSplash || showBirthStats || showVictory || !resultsList.hidden || !resultsFile.hidden;
    if (previous !== activeView && activeView === views.terminal) {
        activeView.viewport.scrollTo(0, 0);
    }
    const showMap = activeView !== views.terminal && !activeView.viewport.hidden;
    main.classList.toggle("in-world", showMap);
    main.classList.toggle("in-game-panel", !!openPanel || showCharacter || !!menu?.options || mode === "option-number" ||
        showOutcome || showVictory || !resultsList.hidden || !resultsFile.hidden || !!menu?.title || mode === "retire");
    main.classList.toggle("intro", showSplash);
    hud.hidden = !showMap || !world;
    viewOptions.hidden = !showMap;
    fitMap.hidden = !showMap;
    if (!showMap) viewOptions.setAttribute("aria-expanded", "false");
    const title = showVictory ? "Victory" : showOutcome ? outcomeTitles[context.outcome.kind] :
        context.resultsList?.title ?? context.resultsFile?.title ??
        (showSplash ? "Angband" : reviewing ? "Review character" : showCharacter ? "Character" :
        mode === "aim" ? "Aim" : mode === "run-direction" ? "Run" : mode === "direction" ? "Direction" :
        mode === "overview" ? levelMap.textContent : mode === "details" ? "Details" :
        mode === "history" ? "Character history" : mode === "birth-stats" ? "Point-based" :
        mode === "birth-roll" ? "Standard roller" :
        question ? "Confirm" : editing ? mode === "name" ? "Character name" : mode === "quantity" ? "Quantity" :
            mode === "rest" ? "Rest" : mode === "option-number" ? "Edit option" : "Text entry" : activeView.title);
    const activeSection = menu?.sections?.find((section) => section.active);
    viewTitle.textContent = panelTitles[openPanel] ?? (mode === "save-slots" ? "Save slots" :
        menu?.birth?.title ?? menu?.options ?? menu?.store?.name ?? menu?.title ?? activeSection?.label ??
        (menu && !showOutcome ? "Choices" : mode === "details" ? context.prompt || title : title));
    zoomOut.hidden = zoomIn.hidden = activeView.viewport.hidden;
    if (previous !== activeView) {
        if (activeView === views.target) {
            activeView.zoom = views.map.zoom;
            activeView.fit = views.map.fit;
        }
        centerPending = true;
    }
    renderMenu(menu);
    updatePrompt();
    draw();
    if (world) renderWorld(world);
}

function stop(message, failed) {
    stopped = true;
    request = mode = undefined;
    world = menu = undefined;
    context = {};
    openPanel = panelTrigger = characterTrigger = undefined;
    clearPendingInput();
    clearResultFile();
    keyboardOpen = false;
    updateControls();
    updateView(undefined, undefined);
    status.textContent = message;
    launch.classList.toggle("error", failed);
    launch.hidden = false;
    retry.textContent = failed ? "Try again" : "Save slots";
    retry.hidden = false;
    worker.terminate();
}

function handleWorkerMessage({ data }) {
    switch (data.type) {
        case "frame": {
            const view = views[data.surface];
            view.frame = data;
            if (view === activeView || view === views.terminal) draw();
            break;
        }
        case "run-position":
            if (running && data.request === pendingInput && world) {
                world = { ...world, x: data.x, y: data.y };
                draw();
            }
            break;
        case "waiting": {
            const restoreRunFocus = document.activeElement === runAction ||
                ((running || mode === "run-direction") && document.activeElement === document.body);
            clearPendingInput();
            const changed = data.mode !== mode || data.menu?.birth?.title !== menu?.birth?.title ||
                data.menu?.title !== menu?.title || !!data.context.outcome !== !!context.outcome;
            if (mode === "results-file") clearResultFile();
            if (changed) {
                centerPending = true;
                if (mode === "save-slots") {
                    deleteSaveStatus.hidden = true;
                }
                keyboardOpen = false;
                openPanel = panelTrigger = undefined;
                if (isTextEntry(data.mode)) {
                    keyboardLayer = 0;
                    shifted = data.mode === "name";
                    keyboardOpen = true;
                }
            }
            if (changed) {
                views.terminal.fit = data.mode === "overview";
                views.terminal.fitKey = undefined;
            }
            mode = data.mode;
            request = data.request;
            context = data.context;
            menu = data.menu;
            deletingSave = false;
            if (changed && isTextEntry(mode)) renderKeyboard();
            launch.hidden = true;
            main.classList.remove("starting");
            updateView(mode === "command" ? data.world ?? null : data.world ?? world, data.region ?? null);
            if (context.birthStats) renderBirthStats(context.birthStats, changed);
            if (context.outcome) renderOutcome(context.outcome);
            if (context.resultsList) renderResultsList(context.resultsList);
            if (context.resultsFile) renderResultFile(context.resultsFile);
            if (mode === "command" && world) renderQuickActions(world);
            if (mode === "character" || mode === "birth-review") renderCharacter();
            if (changed && (mode === "confirm" || mode === "quantity" || mode === "rest" || isTextEntry(mode))) {
                views.terminal.viewport.scrollTo(0, 0);
            }
            updateControls();
            if (changed && mode === "victory") victoryScreen.focus({ preventScroll: true });
            if (changed && mode === "results-list") resultsList.focus({ preventScroll: true });
            if (changed && mode === "results-file") resultsFile.focus({ preventScroll: true });
            if (changed && mode === "menu" && (context.outcome || menu?.title)) {
                const selected = menuRows.querySelector('[aria-current="true"]') ??
                    outcomeActions.querySelector('[aria-current="true"]:not([disabled])');
                (selected ?? menuRows).focus({ preventScroll: true });
                if (selected && menuRows.contains(selected) && menu.cursor > 0) {
                    selected.scrollIntoView({ block: "nearest" });
                }
            }
            if (changed && (mode === "character" || mode === "birth-review")) {
                for (const detail of characterScreen.querySelectorAll(".character-detail")) {
                    detail.open = mode === "birth-review" && detail.id !== "character-defenses-section";
                }
                characterScreen.scrollTop = 0;
                if (!characterScreen.hidden) characterScreen.focus({ preventScroll: true });
            }
            if (mode === "command" && characterTrigger) {
                characterTrigger.focus({ preventScroll: true });
                characterTrigger = undefined;
            }
            if ((changed && mode === "run-direction") || (mode === "command" && restoreRunFocus)) {
                runAction.focus({ preventScroll: true });
            }
            break;
        }
        case "saving":
            clearPendingInput();
            saving = true;
            updateControls();
            saveStatus.textContent = data.outcome ? "Saving outcome…" : "Saving game…";
            saveStatus.classList.remove("error");
            saveStatus.hidden = false;
            updatePrompt();
            break;
        case "saved":
            saving = false;
            if (data.outcome) outcomeSaveFailed = !data.ok;
            updateControls();
            saveStatus.textContent = data.outcome ?
                (data.ok ? "Outcome saved." : "Outcome not saved. An earlier save may still be playable.") :
                (data.ok ? "Game saved." : "Could not save the game.");
            saveStatus.classList.toggle("error", !data.ok);
            saveStatus.hidden = false;
            updatePrompt();
            break;
        case "restarting":
            clearPendingInput();
            request = mode = world = menu = undefined;
            context = {};
            openPanel = panelTrigger = characterTrigger = undefined;
            keyboardOpen = false;
            if (!outcomeSaveFailed) saveStatus.hidden = true;
            outcomeSaveFailed = false;
            clearResultFile();
            main.classList.add("starting");
            launch.hidden = false;
            status.textContent = "Starting Angband…";
            updateView(null, null);
            updateControls();
            break;
        case "save-deleted":
            deletingSave = false;
            updateControls();
            showDeleteSaveStatus(`Deleted ${data.slot}.`);
            break;
        case "save-delete-error":
            deletingSave = false;
            if (data.request !== undefined) request = data.request;
            updateControls();
            showDeleteSaveStatus(data.message, true);
            break;
        case "exit":
            stop(data.code === 0 ? "Angband has closed." :
                data.message || `Angband exited with code ${data.code}.`, data.code !== 0);
            break;
        case "error":
            stop(data.message, true);
            break;
    }
}

function keyCode(key) {
    return specialKeys.get(key) ?? ([...key].length === 1 ? key.codePointAt(0) : 0);
}

function clearPendingInput() {
    clearTimeout(stopTimer);
    pendingInput = undefined;
    running = false;
    runAction.disabled = false;
    stopAction.hidden = true;
    stopAction.disabled = false;
}

function sendInput(input) {
    if (request === undefined || saving || deletingSave || stopped) return false;
    if (!saveStatus.classList.contains("error")) saveStatus.hidden = true;
    journal.open = false;
    if (input.type !== "toggle-tiles") viewOptions.setAttribute("aria-expanded", "false");
    running = mode === "run-direction" && input.type === "key" && input.code !== keyCode("Escape");
    worker.postMessage({ ...input, request });
    if ((running || mode === "command" || !hud.hidden || mode === "rest" ||
        (mode === "menu" && !menu?.store && !menu?.birth && !context.outcome && !menu?.title)) &&
        ["key", "menu-row", "aim-cell", "target-cell"].includes(input.type)) {
        pendingInput = request;
        if (!running) {
            stopTimer = setTimeout(() => {
                stopAction.hidden = false;
                updateControls();
                updatePrompt();
            }, 150);
        }
    }
    request = undefined;
    toggleTiles.disabled = true;
    deleteSave.disabled = true;
    if (running) updateControls();
    updatePrompt();
    return true;
}

let buttonPress;
const inputButton = "button[data-key], button[data-input]";
main.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    const button = event.target.closest(inputButton);
    buttonPress = button ? { button, request } : undefined;
});

main.addEventListener("pointercancel", () => { buttonPress = undefined; });

main.addEventListener("click", (event) => {
    const button = event.target.closest(inputButton);
    if (!button || button.matches(":disabled, [aria-disabled=true]") || (event.detail !== 0 &&
        (buttonPress?.button !== button || buttonPress.request !== request))) return;

    if (button === cancelKey && closeInputPanel()) return;
    if (button === confirmKey && menu && mode !== "more") {
        sendInput({ type: "menu-row", code: menuCursor });
        return;
    }
    const key = button.dataset.key;
    const input = button.dataset.input ?
        { type: button.dataset.input, code: Number(button.dataset.value) } :
        { type: "key", code: keyCode(key) };
    const previewBirthChoice = menu?.birth?.preview && birthSelection !== input.code;
    if (input.type === "menu-row" && (menu?.store || previewBirthChoice)) {
        if (request === undefined) return;
        menuCursor = input.code;
        for (const row of menuRows.children) {
            if (row === button) row.setAttribute("aria-current", "true");
            else row.removeAttribute("aria-current");
        }
        if (previewBirthChoice) {
            birthSelection = input.code;
            renderBirthPreview();
            button.scrollIntoView({ block: "nearest" });
        } else {
            updateControls();
        }
        return;
    }
    if (input.type === "store-action") input.row = menuCursor;
    if (!sendInput(input)) return;
    if (openPanel === "menu" && key === "C") characterTrigger = panelTrigger;
    if (openPanel) showPanel();
    if (keyboard.contains(button) && shifted && /^[A-Z]$/.test(key) && keyboardLayer === 0) {
        shifted = false;
        renderKeyboard();
    }
});

function makeButton(label, announcement = label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", announcement);
    return button;
}

function makeKey(key, label = key, announcement = label) {
    const button = makeButton(label, announcement);
    button.dataset.key = key;
    return button;
}

function makeInput(type, code, label) {
    const button = makeButton(label);
    button.dataset.input = type;
    button.dataset.value = code;
    return button;
}

function keyBadge(label) {
    const badge = document.createElement("kbd");
    badge.textContent = label;
    return badge;
}

function commandKey([key, , alternative], roguelike) {
    return roguelike && alternative ? alternative : key;
}

function renderQuickActions({ roguelike, quickActions }) {
    const { spell, spellHint, launcher, hasAmmo } = quickActions;
    const commands = [...quickCommands, spellCommands[spell], launcher ? fireCommand : throwCommand, restCommand];
    for (let i = 0; i < commands.length; i++) {
        const entry = commands[i];
        const [, label, , face] = entry;
        const key = commandKey(entry, roguelike);
        const hint = i === quickCommands.length ? spellHint : entry === fireCommand && !hasAmmo ? "No ammo" : "";
        let button = worldActions.children[i];
        if (!button) {
            button = makeButton("");
            button.className = "shortcut";
            button.append(document.createElement("span"), keyBadge(""), document.createElement("small"));
            worldActions.append(button);
        }
        if (button.dataset.key === key && button.dataset.hint === hint) continue;
        button.dataset.key = key;
        button.dataset.hint = hint;
        button.disabled = !!hint;
        button.title = label;
        button.setAttribute("aria-label", hint ? `${label} (${key}). ${hint}` : `${label} (${key})`);
        const [name, badge, notice] = button.children;
        name.textContent = face;
        badge.textContent = key;
        badge.hidden = !!hint;
        notice.textContent = hint;
        notice.hidden = !hint;
    }
    lookAround.dataset.key = commandKey(spellCommands.look, roguelike);
}

function renderActionsPanel() {
    let commands;
    if (openPanel === "menu") {
        commands = gameMenu;
    } else if (openPanel === "commands") {
        commands = [...extraCommands];
        if (world.quickActions?.canSteal) commands.push(stealCommand);
        commands.push(["Enter", "All Angband commands"]);
    }
    if (!commands) return;
    const rows = commands.map((entry) => {
        const key = commandKey(entry, world.roguelike);
        const label = entry[1];
        const button = makeKey(key, label);
        if (openPanel === "commands" && key !== "Enter") button.prepend(keyBadge(commandFaces.get(key) ?? key));
        return button;
    });
    actionsScreen.replaceChildren(...rows);
    actionsScreen.setAttribute("aria-label", panelTitles[openPanel]);
    actionsScreen.scrollTop = 0;
}

function renderBirthPreview() {
    const row = menu?.birth?.preview && menu.rows.find(({ index }) => index === birthSelection);
    birthPreview.hidden = !row;
    if (!row) return;
    birthChoice.textContent = row.name;
    birthBonuses.textContent = row.detail;
    birthPreview.scrollTop = 0;
}

function renderBirthStats(stats, changed) {
    const { roll } = stats;
    const focused = document.activeElement;
    const focusedRow = !changed && birthStatRows.contains(focused) ? focused.closest("button") : null;
    birthStatsScreen.classList.toggle("rolled-stats", !!roll);
    birthIdentity.textContent = `${stats.race} / ${stats.className}`;
    birthPoints.textContent = roll ? `HP ${roll.hp} · SP ${roll.mana}` : `Points left: ${stats.remaining}`;
    resetStats.hidden = !!roll;
    birthRollHistory.hidden = !roll?.history;
    birthRollHistory.textContent = roll?.history ?? "";
    birthStatRows.replaceChildren(...stats.rows.map((stat, index) => {
        const row = document.createElement("div");
        row.className = "birth-stat";
        row.classList.toggle("current", index === stats.cursor);
        const label = document.createElement("div");
        label.textContent = stat.label;
        const value = document.createElement("div");
        value.className = "birth-stat-value";
        value.textContent = stat.value;
        const base = document.createElement("small");
        base.textContent = `Base ${stat.base}`;
        value.append(base);
        if (roll) {
            row.append(label, value);
            return row;
        }
        const cost = document.createElement("small");
        cost.textContent = stat.cost ? `Next: ${stat.cost} pt` : "Max base";
        label.append(cost);
        const decrease = makeInput("sell-stat", index, "−");
        decrease.setAttribute("aria-label", `Decrease ${stat.label}`);
        decrease.disabled = !stat.canDecrease;
        const increase = makeInput("buy-stat", index, "+");
        increase.setAttribute("aria-label", `Increase ${stat.label}`);
        increase.disabled = !stat.canIncrease;
        row.append(label, decrease, value, increase);
        return row;
    }));
    if (changed) birthStatsScreen.scrollTop = 0;
    if (focusedRow) {
        const row = birthStatRows.children[Number(focusedRow.dataset.value)];
        const button = row?.querySelector(`[data-input="${focusedRow.dataset.input}"]:enabled`);
        (button ?? row?.querySelector("button:enabled"))?.focus({ preventScroll: true });
    }
}

function renderMenu(state) {
    menuScreen.hidden = !state;
    const description = state?.description ?? "";
    menuDescription.hidden = !description;
    if (menuDescription.textContent !== description) {
        menuDescription.textContent = description;
        menuDescription.scrollTop = 0;
    }
    menuScreen.classList.toggle("options-menu", Boolean(state?.options));
    menuScreen.classList.toggle("birth-menu", Boolean(state?.birth));
    const outcome = !!context.outcome;
    menuScreen.classList.toggle("outcome-menu", outcome);
    menuActions.classList.toggle("birth-actions", Boolean(state?.birth));
    if (!state) {
        renderedMenu = undefined;
        menuCursor = undefined;
        birthSelection = undefined;
        outcomeActions.replaceChildren();
        renderBirthPreview();
        return;
    }
    if (state === renderedMenu) return;
    const previous = renderedMenu;
    renderedMenu = state;
    const active = state.sections?.find((section) => section.active)?.id;
    const previousActive = previous?.sections?.find((section) => section.active)?.id;
    const differentList = !previous || state.id !== previous.id || active !== previousActive ||
        state.options !== previous.options ||
        state.prompt !== previous.prompt;
    const previousScroll = menuScreen.scrollTop;
    if (differentList) birthSelection = undefined;
    else if (state.birth?.preview && state.cursor !== previous.cursor) birthSelection = state.cursor;
    menuCursor = birthSelection ?? state.cursor;
    const summary = state.birth?.summary || (state.store && !state.store.home ?
        `Gold Remaining: ${state.store.gold} au` : "");
    menuSummary.hidden = !summary;
    menuSummary.textContent = summary;
    menuSections.hidden = !state.sections?.length;
    menuSections.replaceChildren(...(state.sections ?? []).map((section) => {
        const button = makeInput("menu-section", section.id, section.label);
        button.disabled = section.active;
        button.setAttribute("aria-pressed", String(section.active));
        return button;
    }));
    menuEmpty.hidden = state.rows.length > 0;
    const focused = document.activeElement?.closest("button[data-input]");
    const focusedCode = focused && (menuRows.contains(focused) || outcomeActions.contains(focused)) ?
        focused.dataset.value : undefined;
    let current;
    const endings = [];
    const choices = [];
    for (const row of state.rows) {
        const button = makeInput("menu-row", row.index, row.name);
        button.disabled = !row.enabled;
        if (row.checked !== undefined) {
            button.setAttribute("aria-pressed", String(row.checked));
            button.classList.toggle("read-only", !row.enabled);
        }
        if (row.index === menuCursor && row.enabled && (!state.birth?.preview || birthSelection !== undefined)) {
            current = button;
            button.setAttribute("aria-current", "true");
        }
        const description = document.createElement("span");
        description.textContent = row.name;
        if (row.detail && !state.birth?.preview) {
            const detail = document.createElement("small");
            detail.textContent = row.detail;
            description.append(detail);
        }
        const price = document.createElement("span");
        price.className = "price";
        price.textContent = row.price;
        const ending = outcome && ["n", "q"].some((key) => row.key === keyCode(key));
        if (state.birth || ending) button.replaceChildren(description);
        else button.replaceChildren(keyBadge(row.key ? String.fromCharCode(row.key) : ""), description, price);
        button.setAttribute("aria-label",
            [row.name, state.birth?.preview ? "" : row.detail, row.checked === undefined ? row.price : ""]
                .filter(Boolean).join(", "));
        (ending ? endings : choices).push(button);
    }
    menuRows.replaceChildren(...choices);
    outcomeActions.replaceChildren(...endings);
    menuActions.replaceChildren(...state.actions.map((action) => state.store ?
        makeInput("store-action", action.key, action.label) : makeKey(String.fromCharCode(action.key), action.label)));
    renderBirthPreview();
    menuScreen.scrollTop = differentList ? 0 : previousScroll;
    if (current && menuRows.contains(current) && !differentList && state.cursor !== previous.cursor) {
        const bounds = current.getBoundingClientRect();
        const screen = menuScreen.getBoundingClientRect();
        if (bounds.top < screen.top) menuScreen.scrollTop += bounds.top - screen.top;
        else if (bounds.bottom > screen.bottom) menuScreen.scrollTop += bounds.bottom - screen.bottom;
    }
    if (focusedCode && !differentList && !focused?.isConnected) {
        const button = state.birth?.preview && state.cursor !== previous.cursor ? current :
            [...choices, ...endings].find((row) => row.dataset.value === focusedCode);
        if (button?.matches(":enabled")) button.focus({ preventScroll: true });
    }
}

function showKeys(panel, keys) {
    panel.replaceChildren(...keys.map((row) => {
        const line = document.createElement("div");
        line.className = "keyboard-row";
        line.append(...row);
        return line;
    }));
}

function renderKeyboard() {
    const layers = [
        ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
        ["1234567890", "-=,.;:<>/?", "!@#$%&*()"],
        ["[]{}\\|`", "'\"+_~^", ""],
    ];
    const rows = layers[keyboardLayer].map((line) =>
        [...line].map((key) => makeKey(keyboardLayer === 0 && shifted ? key.toUpperCase() : key)));
    if (mode === "name") rows.unshift([makeKey("*", "Random name"),
        makeKey("ArrowLeft", "←", "Move text cursor left"), makeKey("ArrowRight", "→", "Move text cursor right")]);
    if (mode === "text") rows.unshift([makeKey("ArrowLeft", "←", "Move text cursor left"),
        makeKey("ArrowRight", "→", "Move text cursor right")]);
    if (mode === "terminal" || (isMenu() && !menu)) rows.unshift([
        makeKey("ArrowLeft", "←", "Left"), makeKey("ArrowUp", "↑", "Up"),
        makeKey("ArrowDown", "↓", "Down"), makeKey("ArrowRight", "→", "Right"),
    ]);
    const nextLayer = (keyboardLayer + 1) % layers.length;
    const switchLayer = makeButton(["ABC", "123", "#+="][nextLayer],
        ["Letters", "Numbers", "More symbols"][nextLayer]);
    switchLayer.onclick = () => {
        keyboardLayer = nextLayer;
        renderKeyboard();
        keyboard.querySelector(".keyboard-row:last-child button").focus({ preventScroll: true });
    };
    const shift = makeButton("⇧", "Uppercase for next letter");
    shift.setAttribute("aria-pressed", String(shifted));
    shift.onclick = () => {
        shifted = !shifted;
        renderKeyboard();
        keyboard.querySelector("[aria-pressed]").focus({ preventScroll: true });
    };
    if (keyboardLayer === 0) rows.at(-1).unshift(shift);
    rows.at(-1).push(makeKey("Backspace", "⌫", "Delete character"));
    const space = makeKey(" ", "Space");
    space.className = "space-key";
    const utility = [switchLayer, space];
    if (!isTextEntry(mode)) utility.push(makeKey("Tab", "Tab"));
    if (mode === "command") {
        const commands = makeButton("Cmds", "Commands");
        commands.setAttribute("aria-controls", "actions-screen");
        commands.onclick = () => {
            if (request !== undefined) showPanel("commands", commands);
        };
        const hide = makeButton("Hide", "Hide keyboard");
        hide.onclick = () => toggleKeyboard();
        utility.push(makeKey("Escape", "Esc"), commands, hide);
    }
    rows.push(utility);
    showKeys(keyboard, rows);
}

const digits = () => [
    [..."12345"].map((key) => makeKey(key)),
    [..."67890"].map((key) => makeKey(key)),
];
showKeys(quantity, [
    ...digits(),
    [makeKey("*", "All"), makeKey("Backspace", "⌫", "Delete digit")],
]);
showKeys(optionDigits, [
    ...digits(),
    [makeKey("ArrowLeft", "←", "Move text cursor left"), makeKey("ArrowRight", "→", "Move text cursor right"),
        makeKey("Backspace", "⌫", "Delete digit")],
]);
showKeys(rest, [
    Array.from(restLabels, ([key, label]) => makeKey(key, label)),
    ...digits(),
    [makeKey("Backspace", "⌫", "Delete digit")],
]);

function toggleKeyboard() {
    keyboardOpen = !keyboardOpen;
    if (keyboardOpen) {
        if (!isTextEntry(mode)) {
            keyboardLayer = 0;
            shifted = false;
        }
        journal.open = false;
        viewOptions.setAttribute("aria-expanded", "false");
        renderKeyboard();
    }
    updateControls();
    centerPending = true;
    draw();
    if (mode === "command") {
        (keyboardOpen ? keyboard.querySelector("button") : playKeyboard)?.focus({ preventScroll: true });
    } else if (mode === "target" || mode === "aim" || mode === "direction") {
        (keyboardOpen ? keyboard.querySelector("button") : keyboardToggle)?.focus({ preventScroll: true });
    }
}

keyboardToggle.addEventListener("click", toggleKeyboard);
playKeyboard.addEventListener("click", toggleKeyboard);

openMenu.addEventListener("click", () => {
    if (mode === "command" && request !== undefined) showPanel("menu", openMenu);
});
vitals.addEventListener("click", () => {
    if (mode === "command") {
        if (sendInput({ type: "key", code: keyCode("C") })) characterTrigger = vitals;
    } else if (request !== undefined) {
        showPanel("conditions", vitals);
    }
});
function interruptAction(button) {
    if (pendingInput === undefined || button.disabled) return;
    worker.postMessage({ type: "interrupt", request: pendingInput });
    button.disabled = true;
}

stopAction.addEventListener("click", () => interruptAction(stopAction));
runAction.addEventListener("click", () => {
    if (running) interruptAction(runAction);
});

for (const view of [views.terminal, views.target]) {
    let tap;
    view.viewport.addEventListener("pointerdown", (event) => {
        tap = event.isPrimary && event.button === 0 ?
            { request, x: event.clientX, y: event.clientY, pointer: event.pointerId } : undefined;
    });
    view.viewport.addEventListener("pointermove", (event) => {
        if (tap?.pointer === event.pointerId &&
            Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap = undefined;
    });
    view.viewport.addEventListener("pointercancel", () => { tap = undefined; });
    view.viewport.addEventListener("click", (event) => {
        const type = view === views.target ? mode === "target" ? "target-cell" :
            mode === "aim" || mode === "direction" ? "aim-cell" : undefined :
            isMenu() && !menu ? "tap" : undefined;
        if (event.detail === 0 || !request || tap?.request !== request || activeView !== view ||
            !type || !view.grid || !view.gridElement.contains(event.target) ||
            view.rendered !== views.terminal.frame || !sameRegion(view.region, view.crop)) return;
        tap = undefined;
        const { x, y, columns, rows } = view.grid;
        const grid = view.gridElement.getBoundingClientRect();
        const column = Math.floor((event.clientX - grid.left) * columns / grid.width);
        const row = Math.floor((event.clientY - grid.top) * rows / grid.height);
        if (column < 0 || column >= columns || row < 0 || row >= rows) return;
        sendInput({ type, x: x + column, y: y + row });
    });
}

toggleTiles.addEventListener("click", () => sendInput({ type: "toggle-tiles" }));
fitMap.addEventListener("click", () => {
    activeView.fit = !activeView.fit;
    activeView.fitKey = undefined;
    recenterView();
});
zoomOut.addEventListener("click", () => changeZoom(-1));
zoomIn.addEventListener("click", () => changeZoom(1));

function touchDistance(first, second) {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

const mapViewport = views.map.viewport;
const zoomStepRatio = 1.18;
const touchOptions = { capture: true, passive: false };
let multiTouch = false;
let zoomDistance;

document.addEventListener("touchstart", (event) => {
    if (event.touches.length < 2) return;
    if (event.cancelable) event.preventDefault();
    const [first, second] = event.touches;
    zoomDistance = !multiTouch && event.touches.length === 2 && !mapViewport.hidden &&
        mapViewport.contains(first.target) && mapViewport.contains(second.target) ?
        touchDistance(first, second) : undefined;
    multiTouch = true;
}, touchOptions);

document.addEventListener("touchmove", (event) => {
    if (!multiTouch && event.touches.length < 2) return;
    if (event.cancelable) event.preventDefault();
    if (zoomDistance === undefined || event.touches.length !== 2) return;
    const [first, second] = event.touches;
    if (mapViewport.hidden || ![first, second].every(({ clientX, clientY }) =>
        mapViewport.contains(document.elementFromPoint(clientX, clientY)))) {
        zoomDistance = undefined;
        return;
    }
    const distance = touchDistance(first, second);
    if (distance === 0) return;
    if (zoomDistance > 0) {
        const steps = Math.trunc(Math.log(distance / zoomDistance) / Math.log(zoomStepRatio));
        if (steps === 0) return;
        changeZoom(steps);
    }
    zoomDistance = distance;
}, touchOptions);

function endTouches(event) {
    if (!multiTouch) return;
    if (event.cancelable) event.preventDefault();
    zoomDistance = undefined;
    multiTouch = event.touches.length > 0;
}

document.addEventListener("touchend", endTouches, touchOptions);
document.addEventListener("touchcancel", endTouches, touchOptions);
for (const type of ["gesturestart", "gesturechange"]) {
    document.addEventListener(type, (event) => event.preventDefault());
}

viewOptions.addEventListener("click", () => {
    journal.open = false;
    viewOptions.setAttribute("aria-expanded", String(viewOptions.getAttribute("aria-expanded") !== "true"));
});
journal.addEventListener("toggle", () => {
    if (!journal.open) return;
    viewOptions.setAttribute("aria-expanded", "false");
    messages.scrollTop = messages.scrollHeight;
});

const viewResize = new ResizeObserver((entries) => {
    if (activeView.viewport.hidden || !entries.some(({ target }) => target === activeView.viewport)) return;
    recenterView();
});
for (const { viewport } of Object.values(views)) viewResize.observe(viewport);

function requestBackgroundSave() {
    if (!worker || stopped || backgroundSaveRequested) return;
    backgroundSaveRequested = true;
    worker.postMessage({ type: "background-save" });
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) requestBackgroundSave();
    else backgroundSaveRequested = false;
});
window.addEventListener("pagehide", requestBackgroundSave);
window.addEventListener("pageshow", () => {
    if (!document.hidden) backgroundSaveRequested = false;
});

document.addEventListener("keydown", (event) => {
    if (mode === undefined || saving || deletingSave || event.isComposing || event.altKey) return;
    if (event.key === "Escape" && pendingInput !== undefined && (running || !stopAction.hidden)) {
        interruptAction(running ? runAction : stopAction);
        event.preventDefault();
        return;
    }
    if (event.key === "Escape" && journal.open) {
        journal.open = false;
        journal.querySelector("summary").focus();
        event.preventDefault();
        return;
    }
    if (event.key === "Escape" && viewOptions.getAttribute("aria-expanded") === "true") {
        viewOptions.setAttribute("aria-expanded", "false");
        viewOptions.focus();
        event.preventDefault();
        return;
    }
    if (event.key === "Escape" && closeInputPanel()) {
        event.preventDefault();
        return;
    }
    if (journal.open && journal.contains(event.target)) return;
    if (openPanel) return;
    if (event.ctrlKey || event.metaKey) {
        if (mode === "command" && !event.shiftKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!event.repeat) sendInput({ type: "key", code: keyCode("Save") });
        }
        return;
    }
    if ((event.key === "Enter" || event.key === " ") &&
        event.target instanceof Element && event.target.closest("button, a, summary")) return;
    if ((mode === "results-list" || mode === "results-file") && event.key !== "Escape") return;
    if (mode === "birth-review" && !["Enter", "Escape", "s", "S"].includes(event.key)) return;
    if (mode === "character" && characterScreen.contains(event.target) &&
        [" ", "ArrowUp", "ArrowDown"].includes(event.key)) return;

    if (event.key === "Tab") return;
    if (menu && mode !== "more" && event.key === "Enter") {
        event.preventDefault();
        if (menu.rows.some((row) => row.index === menuCursor && row.enabled)) {
            sendInput({ type: "menu-row", code: menuCursor });
        }
        return;
    }
    if (mode === "details" && context.detail !== undefined &&
        !["Escape", "Enter", "[", "]"].includes(event.key)) return;
    const code = keyCode(event.key);
    if (code) {
        event.preventDefault();
        if (!event.repeat || (mode === "command" && event.key.startsWith("Arrow")) ||
            ((isTextEntry(mode) || mode === "option-number") && event.key === "Backspace")) {
            sendInput({ type: "key", code });
        }
    }
});

async function start() {
    retry.hidden = true;
    launch.classList.remove("error");
    if (!navigator.serviceWorker?.controller) {
        progress.removeAttribute("value");
        progress.hidden = false;
        status.textContent = "Downloading Angband for offline play…";
    }

    try {
        const ready = await prepareOffline((percent) => {
            progress.value = Math.max(progress.value, percent);
        });
        if (!ready) {
            window.location.reload();
            return;
        }
    } catch (error) {
        console.error(error);
        status.textContent = error.message;
        launch.classList.add("error");
        progress.hidden = true;
        retry.hidden = false;
        return;
    }

    progress.hidden = true;
    status.textContent = "Starting Angband…";
    try {
        worker = new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module" });
        worker.addEventListener("message", handleWorkerMessage);
        worker.addEventListener("error", (event) => {
            console.error(event.message);
            stop("Could not start Angband.", true);
        });
        void loadTiles().then(() => {
            tilesReady = true;
            updateControls();
        }).catch((error) => {
            console.error(error);
            toggleTiles.textContent = "Tiles unavailable";
        });
    } catch (error) {
        console.error(error);
        status.textContent = "Could not start Angband.";
        launch.classList.add("error");
        retry.hidden = false;
    }
}

retry.addEventListener("click", () => {
    if (stopped) window.location.reload();
    else void start();
});
start();
