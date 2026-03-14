use json;
use json::{object, JsonValue};
use std::collections::BTreeMap as Map;
use std::io;
use winreg::{enums as e, RegKey};

static HKCU: RegKey = RegKey::predef(e::HKEY_CURRENT_USER);
static HKCR: RegKey = RegKey::predef(e::HKEY_CLASSES_ROOT);
static HKLM: RegKey = RegKey::predef(e::HKEY_LOCAL_MACHINE);

pub fn get_default_webbrowser_id() -> io::Result<String> {
    let path = r"SOFTWARE\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice";
    HKCU.open_subkey(path)?.get_value("ProgId")
}
pub fn get_webbrowser_command(prog_id: &str) -> io::Result<String> {
    HKCR.open_subkey(prog_id)?
        .open_subkey(r"shell\open\command")?
        .get_value("")
}
pub fn get_default_webbrowser_command() -> io::Result<String> {
    let prog_id = get_default_webbrowser_id()?;
    get_webbrowser_command(&prog_id)
}

pub struct BrowserInfo {
    pub name: String,
    pub command: String,
}
impl From<BrowserInfo> for JsonValue {
    fn from(info: BrowserInfo) -> JsonValue {
        let words = shell_words::split(&info.command).ok();
        object! {
            name: info.name,
            command: info.command,
            words: words,
        }
    }
}

// 枚举安装的浏览器(https://www.cnblogs.com/talenth/p/14049927.html)
pub fn collect_webbrowser() -> Map<String, String> {
    let path = (
        r"SOFTWARE\Wow6432Node\Clients\StartMenuInternet",
        r"SOFTWARE\Clients\StartMenuInternet",
    );
    let keys = [
        HKLM.open_subkey(path.0),
        HKLM.open_subkey(path.1),
        HKCU.open_subkey(path.0),
        HKCU.open_subkey(path.1),
    ];
    keys.iter()
        .map(Result::as_ref)
        .filter_map(Result::ok)
        .flat_map(|key: &RegKey| {
            key.enum_keys().filter_map(Result::ok).map(|name: String| {
                let key = key.open_subkey(&name)?;
                let name = key.get_value("")?;
                let path = r"Capabilities\URLAssociations";
                let id = key.open_subkey(path)?.get_value("https")?;
                io::Result::Ok((id, name))
            })
        })
        .filter_map(Result::ok)
        .collect()
}
pub fn collect_webbrowser_info() -> Map<String, BrowserInfo> {
    collect_webbrowser()
        .into_iter()
        .map(|(id, name)| {
            let command = get_webbrowser_command(&id)?;
            io::Result::Ok((id, BrowserInfo { name, command }))
        })
        .filter_map(Result::ok)
        .collect()
}

pub struct SoftwareInfo {
    pub name: String,
    pub version: String,
    pub path: String,
}
impl From<SoftwareInfo> for JsonValue {
    fn from(info: SoftwareInfo) -> JsonValue {
        object! {
            name: info.name,
            version: info.version,
            path: info.path,
        }
    }
}

pub fn get_installed_software() -> Map<String, SoftwareInfo> {
    let keys = [HKLM.open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")];
    keys.iter()
        .map(Result::as_ref)
        .filter_map(Result::ok)
        .flat_map(|key: &RegKey| {
            key.enum_keys().filter_map(Result::ok).map(|id: String| {
                let key = key.open_subkey(&id)?;
                let info = SoftwareInfo {
                    name: key.get_value("DisplayName")?,
                    version: key.get_value("DisplayVersion")?,
                    path: key.get_value("InstallLocation")?,
                };
                io::Result::Ok((id, info))
            })
        })
        .filter_map(Result::ok)
        .collect()
}

fn help<D: std::fmt::Display>(arg0: D) -> ! {
    let lnk = "{ targetPath, iconPath, savePath }";
    eprintln!("Usage:");
    eprintln!("\t$ {} <browser|software|default>", &arg0);
    eprintln!("\t$ {} <shortcut> \"{}\"", &arg0, lnk);
    std::process::exit(-1)
}

pub fn main() -> io::Result<()> {
    let args: Box<[String]> = std::env::args().collect();
    if !(args.len() >= 2) {
        help(&args[0]);
    }
    match args[1].as_ref() {
        "browser" => {
            let map = collect_webbrowser_info();
            let default_id = get_default_webbrowser_id().ok();
            let mut json = JsonValue::from(map);
            json["$default"] = JsonValue::from(default_id);
            println!("{}", json::stringify(json));
        }
        "software" => {
            let map = get_installed_software();
            println!("{}", json::stringify(map));
        }
        "default" => {
            let command = get_default_webbrowser_command().ok();
            let words = command.as_deref().map(shell_words::split).map(Result::ok);
            let obj = object! { command: command, words: words.flatten() };
            println!("{}", json::stringify(obj));
        }
        "shortcut" => {
            let Some(arg2) = args.get(2) else {
                help(&args[0]);
            };
            let mut data = json::parse(arg2).map_err(io::Error::other)?;
            let icon_path = data["iconPath"].take_string();
            let (Some(target_path), Some(save_path)) =
                (data["targetPath"].as_str(), data["savePath"].as_str())
            else {
                help(&args[0]);
            };

            let mut shortcut = mslnk::ShellLink::new(target_path).map_err(io::Error::other)?;
            shortcut.set_icon_location(icon_path);
            shortcut.create_lnk(save_path).map_err(io::Error::other)?;
        }
        arg1 => {
            eprintln!("Unknown command: {}", arg1);
            help(&args[0]);
        }
    }
    Ok(())
}
