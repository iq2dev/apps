// Web Serial and WebCrypto for iqToolPro in the browser (from the spike, src/spikes/WasmSerialSpike).
// Web Serial: Edge/Chrome only, and only on HTTPS or localhost. One port at a time.

let port = null;
let reader = null;
let received = [];      // bytes read from the port and not yet taken by readExact
let readerDone = null;  // the background read loop, ended by close()
let remembered = [];    // the ports remembered() found, for use()

// The USB converter built into IQ2's masters (iqLink, iqInterface): an FTDI FT230XS. The port
// chooser lists only these unless every serial port is asked for.
const masterPortFilters = [{ usbVendorId: 0x0403, usbProductId: 0x6015 }];

window.iqSerial = {
    supported: () => "serial" in navigator,

    // Shows the browser's port chooser; must run during the user's click. Lists only the
    // masters' USB converters unless allPorts is set.
    request: async (allPorts) => {
        port = await navigator.serial.requestPort(allPorts ? {} : { filters: masterPortFilters });
        return describe(port);
    },

    // The ports this site was allowed before and that are plugged in, the masters' converters
    // first. Shows nothing and needs no click; use(index) makes one the port open() opens.
    remembered: async () => {
        const ports = (await navigator.serial.getPorts()).filter(p => p.connected !== false);
        remembered = [...ports.filter(isMasterPort), ...ports.filter(p => !isMasterPort(p))];
        return remembered.map(describe);
    },

    use: (index) => { port = remembered[index]; },

    // 8N1 like SerialPortTransport. DTR and RTS off, as System.IO.Ports leaves them.
    open: async (baudRate) => {
        await port.open({ baudRate, dataBits: 8, parity: "none", stopBits: 1, flowControl: "none" });
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        received = [];
        reader = port.readable.getReader();
        readerDone = (async () => {
            try {
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    for (const b of value) received.push(b);
                }
            } catch { /* port closed or unplugged */ }
        })();
    },

    // Drops stale input, as SerialPortTransport.Send does before a request.
    discard: () => { received = []; },

    write: async (bytes) => {
        const writer = port.writable.getWriter();
        try { await writer.write(new Uint8Array(bytes)); }
        finally { writer.releaseLock(); }
    },

    readExact: async (count, timeoutMs) => {
        const deadline = performance.now() + timeoutMs;
        while (received.length < count) {
            if (performance.now() > deadline)
                throw new Error(`Timeout: ${received.length} of ${count} bytes after ${timeoutMs} ms`);
            await new Promise(r => setTimeout(r, 1));
        }
        return new Uint8Array(received.splice(0, count));
    },

    close: async () => {
        const closing = port;
        port = null;
        if (reader) { try { await reader.cancel(); reader.releaseLock(); await readerDone; } catch { } reader = null; }
        if (closing) { try { await closing.close(); } catch { } }
    },
};

// AES-256-CBC with PKCS#7 padding, which is what WebCrypto's AES-CBC always uses.
window.iqAes = {
    encrypt: async (key, iv, data) => new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-CBC", iv: new Uint8Array(iv) }, await importKey(key), new Uint8Array(data))),
    decrypt: async (key, iv, data) => new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: new Uint8Array(iv) }, await importKey(key), new Uint8Array(data))),
};

function importKey(key) {
    return crypto.subtle.importKey("raw", new Uint8Array(key), { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

function isMasterPort(p) {
    const info = p.getInfo();
    return masterPortFilters.some(f => f.usbVendorId === info.usbVendorId && f.usbProductId === info.usbProductId);
}

// What the browser tells about a port: its USB IDs, or nothing for a port without USB.
function describe(p) {
    const info = p.getInfo();
    return info.usbVendorId === undefined
        ? "serial port without USB IDs"
        : `USB ${hex4(info.usbVendorId)}:${hex4(info.usbProductId)}`;
}

function hex4(v) {
    return v === undefined ? "????" : v.toString(16).toUpperCase().padStart(4, "0");
}
