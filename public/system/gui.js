function guiStart() {
  populateMenu();
  loadDesktopBG();
  loadFont();
}

function loadFont() {
  const fontPath = JSON.parse(
    fileContents["system"]["settings.json"]
  ).fontOSPath;
  const directories = fontPath.split("/");
  const fileName = directories.pop();
  const directoryPath = directories.join("/");
  let base64FontData = findFileContents(directoryPath, fileContents, fileName);

  const fontMimeType = "font/woff2";
  const fontFamily = "Ark Pixel 12px Proportional latin";
  const fontDataUrl = `url(data:${fontMimeType};base64,${base64FontData})`;

  const regex = new RegExp(
    `(@font-face\\s*{[^}]*font-family:\\s*"${fontFamily}";[^}]*src:\\s*).*?;`,
    "i"
  );
  fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
    regex,
    `$1${fontDataUrl};`
  );

  const styleSheet = document.styleSheets[0]; // Assuming you want to update the first stylesheet
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

function loadDesktopBG() {
  const imagePath = JSON.parse(
    fileContents["system"]["settings.json"]
  ).desktopBGPath;
  const directories = imagePath.split("/");
  const fileName = directories.pop();
  const directoryPath = directories.join("/");
  let base64ImageData = findFileContents(directoryPath, fileContents, fileName);

  const binaryString = atob(base64ImageData);
  const dataArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    dataArray[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([dataArray], { type: "image/png" });
  const objectUrl = URL.createObjectURL(blob);

  const regex = new RegExp(`(--bgBlobURL: ).*?;`);
  fileContents.system["gui.css"] = fileContents.system["gui.css"].replace(
    regex,
    `$1 url("${objectUrl}");`
  );
  document
    .querySelector(":root")
    .style.setProperty("--bgBlobURL", `url("${objectUrl}")`);
}

function populateMenu() {
  let menu = document.getElementById("menuContent");
  menu.innerHTML = "";
  const programList = JSON.parse(fileContents["system"]["menuShortcuts.json"]);

  function appendToMenu(program, programData) {
    let menuItem = document.createElement("div");
    const programName = program.substring(program.lastIndexOf("/") + 1);
    menuItem.innerHTML = programName;
    menuItem.classList = "oSButton osElemBase";
    menuItem.onclick = menuItem.onclick = function () {
      openProgram(programName, programData, true);
    };

    menu.appendChild(menuItem);
  }

  for (let i = 0; i < programList.length; i++) {
    appendToMenu(
      programList[i],
      findFileContents(
        programList[i].substring(0, programList[i].lastIndexOf("/")),
        fileContents,
        programList[i].split("/").pop()
      )
    );
    console.log(programList[i].substring(0, programList[i].lastIndexOf("/")),

    programList[i].split("/").pop())
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
  minimizeButton.textContent = "__";
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

function createMenuBarButton(currentWindowID, programName) {
  let menuBarButton = document.createElement("button");
  menuBarButton.id = `men${currentWindowID}`;
  menuBarButton.classList = "osElemBase oSButton prgrmBarPrgrmBtn";
  menuBarButton.style.border = "var(--borderWidth) inset var(--secColorDark)";
  menuBarButton.textContent = programName;
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

function openProgram(programName, data, dontToggleMenu, withFile) {
  const noResizeMatch = data.match(/<!--.*noRS.*-->/);

  if (dontToggleMenu) {
    toggleOpenmenu();
  }
  windowCount++;
  const currentWindowID = windowCount;
  let window = createWindow(currentWindowID, 0, 0);

  const buttonCount = noResizeMatch ? 2 : 3;
  let header = createHeader(currentWindowID, programName, buttonCount);
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
    iframe.contentDocument.body.addEventListener("click", function () {
      bringWindowToFront(`win${currentWindowID}`, `men${currentWindowID}`);
    });
  };
  window.appendChild(iframe);

  createMenuBarButton(currentWindowID, programName);

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

function updateClock() {
  const is12HourTime =
    JSON.parse(fileContents["system"]["settings.json"]).timeFormat === "12h";
  const today = new Date();
  let h = today.getHours();
  const isPM = is12HourTime && h > 12;
  if (isPM) {
    h -= 12;
  }
  let m = today.getMinutes();
  let s = today.getSeconds();
  m = checkTime(m);
  s = checkTime(s);
  document.getElementById("clock").innerHTML =
    h + ":" + m + ":" + s + getClockEndText(is12HourTime, isPM);
}
setInterval(updateClock, 1000);
