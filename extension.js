'use strict';

/**
 * @overview
 * Hide Dock v1.0
 * Jonathan Henly <JonathanHenly@gmail.com>
 * July 2020
 */

const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Hijack = Me.imports.hijack;
const Utils = Me.imports.utils;


const UBUNTU_DOCK_UUID = "ubuntu-dock@ubuntu.com"


function LOG(msg) {
    if (msg == null) {
        msg = "null";
    } else if (msg == undefined) {
        msg = "undefined";
    }

    log(`[${Me.metadata.name} <${Utils.hmsTimestamp()}>]` + msg);
}

function init(extensionMeta) {
    LOG("initializing");
}

let _extensionlistenerId;
let _ubuntuDockEnabled;

function enable() {
    LOG("enabling");


    // listen to enabled extensions for ubuntu dock
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
        // ubuntu dock has been disabled
        _ubuntuDockEnabled = false;
        onUbuntuDockDisabled();
    }

}

var _hijackerManager;

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

    /* ubuntu dock has already cleaned up its objects that hijackerManager is
     * listening to, thus only disconnect listeners from non ubuntu dock objects
     * , via hijackerManager.destroyAfterDock() */
    if (_hijackerManager) {
        _hijackerManager.destroyAfterDock();
        _hijackerManager = null;
    }
}

function disable() {
    LOG("disabling");

    /* only use hijackerManager's destroy method if this extension is disabled
     * while ubuntu dock is enabled, otherwise disconnecting hijackerManager's
     * ubuntu dock signals will cause errors */
    if (_ubuntuDockEnabled) {
        if (_hijackerManager) {
            _hijackerManager.destroy();
            _hijackerManager = null;
        }

    }

    // clean up extensionManager's extension-state-changed listener
    if (_extensionlistenerId) {
        Main.extensionManager.disconnect(_extensionlistenerId);
        _extensionlistenerId = 0;
    }
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
