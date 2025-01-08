async function copyData() {
  try {
    const response = await fetch("/appStore/apps/audioPlayer/audioPlayer.html");
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/audioPlayer.html]${content}`, "*");
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
  window.top.postMessage("MK:F[programs/audioPlayer.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/audioPlayer.html");
    window.top.postMessage("ALERT:[Audio Player installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install Audio Player.");
  }
}

install();
