const GObject = imports.gi.GObject;

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Soup = imports.gi.Soup;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Mainloop = imports.mainloop;

const SPEED_URL = "https://iceportal.de/api1/rs/status/";
const TRIP_INFO_URL = "https://iceportal.de/api1/rs/tripInfo/trip";


class DBAPIQuerier {

    constructor() {
        this.session = new Soup.Session({});
        this.session.user_agent = "ICEPortal Gnome";
    }

    getAndHandleResponse(url, responseHandler) {
        const message = Soup.Message.new_from_uri("GET", Soup.URI.new(url));
        message.request_headers.append("Accept", "application/json");
        this.session.queue_message(
            message,
            responseHandler
        );
    }
}


const SpeedIndicatorAndStationList = GObject.registerClass(
        {GTypeName: 'SpeedIndicatorAndStationList'},
        class SpeedIndicatorAndStationList extends PanelMenu.Button {
            _init() {
                super._init(0.5, 'SpeedIndicatorAndStationList', false);

                this.querier = new DBAPIQuerier();

                let box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
                this.speedLabel = new St.Label({style_class: 'iceportal-label', text: `- km/h`, y_align: Clutter.ActorAlign.CENTER});
                box.add(this.speedLabel);
                this.add_child(box);

                this.updateSpeed();

                this.buildMenu();
            }

            queueUpdate() {
                const that = this;
                this.timeout = Mainloop.timeout_add_seconds(5, () => {
                    that.updateSpeed();
                });
            }

            updateSpeed() {
                this.querier.getAndHandleResponse(SPEED_URL, (session, message) => {
                        let speed = "-";
        
                        if (message.status_code === 200) {
                            try {
                                const jsonData = JSON.parse(message.response_body.data);
                                speed = jsonData.speed;
                            } catch (exception) {
                                log(message.response_body.data);
                                logError(exception);    
                            }
                        } else {
                            log(message.response_body.data);
                        }
        
                        this.speedLabel.set_text(`${speed} km/h`);
                        this.queueUpdate();
                    }
                );
            }

            getTripInfo() {
                this.querier.getAndHandleResponse(TRIP_INFO_URL, (session, message) => {
                    if (message.status_code === 200) {
                        this.clearStops();
                        try {
                            const jsonData = JSON.parse(message.response_body.data);
                            const tripInfo = jsonData.trip;
                            for (const [index, stop] of tripInfo.stops.entries()) {
                                this.addStop(stop, index);
                                
                            }
                        } catch (exception) {
                            log(message.response_body.data);
                            logError(exception);
                        }
                    } else {
                        log(message.response_body.data);
                    }
                });
            }

            buildMenu() {
                this.stationList = new PopupMenu.PopupMenuSection();
                this.stationScrollSection = new PopupMenu.PopupMenuSection();

                const stationScrollView = new St.ScrollView({
                    style_class: 'ci-history-menu-section',
                    overlay_scrollbars: true
                });

                stationScrollView.add_actor(this.stationList.actor);
                this.stationScrollSection.actor.add_actor(stationScrollView);
                this.menu.addMenuItem(this.stationScrollSection);

                this.getTripInfo();

                this.menu.connect('open-state-changed', (element) => {
                    if (element.isOpen) {
                        this.getTripInfo();
                    }
                });
            }

            addStop(item, idx) {
                const menuItem = new PopupMenu.PopupMenuItem('');
                menuItem.menu = this.menu;
                menuItem.id = idx;
                menuItem.label.set_text(item.station.name);
                this.stationList.addMenuItem(menuItem);

                if (item.info.passed) {
                    const clearedIcon = new St.Icon({
                        icon_name: "emblem-ok-symbolic",
                        style_class: "system-status-icon iceportal-passed"
                    })
                    clearedIcon.set_x_align(Clutter.ActorAlign.START);
                    clearedIcon.set_y_align(Clutter.ActorAlign.CENTER);
                    clearedIcon.set_x_expand(true);
                    clearedIcon.set_y_expand(true);
                    menuItem.add(clearedIcon);
                }
            }

            clearStops() {
                this.stationList.removeAll();
            }

        }
    );

class Extension {
    constructor() {
        this._indicator = null;
        this.label = null;
        this.timeout = null;
        this.session = new Soup.Session({});
        this.session.user_agent = "ICEPortal Gnome";

        this.menu = null;
    }

    getAndHandleResponse(url, responseHandler) {
        const message = Soup.Message.new_from_uri("GET", Soup.URI.new(url));
        message.request_headers.append("Accept", "application/json");
        this.session.queue_message(
            message,
            responseHandler
        );
    }

    getTripInfo() {
        this.getAndHandleResponse(TRIP_INFO_URL, (session, message) => {
            if (message.status_code === 200) {
                try {
                    const jsonData = JSON.parse(message.response_body.data);
                    const tripInfo = jsonData.trip;
                    for (const stop of tripInfo.stops) {
                        log(stop.station.name);
                    }
                } catch (exception) {
                    log(message.response_body.data);
                    logError(exception);
                }
            } else {
                log(message.response_body.data);
            }
        });
    }

    updateSpeed() {
        this.getAndHandleResponse(SPEED_URL, (session, message) => {
                let speed = "-";

                if (message.status_code === 200) {
                    try {
                        const jsonData = JSON.parse(message.response_body.data);
                        speed = jsonData.speed;
                    } catch (exception) {
                        log(message.response_body.data);
                        logError(exception);    
                    }
                } else {
                    log(message.response_body.data);
                }

                this.label.set_text(`${speed} km/h`);
                this.queueUpdate();
            }
        );
    }

    queueUpdate() {
        const that = this;
        this.timeout = Mainloop.timeout_add_seconds(5, () => {
            that.updateSpeed();
        });
    }
    
    enable() {
        log(`enabling ${Me.metadata.name}`);

        this.menu = new SpeedIndicatorAndStationList();
        let indicatorName = `${Me.metadata.name} Indicator`;
        Main.panel.addToStatusArea(indicatorName, this.menu);
        // this._indicator = new PanelMenu.Button(0.0, indicatorName, false);
        // this.label = new St.Label({style_class: 'iceportal-label', text: `- km/h`, y_align: Clutter.ActorAlign.CENTER});
        // this._indicator.add_child(this.label);
        // Main.panel.addToStatusArea(indicatorName, this._indicator);
        // this.updateSpeed();
        // this.getTripInfo();
    }
    
    // REMINDER: It's required for extensions to clean up after themselves when
    // they are disabled. This is required for approval during review!
    disable() {
        log(`disabling ${Me.metadata.name}`);

        this.menu.destroy();

        // this.label.destroy();
        // this.label = null;

        // this._indicator.destroy();
        // this._indicator = null;

        // Mainloop.source_remove(this.timeout);
        // this.timeout = null;
    }
}

function init() {
    log(`initializing ${Me.metadata.name}`);
    
    return new Extension();
}
