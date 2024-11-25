async function copyData() {
  try {
    const response = await fetch("/appStore/apps/2048game/2048game.html");
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/2048game.html]${content}`, "*");
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
  window.top.postMessage("MK:F[programs/2048game.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/2048game.html");
    window.top.postMessage("ALERT:[2048 Game installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install 2048 Game.");
  }
}

install();
