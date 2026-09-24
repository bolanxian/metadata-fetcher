//! Procedural macro that extracts every `FOLDERID_*` constant from
//! `windows-sys`'s `Win32::UI::Shell` module and generates:
//!
//! * `KNOWN_FOLDER_ID_LIST` — a static slice of the folder names
//!   (with the `FOLDERID_` prefix stripped).
//! * `known_folder_id(name: &str) -> Option<&'static GUID>` — a lookup
//!   that maps a folder name to its `GUID` constant.
//!
//! The macro locates the `windows-sys` source in the cargo registry at
//! compile time, so the list always matches the `windows-sys` version
//! the consuming crate actually builds against.

use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::quote;
use std::path::PathBuf;

/// Read the resolved `windows-sys` version out of the consuming crate's
/// `Cargo.lock`.
fn windows_sys_version() -> Option<String> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    let lock_path = PathBuf::from(manifest_dir).join("Cargo.lock");
    let content = std::fs::read_to_string(&lock_path).ok()?;

    let needle = "name = \"windows-sys\"";
    let idx = content.find(needle)?;
    let after = &content[idx + needle.len()..];
    let vneedle = "version = \"";
    let vidx = after.find(vneedle)?;
    let rest = &after[vidx + vneedle.len()..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Locate `windows-sys`'s `Shell/mod.rs` inside the cargo registry.
fn find_shell_mod() -> Option<PathBuf> {
    let cargo_home = std::env::var("CARGO_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| std::env::var("HOME").ok().map(|h| PathBuf::from(h).join(".cargo")))?;

    let registry_src = cargo_home.join("registry").join("src");
    if !registry_src.exists() {
        return None;
    }

    let version = windows_sys_version();

    // Walk every index hash directory under registry/src.
    let index_dirs = std::fs::read_dir(&registry_src).ok()?;
    let mut fallback: Option<PathBuf> = None;

    for index_dir in index_dirs.flatten() {
        let entries = match std::fs::read_dir(index_dir.path()) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name.starts_with("windows-sys-") {
                continue;
            }
            let mod_path = entry
                .path()
                .join("src")
                .join("Windows")
                .join("Win32")
                .join("UI")
                .join("Shell")
                .join("mod.rs");
            if !mod_path.exists() {
                continue;
            }
            match &version {
                Some(v) if name == format!("windows-sys-{}", v) => return Some(mod_path),
                _ => {
                    if fallback.is_none() {
                        fallback = Some(mod_path);
                    }
                }
            }
        }
    }

    fallback
}

/// Extract every `FOLDERID_<Name>` identifier from the Shell module source.
fn extract_folder_ids(content: &str) -> Vec<String> {
    let mut ids = Vec::new();
    let bytes = content.as_bytes();
    let prefix = b"FOLDERID_";
    let mut i = 0;
    while i + prefix.len() <= bytes.len() {
        if &bytes[i..i + prefix.len()] == prefix {
            let start = i;
            i += prefix.len();
            while i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
                i += 1;
            }
            ids.push(content[start..i].to_string());
        } else {
            i += 1;
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

/// `known_folder_ids!()` — generate the folder list and lookup function.
#[proc_macro]
pub fn known_folder_ids(_input: TokenStream) -> TokenStream {
    let shell_mod = find_shell_mod().unwrap_or_else(|| {
        panic!(
            "reg-utils-macros: could not locate windows-sys Shell mod.rs in the cargo registry; \
             make sure `windows-sys` is a dependency and has been fetched by cargo"
        )
    });

    let content = std::fs::read_to_string(&shell_mod).unwrap_or_else(|e| {
        panic!(
            "reg-utils-macros: failed to read {}: {}",
            shell_mod.display(),
            e
        )
    });

    let ids = extract_folder_ids(&content);
    if ids.is_empty() {
        panic!(
            "reg-utils-macros: no FOLDERID_* constants found in {}",
            shell_mod.display()
        );
    }

    // User-facing name: strip the `FOLDERID_` prefix.
    let names: Vec<&str> = ids
        .iter()
        .map(|s| s.strip_prefix("FOLDERID_").unwrap_or(s))
        .collect();

    // Fully qualified constant path, e.g. `::windows_sys::Win32::UI::Shell::FOLDERID_Desktop`.
    let const_paths: Vec<proc_macro2::TokenStream> = ids
        .iter()
        .map(|s| {
            let ident = proc_macro2::Ident::new(s, Span::call_site());
            quote! { ::windows_sys::Win32::UI::Shell::#ident }
        })
        .collect();

    let expanded = quote! {
        /// All known-folder names supported by `known_folder_id`, sorted.
        static KNOWN_FOLDER_ID_LIST: &[&'static str] = &[ #(#names),* ];

        /// Map a known-folder name (without the `FOLDERID_` prefix) to its
        /// `GUID`, as exported by `windows-sys`.
        fn known_folder_id(input: &str) -> Option<&'static ::windows_sys::core::GUID> {
            match input {
                #( #names => Some(&#const_paths), )*
                _ => None,
            }
        }
    };

    expanded.into()
}
