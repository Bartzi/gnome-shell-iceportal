const St = imports.gi.St;
const Soup = imports.gi.Soup;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const Mainloop = imports.mainloop;

const url = "https://iceportal.de/api1/rs/status/";

class Extension {
    constructor() {
        this._indicator = null;
        this.label = null;
        this.timeout = null;
    }

    updateSpeed() {
        const session = new Soup.Session({});

        session.user_agent = "ICEPortal Gnome";
        session.queue_message(
            Soup.Message.new_from_uri("GET", Soup.URI.new(url)),
            (session, message) => {
                let speed = "-";

                if (message.status_code === 200) {
                    let jsonData = JSON.parse(message.response_body.data);
                    speed = jsonData.speed;
                } else {
                    logError(message.response_body.data);
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

        let indicatorName = `${Me.metadata.name} Indicator`;
        this._indicator = new PanelMenu.Button(0.0, indicatorName, false);
        this.label = new St.Label({style_class: 'iceportal-label', text: `- km/h`});
        this._indicator.add_child(this.label);
        Main.panel.addToStatusArea(indicatorName, this._indicator);
        this.updateSpeed();
        this.queueUpdate();
    }
    
    // REMINDER: It's required for extensions to clean up after themselves when
    // they are disabled. This is required for approval during review!
    disable() {
        log(`disabling ${Me.metadata.name}`);

        this._indicator.destroy();
        this._indicator = null;

        this.label.destroy();
        this.label = null;

        Mainloop.source_remove(this.timeout);
        this.timeout = null;
    }
}

function init() {
    log(`initializing ${Me.metadata.name}`);
    
    return new Extension();
}
