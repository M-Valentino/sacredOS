function sendMessageToAllIframes(message) {
  const iframes = document.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    iframes[i].contentWindow.postMessage(message, "*");
  }
}

window.onmessage = function (e) {
  if (typeof e.data === "string") {
    // Ensure e.data is a string
    if (e.data == "REQ:AF") {
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      return;
      // TODO convert this line to regex match paths
    } else if (e.data.startsWith("REQ:PH[")) {
      // Extract the file path from the message
      const filePath = e.data.slice(7, -1);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      // Check if the directory and file exist in fileContents
      if (
        fileContents.hasOwnProperty(directoryPath) &&
        fileContents[directoryPath].hasOwnProperty(fileName)
      ) {
        const fileContent = fileContents[directoryPath][fileName];
        sendMessageToAllIframes(`PH:[${filePath}]` + fileContent, "*");
      } else {
        console.error("File not found:", filePath);
      }
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
    } else if (e.data == "REQ:SS") {
      if (fileContents.system && fileContents.system["gui.css"]) {
        e.source.postMessage("SS:" + fileContents.system["gui.css"], "*");
      }
      return;
      // TODO convert this line to regex match paths
    } else if (e.data.startsWith("SF:[]")) {
      var string = e.data.substring(5);
      fileContents["documents"]["message.txt"] = string;
      return;
    } else if (e.data.startsWith("OP:")) {
      try {
        const message = JSON.parse(e.data.substring(3));
        if (
          message.action &&
          message.action === "openProgram" &&
          message.params
        ) {
          const { fileName, fileData, withFile } = message.params;
          openProgram(fileName, fileData, false, withFile);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    }
  }
  try {
    if (typeof e.data === "string") {
      // Ensure e.data is a string for eval
      eval(decodeURI(e.data));
      console.log(e.data);
    }
  } catch (e) {}
};
