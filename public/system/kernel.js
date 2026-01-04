// Helper function to broadcast file structure to all iframes
async function broadcastFileStructure() {
  const fileContents = await exportToObject();
  sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
  // Also update desktop if it exists (desktop is in main window, not iframe)
  if (typeof window.updateDesktop === 'function') {
    window.updateDesktop(fileContents);
  }
}


function sendMessageToAllIframes(message) {
  const iframes = document.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    iframes[i].contentWindow.postMessage(message, "*");
  }
}

async function updateBGModeSetting(mode) {
  const settingsContent = await findFileContents("system", "settings.json");
  let updatedSettings;
  if (settingsContent.includes(`"desktopBGMode":`)) {
    updatedSettings = settingsContent.replace(/"desktopBGMode":\s*"[a-zA-Z]+",/, `"desktopBGMode": "${mode}",`);
  } else {
    let tempSettings = JSON.parse(settingsContent);
    tempSettings["desktopBGMode"] = mode;
    updatedSettings = JSON.stringify(tempSettings);
  }
  await saveFileContentsRecursive("system", "settings.json", updatedSettings);
}

async function updateCSSvar(varName, value) {
  let regex = new RegExp(`(${varName}: ).*?;`);
  const cssContent = await findFileContents("system", "gui.css");
  const updatedCSS = cssContent.replace(regex, `$1 ${value};`);
  await saveFileContentsRecursive("system", "gui.css", updatedCSS);
}

async function updateMultipleCSSvars(updates) {
  let cssContent = await findFileContents("system", "gui.css");
  for (const { varName, value } of updates) {
    let regex = new RegExp(`(${varName}: ).*?;`);
    cssContent = cssContent.replace(regex, `$1 ${value};`);
  }
  await saveFileContentsRecursive("system", "gui.css", cssContent);
}

async function changeBGMode(mode) {
  await updateBGModeSetting(mode);

  if (mode === "stretch") {
    await updateCSSvar("--bgRepeat", "no-repeat");
    await updateCSSvar("--bgAttachment", "fixed");
    await updateCSSvar("--bgSize", "100% 100%");
  } else if (mode === "tile") {
    await updateCSSvar("--bgRepeat", "initial");
    await updateCSSvar("--bgAttachment", "initial");
    await updateCSSvar("--bgSize", "initial");
  } else if (mode === "contain") {
    await updateCSSvar("--bgRepeat", "no-repeat");
    await updateCSSvar("--bgAttachment", "fixed");
    await updateCSSvar("--bgSize", "contain");
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
window.onmessage = async function (e) {
  if (e.origin === window.origin && typeof e.data === "string") {
    if (e.data == "REQ:AF") {
      await broadcastFileStructure();
      // Also send directly to desktop update function if it exists
      const fileContents = await exportToObject();
      if (typeof window.updateDesktop === 'function') {
        window.updateDesktop(fileContents);
      }
      return;
    } else if (e.data.startsWith("REQ:PH[")) {
      // Extract the file path from the message
      const filePath = e.data.slice(7, -1);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      // Check if the directory and file exist using IndexedDB
      const fileContent = await findFileContents(directoryPath, fileName);

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
      try {
        await deleteFile(directoryPath, fileName);
        populateMenu();
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
      }
      return;
    } else if (e.data.startsWith("U:THEME[")) {
      // Batch update for theme colors: U:THEME[primColor,secColor,secColorLight,secColorDark]
      const rightBracketIndex = e.data.indexOf("]", 8);
      if (rightBracketIndex === -1) {
        console.error("Invalid theme update format");
        return;
      }
      const colorsStr = e.data.substring(8, rightBracketIndex);
      const colors = colorsStr.split(',');
      if (colors.length === 4) {
        await updateMultipleCSSvars([
          { varName: "--primColor", value: colors[0] },
          { varName: "--secColor", value: colors[1] },
          { varName: "--secColorLight", value: colors[2] },
          { varName: "--secColorDark", value: colors[3] }
        ]);
      }
      return;
    } else if (e.data.startsWith("U:PRIMC")) {
      await updateCSSvar("--primColor", e.data.substring(7));
      return;
    } else if (e.data.startsWith("U:SECCL")) {
      await updateCSSvar("--secColorLight", e.data.substring(7));
      return;
    } else if (e.data.startsWith("U:SECCD")) {
      await updateCSSvar("--secColorDark", e.data.substring(7));
      return;
    } else if (e.data.startsWith("U:SECC")) {
      await updateCSSvar("--secColor", e.data.substring(6));
      return;
    } else if (e.data.startsWith("U:BGM-")) {
      await changeBGMode(e.data.substring(6));
      return;
    } else if (e.data == "REQ:SS") {
      const cssContent = await findFileContents("system", "gui.css");
      if (cssContent) {
        e.source.postMessage("SS:" + cssContent, "*");
      }
      return;
    } else if (e.data == "REQ:OSV") {
      e.source.postMessage("OSV:2.0", "*");
    } else if (e.data.startsWith("REQ:RESIZE[")) {
      // Format: REQ:RESIZE[windowId,width,height]
      const rightBracketIndex = e.data.indexOf("]", 11);
      if (rightBracketIndex === -1) {
        console.error("Invalid resize request format");
        return;
      }
      const params = e.data.substring(11, rightBracketIndex).split(",");
      if (params.length === 3) {
        const windowId = params[0];
        const width = parseInt(params[1], 10);
        const height = parseInt(params[2], 10);
            if (windowId && !isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
          if (typeof window.resizeWindow === 'function') {
            window.resizeWindow(windowId, width, height);
          }
        }
      }
      return;
    } else if (e.data.startsWith("SF:[")) {
      const rightBracketIndex = e.data.indexOf("]");

      // Extract the file path using the index of the right bracket, excluding "SF:[" and the right bracket itself
      const filePath = e.data.slice(4, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      const fileContent = e.data.substring(rightBracketIndex + 1);

      await saveFileContentsRecursive(directoryPath, fileName, fileContent);
      await broadcastFileStructure();
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
        await broadcastFileStructure();
        return;
      }
      try {
        await renamePath(directoryPath, fileName, newName);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
    } else if (e.data.startsWith("RNF:[")) {
      const rightBracketIndex = e.data.indexOf("]");

      const filePath = e.data.slice(5, rightBracketIndex);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      const newName = e.data.substring(rightBracketIndex + 1);
      try {
        await renamePath(directoryPath, fileName, newName);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
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
          const iframe = openProgram(fileName, fileData, false, withFile);
          
          // If a file is associated, send it to the program after it loads
          if (withFile && iframe) {
            (async () => {
              const directories = withFile.split("/");
              const fileFileName = directories.pop();
              const directoryPath = directories.join("/");
              let fileToSend = await findFileContents(directoryPath, fileFileName);
              
              if (fileToSend === null) {
                return;
              }
              
              // Convert Uint8Array to appropriate format based on file type
              const extension = fileFileName.split('.').pop().toLowerCase();
              if (fileToSend instanceof Uint8Array) {
                if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
                  // Text file - decode to string
                  const decoder = new TextDecoder('utf-8');
                  fileToSend = decoder.decode(fileToSend);
                } else {
                  // Binary file - convert to base64
                  let binaryString = "";
                  for (let i = 0; i < fileToSend.length; i += 65535) {
                    binaryString += String.fromCharCode(...fileToSend.slice(i, i + 65535));
                  }
                  fileToSend = btoa(binaryString);
                }
              }
              
              // Wait for iframe to load and be ready to receive messages
              const sendFileWhenReady = () => {
                let fileSent = false;
                let iframeReady = false;
                
                const sendFile = () => {
                  if (fileSent || !iframeReady) return false;
                  try {
                    if (iframe.contentWindow) {
                      iframe.contentWindow.postMessage(`PHFD:[${withFile}]${fileToSend}`, "*");
                      fileSent = true;
                      return true;
                    }
                  } catch (e) {
                    // Can't access iframe yet
                  }
                  return false;
                };
                
                // Listen for READY message from the iframe
                const readyMessageHandler = (e) => {
                  try {
                    if (e.data === "READY:" && iframe.contentWindow && e.source === iframe.contentWindow) {
                      window.removeEventListener('message', readyMessageHandler);
                      iframeReady = true;
                      // Send file immediately when ready
                      setTimeout(() => sendFile(), 50);
                    }
                  } catch (err) {
                    // Ignore errors when checking source
                  }
                };
                window.addEventListener('message', readyMessageHandler);
                
                // Also wait for iframe load event as fallback
                const onLoad = () => {
                  iframe.removeEventListener('load', onLoad);
                  // Wait a bit for READY message, but also try sending after delay
                  setTimeout(() => {
                    iframeReady = true;
                    sendFile();
                  }, 300);
                };
                
                // Check if already loaded
                try {
                  if (iframe.contentWindow && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                    iframe.addEventListener('load', onLoad);
                    // Iframe might already be loaded, wait for READY message
                    setTimeout(() => {
                      iframeReady = true;
                      sendFile();
                    }, 300);
                    return;
                  }
                } catch (e) {
                  // Can't check readyState
                }
                
                iframe.addEventListener('load', onLoad);
                
                // Fallback timeout - send anyway after 2 seconds
                setTimeout(() => {
                  window.removeEventListener('message', readyMessageHandler);
                  iframeReady = true;
                  sendFile();
                }, 2000);
              };
              
              sendFileWhenReady();
            })();
          }
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
      return;
    } else if (e.data.startsWith("OPWD:[")) {
      if (existingDialogIsOpen()) {
        return;
      }
      const fileDialogData = await findFileContents("programs/default", "files.html");
      let modifiedData = fileDialogData;
      modifiedData = modifiedData.replace(
        "--displayBottomDialogActions: none;",
        "--displayBottomDialogActions: initial;"
      );
      modifiedData = modifiedData.replace(
        "--displayIfOpenFileMode: none;",
        "--displayIfOpenFileMode: initial;"
      );
      modifiedData = modifiedData.replace(
        "const initialMode = MODES.OPEN;",
        "const initialMode = MODES.OPEN_FOR_PROGRAM;"
      );
      openProgram(
        "Open File",
        modifiedData,
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

      const fileDialogData = await findFileContents("programs/default", "files.html");
      let modifiedData = fileDialogData;
      modifiedData = modifiedData.replace(
        "--displayBottomDialogActions: none;",
        "--displayBottomDialogActions: initial;"
      );
      modifiedData = modifiedData.replace(
        "--displayIfSaveFileAsMode: none;",
        "--displayIfSaveFileAsMode: initial;"
      );
      modifiedData = modifiedData.replace(
        "const initialMode = MODES.OPEN;",
        "const initialMode = MODES.OPEN_FOR_PROGRAM;"
      );
      openProgram(
        "Save File",
        modifiedData,
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
      const fileToReturn = await findFileContents(directoryPath, fileName);
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
      await saveFileContentsRecursive(directoryPath, fileName, dataToSave);

      await broadcastFileStructure();
      closeProgram("winSaveFileAsDialog", "menSaveFileAsDialog");
      savingFileFor.postMessage(`NSP:[${filePath}${fileName}`);
      return;
    } else if (e.data.startsWith("MK:F[")) {
      const filePath = e.data.slice(5, -1);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");
      try {
        await makeFile(directoryPath, fileName);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
      return;
    } else if (e.data.startsWith("MK:D[")) {
      const filePath = e.data.slice(5, -1);
      const directories = filePath.split("/");
      const folderName = directories.pop();
      const directoryPath = directories.join("/");
      try {
        await makeFolder(directoryPath, folderName);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
      return;
    } else if (e.data.startsWith("MK:SHORTCUT[")) {
      const rightBracketIndex = e.data.indexOf("]", 12);
      if (rightBracketIndex === -1) {
        window.top.postMessage("ALERT:[Invalid shortcut creation format!", "*");
        return;
      }
      const directoryPath = e.data.substring(12, rightBracketIndex);
      const targetPath = e.data.substring(rightBracketIndex + 1);
      
      // Generate shortcut file name (use target file name + .shortcut)
      const targetPathParts = targetPath.split("/").filter(Boolean);
      const targetFileName = targetPathParts[targetPathParts.length - 1];
      const shortcutFileName = targetFileName + ".shortcut";
      
      // Create shortcut JSON content
      const shortcutContent = JSON.stringify({ targetPath: targetPath });
      
      try {
        await saveFileContentsRecursive(directoryPath, shortcutFileName, shortcutContent);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
      return;
    } else if (e.data.startsWith("MK:MENU-SC[")) {
      const path = e.data.substring(11);
      const shortcutsContent = await findFileContents("system", "menuShortcuts.json");
      let newShortcuts = JSON.parse(shortcutsContent);
      if (!newShortcuts.includes(path)) {
        newShortcuts.push(path);
        await saveFileContentsRecursive("system", "menuShortcuts.json", JSON.stringify(newShortcuts));
        populateMenu();
      }
      return;
    } else if (e.data.startsWith("U:TF[")) {
      const settingsContent = await findFileContents("system", "settings.json");
      let updatedSettings;
      if (e.data.substring(5) === "24h") {
        updatedSettings = settingsContent.replace(`"timeFormat": "12h"`, `"timeFormat": "24h"`);
      } else if (e.data.substring(5) === "12h") {
        updatedSettings = settingsContent.replace(`"timeFormat": "24h"`, `"timeFormat": "12h"`);
      }
      if (updatedSettings) {
        await saveFileContentsRecursive("system", "settings.json", updatedSettings);
      }
      return;
    } else if (e.data.startsWith("U:DSKTP-BG[")) {
      const imgPath = e.data.substring(11);
      const regexBG = new RegExp(`("desktopBGPath":\\s*").*?(")`);
      const settingsContent = await findFileContents("system", "settings.json");
      const updatedSettings = settingsContent.replace(regexBG, `$1${imgPath}$2`);
      await saveFileContentsRecursive("system", "settings.json", updatedSettings);
      loadDesktopBG();
      return;
    } else if (e.data.startsWith("U:FA[")) {
      const rightBracketIndex = e.data.indexOf("]", 5);
      if (rightBracketIndex === -1) {
        window.top.postMessage("ALERT:[Invalid file associations format!]", "*");
        return;
      }
      const associationsJson = e.data.substring(5, rightBracketIndex);
      try {
        const associations = JSON.parse(associationsJson);
        let settingsContent = await findFileContents("system", "settings.json");
        const settings = JSON.parse(settingsContent);
        settings.fileAssociations = associations;
        await saveFileContentsRecursive("system", "settings.json", JSON.stringify(settings, null, 2));
      } catch (error) {
        console.error("Error saving file associations:", error);
        window.top.postMessage("ALERT:[Error saving file associations: " + error.message + "]", "*");
      }
      return;
    } else if (e.data.startsWith("COPY:")) {
      // Format: COPY:sourcePath|itemName|targetPath
      // Using | as delimiter to avoid issues with brackets in paths
      const parts = e.data.substring(5).split("|");
      if (parts.length !== 3) {
        window.top.postMessage("ALERT:[Invalid COPY message format!", "*");
        return;
      }
      
      const sourcePath = parts[0];
      const itemName = parts[1];
      const targetPath = parts[2];
      
      // Remove trailing slashes and normalize empty paths
      const sourceDirectoryPath = sourcePath.replace(/\/$/, '');
      const targetDirectoryPath = targetPath.replace(/\/$/, '');
      
      try {
        await copyPath(sourceDirectoryPath, itemName, targetDirectoryPath);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
      return;
    } else if (e.data.startsWith("MOVE:")) {
      // Format: MOVE:sourcePath|itemName|targetPath
      // Using | as delimiter to avoid issues with brackets in paths
      const parts = e.data.substring(5).split("|");
      if (parts.length !== 3) {
        window.top.postMessage("ALERT:[Invalid MOVE message format!", "*");
        return;
      }
      
      const sourcePath = parts[0];
      const itemName = parts[1];
      const targetPath = parts[2];
      
      // Remove trailing slashes and normalize empty paths
      const sourceDirectoryPath = sourcePath.replace(/\/$/, '');
      const targetDirectoryPath = targetPath.replace(/\/$/, '');
      
      try {
        await movePath(sourceDirectoryPath, itemName, targetDirectoryPath);
        await broadcastFileStructure();
      } catch (error) {
        window.top.postMessage("ALERT:[" + error.message, "*");
        await broadcastFileStructure();
      }
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
