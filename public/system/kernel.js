// Helper function to broadcast file structure to all iframes
async function broadcastFileStructure() {
  const fileContents = await exportToObject();
  sendMessageToAllIframes("AF:" + JSON.stringify(fileContents), "*");
}


function sendMessageToAllIframes(message) {
  const iframes = document.getElementsByTagName("iframe");
  for (let i = 0; i < iframes.length; i++) {
    iframes[i].contentWindow.postMessage(message, "*");
  }
}

// Helper function to decode text file from Uint8Array
function decodeTextFile(content) {
  if (content instanceof Uint8Array) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(content);
  }
  return content;
}

// Helper function to encode text file to Uint8Array
function encodeTextFile(content) {
  const encoder = new TextEncoder();
  return encoder.encode(content);
}

async function updateBGModeSetting(mode) {
  let settingsContent = await findFileContents("system", "settings.json");
  settingsContent = decodeTextFile(settingsContent);
  let updatedSettings;
  if (settingsContent.includes(`"desktopBGMode":`)) {
    updatedSettings = settingsContent.replace(/"desktopBGMode":\s*"[a-zA-Z]+",/, `"desktopBGMode": "${mode}",`);
  } else {
    let tempSettings = JSON.parse(settingsContent);
    tempSettings["desktopBGMode"] = mode;
    updatedSettings = JSON.stringify(tempSettings);
  }
  await saveFileContentsRecursive("system", "settings.json", encodeTextFile(updatedSettings));
}

async function updateCSSvar(varName, value) {
  let regex = new RegExp(`(${varName}: ).*?;`);
  let cssContent = await findFileContents("system", "gui.css");
  cssContent = decodeTextFile(cssContent);
  const updatedCSS = cssContent.replace(regex, `$1 ${value};`);
  await saveFileContentsRecursive("system", "gui.css", encodeTextFile(updatedCSS));
}

// Update multiple CSS variables in a single operation to avoid race conditions
async function updateMultipleCSSvars(updates) {
  let cssContent = await findFileContents("system", "gui.css");
  cssContent = decodeTextFile(cssContent);
  let updatedCSS = cssContent;
  
  for (const [varName, value] of Object.entries(updates)) {
    const regex = new RegExp(`(${varName}: ).*?;`);
    updatedCSS = updatedCSS.replace(regex, `$1 ${value};`);
  }
  
  await saveFileContentsRecursive("system", "gui.css", encodeTextFile(updatedCSS));
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
      return;
    } else if (e.data.startsWith("REQ:PH[")) {
      // Extract the file path from the message
      const filePath = e.data.slice(7, -1);
      const directories = filePath.split("/");
      const fileName = directories.pop();
      const directoryPath = directories.join("/");

      // Check if the directory and file exist using IndexedDB
      let fileContent = await findFileContents(directoryPath, fileName);

      if (fileContent !== null) {
        // Convert Uint8Array to appropriate format based on file type
        const extension = fileName.split('.').pop().toLowerCase();
        if (fileContent instanceof Uint8Array) {
          if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
            // Text file - decode to string
            const decoder = new TextDecoder('utf-8');
            fileContent = decoder.decode(fileContent);
          } else {
            // Binary file - convert to base64
            let binaryString = "";
            for (let i = 0; i < fileContent.length; i += 65535) {
              binaryString += String.fromCharCode(...fileContent.slice(i, i + 65535));
            }
            fileContent = btoa(binaryString);
          }
        }
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
      // Batch update all colors for theme changes to avoid race conditions
      const rightBracketIndex = e.data.indexOf("]");
      const themeData = JSON.parse(e.data.substring(8, rightBracketIndex));
      await updateMultipleCSSvars({
        "--primColor": themeData.primColor,
        "--secColor": themeData.secColor,
        "--secColorLight": themeData.secColorLight,
        "--secColorDark": themeData.secColorDark
      });
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
      let cssContent = await findFileContents("system", "gui.css");
      if (cssContent) {
        // Convert Uint8Array to string if needed
        if (cssContent instanceof Uint8Array) {
          const decoder = new TextDecoder('utf-8');
          cssContent = decoder.decode(cssContent);
        }
        e.source.postMessage("SS:" + cssContent, "*");
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
      let fileContent = e.data.substring(rightBracketIndex + 1);

      // Convert string content to Uint8Array for storage
      const extension = fileName.split('.').pop().toLowerCase();
      if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
        // Text file - encode string to Uint8Array
        const encoder = new TextEncoder();
        fileContent = encoder.encode(fileContent);
      } else {
        // Binary file - assume it's base64, convert to Uint8Array
        try {
          const binaryString = atob(fileContent);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileContent = bytes;
        } catch (e) {
          // If base64 decode fails, treat as text
          const encoder = new TextEncoder();
          fileContent = encoder.encode(fileContent);
        }
      }

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
          openProgram(fileName, fileData, false, withFile);
          
          // If a file is associated, send it to the program after it loads
          if (withFile) {
            setTimeout(async () => {
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
              
              // Find the most recently created iframe (should be the one we just opened)
              // Send file to all iframes - they'll filter based on whether they're expecting it
              const iframes = document.getElementsByTagName("iframe");
              for (let i = iframes.length - 1; i >= 0; i--) {
                const iframe = iframes[i];
                if (iframe.contentWindow) {
                  iframe.contentWindow.postMessage(`PHFD:[${withFile}]${fileToSend}`, "*");
                  break; // Only send to the most recent iframe
                }
              }
            }, 300); // Delay to ensure iframe is loaded
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
      let fileDialogData = await findFileContents("programs/default", "files.html");
      // Convert from Uint8Array to string if needed
      if (fileDialogData instanceof Uint8Array) {
        const decoder = new TextDecoder('utf-8');
        fileDialogData = decoder.decode(fileDialogData);
      }
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

      let fileDialogData = await findFileContents("programs/default", "files.html");
      // Convert from Uint8Array to string if needed
      if (fileDialogData instanceof Uint8Array) {
        const decoder = new TextDecoder('utf-8');
        fileDialogData = decoder.decode(fileDialogData);
      }
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
      let fileToReturn = await findFileContents(directoryPath, fileName);
      
      // Convert Uint8Array to appropriate format based on file type
      const extension = fileName.split('.').pop().toLowerCase();
      if (fileToReturn instanceof Uint8Array) {
        if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
          // Text file - decode to string
          const decoder = new TextDecoder('utf-8');
          fileToReturn = decoder.decode(fileToReturn);
        } else {
          // Binary file - convert to base64
          let binaryString = "";
          for (let i = 0; i < fileToReturn.length; i += 65535) {
            binaryString += String.fromCharCode(...fileToReturn.slice(i, i + 65535));
          }
          fileToReturn = btoa(binaryString);
        }
      }
      
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
      
      // Convert string content to Uint8Array for storage
      let contentToSave = dataToSave;
      const extension = fileName.split('.').pop().toLowerCase();
      if (['html', 'css', 'json', 'js', 'txt'].includes(extension)) {
        // Text file - encode string to Uint8Array
        const encoder = new TextEncoder();
        contentToSave = encoder.encode(contentToSave);
      } else {
        // Binary file - assume it's base64, convert to Uint8Array
        try {
          const binaryString = atob(contentToSave);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          contentToSave = bytes;
        } catch (e) {
          // If base64 decode fails, treat as text
          const encoder = new TextEncoder();
          contentToSave = encoder.encode(contentToSave);
        }
      }
      
      await saveFileContentsRecursive(directoryPath, fileName, contentToSave);

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
    } else if (e.data.startsWith("MK:MENU-SC[")) {
      const path = e.data.substring(11);
      let shortcutsContent = await findFileContents("system", "menuShortcuts.json");
      shortcutsContent = decodeTextFile(shortcutsContent);
      let newShortcuts = JSON.parse(shortcutsContent);
      if (!newShortcuts.includes(path)) {
        newShortcuts.push(path);
        await saveFileContentsRecursive("system", "menuShortcuts.json", encodeTextFile(JSON.stringify(newShortcuts)));
        populateMenu();
      }
      return;
    } else if (e.data.startsWith("U:TF[")) {
      let settingsContent = await findFileContents("system", "settings.json");
      settingsContent = decodeTextFile(settingsContent);
      let updatedSettings;
      if (e.data.substring(5) === "24h") {
        updatedSettings = settingsContent.replace(`"timeFormat": "12h"`, `"timeFormat": "24h"`);
      } else if (e.data.substring(5) === "12h") {
        updatedSettings = settingsContent.replace(`"timeFormat": "24h"`, `"timeFormat": "12h"`);
      }
      if (updatedSettings) {
        await saveFileContentsRecursive("system", "settings.json", encodeTextFile(updatedSettings));
      }
      return;
    } else if (e.data.startsWith("U:DSKTP-BG[")) {
      const imgPath = e.data.substring(11);
      const regexBG = new RegExp(`("desktopBGPath":\\s*").*?(")`);
      let settingsContent = await findFileContents("system", "settings.json");
      settingsContent = decodeTextFile(settingsContent);
      const updatedSettings = settingsContent.replace(regexBG, `$1${imgPath}$2`);
      await saveFileContentsRecursive("system", "settings.json", encodeTextFile(updatedSettings));
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
        settingsContent = decodeTextFile(settingsContent);
        const settings = JSON.parse(settingsContent);
        settings.fileAssociations = associations;
        await saveFileContentsRecursive("system", "settings.json", encodeTextFile(JSON.stringify(settings, null, 2)));
      } catch (error) {
        console.error("Error saving file associations:", error);
        window.top.postMessage("ALERT:[Error saving file associations: " + error.message + "]", "*");
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
