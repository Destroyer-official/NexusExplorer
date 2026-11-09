use nexus_core::fs::ops::{create_file, create_folder, rename_entry};
use std::fs;

#[test]
fn test_shell_create_file_and_unique_handling() {
    let temp_dir = std::env::temp_dir().join(format!("nx_shell_test_{}", uuid::Uuid::new_v4().simple()));
    fs::create_dir_all(&temp_dir).unwrap();
    let temp_path = temp_dir.to_string_lossy().to_string();

    // 1. Create file with unique = false
    let f1 = create_file(&temp_path, "note.txt", false).expect("create file should succeed");
    assert_eq!(f1.name, "note.txt");
    assert!(temp_dir.join("note.txt").is_file());

    // 2. Creating again with unique = false should fail with already exists error
    let err = create_file(&temp_path, "note.txt", false).unwrap_err();
    assert!(matches!(err, nexus_core::CoreError::InvalidInput(_)));

    // 3. Creating with unique = true should produce note (2).txt
    let f2 = create_file(&temp_path, "note.txt", true).expect("unique file creation should succeed");
    assert_eq!(f2.name, "note (2).txt");
    assert!(temp_dir.join("note (2).txt").is_file());

    // 4. Create folder with unique = true
    let d1 = create_folder(&temp_path, "Projects", true).expect("create folder should succeed");
    assert_eq!(d1.name, "Projects");
    assert!(d1.is_dir);

    let d2 = create_folder(&temp_path, "Projects", true).expect("unique folder creation should succeed");
    assert_eq!(d2.name, "Projects (2)");
    assert!(d2.is_dir);

    // 5. Rename entry
    let renamed = rename_entry(&f2.path, "renamed_note.txt").expect("rename should succeed");
    assert_eq!(renamed.name, "renamed_note.txt");
    assert!(temp_dir.join("renamed_note.txt").is_file());
    assert!(!temp_dir.join("note (2).txt").exists());

    // 6. Refuse invalid file names with reserved characters
    let inv_err = create_file(&temp_path, "bad:name?.txt", true).unwrap_err();
    assert!(matches!(inv_err, nexus_core::CoreError::InvalidName(_)));

    fs::remove_dir_all(&temp_dir).ok();
}
