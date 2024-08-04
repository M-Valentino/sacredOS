function sendMessageToAllIframes(message) {
  const iframes = document.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    iframes[i].contentWindow.postMessage(message, "*");
  }
}

function findFileContents(directoryPath, fileContents, fileName) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();
  // If file is in root dir
  if (directoryPath === "") {
    return fileContents[fileName];
  } else if (
    currentDirectory &&
    fileContents.hasOwnProperty(currentDirectory)
  ) {
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

function checkFileExistsAndCreate(directory, fileName) {
  if (directory.hasOwnProperty(fileName)) {
    alert("A file with that name already exists!");
  } else {
    directory[fileName] = "";
  }
}

function updateFileTable(directoryPath, fileTable, fileName) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  if (directoryPath === "") {
    // Root directory
    if (!fileTable.system.includes(fileName)) {
      fileTable.system.push(fileName);
    }
    return;
  }

  if (currentDirectory) {
    let found = false;
    for (const key in fileTable) {
      if (Array.isArray(fileTable[key]) && key === currentDirectory) {
        if (!fileTable[key].includes(fileName)) {
          fileTable[key].push(fileName);
        }
        found = true;
        break;
      }
    }

    if (!found) {
      for (const key in fileTable) {
        if (Array.isArray(fileTable[key])) {
          for (let i = 0; i < fileTable[key].length; i++) {
            if (
              typeof fileTable[key][i] === "object" &&
              fileTable[key][i].hasOwnProperty(currentDirectory)
            ) {
              updateFileTable(
                directories.join("/"),
                fileTable[key][i],
                fileName
              );
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
    }
  }
}

function makeFile(directoryPath, fileContents, fileName) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  // If file to be created is in root dir
  if (directoryPath === "") {
    checkFileExistsAndCreate(fileContents, fileName);
  } else if (
    currentDirectory &&
    fileContents.hasOwnProperty(currentDirectory)
  ) {
    if (directories.length === 0) {
      checkFileExistsAndCreate(fileContents[currentDirectory], fileName);
    } else {
      // Continue recursively for nested directories
      const nestedDirectoryPath = directories.join("/");
      makeFile(nestedDirectoryPath, fileContents[currentDirectory], fileName);
    }
  } else {
    alert("Could not create new file here.");
    return;
  }

  // Update fileTable.json
  if (
    fileContents.system &&
    fileContents.system["fileTable.json"] &&
    typeof fileContents.system["fileTable.json"] === "string"
  ) {
    try {
      const parsedFileTable = JSON.parse(fileContents.system["fileTable.json"]);
      if (parsedFileTable && typeof parsedFileTable === "object") {
        updateFileTable(directoryPath, parsedFileTable, fileName);
        fileContents.system["fileTable.json"] = JSON.stringify(parsedFileTable);
        populateMenu();
      } else {
        console.error("Invalid fileTable.json structure.");
      }
    } catch (error) {
      console.error("Error parsing or updating fileTable.json:", error);
    }
  }
}

function saveFileContentsRecursive(
  directoryPath,
  fileContents,
  fileName,
  fileContent
) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  if (directoryPath === "") {
    fileContents[fileName] = fileContent;
    return;
  }

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

function deleteFileFromTable(fileTable, fileName) {
  for (const key in fileTable) {
    if (Array.isArray(fileTable[key])) {
      const index = fileTable[key].indexOf(fileName);
      if (index !== -1) {
        fileTable[key].splice(index, 1);
        return true; // File found and deleted
      } else {
        // Continue recursively for nested structures
        for (let i = 0; i < fileTable[key].length; i++) {
          if (typeof fileTable[key][i] === "object") {
            if (deleteFileFromTable(fileTable[key][i], fileName)) {
              return true; // File found and deleted
            }
          }
        }
      }
    }
  }
  return false; // File not found
}

function deleteFolderContents(folderContents) {
  for (const key in folderContents) {
    if (folderContents.hasOwnProperty(key)) {
      if (typeof folderContents[key] === "object") {
        // Recursively delete contents if it's a folder
        deleteFolderContents(folderContents[key]);
      }
      delete folderContents[key];
    }
  }
}

function deleteFile(directoryPath, fileContents, fileName) {
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  if (directoryPath === "") {
    delete fileContents[fileName];
    return;
  } else if (
    currentDirectory &&
    fileContents.hasOwnProperty(currentDirectory)
  ) {
    if (directories.length === 0) {
      // Reached the final directory, delete the file or folder if it exists
      if (fileContents[currentDirectory].hasOwnProperty(fileName)) {
        if (typeof fileContents[currentDirectory][fileName] === "object") {
          // If it's a folder, recursively delete all contents
          deleteFolderContents(fileContents[currentDirectory][fileName]);
        }
        delete fileContents[currentDirectory][fileName];

        // Remove the filename from fileTable.json
        if (
          fileContents.system &&
          fileContents.system["fileTable.json"] &&
          typeof fileContents.system["fileTable.json"] === "string"
        ) {
          try {
            const parsedFileTable = JSON.parse(
              fileContents.system["fileTable.json"]
            );

            if (parsedFileTable && typeof parsedFileTable === "object") {
              if (deleteFileFromTable(parsedFileTable, fileName)) {
                fileContents.system["fileTable.json"] =
                  JSON.stringify(parsedFileTable);
                populateMenu();
              } else {
                console.error("File not found in fileTable.json:", fileName);
              }
            }
          } catch (error) {
            console.error("Error parsing or updating fileTable.json:", error);
          }
        }
      } else {
        console.error("File not found:", fileName);
      }
    } else {
      // Continue recursively for nested directories
      const nestedDirectoryPath = directories.join("/");
      deleteFile(nestedDirectoryPath, fileContents[currentDirectory], fileName);
    }
  }
}

function updateColorVariable(variableName, newColor) {
  const regex = new RegExp(`(${variableName}: ).*?;`);
  fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
    regex,
    `$1 ${newColor};`
  );
}

function changeBGMode(mode) {
  if (mode === "stretch") {
    let regex = new RegExp(`(--bgRepeat: ).*?;`);
    fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
      regex,
      `$1 no-repeat;`
    );

    regex = new RegExp(`(--bgAttachment: ).*?;`);
    fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
      regex,
      `$1 fixed;`
    );

    regex = new RegExp(`(--bgSize: ).*?;`);
    fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
      regex,
      `$1 100% 100%;`
    );
  } else if (mode === "tile") {
    let regex = new RegExp(`(--bgRepeat: ).*?;`);
    fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
      regex,
      `$1 initial;`
    );

    regex = new RegExp(`(--bgAttachment: ).*?;`);
    fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
      regex,
      `$1 initial;`
    );

    regex = new RegExp(`(--bgSize: ).*?;`);
    fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
      regex,
      `$1 initial;`
    );
  }
}

window.onmessage = function (e) {
  if (typeof e.data === "string") {
    console.log(e.data);
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
    } else if (e.data.startsWith("DEL:")) {
      const filePath = e.data.substring(4);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      deleteFile(directoryPath, fileContents, fileName);
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
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
    } else if (e.data.startsWith("U:BGM-")) {
      var jsonString = e.data.substring(6);
      changeBGMode(jsonString);
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
    } else if (e.data.startsWith("MK:F[")) {
      const filePath = e.data.slice(5, -1);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      makeFile(directoryPath, fileContents, fileName);
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
    } else if (e.data.startsWith("U:TF")) {
      if (e.data.substring(4) === "24h") {
        fileContents["system"]["settings.json"] = fileContents["system"][
          "settings.json"
        ].replace(`"timeFormat": "12h"`, `"timeFormat": "24h"`);
      } else {
        fileContents["system"]["settings.json"] = fileContents["system"][
          "settings.json"
        ].replace(`"timeFormat": "24h"`, `"timeFormat": "12h"`);
      }
    } else if (e.data === "POPULATE-MENU") {
      populateMenu();
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
