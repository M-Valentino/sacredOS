const appName = "osUpdate1.16.html";
async function copyData() {
  try {
    const response = await fetch(`/appStore/apps/sOSUpdateUtility/${appName}`);
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/${appName}]${content}`, "*");
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
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage(`MK:MENU-SC[programs/${appName}`);
    window.top.postMessage(`ALERT:[Sacred OS Update Utility installed!`);
  } else {
    window.top.postMessage(`ALERT:[Could Not install Sacred OS Update Utility.`);
  }
}

install();
