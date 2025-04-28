function saveToLocalStorage() {
  localStorage.setItem("SacredSession", JSON.stringify(fileContents));
  window.top.postMessage(
    "ALERT:[Your session has been saved! It is now safe to leave this webpage."
  );
}

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
    return structuredClone(fileContents[fileName]);
  } else if (
    currentDirectory &&
    fileContents.hasOwnProperty(currentDirectory)
  ) {
    if (directories.length === 0) {
      // Reached the final directory, check for the file
      if (fileContents[currentDirectory].hasOwnProperty(fileName)) {
        return structuredClone(fileContents[currentDirectory][fileName]);
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
  console.log(`${fileName} could not be found!`);
  return null; // File not found
}

function checkFileExistsAndCreate(directory, fileName) {
  if (directory.hasOwnProperty(fileName)) {
    window.top.postMessage("ALERT:[A file with that name already exists!");
  } else {
    directory[fileName] = "";
  }
}

function makeFolder(directoryPath, fileContents, folderName) {
  if (folderName === "") {
    window.top.postMessage("ALERT:[Invalid folder name!");
    return;
  }
  const directories = directoryPath.split("/");
  const currentDirectory = directories.shift();

  // If current traversed dir or root dir
  if (directoryPath === "" || directoryPath === "/") {
    if (!fileContents.hasOwnProperty(folderName)) {
      fileContents[folderName] = {};
    } else {
      window.top.postMessage("ALERT:[A folder with that name already exists!");
    }
  } else if (
    currentDirectory &&
    fileContents.hasOwnProperty(currentDirectory)
  ) {
    const nestedDirectoryPath = directories.join("/");
    makeFolder(nestedDirectoryPath, fileContents[currentDirectory], folderName);
  } else {
    window.top.postMessage("ALERT:[Could not create new folder here.");
    return;
  }
}

function makeFile(directoryPath, fileContents, fileName) {
  if (fileName === "") {
    window.top.postMessage("ALERT:[Invalid file name!");
    return;
  }
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
    window.top.postMessage("ALERT:[Could not create new file here.");
    return;
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

function updateBGModeSetting(mode) {
  if (fileContents["system"]["settings.json"].includes(`"desktopBGMode":`)) {
    fileContents["system"]["settings.json"] = fileContents["system"][
      "settings.json"
    ].replace(/"desktopBGMode":\s*"[a-zA-Z]+",/, `"desktopBGMode": "${mode}",`);

    // If setting doesn't exist
  } else {
    let tempSettings = JSON.parse(fileContents["system"]["settings.json"]);
    tempSettings["desktopBGMode"] = mode;
    fileContents["system"]["settings.json"] = JSON.stringify(tempSettings);
  }
}

function updateCSSvar(varName, value) {
  let regex = new RegExp(`(${varName}: ).*?;`);
  fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
    regex,
    `$1 ${value};`
  );
}

function changeBGMode(mode) {
  updateBGModeSetting(mode);

  if (mode === "stretch") {
    updateCSSvar("--bgRepeat", "no-repeat");
    updateCSSvar("--bgAttachment", "fixed");
    updateCSSvar("--bgSize", "100% 100%");
  } else if (mode === "tile") {
    updateCSSvar("--bgRepeat", "initial");
    updateCSSvar("--bgAttachment", "initial");
    updateCSSvar("--bgSize", "initial");
  } else if (mode === "contain") {
    updateCSSvar("--bgRepeat", "no-repeat");
    updateCSSvar("--bgAttachment", "fixed");
    updateCSSvar("--bgSize", "contain");
  }
}

function existingDialogIsOpen() {
  if (document.getElementById("winSaveFileAsDialog")) {
    window.top.postMessage(
      "ALERT:[Please save the file from the existing dialog or cancel it."
    );
    return true;
  } else if (document.getElementById("winOpeningFileDialog")) {
    window.top.postMessage(
      "ALERT:[Please open a file from the existing dialog or cancel it."
    );
    return true;
  }
  return false;
}

let openingFileFor;
let savingFileFor;
let dataToSave;
window.onmessage = function (e) {
  if (e.origin === window.origin && typeof e.data === "string") {
    if (e.data == "REQ:AF") {
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      return;
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
    } else if (e.data.startsWith("DEL[")) {
      const filePath = e.data.substring(4);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      deleteFile(directoryPath, fileContents, fileName);
      populateMenu();
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      return;
    } else if (e.data.startsWith("U:PRIMC")) {
      updateCSSvar("--primColor", e.data.substring(7));
      return;
    } else if (e.data.startsWith("U:SECCL")) {
      updateCSSvar("--secColorLight", e.data.substring(7));
      return;
    } else if (e.data.startsWith("U:SECCD")) {
      updateCSSvar("--secColorDark", e.data.substring(7));
      return;
    } else if (e.data.startsWith("U:SECC")) {
      updateCSSvar("--secColor", e.data.substring(6));
      return;
    } else if (e.data.startsWith("U:BGM-")) {
      changeBGMode(e.data.substring(6));
      return;
    } else if (e.data == "REQ:SS") {
      if (fileContents.system && fileContents.system["gui.css"]) {
        e.source.postMessage("SS:" + fileContents.system["gui.css"], "*");
      }
      return;
    } else if (e.data == "REQ:OSV") {
      e.source.postMessage("OSV:1.18", "*");
    } else if (e.data.startsWith("SF:[")) {
      const rightBracketIndex = e.data.indexOf("]");

      // Extract the file path using the index of the right bracket, excluding "SF:[" and the right bracket itself
      const filePath = e.data.slice(4, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      const fileContent = e.data.substring(rightBracketIndex + 1);

      saveFileContentsRecursive(
        directoryPath,
        fileContents,
        fileName,
        fileContent
      );

      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      return;
    } else if (e.data.startsWith("UHI:[")) {
      const rightBracketIndex = e.data.indexOf("]");
      const windowId = e.data.substring(5, rightBracketIndex);
      const headerId = "hed" + windowId.substring(3);
      const newHeaderName = e.data.substring(rightBracketIndex + 1);
      const header = document.getElementById(headerId);
      let title = header.querySelector(".menuHeaderTitle");
      title.textContent = newHeaderName;
      return;
    } else if (e.data.startsWith("CLOSE:[")) {
      const windowId = e.data.substring(7);
      const menuBarId = "men" + windowId.substring(3);
      closeProgram(windowId, menuBarId);
      return;
    } else if (e.data.startsWith("RND:[")) {
      const rightBracketIndex = e.data.indexOf("]");
      const filePath = e.data.slice(5, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      const newName = e.data.substring(rightBracketIndex + 1);
      if (newName === "" || newName.includes(".")) {
        window.top.postMessage("ALERT:[Invalid folder name!");
        sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
        return;
      }
      const fileOriginalContent = findFileContents(
        directoryPath,
        fileContents,
        fileName
      );
      saveFileContentsRecursive(
        directoryPath,
        fileContents,
        newName,
        fileOriginalContent
      );
      deleteFile(directoryPath, fileContents, fileName);
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
    } else if (e.data.startsWith("RNF:[")) {
      const rightBracketIndex = e.data.indexOf("]");

      const filePath = e.data.slice(5, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      const newName = e.data.substring(rightBracketIndex + 1);
      const fileOriginalContent = findFileContents(
        directoryPath,
        fileContents,
        fileName
      );
      makeFolder(directoryPath, fileContents, newName, fileOriginalContent);
      deleteFile(directoryPath, fileContents, fileName);
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
      return;
    } else if (e.data.startsWith("OPWD:[")) {
      if (existingDialogIsOpen()) {
        return;
      }
      let fileDialogData = fileContents["programs"]["default"]["files.html"];
      fileDialogData = fileDialogData.replace(
        "--displayBottomDialogActions: none;",
        "--displayBottomDialogActions: initial;"
      );
      fileDialogData = fileDialogData.replace(
        "--displayIfOpenFileMode: none;",
        "--displayIfOpenFileMode: initial;"
      );
      fileDialogData = fileDialogData.replace(
        "const initialMode = MODES.OPEN;",
        "const initialMode = MODES.OPEN_FOR_PROGRAM;"
      );
      openProgram(
        "Open File",
        fileDialogData,
        false,
        false,
        "OpeningFileDialog"
      );
      openingFileFor = e.source;
      return;
    } else if (e.data.startsWith("SANF:[")) {
      if (existingDialogIsOpen()) {
        return;
      }

      dataToSave = e.data.substring(6);
      savingFileFor = e.source;
      console.log(dataToSave);

      let fileDialogData = fileContents["programs"]["default"]["files.html"];
      fileDialogData = fileDialogData.replace(
        "--displayBottomDialogActions: none;",
        "--displayBottomDialogActions: initial;"
      );
      fileDialogData = fileDialogData.replace(
        "--displayIfSaveFileAsMode: none;",
        "--displayIfSaveFileAsMode: initial;"
      );
      fileDialogData = fileDialogData.replace(
        "const initialMode = MODES.OPEN;",
        "const initialMode = MODES.OPEN_FOR_PROGRAM;"
      );
      openProgram(
        "Save File",
        fileDialogData,
        false,
        false,
        "SaveFileAsDialog"
      );
      return;
    } else if (e.data.startsWith("OFFD:[")) {
      const filePath = e.data.substring(6);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      const fileToReturn = findFileContents(
        directoryPath,
        fileContents,
        fileName
      );
      openingFileFor.postMessage(`PHFD:[${filePath}]${fileToReturn}`, "*");
      openingFileFor = "";
      closeProgram("winOpeningFileDialog", "menOpeningFileDialog");
      return;
    } else if (e.data.startsWith("SFFD:[")) {
      const rightBracketIndex = e.data.indexOf("]");
      const filePath = e.data.slice(6, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = e.data.substring(rightBracketIndex + 1);
      const directoryPath = directories.join("/");
      saveFileContentsRecursive(
        directoryPath,
        fileContents,
        fileName,
        dataToSave
      );

      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      closeProgram("winSaveFileAsDialog", "menSaveFileAsDialog");
      savingFileFor.postMessage(`NSP:[${filePath}${fileName}`);
      return;
    } else if (e.data.startsWith("MK:F[")) {
      const filePath = e.data.slice(5, -1);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      makeFile(directoryPath, fileContents, fileName);
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      return;
    } else if (e.data.startsWith("MK:D[")) {
      const filePath = e.data.slice(5, -1);
      const directories = filePath.split("/");
      const folderName = directories.pop();
      const directoryPath = directories.join("/");
      makeFolder(`${directoryPath}/`, fileContents, folderName);
      sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
      return;
    } else if (e.data.startsWith("MK:MENU-SC[")) {
      const path = e.data.substring(11);
      let newShortcuts = JSON.parse(
        fileContents["system"]["menuShortcuts.json"]
      );
      if (!newShortcuts.includes(path)) {
        newShortcuts.push(path);
        fileContents["system"]["menuShortcuts.json"] =
          JSON.stringify(newShortcuts);
        populateMenu();
      }
      return;
    } else if (e.data.startsWith("U:TF[")) {
      if (e.data.substring(5) === "24h") {
        fileContents["system"]["settings.json"] = fileContents["system"][
          "settings.json"
        ].replace(`"timeFormat": "12h"`, `"timeFormat": "24h"`);
      } else if (e.data.substring(5) === "12h") {
        fileContents["system"]["settings.json"] = fileContents["system"][
          "settings.json"
        ].replace(`"timeFormat": "24h"`, `"timeFormat": "12h"`);
      }
      return;
    } else if (e.data.startsWith("U:DSKTP-BG[")) {
      const imgPath = e.data.substring(11);
      const regexBG = new RegExp(`("desktopBGPath":\\s*").*?(")`);
      fileContents.system["settings.json"] = fileContents.system[
        "settings.json"
      ].replace(regexBG, `$1${imgPath}$2`);
      loadDesktopBG();
      return;
    } else if (e.data.startsWith("ALERT:[")) {
      createAlert(e.data.substring(7));
      return;
    }
  }
  try {
    if (e.origin === window.origin && typeof e.data === "string") {
      // Ensure e.data is a string for eval
      eval(decodeURI(e.data));
      console.log(e.data);
    }
  } catch (e) {}
};
