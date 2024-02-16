function sendMessageToAllIframes(message) {
  const iframes = document.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    iframes[i].contentWindow.postMessage(message, "*");
  }
}

function findFileContents(directoryPath, fileContents, fileName) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  if (currentDirectory && fileContents.hasOwnProperty(currentDirectory)) {
    if (directories.length === 0) {
      // Reached the final directory, check for the file
      if (fileContents[currentDirectory].hasOwnProperty(fileName)) {
        return fileContents[currentDirectory][fileName];
      }
    } else {
      // Continue recursively for nested directories
      const nestedDirectoryPath = directories.join("/");
      return findFileContents(
        nestedDirectoryPath,
        fileContents[currentDirectory],
        fileName
      );
    }
  }

  return null; // File not found
}

function saveFileContentsRecursive(
  directoryPath,
  fileContents,
  fileName,
  fileContent
) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  if (!fileContents.hasOwnProperty(currentDirectory)) {
    fileContents[currentDirectory] = {};
  }

  if (directories.length === 0) {
    // Reached the final directory, save the file content
    fileContents[currentDirectory][fileName] = fileContent;
  } else {
    // Continue recursively for nested directories
    const nestedDirectoryPath = directories.join("/");
    saveFileContentsRecursive(
      nestedDirectoryPath,
      fileContents[currentDirectory],
      fileName,
      fileContent
    );
  }
}

function updateColorVariable(variableName, newColor) {
  const regex = new RegExp(`(${variableName}: ).*?;`);
  fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
    regex,
    `$1 ${newColor};`
  );
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

      // Check if the directory and file exist in fileContents using recursive function
      const fileContent = findFileContents(
        directoryPath,
        fileContents,
        fileName
      );

      if (fileContent !== null) {
        sendMessageToAllIframes(`PH:[${filePath}]` + fileContent, "*");
      } else {
        console.error("File not found:", filePath);
      }

      return;
    } else if (e.data.startsWith("U:PRIMC")) {
      var jsonString = e.data.substring(7);
      updateColorVariable("--primColor", jsonString);
      return;
    } else if (e.data.startsWith("U:SECCL")) {
      var jsonString = e.data.substring(7);
      updateColorVariable("--secColorLight", jsonString);
      return;
    } else if (e.data.startsWith("U:SECCD")) {
      var jsonString = e.data.substring(7);
      updateColorVariable("--secColorDark", jsonString);
      return;
    } else if (e.data.startsWith("U:SECC")) {
      var jsonString = e.data.substring(6);
      updateColorVariable("--secColor", jsonString);
      return;
    } else if (e.data == "REQ:SS") {
      if (fileContents.system && fileContents.system["gui.css"]) {
        e.source.postMessage("SS:" + fileContents.system["gui.css"], "*");
      }
      return;
    } else if (e.data.startsWith("SF:[")) {
      // Find the index of the right bracket to correctly separate the file path from the data
      const rightBracketIndex = e.data.indexOf("]");

      // Extract the file path using the index of the right bracket, excluding "SF:[" and the right bracket itself
      const filePath = e.data.slice(4, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      // Extract the data content, which starts immediately after the right bracket
      const fileContent = e.data.substring(rightBracketIndex + 1);

      // Save the file content in the fileContents object using recursive function
      saveFileContentsRecursive(
        directoryPath,
        fileContents,
        fileName,
        fileContent
      );

      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
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