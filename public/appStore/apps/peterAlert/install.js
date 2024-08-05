async function copyData() {
  try {
    const response = await fetch("/appStore/apps/peterAlert/peterAlert.html");
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/peterAlert.html]${content}`, "*");
      return true;
    } else {
      console.error(`Error fetching file HTTP status ${response.status}`);
    }
  } catch (err) {
    console.error(`Error fetching file : ${err}`);
  }
  return false;
}

window.top.postMessage(`MK:F[programs/peterAlert.html]`, "*");
if (copyData()) {
  window.top.postMessage("POPULATE-MENU");
  window.top.postMessage("ALERT:[Peter Alert installed!");
} else {
  window.top.postMessage("ALERT:[Could Not install Peter Alert.");
}
