async function copyData(url, targetFilePath) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[${targetFilePath}]${content}`, "*");
      return true;
    } else {
      console.error(`Error fetching file HTTP status ${response.status}`);
    }
  } catch (err) {
    console.error(`Error fetching file : ${err}`);
  }
  return false;
}

if (
  copyData(
    "/appStore/apps/blueFuture/blueFuture.css",
    "documents/blueFuture.css"
  ) &&
  copyData(
    "/appStore/apps/blueFuture/installationInstructions.txt",
    "documents/installationInstructions.txt"
  )
) {
  window.top.postMessage(
    "ALERT:[Blue Future downloaded! Open your documents folder to read instructions on completing the installation."
  );
} else {
  window.top.postMessage("ALERT:[Could Not download Blue Future.");
}
