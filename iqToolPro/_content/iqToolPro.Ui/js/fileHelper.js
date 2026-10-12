window.downloadFile = function (filename, contentType, bytes) {
    const blob = new Blob([new Uint8Array(bytes)], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// For files that can run to megabytes: the bytes arrive as a stream instead of
// inside one interop message.
window.downloadFileFromStream = async function (filename, contentType, streamRef) {
    const buffer = await streamRef.arrayBuffer();
    window.downloadFile(filename, contentType, buffer);
};
