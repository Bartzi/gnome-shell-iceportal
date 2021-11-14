const St = imports.gi.St;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;

const ByteArray = imports.byteArray;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

const url = "https://iceportal.de/api1/rs/status/";

class Extension {
    constructor() {
        this._indicator = null;
        this.label = null;
        this.timeout = null;
    }

    updateSpeed() {
        let proc = Gio.Subprocess.new(
            ['curl', url],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
    
        proc.communicate_utf8_async(null, null, (proc, res) => {
            let speed;
            try {
                let [, stdout, stderr] = proc.communicate_utf8_finish(res);
    
                if (proc.get_successful()) {
                    let jsonData = JSON.parse(stdout);
                    speed = jsonData.speed;

                    this.queueUpdate();
                } else {
                    throw new Error(stderr);
                }
            } catch (e) {
                logError(e);
                speed = "-"
            }
            this.label.set_text(`${speed} km/h`);
        });
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
