async function copyData() {
  try {
    const response = await fetch("/appStore/apps/canvasBird/canvasBird.html");
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/canvasBird.html]${content}`, "*");
      return true;
    } else {
      console.error(`Error fetching file HTTP status ${response.status}`);
    }
  } catch (err) {
    console.error(`Error fetching file : ${err}`);
  }
  return false;
}

window.top.postMessage(`MK:F[programs/canvasBird.html]`, "*");
if (copyData()) {
  window.top.postMessage("POPULATE-MENU");
  alert(
    'Canvas Bird installed!'
  );
} else {
  alert("Could Not install Canvas Bird.");
}
