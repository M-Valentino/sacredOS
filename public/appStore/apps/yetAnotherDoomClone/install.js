async function copyData(dir) {
  const directories = dir.split("/");
  const fileName = directories.pop();
  try {
    const response = await fetch(dir);
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/doomClone/${fileName}]${content}`, "*");
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
  const installedCorrectly =
  (await copyData("/appStore/apps/yetAnotherDoomClone/LICENSE.txt")) &&
    (await copyData("/appStore/apps/yetAnotherDoomClone/doomClone.html")) &&
    (await copyData("/appStore/apps/yetAnotherDoomClone/javascript-doom-clone-game.js"));

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/doomClone/doomClone.html");
    window.top.postMessage("ALERT:[Yet Another Doom Clone installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install Yet Another Doom Clone.");
  }
}

install();
