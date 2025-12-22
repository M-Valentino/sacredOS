async function guiStart() {
  await populateMenu();
  await loadDesktopBG();
  await loadFont();
  await initDesktop();
}

async function loadFont() {
  const settingsContent = await findFileContents("system", "settings.json");
  const fontPath = JSON.parse(settingsContent).fontOSPath;
  const directories = fontPath.split("/");
  const fileName = directories.pop();
  const directoryPath = directories.join("/");
  let base64FontData = await findFileContents(directoryPath, fileName);

  const fontMimeType = "font/woff2";
  const fontFamily = "Ark Pixel 12px Proportional latin";
  const fontDataUrl = `url(data:${fontMimeType};base64,${base64FontData})`;

  const regex = new RegExp(
    `(@font-face\\s*{[^}]*font-family:\\s*"${fontFamily}";[^}]*src:\\s*).*?;`,
    "i"
  );
  const cssContent = await findFileContents("system", "gui.css");
  const updatedCSS = cssContent.replace(regex, `$1${fontDataUrl};`);
  await saveFileContentsRecursive("system", "gui.css", updatedCSS);

  const styleSheet = document.styleSheets[0];
  const ruleIndex = [...styleSheet.cssRules].findIndex((rule) =>
    rule.cssText.includes(`font-family: "${fontFamily}"`)
  );
  const newFontFaceRule = `@font-face { font-family: "${fontFamily}"; src: ${fontDataUrl}; }`;

  if (ruleIndex !== -1) {
    styleSheet.deleteRule(ruleIndex);
  }

  styleSheet.insertRule(
    newFontFaceRule,
    ruleIndex !== -1 ? ruleIndex : styleSheet.cssRules.length
  );
}

async function loadDesktopBG() {
  const settingsContent = await findFileContents("system", "settings.json");
  const imagePath = JSON.parse(settingsContent).desktopBGPath;
  const directories = imagePath.split("/");
  const fileName = directories.pop();
  const directoryPath = directories.join("/");
  let base64ImageData = await findFileContents(directoryPath, fileName);

  const binaryString = atob(base64ImageData);
  const dataArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    dataArray[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([dataArray], { type: "image/png" });
  const objectUrl = URL.createObjectURL(blob);

  // Clean up any old blob URLs in CSS (blob URLs are session-specific and shouldn't be persisted)
  const regex = new RegExp(`(--bgBlobURL: ).*?;`);
  const cssContent = await findFileContents("system", "gui.css");
  // If CSS contains a blob URL, reset it to empty (clean up old invalid blob URLs)
  if (cssContent.includes('blob:')) {
    const updatedCSS = cssContent.replace(regex, `$1 "";`);
    await saveFileContentsRecursive("system", "gui.css", updatedCSS);
  }
  
  // Set the blob URL dynamically (not persisted - regenerated on each boot)
  document
    .querySelector(":root")
    .style.setProperty("--bgBlobURL", `url("${objectUrl}")`);
}

async function populateMenu() {
  let menu = document.getElementById("programs");
  menu.innerHTML = "";
  const shortcutsContent = await findFileContents("system", "menuShortcuts.json");
  const programList = JSON.parse(shortcutsContent);

  async function appendToMenu(program, programData) {
    let menuItem = document.createElement("div");
    const iconMatch = programData.match(/<!--.* microIcon="(.+?)".*-->/);
    let img = document.createElement("img");
    if (iconMatch) {
      img.src = iconMatch[1];
    } else {
      const executableIconContent = await findFileContents("system/icons", "executable.json");
      img.src = JSON.parse(executableIconContent).micro;
    }
    img.classList.add("programMenuIcon");
    img.width, (img.height = 27);
    menuItem.appendChild(img);

    const programName = program.substring(program.lastIndexOf("/") + 1);
    let textContainer = document.createElement("div");
    textContainer.classList.add("flexColCenter");
    textContainer.innerHTML = programName;
    menuItem.appendChild(textContainer);

    menuItem.classList = "oSButton osElemBase flexRow";
    menuItem.onclick = menuItem.onclick = function () {
      openProgram(programName, programData, true);
    };

    menu.appendChild(menuItem);
  }

  for (let i = 0; i < programList.length; i++) {
    const programPath = programList[i];
    const directoryPath = programPath.substring(0, programPath.lastIndexOf("/"));
    const fileName = programPath.split("/").pop();
    const programData = await findFileContents(directoryPath, fileName);
    if (programData !== null) {
      await appendToMenu(programPath, programData);
    }
  }
}

let menuOpen = false;
function toggleOpenmenu() {
  menuOpen = !menuOpen;
  if (menuOpen) {
    document.getElementById("mainMenu").style.display = "initial";
    document.getElementById("menuButton").style.border =
      "var(--borderWidth) inset var(--secColorDark)";
  } else {
    document.getElementById("mainMenu").style.display = "none";
    document.getElementById("menuButton").style.border =
      "var(--borderWidth) outset var(--secColorDark)";
  }
}

function createWindow(currentWindowID, xPos, yPos, isAlert) {
  let window = document.createElement("div");
  window.id = `win${currentWindowID}`;
  window.style.zIndex = isAlert ? "999999" : "5";
  window.classList = "window windowRidgeBorder";
  window.style.left = `${xPos}px`;
  window.style.top = `${yPos}px`;
  document.body.appendChild(window);
  return window;
}

function createHeader(currentWindowID, programName, buttonCount) {
  let header = document.createElement("div");
  header.id = `hed${currentWindowID}`;
  header.classList = "menuHeader";
  const style = `width: calc(100% - var(--windowControlButtonWidth) * ${buttonCount})`;
  header.innerHTML = `<div class="menuHeaderTitle" style="${style}">${programName}<div>`;
  return header;
}

function createOverlay() {
  let overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.cursor = "grabbing";
  overlay.style.zIndex = "9999"; // Ensure it's on top of everything
  overlay.style.display = "none"; // Start hidden
  document.body.appendChild(overlay);
  return overlay;
}

function createCloseButton(currentWindowID) {
  let closeButton = document.createElement("button");
  closeButton.id = `close${currentWindowID}`; // Unique ID for the close button
  closeButton.classList = "osElemBase oSButton windowControlButton";
  closeButton.textContent = "X";
  closeButton.style.float = "right";
  closeButton.onclick = function () {
    closeProgram(`win${currentWindowID}`, `men${currentWindowID}`);
  };
  return closeButton;
}

function createMinimizeButton(currentWindowID) {
  let minimizeButton = document.createElement("button");
  minimizeButton.id = `min${currentWindowID}`; // Unique ID for the close button
  minimizeButton.classList = "osElemBase oSButton windowControlButton";
  minimizeButton.textContent = "＿";
  minimizeButton.style.float = "right";
  minimizeButton.onclick = function () {
    minimizeProgram(`win${currentWindowID}`, `men${currentWindowID}`);
  };
  return minimizeButton;
}

function createMaximizeButton(currentWindowID) {
  let maximizeButton = document.createElement("button");
  maximizeButton.id = `max${currentWindowID}`; // Unique ID for the close button
  maximizeButton.classList = "osElemBase oSButton windowControlButton";
  maximizeButton.textContent = "[ ]";
  maximizeButton.style.float = "right";
  maximizeButton.onclick = function () {
    toggleMaximizeProgram(`win${currentWindowID}`, `max${currentWindowID}`);
  };
  return maximizeButton;
}

function createMenuBarButton(currentWindowID, programName, programIcon) {
  let menuBarButton = document.createElement("button");
  menuBarButton.id = `men${currentWindowID}`;
  menuBarButton.classList = "osElemBase oSButton prgrmBarPrgrmBtn";
  menuBarButton.style.border = "var(--borderWidth) inset var(--secColorDark)";
  let container = document.createElement("div");
  container.classList.add("menuButtonInside");
  let img = document.createElement("img");
  img.src = programIcon;
  img.width = 27;
  img.height = 27;
  let textSpan = document.createElement("span");
  textSpan.textContent = programName;
  container.appendChild(img);
  container.appendChild(textSpan);
  menuBarButton.appendChild(container);

  menuBarButton.addEventListener("mousedown", function (e) {
    if (
      menuBarButton.style.border ===
      "var(--borderWidth) inset var(--secColorDark)"
    ) {
      minimizeProgram(`win${currentWindowID}`, `men${currentWindowID}`);
    } else {
      bringWindowToFront(`win${currentWindowID}`, `men${currentWindowID}`);
    }
  });

  document.getElementById("programBar").appendChild(menuBarButton);
}


let windowCount = -1;
let alertCount = -1;

function createAlert(text) {
  windowCount++;
  alertCount++;

  const currentWindowID = `${windowCount}`;

  let underlay = document.createElement("div");
  underlay.id = `underlay${currentWindowID}`;
  underlay.classList.add("underlay");
  document.body.appendChild(underlay);

  let window = createWindow(
    currentWindowID,
    document.body.clientWidth / 2 - 150,
    200,
    true
  );

  let header = createHeader(currentWindowID, "Alert", 1);
  window.appendChild(header);

  let message = document.createElement("p");
  message.classList.add("alertText");
  message.textContent = text;
  window.appendChild(message);

  let okButton = document.createElement("button");
  okButton.id = `close${currentWindowID}`; // Unique ID for the close button
  okButton.classList = "osElemBase oSButton windowControlButton";
  okButton.textContent = " OK ";
  okButton.style.margin = "0 auto 10px";
  okButton.style.display = "block";
  okButton.onclick = function () {
    closeProgram(`win${currentWindowID}`, `men${currentWindowID}`);
    document.body.removeChild(underlay); // Remove the underlay when the alert is closed
  };
  window.appendChild(okButton);
}

function openProgram(
  programName,
  data,
  dontToggleMenu,
  withFile,
  customId = null
) {
  const noResizeMatch = data.match(/<!--.*noRS.*-->/);

  if (dontToggleMenu) {
    toggleOpenmenu();
  }
  windowCount++;
  const currentWindowID = customId || windowCount;
  let window = createWindow(currentWindowID, 0, 0);
  const buttonCount = noResizeMatch ? 2 : 3;

  let header;
  if (withFile) {
    const directories = withFile.split("/");
    const fileName = directories.pop();
    header = createHeader(currentWindowID, fileName, buttonCount);
  } else {
    header = createHeader(currentWindowID, programName, buttonCount);
  }
  window.appendChild(header);

  const closeButton = createCloseButton(currentWindowID);
  header.appendChild(closeButton);

  if (withFile) {
    data = data.replace("<html>", `<html><!--path="${withFile}"-->`);
  }
  const sizeMatch = data.match(/<!--width="(\d+)" height="(\d+)".*-->/);
  const width = sizeMatch ? sizeMatch[1] : "600";
  const height = sizeMatch ? sizeMatch[2] : "400";

  let maximizeButton;
  if (!noResizeMatch) {
    maximizeButton = createMaximizeButton(currentWindowID, width, height);
    header.appendChild(maximizeButton);
  }

  const minimizeButton = createMinimizeButton(currentWindowID);
  header.appendChild(minimizeButton);

  // Create a transparent overlay to have smooth dragging of windows
  let overlay = createOverlay();

  window.addEventListener("click", (e) => {
    if (
      e.target === closeButton ||
      e.target === maximizeButton ||
      e.target === minimizeButton
    ) {
      return;
    }

    bringWindowToFront(`win${currentWindowID}`, `men${currentWindowID}`);
  });

  header.addEventListener("mousedown", function (e) {
    if (
      e.target === closeButton ||
      e.target === maximizeButton ||
      e.target === minimizeButton
    ) {
      return; // Don't start dragging if clicking on the close button
    }
    bringWindowToFront(`win${currentWindowID}`, `men${currentWindowID}`);
    e.preventDefault(); // Prevent any default actions that might interfere with the drag
    overlay.style.display = "block"; // Show the overlay
    const rect = window.getBoundingClientRect();
    const dragOffsetX = e.clientX - rect.left;
    const dragOffsetY = e.clientY - rect.top;

    function onMouseMove(e) {
      window.style.position = "absolute";
      const yResult = e.clientY - dragOffsetY;
      window.style.left = e.clientX - dragOffsetX + "px";
      window.style.top = (0 > yResult ? 0 : yResult) + "px";
    }

    function onMouseUp() {
      overlay.style.display = "none"; // Hide the overlay
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  let iframe = document.createElement("iframe");
  iframe.id = `prog${currentWindowID}`;
  iframe.srcdoc = data;
  // iframe.width = width;
  // iframe.height = height;
  iframe.style.overflow = "hidden";
  iframe.frameBorder = "0";
  iframe.style.border = "0";
  iframe.allowFullscreen = true;
  iframe.onload = function () {
    iframe.contentWindow.postMessage(`ID:[win${currentWindowID}`, "*");
    iframe.contentDocument.body.addEventListener("click", function () {
      bringWindowToFront(`win${currentWindowID}`, `men${currentWindowID}`);
    });
  };
  window.appendChild(iframe);
  let programIcon = data.match(/<!--.* microIcon="(.+?)".*-->/);
  if (programIcon) {
    programIcon = programIcon[1]; // Set to the matched group
    createMenuBarButton(currentWindowID, programName, programIcon);
  } else {
    // Load icon asynchronously
    (async () => {
      const executableIconContent = await findFileContents("system/icons", "executable.json");
      programIcon = JSON.parse(executableIconContent).micro;
      createMenuBarButton(currentWindowID, programName, programIcon);
    })();
  }

  bringWindowToFront(`win${currentWindowID}`, `men${currentWindowID}`);

  registryResizingForProgram({
    noResizeMatch,
    iframeInitSize: {
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    },
    elements: {
      programWindow: window,
      programHeader: header,
      programIframe: iframe,
      programMaximizeButton: maximizeButton,
      programOverlay: overlay,
    },
  });
}

const cursorStatusMap = {
  topBorder: "ns-resize",
  bottomBorder: "ns-resize",
  leftBorder: "ew-resize",
  rightBorder: "ew-resize",
  topLeftCorner: "nwse-resize",
  bottomRightCorner: "nwse-resize",
  topRightCorner: "nesw-resize",
  bottomLeftCorner: "nesw-resize",
  [undefined]: "default",
};

function registryResizingForProgram({
  noResizeMatch,
  iframeInitSize,
  elements,
}) {
  const {
    programWindow,
    programHeader,
    programIframe,
    programMaximizeButton,
    programOverlay,
  } = elements;

  let { borderWidth } = window.getComputedStyle(programWindow);
  borderWidth = parseInt(borderWidth, 10);

  const headerRectHeight = programHeader.getBoundingClientRect().height;

  programIframe.style.height = `calc(100% - ${headerRectHeight}px)`;
  programIframe.style.width = "100%";

  programWindow.style.width = iframeInitSize.width + borderWidth * 2 + "px";
  programWindow.style.height =
    iframeInitSize.height + borderWidth * 2 + headerRectHeight + "px";

  if (noResizeMatch) return;

  const isTopProgramWindow = () => programWindow.style.zIndex === "5";
  const isMaximized = () => programMaximizeButton.textContent !== "[ ]";

  let currentCursorStatus;

  const setCursor = (e) => {
    if (!isTopProgramWindow() || isMaximized()) return;

    if (!e) {
      currentCursorStatus = undefined;
    } else {
      const rect = programWindow.getBoundingClientRect();
      currentCursorStatus = checkCursorPosition(e, rect, borderWidth);
    }

    programWindow.style.cursor = cursorStatusMap[currentCursorStatus];
  };

  programWindow.addEventListener("mousemove", setCursor);

  programWindow.addEventListener("mousedown", (e) => {
    if (e.target !== programWindow || !isTopProgramWindow() || isMaximized()) {
      e.preventDefault();
      return;
    }

    setCursor(e);

    programWindow.removeEventListener("mousemove", setCursor);

    programOverlay.style.display = "block"; // Show the overlay

    function constrainMouseEventPosition(ev) {
      const { clientX, clientY } = ev;
      const { innerWidth, innerHeight } = window;

      const programBar = document.getElementById("programBar");
      const barRect = programBar.getBoundingClientRect();

      const maxYDistance = innerHeight - barRect.height;

      const constrainedX = Math.max(0, Math.min(clientX, innerWidth));
      const constrainedY = Math.max(0, Math.min(clientY, maxYDistance));

      return { clientX: constrainedX, clientY: constrainedY };
    }

    const programWindowMinSize = {
      width: 210,
      height: headerRectHeight + borderWidth * 2,
    };

    const rect = programWindow.getBoundingClientRect();
    const { clientX: oldClientX, clientY: oldClientY } = e;

    const onResizing = (e) => {
      let { clientX, clientY } = constrainMouseEventPosition(e);

      const deltaX = clientX - oldClientX;
      const deltaY = clientY - oldClientY;
      switch (currentCursorStatus) {
        case "topBorder":
          const newHeight = Math.max(
            programWindowMinSize.height,
            rect.height - deltaY
          );

          programWindow.style.height = newHeight + "px";
          programWindow.style.top = rect.top + (rect.height - newHeight) + "px";
          break;
        case "bottomBorder":
          programWindow.style.height =
            Math.max(programWindowMinSize.height, rect.height + deltaY) + "px";
          break;
        case "leftBorder":
          const newWidth = Math.max(
            programWindowMinSize.width,
            rect.width - deltaX
          );
          programWindow.style.width = newWidth + "px";
          programWindow.style.left = rect.left + (rect.width - newWidth) + "px";
          break;
        case "rightBorder":
          programWindow.style.width =
            Math.max(programWindowMinSize.width, rect.width + deltaX) + "px";
          break;
        case "topLeftCorner":
          const newTopHeight = Math.max(
            programWindowMinSize.height,
            rect.height - deltaY
          );
          const newLeftWidth = Math.max(
            programWindowMinSize.width,
            rect.width - deltaX
          );
          programWindow.style.height = newTopHeight + "px";
          programWindow.style.top =
            rect.top + (rect.height - newTopHeight) + "px";
          programWindow.style.width = newLeftWidth + "px";
          programWindow.style.left =
            rect.left + (rect.width - newLeftWidth) + "px";
          break;
        case "bottomRightCorner":
          programWindow.style.height =
            Math.max(programWindowMinSize.height, rect.height + deltaY) + "px";
          programWindow.style.width =
            Math.max(programWindowMinSize.width, rect.width + deltaX) + "px";
          break;
        case "topRightCorner":
          const newRightWidth = Math.max(
            programWindowMinSize.width,
            rect.width + deltaX
          );
          const newTopHeightTR = Math.max(
            programWindowMinSize.height,
            rect.height - deltaY
          );
          programWindow.style.height = newTopHeightTR + "px";
          programWindow.style.top =
            rect.top + (rect.height - newTopHeightTR) + "px";
          programWindow.style.width = newRightWidth + "px";
          break;
        case "bottomLeftCorner":
          const newBottomHeight = Math.max(
            programWindowMinSize.height,
            rect.height + deltaY
          );
          const newLeftWidthBL = Math.max(
            programWindowMinSize.width,
            rect.width - deltaX
          );
          programWindow.style.height = newBottomHeight + "px";
          programWindow.style.width = newLeftWidthBL + "px";
          programWindow.style.left =
            rect.left + (rect.width - newLeftWidthBL) + "px";
          break;
        default:
        // ...
      }
    };

    const onResizingCompleted = (e) => {
      programOverlay.style.display = "none"; // Hide the overlay
      programWindow.addEventListener("mousemove", setCursor);
      document.removeEventListener("mousemove", onResizing);
      document.removeEventListener("mouseup", onResizingCompleted);
      setCursor();
    };

    document.addEventListener("mousemove", onResizing);
    document.addEventListener("mouseup", onResizingCompleted);
  });
}

function checkCursorPosition(e, rect, borderWidth) {
  const { clientX, clientY } = e;
  const { x, y, width, height } = rect;

  const resizableRects = {
    topLeftCorner: { x, y, width: borderWidth, height: borderWidth },
    topRightCorner: {
      x: x + width - borderWidth,
      y,
      width: borderWidth,
      height: borderWidth,
    },
    bottomLeftCorner: {
      x,
      y: y + height - borderWidth,
      width: borderWidth,
      height: borderWidth,
    },
    bottomRightCorner: {
      x: x + width - borderWidth,
      y: y + height - borderWidth,
      width: borderWidth,
      height: borderWidth,
    },
    topBorder: {
      x: x + borderWidth,
      y,
      width: width - borderWidth * 2,
      height: borderWidth,
    },
    bottomBorder: {
      x: x + borderWidth,
      y: y + height - borderWidth,
      width: width - borderWidth * 2,
      height: borderWidth,
    },
    leftBorder: {
      x,
      y: y + borderWidth,
      width: borderWidth,
      height: height - borderWidth * 2,
    },
    rightBorder: {
      x: x + width - borderWidth,
      y: y + borderWidth,
      width: borderWidth,
      height: height - borderWidth * 2,
    },
  };

  const keys = Object.keys(resizableRects);
  const [currentCursorPosition] = keys.filter((key) => {
    return isContain({ x: clientX, y: clientY }, resizableRects[key]);
  });

  return currentCursorPosition;
}

function isContain(point, rect) {
  return (
    point.x > rect.x &&
    point.x < rect.x + rect.width &&
    point.y > rect.y &&
    point.y < rect.y + rect.height
  );
}

function closeProgram(windowID, menuBarButtonID) {
  document.getElementById(windowID).outerHTML = "";
  let menuBarButton = document.getElementById(menuBarButtonID);
  // Alerts don't have a menu bar button
  if (menuBarButton !== null) {
    menuBarButton.outerHTML = "";
  }
}

function toggleMaximizeProgram(windowID, maximizeButtonID) {
  const programWindow = document.getElementById(windowID);
  const button = document.getElementById(maximizeButtonID);

  if (button.textContent === "[ ]") {
    programWindow.setAttribute("preStyle", programWindow.getAttribute("style"));

    programWindow.style.width = "100%";
    programWindow.style.height = "calc(100vh - var(--programBarHeight))";
    programWindow.style.left = 0;
    programWindow.style.top = 0;
    ("calc(100vh - var(--programBarHeight) - var(--headerBarHeight))");
    button.textContent = "[]";
  } else {
    programWindow.style = programWindow.getAttribute("preStyle");
    programWindow.removeAttribute("preStyle");
    button.textContent = "[ ]";
  }
}

function minimizeProgram(windowID, menuButtonID) {
  document.getElementById(windowID).style.display = "none";
  document.getElementById(menuButtonID).style.border =
    "var(--borderWidth) outset var(--secColorDark)";
}

function bringWindowToFront(winID, buttID) {
  document.getElementById(winID).style.display = "initial";
  const windows = document.querySelectorAll('div[id^="win"]');
  windows.forEach(function (win) {
    // If the id matches the specified window, bring it to the front
    if (win.id === winID) {
      win.style.zIndex = "5";
      win.style.boxShadow = "10px 10px 0 0 rgba(0,0,0,0.25)";
    } else {
      win.style.zIndex = "4";
      win.style.boxShadow = "4px 4px 0 0 rgba(0,0,0,0.25)";
      win.style.cursor = "default";
    }
  });
  document.getElementById(buttID).style.border =
    "var(--borderWidth) inset var(--secColorDark)";
}

function checkTime(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}

function getClockEndText(is12HourTime, isPM) {
  if (is12HourTime && !isPM) {
    return " AM";
  } else if (is12HourTime && isPM) {
    return " PM";
  }
  return "";
}

async function updateClock() {
  const settingsContent = await findFileContents("system", "settings.json");
  const is12HourTime = JSON.parse(settingsContent).timeFormat === "12h";
  const today = new Date();
  let h = today.getHours();
  const isPM = is12HourTime && h > 12;
  if (isPM) {
    h -= 12;
  }
  if (h === 0 && is12HourTime) {
    h = 12;
  }
  let m = today.getMinutes();
  let s = today.getSeconds();
  m = checkTime(m);
  s = checkTime(s);
  document.getElementById("clock").innerHTML =
    h + ":" + m + ":" + s + getClockEndText(is12HourTime, isPM);
}
setInterval(() => updateClock(), 1000);

// Desktop functionality
let desktopFiles = {};
let desktopFileAssociations = {};
let desktopDiskBackup = {};

// Make desktop update function globally accessible
window.updateDesktop = function(backupData) {
  desktopDiskBackup = backupData;
  loadDesktopFiles();
};

async function initDesktop() {
  // Request initial file structure and settings via message
  window.top.postMessage("REQ:AF", "*");
  window.top.postMessage("REQ:PH[system/settings.json]", "*");
  
  // Listen for file structure updates
  window.addEventListener("message", handleDesktopMessage);
  
  // Handle desktop context menu
  const desktop = document.getElementById("desktop");
  if (desktop) {
    desktop.addEventListener("contextmenu", handleDesktopContextMenu);
    desktop.addEventListener("click", (e) => {
      // Close context menu if clicking on desktop
      if (e.target === desktop || e.target.closest("#desktop") === desktop) {
        closeDesktopContextMenu();
        // Deselect all icons
        document.querySelectorAll(".desktopIcon.selected").forEach(icon => {
          icon.classList.remove("selected");
        });
      }
    });
  }
}

function handleDesktopMessage(e) {
  if (e.data && typeof e.data === 'string') {
    if (e.data.startsWith("AF:")) {
      const jsonString = e.data.substring(3);
      try {
        desktopDiskBackup = JSON.parse(jsonString);
        loadDesktopFiles();
      } catch (error) {
        console.error("Error parsing desktop file structure:", error);
      }
    } else if (e.data.startsWith("PH:[system/settings.json]")) {
      try {
        const settingsJson = e.data.substring("PH:[system/settings.json]".length);
        const settings = JSON.parse(settingsJson);
        if (settings.fileAssociations) {
          desktopFileAssociations = settings.fileAssociations;
        }
      } catch (error) {
        console.error("Error parsing desktop settings:", error);
      }
    }
  }
}

function loadDesktopFiles(backupData = null) {
  const desktop = document.getElementById("desktop");
  if (!desktop) return;
  
  // Update backup data if provided
  if (backupData) {
    desktopDiskBackup = backupData;
  }
  
  desktop.innerHTML = "";
  
  // Get desktop folder
  if (!desktopDiskBackup.desktop) {
    return;
  }
  
  desktopFiles = desktopDiskBackup.desktop;
  const folderImage = JSON.parse(desktopDiskBackup.system.icons["folder.json"]).normal;
  const documentImage = JSON.parse(desktopDiskBackup.system.icons["document.json"]).normal;
  const imageImage = JSON.parse(desktopDiskBackup.system.icons["picture.json"]).normal;
  const executableImage = JSON.parse(desktopDiskBackup.system.icons["executable.json"]).normal;
  const imgExtensions = [".png", ".gif", ".jpg", ".webp"];
  
  const keys = Object.keys(desktopFiles);
  const savedPositions = loadDesktopIconPositions();
  
  keys.forEach((key, index) => {
    const icon = createDesktopIcon(key, desktopFiles[key], {
      folderImage,
      documentImage,
      imageImage,
      executableImage,
      imgExtensions
    });
    
    // Load saved position or use grid layout
    if (savedPositions[key]) {
      icon.style.left = savedPositions[key].left;
      icon.style.top = savedPositions[key].top;
    } else {
      const cols = Math.floor(window.innerWidth / 100);
      const row = Math.floor(index / cols);
      const col = index % cols;
      icon.style.left = `${20 + col * 100}px`;
      icon.style.top = `${20 + row * 100}px`;
    }
    
    desktop.appendChild(icon);
  });
}

function createDesktopIcon(key, fileData, icons) {
  const icon = document.createElement("div");
  icon.className = "desktopIcon";
  icon.dataset.fileName = key;
  
  const img = document.createElement("img");
  const imgExtensions = icons.imgExtensions;
  
  // Determine icon based on file type
  if (key.endsWith('.shortcut')) {
    const shortcutContent = fileData;
    if (typeof shortcutContent === 'string') {
      try {
        const shortcutData = JSON.parse(shortcutContent);
        if (shortcutData.targetPath) {
          const targetItem = getDesktopItemFromPath(shortcutData.targetPath);
          if (targetItem !== null) {
            const targetPathParts = shortcutData.targetPath.split("/").filter(Boolean);
            const targetFileName = targetPathParts[targetPathParts.length - 1];
            
            if (targetFileName.indexOf('.') === -1) {
              img.src = icons.folderImage;
            } else if (imgExtensions.some(ext => targetFileName.includes(ext))) {
              img.src = icons.imageImage;
            } else if (targetFileName.indexOf('.html') !== -1) {
              if (typeof targetItem === 'string') {
                const iconMatch = targetItem.match(/<!--.* microIcon="(.+?)".*-->/);
                img.src = iconMatch ? iconMatch[1] : icons.executableImage;
              } else {
                img.src = icons.executableImage;
              }
            } else {
              img.src = icons.documentImage;
            }
          } else {
            img.src = icons.documentImage;
          }
        } else {
          img.src = icons.documentImage;
        }
      } catch (error) {
        img.src = icons.documentImage;
      }
    } else {
      img.src = icons.documentImage;
    }
  } else if (key.indexOf('.') === -1) {
    img.src = icons.folderImage;
  } else if (imgExtensions.some(ext => key.includes(ext))) {
    img.src = icons.imageImage;
  } else if (key.indexOf('.html') !== -1) {
    if (typeof fileData === 'string') {
      const iconMatch = fileData.match(/<!--.* microIcon="(.+?)".*-->/);
      img.src = iconMatch ? iconMatch[1] : icons.executableImage;
    } else {
      img.src = icons.executableImage;
    }
  } else {
    img.src = icons.documentImage;
  }
  
  icon.appendChild(img);
  
  const label = document.createElement("div");
  label.className = "desktopIconLabel";
  label.textContent = key;
  icon.appendChild(label);
  
  // Double click to open
  let clickTimeout;
  let clickCount = 0;
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    clickCount++;
    if (clickCount === 1) {
      clickTimeout = setTimeout(() => {
        clickCount = 0;
        // Single click - select
        document.querySelectorAll(".desktopIcon.selected").forEach(i => i.classList.remove("selected"));
        icon.classList.add("selected");
      }, 300);
    } else if (clickCount === 2) {
      clearTimeout(clickTimeout);
      clickCount = 0;
      // Double click - open
      openDesktopFile(key, desktopFiles[key]);
    }
  });
  
  // Drag functionality
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  icon.addEventListener("mousedown", (e) => {
    if (e.button === 0) { // Left mouse button
      isDragging = true;
      icon.classList.add("dragging");
      const rect = icon.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    }
  });
  
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const desktop = document.getElementById("desktop");
      const desktopRect = desktop.getBoundingClientRect();
      let newX = e.clientX - desktopRect.left - dragOffsetX;
      let newY = e.clientY - desktopRect.top - dragOffsetY;
      
      // Constrain to desktop bounds
      newX = Math.max(0, Math.min(newX, desktopRect.width - icon.offsetWidth));
      newY = Math.max(0, Math.min(newY, desktopRect.height - icon.offsetHeight));
      
      icon.style.left = `${newX}px`;
      icon.style.top = `${newY}px`;
    }
  });
  
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      icon.classList.remove("dragging");
      // Save position (could store in localStorage or send to kernel)
      saveDesktopIconPosition(key, icon.style.left, icon.style.top);
    }
  });
  
  // Context menu
  icon.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showDesktopIconContextMenu(e, key);
  });
  
  return icon;
}

function getDesktopItemFromPath(pathString) {
  const pathParts = pathString.split("/").filter(Boolean);
  let currentObject = desktopDiskBackup;
  for (const part of pathParts) {
    if (currentObject && currentObject[part] !== undefined) {
      currentObject = currentObject[part];
    } else {
      return null;
    }
  }
  return currentObject;
}

function getDesktopFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

function openDesktopFileWithAssociation(key, backupObject) {
  const extension = getDesktopFileExtension(key);
  const filePath = `desktop/${key}`;
  
  if (desktopFileAssociations[extension]) {
    const programPath = desktopFileAssociations[extension];
    const pathParts = programPath.split('/');
    const programFileName = pathParts.pop();
    
    let programData = desktopDiskBackup;
    for (const part of programPath.split('/')) {
      if (programData && programData[part] !== undefined) {
        programData = programData[part];
      } else {
        console.error("Program not found:", programPath);
        return false;
      }
    }
    
    const message = {
      action: "openProgram",
      params: { 
        fileName: programFileName, 
        fileData: programData,
        withFile: filePath
      }
    };
    window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
    return true;
  }
  return false;
}

function openDesktopFileInNotepad(key) {
  const message = {
    action: "openProgram",
    params: { 
      fileName: "notepad.html", 
      fileData: desktopDiskBackup["programs"]["default"]["notepad.html"], 
      withFile: `desktop/${key}` 
    }
  };
  window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
}

function resolveDesktopShortcut(shortcutContent) {
  try {
    const shortcutData = JSON.parse(shortcutContent);
    if (shortcutData.targetPath) {
      return shortcutData.targetPath;
    }
    return null;
  } catch (error) {
    console.error("Error parsing shortcut:", error);
    return null;
  }
}

function openDesktopFile(key, backupObject) {
  let keyToCheck = key;
  const extension = keyToCheck.split('.').pop();
  
  // Check if it's a shortcut file
  if (extension === "shortcut") {
    const shortcutContent = backupObject;
    if (typeof shortcutContent !== 'string') {
      window.top.postMessage("ALERT:[Invalid shortcut file!", "*");
      return;
    }
    
    const targetPath = resolveDesktopShortcut(shortcutContent);
    if (!targetPath) {
      window.top.postMessage("ALERT:[Invalid shortcut file format!", "*");
      return;
    }
    
    const targetItem = getDesktopItemFromPath(targetPath);
    if (targetItem === null) {
      window.top.postMessage("ALERT:[Shortcut target not found!", "*");
      return;
    }
    
    const targetPathParts = targetPath.split("/").filter(Boolean);
    const targetFileName = targetPathParts[targetPathParts.length - 1];
    const targetExtension = targetFileName.split('.').pop();
    
    if (targetExtension === "html") {
      const message = {
        action: "openProgram",
        params: { fileName: targetFileName, fileData: targetItem }
      };
      window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
      return;
    }
    
    if (targetFileName.match(/\..*/)) {
      const tempBackup = { [targetFileName]: targetItem };
      if (openDesktopFileWithAssociation(targetFileName, tempBackup)) {
        return;
      }
      const message = {
        action: "openProgram",
        params: { 
          fileName: "notepad.html", 
          fileData: desktopDiskBackup["programs"]["default"]["notepad.html"], 
          withFile: targetPath 
        }
      };
      window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
      return;
    }
    
    if (typeof targetItem === 'object' && targetItem !== null && !Array.isArray(targetItem)) {
      // Open folder in files program
      const message = {
        action: "openProgram",
        params: { 
          fileName: "files.html", 
          fileData: desktopDiskBackup["programs"]["default"]["files.html"]
        }
      };
      window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
      return;
    }
    
    return;
  }
  
  // HTML files open directly
  if (extension === "html") {
    const message = {
      action: "openProgram",
      params: { fileName: key, fileData: backupObject }
    };
    window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
    return;
  }
  
  // Try to open with file association
  if (key.match(/\..*/)) {
    if (openDesktopFileWithAssociation(key)) {
      return;
    }
    // Fallback: if no association, open in notepad
    openDesktopFileInNotepad(key);
    return;
  }
  
  // No extension means it's a folder - open in files program
  const message = {
    action: "openProgram",
    params: { 
      fileName: "files.html", 
      fileData: desktopDiskBackup["programs"]["default"]["files.html"]
    }
  };
  window.top.postMessage(`OP:${JSON.stringify(message)}`, '*');
}

function saveDesktopIconPosition(fileName, left, top) {
  // Store position in localStorage for persistence
  const positions = JSON.parse(localStorage.getItem('desktopIconPositions') || '{}');
  positions[fileName] = { left, top };
  localStorage.setItem('desktopIconPositions', JSON.stringify(positions));
}

function loadDesktopIconPositions() {
  return JSON.parse(localStorage.getItem('desktopIconPositions') || '{}');
}

let desktopContextMenu = null;

function handleDesktopContextMenu(e) {
  e.preventDefault();
  // Only show menu if clicking directly on desktop, not on an icon
  if (e.target === document.getElementById("desktop") || e.target.closest(".desktopIcon") === null) {
    showDesktopContextMenu(e);
  }
}

function showDesktopContextMenu(e) {
  closeDesktopContextMenu();
  
  const menu = document.createElement("div");
  menu.className = "desktopContextMenu";
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.id = "desktopContextMenu";
  
  const newFileBtn = document.createElement("button");
  newFileBtn.textContent = "New File";
  newFileBtn.onclick = () => {
    createDesktopNewFile();
    closeDesktopContextMenu();
  };
  menu.appendChild(newFileBtn);
  
  const newFolderBtn = document.createElement("button");
  newFolderBtn.textContent = "New Folder";
  newFolderBtn.onclick = () => {
    createDesktopNewFolder();
    closeDesktopContextMenu();
  };
  menu.appendChild(newFolderBtn);
  
  document.body.appendChild(menu);
  desktopContextMenu = menu;
  
  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener("click", closeDesktopContextMenu, { once: true });
  }, 0);
}

function showDesktopIconContextMenu(e, key) {
  closeDesktopContextMenu();
  
  const menu = document.createElement("div");
  menu.className = "desktopContextMenu";
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.id = "desktopIconContextMenu";
  
  // Add standard file operations (could expand this)
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = () => {
    window.top.postMessage(`DEL[desktop/${key}`, '*');
    closeDesktopContextMenu();
  };
  menu.appendChild(deleteBtn);
  
  document.body.appendChild(menu);
  desktopContextMenu = menu;
  
  setTimeout(() => {
    document.addEventListener("click", closeDesktopContextMenu, { once: true });
  }, 0);
}

function closeDesktopContextMenu() {
  if (desktopContextMenu) {
    desktopContextMenu.remove();
    desktopContextMenu = null;
  }
}

function createDesktopNewFile() {
  const fileName = prompt("Enter file name:");
  if (fileName && fileName.trim()) {
    let finalName = fileName.trim();
    if (!finalName.includes(".")) {
      finalName = finalName.concat(".txt");
    }
    finalName = finalName.replace("]", "").replace("[", "");
    window.top.postMessage(`MK:F[desktop/${finalName}]`, '*');
  }
}

function createDesktopNewFolder() {
  const folderName = prompt("Enter folder name:");
  if (folderName && folderName.trim()) {
    let finalName = folderName.trim();
    if (finalName.includes(".")) {
      window.top.postMessage("ALERT:[Can't name a folder with \".\"!", "*");
      return;
    }
    finalName = finalName.replace("]", "").replace("[", "");
    window.top.postMessage(`MK:D[desktop/${finalName}]`, '*');
  }
}
