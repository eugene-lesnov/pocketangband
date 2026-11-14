import { prepareOffline } from "./offline.js";
import { loadTiles, renderTileMap, styleTerminalTile, tileAt } from "./tiles.js";

const main = document.querySelector("main");
const launch = document.querySelector("#launch");
const status = document.querySelector("#status");
const progress = document.querySelector("#download-progress");
const retry = document.querySelector("#retry");
const saveStatus = document.querySelector("#save-status");
const saveTransfer = document.querySelector("#save-transfer");
const transferActions = document.querySelector("#save-transfer-actions");
const importSave = document.querySelector("#import-save");
const exportSave = document.querySelector("#export-save");
const deleteSave = document.querySelector("#delete-save");
const importFile = document.querySelector("#import-file");
const transferStatus = document.querySelector("#transfer-status");
const exportFile = document.querySelector("#export-file");
const downloadSave = document.querySelector("#download-save");
const shareSave = document.querySelector("#share-save");
const viewTitle = document.querySelector("#view-title");
const viewOptions = document.querySelector("#view-options");
const levelMap = document.querySelector("#level-map");
const toggleTiles = document.querySelector("#toggle-tiles");
const zoomOut = document.querySelector("#zoom-out");
const zoomIn = document.querySelector("#zoom-in");
const hud = document.querySelector("#hud");
const vitals = document.querySelector("#vitals");
const openCharacter = document.querySelector("#open-character");
const depth = document.querySelector("#depth");
const hp = document.querySelector("#hp");
const sp = document.querySelector("#sp");
const activeConditions = document.querySelector("#active-conditions");
const extraConditions = document.querySelector("#extra-conditions");
const conditionsScreen = document.querySelector("#conditions-screen");
const characterScreen = document.querySelector("#character-screen");
const characterName = document.querySelector("#character-name");
const characterClass = document.querySelector("#character-class");
const characterSummary = document.querySelector("#character-summary");
const characterAttributes = document.querySelector("#character-attributes");
const characterConditions = document.querySelector("#character-conditions");
const characterCombat = document.querySelector("#character-combat");
const characterDefenses = document.querySelector("#character-defenses");
const characterProgress = document.querySelector("#character-progress");
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
const playKeyboard = document.querySelector("#play-keyboard");
const openMenu = document.querySelector("#open-menu");
const stopAction = document.querySelector("#stop-action");
const statActions = document.querySelector("#stat-actions");
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
const menuScreen = document.querySelector("#menu-screen");
const menuSummary = document.querySelector("#menu-summary");
const menuSections = document.querySelector("#menu-sections");
const menuRows = document.querySelector("#menu-rows");
const menuEmpty = document.querySelector("#menu-empty");
const menuActions = document.querySelector("#menu-actions");
const actionsScreen = document.querySelector("#actions-screen");
const quantity = document.querySelector("#quantity");
const rest = document.querySelector("#rest");
const keyboard = document.querySelector("#keyboard");
const keyboardToggle = document.querySelector("#keyboard-toggle");

const specialKeys = new Map([
    ["Enter", 13], ["Backspace", 8], ["Escape", 27], ["Save", 19], ["SaveAndQuit", 24], ["Tab", 9],
    ["ArrowDown", 0x80], ["ArrowLeft", 0x81], ["ArrowRight", 0x82], ["ArrowUp", 0x83], ["CtrlT", 20],
]);

const gameMenu = [
    ["Save", "Save"], ["SaveAndQuit", "Save and quit"], ["=", "Options"], ["?", "Help"],
];
const quickCommands = [
    ["r", "Read a scroll"], ["q", "Quaff a potion"], ["u", "Use a staff", "Z"],
    ["a", "Aim a wand", "z"], ["z", "Zap a rod", "a"], ["i", "Open the pack"],
    ["m", "Cast a spell"], ["f", "Fire", "t"], ["R", "Rest"],
];
const extraCommands = [
    [".", "Run", ","], ["l", "Look around", "x"], ["U", "Use an item", "X"],
    ["G", "Learn spells"], ["b", "Browse a book", "P"], ["v", "Throw an item"],
    ["E", "Eat food"], ["A", "Activate an item"], ["F", "Refuel light"],
    ["~", "Knowledge"], [":", "Take notes"], ["/", "Identify symbol"],
    ["*", "Choose a target"], ["[", "Visible monsters"], ["]", "Visible objects"],
    ["h", "Fire at nearest", "Tab"], ["+", "Alter a grid"], ["T", "Tunnel", "CtrlT"],
    ["D", "Disarm or lock"], ["o", "Open"], ["c", "Close door"],
    ["Enter", "All Angband commands"],
];
const panelTitles = { menu: "Menu", commands: "Commands", conditions: "Conditions" };
const commandFaces = new Map([["CtrlT", "^T"]]);
const restLabels = new Map([["&", "As needed"], ["*", "HP and MP"], ["!", "HP or MP"]]);

const scales = [0.75, 0.875, 1, 1.25, 1.5, 1.75];
const defaultMapZoom = scales.indexOf(1.5);
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
        zoom: defaultMapZoom,
    },
    target: {
        viewport: document.querySelector("#target-screen"),
        pre: document.querySelector("#target"),
        canvas: document.querySelector("#target-tiles"),
        title: "Targeting",
        zoom: defaultMapZoom,
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
let openPanel;
let panelTrigger;
let characterTrigger;
let pendingInput;
let stopTimer;
let saving = false;
let transferring = false;
let preparedFile;
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
        updatePrompt();
        if (view === views.terminal) {
            if ((centerPending || changed) && !menu &&
                (isMenu() || isTextEntry(mode) || mode === "quantity" || mode === "rest")) showCursor(view);
        } else if (cell && (centerPending || focusChanged || regionChanged || previousGrid !== view.gridElement)) {
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

function setZoom(index) {
    activeView.zoom = index;
    activeView.viewport.style.setProperty("--zoom", scales[index]);
    zoomOut.disabled = index === 0;
    zoomIn.disabled = index === scales.length - 1;
    centerPending = true;
    draw();
}

function renderWorld(state) {
    const depthLabel = state.depth ? `${state.depth * 50}′` : "Town";
    depth.textContent = depthLabel;
    hp.textContent = `HP ${state.hp}/${state.maxHp}`;
    hp.classList.toggle("low", state.lowHp);
    sp.textContent = `MP ${state.sp}/${state.maxSp}`;
    sp.hidden = !state.magic;
    const alerts = [...state.conditions].sort((left, right) => right.priority - left.priority);
    const labels = alerts.slice(0, 2).map(({ label }) => label);
    if (labels.length === 2 && labels.join(" · ").length > 25) labels.pop();
    const more = alerts.length - labels.length;
    activeConditions.textContent = labels.join(" · ");
    extraConditions.hidden = more <= 0;
    extraConditions.textContent = `+${more}`;
    vitals.setAttribute("aria-label", [hp.textContent, state.magic && sp.textContent,
        state.depth ? `Depth ${state.depth * 50} feet` : "Town", ...labels,
        more > 0 && `${more} more conditions`, "View conditions"].filter(Boolean).join(", "));

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
        .filter(({ label }) => label !== state.speed && label !== state.foodGrade)
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

function renderCharacter() {
    const sheet = context.character;
    if (!sheet || !world) return;
    characterName.textContent = sheet.name;
    characterName.hidden = !sheet.name;
    characterClass.textContent = `${sheet.race} ${sheet.className} · Level ${sheet.level}`;

    const rowsFor = (section) => sheet.rows.filter((row) => row.section === section);
    const progress = new Map(rowsFor(2).map(({ label, value }) => [label, value]));
    const combat = rowsFor(3);
    const experience = progress.get("Cur Exp");
    const nextLevel = progress.get("Adv Exp");
    const hasNextLevel = /^\d+$/.test(nextLevel ?? "");
    characterSummary.replaceChildren(characterRows([
        { label: "HP", value: `${world.hp}/${world.maxHp}` },
        ...(world.magic ? [{ label: "MP", value: `${world.sp}/${world.maxSp}` }] : []),
        ...combat.filter(({ label }) => label === "Armor"),
        { label: "Gold", value: progress.get("Gold") },
        { label: hasNextLevel ? "XP toward next level" : "Experience",
            value: hasNextLevel ? `${experience} / ${nextLevel}` : experience },
    ]));
    characterAttributes.replaceChildren(characterRows(rowsFor(0)));
    renderConditions(characterConditions);

    characterCombat.replaceChildren();
    const meleeHit = combat.findIndex(({ label }) => label === "To-hit");
    const attackRows = combat.map((row, index) => row.label === "To-hit" ?
        { ...row, label: index === meleeHit ? "Melee to-hit" : "Ranged to-hit" } : row);
    appendCharacterGroup(characterCombat, "Combat", attackRows.filter(({ label }) => label !== "Armor"));
    appendCharacterGroup(characterCombat, "Skills", rowsFor(4));

    characterDefenses.replaceChildren();
    for (const [group, title] of [["resistances", "Resistances"],
        ["abilities", "Abilities"], ["hindrances", "Hindrances"]]) {
        appendCharacterGroup(characterDefenses, title, sheet.defenses.filter((row) => row.group === group));
    }

    characterProgress.replaceChildren(characterRows([
        { label: "Highest XP", value: progress.get("Max Exp") },
        { label: "Deepest level", value: progress.get("Max Depth") },
        { label: "Burden", value: progress.get("Burden") },
        ...(progress.has("Overweight") ? [{ label: "Overweight", value: progress.get("Overweight") }] : []),
    ]));
    const background = rowsFor(1);
    const turnCounters = ["Game", "Standard", "Resting"];
    appendCharacterGroup(characterProgress, "Turn counts", background.filter(({ label }) => turnCounters.includes(label)));
    appendCharacterGroup(characterProgress, "Background", background.filter(({ label }) => !turnCounters.includes(label)));
    if (sheet.history) {
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
    const disabled = request === undefined || saving || transferring || stopped;
    const command = mode === "command";
    const selecting = mode === "target";
    const aiming = mode === "aim";
    const directing = mode === "direction";
    const editing = isTextEntry(mode);
    const counting = mode === "quantity";
    const resting = mode === "rest";
    const confirming = mode === "confirm";
    const history = mode === "history";
    const stats = mode === "birth-stats";
    const more = mode === "more";
    const overview = mode === "overview";
    const details = mode === "details";
    const character = mode === "character";
    const hasTarget = aiming && context.current;
    const canOpenKeyboard = !counting && !resting && !confirming && !history &&
        !more && !overview && !details && !openPanel;
    const showKeyboard = keyboardOpen && canOpenKeyboard;
    const playing = command && !openPanel && !showKeyboard;
    const stopVisible = !stopAction.hidden;
    levelMap.hidden = toggleTiles.hidden = !command || !!openPanel;
    levelMap.disabled = disabled;
    toggleTiles.disabled = disabled || !tilesReady;
    toggleTiles.setAttribute("aria-pressed", String(!!views.map.frame?.terrainAttributes));
    openCharacter.disabled = !command || disabled;
    vitals.disabled = disabled || !(selecting || aiming || directing || command);
    views.terminal.viewport.classList.toggle("selectable", isMenu() && !menu);
    views.target.viewport.classList.toggle("selectable", selecting || aiming || directing);
    const playPad = command || selecting || aiming || directing;
    const padVisible = !openPanel && !showKeyboard && !stopVisible &&
        (playPad || stats || (isMenu() && !menu));
    setActions(directionPad, padVisible, disabled);
    directionPad.classList.toggle("cardinal", mode === "save-slots" || stats);
    directionCenter.disabled = !command && !(directing && context.center);
    centerCaption.textContent = directing ? "Here" : "Wait";
    directionCenter.setAttribute("aria-label", directing ? "Choose your cell" : "Wait one turn");
    setActions(playKeys, playing && !stopVisible, disabled);
    setActions(terminalKeys, !playing && !stopVisible && !(command && showKeyboard), disabled);
    confirmKey.dataset.key = confirming || history ? "y" : selecting ? "t" : aiming ?
        hasTarget ? "5" : "*" : details || character || overview ? "Escape" : "Enter";
    cancelKey.dataset.key = confirming || history ? "n" : "Escape";
    if (details) cancelKey.dataset.key = confirmKey.dataset.key;
    const useTarget = context.verb === "Use" ? "Use target" : `${context.verb} at target`;
    confirmKey.textContent = confirming ? "Yes" : history ? "Keep history" :
        selecting ? context.attack ? context.verb : "Select target" :
        aiming ? hasTarget ? useTarget : "Choose target" :
        editing || counting || resting || stats ? "Done" : isMenu() ? "Select" :
        overview || details || character ? "Close" : "Continue";
    confirmKey.hidden = !!openPanel;
    confirmKey.disabled = directing || (selecting && !context.canSelect) ||
        (!!menu && !menu.rows.some((row) => row.index === menuCursor && row.enabled));
    cancelKey.textContent = confirming ? "No" : history ? "Edit history" : openPanel || (showKeyboard && !editing) ?
        "Back" : selecting || aiming || directing || editing || counting || resting ?
            "Cancel" : command ? "Esc" : "Back";
    cancelKey.setAttribute("aria-label", cancelKey.textContent);
    cancelKey.hidden = more || character;
    setActions(worldActions, playing && !stopVisible, disabled);
    setActions(statActions, stats && !showKeyboard && !openPanel, disabled);
    setActions(aimActions, aiming && !showKeyboard && !openPanel && (context.nearest || hasTarget), disabled);
    nearest.hidden = !context.nearest;
    nearest.textContent = `${context.verb === "Use" ? "Use on" : context.verb + " at"} nearest`;
    aimActions.lastElementChild.hidden = !hasTarget;
    setActions(targetActions, selecting && !showKeyboard && !openPanel, disabled);
    previousTarget.disabled = nextTarget.disabled = context.freeAim || context.targetCount < 2;
    targetMode.textContent = context.freeAim ? "Targets" : "Free aim";
    targetMode.dataset.key = context.freeAim ? "m" : "o";
    targetMode.disabled = context.freeAim && !context.targetCount;
    targetInspect.disabled = !context.canInspect;
    setActions(quantity, counting, disabled);
    setActions(rest, resting && !stopVisible, disabled);
    setActions(keyboard, showKeyboard && !stopVisible, disabled);
    keyboardToggle.hidden = !canOpenKeyboard;
    keyboardToggle.textContent = showKeyboard ? "Hide" : "Keys";
    keyboardToggle.setAttribute("aria-expanded", String(showKeyboard));
    keyboardToggle.setAttribute("aria-label", showKeyboard ? "Hide keyboard" : "Keyboard");
    setActions(actionsScreen, !!openPanel && openPanel !== "conditions", disabled);
    setActions(menuActions, !!menu?.actions.length, disabled);
    menuRows.disabled = menuSections.disabled = disabled;
    saveTransfer.hidden = mode !== "save-slots";
    transferActions.disabled = disabled;
    deleteSave.disabled = !(menuCursor > 0);
}

function showTransferStatus(message, failed = false) {
    transferStatus.textContent = message;
    transferStatus.classList.toggle("error", failed);
    transferStatus.hidden = false;
}

function clearExport() {
    if (preparedFile) {
        const url = downloadSave.getAttribute("href");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        preparedFile = undefined;
    }
    downloadSave.removeAttribute("href");
    exportFile.hidden = true;
}

function prepareExport(slot, data) {
    const filename = `Angband-${slot.replace(/[^a-z0-9_-]+/gi, "-")}.sav`;
    preparedFile = new File([data], filename, { type: "application/octet-stream" });
    downloadSave.href = URL.createObjectURL(preparedFile);
    downloadSave.download = filename;
    const canShare = navigator.canShare?.({ files: [preparedFile] });
    shareSave.hidden = !canShare;
    shareSave.disabled = false;
    exportFile.hidden = false;
    showTransferStatus(`Save file ready for ${slot}.`);
}

function requestSaveTransfer(type, file) {
    if (mode !== "save-slots" || transferring || request === undefined) return;
    if (type === "delete-save" && !(menuCursor > 0)) return;
    clearExport();
    const selectedRequest = request;
    request = undefined;
    transferring = true;
    if (type === "delete-save") transferStatus.hidden = true;
    else showTransferStatus(type === "import-save" ? "Importing save…" : "Preparing save file…");
    updateControls();
    worker.postMessage({ type, request: selectedRequest, file, cursor: menuCursor });
}

importSave.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    importFile.value = "";
    if (file) requestSaveTransfer("import-save", file);
});
exportSave.addEventListener("click", () => requestSaveTransfer("export-save"));
deleteSave.addEventListener("click", () => requestSaveTransfer("delete-save"));
shareSave.addEventListener("click", async () => {
    const file = preparedFile;
    if (!file) return;
    shareSave.disabled = true;
    try {
        await navigator.share({ files: [file] });
    } catch (error) {
        if (error.name !== "AbortError" && file === preparedFile) {
            showTransferStatus("Could not share the save. Use Download file.", true);
        }
    } finally {
        if (file === preparedFile) shareSave.disabled = false;
    }
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
    let text = context.prompt || menu?.prompt;
    if (mode === "aim") text = `${context.verb}: choose a target or direction.`;
    if (mode === "direction") text = "Choose a direction.";
    if (mode === "save-slots") text = "Choose a save or start a new game.";
    if (mode === "rest") text = "Rest for how long? Choose a preset or enter 1–9999 turns.";
    if (mode === "rest" && !stopAction.hidden) text = "Resting…";
    if (mode === "target" || mode === "more" ||
        (!text && (isTextEntry(mode) || mode === "quantity"))) {
        text = terminalLine(0);
        if (mode === "more") text = text.replace(/\s*-more-\s*$/, "");
    }
    if (mode === "confirm" && context.prompt) text = "";
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
    const map = (mode === "command" || mode === "more") && context.worldView;
    const aiming = mode === "target" || mode === "aim" || mode === "direction";
    activeView = aiming && region ? views.target : world && map ? views.map : views.terminal;
    const editing = context.value !== undefined && !openPanel;
    const question = mode === "confirm" && context.prompt;
    const showDetails = context.detail !== undefined;
    const showCharacter = mode === "character" && !!context.character;
    characterScreen.hidden = !showCharacter;
    conditionsScreen.hidden = openPanel !== "conditions";
    detailsScreen.hidden = !showDetails;
    if (showDetails && detailsScreen.textContent !== context.detail) {
        detailsScreen.textContent = context.detail;
        detailsScreen.scrollTop = 0;
    }
    editScreen.hidden = !editing && !question;
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
        view !== activeView || !!menu || !!openPanel || editing || !!question || showDetails || showCharacter;
    if (previous !== activeView && activeView === views.terminal) {
        activeView.viewport.scrollTo(0, 0);
    }
    const showMap = activeView !== views.terminal && !activeView.viewport.hidden;
    main.classList.toggle("in-world", showMap);
    main.classList.toggle("in-game-panel", !!openPanel || showCharacter);
    hud.hidden = !showMap || !world;
    viewOptions.hidden = !showMap;
    if (!showMap) viewOptions.setAttribute("aria-expanded", "false");
    const title = showCharacter ? "Character" : mode === "aim" ? "Aim" : mode === "direction" ? "Direction" :
        mode === "overview" ? "Level map" : mode === "details" ? "Details" :
        mode === "history" ? "Character history" : mode === "birth-stats" ? "Allocate stats" :
        question ? "Confirm" : editing ? mode === "name" ? "Character name" : mode === "quantity" ? "Quantity" :
            mode === "rest" ? "Rest" : "Text entry" : activeView.title;
    const activeSection = menu?.sections?.find((section) => section.active);
    viewTitle.textContent = panelTitles[openPanel] ?? (mode === "save-slots" ? "Save slots" :
        menu?.store?.name ?? activeSection?.label ?? (menu ? "Choices" : mode === "details" ? context.prompt || title : title));
    zoomOut.hidden = zoomIn.hidden = !!menu || !!openPanel || editing || !!question || showDetails || showCharacter;
    if (previous !== activeView) {
        if (activeView === views.target) activeView.zoom = views.map.zoom;
        setZoom(activeView.zoom);
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
    clearExport();
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
        case "waiting": {
            clearPendingInput();
            const changed = data.mode !== mode;
            if (changed) {
                centerPending = true;
                if (mode === "save-slots") {
                    clearExport();
                    transferStatus.hidden = true;
                }
                keyboardOpen = false;
                openPanel = panelTrigger = undefined;
                if (isTextEntry(data.mode)) {
                    keyboardLayer = 0;
                    shifted = data.mode === "name";
                    keyboardOpen = true;
                }
            }
            mode = data.mode;
            request = data.request;
            context = data.context;
            menu = data.menu;
            transferring = false;
            if (changed && isTextEntry(mode)) renderKeyboard();
            launch.hidden = true;
            main.classList.remove("starting");
            updateView(mode === "command" ? data.world ?? null : data.world ?? world, data.region ?? null);
            if (mode === "command" && world) renderQuickActions(world);
            if (mode === "character") renderCharacter();
            if (changed && (mode === "confirm" || mode === "quantity" || mode === "rest" || isTextEntry(mode))) {
                views.terminal.viewport.scrollTo(0, 0);
            }
            updateControls();
            if (changed && mode === "character") {
                for (const detail of characterScreen.querySelectorAll(".character-detail")) detail.open = false;
                characterScreen.scrollTop = 0;
                if (!characterScreen.hidden) characterScreen.focus({ preventScroll: true });
            }
            if (mode === "command" && characterTrigger) {
                characterTrigger.focus({ preventScroll: true });
                characterTrigger = undefined;
            }
            break;
        }
        case "saving":
            clearPendingInput();
            saving = true;
            updateControls();
            saveStatus.textContent = "Saving game…";
            saveStatus.classList.remove("error");
            saveStatus.hidden = false;
            updatePrompt();
            break;
        case "saved":
            saving = false;
            updateControls();
            saveStatus.textContent = data.ok ? "Game saved." : "Could not save the game.";
            saveStatus.classList.toggle("error", !data.ok);
            saveStatus.hidden = false;
            updatePrompt();
            break;
        case "save-imported":
            transferring = false;
            updateControls();
            showTransferStatus(`Imported into ${data.slot}.`);
            break;
        case "save-deleted":
            transferring = false;
            updateControls();
            showTransferStatus(`Deleted ${data.slot}.`);
            break;
        case "save-exported":
            transferring = false;
            updateControls();
            try {
                prepareExport(data.slot, data.data);
            } catch (error) {
                console.error(error);
                clearExport();
                showTransferStatus("Could not export the save.", true);
            }
            break;
        case "save-transfer-error":
            transferring = false;
            if (data.request !== undefined) request = data.request;
            updateControls();
            showTransferStatus(data.message, true);
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
    stopAction.hidden = true;
    stopAction.disabled = false;
}

function sendInput(input) {
    if (request === undefined || saving || transferring || stopped) return false;
    if (!saveStatus.classList.contains("error")) saveStatus.hidden = true;
    journal.open = false;
    if (input.type !== "toggle-tiles") viewOptions.setAttribute("aria-expanded", "false");
    worker.postMessage({ ...input, request });
    if ((mode === "command" || !hud.hidden || mode === "rest" || (mode === "menu" && !menu?.store)) &&
        ["key", "menu-row", "aim-cell", "target-cell"].includes(input.type)) {
        pendingInput = request;
        stopTimer = setTimeout(() => {
            stopAction.hidden = false;
            updateControls();
            updatePrompt();
        }, 150);
    }
    request = undefined;
    toggleTiles.disabled = true;
    transferActions.disabled = true;
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
    if (button === confirmKey && menu) {
        sendInput({ type: "menu-row", code: menuCursor });
        return;
    }
    const key = button.dataset.key;
    const input = button.dataset.input ?
        { type: button.dataset.input, code: Number(button.dataset.value) } :
        { type: "key", code: keyCode(key) };
    if (input.type === "menu-row" && menu?.store) {
        menuCursor = input.code;
        for (const row of menuRows.children) {
            if (row === button) row.setAttribute("aria-current", "true");
            else row.removeAttribute("aria-current");
        }
        updateControls();
        return;
    }
    if (input.type === "store-action") input.row = menuCursor;
    if (!sendInput(input)) return;
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

function renderQuickActions({ roguelike }) {
    const keyset = roguelike ? "roguelike" : "original";
    if (worldActions.dataset.keyset === keyset) return;
    worldActions.dataset.keyset = keyset;
    worldActions.replaceChildren(...quickCommands.map((entry) => {
        const key = commandKey(entry, roguelike);
        const label = entry[1];
        const button = makeKey(key, "", `${label} (${key})`);
        button.title = label;
        button.append(keyBadge(key));
        return button;
    }));
}

function renderActionsPanel() {
    const commands = openPanel === "menu" ? gameMenu : openPanel === "commands" ? extraCommands : null;
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

function renderMenu(state) {
    menuScreen.hidden = !state;
    if (!state) {
        renderedMenu = undefined;
        menuCursor = undefined;
        return;
    }
    if (state === renderedMenu) return;
    const previous = renderedMenu;
    renderedMenu = state;
    const active = state.sections?.find((section) => section.active)?.id;
    const previousActive = previous?.sections?.find((section) => section.active)?.id;
    const differentList = !previous || state.id !== previous.id || active !== previousActive ||
        state.prompt !== previous.prompt;
    const previousScroll = menuScreen.scrollTop;
    menuCursor = state.cursor;
    menuSummary.hidden = !state.store || state.store.home;
    menuSummary.textContent = state.store && !state.store.home ? `Gold: ${state.store.gold} au` : "";
    menuSections.hidden = !state.sections?.length;
    menuSections.replaceChildren(...(state.sections ?? []).map((section) => {
        const button = makeInput("menu-section", section.id, section.label);
        button.disabled = section.active;
        button.setAttribute("aria-pressed", String(section.active));
        return button;
    }));
    menuEmpty.hidden = state.rows.length > 0;
    const focused = document.activeElement?.closest("button[data-input]");
    const focusedCode = focused && menuRows.contains(focused) ? focused.dataset.value : undefined;
    let current;
    menuRows.replaceChildren(...state.rows.map((row) => {
        const button = makeInput("menu-row", row.index, row.name);
        button.disabled = !row.enabled;
        if (row.index === menuCursor && row.enabled) {
            current = button;
            button.setAttribute("aria-current", "true");
        }
        const description = document.createElement("span");
        description.textContent = row.name;
        if (row.detail) {
            const detail = document.createElement("small");
            detail.textContent = row.detail;
            description.append(detail);
        }
        const price = document.createElement("span");
        price.className = "price";
        price.textContent = row.price;
        button.replaceChildren(keyBadge(row.key ? String.fromCharCode(row.key) : ""),
            description, price);
        button.setAttribute("aria-label", [row.name, row.detail, row.price].filter(Boolean).join(", "));
        return button;
    }));
    menuActions.replaceChildren(...state.actions.map((action) =>
        makeInput("store-action", action.key, action.label)));
    menuScreen.scrollTop = differentList ? 0 : previousScroll;
    if (current && !differentList && state.cursor !== previous.cursor) {
        const bounds = current.getBoundingClientRect();
        const screen = menuScreen.getBoundingClientRect();
        if (bounds.top < screen.top) menuScreen.scrollTop += bounds.top - screen.top;
        else if (bounds.bottom > screen.bottom) menuScreen.scrollTop += bounds.bottom - screen.bottom;
    }
    if (focusedCode && !differentList && !focused?.isConnected) {
        const button = [...menuRows.children].find((row) => row.dataset.value === focusedCode);
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
    if (mode === "terminal" || mode === "birth-stats" || (isMenu() && !menu)) rows.unshift([
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
showKeys(rest, [
    [makeKey("&", "As needed"), makeKey("*", "HP and MP"), makeKey("!", "HP or MP")],
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
openCharacter.addEventListener("click", () => {
    if (sendInput({ type: "key", code: keyCode("C") })) {
        characterTrigger = openCharacter;
    }
});
vitals.addEventListener("click", () => {
    if (request !== undefined) showPanel("conditions", vitals);
});
stopAction.addEventListener("click", () => {
    if (pendingInput === undefined) return;
    worker.postMessage({ type: "interrupt", request: pendingInput });
    stopAction.disabled = true;
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
zoomOut.addEventListener("click", () => setZoom(activeView.zoom - 1));
zoomIn.addEventListener("click", () => setZoom(activeView.zoom + 1));
viewOptions.addEventListener("click", () => {
    journal.open = false;
    viewOptions.setAttribute("aria-expanded", String(viewOptions.getAttribute("aria-expanded") !== "true"));
});
journal.addEventListener("toggle", () => {
    if (!journal.open) return;
    viewOptions.setAttribute("aria-expanded", "false");
    messages.scrollTop = messages.scrollHeight;
});
const mapResize = new ResizeObserver(() => {
    if (activeView === views.terminal || activeView.viewport.hidden) return;
    centerPending = true;
    draw();
});
mapResize.observe(views.map.viewport);
mapResize.observe(views.target.viewport);

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
    if (mode === undefined || saving || transferring || event.isComposing || event.altKey) return;
    if (event.key === "Escape" && pendingInput !== undefined && !stopAction.hidden) {
        stopAction.click();
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
    if (mode === "character" && characterScreen.contains(event.target) &&
        [" ", "ArrowUp", "ArrowDown"].includes(event.key)) return;

    if (event.key === "Tab") return;
    if (menu && event.key === "Enter") {
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
            (isTextEntry(mode) && event.key === "Backspace")) sendInput({ type: "key", code });
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
