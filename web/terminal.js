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
const directionPad = document.querySelector("#direction-pad");
const directionCenter = document.querySelector("#direction-center");
const terminalKeys = document.querySelector("#terminal-keys");
const cancelKey = document.querySelector("#cancel-key");
const confirmKey = document.querySelector("#confirm-key");
const worldActions = document.querySelector("#world-actions");
const aimActions = document.querySelector("#aim-actions");
const targetActions = document.querySelector("#target-actions");
const targetPrompt = document.querySelector("#target-prompt");
const quantity = document.querySelector("#quantity");
const keyboard = document.querySelector("#keyboard");
const utilityKeys = document.querySelector("#utility-keys");
const commandMenu = document.querySelector("#command-menu");
const keyboardToggle = document.querySelector("#keyboard-toggle");

const specialKeys = new Map([
    ["Enter", 13], ["Backspace", 8], ["Escape", 27], ["Save", 19], ["SaveAndQuit", 24], ["Tab", 9],
    ["ArrowDown", 0x80], ["ArrowLeft", 0x81], ["ArrowRight", 0x82], ["ArrowUp", 0x83],
]);

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
        const { viewport } = view;
        const region = view === views.target ? view.crop : undefined;
        const frame = view === views.map ? views.map.frame : views.terminal.frame;
        if (!frame) return;
        const changed = frame !== view.rendered || !sameRegion(region, view.region);
        if (changed) {
            render(view, frame, region);
            view.rendered = frame;
            view.region = region;
            if (region) {
                targetPrompt.textContent = String.fromCodePoint(...frame.codepoints.subarray(0, frame.width)).trim();
            }
        }
        if (centerPending && view === views.map && world) {
            const grid = view.gridElement.getBoundingClientRect();
            const screen = viewport.getBoundingClientRect();
            viewport.scrollLeft += grid.left - screen.left - viewport.clientLeft + (world.x + 0.5) * grid.width / frame.width -
                viewport.clientWidth / 2;
            viewport.scrollTop += grid.top - screen.top - viewport.clientTop + (world.y + 0.5) * grid.height / frame.height -
                viewport.clientHeight / 2;
        } else if ((centerPending || changed) &&
            (view === views.target || (view === views.terminal &&
                (isMenu() || ["name", "text", "quantity"].includes(mode))))) {
            showCursor(view);
        }
        centerPending = false;
    });
}

function sameRegion(a, b) {
    return a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function tileCursorBounds(view) {
    const { gridElement, grid, rendered: frame } = view;
    if (frame.cursor < 0) return;
    const column = frame.cursor % frame.width - grid.x;
    const row = Math.floor(frame.cursor / frame.width) - grid.y;
    if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) return;
    const bounds = gridElement.getBoundingClientRect();
    const width = bounds.width / grid.columns;
    const height = bounds.height / grid.rows;
    const left = bounds.left + column * width;
    const top = bounds.top + row * height;
    return { left, top, right: left + width, bottom: top + height };
}

function showCursor(view) {
    const { viewport, gridElement, pre } = view;
    const cursor = gridElement === pre ? pre.querySelector(".cursor")?.getBoundingClientRect() : tileCursorBounds(view);
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

    const lines = state.log.map(({ text, count }) => count > 1 ? `${text} (×${count})` : text);
    if (lines.length === messages.childElementCount &&
        lines.every((line, index) => messages.children[index].textContent === line)) return;
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

function updateControls() {
    const disabled = mode === undefined || saving || transferring || stopped;
    const command = mode === "command";
    const selecting = mode === "target";
    const aiming = mode === "aim";
    const editing = mode === "name" || mode === "text";
    const textEntry = mode === "text";
    const counting = mode === "quantity";
    const confirming = mode === "confirm";
    const showKeyboard = keyboardOpen && !counting && !confirming;
    toggleTiles.hidden = !command;
    toggleTiles.disabled = disabled || !tilesReady || request === undefined;
    toggleTiles.setAttribute("aria-pressed", String(!!views.map.frame?.terrainAttributes));
    views.terminal.viewport.classList.toggle("selectable", isMenu());
    views.target.viewport.classList.toggle("selectable", selecting);
    main.classList.toggle("text-entry", textEntry);
    directionPad.hidden = (showKeyboard && !textEntry) || counting || confirming;
    directionPad.disabled = disabled;
    directionCenter.disabled = !command && !selecting && !aiming;
    directionCenter.setAttribute("aria-label", command ? "Wait one turn" :
        aiming ? "Use current target" : "Confirm target");
    setActions(terminalKeys, !command, disabled);
    confirmKey.dataset.key = confirming ? "y" : selecting ? "t" : aiming ? "5" : "Enter";
    cancelKey.dataset.key = confirming ? "n" : "Escape";
    confirmKey.textContent = confirming ? "Yes" : selecting ? "Select target" : aiming ? "Use target" :
        editing || counting ? "Done" : isMenu() ? "Select" : "Continue";
    cancelKey.textContent = confirming ? "No" : selecting || aiming || editing || counting ? "Cancel" : "Back";
    setActions(worldActions, command && !showKeyboard, disabled);
    setActions(aimActions, aiming, disabled);
    setActions(targetActions, selecting, disabled);
    setActions(quantity, counting, disabled);
    setActions(keyboard, showKeyboard, disabled);
    setActions(utilityKeys, !counting && !confirming, disabled);
    saveTransfer.hidden = mode !== "save-slots";
    transferActions.disabled = disabled || request === undefined;
    commandMenu.hidden = !command;
    keyboardToggle.setAttribute("aria-expanded", String(!keyboard.hidden));
    keyboardToggle.textContent = keyboard.hidden ? "Keyboard" : "Hide keyboard";
    main.classList.toggle("editing", !keyboard.hidden || counting);
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

function updateView(state, region) {
    const previous = activeView;
    world = state;
    views.target.crop = region;
    activeView = region ? views.target : world ? views.map : views.terminal;
    main.classList.toggle("playing", activeView !== views.terminal);
    main.classList.toggle("targeting", activeView === views.target);
    for (const view of Object.values(views)) view.viewport.hidden = view !== activeView;
    if (previous !== activeView && activeView === views.terminal) {
        activeView.viewport.scrollTo(0, 0);
    }
    targetPrompt.hidden = activeView !== views.target;
    hud.hidden = journal.hidden = activeView !== views.map;
    viewTitle.textContent = activeView.title;
    if (previous !== activeView) setZoom(activeView.zoom);
    if (activeView === views.map) centerPending = true;
    draw();
    if (world) renderWorld(world);
}

function stop(message, failed) {
    stopped = true;
    request = mode = undefined;
    clearExport();
    keyboardOpen = false;
    updateControls();
    updateView(undefined);
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
            if (view === activeView || (view === views.terminal && activeView === views.target)) draw();
            break;
        }
        case "waiting": {
            const changed = data.mode !== mode;
            if (changed) {
                if (mode === "save-slots") {
                    clearExport();
                    transferStatus.hidden = true;
                }
                keyboardOpen = false;
                if (data.mode === "name" || data.mode === "text") {
                    symbols = false;
                    shifted = data.mode === "name";
                    renderKeyboard();
                    keyboardOpen = true;
                }
            }
            mode = data.mode;
            request = data.request;
            launch.hidden = true;
            main.classList.remove("starting");
            updateView(data.world, mode === "target" ? data.region : undefined);
            if (changed && (mode === "confirm" || mode === "aim")) {
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
            break;
        case "saved":
            saving = false;
            updateControls();
            saveStatus.textContent = data.ok ? "Game saved." : "Could not save the game.";
            saveStatus.classList.toggle("error", !data.ok);
            saveStatus.hidden = false;
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

function sendInput(input, scoped = true) {
    if (mode === undefined || saving || transferring || stopped || (scoped && request === undefined)) return;
    if (!saveStatus.classList.contains("error")) saveStatus.hidden = true;
    worker.postMessage({ ...input, request: scoped ? request : undefined });
    request = undefined;
    toggleTiles.disabled = true;
    transferActions.disabled = true;
}

let buttonPress;
main.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    const button = event.target.closest("button[data-key]");
    buttonPress = button ? { button, request } : undefined;
});

main.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (!button || (event.detail !== 0 &&
        (buttonPress?.button !== button || buttonPress.request !== request))) return;
    sendInput({ type: "key", code: keyCode(button.dataset.key) });
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
    const switchLayer = makeButton(symbols ? "ABC" : "123", symbols ? "Letters" : "Numbers and symbols");
    switchLayer.onclick = () => {
        symbols = !symbols;
        renderKeyboard();
    };
    const shift = makeButton("⇧", "Uppercase");
    shift.setAttribute("aria-pressed", String(shifted));
    shift.onclick = () => {
        shifted = !shifted;
        renderKeyboard();
    };
    rows.push([switchLayer, ...(!symbols ? [shift] : []), makeKey("Tab", "Tab"),
        makeKey(" ", "Space"), makeKey("Backspace", "⌫", "Delete character")]);
    showKeys(keyboard, rows);
    keyboard.classList.toggle("symbols", symbols);
}

renderKeyboard();
showKeys(quantity, [
    [..."12345"].map((key) => makeKey(key)),
    [..."67890"].map((key) => makeKey(key)),
    [makeKey("*", "All"), makeKey("Backspace", "⌫", "Delete digit")],
]);

keyboardToggle.addEventListener("click", () => {
    keyboardOpen = !keyboardOpen;
    updateControls();
    centerPending = true;
    draw();
});

for (const view of [views.terminal, views.target]) {
    let touchRequest;
    view.viewport.addEventListener("pointerdown", (event) => {
        if (event.isPrimary) touchRequest = request;
    });
    view.viewport.addEventListener("click", (event) => {
        if (event.detail === 0 || !request || touchRequest !== request || activeView !== view ||
            !(isMenu() || mode === "target") || !view.grid || !view.gridElement.contains(event.target) ||
            view.rendered !== views.terminal.frame || !sameRegion(view.region, view.crop)) return;
        const { x, y, columns, rows } = view.grid;
        const grid = view.gridElement.getBoundingClientRect();
        const column = Math.floor((event.clientX - grid.left) * columns / grid.width);
        const row = Math.floor((event.clientY - grid.top) * rows / grid.height);
        if (column < 0 || column >= columns || row < 0 || row >= rows) return;
        sendInput({ type: "tap", x: x + column, y: y + row });
    });
}

toggleTiles.addEventListener("click", () => sendInput({ type: "toggle-tiles" }));
zoomOut.addEventListener("click", () => setZoom(activeView.zoom - 1));
zoomIn.addEventListener("click", () => setZoom(activeView.zoom + 1));
window.addEventListener("resize", () => {
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
    const code = keyCode(event.key);
    if (code) {
        event.preventDefault();
        sendInput({ type: "key", code }, false);
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
