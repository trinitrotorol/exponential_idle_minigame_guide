(function () {
  if (typeof document === "undefined") {
    return;
  }

  const status = document.getElementById("solver-status");
  if (status) {
    status.textContent = "準備中";
  }
})();
