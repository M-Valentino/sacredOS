async function copyData() {
  try {
    const response = await fetch("/appStore/apps/wacky-calendar/wacky-calendar.html");

    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/wacky-calendar.html]${content}`, "*");
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
  window.top.postMessage("MK:F[programs/wacky-calendar.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/wacky-calendar.html");
    window.top.postMessage("ALERT:[wacky-calendar installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install wacky-calendar.");
  }
}

install();