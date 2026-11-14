import createAngband from "./angband.js";

const maxSaveSize = 64 * 1024 * 1024;
const profileDirectory = "/profile";
const input = [];
let waiting;
let request = 0;
let lastError;
let backgroundSavePending = false;
let saveToImport;
let interruptPending = false;
let runningRequest;

function wakeInput(action) {
    const { wake } = waiting;
    waiting = undefined;
    wake(action);
}

function transferError(message, request) {
    self.postMessage({ type: "save-transfer-error", message, request });
}

self.addEventListener("message", ({ data }) => {
    if (data.type === "ping") {
        self.postMessage({ type: "pong", waiting: waiting !== undefined });
        return;
    }
    if (data.type === "background-save") {
        if (waiting?.mode === "command") wakeInput("background-save");
        else if (!waiting || waiting.playing) backgroundSavePending = true;
        return;
    }
    if (data.type === "toggle-tiles") {
        if (waiting?.mode === "command" && data.request === waiting.request) wakeInput(data.type);
        return;
    }
    if (data.type === "interrupt") {
        if (!waiting && runningRequest !== undefined && data.request === runningRequest) {
            interruptPending = true;
        }
        return;
    }
    if (["import-save", "export-save", "delete-save"].includes(data.type)) {
        if (waiting?.mode !== "save-slots" || data.request !== waiting.request ||
            (data.type === "delete-save" && (!(data.cursor > 0) || data.cursor !== waiting.menu?.cursor))) {
            transferError("The save slot selection changed. Try again.", waiting?.request);
            return;
        }
        if (data.type === "import-save") saveToImport = data.file;
        wakeInput(data.type);
        return;
    }
    if (input.length >= 256 || (data.request !== undefined && data.request !== waiting?.request)) {
        return;
    }
    if (data.type === "key") {
        if (!Number.isInteger(data.code) || data.code <= 0 || data.code > 0x10ffff) return;
    } else if (["tap", "aim-cell", "target-cell"].includes(data.type)) {
        if (!waiting || data.request !== waiting.request ||
            !Number.isInteger(data.x) || !Number.isInteger(data.y)) return;
        if (data.type === "tap" && !["menu", "save-slots"].includes(waiting.mode)) return;
        if (data.type === "aim-cell" && !["aim", "direction"].includes(waiting.mode)) return;
        if (data.type === "target-cell" && waiting.mode !== "target") return;
        const { region } = waiting;
        if (!region || data.x < region.x || data.y < region.y ||
            data.x >= region.x + region.width || data.y >= region.y + region.height) return;
    } else if (["menu-row", "menu-section", "store-action"].includes(data.type)) {
        if (!waiting?.menu || data.request !== waiting.request) return;
        const { rows, sections, actions } = waiting.menu;
        if (data.type === "menu-row" && !rows.some((row) => row.index === data.code && row.enabled)) return;
        if (data.type === "menu-section" &&
            !sections?.some((section) => section.id === data.code && !section.active)) return;
        if (data.type === "store-action" &&
            (!actions.some((action) => action.key === data.code) ||
                (data.code !== "s".charCodeAt(0) && !rows.some((row) => row.index === data.row && row.enabled)))) return;
    } else {
        return;
    }
    input.push(data);
    runningRequest = waiting?.playing ? waiting.request : undefined;
    if (waiting) wakeInput();
});

function syncProfile(fs, populate) {
    return new Promise((resolve, reject) => {
        fs.syncfs(populate, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

async function deleteProfileFiles(idbfs, paths) {
    const db = await new Promise((resolve, reject) => {
        idbfs.getDB(profileDirectory, (error, database) => {
            if (error) reject(error);
            else resolve(database);
        });
    });
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(idbfs.DB_STORE_NAME, "readwrite");
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
        try {
            const store = transaction.objectStore(idbfs.DB_STORE_NAME);
            for (const path of paths) store.delete(path);
        } catch (error) {
            transaction.abort();
            reject(error);
        }
    });
}

async function play(lock) {
    if (!lock) throw new Error("The Angband profile is open in another tab.");

    let world;
    let finish;
    const exited = new Promise((resolve) => {
        finish = resolve;
    });
    const game = await createAngband({
        sendFrame(frame) {
            const buffers = [frame.codepoints.buffer, frame.attributes.buffer, frame.palette.buffer];
            if (frame.terrainAttributes) {
                buffers.push(frame.terrainCodepoints.buffer, frame.terrainAttributes.buffer);
            }
            self.postMessage({ type: "frame", ...frame }, buffers);
        },
        sendWorld(state) {
            world = state;
        },
        takeInput() {
            return input.shift();
        },
        takeInterrupt() {
            const pending = interruptPending;
            interruptPending = false;
            return pending;
        },
        waitForInput(mode, region, playing, context, menu) {
            interruptPending = false;
            runningRequest = undefined;
            if (!playing) backgroundSavePending = false;
            if (mode === "command" && backgroundSavePending) {
                backgroundSavePending = false;
                world = undefined;
                return "background-save";
            }
            return new Promise((resolve) => {
                waiting = { request: ++request, mode, region, playing, menu, wake: resolve };
                self.postMessage({ type: "waiting", request, mode, region, world, context, menu });
                world = undefined;
            });
        },
        flushInput() {
            input.length = 0;
        },
        async stageSaveImport(path) {
            const file = saveToImport;
            saveToImport = undefined;
            if (!(file instanceof File) || file.size === 0) {
                transferError("Choose an Angband save file.");
                return 0;
            }
            if (file.size > maxSaveSize) {
                transferError("The save file exceeds 64 MiB.");
                return 0;
            }
            try {
                game.FS.writeFile(path, new Uint8Array(await file.arrayBuffer()), { canOwn: true });
                return 1;
            } catch (error) {
                console.error(error);
                transferError("Could not read the save file.");
                return 0;
            }
        },
        async finishSaveImport(staged, path, flags) {
            if (!path) {
                transferError("The file is damaged or incompatible with this version of Angband.");
                return 0;
            }
            const fs = game.FS;
            let created = false;
            try {
                const bytes = fs.readFile(staged);
                const stream = fs.open(path, flags, 0o600);
                created = true;
                try {
                    if (fs.write(stream, bytes, 0, bytes.length, 0, true) !== bytes.length) {
                        throw new Error("Incomplete save file write.");
                    }
                } finally {
                    fs.close(stream);
                }
                await syncProfile(fs, false);
            } catch (error) {
                console.error(error);
                if (created) {
                    try {
                        fs.unlink(path);
                    } catch (cleanupError) {
                        self.postMessage({ type: "error", message: "Could not roll back the import. Reopen the save slots." });
                        console.error(cleanupError);
                        return 0;
                    }
                }
                transferError("Could not store the imported save.");
                return 0;
            }
            self.postMessage({ type: "save-imported", slot: path.split("/").pop() });
            return 1;
        },
        exportSaveFile(path) {
            if (!path) {
                transferError("Highlight a saved character to export.");
                return;
            }
            try {
                const data = game.FS.readFile(path);
                self.postMessage({ type: "save-exported", slot: path.split("/").pop(), data }, [data.buffer]);
            } catch (error) {
                console.error(error);
                transferError("Could not read the selected save.");
            }
        },
        async deleteSaveFile(path, panic) {
            const fs = game.FS;
            const paths = panic ? [path, panic] : [path];
            try {
                const keys = paths.map((file) => {
                    const entry = fs.analyzePath(file, true);
                    if (!entry.exists || !entry.path.startsWith(profileDirectory + "/") ||
                        !fs.isFile(entry.object.mode)) {
                        throw new Error("The selected save is not a regular profile file.");
                    }
                    return entry.path;
                });
                await deleteProfileFiles(game.IDBFS, keys);
            } catch (error) {
                console.error(error);
                transferError("Could not delete the selected save.");
                return 0;
            }
            try {
                for (const file of paths) fs.unlink(file);
            } catch (error) {
                console.error(error);
                self.postMessage({ type: "error", message: "The save was deleted. Reopen the save slots." });
                return 0;
            }
            self.postMessage({ type: "save-deleted", slot: path.split("/").pop() });
            return 1;
        },
        async persistProfile(saved) {
            let ok = false;
            if (saved) {
                self.postMessage({ type: "saving" });
                try {
                    await syncProfile(game.FS, false);
                    backgroundSavePending = false;
                    ok = true;
                } catch (error) {
                    console.error(error);
                }
            }
            self.postMessage({ type: "saved", ok });
            return ok;
        },
        printErr(message) {
            lastError = message;
            console.error(message);
        },
        onExit(code) {
            finish({ type: "exit", code, message: lastError });
        },
    });

    try {
        game.FS.mkdir(profileDirectory);
        game.FS.mount(game.IDBFS, {}, profileDirectory);
        await syncProfile(game.FS, true);
    } catch (error) {
        console.error(error);
        throw new Error("Could not open the Angband profile.");
    }
    game.callMain(["-c", "-uPLAYER"]);
    return exited;
}

try {
    if (!navigator.locks) {
        throw new Error("The Angband profile requires a browser with Web Locks and an HTTPS or localhost address.");
    }
    const result = await navigator.locks.request("pocketband-profile", { ifAvailable: true }, play);
    self.postMessage(result);
} catch (error) {
    self.postMessage({ type: "error", message: error.message || String(error) });
}
