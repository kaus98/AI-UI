// We need to pass the sendMessage function to handle "Enter" key
export function initEasyMDE(elementId, onSend) {
    const easyMDE = new EasyMDE({
        element: document.getElementById(elementId),
        autoDownloadFontAwesome: false,
        status: false,
        spellChecker: false,
        toolbar: [
            "bold", "italic", "strikethrough", "heading",
            "|", "code", "quote", "unordered-list", "ordered-list",
            "|", "link", "image", "table", "horizontal-rule",
            "|", "preview", "side-by-side", "fullscreen",
            "|", "undo", "redo"
        ],
        forceSync: true,
        placeholder: "Message AI...",
        minHeight: "45px",
        maxHeight: "200px",
        shortcuts: {
            "toggleFullScreen": null,
            "toggleSideBySide": null,
            "togglePreview": null,
            "drawLink": null,
            "drawImage": null
        },
    });

    // Custom Key Handler
    easyMDE.codemirror.setOption("extraKeys", {
        "Enter": function (cm) {
            onSend();
        },
        "Shift-Enter": function (cm) {
            cm.replaceSelection("\n");
        }
    });

    // Update Send Button state (needs reference to btn, we can pass it or query it)
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        easyMDE.codemirror.on("change", () => {
            const val = easyMDE.value().trim();
            sendBtn.disabled = val === '';
        });
    }

    return easyMDE;
}
