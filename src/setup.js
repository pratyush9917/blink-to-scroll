document.getElementById("allow").addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop()); // Turn off the camera immediately
    alert("Permission granted! You can close this tab and click the extension icon again.");
  } catch (err) {
    console.error("Camera access denied:", err);
  }
});