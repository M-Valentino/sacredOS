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
