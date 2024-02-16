# Sacred OS
Sacred OS is a simulated operating system that runs in your browser. It is a Windows 9x inspired OS, and every
HTML file is executable. Sacred OS is written in vanilla JavaScript, which might actually be the first of it's 
kind. Sacred OS uses a bootloader so you can use the OS with your saved settings, programs, files, etc. 

## How it works
Sacred OS runs off a JavaScript object which is essentially the "hard disk". The GUI, the kernal, programs,
and more are all stored here. The bootloader writes to this object either by uploading a disk backup or by
fetching all the necessary files and storing them (what happens when you boot from a fresh install). Sacred
OS and the bootloader uses a file table so that they can properly index files (like NTFS or ext4).

In Sacred OS, HTML files are executable. When you execute an HTML file, it is loaded into a window which
contains an iframe of the HTML file. These HTML files can communicate with the kernel, such as requesting
the system's main style sheet or writing to the disk.

## Current State
Currently, you cannot create files <i>inside</i> Sacred OS, but you can edit non-html files by clicking on
them in the file explorer (which opens them up in notepad). You could create files by editing the JSON
disk backup if you really wanted to.

## Running
In order for Sacred OS to function properly in a local environment, the files need to have an origin to them.
Otherwise, you will expirience CORS errors. One solution is to use Node.js to create an http server.
### Starting the http Server
After cloning the repo, go into your terminal and change the current directory to `public` and run
`npx http-server --cors`.
