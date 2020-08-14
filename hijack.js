'use strict';

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Extension = Me.imports.extension;
const Utils = Me.imports.utils;

function LOG(msg) {
    Extension.LOG(msg);
}

function _objKeysToString(name = "", obj) {
    return Extension._objKeysToString(name, obj);
}

const INITIAL_DOCK_STATE_TIMEOUT = 200;
const MAX_INITIAL_DOCK_STATE_CHECKS = 10;
const INITIAL_DOCK_MAGIC_SHOWN = 3;
const DOCK_SIGNALS_LABEL = "dock-signals";

var InitialDockCheck = {
    SHOWING: 0, // the dock is showing
    RETRY: 1, // check dock showing again
    OVER_HOVER: 2, // dock was successfully hidden
    MAX_CHECKS: 3  // max initial dock checks reached
};

var State;


/**
 * 
 */
var Hijacker = class HideDock_Hijacker {

    constructor(udock) {
        this._dockmgr = udock.stateObj.dockManager;
        this._allDocks = this._dockmgr._allDocks;
        this._dock = this._allDocks[0];

        // overview showing
        this._oshow = false;
        // overview was showing
        this._oshowold = false;
        // dock showing
        this._dshow = false;
        // mouse hovering dock
        this._dhover = false;
        // window overlapping dock
        this._woverlap = false;
        // 'this._dock._box' is used by DashToDock to monitor mouse hovering
        this._dockHoverBox = this._dock._box;
        this._dockHoverBoxId = 0;

        //this.connect('destroy', this._onDestroy.bind(this));

        this._signalsHandler = new Utils.HijackSignalsHandler(); //udock.imports.utils.GlobalSignalsHandler();
        this._addSignals();

        // variables used to try and hide initially shown dock
        //this._checkInitialDockStateId = 0;
        this._checkInitialDockStateCount = 0;
        this._checkInitialDockShownCount = 0;


        Utils.asyncTimeoutPostCall(this._hideInitialDock.bind(this),
            INITIAL_DOCK_STATE_TIMEOUT)
            .then(res => this._LOG(`Successfully hid the dock.`));

        //this._hideInitialDock();
    }

    destroy() {
        this._signalsHandler.destroy();

        if (this._dockHoverBoxId != 0) {
            this._dockHoverBox.disconnect(this._dockHoverBoxId);
            this._dockHoverBox = null;
        }
		/*
		if (this._checkInitialDockStateId > 0) {
            GLib.source_remove(this._checkInitialDockStateId);
            this._checkInitialDockStateId = 0;
        }
		*/
    }

    _addSignals() {
        this._signalsHandler.add([
            // update when workarea changes, for instance if  other extensions
            // modify the struts (like moving th panel at the bottom)
            global.display,
            'workareas-changed',
            this._onWorkareasChanged.bind(this)
        ], [
            global.display,
            'in-fullscreen-changed',
            this._onInFullscreenChanged.bind(this)
        ], [
            global.display,
            'restacked',
            this._onRestacked.bind(this)
        ], [
            Main.overview,
            'showing',
            this._onOverviewShowing.bind(this)
        ], [
            Main.overview,
            'hiding',
            this._onOverviewHiding.bind(this)
        ]);

        // add dock signals to signalsHandler
        this._addDockSignals();
    }

    _addDockSignals() {
        this._signalsHandler.addWithLabel(DOCK_SIGNALS_LABEL,
            [   // monitor windows overlapping
                this._dock._intellihide,
                'status-changed',
                this._onWindowOverlapping.bind(this)
            ], [
            // sync hover after a popupmenu is closed
            this._dock.dash,
            'menu-closed',
            this._onPopupMenuClosed.bind(this)
        ], [
            this._dock,
            'showing',
            this._onDockShowing.bind(this)
        ], [
            this._dock,
            'hiding',
            this._onDockHiding.bind(this)
        ]);

        this._dockHoverBoxId = this._dockHoverBox.connect('notify::hover',
            this._dockHoverChanged.bind(this));
    }

    _resetOnDockChange() {
        this._signalsHandler.removeWithLabel(DOCK_SIGNALS_LABEL);

        if (this._dockHoverBoxId != 0) {
            if (this._dockHoverBox) {
                this._LOG("  _dockHoverBox is not NULL");
                this._dockHoverBox.disconnect(this._dockHoverBoxId);
                this._dockHoverBox = null;
            } else {
                this._LOG("  _dockHoverBox IS NULL");
            }
            this._dockHoverBoxId = 0;
        }

        this._dock = this._dockmgr._allDocks[0];
        this._dockHoverBox = this._dock._box;

        this._addDockSignals();
    }

    _hideInitialDock() {
        let check = this._initialDockCheck();

        if (check == InitialDockCheck.RETRY) {
            // dock is either HIDDEN or HIDING, keep checking
            return true;
        } else if (check == InitialDockCheck.SHOWING) {
            // dock is showing, hide it
            this._hideDockNoDelay();

			/* for some reason DashToDock's dock status becomes SHOWN
			 * or SHOWING three times during its initialization, so we
		     * need to keep checking until we've hidden the dock three
             * times */
            if (this._checkInitialDockShownCount < INITIAL_DOCK_MAGIC_SHOWN) {
                return true;
            } else {
                // dock has been hidden 3 times, end the timeout
                return false;
            }
        }

        // at this point 'check' equals OVER_HOVER or MAX_CHECKS, end timeout
        return false;
    }

    _initialDockCheck() {
        if (this._checkInitialDockStateCount >= MAX_INITIAL_DOCK_STATE_CHECKS) {
            return InitialDockCheck.MAX_CHECKS;
        }
        this._checkInitialDockStateCount += 1;

        let dstate = this._dock.getDockState();
        if (dstate == State.HIDING || dstate == State.HIDDEN) {
            // keep trying until dock state is SHOWN or SHOWING
            return InitialDockCheck.RETRY;
        } else if (dstate == State.SHOWING || dstate == State.SHOWN) {
            if (this._oshow || this._dhover) {
                // overview showing or mouse hovering, signal not to hide dock
                return InitialDockCheck.OVER_HOVER;
            } else {
                // no overview or hovering, signal to hide dock
                this._checkInitialDockShownCount += 1;
                return InitialDockCheck.SHOWING;
            }
        }

        return InitialDockCheck.RETRY;
    }



    _onWorkareasChanged() {
        //LOG("Workareas Changed");
    }

    _onInFullscreenChanged() {
        //LOG("In Fullscreen Changed");
    }

    _onRestacked() {
        //LOG("Window Restack or Workspace Change");
    }

    _onPopupMenuClosed() {
        //LOG("Popup Menu Closed");
    }

    _onWindowOverlapping() {
        this._woverlap = true;
        this._updateDockVisibility();

        this._LOG("Window Overlapping");
    }

    _onOverviewShowing() {
        this._oshow = true;
        this._oshowold = true;
        this._updateDockVisibility();

        this._LOG("Overview Showing");
    }

    _onOverviewHiding() {
        this._oshow = false;
        this._updateDockVisibility();

        if (this._dhover) {
            this._oshowold = false;
            this._woverlap = false;
        }

        this._LOG("Overview Hiding");
    }

    _onDockShowing() {
        this._dshow = true;

        this._LOG("Dock Showing");
    }

    _onDockHiding() {
        this._dshow = false;

        this._LOG("Dock Hiding");
    }

    _dockHoverChanged() {
        this._dhover = this._dockHoverBox.hover;
        this._updateDockVisibility();
        this._LOG("Hover Changed")
    }

    _updateDockVisibility() {
        let dstate = this._dock.getDockState();

        if (dstate == State.SHOWN || dstate == State.SHOWING) {
            // don't hide dock when overview showing or mouse hovering
            if (this._oshow || this._dhover)
                return;

            // hide dock without delay when leaving overview, otherwise it
            // looks weird
            if (!this._oshow && !this._dhover && (this._oshowold)) {
                this._oshowold = false;
                this._woverlap = false;

                // use _hideDockNoDelay, _hide has an implicit delay
                this._hideDockNoDelay();
                return;
            }

            if (!this._dhover) {
                this._dock._hide();
            }
        } else if (dstate == State.HIDDEN || dstate == State.HIDING) {
            // show dock when overview is showing or when mouse is hovering
            if (this._oshow || this._dhover) {
                this._dock._show();
            }
        }

    }

    _hideDockNoDelay() {
        this._LOG("  !_hideDockNoDelay!");
        let settings = this._dockmgr._settings;
        this._dock._animateOut(settings.get_double('animation-time'), 0);
    }

	/*_onDestroy() {
		this.destroy();
	}
	*/

    _LOG(msg, diag = false) {
        msg = " Hijacker: " + msg;

        if (diag) {
            msg += `\n  this._oshow=${this._oshow}  this._dshow=${this._dshow}`;
            msg += `\n  this._dhover=${this._dhover}  this._dstate=${this._stateToString(this._dock.getDockState())}`;
            msg += `\n  this._oshowold=${this._oshowold}  this._woverlap=${this._woverlap}`
        }

        msg += "\n";
        LOG(msg);
    }

    _stateToString(state) {
        let states = ["HIDDEN", "SHOWING", "SHOWN", "HIDING"];
        return states[state];
    }
};

const DOCK_MANAGER_SIGNALS_LABEL = "dock-manager";

var HijackerManager = class HideDock_HijackerManager {

    constructor(udock) {
        if (Me.imports.extension._hijackerManager)
            throw new Error('hide-dock has already been initialized');

        Me.imports.extension._hijackerManager = this;

        this._udock = udock;

        /*var State = {HIDDEN:0, SHOWING:1, SHOWN:2, HIDING:3};*/
        State = udock.imports.docking.State;

        this._hijacker = new Hijacker(this._udock);

        this._dockmgr = this._udock.stateObj.dockManager;

        this._signalsHandler = new Utils.HijackSignalsHandler();
        this._addSettingsSignals();

        this._addDockManagerSignals();
    }

    static getDefault() {
        return Me.imports.extension._hijackerManager;
    }

    _addSettingsSignals() {
        let settings = this._dockmgr._settings;
        this._signalsHandler.add([
            settings,
            'changed::scroll-action',
            () => { this._LOG("changed::scroll-action"); }
        ], [
            settings,
            'changed::dash-max-icon-size',
            this._onIconSizeChange.bind(this)
        ], [
            settings,
            'changed::icon-size-fixed',
            () => { this._LOG("changed::icon-size-fixed"); }
        ], [
            settings,
            'changed::show-favorites',
            () => { this._LOG("changed::show-favorites"); }
        ], [
            settings,
            'changed::show-running',
            () => { this._LOG("changed::show-running"); }
        ], [
            settings,
            'changed::show-apps-at-top',
            () => { this._LOG("changed::show-apps-at-top"); }
        ], [
            settings,
            'changed::show-show-apps-button',
            () => { this._LOG("changed::show-show-apps-button"); }
        ], [
            settings,
            'changed::dock-fixed',
            this._onDockFixed.bind(this)
        ], [
            settings,
            'changed::intellihide',
            () => { this._LOG("changed::intellihide"); }
        ], [
            settings,
            'changed::intellihide-mode',
            () => { this._LOG("changed::intellihide-mode'"); }
        ], [
            settings,
            'changed::autohide',
            () => { this._LOG("changed::autohide"); }
        ], [
            settings,
            'changed::autohide-in-fullscreen',
            () => { this._LOG("changed::autohide-in-fullscreen"); }
        ], [
            settings,
            'changed::extend-height',
            () => { this._LOG("changed::extend-height"); }
        ], [
            settings,
            'changed::height-fraction',
            () => { this._LOG("changed::height-fraction'"); }
        ], [
            settings,
            'changed::require-pressure-to-show',
            () => { this._LOG("changed::require-pressure-to-show"); }
        ], [
            settings,
            'changed::pressure-threshold',
            () => { this._LOG("changed::pressure-threshold"); }
        ], [
            Meta.MonitorManager.get(),
            'monitors-changed',
            () => { this._LOG("monitors-changed"); }
        ], [
            Main.sessionMode,
            'updated',
            () => { this._LOG("updated"); }
        ], [
            settings,
            'changed::multi-monitor',
            () => { this._LOG("changed::multi-monitor"); }
        ], [
            settings,
            'changed::preferred-monitor',
            () => { this._LOG("changed::preferred-monitor"); }
        ], [
            settings,
            'changed::dock-position',
            this._onDockPositionChanged.bind(this)
        ], [
            settings,
            'changed::show-trash',
            () => { this._LOG("changed::show-trash"); }
        ], [
            settings,
            'changed::show-mounts',
            () => { this._LOG("changed::show-mounts"); }
        ]);
    }

    _addDockManagerSignals() {
        this._signalsHandler.addWithLabel(DOCK_MANAGER_SIGNALS_LABEL, [
            this._dockmgr,
            'toggled',
            () => { this._LOG("toggled"); }
        ]);
    }

    _onDockFixed() {
        this._LOG("changed::dock-fixed");
    }

    _onIconSizeChange() {
        this._LOG("changed::dash-max-icon-size");
    }

    _onDockPositionChanged() {
        this._LOG("changed::dock-position");

        if (this._hijacker) {
            this._hijacker._resetOnDockChange();
        }
    }

    destroy() {
        this._signalsHandler.destroy();

        if (this._hijacker) {
            this._hijacker.destroy();
        }

		/*
		if (this._checkInitialDockStateId > 0) {
            GLib.source_remove(this._checkInitialDockStateId);
            this._checkInitialDockStateId = 0;
        }
		*/
    }

    _LOG(msg, diag = false) {
        msg = " HijackerManager: " + msg;

        if (diag) {

        }

        msg += "\n";
        LOG(msg);

    }

};

