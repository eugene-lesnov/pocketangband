export async function prepareOffline(reportProgress) {
    const serviceWorkers = navigator.serviceWorker;
    if (!serviceWorkers) {
        throw new Error("Offline play requires a browser with service workers and an HTTPS or localhost address.");
    }
    const workerUrl = new URL("./sw.js", import.meta.url);
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
