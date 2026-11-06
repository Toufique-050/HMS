const themes = [
    ["", "Ocean", "#0f5f73"],
    ["sunset", "Sunset", "#b9462f"],
    ["sage", "Sage", "#3b6d4b"],
    ["berry", "Berry", "#7a2c5c"]
];

let saved = "";
try { saved = localStorage.getItem("ls-theme") || ""; } catch { /* ignore */ }

const buttons = [];

function apply(value) {
    if (value) document.documentElement.setAttribute("data-theme", value);
    else document.documentElement.removeAttribute("data-theme");

    try { localStorage.setItem("ls-theme", value); } catch { /* ignore */ }

    buttons.forEach(button => {
        button.style.outline =
            button.dataset.value === value ? "3px solid #111" : "none";
    });
}

const box = document.createElement("div");
box.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;" +
    "gap:8px;align-items:center;padding:8px 10px;background:#fff;" +
    "border:1px solid #ddd;border-radius:999px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.2);" +
    "font:600 11px system-ui,sans-serif;color:#222";
box.innerHTML = "<span>THEME</span>";

themes.forEach(([value, title, color]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = title;
    button.dataset.value = value;
    button.style.cssText =
        "width:26px;height:26px;border-radius:50%;border:2px solid #fff;" +
        "cursor:pointer;padding:0;background:" + color;
    button.onclick = () => apply(value);
    box.appendChild(button);
    buttons.push(button);
});

document.body.appendChild(box);
apply(saved);