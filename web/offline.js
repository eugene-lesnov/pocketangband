const workerUrl = new URL("./sw.js", import.meta.url);

export async function prepareOffline(reportProgress) {
    const serviceWorkers = navigator.serviceWorker;
    if (!serviceWorkers) {
        throw new Error("Offline play requires a browser with service workers and an HTTPS or localhost address.");
    }
    const controller = serviceWorkers.controller;
    if (controller?.scriptURL === workerUrl.href && controller.state === "activated") return true;

    const onMessage = ({ data, source }) => {
        if (source?.scriptURL === workerUrl.href && data?.type === "pocketband-download") {
            reportProgress(data.percent);
        }
    };
    serviceWorkers.addEventListener("message", onMessage);
    try {
        let registration;
        try {
            registration = await serviceWorkers.register(workerUrl, { updateViaCache: "none" });
        } catch (error) {
            console.error(error);
            throw new Error("Could not start the game download. Check your connection and try again.");
        }
        const worker = controller?.scriptURL === workerUrl.href ? controller :
            registration.installing ?? registration.waiting ?? registration.active;
        if (!worker) throw new Error("The game download did not start. Check your connection and try again.");
        await new Promise((resolve, reject) => {
            function checkState() {
                if (worker.state === "activated") {
                    worker.removeEventListener("statechange", checkState);
                    resolve();
                } else if (worker.state === "redundant") {
                    worker.removeEventListener("statechange", checkState);
                    reject(new Error("Could not download the game. Check your connection and try again."));
                }
            }
            worker.addEventListener("statechange", checkState);
            checkState();
        });
        return false;
    } finally {
        serviceWorkers.removeEventListener("message", onMessage);
    }
}

export async function watchOfflineUpdates(reportUpdate) {
    const serviceWorkers = navigator.serviceWorker;
    const registration = await serviceWorkers.getRegistration(workerUrl);
    if (!registration) return;

    const observed = new WeakSet();
    let checking = false;

    function refresh() {
        const { installing, waiting } = registration;
        for (const worker of [installing, waiting]) {
            if (!worker || observed.has(worker)) continue;
            observed.add(worker);
            worker.addEventListener("statechange", refresh);
        }
        reportUpdate(waiting?.state === "installed" ? waiting : undefined);
    }

    async function check() {
        if (checking || document.hidden) return;
        checking = true;
        try {
            await registration.update();
        } catch {
            return;
        } finally {
            checking = false;
            refresh();
        }
    }

    registration.addEventListener("updatefound", refresh);
    serviceWorkers.addEventListener("controllerchange", refresh);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    refresh();
    void check();
}

export function applyOfflineUpdate(worker) {
    return new Promise((resolve, reject) => {
        const serviceWorkers = navigator.serviceWorker;
        const channel = new MessageChannel();
        const unavailable = "Could not apply the update. Close all PocketBand windows and reopen the app.";
        const timeout = setTimeout(() => finish(unavailable), 10_000);

        function finish(message) {
            clearTimeout(timeout);
            serviceWorkers.removeEventListener("controllerchange", onControllerChange);
            channel.port1.close();
            if (message) reject(new Error(message));
            else resolve();
        }

        function onControllerChange() {
            if (serviceWorkers.controller === worker) finish();
        }

        channel.port1.onmessage = ({ data }) => {
            if (data === "other-windows") finish("Close other PocketBand windows and try again.");
            else finish(unavailable);
        };
        serviceWorkers.addEventListener("controllerchange", onControllerChange);
        try {
            worker.postMessage({ type: "pocketband-apply-update" }, [channel.port2]);
            onControllerChange();
        } catch {
            channel.port2.close();
            finish(unavailable);
        }
    });
}
