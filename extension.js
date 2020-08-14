'use strict';

/**
 * @overview
 * Hide Dock v1.0
 * Jonathan Henly <JonathanHenly@gmail.com>
 * July 2020
 * 
 * ## Note:
 * It's actually possible to get the undecorate-on-maximise behaviour without
 * needing this extension. See the link [5] and in particular, the bit on editing
 * your metacity theme metacity-theme-3.xml. ("Method 2: editing the theme").
 *
 */

// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Params = imports.misc.params;

const Main = imports.ui.main;
const Dash = imports.ui.dash;
const IconGrid = imports.ui.iconGrid;
const Overview = imports.ui.overview;
const OverviewControls = imports.ui.overviewControls;
const PointerWatcher = imports.ui.pointerWatcher;
const Signals = imports.signals;
const ViewSelector = imports.ui.viewSelector;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Layout = imports.ui.layout;
const LayoutManager = imports.ui.main.layoutManager;

const ExtensionUtils = imports.misc.extensionUtils;


const Me = ExtensionUtils.getCurrentExtension();
const Hijack = Me.imports.hijack;
const Utils = Me.imports.utils;

//const Poll = Me.imports.poll;


const UBUNTU_DOCK_UUID = "ubuntu-dock@ubuntu.com"


//const Decoration = Me.imports.decoration;
//const Buttons = Me.imports.buttons;
//const AppMenu = Me.imports.app_menu;

function LOG(msg) {
    if (!msg) {
        log("");
        return;
    }

    log(`[${Me.metadata.name} <${Utils.hmsTimestamp()}>]` + msg);
}

function init(extensionMeta) {
    LOG("initializing");

    //Buttons.init(extensionMeta);
    //Decoration.init(extensionMeta);
    //AppMenu.init(extensionMeta);
}

let _extensionlistenerId;
let _ubuntuDockEnabled;

function enable() {
    LOG("enabling");


    // Listen to enabled extensions for Ubuntu Dock events
    _extensionlistenerId = Main.extensionManager.connect('extension-state-changed',
        onExtensionStateChanged);
}

function onExtensionStateChanged() {

    let ubuntuDockEnabled = !Main.extensionManager._extensionOrder.every((e) => {
        return e != UBUNTU_DOCK_UUID;
    });

    // check if ubuntu dock is enabled or if it becomes disabled
    if (ubuntuDockEnabled && !_ubuntuDockEnabled) {
        _ubuntuDockEnabled = true;

        let udock = Main.extensionManager.lookup(UBUNTU_DOCK_UUID);

        // give udock to Utils first, to extend GlobalSignalsHandler class
        Utils.onUbuntuDockEnabled(udock);

        onUbuntuDockEnabled(udock);
    } else if (!ubuntuDockEnabled && _ubuntuDockEnabled) {
        _ubuntuDockEnabled = false;
        onUbuntuDockDisabled();
    }

}

let _hijackerManager;

function onUbuntuDockEnabled(udock) {
    LOG("Ubuntu Dock ENABLED");
    if (udock) {
        _hijackerManager = new Hijack.HijackerManager(udock);

    } else {
        LOG("udock is null");
    }
}

function onUbuntuDockDisabled() {
    LOG("Ubuntu Dock DISABLED");
    if (_hijackerManager) {
        _hijackerManager.destroy();
        _hijackerManager = null;
    }
}

function disable() {
    LOG("disabling");

    if (_hijackerManager) {
        _hijackerManager.destroy();
        _hijackerManager = null;
    }

    if (_extensionlistenerId) {
        Main.extensionManager.disconnect(_extensionlistenerId);
        _extensionlistenerId = 0;
    }

    //AppMenu.disable();
    //Decoration.disable();
    //Buttons.disable();
}

function _objKeysToString(name = "", obj) {
    let desc = name + " property names: [";
    let k = desc;

    Object.keys(obj).forEach(function(key, index) {
        k += "\n  " + key;
    });

    if (k !== desc)
        k += '\n';

    k += "]";

    return k;
}

function _objKeysArrayToString(name = "", obj) {
    let desc = name + " property names: [";
    let k = desc;

    Object.keys(obj).forEach(function(key, index) {
        k += "\n  " + key;
        if (Array.isArray(obj[key])) {
            k += "\n    " + key + ": [";
            obj[key].forEach(val => {
                k += val + " ";
            });
            k += "]";
        }
    });

    if (k !== desc)
        k += '\n';

    k += "]";

    return k;
}
