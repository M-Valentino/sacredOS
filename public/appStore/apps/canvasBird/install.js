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
async function install() {
  window.top.postMessage("MK:F[programs/canvasBird.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/canvasBird.html");
    window.top.postMessage("ALERT:[Canvas Bird installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install Canvas Bird.");
  }
}

install();
