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
const importFile = document.querySelector("#import-file");
const transferStatus = document.querySelector("#transfer-status");
const exportFile = document.querySelector("#export-file");
const downloadSave = document.querySelector("#download-save");
const shareSave = document.querySelector("#share-save");
const viewTitle = document.querySelector("#view-title");
const viewOptions = document.querySelector("#view-options");
const toggleTiles = document.querySelector("#toggle-tiles");
const zoomOut = document.querySelector("#zoom-out");
const zoomIn = document.querySelector("#zoom-in");
const hud = document.querySelector("#hud");
const character = document.querySelector("#character");
const depth = document.querySelector("#depth");
const hp = document.querySelector("#hp");
const sp = document.querySelector("#sp");
const ac = document.querySelector("#ac");
const gold = document.querySelector("#gold");
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
const commandsScreen = document.querySelector("#commands-screen");
const quantity = document.querySelector("#quantity");
const rest = document.querySelector("#rest");
const keyboard = document.querySelector("#keyboard");
const keyboardToggle = document.querySelector("#keyboard-toggle");

const specialKeys = new Map([
    ["Enter", 13], ["Backspace", 8], ["Escape", 27], ["Save", 19], ["SaveAndQuit", 24], ["Tab", 9],
    ["ArrowDown", 0x80], ["ArrowLeft", 0x81], ["ArrowRight", 0x82], ["ArrowUp", 0x83], ["CtrlT", 20],
]);

const commandGroups = [
    ["Explore", [
        ["<", "Ascend stairs"], [">", "Descend stairs"], ["g", "Pick up"], ["R", "Rest"],
        ["l", "Look around", "x"], ["*", "Choose a target"], ["M", "Level map"],
        ["o", "Open"], ["c", "Close"], ["D", "Disarm"], ["T", "Tunnel", "CtrlT"],
    ]],
    ["Items and combat", [
        ["i", "Inventory"], ["e", "Equipment"], ["U", "Use an item", "X"], ["w", "Wear or wield"],
        ["t", "Take off", "T"], ["|", "Quiver"], ["f", "Fire", "t"], ["m", "Cast"],
        ["v", "Throw"], ["h", "Fire at nearest", "Tab"],
    ]],
    ["Game", [
        ["Save", "Save"], ["SaveAndQuit", "Save and quit"],
        ["=", "Options"], ["?", "Help"], ["Enter", "All Angband commands"],
    ]],
];
const commandByKey = new Map(commandGroups.flatMap(([, commands]) => commands.map((command) =>
    [command[0], command])));
const quickCommands = ["<", ">", "g", "i", "e", "U", "f", "m", "R"].map((key) => commandByKey.get(key));
const commandFaces = new Map([["CtrlT", "^T"], ["Tab", "⇥"]]);
const restLabels = new Map([["&", "As needed"], ["*", "HP and MP"], ["!", "HP or MP"]]);
const keyboardHeight = 230;

const scales = [0.75, 0.875, 1, 1.25, 1.5, 1.75];
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
        zoom: 2,
    },
    target: {
        viewport: document.querySelector("#target-screen"),
        pre: document.querySelector("#target"),
        canvas: document.querySelector("#target-tiles"),
        title: "Targeting",
        zoom: 2,
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
let commandsOpen = false;
let keyboardOnly = false;
let commandKeyset;
let saving = false;
let transferring = false;
let preparedFile;
let stopped = false;
let tilesReady = false;
let backgroundSaveRequested = false;
let drawPending = false;
let centerPending = false;
let keyboardOpen = false;
let symbols = false;
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
    character.textContent = `${state.name} · Lv. ${state.level}`;
    depth.textContent = state.depth ? `Depth ${state.depth}` : "Town";
    hp.textContent = `${state.hp}/${state.maxHp}`;
    sp.textContent = `${state.sp}/${state.maxSp}`;
    ac.textContent = state.ac;
    gold.textContent = state.gold;

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

function isMenu() {
    return mode === "menu" || mode === "save-slots";
}

function isTextEntry(state) {
    return state === "name" || state === "text";
}

function closeInputPanel() {
    if (!commandsOpen && (!keyboardOpen || isTextEntry(mode))) return false;
    commandsOpen = keyboardOpen = keyboardOnly = false;
    updateView();
    updateControls();
    return true;
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
    const hasTarget = aiming && context.current;
    const canOpenKeyboard = !counting && !resting && !confirming && !history && !more && !overview && !details;
    const showKeyboard = keyboardOpen && !commandsOpen && canOpenKeyboard;
    toggleTiles.hidden = !command || commandsOpen;
    toggleTiles.disabled = disabled || !tilesReady;
    toggleTiles.setAttribute("aria-pressed", String(!!views.map.frame?.terrainAttributes));
    views.terminal.viewport.classList.toggle("selectable", isMenu() && !menu);
    views.target.viewport.classList.toggle("selectable", selecting || aiming || directing);
    const playPad = command || selecting || aiming || directing;
    const padVisible = !commandsOpen && !keyboardOnly &&
        (playPad || stats || (isMenu() && !menu && !showKeyboard));
    setActions(directionPad, padVisible, disabled);
    directionPad.classList.toggle("cardinal", mode === "save-slots" || stats);
    directionCenter.disabled = !command && !(directing && context.center);
    centerCaption.textContent = directing ? "Here" : "Wait";
    directionCenter.setAttribute("aria-label", directing ? "Choose your cell" : "Wait one turn");
    setActions(terminalKeys, true, disabled);
    confirmKey.dataset.key = confirming || history ? "y" : selecting ? "t" : aiming ?
        hasTarget ? "5" : "*" : details ? "Escape" : "Enter";
    cancelKey.dataset.key = confirming || history ? "n" : "Escape";
    if (details) cancelKey.dataset.key = confirmKey.dataset.key;
    const useTarget = context.verb === "Use" ? "Use target" : `${context.verb} at target`;
    confirmKey.textContent = command ? commandsOpen ? "All commands" : "Commands" :
        confirming ? "Yes" : history ? "Keep history" : selecting ? context.attack ? context.verb : "Select target" :
        aiming ? hasTarget ? useTarget : "Choose target" :
        editing || counting || resting || stats ? "Done" : isMenu() ? "Select" :
        overview || details ? "Close" : "Continue";
    confirmKey.disabled = directing || (selecting && !context.canSelect) ||
        (!!menu && !menu.rows.some((row) => row.index === menuCursor && row.enabled));
    cancelKey.textContent = confirming ? "No" : history ? "Edit history" : commandsOpen || (showKeyboard && !editing) ?
        "Back" : selecting || aiming || directing || editing || counting || resting ?
            "Cancel" : command ? "Esc" : "Back";
    cancelKey.setAttribute("aria-label", cancelKey.textContent);
    cancelKey.disabled = more || (command && !commandsOpen && !keyboardOpen);
    setActions(worldActions, command && !commandsOpen && !keyboardOnly, disabled);
    setActions(statActions, stats && !showKeyboard, disabled);
    setActions(aimActions, aiming && !keyboardOnly && (context.nearest || hasTarget), disabled);
    nearest.hidden = !context.nearest;
    nearest.textContent = `${context.verb === "Use" ? "Use on" : context.verb + " at"} nearest`;
    aimActions.lastElementChild.hidden = !hasTarget;
    setActions(targetActions, selecting && !keyboardOnly, disabled);
    previousTarget.disabled = nextTarget.disabled = context.freeAim || context.targetCount < 2;
    targetMode.textContent = context.freeAim ? "Targets" : "Free aim";
    targetMode.dataset.key = context.freeAim ? "m" : "o";
    targetMode.disabled = context.freeAim && !context.targetCount;
    targetInspect.disabled = !context.canInspect;
    setActions(quantity, counting, disabled);
    setActions(rest, resting, disabled);
    setActions(keyboard, showKeyboard, disabled);
    main.classList.toggle("keyboard-open", showKeyboard && !keyboardOnly);
    keyboardToggle.disabled = !canOpenKeyboard || commandsOpen;
    keyboardToggle.setAttribute("aria-expanded", String(showKeyboard));
    keyboardToggle.setAttribute("aria-label", showKeyboard ? "Hide keyboard" : "Keyboard");
    setActions(commandsScreen, commandsOpen, disabled);
    setActions(menuActions, !!menu?.actions.length, disabled);
    menuRows.disabled = menuSections.disabled = disabled;
    saveTransfer.hidden = mode !== "save-slots";
    transferActions.disabled = disabled;
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
    clearExport();
    const selectedRequest = request;
    request = undefined;
    transferring = true;
    showTransferStatus(type === "import-save" ? "Importing save…" : "Preparing save file…");
    updateControls();
    worker.postMessage({ type, request: selectedRequest, file });
}

importSave.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    importFile.value = "";
    if (file) requestSaveTransfer("import-save", file);
});
exportSave.addEventListener("click", () => requestSaveTransfer("export-save"));
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
    if (mode === "target" || mode === "more" ||
        (!text && (isTextEntry(mode) || mode === "quantity"))) {
        text = terminalLine(0);
        if (mode === "more") text = text.replace(/\s*-more-\s*$/, "");
    }
    if (mode === "confirm" && context.prompt) text = "";
    inputPrompt.hidden = !text || commandsOpen;
    if (inputPrompt.textContent !== (text || "")) inputPrompt.textContent = text || "";
    const saveNotice = !saveStatus.hidden && !saveStatus.classList.contains("error");
    journal.hidden = hud.hidden || !inputPrompt.hidden || saveNotice;
    if (journal.hidden) journal.open = false;
}

function updateView(state = world, region = views.target.crop) {
    const previous = activeView;
    world = state;
    views.target.crop = region;
    const map = mode === "command" || (mode === "more" && context.worldView);
    const aiming = mode === "target" || mode === "aim" || mode === "direction";
    activeView = aiming && region ? views.target : world && map ? views.map : views.terminal;
    const editing = context.value !== undefined && !commandsOpen;
    const question = mode === "confirm" && context.prompt;
    const showDetails = context.detail !== undefined;
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
        view !== activeView || !!menu || commandsOpen || editing || !!question || showDetails;
    if (previous !== activeView && activeView === views.terminal) {
        activeView.viewport.scrollTo(0, 0);
    }
    const showMap = activeView !== views.terminal && !activeView.viewport.hidden;
    main.classList.toggle("in-world", showMap);
    hud.hidden = !showMap || !world;
    viewOptions.hidden = !showMap;
    if (!showMap) viewOptions.setAttribute("aria-expanded", "false");
    const title = mode === "aim" ? "Aim" : mode === "direction" ? "Direction" :
        mode === "overview" ? "Level map" : mode === "details" ? "Details" :
        mode === "history" ? "Character history" : mode === "birth-stats" ? "Allocate stats" :
        question ? "Confirm" : editing ? mode === "name" ? "Character name" : mode === "quantity" ? "Quantity" :
            mode === "rest" ? "Rest" : "Text entry" : activeView.title;
    const activeSection = menu?.sections?.find((section) => section.active);
    viewTitle.textContent = commandsOpen ? "Commands" : mode === "save-slots" ? "Save slots" : menu?.store?.name ??
        activeSection?.label ?? (menu ? "Choices" : mode === "details" ? context.prompt || title : title);
    zoomOut.hidden = zoomIn.hidden = !!menu || commandsOpen || editing || !!question || showDetails;
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
    commandsOpen = false;
    clearExport();
    keyboardOpen = keyboardOnly = false;
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
            const changed = data.mode !== mode;
            if (changed) {
                centerPending = true;
                if (mode === "save-slots") {
                    clearExport();
                    transferStatus.hidden = true;
                }
                keyboardOpen = keyboardOnly = false;
                commandsOpen = false;
                if (isTextEntry(data.mode)) {
                    symbols = false;
                    shifted = data.mode === "name";
                    keyboardOpen = true;
                }
            }
            mode = data.mode;
            request = data.request;
            context = data.context;
            menu = data.menu;
            if (changed && isTextEntry(mode)) renderKeyboard();
            if (data.world) renderCommands(data.world.roguelike);
            launch.hidden = true;
            main.classList.remove("starting");
            updateView(mode === "command" ? data.world ?? null : data.world ?? world, data.region ?? null);
            if (changed && (mode === "confirm" || mode === "quantity" || mode === "rest" || isTextEntry(mode))) {
                views.terminal.viewport.scrollTo(0, 0);
            }
            updateControls();
            break;
        }
        case "saving":
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

function sendInput(input) {
    if (request === undefined || saving || transferring || stopped) return false;
    if (!saveStatus.classList.contains("error")) saveStatus.hidden = true;
    journal.open = false;
    if (input.type !== "toggle-tiles") viewOptions.setAttribute("aria-expanded", "false");
    worker.postMessage({ ...input, request });
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
    if (!button || button.matches(":disabled") || (event.detail !== 0 &&
        (buttonPress?.button !== button || buttonPress.request !== request))) return;

    if (button === cancelKey && closeInputPanel()) return;
    if (button === confirmKey && mode === "command" && !commandsOpen) {
        commandsOpen = true;
        keyboardOpen = keyboardOnly = false;
        commandsScreen.scrollTop = 0;
        updateView();
        updateControls();
        return;
    }
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
    if (commandsOpen) {
        commandsOpen = false;
        updateView();
        updateControls();
    }
    if (keyboard.contains(button) && shifted && /^[A-Z]$/.test(key) && !symbols) {
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

function renderCommands(roguelike) {
    if (commandKeyset === roguelike) return;
    commandKeyset = roguelike;
    const commandKey = ([key, , alternative]) => roguelike && alternative ? alternative : key;
    const face = (key) => commandFaces.get(key) ?? key;
    worldActions.replaceChildren(...quickCommands.map((command) => {
        const key = commandKey(command);
        const button = makeKey(key, face(key), command[1]);
        button.title = command[1];
        return button;
    }));
    commandsScreen.replaceChildren(...commandGroups.flatMap(([title, commands]) => {
        const heading = document.createElement("h3");
        heading.textContent = title;
        return [heading, ...commands.map((command) => {
            const key = commandKey(command);
            const button = makeKey(key, command[1]);
            if (!["Enter", "Save", "SaveAndQuit"].includes(key)) button.prepend(keyBadge(face(key)));
            return button;
        })];
    }));
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
    const lines = symbols ? ["1234567890", "-=,.;:/?!@#", "$%&*()[]{}\\", "'\"<>+_~`^|"] :
        ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    const rows = lines.map((line) => [...line].map((key) => makeKey(!symbols && shifted ? key.toUpperCase() : key)));
    if (mode === "name") rows.unshift([makeKey("*", "Random name"),
        makeKey("ArrowLeft", "←", "Move text cursor left"), makeKey("ArrowRight", "→", "Move text cursor right")]);
    if (mode === "text") rows.unshift([makeKey("ArrowLeft", "←", "Move text cursor left"),
        makeKey("ArrowRight", "→", "Move text cursor right")]);
    if (mode === "terminal" || (isMenu() && !menu)) rows.unshift([
        makeKey("ArrowLeft", "←", "Left"), makeKey("ArrowUp", "↑", "Up"),
        makeKey("ArrowDown", "↓", "Down"), makeKey("ArrowRight", "→", "Right"),
    ]);
    const switchLayer = makeButton(symbols ? "ABC" : "123", symbols ? "Letters" : "Numbers and symbols");
    switchLayer.onclick = () => {
        symbols = !symbols;
        renderKeyboard();
    };
    const shift = makeButton("⇧", "Uppercase for next letter");
    shift.setAttribute("aria-pressed", String(shifted));
    shift.onclick = () => {
        shifted = !shifted;
        renderKeyboard();
    };
    rows.push([switchLayer, ...(!symbols ? [shift] : []),
        ...(!isTextEntry(mode) ? [makeKey("Tab", "Tab")] : []),
        makeKey(" ", "Space"), makeKey("Backspace", "⌫", "Delete character")]);
    showKeys(keyboard, rows);
    keyboard.classList.toggle("symbols", symbols);
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

keyboardToggle.addEventListener("click", () => {
    keyboardOpen = !keyboardOpen;
    keyboardOnly = keyboardOpen && activeView !== views.terminal &&
        activeView.viewport.clientHeight < keyboardHeight;
    if (keyboardOpen && !isTextEntry(mode)) {
        symbols = shifted = false;
        renderKeyboard();
    }
    updateControls();
    centerPending = true;
    draw();
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
window.addEventListener("resize", () => {
    if (keyboardOpen && activeView !== views.terminal) {
        keyboardOnly = activeView.viewport.clientHeight < keyboardHeight;
        updateControls();
    }
    centerPending = true;
    draw();
});

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
    if (commandsOpen && !event.target?.closest?.("button")) return;
    if (event.ctrlKey || event.metaKey) {
        if (mode === "command" && !event.shiftKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!event.repeat) sendInput({ type: "key", code: keyCode("Save") });
        }
        return;
    }
    if ((event.key === "Enter" || event.key === " ") &&
        event.target instanceof Element && event.target.closest("button, a, summary")) return;

    if (event.key === "Tab") return;
    if (commandsOpen) return;
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
