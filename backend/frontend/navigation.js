(() => {
  if (location.pathname !== "/admin-settings.html") return;
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/admin-manifest.json";
  document.head.appendChild(manifest);
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = "/assets/admin-icon.svg";
  document.head.appendChild(icon);
})();
