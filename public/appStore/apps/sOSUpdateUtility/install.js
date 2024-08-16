async function copyData() {
  try {
    const response = await fetch("/appStore/apps/sOSUpdateUtility/osUpdate.html");
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/osUpdate.html]${content}`, "*");
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
  window.top.postMessage("MK:F[programs/osUpdate.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/osUpdate.html");
    window.top.postMessage("ALERT:[Sacred OS Update Utility installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install Sacred OS Update Utility.");
  }
}

install();
