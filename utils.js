'use strict';

const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Extension = Me.imports.extension;


// extends GlobalSignalsHandler class
var HijackSignalsHandler;

/** 
 * Grabs Ubuntu Dock's GlobalSignalsHandler class and creates
 * HijackSignalsHandler class by extending it.
 * 
 * @param udock - The enabled Ubuntu Dock extension instance
 */
function onUbuntuDockEnabled(udock) {
    HijackSignalsHandler = class HideDock_HijackSignalsHandler
        extends udock.imports.utils.GlobalSignalsHandler {
        // _create(item) { super(item); }

        // override to protect from disconnecting from null or undefined
        _remove(item) {
            if (!item[0] || !item[1])
                return;
            item[0].disconnect(item[1]);
        }
    };
}

/**
 * @return The current date and time in the following format
 * 		   '[M]M/[D]D/YYYY [h]h:[m]m:[s]s[am/pm]'
 */
function fullTimestamp() {
    return `${mdyTimestamp()} ${hmsTimestamp()}`;
}

/**
 * @return The current date in the following format '[M]M/[D]D/YYYY'
 */
function mdyTimestamp() {
    return (new Date()).toLocaleDateString();
}

/**
 * @return The current time in the following format '[h]h:[m]m:[s]s[am/pm]'
 */
function hmsTimestamp() {
    let [t, ampm] = (new Date()).toLocaleTimeString().split(" ");

    return `${t}${ampm.toLocaleLowerCase()}`;
}

/**
 * Idle Promise
 *
 * @param {number} priority - The priority of the idle source
 */
Promise.idle = function(priority) {
    return new Promise(resolve => GLib.idle_add(priority, resolve));
};

/**
 * Timeout Promise (ms)
 *
 * @param {number} priority - The priority of the timeout source
 * @param {number} interval - Delay in milliseconds before resolving
 */
Promise.timeout = function(priority = GLib.PRIORITY_DEFAULT, interval = 200) {
    return new Promise(resolve => GLib.timeout_add(priority, interval, resolve));
};

/**
 * Timeout Promise (s)
 *
 * @param {number} priority - The priority of the timeout source
 * @param {number} interval - Delay in seconds before resolving
 */
Promise.timeoutSeconds = function(priority = GLib.PRIORITY_DEFAULT, interval = 1) {
    return new Promise(resolve => GLib.timeout_add_seconds(priority, interval, resolve));
};

/**
 * Asyncronously waits for a timeout period before executing a passed in
 * function, then, depending on whether the function returns true or false, 
 * repeats.
 * 
 * @param {function} callee - A function that returns true, indicating the
 *                            timeout should repeat, or false, indicating
 *                            the timeout should end.
 * @param {number} interval - Milliseconds to timeout.
 */
async function asyncTimeoutPreCall(callee, interval = 200) {
    try {
        do {
            try {
                await Promise.timeout(GLib.PRIORITY_DEFAULT, interval);
            } catch (e) {
                throw e;
            }
        } while (callee.call());
    } catch (e) {
        logError(e);
    }
}

/**
 * Asyncronously executes a passed in function then, depending on whether the
 * function returns true or false, waits for a timeout period before calling
 * the function again.
 * 
 * @param {function} callee - A function that returns true, indicating the
 *                            timeout should repeat, or false, indicating
 *                            the timeout should end.
 * @param {number} interval - Milliseconds to timeout.
 */
async function asyncTimeoutPostCall(callee, interval = 200) {
    try {
        while (callee.call()) {
            try {
                await Promise.timeout(GLib.PRIORITY_DEFAULT, interval);
            } catch (e) {
                throw e;
            }
        }
    } catch (e) {
        logError(e);
    }
}