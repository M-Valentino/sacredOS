async function copyData() {
  try {
    const response = await fetch("/appStore/apps/synthesizer/synthesizer.html");

    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/synthesizer.html]${content}`, "*");
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
  window.top.postMessage("MK:F[programs/synthesizer.html]", "*");
  const installedCorrectly = await copyData();

  if (installedCorrectly) {
    window.top.postMessage("MK:MENU-SC[programs/synthesizer.html");
    window.top.postMessage("ALERT:[synthesizer installed!");
  } else {
    window.top.postMessage("ALERT:[Could Not install Synthesizer.");
  }
}

install();