async function copyData() {
  try {
    const response = await fetch("/appStore/apps/radiusRaid/radiusRaid.html");

    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/radiusRaid.html]${content}`, "*");
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
  window.top.postMessage("MK:F[programs/radiusRaid.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/radiusRaid.html");
    window.top.postMessage("ALERT:[radiusRaid installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install Radius Raid.");
  }
}

install();