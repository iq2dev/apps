// The validation report in the browser: the self-contained HTML page is printed from a hidden
// frame, so the browser's print dialog opens on it and "Save as PDF" makes the file. A frame
// rather than a new window, which a popup blocker could stop.

window.iqReport = {
    print: (html, title) => new Promise((resolve, reject) => {
        const frame = document.createElement("iframe");
        frame.style.position = "fixed";
        frame.style.width = "0";
        frame.style.height = "0";
        frame.style.border = "0";
        frame.onload = () => {
            try {
                frame.contentDocument.title = title;   // the name "Save as PDF" proposes
                frame.contentWindow.focus();
                frame.contentWindow.print();
                resolve();
            } catch (e) {
                reject(e);
            } finally {
                setTimeout(() => frame.remove(), 60000);
            }
        };
        frame.srcdoc = html;
        document.body.appendChild(frame);
    }),
};
