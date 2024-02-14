function sendMessageToAllIframes(message) {
  const iframes = document.getElementsByTagName('iframe');
  for (let i = 0; i < iframes.length; i++) {
    iframes[i].contentWindow.postMessage(message, '*');
  }
}

window.onmessage = function (e) {
  if (typeof e.data === 'string') { // Ensure e.data is a string
    if (e.data == "REQ:AF") {
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), '*');
      return;
    } else if (e.data.startsWith("U:PRIMC")) {
      var jsonString = e.data.substring(7);
      updatePrimaryColor(jsonString);
      return;
    } else if (e.data.startsWith("U:SECCL")) {
      var jsonString = e.data.substring(7);
      updateSecondaryColorLight(jsonString);
      return;
    } else if (e.data.startsWith("U:SECC")) {
      var jsonString = e.data.substring(6);
      updateSecondaryColor(jsonString);
      return;
    }
    else if (e.data == "REQ:SS") {
      if (fileContents.system && fileContents.system['gui.css']) {
        e.source.postMessage("SS:" + fileContents.system['gui.css'], '*');
      }
      return;
    } else if (e.data.startsWith("OP:")) {
      try {
        const message = JSON.parse(e.data.substring(3));
        if (message.action && message.action === "openProgram" && message.params) {
          const { fileName, fileData } = message.params;
          openProgram(fileName, fileData, false);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }
  }
  try {
    if (typeof e.data === 'string') { // Ensure e.data is a string for eval
      eval(decodeURI(e.data));
      console.log(e.data);
    }
  } catch (e) { }
};