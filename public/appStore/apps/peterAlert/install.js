window.top.postMessage(`MK:F[programs/peterAlert.html]`, '*');


async function copyData() {
  try {
    const response = await fetch("/appStore/apps/PeterAlert/peterAlert.html");
    if (response.ok) {
      const content = await response.text();
      window.top.postMessage(`SF:[programs/peterAlert.html]${content}`, "*");
    } else {
      console.error(`Error fetching file HTTP status ${response.status}`);
    }
  } catch (err) {
    console.error(`Error fetching file : ${err}`);
  }
}

copyData();
window.top.postMessage("POPULATE-MENU");