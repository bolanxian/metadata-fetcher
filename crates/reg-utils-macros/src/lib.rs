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

use proc_macro::TokenStream as RawTokenStream;
use proc_macro2::{Ident, Span, TokenStream, TokenTree};
use quote::quote;
use std::collections::BTreeSet as Set;
use std::path::{Path, PathBuf};
const NAME: &'static str = "KnownFolderId";

/// Locate `windows-sys`'s `Shell/mod.rs` inside the cargo registry.
fn find_shell_mod() -> Set<String> {
    std::env::var("CARGO_MANIFEST_DIR")
        .ok()
        .iter()
        .map(|manifest_dir| PathBuf::from(manifest_dir).join("target"))
        .filter_map(|path| std::fs::read_dir(path).ok())
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("deps"))
        .filter_map(|path| std::fs::read_dir(path).ok())
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with("windows_sys-") && name.ends_with(".d") {
                return Some(entry);
            }
            None
        })
        .filter_map(|entry| std::fs::read_to_string(&entry.path()).ok())
        .flat_map(|content| {
            const PREFIX: &'static str = "windows-sys-";
            const SUFFIX: &'static str = "/src/Windows/Win32/UI/Shell/mod.rs";
            content
                .replace('\\', "/")
                .split("\n\n")
                .flat_map(|line| line.split(' ').skip(1))
                .filter_map(|path| {
                    if path.ends_with(SUFFIX) {
                        let end = path.len() - SUFFIX.len();
                        if let Some(i) = path[..end].rfind('/') {
                            if path[i + 1..].starts_with(PREFIX) {
                                return Some(String::from(path));
                            }
                        }
                    }
                    None
                })
                .collect::<Set<_>>()
        })
        .collect()
}

/// Extract every `<prefix><name>` identifier from the Shell module source.
fn extract_name<P: AsRef<Path>>(path: P, prefix: &str) -> Option<Set<String>> {
    let Ok(content) = std::fs::read_to_string(AsRef::as_ref(&path)) else {
        return None;
    };
    let result: Set<_> = content
        .split(prefix)
        .skip(1)
        .filter_map(|content| {
            let name: String = content
                .chars()
                .take_while(|c| matches!(c, '0'..='9' | 'A'..='Z' | '_' | 'a'..='z'))
                .collect();
            if name.len() > 0 {
                return Some(name);
            }
            None
        })
        .collect();
    Some(result)
}
fn extract_name_set(path_set: &Set<String>, prefix: &str) -> Set<String> {
    path_set
        .iter()
        .filter_map(|path| extract_name(&path, prefix))
        .flatten()
        .collect()
}

/// `known_folder_ids!()` — generate the folder list and lookup function.
#[proc_macro]
pub fn known_folder_ids(input: RawTokenStream) -> RawTokenStream {
    let input: Box<[_]> = TokenStream::from(input).into_iter().collect();
    match &input[1] {
        TokenTree::Punct(punct) if punct.as_char() == ',' => (),
        token => panic!("[{NAME}] expected `,`, found `{:?}`", token),
    };
    let (list_name, func_name) = match (&input[0], &input[2]) {
        (TokenTree::Ident(ident1), TokenTree::Ident(ident2)) => (ident1, ident2),
        token => panic!("[{NAME}] expected Ident, found `{:?}`", token),
    };

    const PREFIX: &'static str = "FOLDERID_";
    let path_set = find_shell_mod();
    for path in &path_set {
        eprintln!("[{NAME}] found {path}");
    }

    let mut ids: Box<[_]> = extract_name_set(&path_set, " FOLDERID_")
        .into_iter()
        .collect();
    match ids.len() {
        0 => panic!("[{NAME}] no {PREFIX}* constants found"),
        i => eprintln!("[{NAME}] {PREFIX}* constants found {i}"),
    }
    ids.sort();

    // User-facing name
    let names: Box<[&str]> = ids.iter().map(AsRef::as_ref).collect();

    // Fully qualified constant path, e.g. `::windows_sys::Win32::UI::Shell::FOLDERID_Desktop`.
    let idents: Box<[_]> = ids
        .iter()
        .map(|s| format!("{PREFIX}{}", s))
        .map(|s| Ident::new(&s, Span::call_site()))
        .map(TokenTree::from)
        .map(TokenStream::from)
        .collect();

    let expanded = quote! {
        /// All known-folder names supported by `known_folder_id`, sorted.
        static #list_name: &[&'static str] = &[ #(#names),* ];

        /// Map a known-folder name (without the `FOLDERID_` prefix) to its
        /// `GUID`, as exported by `windows-sys`.
        fn #func_name(input: &str) -> Option<&'static ::windows_sys::core::GUID> {
            use ::windows_sys::Win32::UI::Shell;
            match input {
                #( #names => Some(&Shell::#idents), )*
                _ => None,
            }
        }
    };

    expanded.into()
}
